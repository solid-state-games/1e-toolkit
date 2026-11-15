"use strict";
/* combat_ui.js - the GM "Combat" card (simple combat, TB 2026-11-16: nothing is automated). Set-up behind the gear (sides, surprise ranges), Start and End combat,
   a round bar (Round, Turn, Roll initiative, Next round), an optional Surprise box (report only), who is fighting whom (pairs, to-hit both ways), hits this round,
   GM-only hit points for NPCs and monsters, casualties, and optional spell rounds on PCs. Players see nothing of combat.
   Rules and state are in js/combat_state.js and js/combat_attack.js (DOM-free). Only the GM writes scene metadata.
   OBR calls used: scene.getMetadata/setMetadata/onMetadataChange/onReadyChange/isReady, scene.items.getItems/updateItems/onChange, party.getPlayers/onChange (SDK 3.1.0). */
const CombatUI = (function () {
    const CS = CombatState, CA = CombatAttack;
    let cur = { c: null, meta: {} }, items = [], players = [], gmRoot = null, setupOpen = null, notice = [];
    let draft = { n: ["Party", "Foes"], r: [undefined, undefined], et: [0, 0] };
    const own = function (i) { return (i.metadata || {})[SheetRules.OWNER_KEY]; };
    const byId = function (id) { return items.filter(function (x) { return x.id === id; })[0]; };
    const nameOf = function (id) { const it = byId(id); return it ? it.name || "Unnamed token" : "token (gone)"; };
    const sheetOf = function (it) { return it && (it.metadata || {})[SheetRules.KEY]; };
    const hpOf = function (it) { const k = it && (it.metadata || {})[CS.CS]; return k && k.h ? k.h : null; };
    const isPc = function (it) { return !!sheetOf(it); };
    const dexOf = function (k) { const sh = sheetOf(byId(cur.c.ro[k])); return sh && sh.sc && sh.sc[3] ? sh.sc[3] : null; };
    const defSide = function (it) { return sheetOf(it) || own(it) || players.some(function (p) { return p.id === it.createdUserId; }) ? 0 : 1; };
    const pre = function () { return (cur.meta || {})[CS.PRE] || {}; };
    const sideFor = function (it) { return pre()[it.id] !== undefined ? pre()[it.id] : defSide(it); };
    const inf = function (t) { return t ? ' <span class="inf" title="' + esc(t) + '" aria-label="' + esc(t) + '">i</span>' : ""; };
    const ic = function (n) { return '<i class="ic ic-' + n + '" aria-hidden="true"></i>'; };
    const opt = function (v, t, sel) { return '<option value="' + v + '"' + (String(v) === String(sel) ? " selected" : "") + ">" + esc(t) + "</option>"; };
    const downIdx = function (k) { const it = byId(cur.c.ro[k]); return !isPc(it || {}) && CS.isDead(hpOf(it)); };

    function memberOf(it) { const sh = sheetOf(it); return { name: it.name || "Unnamed token", cls: sh && sh.cl ? sh.cl : [], race: sh ? sh.race || "" : "", mon: sh ? null : CS.monsterOf(it.name) }; }
    function derived() {
        const c = cur.c, groups = [[], []];
        if (c) [0, 1].forEach(function (i) { c.sd[i].m.forEach(function (k) { const it = byId(c.ro[k]); if (it) groups[i].push(memberOf(it)); }); });
        else items.forEach(function (it) { const s = sideFor(it); if (s < 2) groups[s].push(memberOf(it)); });
        return CS.deriveRanges(groups.map(function (g, i) { return { members: g, elfTick: !!(c ? c.sd[i].et : draft.et[i]) }; }));
    }

    /* ----- data in, state out ----- */
    function ingest(meta) { cur = { meta: meta || {}, c: CS.read(meta).c }; render(); }
    async function save(c) { const o = {}; o[CS.KEY] = c; await TK.OBR.scene.setMetadata(o); const meta = Object.assign({}, cur.meta); meta[CS.KEY] = c; ingest(meta); }
    async function mutate(fn) { const c = JSON.parse(JSON.stringify(cur.c)); fn(c); try { await save(c); } catch (e) { say(e.message, "ERROR"); } }
    // a monster's hit points live on its token (`cs` = {h:[hp,max]}, GM only); setting them also drops pairs that include a token that is down
    async function setHp(id, h) {
        await TK.OBR.scene.items.updateItems([id], function (d) { d[0].metadata[CS.CS] = { h: h }; }).catch(function (e) { say(e.message, "ERROR"); });
        await loadItems();
        const down = cur.c ? cur.c.ro.map(function (x, k) { return k; }).filter(downIdx) : [];
        if (down.length && cur.c.pr.some(function (p) { return down.indexOf(p[0]) >= 0 || down.indexOf(p[1]) >= 0; })) await mutate(function (c) { CS.dropDown(c, down); });
    }

    /* ----- screens ----- */
    function setupHtml() {
        const c = cur.c, dv = derived();
        const rows = c ? c.ro.map(function (id, k) { return [id, CS.sideOf(c, k), 'data-mv="' + k + '"']; }) : items.map(function (it) { return [it.id, sideFor(it), 'data-tok="' + esc(it.id) + '"']; });
        const sdName = function (i) { return c ? c.sd[i].n : draft.n[i]; };
        let h = '<div class="cmsetup"><h4>Sides</h4><div class="cmsides">' + [0, 1].map(function (i) {
            const ra = c ? c.sd[i].ra : draft.r[i] !== undefined ? draft.r[i] : dv[i].ra, ov = c ? c.sd[i].ov : draft.r[i] !== undefined, et = c ? c.sd[i].et : draft.et[i];
            return '<div class="cmside2"><input id="cm-n' + i + '" value="' + esc(sdName(i)) + '" maxlength="24" aria-label="Side name"><label>Surprised on 1 to <input type="number" id="cm-r' + i + '" min="0" max="6" value="' + ra + '" class="cmnum"></label>' +
                (ov ? ' <button type="button" class="btn ghost small" data-act="rangeauto" data-i="' + i + '">Auto</button>' : "") +
                '<p class="hint">' + (ov ? "Set by the GM." : esc(dv[i].txt) + inf(dv[i].pg)) + '</p><label class="chk"><input type="checkbox" data-et="' + i + '"' + (et ? " checked" : "") + "> <span>Elves/halflings alone or ahead, no metal armour" + inf("PHB p.16, p.17: surprise on 1-4 only then; otherwise 1-2") + "</span></label></div>";
        }).join("") + "</div>";
        h += '<table class="grid cmtok"><tr><th>Token</th><th>Group</th></tr>' + (rows.length ? rows.map(function (r) { return "<tr><td>" + esc(nameOf(r[0])) + '</td><td><select ' + r[2] + ">" + opt(0, sdName(0), r[1]) + opt(1, sdName(1), r[1]) + opt(2, "Not fighting", r[1]) + "</select></td></tr>"; }).join("") : '<tr><td colspan="2" class="muted">No character tokens on this scene yet.</td></tr>') + "</table>";
        h += '<p class="hint">Not fighting: bystanders, captives, mounts left behind, hirelings out of it. They are left out of every count. You can also right-click tokens: Combat: ' + esc(sdName(0)) + " / " + esc(sdName(1)) + " / Not fighting.</p>";
        if (!c) h += '<div class="row"><button type="button" class="btn" data-act="start"' + (items.length ? "" : " disabled") + ">Start combat</button></div>";
        return h + "</div>";
    }
    function roundHtml(c) {
        let h = '<div class="cmround"><button type="button" class="btn prim" data-act="init">' + ic("dice") + "Roll initiative</button> <span class=\"cminit\">" + esc(CS.initText(c)) + '</span><button type="button" class="btn" data-act="next">Next round</button></div>';
        if (c.w === 2) h += '<p class="hint">' + esc(CS.TIE_NOTE) + "</p>";
        if (notice.length) h += '<p class="cmnote">' + notice.map(function (s) { return esc(s[1] + " (" + nameOf(cur.c.ro[s[0]]) + ") has run out."); }).join(" ") + "</p>";
        return h;
    }
    function surpriseHtml(c) {
        const w = CS.surpriseWords(c, dexOf, function (k) { return nameOf(c.ro[k]); });
        let h = '<details class="cmbox" id="cm-sur"' + (surOpen ? " open" : "") + "><summary>Surprise</summary><table class=\"grid\"><tr><th>Side</th><th>Surprised on 1 to</th><th>d6</th></tr>" + [0, 1].map(function (i) {
            const s = c.sd[i]; return "<tr><td>" + esc(s.n) + '</td><td><input type="number" min="0" max="6" class="cmnum" data-range="' + i + '" value="' + s.ra + '"></td><td>' + (s.ra === 0 ? "--" : '<input type="number" min="1" max="6" class="cmnum" data-sd="' + i + '" value="' + (s.sr || "") + '">') + "</td></tr>"; }).join("") + "</table>" +
            '<div class="cmrow"><button type="button" class="btn small" data-act="sur-roll">' + ic("dice") + 'Roll both</button><button type="button" class="btn ghost small" data-act="sur-clear">Clear</button></div>' +
            '<p class="cmwords"><b>' + esc(w.text) + "</b></p>" + (w.dex.length ? '<ul class="chips">' + w.dex.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
            '<p class="hint">Report only: nothing is blocked. DEX reaction takes segments off one PC only (PHB p.11).' + inf("DMG p.61-62, p.71") + "</p></details>";
        return h;
    }
    function dirHtml(k, dir, A, T, af, tf, wi, acOv) {
        const ac = acOv !== null && acOv !== undefined ? acOv : tf.ac, nd = CA.need(af, wi, ac, tf.type, 0);
        let h = '<div class="cmdir"><div class="cmdh">' + esc(A.name || "?") + " hits " + esc(T.name || "?") + "</div>";
        if (af.kind === "pc") h += '<label>Weapon <select data-pw="' + k + ":" + dir + '">' + (af.weapons.length ? af.weapons.map(function (w, i) { return opt(i, w.name, wi); }).join("") : opt(0, "none on the sheet", 0)) + "</select></label>";
        else if (af.kind === "mon") h += '<div class="muted">' + esc(af.mm) + ", " + esc(af.page) + "</div>";
        else h += '<div class="muted">no sheet or MM entry</div>';
        h += '<label>Target AC <input type="number" class="cmnum" data-pac="' + k + ":" + dir + '" value="' + (ac === null || ac === undefined || isNaN(ac) ? "" : ac) + '"></label>';
        h += '<div class="cmneed">' + (nd === null ? "needs: type the AC" : "needs <b>" + nd + "</b> or more on d20") + "</div>";
        h += "<div>" + esc(CA.attacksText(af, wi)) + (CA.isMissile(af, wi) ? inf(CA.MISSILE_NOTE) : "") + "</div>";
        const dm = CA.damageText(af, wi), sp = CA.speedText(af, wi); if (dm) h += "<div>" + esc(dm) + "</div>"; if (sp) h += "<div>" + esc(sp) + "</div>";
        return h + "</div>";
    }
    function pairsHtml(c) {
        let h = "<h4>Who is fighting whom" + inf("Drag with the Fight tool, or right-click a token: Fight...") + "</h4>";
        if (!c.pr.length) return h + '<p class="muted">No pairs yet. Use the Fight tool (drag from one token to the other) or right-click a token and choose Fight...</p>';
        return h + c.pr.map(function (p, k) {
            const A = byId(c.ro[p[0]]), T = byId(c.ro[p[1]]);
            if (!A || !T) return '<div class="cmpair"><div class="cmph">A token is no longer on the scene <button type="button" class="x" data-act="pairdel" data-k="' + k + '" aria-label="Remove pair">&times;</button></div></div>';
            const af = CA.facts(A), tf = CA.facts(T);
            return '<div class="cmpair"><div class="cmph"><span><b>' + esc(A.name) + "</b> versus <b>" + esc(T.name) + '</b></span><button type="button" class="x" data-act="pairdel" data-k="' + k + '" title="Remove pair" aria-label="Remove pair">&times;</button></div><div class="cmdirs">' +
                dirHtml(k, 0, A, T, af, tf, p[2], p[4]) + dirHtml(k, 1, T, A, tf, af, p[3], p[5]) + "</div></div>";
        }).join("");
    }
    function hitsHtml(c) {
        let h = "<h4>Hits this round" + inf("Twice as often as the other side means a morale check, DMG p.67 footnote") + '</h4><div class="cmhits">' + c.sd.map(function (s, i) {
            return '<div class="cmhit"><b>' + esc(s.n) + '</b><button type="button" class="btn ghost small" data-act="hit" data-i="' + i + '" data-d="-1" aria-label="One fewer hit for ' + esc(s.n) + '">-</button><span class="cmcount">' + (c.ht[i] || 0) + '</span><button type="button" class="btn small" data-act="hit" data-i="' + i + '" data-d="1" aria-label="One more hit for ' + esc(s.n) + '">+</button>' +
                '<span class="muted small">' + (c.lh ? "last round " + (c.lh[i] || 0) : "") + "</span></div>"; }).join("") + "</div>";
        CS.moraleFlags(c).forEach(function (m) { h += '<p class="cmnote">' + esc(m) + "</p>"; });
        return h;
    }
    function hpHtml(c) {
        const rows = [];
        c.sd.forEach(function (s, i) { s.m.forEach(function (k) { const it = byId(c.ro[k]); if (it && !isPc(it)) rows.push([k, it, i]); }); });
        let h = "<h4>Hit points (GM only)" + inf("Type -6 or +3 to change, or a number to set. 0 or less is dead (PHB p.105).") + "</h4>";
        if (!rows.length) h += '<p class="muted">No NPC or monster tokens in the fight. PCs keep their sheet hit points.</p>';
        else h += '<table class="grid cmhp">' + rows.map(function (r) {
            const hp = hpOf(r[1]), dead = CS.isDead(hp);
            return '<tr class="' + (dead ? "dead" : "") + '"><td>' + esc(r[1].name) + '</td><td class="muted">' + esc(c.sd[r[2]].n) + "</td><td>" + (hp ? (dead ? "dead" : "<b>" + hp[0] + "</b> / " + hp[1]) : "no hit points yet") + '</td><td><input class="cmhpin" data-hp="' + esc(r[1].id) + '" placeholder="' + (hp ? "-6, +3 or a number" : "maximum") + '" aria-label="Change hit points of ' + esc(r[1].name) + '"></td></tr>'; }).join("") + "</table>";
        CS.casualties(c, downIdx).forEach(function (x) { if (x.down) h += '<p class="cmnote">' + esc(x.text) + (x.morale ? ". " + esc(x.morale) : "") + "</p>"; });
        return h;
    }
    function spellsHtml(c) {
        const pcs = []; c.sd.forEach(function (s) { s.m.forEach(function (k) { const it = byId(c.ro[k]); if (it && isPc(it)) pcs.push([k, it]); }); });
        if (!pcs.length) return "";
        let h = '<details class="cmbox" id="cm-spl"' + (splOpen ? " open" : "") + "><summary>Spell rounds</summary>";
        h += pcs.map(function (r) {
            const mine = c.sp.filter(function (s) { return s[0] === r[0]; });
            return '<div class="cmspell"><b>' + esc(r[1].name) + "</b> " + (mine.length ? mine.map(function (s) { return '<span class="chip">' + esc(s[1]) + ": " + s[2] + ' left <button type="button" class="x" data-act="spdel" data-k="' + c.sp.indexOf(s) + '" aria-label="Remove ' + esc(s[1]) + '">&times;</button></span>'; }).join(" ") : "") +
                ' <input class="cmspn" data-spn="' + r[0] + '" placeholder="spell"> <input type="number" min="1" class="cmnum" data-spr="' + r[0] + '" placeholder="rounds"> <button type="button" class="btn small" data-act="spadd" data-k="' + r[0] + '">+ spell</button></div>'; }).join("");
        return h + '<p class="hint">Next round counts them down and tells you when one runs out.</p></details>';
    }
    let surOpen = false, splOpen = false;
    function runHtml() {
        const c = cur.c;
        let h = '<div class="cmhead"><h3>Combat</h3><b class="cmrd">Round ' + c.rd + ' &middot; Turn ' + c.tn + ' <span class="muted">(round ' + CS.roundInTurn(c) + ' of 10)</span></b><span class="sp"></span>' +
            '<button type="button" class="x ibtn" data-act="cog" title="Set-up: sides and surprise ranges" aria-label="Set-up">' + ic("gear") + '</button><button type="button" class="btn ghost small" data-act="end">' + ic("flag") + "End combat</button></div>";
        if (showSetup()) h += setupHtml();
        return h + roundHtml(c) + surpriseHtml(c) + pairsHtml(c) + hitsHtml(c) + hpHtml(c) + spellsHtml(c);
    }
    const showSetup = function () { return setupOpen === null ? !cur.c : setupOpen; };
    function render() {
        if (!gmRoot) return;
        const keep = document.activeElement && gmRoot.contains(document.activeElement) && document.activeElement.id;
        gmRoot.innerHTML = '<div class="cmcard">' + (cur.c ? runHtml() : '<div class="cmhead"><h3>Combat</h3><span class="sp"></span><button type="button" class="x ibtn" data-act="cog" title="Set-up" aria-label="Set-up">' + ic("gear") + "</button></div>" + (showSetup() ? setupHtml() : '<p class="muted">No combat running. Open set-up (the gear) to start one.</p>')) + "</div>";
        if (keep) { const e = gmRoot.querySelector("#" + keep); if (e) e.focus(); }
    }
    async function onClick(e) {
        const b = e.target.closest("[data-act]"); if (!b) return;
        const a = b.dataset.act, c = cur.c, k = Number(b.dataset.k), i = Number(b.dataset.i);
        if (a === "cog") { setupOpen = !showSetup(); render(); }
        else if (a === "start") {
            const ids = items.map(function (it) { return it.id; }), side = items.map(sideFor), dv = derived();
            if (side.every(function (s) { return s === 2; })) { say("Put at least one token in a side.", "WARNING"); return; }
            const nc = CS.create(ids, side, draft.n.map(function (n) { return n.trim() || "Side"; }), [0, 1].map(function (j) { return draft.r[j] !== undefined ? draft.r[j] : dv[j].ra; }));
            [0, 1].forEach(function (j) { nc.sd[j].et = draft.et[j]; if (draft.r[j] !== undefined) nc.sd[j].ov = 1; });
            setupOpen = false; notice = [];
            const o = {}; o[CS.KEY] = nc; o[CS.PRE] = undefined; await TK.OBR.scene.setMetadata(o).catch(function (er) { say(er.message, "ERROR"); });
        }
        else if (a === "init") mutate(function (c) { CS.rollInit(c, 0, GMCombat.rnd(6)); CS.rollInit(c, 1, GMCombat.rnd(6)); });
        else if (a === "next") mutate(function (c) { notice = CS.nextRound(c); });
        else if (a === "sur-roll") mutate(function (c) { [0, 1].forEach(function (j) { if (c.sd[j].ra) CS.setSurprise(c, j, GMCombat.rnd(6)); }); });
        else if (a === "sur-clear") mutate(function (c) { [0, 1].forEach(function (j) { CS.setSurprise(c, j, 0); }); });
        else if (a === "pairdel") mutate(function (c) { CS.removePair(c, k); });
        else if (a === "hit") mutate(function (c) { CS.hit(c, i, Number(b.dataset.d)); });
        else if (a === "spadd") { const n = gmRoot.querySelector('[data-spn="' + k + '"]'), r = gmRoot.querySelector('[data-spr="' + k + '"]'); if (n && r) mutate(function (c) { if (!CS.addSpell(c, k, n.value, r.value)) say("Give the spell a name and a number of rounds.", "WARNING"); }); }
        else if (a === "spdel") mutate(function (c) { c.sp.splice(k, 1); });
        else if (a === "rangeauto") mutate(function (c) { delete c.sd[i].ov; CS.applyRanges(c, derived()); });
        else if (a === "end") endCombat();
    }
    async function endCombat() {
        const c = cur.c; if (!c || !window.confirm("End combat? The pairs, hits and spell rounds are cleared. Monster hit points stay on their tokens.")) return;
        try { await TK.OBR.scene.setMetadata(CS.clearPatch(cur.meta)); } catch (er) { say(er.message, "ERROR"); return; }
        setupOpen = null; notice = []; ingest(Object.keys(cur.meta).reduce(function (o, key) { if (key !== CS.KEY && key !== CS.PRE) o[key] = cur.meta[key]; return o; }, {}));
    }
    // after a token moves between sides while no surprise die is rolled: refresh the derived ranges (not the GM's overrides)
    const refreshRanges = function (c) { if (!c.sd[0].sr && !c.sd[1].sr) CS.applyRanges(c, derived()); };
    function onChange(e) {
        const t = e.target, c = cur.c, i = Number(String(t.id).slice(-1));
        if (t.dataset.tok) { const o = {}; o[CS.PRE] = Object.assign({}, pre()); o[CS.PRE][t.dataset.tok] = Number(t.value); TK.OBR.scene.setMetadata(o).catch(function (er) { say(er.message, "ERROR"); }); return; }
        if (!c) {
            if (t.id === "cm-n0" || t.id === "cm-n1") { draft.n[i] = t.value.slice(0, 24); render(); }
            else if (t.id === "cm-r0" || t.id === "cm-r1") { draft.r[i] = CS.clampRange(t.value); render(); }
            else if (t.dataset.et !== undefined) { draft.et[Number(t.dataset.et)] = t.checked ? 1 : 0; render(); }
            return;
        }
        if (t.dataset.mv !== undefined) mutate(function (c) { CS.moveToken(c, Number(t.dataset.mv), Number(t.value)); refreshRanges(c); });
        else if (t.id === "cm-r0" || t.id === "cm-r1") mutate(function (c) { CS.setRange(c, i, t.value); });
        else if (t.dataset.range !== undefined) mutate(function (c) { CS.setRange(c, Number(t.dataset.range), t.value); });
        else if (t.dataset.sd !== undefined) mutate(function (c) { CS.setSurprise(c, Number(t.dataset.sd), parseInt(t.value, 10) || 0); });
        else if (t.id === "cm-n0" || t.id === "cm-n1") mutate(function (c) { if (t.value.trim()) c.sd[i].n = t.value.trim().slice(0, 24); });
        else if (t.dataset.et !== undefined) mutate(function (c) { c.sd[Number(t.dataset.et)].et = t.checked ? 1 : 0; refreshRanges(c); });
        else if (t.dataset.pw !== undefined) { const q = t.dataset.pw.split(":"); mutate(function (c) { c.pr[Number(q[0])][2 + Number(q[1])] = Number(t.value); }); }
        else if (t.dataset.pac !== undefined) { const q = t.dataset.pac.split(":"); mutate(function (c) { c.pr[Number(q[0])][4 + Number(q[1])] = t.value === "" ? null : Number(t.value); }); }
        else if (t.dataset.hp) { const it = byId(t.dataset.hp), h = CS.hpEdit(hpOf(it), t.value); if (h) setHp(it.id, h); else { say("Type -6, +3 or a number.", "WARNING"); t.value = ""; } }
    }
    async function loadItems() {
        try { players = (await TK.OBR.party.getPlayers()).filter(function (p) { return p.role === "PLAYER"; }); } catch (e) { players = []; }
        items = (await TK.OBR.scene.items.getItems(function (i) { return i.layer === "CHARACTER"; })).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
        render();
    }

    /* ----- entry points ----- */
    function initGm(el) {
        gmRoot = el; el.addEventListener("click", onClick); el.addEventListener("change", onChange);
        el.addEventListener("toggle", function (e) { if (e.target.id === "cm-sur") surOpen = e.target.open; if (e.target.id === "cm-spl") splOpen = e.target.open; }, true);
    }
    // called by the hub (GM only) once the scene is ready: read, then follow changes
    async function boot() {
        const O = TK.OBR;
        try { if (await O.scene.isReady()) { await loadItems(); ingest(await O.scene.getMetadata()); } } catch (e) { console.warn(e); }
        O.scene.onMetadataChange(ingest); O.scene.items.onChange(loadItems);
        O.scene.onReadyChange(async function (r) { if (r) { await loadItems(); ingest(await O.scene.getMetadata()); } });
        O.party.onChange(function (ps) { players = ps.filter(function (p) { return p.role === "PLAYER"; }); });
    }
    return { initGm: initGm, boot: boot, _state: function () { return cur; } };
})();
