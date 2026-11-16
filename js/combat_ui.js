"use strict";
/* combat_ui.js - the GM "Combat" card (simple combat, TB 2026-11-16). Set-up behind the gear (sides, surprise ranges), Start and End combat,
   a round bar (Round, Turn, Roll initiative, Next round), an optional Surprise box (report only), a Party | Foes table with one row per token (hit points, target,
   to hit, damage, Roll and Apply), hits this round, casualties, optional spell rounds on PCs, and the players' sheet rolls. Players see nothing else of combat.
   Rules and state are in js/combat_state.js and js/combat_attack.js (DOM-free). Only the GM writes scene metadata.
   OBR calls used: scene.getMetadata/setMetadata/onMetadataChange/onReadyChange/isReady, scene.items.getItems/updateItems/onChange, party.getPlayers/onChange (SDK 3.1.0). */
const CombatUI = (function () {
    const CS = CombatState, CA = CombatAttack;
    let cur = { c: null, meta: {} }, items = [], players = [], gmRoot = null, setupOpen = null, notice = [], hpTab = 0, editHp = null, rolls = [], surOpen = false, splOpen = false;
    let draft = { n: ["Party", "Foes"], r: [undefined, undefined], et: [0, 0] };
    const own = function (i) { return (i.metadata || {})[SheetRules.OWNER_KEY]; };
    const byId = function (id) { return items.filter(function (x) { return x.id === id; })[0]; };
    const nameOf = function (id) { const it = byId(id); return it ? it.name || "Unnamed token" : "token (gone)"; };
    const sheetOf = function (it) { return it && (it.metadata || {})[SheetRules.KEY]; };
    const csOf = function (it) { return (it && (it.metadata || {})[CS.CS]) || {}; };
    // hit points: a PC's are on its sheet (hp, hm; GM edits them for an absent player), an NPC's or monster's on its token (`cs`.h, GM only)
    const hpOf = function (it) { const sh = sheetOf(it); return sh ? [Number(sh.hp) || 0, Number(sh.hm) || 0] : (csOf(it).h || null); };
    const isPc = function (it) { return !!sheetOf(it); };
    const dexOf = function (k) { const sh = sheetOf(byId(cur.c.ro[k])); return sh && sh.sc && sh.sc[3] ? sh.sc[3] : null; };
    const defSide = function (it) { return sheetOf(it) || own(it) || players.some(function (p) { return p.id === it.createdUserId; }) ? 0 : 1; };
    const pre = function () { return (cur.meta || {})[CS.PRE] || {}; };
    const sideFor = function (it) { return pre()[it.id] !== undefined ? pre()[it.id] : defSide(it); };
    const inf = function (t) { return t ? ' <span class="inf" title="' + esc(t) + '" aria-label="' + esc(t) + '">i</span>' : ""; };
    const ic = function (n) { return '<i class="ic ic-' + n + '" aria-hidden="true"></i>'; };
    const opt = function (v, t, sel) { return '<option value="' + v + '"' + (String(v) === String(sel) ? " selected" : "") + ">" + esc(t) + "</option>"; };
    // down: 0 or less (PHB p.105); a PC with no maximum set is not counted
    const isDown = function (it) { const h = hpOf(it); return !!h && h[0] <= 0 && (!isPc(it) || h[1] > 0); };
    const downIdx = function (k) { const it = byId(cur.c.ro[k]); return !!it && isDown(it); };

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
    // token state `cs` (item metadata, GM only): monsters' {h:[hp,max]}, and for every row its {tg: target token id, wi: weapon, ac: typed target AC}
    function setCs(id, patch) { return TK.OBR.scene.items.updateItems([id], function (d) { d[0].metadata[CS.CS] = Object.assign({}, d[0].metadata[CS.CS] || {}, patch); }).catch(function (e) { say(e.message, "ERROR"); }); }
    // PCs: the sheet's hp; monsters and NPCs: cs.h
    async function setHp(it, h) {
        if (isPc(it)) await TK.OBR.scene.items.updateItems([it.id], function (d) { d[0].metadata[SheetRules.KEY].hp = h[0]; }).catch(function (e) { say(e.message, "ERROR"); });
        else await setCs(it.id, { h: h });
        await loadItems();
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
    function hitsHtml(c) {
        let h = "<h4>Hits this round" + inf("Twice as often as the other side means a morale check, DMG p.67 footnote") + '</h4><div class="cmhits">' + c.sd.map(function (s, i) {
            return '<div class="cmhit"><b>' + esc(s.n) + '</b><button type="button" class="btn ghost small" data-act="hit" data-i="' + i + '" data-d="-1" aria-label="One fewer hit for ' + esc(s.n) + '">-</button><span class="cmcount">' + (c.ht[i] || 0) + '</span><button type="button" class="btn small" data-act="hit" data-i="' + i + '" data-d="1" aria-label="One more hit for ' + esc(s.n) + '">+</button>' +
                '<span class="muted small">' + (c.lh ? "last round " + (c.lh[i] || 0) : "") + "</span></div>"; }).join("") + "</div>";
        CS.moraleFlags(c).forEach(function (m) { h += '<p class="cmnote">' + esc(m) + "</p>"; });
        return h;
    }
    /* ----- the Party | Foes table: name, HP, target, to hit, damage, Roll ----- */
    function foesOf(c, i) { const out = []; c.sd.forEach(function (s, j) { if (j !== i) s.m.forEach(function (k) { const it = byId(c.ro[k]); if (it && !isDown(it)) out.push([k, it]); }); }); return out; }
    function rowModelFor(c, k, i) {
        const it = byId(c.ro[k]), st = csOf(it), foes = foesOf(c, i), tg = foes.filter(function (x) { return x[1].id === st.tg; })[0];
        if (!tg) return { it: it, st: st, foes: foes, tg: null };
        const af = CA.facts(it), tf = CA.facts(tg[1]), wi = Math.min(st.wi || 0, Math.max(0, (af.weapons || []).length - 1));
        return { it: it, st: st, foes: foes, tg: tg, af: af, tf: tf, wi: wi, m: CA.rowModel(af, wi, tf, st.ac) };
    }
    // One line per token (table-layout fixed): name (ellipsis, full name as title), HP as text that turns into an input on a click, target, weapon (PCs), needs, damage, Roll (icon).
    // A result is a full-width sub-row. A dead row is one greyed line with no controls.
    function rowHtml(c, k, i) {
        const r = rowModelFor(c, k, i), it = r.it, hp = hpOf(it), dead = isDown(it), res = (c.rr || {})[k], nm = it.name || "Unnamed token";
        let h = '<tr class="cmr' + (dead ? " dead" : "") + '"><td class="cmname" title="' + esc(nm) + '">' + esc(nm) + "</td>";
        const hpTxt = hp ? hp[0] + "/" + hp[1] : "--";
        h += '<td class="cmhpc">' + (editHp === it.id && !dead ? '<input class="cmhpin" data-hp="' + esc(it.id) + '" value="" placeholder="' + esc(hpTxt) + '" aria-label="Change hit points of ' + esc(nm) + ' (now ' + esc(hpTxt) + '): -6, +3 or a number">' :
            dead ? "<i>dead</i>" : '<button type="button" class="cmhpbtn" data-hpedit="' + esc(it.id) + '" title="Click to change hit points: -6, +3 or a number" aria-label="Hit points of ' + esc(nm) + ': ' + esc(hpTxt) + '. Click to change">' + esc(hpTxt) + "</button>") + "</td>";
        if (dead) { h += '<td></td><td></td><td></td><td></td><td></td></tr>'; return h; }
        h += '<td><select data-tg="' + esc(it.id) + '" aria-label="Target of ' + esc(nm) + '"><option value="">--</option>' + r.foes.map(function (x) { return opt(x[1].id, x[1].name, r.st.tg); }).join("") + "</select></td>";
        if (!r.tg) h += "<td></td><td></td><td></td><td></td></tr>";
        else {
            const m = r.m, af = r.af, many = m.dice.length === 1 && m.count > 1 ? " x" + m.count : "";
            h += '<td class="cmwcell">' + (af.kind === "pc" ? '<select data-wi="' + esc(it.id) + '" aria-label="Weapon of ' + esc(nm) + '">' + (af.weapons.length ? af.weapons.map(function (w, j) { return opt(j, w.name, r.wi); }).join("") : opt(0, "no weapon", 0)) + "</select>" + (CA.isMissile(af, r.wi) ? inf(CA.MISSILE_NOTE) : "") : "") + "</td>";
            h += '<td class="cmneedc">' + (m.need === null ? '<input type="number" class="cmac" data-acov="' + esc(it.id) + '" placeholder="AC" aria-label="Target armour class">' : "<b>" + m.need + "</b>") + "</td>";
            const dt = m.dice.map(function (d) { return CA.diceText(d); }).join("/") || "?", note = m.attacks + (af.kind === "pc" ? ", " + (m.size === "L" ? "against large" : "against small-medium") : "");
            h += '<td class="cmdmg" title="' + esc(dt + many + " (" + note + ")") + '">' + esc(dt) + (many ? "<b>" + many + "</b>" : "") + (af.kind === "pc" ? "<sup>" + (m.size === "L" ? "L" : "S-M") + "</sup>" : "") + "</td>";
            h += '<td class="cmrollc"><button type="button" class="btn small iconbtn" data-act="roll" data-k="' + k + '" title="Roll" aria-label="Roll ' + esc(nm) + '">' + ic("dice") + "</button></td></tr>";
        }
        if (res) { const ap = res.dm > 0 && !res.ap, tn = byId(c.ro[res.tk]); h += '<tr class="cmres"><td colspan="7">' + esc(res.ls.join("  |  ")) + (ap ? ' &middot; <button type="button" class="btn small" data-act="apply" data-k="' + k + '" title="Apply ' + res.dm + " damage" + (tn ? " to " + esc(tn.name) : "") + '" aria-label="Apply ' + res.dm + " damage" + (tn ? " to " + esc(tn.name) : "") + '">Apply</button>' : res.ap ? ' &middot; <span class="muted">applied</span>' : "") + "</td></tr>"; }
        return h;
    }
    function tableHtml(c) {
        const s = c.sd[hpTab];
        let h = '<h4>Hit points, targets and rolls' + inf("Type -6 or +3 to change hit points, or a number to set. PCs: the sheet's hit points. 0 or less is dead (PHB p.105).") + '</h4><div class="seg cmtabs" role="tablist">' + c.sd.map(function (x, i) { return '<button type="button" role="tab" data-hptab="' + i + '" class="sb' + (i === hpTab ? " on" : "") + '" aria-pressed="' + (i === hpTab) + '">' + esc(x.n) + " <small>" + x.m.length + "</small></button>"; }).join("") + "</div>";
        if (!s.m.length) return h + '<p class="muted">Nobody on this side.</p>';
        h += '<table class="grid cmhp"><colgroup><col class="c-name"><col class="c-hp"><col class="c-tg"><col class="c-wp"><col class="c-nd"><col class="c-dm"><col class="c-rl"></colgroup><tr><th>Token</th><th>HP</th><th>Target</th><th>Weapon</th><th>Hit on</th><th>Damage</th><th><span class="vh">Roll</span></th></tr>' + s.m.map(function (k) { return rowHtml(c, k, hpTab); }).join("") + "</table>";
        CS.casualties(c, downIdx).forEach(function (x) { if (x.down) h += '<p class="cmnote">' + esc(x.text) + (x.morale ? ". " + esc(x.morale) : "") + "</p>"; });
        return h;
    }
    function rollsHtml() {
        if (!rolls.length) return "";
        return '<details class="cmbox" id="cm-rolls"' + (rollsOpen ? " open" : "") + "><summary>Player rolls <small>" + rolls.length + "</small></summary><ul class=\"cmrolls\">" + rolls.map(function (r) { return "<li><b>" + esc(r.who) + ":</b> " + esc(r.x) + "</li>"; }).join("") + "</ul></details>";
    }
    let rollsOpen = true;
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
    function runHtml() {
        const c = cur.c;
        let h = '<div class="cmhead"><h3>Combat</h3><b class="cmrd">Round ' + c.rd + ' &middot; Turn ' + c.tn + ' <span class="muted">(round ' + CS.roundInTurn(c) + ' of 10)</span></b><span class="sp"></span>' +
            '<button type="button" class="x ibtn" data-act="cog" title="Set-up: sides and surprise ranges" aria-label="Set-up">' + ic("gear") + '</button><button type="button" class="btn ghost small" data-act="end">' + ic("flag") + "End combat</button></div>";
        if (showSetup()) h += setupHtml();
        return h + roundHtml(c) + surpriseHtml(c) + tableHtml(c) + hitsHtml(c) + spellsHtml(c) + rollsHtml();
    }
    const showSetup = function () { return setupOpen === null ? !cur.c : setupOpen; };
    function render() {
        if (!gmRoot) return;
        const keep = document.activeElement && gmRoot.contains(document.activeElement) && document.activeElement.id;
        gmRoot.innerHTML = '<div class="cmcard">' + (cur.c ? runHtml() : '<div class="cmhead"><h3>Combat</h3><span class="sp"></span><button type="button" class="x ibtn" data-act="cog" title="Set-up" aria-label="Set-up">' + ic("gear") + "</button></div>" + (showSetup() ? setupHtml() : '<p class="muted">No combat running. Open set-up (the gear) to start one.</p>')) + "</div>";
        if (keep) { const e = gmRoot.querySelector("#" + keep); if (e) e.focus(); }
    }
    // Roll (GM): d20 against the need, damage on a hit (each attack form of a monster, each shot of a bow), the latest result kept on the row until Next round, hits added to the side's tally
    function rollRow(k) {
        const c = cur.c, i = CS.sideOf(c, k), r = rowModelFor(c, k, i); if (!r.tg || !r.m) return;
        const res = CA.rollRow(r.m), tk = c.ro.indexOf(r.tg[1].id);
        mutate(function (c) { c.rr = c.rr || {}; c.rr[k] = { ls: res.lines, dm: res.dm, hits: res.hits, tk: tk, ap: 0 }; CS.hit(c, i, res.hits); });
    }
    // Apply: the damage comes off the target's hit points (a PC's sheet hp, or a monster's cs.h); 0 or less is dead
    async function applyRow(k) {
        const c = cur.c, rr = (c.rr || {})[k], t = rr && byId(c.ro[rr.tk]); if (!rr || !t || rr.ap) return;
        const h = hpOf(t); if (!h) { say("That token has no hit points yet: type its maximum first.", "WARNING"); return; }
        await setHp(t, CA.applyDamage(h, rr.dm)); await mutate(function (c) { c.rr[k].ap = 1; });
    }
    async function onClick(e) {
        const eh = e.target.closest("[data-hpedit]");
        if (eh) { editHp = eh.dataset.hpedit; render(); const inp = gmRoot.querySelector(".cmhpin"); if (inp) inp.focus(); return; }
        const b = e.target.closest("[data-act],[data-hptab]"); if (!b) return;
        const a = b.dataset.act, c = cur.c, k = Number(b.dataset.k), i = Number(b.dataset.i);
        if (a === "cog") { setupOpen = !showSetup(); render(); }
        else if (b.dataset.hptab !== undefined) { hpTab = Number(b.dataset.hptab); render(); }
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
        else if (a === "roll") rollRow(k);
        else if (a === "apply") applyRow(k);
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
        else if (t.dataset.tg !== undefined) setCs(t.dataset.tg, { tg: t.value || null });
        else if (t.dataset.wi !== undefined) setCs(t.dataset.wi, { wi: Number(t.value) });
        else if (t.dataset.acov !== undefined) setCs(t.dataset.acov, { ac: t.value === "" ? null : Number(t.value) });
        else if (t.dataset.hp) { const it = byId(t.dataset.hp), h = CS.hpEdit(hpOf(it), t.value); editHp = null; if (h) setHp(it, h); else { say("Type -6, +3 or a number.", "WARNING"); render(); } }
    }
    // the players' sheet rolls: each player's own metadata `.../rolls` (last 10 each), newest 10 overall
    async function scanRolls() {
        try {
            const O = TK.OBR, all = [{ metadata: await O.player.getMetadata() }].concat(await O.party.getPlayers()), out = [];
            all.forEach(function (p) { ((p.metadata || {})[CS.NS + "/rolls"] || []).forEach(function (r) { if (r && r.x) out.push(r); }); });
            rolls = out.sort(function (a, b) { return b.t - a.t; }).slice(0, 10); render();
        } catch (er) { console.warn(er); }
    }
    async function loadItems() {
        try { players = (await TK.OBR.party.getPlayers()).filter(function (p) { return p.role === "PLAYER"; }); } catch (e) { players = []; }
        // the dev room's "(your token)" style suffixes never show in combat labels
        items = (await TK.OBR.scene.items.getItems(function (i) { return i.layer === "CHARACTER"; })).map(function (i) { i.name = String(i.name || "").replace(/\s*\((your token|other player|GM token)\)\s*$/i, ""); return i; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
        render();
    }

    /* ----- entry points ----- */
    function initGm(el) {
        gmRoot = el; el.addEventListener("click", onClick); el.addEventListener("change", onChange);
        // the hit-point box: Enter or leaving it applies (the change event), Esc cancels, leaving it empty puts the number back
        el.addEventListener("keydown", function (e) { if (e.target.classList && e.target.classList.contains("cmhpin")) { if (e.key === "Escape") { e.preventDefault(); editHp = null; render(); } else if (e.key === "Enter") e.target.blur(); } });
        el.addEventListener("focusout", function (e) { if (e.target.classList && e.target.classList.contains("cmhpin") && editHp) setTimeout(function () { if (editHp && !(document.activeElement && document.activeElement.classList.contains("cmhpin"))) { editHp = null; render(); } }, 0); });
        el.addEventListener("toggle", function (e) { if (e.target.id === "cm-sur") surOpen = e.target.open; if (e.target.id === "cm-spl") splOpen = e.target.open; if (e.target.id === "cm-rolls") rollsOpen = e.target.open; }, true);
    }
    // called by the hub (GM only) once the scene is ready: read, then follow changes
    async function boot() {
        const O = TK.OBR;
        try { if (await O.scene.isReady()) { await loadItems(); ingest(await O.scene.getMetadata()); } } catch (e) { console.warn(e); }
        O.scene.onMetadataChange(ingest); O.scene.items.onChange(loadItems);
        O.scene.onReadyChange(async function (r) { if (r) { await loadItems(); ingest(await O.scene.getMetadata()); } });
        O.party.onChange(function (ps) { players = ps.filter(function (p) { return p.role === "PLAYER"; }); scanRolls(); }); O.player.onChange(scanRolls); scanRolls();
    }
    return { initGm: initGm, boot: boot, _state: function () { return cur; } };
})();
