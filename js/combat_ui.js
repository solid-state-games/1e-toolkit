"use strict";
/* combat_ui.js - combat mode screens: the GM "Encounter" sub-tab of the Combat tab (start, surprise, initiative, sides, roll source,
   restrictions, end), the roll window every player sees, and the phase banner popover page (?view=banner).
   Rules and state are in js/combat_state.js (DOM-free). Only the GM writes scene metadata; players only read it.
   OBR calls used: scene.getMetadata/setMetadata/onMetadataChange, scene.items.getItems/onChange, party.getPlayers, player.getMetadata,
   popover.close (SDK 3.1.0). Dice tray: Owlbear Dice extension writes rodeo.owlbear.dice/rollValues to the roller's player metadata. */
const CombatUI = (function () {
    const CS = CombatState, TRAY = "rodeo.owlbear.dice/rollValues";
    let cur = { c: null, logs: {}, sum: [], meta: {} }, items = [], players = [], gmRoot = null, playerRoot = null, msg = "", draft = { n: ["Party", "Foes"], r: [2, 2], side: {} };
    const own = function (i) { return (i.metadata || {})[SheetRules.OWNER_KEY]; };
    const nameOf = function (id) { const it = items.filter(function (x) { return x.id === id; })[0]; return it ? it.name || "Unnamed token" : "token (gone)"; };
    const dexOf = function (id) { const it = items.filter(function (x) { return x.id === id; })[0], sh = it && (it.metadata || {})[SheetRules.KEY]; return sh && sh.sc && sh.sc[3] ? sh.sc[3] : null; };
    // Party = has a sheet, was assigned to a player, or was placed by a player; the rest are Foes (GM can move them)
    const defSide = function (it) { return (it.metadata || {})[SheetRules.KEY] || own(it) || players.some(function (p) { return p.id === it.createdUserId; }) ? 0 : 1; };

    /* ----- shared: data in, roll window out ----- */
    function ingest(meta) { cur = Object.assign({ meta: meta || {} }, CS.read(meta)); render(); }
    function rollWinHtml() {
        const c = cur.c; if (!c) return "";
        const list = cur.logs[c.rd] || [];
        return '<div class="rollwin"><h4>' + (c.rd === 0 ? "Surprise rolls" : "Round " + c.rd + " rolls") + "</h4>" + (list.length ? "<ol>" + list.map(function (e) { return "<li>" + (e[0] ? "<i>segment " + e[0] + "</i> " : "") + esc(CS.entryText(e, c)) + "</li>"; }).join("") + "</ol>" : '<p class="muted small">No rolls yet this round.</p>') + "</div>";
    }
    function bannerHtml() { const b = CS.banner(cur.c); return '<div class="cmban"><b>' + esc(b.a) + "</b><span>" + esc(b.b) + "</span></div>"; }
    function render() {
        if (playerRoot) playerRoot.innerHTML = cur.c ? bannerHtml() + rollWinHtml() : '<p class="muted">No combat is running.</p>';
        if (gmRoot) gmRender();
        const bn = document.getElementById("banner-box"); if (bn) bn.innerHTML = cur.c ? bannerHtml() : '<div class="cmban"><b>Combat over</b></div>';
    }

    /* ----- writing (GM only) ----- */
    async function save(c, logs, sum) {
        if (TK.role !== "GM") return;
        const p = CS.patch(c, logs, sum, CS.fold(c, logs, sum)), meta = Object.assign({}, cur.meta);
        await TK.OBR.scene.setMetadata(p);
        Object.keys(p).forEach(function (k) { if (p[k] === undefined) delete meta[k]; else meta[k] = p[k]; });
        ingest(meta);
    }
    // fn(c, logs, sum) edits copies; returns an optional message
    async function mutate(fn) {
        const c = JSON.parse(JSON.stringify(cur.c)), logs = JSON.parse(JSON.stringify(cur.logs)), sum = JSON.parse(JSON.stringify(cur.sum));
        msg = fn(c, logs, sum) || "";
        try { await save(c, logs, sum); } catch (e) { say(e.message, "ERROR"); }
        render();
    }
    async function readTray() {
        const pid = (gmRoot.querySelector("#cm-trayp") || {}).value, pm = pid && pid !== "me" ? (players.filter(function (p) { return p.id === pid; })[0] || {}).metadata : await TK.OBR.player.getMetadata();
        let v = (pm || {})[TRAY];
        if (v && typeof v === "object" && !Array.isArray(v)) v = Object.keys(v).map(function (k) { return v[k]; });
        if (Array.isArray(v)) v = v[0] && typeof v[0] === "object" ? v[0].value : v[0];
        return v;
    }
    async function takeRoll(kind, i) {
        const rs = cur.c.rs;
        if (rs === 0) return GMCombat.rnd(6);
        const v = rs === 1 ? parseInt((gmRoot.querySelector("#cm-in-" + kind + "-" + i) || {}).value, 10) : Number(await readTray());
        if (!(v >= 1 && v <= 6)) { msg = rs === 1 ? "Type the die result, 1 to 6." : "No d6 result in the Dice tray yet. Roll one d6 there, then press Read tray."; render(); return null; }
        return v;
    }
    async function doRoll(kind, i) {
        const v = await takeRoll(kind, i); if (v === null) return;
        mutate(function (c, logs) {
            const src = c.rs;
            if (kind === "sur") {
                CS.logAdd(logs, 0, CS.entry(c.sg, 1, i, v, c.sd[i].ra, src));
                if (CS.rollSurprise(c, i, v)) { const m = CS.maxSl(c), s = c.sd[0].sl ? 0 : 1; CS.logAdd(logs, 0, CS.entry(0, 1, -1, 0, 0, 0, m ? c.sd[s].n + " surprised for " + m + (m > 1 ? " segments" : " segment") + " (DMG p.61-62)." : "No one is surprised.")); }
            } else {
                CS.logAdd(logs, c.rd, CS.entry(0, 0, i, v, 0, src));
                if (CS.rollInit(c, i, v) >= 0) CS.logAdd(logs, c.rd, CS.entry(0, 0, -1, 0, 0, 0, c.w === 2 ? "Tie: both sides act together." : c.sd[c.w].n + " wins initiative."));
            }
        });
    }

    /* ----- GM screen ----- */
    const opt = function (v, t, sel) { return '<option value="' + v + '"' + (String(v) === String(sel) ? " selected" : "") + ">" + esc(t) + "</option>"; };
    function rollCtl(kind, i) {
        const c = cur.c, rs = c.rs, tail = kind + '" data-i="' + i;
        if (rs === 1) return '<input type="number" min="1" max="6" id="cm-in-' + kind + "-" + i + '" class="cmnum" aria-label="Die result"> <button type="button" class="btn small" data-act="roll" data-k="' + tail + '">Enter</button>';
        return '<button type="button" class="btn small" data-act="roll" data-k="' + tail + '">' + (rs === 2 ? "Read tray" : "Roll d6") + "</button>";
    }
    function startHtml() {
        const sideSel = function (it) { const s = draft.side[it.id] !== undefined ? draft.side[it.id] : defSide(it); return '<select data-tok="' + esc(it.id) + '">' + opt(0, draft.n[0], s) + opt(1, draft.n[1], s) + "</select>"; };
        let h = "<h3>Start combat</h3><p class=\"hint\">Every token on the Character layer joins. A token with a sheet, an owner or placed by a player starts in the first side; the rest start in the second. Change that below.</p>";
        h += '<div class="ctl"><label>Side one <input id="cm-n0" value="' + esc(draft.n[0]) + '" maxlength="24"></label><label>Surprised on 1 to <input type="number" id="cm-r0" min="0" max="6" value="' + draft.r[0] + '" class="cmnum"></label>' +
            '<label>Side two <input id="cm-n1" value="' + esc(draft.n[1]) + '" maxlength="24"></label><label>Surprised on 1 to <input type="number" id="cm-r1" min="0" max="6" value="' + draft.r[1] + '" class="cmnum"></label></div>';
        h += '<p class="hint">Surprise range: 1 to 2 for most (DMG p.61). Some creatures differ (MM entries; fill in by hand for now). 0 means that side cannot be surprised (DMG p.62).</p>';
        h += items.length ? '<table class="grid cmtok"><tr><th>Token</th><th>Side</th></tr>' + items.map(function (it) { return "<tr><td>" + esc(it.name || "Unnamed token") + "</td><td>" + sideSel(it) + "</td></tr>"; }).join("") + "</table>" : '<p class="muted">No character tokens on this scene yet. Put tokens on the Character layer first.</p>';
        return h + '<div class="row"><button type="button" class="btn" data-act="start"' + (items.length ? "" : " disabled") + ">Start combat</button></div>";
    }
    function runHtml() {
        const c = cur.c;
        let h = '<div class="cmtop">' + bannerHtml() + '<div class="cmbtns"><button type="button" class="btn" data-act="next">Next step</button><button type="button" class="btn ghost" data-act="end">End combat</button></div></div>';
        h += '<p class="hint" id="cm-msg">' + esc(msg) + "</p>";
        if (c.rd === 0) {
            h += "<h4>Surprise (DMG p.61-62)</h4>";
            if (!CS.isOn(c, "cm.surprise")) h += '<p class="hint">Surprise is switched off in Restrictions.</p>';
            h += '<table class="grid"><tr><th>Side</th><th>Surprised on 1 to</th><th>d6</th><th>Result</th></tr>' + c.sd.map(function (s, i) {
                const res = s.ra === 0 ? "cannot be surprised" : !s.sr ? "not rolled" : s.sr <= s.ra ? "surprised, " + s.sr + " (after the difference: " + s.sl + " segment" + (s.sl === 1 ? "" : "s") + ")" : "not surprised";
                return "<tr><td>" + esc(s.n) + '</td><td><input type="number" min="0" max="6" class="cmnum" data-range="' + i + '" value="' + s.ra + '"></td><td>' + (s.ra === 0 ? "--" : (s.sr ? "<b>" + s.sr + "</b> " : "") + rollCtl("sur", i)) + "</td><td>" + res + "</td></tr>";
            }).join("") + "</table>";
            if (CS.surpriseReady(c) && CS.maxSl(c)) {
                const sd = c.sd[0].sl ? 0 : 1;
                h += '<p class="hint">Dexterity reaction shortens only that character\'s own lost segments (DMG p.62, p.71; PHB p.11):</p><ul class="chips">' + c.sd[sd].m.map(function (n) { const d = dexOf(c.ro[n]); return "<li>" + esc(nameOf(c.ro[n])) + " (" + (d ? "DEX " + d : "no sheet, no adjustment") + "): " + CS.indivSegs(c, sd, d || 10) + "</li>"; }).join("") + "</ul>";
            }
            h += '<div class="row"><button type="button" class="btn ghost small" data-act="skipsur">No surprise: go to round 1</button></div>';
        } else {
            h += "<h4>Initiative (DMG p.62-63)</h4>";
            if (CS.isOn(c, "cm.initiative")) {
                h += '<table class="grid"><tr><th>Side</th><th>d6</th></tr>' + c.sd.map(function (s, i) { return "<tr><td>" + esc(s.n) + "</td><td>" + (s.in ? "<b>" + s.in + "</b> " : "") + rollCtl("init", i) + "</td></tr>"; }).join("") + "</table>";
            } else h += '<div class="row">First: <button type="button" class="btn small ghost" data-act="first" data-w="0">' + esc(c.sd[0].n) + '</button><button type="button" class="btn small ghost" data-act="first" data-w="1">' + esc(c.sd[1].n) + '</button><button type="button" class="btn small ghost" data-act="first" data-w="2">Simultaneous</button></div>';
            if (c.w === 2) h += '<p class="hint">' + esc(CS.TIE_NOTE) + "</p>";
        }
        h += rollWinHtml();
        h += "<h4>Sides</h4>" + c.sd.map(function (s, i) {
            return '<div class="cmside"><input value="' + esc(s.n) + '" data-name="' + i + '" maxlength="24" aria-label="Side name"><ul class="chips">' + s.m.map(function (n) { return "<li>" + esc(nameOf(c.ro[n])) + ' <button type="button" class="x" title="Move to ' + esc(c.sd[1 - i].n) + '" data-act="move" data-n="' + n + '" data-to="' + (1 - i) + '">&#8646;</button></li>'; }).join("") + "</ul></div>";
        }).join("");
        h += '<h4>Roll source</h4><div class="ctl"><label>Dice <select id="cm-rs">' + opt(0, "Roll in the sheet", c.rs) + opt(1, "Type a physical die result", c.rs) + opt(2, "Owlbear Dice tray", c.rs) + "</select></label>";
        if (c.rs === 2) h += '<label>Read the tray of <select id="cm-trayp">' + opt("me", "me (GM)", (gmRoot.querySelector("#cm-trayp") || {}).value) + players.map(function (p) { return opt(p.id, p.name, (gmRoot.querySelector("#cm-trayp") || {}).value); }).join("") + "</select></label>";
        h += '</div><p class="hint">Each roll in the log says how it was made. The tray route reads the last single d6 that player rolled in the Owlbear Dice tray; the tray cannot be started from here.</p>';
        h += '<h4>Restrictions</h4><ul class="cmtog">' + CS.TOGGLES.map(function (t) { return '<li><label><input type="checkbox" data-tog="' + t.k + '"' + (CS.isOn(c, t.k) ? " checked" : "") + "> <b>" + esc(t.t) + "</b> <span class=\"muted\">" + esc(t.d) + " (" + esc(t.pg) + ")</span></label></li>"; }).join("") + "</ul>";
        return h;
    }
    function gmRender() {
        const keep = document.activeElement && gmRoot.contains(document.activeElement) && document.activeElement.id;
        gmRoot.innerHTML = cur.c ? runHtml() : startHtml();
        if (keep) { const e = gmRoot.querySelector("#" + keep); if (e) e.focus(); }
    }
    async function onClick(e) {
        const b = e.target.closest("[data-act]"); if (!b) return;
        const a = b.dataset.act, c = cur.c;
        if (a === "start") {
            if (!items.length) return;
            const ids = items.map(function (i) { return i.id; }), side = items.map(function (i) { return draft.side[i.id] !== undefined ? draft.side[i.id] : defSide(i); });
            const nc = CS.create(ids, side, draft.n.map(function (n) { return n.trim() || "Side"; }), draft.r);
            if (!CS.isOn(nc, "cm.surprise")) CS.skipSurprise(nc);
            msg = ""; await save(nc, {}, []).catch(function (er) { say(er.message, "ERROR"); }); render();
        } else if (a === "next") mutate(function (c) { const r = CS.advance(c); return r.ok ? "" : r.msg; });
        else if (a === "skipsur") mutate(function (c, logs) { CS.skipSurprise(c); CS.logAdd(logs, 0, CS.entry(0, 1, -1, 0, 0, 0, "Surprise skipped (prior detection or no chance of surprise, DMG p.62).")); });
        else if (a === "roll") doRoll(b.dataset.k, Number(b.dataset.i));
        else if (a === "first") mutate(function (c) { CS.setFirst(c, Number(b.dataset.w)); });
        else if (a === "move") mutate(function (c) { CS.moveToken(c, Number(b.dataset.n), Number(b.dataset.to)); });
        else if (a === "end") endCombat();
    }
    async function endCombat() {
        const c = cur.c; if (!c || !window.confirm("End combat? The log is saved to a text file and cleared from the scene.")) return;
        const text = CS.exportText(c, cur.logs, cur.sum, function (n) { return nameOf(c.ro[n]); });
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = "combat-log-round-" + c.rd + ".txt"; document.body.appendChild(a); a.click(); a.remove();
        try { await TK.OBR.scene.setMetadata(CS.clearPatch(cur.meta)); } catch (er) { say(er.message, "ERROR"); return; }
        msg = ""; ingest(Object.keys(cur.meta).reduce(function (o, k) { if (k !== CS.KEY && k.indexOf(CS.LOGP) !== 0) o[k] = cur.meta[k]; return o; }, {}));
    }
    function onChange(e) {
        const t = e.target, c = cur.c;
        if (t.dataset.tok) draft.side[t.dataset.tok] = Number(t.value);
        else if (t.id === "cm-n0" || t.id === "cm-n1") draft.n[Number(t.id.slice(-1))] = t.value.slice(0, 24);
        else if (t.id === "cm-r0" || t.id === "cm-r1") draft.r[Number(t.id.slice(-1))] = CS.clampRange(t.value);
        else if (!c) return;
        else if (t.dataset.range !== undefined) mutate(function (c) { CS.setRange(c, Number(t.dataset.range), t.value); });
        else if (t.dataset.name !== undefined) mutate(function (c) { if (t.value.trim()) c.sd[Number(t.dataset.name)].n = t.value.trim().slice(0, 24); });
        else if (t.id === "cm-rs") mutate(function (c) { c.rs = Number(t.value); });
        else if (t.dataset.tog) mutate(function (c, logs) { const tg = CS.TOGGLES.filter(function (x) { return x.k === t.dataset.tog; })[0]; CS.setToggle(c, tg.k, t.checked); CS.logAdd(logs, c.rd, CS.entry(0, 10, tg.b, t.checked ? 1 : 0, 0, 0)); if (tg.k === "cm.surprise" && !t.checked && c.rd === 0) CS.skipSurprise(c); });
    }
    async function loadItems() {
        if (TK.role === "GM") { try { players = (await TK.OBR.party.getPlayers()).filter(function (p) { return p.role === "PLAYER"; }); } catch (e) { players = []; } }
        items = (await TK.OBR.scene.items.getItems(function (i) { return i.layer === "CHARACTER"; })).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
        render();
    }

    /* ----- entry points ----- */
    function initGm(el) { gmRoot = el; el.addEventListener("click", onClick); el.addEventListener("change", onChange); }
    function initPlayer(el) { playerRoot = el; }
    // called by the hub once the scene is ready: read, then follow changes
    async function boot() {
        const O = TK.OBR;
        try { if (await O.scene.isReady()) { await loadItems(); ingest(await O.scene.getMetadata()); } } catch (e) { console.warn(e); }
        O.scene.onMetadataChange(ingest); O.scene.items.onChange(loadItems);
        O.scene.onReadyChange(async function (r) { if (r) { await loadItems(); ingest(await O.scene.getMetadata()); } });
        if (TK.role === "GM") O.party.onChange(function (ps) { players = ps.filter(function (p) { return p.role === "PLAYER"; }); });
    }
    // the popover page (?view=banner): phase banner only, plus Hide
    async function bannerStart() {
        $("app").innerHTML = '<div id="banner-box"></div><button type="button" class="x bnhide" title="Hide the banner" aria-label="Hide the banner">&times;</button>';
        document.querySelector(".bnhide").onclick = function () { TK.OBR.popover.close(CS.NS + "/banner"); };
        const O = TK.OBR; ingest(await O.scene.getMetadata()); O.scene.onMetadataChange(ingest);
    }
    return { initGm: initGm, initPlayer: initPlayer, boot: boot, bannerStart: bannerStart, _state: function () { return cur; } };
})();
