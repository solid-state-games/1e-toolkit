"use strict";
/* combat_ui.js - combat mode screens: the GM "Combat" card (set-up behind the cog, the round's steps, one button that does the current
   step and moves on, undo, log), the player's Combat tab, and the phase banner popover page (?view=banner).
   Rules and state are in js/combat_state.js (DOM-free). Only the GM writes scene metadata; players only read it.
   OBR calls used: scene.getMetadata/setMetadata/onMetadataChange, scene.items.getItems/onChange, party.getPlayers/onChange,
   player.getMetadata/onChange, popover.close (SDK 3.1.0). Dice tray: the Owlbear Dice extension writes rodeo.owlbear.dice/* to the roller's
   player metadata; a step that needs a d6 waits for the first new single d6 from whoever may roll it (CombatState.rollerFor). */
const CombatUI = (function () {
    const CS = CombatState, SETTLE = 1200;
    let cur = { c: null, logs: {}, sum: [], meta: {} }, items = [], players = [], gmRoot = null, playerRoot = null, msg = "", hist = [], wait = null, timer = null, removedExtra = [];
    let draft = { n: ["Party", "Foes"], r: [undefined, undefined], et: [0, 0], side: {}, op: 0, rs: 0 }, setupOpen = null, rOpen = false, lOpen = false, surMode = "roll";
    const own = function (i) { return (i.metadata || {})[SheetRules.OWNER_KEY]; };
    const byId = function (id) { return items.filter(function (x) { return x.id === id; })[0]; };
    const nameOf = function (id) { const it = byId(id); return it ? it.name || "Unnamed token" : "token (gone)"; };
    const sheetOf = function (it) { return it && (it.metadata || {})[SheetRules.KEY]; };
    const dexOf = function (id) { const sh = sheetOf(byId(id)); return sh && sh.sc && sh.sc[3] ? sh.sc[3] : null; };
    // owner = the player the GM assigned, else the player who placed it (as the sheet works it out); GM-placed tokens have none
    const ownerOf = function (it) { return own(it) || (players.some(function (p) { return p.id === it.createdUserId; }) ? it.createdUserId : ""); };
    const defSide = function (it) { return sheetOf(it) || ownerOf(it) ? 0 : 1; };
    const inf = function (t) { return t ? ' <span class="inf" title="' + esc(t) + '" aria-label="' + esc(t) + '">i</span>' : ""; };
    const S = function () { return cur.c || draft; };

    /* ----- who rolls, what the ranges are ----- */
    const owners = function (c) { return c.ro.map(function (id) { const it = byId(id); return it ? ownerOf(it) : ""; }); };
    const rollerFor = function (c, target) { return CS.rollerFor(c, owners(c), TK.me, target); };
    function memberOf(it) { const sh = sheetOf(it); return { name: it.name || "Unnamed token", cls: sh && sh.cl ? sh.cl : [], race: sh ? sh.race || "" : "", mon: sh ? null : CS.monsterOf(it.name) }; }
    function derived() {
        const c = cur.c, groups = [[], []];
        if (c) [0, 1].forEach(function (i) { c.sd[i].m.forEach(function (n) { const it = byId(c.ro[n]); if (it) groups[i].push(memberOf(it)); }); });
        else items.forEach(function (it) { const s = draft.side[it.id] !== undefined ? draft.side[it.id] : defSide(it); if (s < 2) groups[s].push(memberOf(it)); });
        return CS.deriveRanges(groups.map(function (g, i) { return { members: g, elfTick: !!(c ? c.sd[i].et : draft.et[i]) }; }));
    }

    /* ----- shared: data in, log out ----- */
    function ingest(meta) { cur = Object.assign({ meta: meta || {} }, CS.read(meta)); if (!cur.c) { hist = []; wait = null; } render(); }
    function rollWinHtml(c) {
        const list = CS.visible(cur.logs[c.rd] || []);
        return '<div class="rollwin"><h4>' + (c.rd === 0 ? "Surprise rolls" : "Round " + c.rd + " rolls") + "</h4>" + (list.length ? "<ol>" + list.map(function (e) { return "<li>" + (e[0] ? "<i>segment " + e[0] + "</i> " : "") + esc(CS.entryText(e, c)) + "</li>"; }).join("") + "</ol>" : '<p class="muted small">No rolls yet this round.</p>') + "</div>";
    }
    function bannerHtml() { const b = CS.banner(cur.c); return '<div class="cmban"><b>' + esc(b.a) + "</b><span>" + esc(b.b) + "</span></div>"; }
    function render() {
        const c = cur.c;
        if (playerRoot) {
            let h = "";
            if (c) {
                const mine = items.filter(function (it) { return own(it) ? own(it) === TK.me : it.createdUserId === TK.me; }).map(function (it) { return CS.sideOf(c, c.ro.indexOf(it.id)); });
                const acting = CS.actingSides(c);
                h = bannerHtml() + (mine.some(function (s) { return s < 2 && acting.indexOf(s) >= 0; }) ? '<p class="cmyou">Your side acts now</p>' : "") + rollWinHtml(c);
            } else h = '<p class="muted">No combat is running.</p>';
            playerRoot.innerHTML = h;
        }
        if (gmRoot) gmRender();
        const bn = document.getElementById("banner-box"); if (bn) bn.innerHTML = c ? bannerHtml() : '<div class="cmban"><b>Combat over</b></div>';
        ensureWait();
    }

    /* ----- writing (GM only) ----- */
    async function save(c, logs, sum) {
        if (TK.role !== "GM") return;
        const rm = CS.fold(c, logs, sum).concat(removedExtra); removedExtra = [];
        const p = CS.patch(c, logs, sum, rm), meta = Object.assign({}, cur.meta);
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
    const effSrc = function (c) { return CS.stepKind(c) === "sur" && c.rd === 0 && surMode === "earlier" ? 3 : c.rs; };
    function runStep(vals, src, who) {
        return mutate(function (c, logs) {
            const label = CS.primary(c), snap = CS.takeSnap(c, logs), r = CS.step(c, logs, vals, src, who);
            if (!r.ok) return "That step needs a roll first.";
            hist.push({ snap: snap, label: label }); if (hist.length > 30) hist.shift();
        });
    }

    /* ----- Dice tray: wait for the first new d6 from whoever may roll it ----- */
    async function everyone() {
        const O = TK.OBR, me = { id: TK.me, name: TK.name || "GM", metadata: await O.player.getMetadata() };
        return [me].concat(await O.party.getPlayers());
    }
    function ensureWait() {
        const c = cur.c, nd = c ? CS.needs(c) : [];
        if (!c || !nd.length || effSrc(c) !== 2 || TK.role !== "GM") { wait = null; return; }
        const key = [c.rd, c.ph, c.sg, c.rs, surMode].join(":");
        if (wait && wait.key === key) return;
        const w = wait = { key: key, nd: nd, vals: [], who: [], wants: nd.map(function (i) { return rollerFor(c, { side: i }); }), base: null };
        everyone().then(function (list) { if (wait === w) w.base = CS.traySnap(list); });   // what is there now is stale; only later rolls count
    }
    function trayEvent() { if (!wait || !wait.base) return; clearTimeout(timer); timer = setTimeout(trayCheck, SETTLE); }
    async function trayCheck() {
        const w = wait; if (!w || !w.base) return;
        const list = await everyone(); if (wait !== w) return;
        for (let p = CS.trayPick(w.base, list, w.wants.map(function (x, j) { return w.vals[j] === undefined ? x : null; })); p; p = CS.trayPick(w.base, list, w.wants.map(function (x, j) { return w.vals[j] === undefined ? x : null; }))) { w.vals[p.j] = p.value; w.who[p.j] = p.name; }
        if (w.nd.every(function (x, j) { return w.vals[j] !== undefined; })) { wait = null; runStep(w.vals, 2, w.who); } else render();
    }
    function waitHtml(c) {
        const w = wait; if (!w) return "";
        return w.nd.map(function (i, j) {
            if (w.vals[j] !== undefined) return '<p class="cmwait">' + esc(c.sd[i].n) + ": got " + w.vals[j] + " from " + esc(w.who[j]) + ".</p>";
            const ids = w.wants[j], names = ids.map(function (id) {
                if (id === TK.me) return null;
                const n = c.sd[i].m.filter(function (k) { const it = byId(c.ro[k]); return it && ownerOf(it) === id; })[0], p = players.filter(function (x) { return x.id === id; })[0];
                return n !== undefined ? nameOf(c.ro[n]) : p ? p.name : "a player";
            });
            const who = names[0] === null ? "the GM's d6" : names.join(" or ") + " to roll a d6 in the Dice tray";
            return '<p class="cmwait">' + (w.nd.length > 1 ? esc(c.sd[i].n) + ": " : "") + "Waiting for " + esc(who) + "</p>";
        }).join("");
    }

    /* ----- GM screen ----- */
    const opt = function (v, t, sel) { return '<option value="' + v + '"' + (String(v) === String(sel) ? " selected" : "") + ">" + esc(t) + "</option>"; };
    function setupHtml() {
        const c = cur.c, st = S(), dv = derived();
        const rows = c ? c.ro.map(function (id, n) { return [id, CS.sideOf(c, n), 'data-mv="' + n + '"']; }) : items.map(function (it) { return [it.id, draft.side[it.id] !== undefined ? draft.side[it.id] : defSide(it), 'data-tok="' + esc(it.id) + '"']; });
        const sdName = function (i) { return c ? c.sd[i].n : draft.n[i]; };
        let h = '<div class="cmsetup"><h4>Sides</h4><div class="cmsides">' + [0, 1].map(function (i) {
            const ra = c ? c.sd[i].ra : draft.r[i] !== undefined ? draft.r[i] : dv[i].ra, ov = c ? c.sd[i].ov : draft.r[i] !== undefined, et = c ? c.sd[i].et : draft.et[i];
            return '<div class="cmside2"><input id="cm-n' + i + '" value="' + esc(sdName(i)) + '" maxlength="24" aria-label="Side name"><label>Surprised on 1 to <input type="number" id="cm-r' + i + '" min="0" max="6" value="' + ra + '" class="cmnum"></label>' +
                (ov ? ' <button type="button" class="btn ghost small" data-act="rangeauto" data-i="' + i + '">Auto</button>' : "") +
                '<p class="hint">' + (ov ? "Set by the GM." : esc(dv[i].txt) + inf(dv[i].pg)) + '</p><label class="chk"><input type="checkbox" data-et="' + i + '"' + (et ? " checked" : "") + "> Elves/halflings alone or ahead, no metal armour" + inf("PHB p.16, p.17: surprise on 1-4 only then; otherwise 1-2") + "</label></div>";
        }).join("") + "</div>";
        h += '<table class="grid cmtok"><tr><th>Token</th><th>Group</th></tr>' + (rows.length ? rows.map(function (r) { return "<tr><td>" + esc(nameOf(r[0])) + '</td><td><select ' + r[2] + ">" + opt(0, sdName(0), r[1]) + opt(1, sdName(1), r[1]) + opt(2, "Not fighting", r[1]) + "</select></td></tr>"; }).join("") : '<tr><td colspan="2" class="muted">No character tokens on this scene yet.</td></tr>') + "</table>";
        h += '<p class="hint">Not fighting: bystanders, captives, mounts left behind, hirelings out of it. They are left out of every roll and count.</p>';
        h += '<div class="ctl"><label>Dice <select id="cm-rs">' + opt(0, "Roll in the sheet", st.rs) + opt(1, "Type a physical die result", st.rs) + opt(2, "Owlbear Dice tray", st.rs) + '</select></label><label>Surprise <select id="cm-sm">' + opt("roll", "Roll it now", surMode) + opt("earlier", "Already rolled", surMode) + opt("none", "No surprise", surMode) + "</select></label></div>";
        const nch = CS.changed(st);
        h += '<details class="cmrest" id="cm-rest"' + (rOpen ? " open" : "") + "><summary>Restrictions: " + (nch ? nch + " changed from RAW" : "all RAW") + '</summary><ul class="cmtog">' + CS.TOGGLES.map(function (t) {
            return '<li><label><input type="checkbox" data-tog="' + t.k + '"' + (CS.isOn(st, t.k) ? " checked" : "") + "> <b>" + esc(t.t) + "</b>" + inf(t.pg) + ' <span class="muted">' + esc(t.d) + "</span></label></li>"; }).join("") + "</ul></details>";
        if (!c) h += '<div class="row"><button type="button" class="btn" data-act="start"' + (items.length ? "" : " disabled") + ">Start combat</button></div>";
        return h + "</div>";
    }
    function actionHtml(c) {
        const k = CS.stepKind(c), nd = CS.needs(c), src = effSrc(c);
        let h = "";
        if (k === "sur" && c.rd === 0 && surMode === "none") return '<div class="cmact"><button type="button" class="btn" data-act="nosur">No surprise: go to round 1</button></div>';
        if (k === "init" && !CS.isOn(c, "cm.initiative")) return '<div class="cmact">First: <button type="button" class="btn small" data-act="first" data-w="0">' + esc(c.sd[0].n) + '</button> <button type="button" class="btn small" data-act="first" data-w="1">' + esc(c.sd[1].n) + '</button> <button type="button" class="btn small ghost" data-act="first" data-w="2">Together</button></div>';
        if (nd.length && src === 2) return '<div class="cmact">' + waitHtml(c) + '<button type="button" class="btn ghost small" data-act="sheetinstead">Roll in the sheet instead</button></div>';
        if (nd.length && (src === 1 || src === 3)) h += '<div class="cmtyped">' + nd.map(function (i) { return "<label>" + esc(c.sd[i].n) + ' d6 <input type="number" min="1" max="6" id="cm-in-' + i + '" class="cmnum"></label>'; }).join(" ") + "</div>";
        const label = src === 3 && k === "sur" ? "Apply the surprise dice" : CS.primary(c);
        return '<div class="cmact"><button type="button" class="btn" data-act="primary">' + esc(label) + "</button>" + h + "</div>";
    }
    function runHtml() {
        const c = cur.c, L = CS.stepList(c);
        let h = '<div class="cmhead"><h3>Combat</h3><b class="cmrd">' + (c.rd === 0 ? "Surprise" : CS.isOn(c, "cm.rounds") ? "Round " + c.rd : "In progress") + '</b><span class="sp"></span>' +
            '<button type="button" class="x" data-act="cog" title="Set-up: sides, dice, restrictions" aria-label="Set-up">&#9881;</button><button type="button" class="btn ghost small" data-act="end">End combat</button></div>';
        if (showSetup()) h += setupHtml();
        h += '<ol class="steps">' + L.map(function (x) { return '<li class="' + x.st + '">' + (x.st === "done" ? "<s>" + esc(x.label) + "</s>" : esc(x.label)) + (x.res ? ' <span class="res">' + esc(x.res) + "</span>" : "") + "</li>"; }).join("") + "</ol>";
        h += actionHtml(c);
        h += '<div class="cmfoot"><button type="button" class="btn ghost small" data-act="undo"' + (hist.length ? "" : " disabled") + ">Undo last step</button><span class=\"hint\" id=\"cm-msg\">" + esc(msg) + "</span></div>";
        if (c.w === 2 && c.rd > 0) h += '<p class="hint">' + esc(CS.TIE_NOTE) + inf(CS.TIE_PG) + "</p>";
        return h + '<details class="cmlog" id="cm-log"' + (lOpen ? " open" : "") + "><summary>Log</summary>" + rollWinHtml(c) + "</details>";
    }
    const showSetup = function () { return setupOpen === null ? !cur.c : setupOpen; };
    function gmRender() {
        const keep = document.activeElement && gmRoot.contains(document.activeElement) && document.activeElement.id;
        gmRoot.innerHTML = '<div class="cmcard">' + (cur.c ? runHtml() : '<div class="cmhead"><h3>Combat</h3><span class="sp"></span><button type="button" class="x" data-act="cog" title="Set-up" aria-label="Set-up">&#9881;</button></div>' + (showSetup() ? setupHtml() : '<p class="muted">No combat running. Open set-up (the cog) to start one.</p>')) + "</div>";
        if (keep) { const e = gmRoot.querySelector("#" + keep); if (e) e.focus(); }
    }
    function typedVals(c) {
        const nd = CS.needs(c), v = nd.map(function (i) { return parseInt((gmRoot.querySelector("#cm-in-" + i) || {}).value, 10); });
        return v.every(function (x) { return x >= 1 && x <= 6; }) ? v : null;
    }
    async function onClick(e) {
        const b = e.target.closest("[data-act]"); if (!b) return;
        const a = b.dataset.act, c = cur.c;
        if (a === "cog") { setupOpen = !showSetup(); render(); }
        else if (a === "start") {
            const ids = items.map(function (i) { return i.id; }), side = items.map(function (i) { return draft.side[i.id] !== undefined ? draft.side[i.id] : defSide(i); }), dv = derived();
            if (side.every(function (s) { return s === 2; })) { msg = "Put at least one token in a side."; render(); return; }
            const nc = CS.create(ids, side, draft.n.map(function (n) { return n.trim() || "Side"; }), [0, 1].map(function (i) { return draft.r[i] !== undefined ? draft.r[i] : dv[i].ra; }));
            nc.op = draft.op; nc.rs = draft.rs; [0, 1].forEach(function (i) { nc.sd[i].et = draft.et[i]; if (draft.r[i] !== undefined) nc.sd[i].ov = 1; });
            const logs = {};
            if (!CS.isOn(nc, "cm.surprise") || surMode === "none") CS.noSurprise(nc, logs);
            msg = ""; hist = []; setupOpen = false;
            await save(nc, logs, []).catch(function (er) { say(er.message, "ERROR"); }); render();
        } else if (a === "primary") {
            if (!c) return;
            const nd = CS.needs(c), src = effSrc(c);
            let vals = [];
            if (nd.length) { if (src === 0) vals = nd.map(function () { return GMCombat.rnd(6); }); else { vals = typedVals(c); if (!vals) { msg = "Type the die result, 1 to 6, for each side."; render(); return; } } }
            runStep(vals, src, []);
        } else if (a === "sheetinstead") { const nd = CS.needs(c); wait = null; runStep(nd.map(function () { return GMCombat.rnd(6); }), 0, []); }
        else if (a === "nosur") mutate(function (c, logs) { CS.noSurprise(c, logs); });
        else if (a === "first") mutate(function (c, logs) { const snap = CS.takeSnap(c, logs), lb = "Who goes first"; CS.stepFirst(c, logs, Number(b.dataset.w)); hist.push({ snap: snap, label: lb }); });
        else if (a === "undo") { if (hist.length) mutate(function (c, logs) { const h = hist.pop(); removedExtra = CS.undo(c, logs, h.snap, h.label); }); }
        else if (a === "rangeauto") mutate(function (c) { const i = Number(b.dataset.i); delete c.sd[i].ov; CS.applyRanges(c, derived()); });
        else if (a === "end") endCombat();
    }
    async function endCombat() {
        const c = cur.c; if (!c || !window.confirm("End combat? The log is saved to a text file and cleared from the scene.")) return;
        const text = CS.exportText(c, cur.logs, cur.sum, function (n) { return nameOf(c.ro[n]); });
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = "combat-log-round-" + c.rd + ".txt"; document.body.appendChild(a); a.click(); a.remove();
        try { await TK.OBR.scene.setMetadata(CS.clearPatch(cur.meta)); } catch (er) { say(er.message, "ERROR"); return; }
        msg = ""; setupOpen = null; surMode = "roll"; ingest(Object.keys(cur.meta).reduce(function (o, k) { if (k !== CS.KEY && k.indexOf(CS.LOGP) !== 0) o[k] = cur.meta[k]; return o; }, {}));
    }
    // after a change to who is in a side or the elf/halfling tick: refresh the derived ranges while surprise is still to be rolled
    const refreshRanges = function (c) { if (c.rd === 0 && !CS.surpriseReady(c)) CS.applyRanges(c, derived()); };
    function onChange(e) {
        const t = e.target, c = cur.c, i = Number(String(t.id).slice(-1));
        if (t.id === "cm-sm") { surMode = t.value; render(); return; }
        if (t.dataset.tok) { draft.side[t.dataset.tok] = Number(t.value); render(); return; }
        if (!c) {
            if (t.id === "cm-n0" || t.id === "cm-n1") { draft.n[i] = t.value.slice(0, 24); render(); }
            else if (t.id === "cm-r0" || t.id === "cm-r1") { draft.r[i] = CS.clampRange(t.value); render(); }
            else if (t.dataset.et !== undefined) { draft.et[Number(t.dataset.et)] = t.checked ? 1 : 0; render(); }
            else if (t.id === "cm-rs") { draft.rs = Number(t.value); render(); }
            else if (t.dataset.tog) { CS.setToggle(draft, t.dataset.tog, t.checked); render(); }
            return;
        }
        if (t.dataset.mv !== undefined) mutate(function (c) { CS.moveToken(c, Number(t.dataset.mv), Number(t.value)); refreshRanges(c); });
        else if (t.id === "cm-r0" || t.id === "cm-r1") mutate(function (c) { CS.setRange(c, i, t.value); });
        else if (t.id === "cm-n0" || t.id === "cm-n1") mutate(function (c) { if (t.value.trim()) c.sd[i].n = t.value.trim().slice(0, 24); });
        else if (t.dataset.et !== undefined) mutate(function (c) { c.sd[Number(t.dataset.et)].et = t.checked ? 1 : 0; refreshRanges(c); });
        else if (t.id === "cm-rs") mutate(function (c) { c.rs = Number(t.value); });
        else if (t.dataset.tog) mutate(function (c, logs) { const tg = CS.TOGGLES.filter(function (x) { return x.k === t.dataset.tog; })[0]; CS.setToggle(c, tg.k, t.checked); CS.logAdd(logs, c.rd, CS.entry(0, 10, tg.b, t.checked ? 1 : 0, 0, 0)); if (tg.k === "cm.surprise" && !t.checked && c.rd === 0) CS.skipSurprise(c); });
    }
    async function loadItems() {
        if (TK.role === "GM") { try { players = (await TK.OBR.party.getPlayers()).filter(function (p) { return p.role === "PLAYER"; }); } catch (e) { players = []; } }
        items = (await TK.OBR.scene.items.getItems(function (i) { return i.layer === "CHARACTER"; })).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
        render();
    }

    /* ----- entry points ----- */
    function initGm(el) {
        gmRoot = el; el.addEventListener("click", onClick); el.addEventListener("change", onChange);
        el.addEventListener("toggle", function (e) { if (e.target.id === "cm-rest") rOpen = e.target.open; if (e.target.id === "cm-log") lOpen = e.target.open; }, true);
    }
    function initPlayer(el) { playerRoot = el; }
    // called by the hub once the scene is ready: read, then follow changes
    async function boot() {
        const O = TK.OBR;
        try { if (await O.scene.isReady()) { await loadItems(); ingest(await O.scene.getMetadata()); } } catch (e) { console.warn(e); }
        O.scene.onMetadataChange(ingest); O.scene.items.onChange(loadItems);
        O.scene.onReadyChange(async function (r) { if (r) { await loadItems(); ingest(await O.scene.getMetadata()); } });
        if (TK.role === "GM") { O.party.onChange(function (ps) { players = ps.filter(function (p) { return p.role === "PLAYER"; }); trayEvent(); }); O.player.onChange(trayEvent); }
    }
    // the popover page (?view=banner): phase banner only, plus Hide
    async function bannerStart() {
        $("app").innerHTML = '<div id="banner-box"></div><button type="button" class="x bnhide" title="Hide the banner" aria-label="Hide the banner">&times;</button>';
        document.querySelector(".bnhide").onclick = function () { TK.OBR.popover.close(CS.NS + "/banner"); };
        const O = TK.OBR; ingest(await O.scene.getMetadata()); O.scene.onMetadataChange(ingest);
    }
    return { initGm: initGm, initPlayer: initPlayer, boot: boot, bannerStart: bannerStart, _state: function () { return cur; }, _wait: function () { return wait; } };
})();
