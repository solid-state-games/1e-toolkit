"use strict";
/* app.js - page shell for the 1e Toolkit: boot, the action popover (character list and the GM tabs).
   The character sheet page is js/sheet_ui.js. Rules live in lib/*.js, js/sheet_rules.js, js/gm_render.js, js/gm_combat.js.
   OBR calls used: onReady, player.getId/getRole/getName/hasPermission, party.getPlayers, scene.isReady/onReadyChange,
   scene.items.getItems/updateItems/onChange, modal.open/close, notification.show (SDK 3.1.0; see NOTES.md). */

const CREDIT = "Unofficial fan work, built from the AD&D 1st Edition Dungeon Masters Guide, Players Handbook and Monster Manual. Not affiliated with or endorsed by the rights holders.";
const TK = { OBR: null, role: "PLAYER", me: "", name: "", dev: null, view: "hub" };

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s === undefined || s === null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function say(msg, kind) { try { TK.OBR.notification.show(msg, kind || "DEFAULT"); } catch (e) { console.warn(msg); } }
function pageUrl(q) { return new URL("index.html?" + q + (TK.dev ? "&dev=" + TK.dev : ""), location.href).href; }
function copyText(text, btn) {
    const done = function () { if (!btn) return; const o = btn.textContent; btn.textContent = "Copied"; setTimeout(function () { btn.textContent = o; }, 1200); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
    try { const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); done(); } catch (e) { console.warn("copy failed", e); }
}

window.startToolkit = async function () {
    const OBR = window.OBRX; TK.OBR = OBR; TK.dev = window.TOOLKIT_DEV;
    const q = new URLSearchParams(location.search); TK.view = q.get("view") || "hub";
    if (!OBR.isAvailable) {
        $("app").innerHTML = '<div class="notice"><h2>Open this inside Owlbear Rodeo</h2><p>The 1e Character Sheet is an Owlbear Rodeo extension. Add it to a room (see the <a href="guide.html" target="_blank" rel="noopener">setup guide</a>), or try it in a plain browser with <a href="?dev=gm">?dev=gm</a> or <a href="?dev=player">?dev=player</a>.</p></div>';
        return;
    }
    OBR.onReady(async function () {
        try {
            TK.role = await OBR.player.getRole(); TK.me = await OBR.player.getId(); TK.name = await OBR.player.getName();
            document.body.classList.add(TK.role === "GM" ? "role-gm" : "role-player", TK.view === "sheet" ? "view-sheet" : "view-hub");
            if (TK.dev) document.body.classList.add("dev");
            if (TK.view === "sheet") await SheetUI.start(q.get("item"));
            else await Hub.start();
        } catch (e) { console.error(e); $("app").innerHTML = '<div class="notice"><h2>Something went wrong</h2><p>' + esc(e.message) + "</p></div>"; }
    });
};

/* ================= the action popover ================= */
const Hub = (function () {
    let tab = "sheets", players = [], items = [];
    const GM_TABS = [["enc", "Encounters"], ["tre", "Treasure"], ["com", "Combat"]];

    async function start() {
        // Players can join after the panel opens (e.g. a player in another tab): keep the Assign list live.
        const keepPlayers = function (ps) { players = (ps || []).filter(function (p) { return p.role === "PLAYER"; }); };
        if (TK.role === "GM") {
            keepPlayers(await TK.OBR.party.getPlayers());
            TK.OBR.party.onChange(function (ps) { keepPlayers(ps); refreshItems(); });
        }
        const sceneReady = await TK.OBR.scene.isReady();
        shell();
        if (sceneReady) await refreshItems(); else { $("sheets").innerHTML = '<p class="muted">Waiting for a scene to load.</p>'; }
        TK.OBR.scene.onReadyChange(function (r) { if (r) refreshItems(); });
        TK.OBR.scene.items.onChange(function () { refreshItems(); });
        show(tab);
    }
    function shell() {
        const tabs = [["sheets", "Characters"]].concat(TK.role === "GM" ? GM_TABS : []).concat([["guide", "Guide"]]);
        let h = '<header class="hubhead"><h1>1e Character Sheet</h1><span><span class="rolebadge">' + (TK.role === "GM" ? "GM" : "Player") + '</span><button type="button" class="btn ghost small themebtn" onclick="tkToggleTheme()">Light / Dark</button></span></header>';
        h += '<nav class="tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" data-tab="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</nav>";
        h += '<section id="sheets" class="pane"></section>';
        if (TK.role === "GM") h += '<section id="enc" class="pane"></section><section id="tre" class="pane"></section><section id="com" class="pane"></section>';
        h += '<section id="guide" class="pane"><p>The setup guide explains installing the extension, adding it to a room, linking a token to a sheet and moving a character between rooms.</p><p><a class="btn" href="guide.html" target="_blank" rel="noopener">Open the setup guide</a></p></section>';
        h += '<footer class="credit">' + esc(CREDIT) + "</footer>";
        $("app").innerHTML = h;
        document.querySelector(".tabs").addEventListener("click", function (e) { const b = e.target.closest("[data-tab]"); if (b) show(b.dataset.tab); });
        if (TK.role === "GM") { Enc.init($("enc")); Tre.init($("tre")); Com.init($("com")); }
    }
    function show(t) {
        tab = t;
        document.querySelectorAll(".pane").forEach(function (p) { p.style.display = p.id === t ? "" : "none"; });
        document.querySelectorAll(".tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === t); });
    }

    /* ----- character list ----- */
    function mine(it) { const o = (it.metadata || {})[SheetRules.OWNER_KEY]; return TK.role === "GM" || (o ? o === TK.me : it.createdUserId === TK.me); }  // private sheets
    async function refreshItems() {
        items = (await TK.OBR.scene.items.getItems(function (i) { return i.layer === "CHARACTER"; })).filter(mine);
        renderSheets();
    }
    function ownerName(it) {
        const id = (it.metadata || {})[SheetRules.OWNER_KEY];
        if (id === TK.me) return "you";
        const p = players.filter(function (x) { return x.id === id; })[0];
        return p ? p.name : (id ? "a player" : "");
    }
    function renderSheets() {
        const el = $("sheets"); if (!el) return;
        let h = "";
        if (!items.length) h += '<p class="muted">' + (TK.role === "GM" ? "No character tokens on this scene yet. Put a token on the Character layer, then come back." : "No tokens for you yet. Place a token on the Character layer, or ask the GM to assign one to you.") + "</p>";
        h += '<ul class="charlist">' + items.map(function (it) {
            const sh = (it.metadata || {})[SheetRules.KEY], has = !!sh;
            let line = '<li data-id="' + esc(it.id) + '"><div class="cname"><b>' + esc(it.name || "Unnamed token") + "</b>";
            if (has) line += '<span class="csub">' + esc(sh.nm || "") + " " + esc((sh.cl || []).join("/")) + " " + esc((sh.lv || []).join("/")) + "</span>"; else line += '<span class="csub muted">no sheet yet</span>';
            const own = ownerName(it); if (own) line += '<span class="csub">assigned to ' + esc(own) + "</span>";
            line += '</div><div class="cbtns"><button type="button" class="btn" data-act="open">' + (has ? "Open" : "Create") + "</button>";
            if (TK.role === "GM") {
                line += '<button type="button" class="btn ghost" data-act="import">Import</button>';
                if (has) line += '<button type="button" class="btn ghost" data-act="export">Export</button>';
                line += '<select data-act="assign" title="Assign this token to a player"><option value="">' + (players.length ? "Assign..." : "Assign (no players in the room yet)") + '</option><option value="-">Nobody</option>' + players.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + "</option>"; }).join("") + "</select>";
            }
            return line + "</div></li>";
        }).join("") + "</ul>";
        if (TK.role === "GM") h += '<p class="muted small">Assigning sets the owner on the token and tries to hand the token to that player so they can save changes. See the guide, "Who can edit what".</p>';
        if (TK.dev) h += '<div class="devbar">Dev room: <button type="button" class="btn ghost" data-dev="grant">Players may update any character: ' + (TK.OBR._dev.grant() ? "ON" : "off") + '</button> <button type="button" class="btn ghost" data-dev="add">Add token</button> <button type="button" class="btn ghost" data-dev="reset">Reset scene</button></div>';
        h += '<input type="file" id="importFile" accept="application/json,.json" hidden>';
        el.innerHTML = h;
        el.onclick = onSheetsClick; el.onchange = onSheetsChange;
    }
    let importFor = null;
    async function onSheetsClick(e) {
        const dev = e.target.closest("[data-dev]");
        if (dev) { const k = dev.dataset.dev; if (k === "grant") TK.OBR._dev.toggleGrant(); if (k === "reset") TK.OBR._dev.reset(); if (k === "add") TK.OBR._dev.addToken("New token " + (items.length + 1)); await refreshItems(); return; }
        const b = e.target.closest("[data-act]"); if (!b || b.tagName === "SELECT") return;
        const id = b.closest("li").dataset.id, it = items.filter(function (x) { return x.id === id; })[0];
        if (b.dataset.act === "open") TK.OBR.modal.open({ id: SheetRules.NS + "/sheet", url: pageUrl("view=sheet&item=" + encodeURIComponent(id)), width: 980, height: 940 });
        if (b.dataset.act === "export") downloadSheet(it);
        if (b.dataset.act === "import") { importFor = it; $("importFile").value = ""; $("importFile").click(); $("importFile").onchange = onImportFile; }
    }
    function downloadSheet(it) {
        const sh = SheetRules.sanitize((it.metadata || {})[SheetRules.KEY]), text = SheetRules.exportText(sh);
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
        a.download = (sh.nm || it.name || "character").replace(/[^\w-]+/g, "_") + ".1e-sheet.json"; document.body.appendChild(a); a.click(); a.remove();
    }
    async function onImportFile(e) {
        const f = e.target.files[0]; if (!f || !importFor) return;
        try {
            const sheet = SheetRules.parseImport(await f.text()), id = importFor.id;
            if (SheetRules.sizeOf(sheet) >= SheetRules.MAX_BYTES) throw new Error("That sheet is too large for token metadata.");
            await TK.OBR.scene.items.updateItems([id], function (d) { d[0].metadata[SheetRules.KEY] = sheet; });
            say("Imported " + (sheet.nm || "sheet") + ".", "SUCCESS"); await refreshItems();
        } catch (err) { say(err.message, "ERROR"); }
    }
    async function onSheetsChange(e) {
        const s = e.target.closest('select[data-act="assign"]'); if (!s || !s.value) return;
        const id = s.closest("li").dataset.id, pid = s.value === "-" ? null : s.value;
        let handed = false;
        try {
            await TK.OBR.scene.items.updateItems([id], function (d) { if (pid) d[0].metadata[SheetRules.OWNER_KEY] = pid; else delete d[0].metadata[SheetRules.OWNER_KEY]; });
            if (pid) { try { await TK.OBR.scene.items.updateItems([id], function (d) { d[0].createdUserId = pid; }); handed = true; } catch (err) { handed = false; } }
            say(pid ? (handed ? "Token handed to the player; they can save their sheet." : "Owner set. The player can open the sheet but may be read-only until the room allows character updates.") : "Owner cleared.", handed || !pid ? "SUCCESS" : "INFO");
        } catch (err) { say("Could not assign: " + err.message, "ERROR"); }
        await refreshItems();
    }
    return { start: start };
})();

/* ================= GM: Encounters ================= */
const Enc = (function () {
    let root, last = null;
    const TERRAINS = LAND_TERRAINS;
    const KEYSET = "toolkit/gm/enc";
    function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
    function init(el) {
        root = el;
        const modeOpts = [["", "Temperate (outdoor)"]].concat(SOURCE_MODES.map(function (m) { return [m, MODE_SHORT[m]]; }));
        el.innerHTML = '<div class="ctl">' +
            '<label>Mode <select id="e-mode">' + modeOpts.map(function (m) { return '<option value="' + m[0] + '">' + esc(m[1]) + "</option>"; }).join("") + "</select></label>" +
            '<label>Terrain <select id="e-terrain"></select></label>' +
            '<label>Density <select id="e-density"><option value="high">Wilderness (1 in 10)</option><option value="medium">Patrolled (1 in 12)</option><option value="low">Dense (1 in 20)</option></select></label>' +
            '<label>Numbers <select id="e-bell"><option value="bell" selected>Bell (MM II p.5 dice)</option><option value="linear">Linear (flat)</option></select></label>' +
            '<label class="chk"><input type="checkbox" id="e-air"> Airborne</label><label class="chk"><input type="checkbox" id="e-psi"> Psionic</label><label class="chk"><input type="checkbox" id="e-moon"> Bright moon</label>' +
            "</div>" +
            '<details class="more"><summary>Party (for reactions and evasion)</summary><div class="ctl">' +
            '<label>Party size <input type="number" id="e-pn" min="1" value="10"></label><label>Party HD <input type="number" id="e-phd" min="1" value="10"></label>' +
            '<label>Charisma <input type="number" id="e-cha" min="3" max="25" value="10"></label><label>Reaction adj <input type="number" id="e-rm" value="0"></label>' +
            '<label>Alignment <select id="e-al">' + ["LG", "LN", "LE", "NG", "N", "NE", "CG", "CN", "CE"].map(function (a) { return "<option" + (a === "N" ? " selected" : "") + ">" + a + "</option>"; }).join("") + "</select></label>" +
            '<label>Mount <select id="e-mount">' + Object.keys(MOUNTS).map(function (k) { return '<option value="' + k + '">' + MOUNTS[k].name + "</option>"; }).join("") + "</select></label>" +
            '<label>Load <select id="e-enc">' + Object.keys(ENCUMBRANCE).map(function (k) { return '<option value="' + k + '">' + ENCUMBRANCE[k].name + "</option>"; }).join("") + "</select></label>" +
            "</div></details>" +
            '<div class="row"><button type="button" class="btn" id="e-day">Roll a day</button><button type="button" class="btn" id="e-one">Roll one encounter</button><button type="button" class="btn ghost" id="e-copy">Copy as text</button></div>' +
            '<div id="e-out" class="out"><p class="muted">Pick a terrain and roll. Encounter checks follow DMG p.47; tables are DMG Appendix C.</p></div>';
        $("e-mode").onchange = fillTerrains; fillTerrains();
        $("e-day").onclick = function () { roll("day"); }; $("e-one").onclick = function () { roll("one"); };
        $("e-copy").onclick = function (ev) { if (last) copyText(last.text, ev.target); };
        el.addEventListener("click", cardAction);
    }
    function fillTerrains() {
        const m = $("e-mode").value, ts = m ? modeTerrains(m) : TERRAINS, old = $("e-terrain").value;
        $("e-terrain").innerHTML = ts.map(function (t) { return '<option value="' + t + '">' + esc(cap(t.replace(/([A-Z])/g, " $1").toLowerCase())) + "</option>"; }).join("");
        if (ts.indexOf(old) >= 0) $("e-terrain").value = old;
        $("e-density").disabled = !!m && !LAND_MODES.includes(m);
    }
    function settings() {
        const s = defaultSettings(), m = $("e-mode").value;
        s.modes = (m ? [m] : []).concat($("e-air").checked ? ["airborne"] : [], $("e-psi").checked ? ["psionic"] : []);
        s.density = $("e-density").value; s.bellCurve = $("e-bell").value === "bell";
        s.partyNumber = parseInt($("e-pn").value, 10) || 10; s.partyHD = parseInt($("e-phd").value, 10) || 10; s.charisma = parseInt($("e-cha").value, 10) || 10;
        s.reactionMod = parseInt($("e-rm").value, 10) || 0; s.partyAlignment = $("e-al").value; s.mount = $("e-mount").value; s.encumbrance = $("e-enc").value; s.brightMoon = $("e-moon").checked;
        return s;
    }
    function roll(kind) {
        const s = settings(), terrain = $("e-terrain").value, out = $("e-out");
        let day;
        if (kind === "day") day = rollDay(s, terrain);
        else {
            const period = { id: "one", label: "One encounter", icon: "\u{1F3B2}", light: "daylight" };
            const enc = rollOutdoorEncounter(s, terrain, period); enc.light = "daylight";
            const p = { id: "one", label: "One encounter", icon: "\u{1F3B2}", light: "daylight", status: enc.kind === "none" ? "clear" : "encounter", checkText: "Rolled directly, no check", encounter: enc.kind === "none" ? null : enc, note: enc.kind === "none" ? enc.reason : "" };
            day = { terrain: terrain, settings: s, plan: { title: "One encounter", periods: [p] }, periods: [p] };
        }
        out.innerHTML = '<div class="emeta">' + esc(day.plan ? (day.plan.title || "") : "") + " " + esc(terrain) + "</div>" + dayCardsHtml(day, terrain, s);
        last = { day: day, terrain: terrain, settings: s, text: day.periods.map(function (p) { return cardPlainText(terrain, s.density, p); }).join("\n\n") };
    }
    function cardAction(ev) {
        const btn = ev.target.closest && ev.target.closest("[data-act]");
        if (!btn || !btn.dataset.enc) return;
        const entry = ENCOUNTER_REGISTRY[btn.dataset.enc], box = btn.closest("details"), out = box && box.querySelector(".enc-out");
        if (!entry || !out) return;
        const s = settings();
        if (btn.dataset.act === "evade") {
            const res = evadeEncounter(entry.enc, s, { terrain: entry.ctx.terrain, light: entry.ctx.light });
            out.innerHTML = res.steps.map(function (x) { return "<div>" + escapeHtml(x) + "</div>"; }).join("") + "<div><b>" + escapeHtml({ automatic: "Evasion automatic", impossible: "No evasion possible", "no-pursuit": "Not pursued", evaded: "Evaded", confrontation: "Confrontation", continuing: "Still pursued" }[res.outcome] || res.outcome) + "</b> (party " + res.partySpeed + '", pursuers ' + res.monsterSpeed + '")</div>';
        } else if (btn.dataset.act === "morale") {
            const f = function (n) { const e = box.querySelector('[data-field="' + n + '"]'); return e ? e.value : ""; };
            const res = moraleForEncounter(entry.enc, { trigger: f("trigger"), counts: { enemySlain: f("enemySlain"), friendKilled: f("friendKilled") }, extra: f("extra") });
            out.innerHTML = "<div><b>" + escapeHtml(res.holds ? "Morale holds" : res.result) + "</b></div><div>" + escapeHtml(res.text) + "</div>" +
                (res.adjustments.length ? "<div>" + res.adjustments.map(function (a) { return escapeHtml(a.label + " " + sign(a.value)); }).join("; ") + "</div>" : "");
        }
    }
    return { init: init };
})();

/* ================= GM: Treasure ================= */
const Tre = (function () {
    let root, last = null; const sel = new Set();
    function init(el) {
        root = el;
        el.innerHTML = '<h3>Treasure type (MM p.105)</h3><div class="letters" id="t-letters">' + TREASURE_LETTERS.map(function (l) { return '<button type="button" class="lt" data-l="' + l + '">' + l + "</button>"; }).join("") + "</div>" +
            '<div class="ctl"><label>Individuals (J-N) <input type="number" id="t-ind" min="1" value="1"></label><label>Lair multiplier <input type="number" id="t-mul" min="1" value="1"></label></div>' +
            '<div class="row"><button type="button" class="btn" id="t-gen">Generate</button><button type="button" class="btn ghost" id="t-clr">Clear</button></div>' +
            '<h3>Random hoard (DMG p.120)</h3><div class="row"><select id="t-hoard"><option value="A">II.A Monetary (d20)</option><option value="B">II.B Magic (d20)</option><option value="C">II.C Combined (d100)</option></select><button type="button" class="btn" id="t-roll">Roll hoard</button></div>' +
            '<div class="row view"><label><input type="radio" name="t-view" value="dm" checked> DM view</label><label><input type="radio" name="t-view" value="player"> Player view</label><button type="button" class="btn ghost" id="t-copy">Copy</button></div>' +
            '<div id="t-out" class="out"><p class="muted">Pick a type and press Generate.</p></div>';
        el.addEventListener("click", function (e) { const b = e.target.closest(".lt"); if (b) { const l = b.dataset.l; if (sel.has(l)) { sel.delete(l); b.classList.remove("on"); } else { sel.add(l); b.classList.add("on"); } } });
        $("t-gen").onclick = function () {
            if (!sel.size) { $("t-out").innerHTML = '<p class="muted">Select at least one treasure type first.</p>'; return; }
            const n = function (id) { return Math.max(1, parseInt($(id).value, 10) || 1); };
            last = TreasureEngine.generate({ types: TREASURE_LETTERS.filter(function (l) { return sel.has(l); }), individuals: n("t-ind"), multiplier: n("t-mul") }); view();
        };
        $("t-clr").onclick = function () { sel.clear(); root.querySelectorAll(".lt").forEach(function (b) { b.classList.remove("on"); }); };
        $("t-roll").onclick = function () { last = TreasureEngine.generateHoard($("t-hoard").value); view(); };
        el.querySelectorAll('input[name="t-view"]').forEach(function (r) { r.onchange = view; });
        $("t-copy").onclick = function (ev) { const o = $("t-out"); if (o.innerText.trim()) copyText(o.innerText, ev.target); };
    }
    function view() {
        if (!last) return;
        const dm = root.querySelector('input[name="t-view"]:checked').value === "dm";
        let h = '<p class="hint">' + esc(treasureCaption(last)) + "</p>" + treasureViewHtml(last, dm);
        if (dm) {
            if (last.notes.length) h += '<div class="dmnote">' + last.notes.map(esc).join("<br>") + "</div>";
            h += "<details><summary>Roll log (" + last.log.length + " rolls)</summary><pre class=\"log\">" + esc(last.log.join("\n")) + "</pre></details>";
        }
        $("t-out").innerHTML = h;
    }
    return { init: init };
})();

/* ================= GM: Combat ================= */
const Com = (function () {
    let root, mode = "hit";
    const opts = function (list, sel) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(sel) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join(""); };
    function num(id, d) { const e = $(id); const v = e ? parseInt(e.value, 10) : NaN; return isNaN(v) ? d : v; }
    function init(el) {
        root = el;
        const classes = Object.keys(CLASSES).map(function (k) { return [k, CLASSES[k].label]; });
        const weapons = WEAPONS.map(function (w, i) { return [i, w.name + " (" + w.kind + ")"]; });
        const armours = ARMORS.map(function (a, i) { return [i, a.name + (a.ac !== null ? " (AC " + a.ac + ")" : "")]; });
        const sits = SITUATIONS.map(function (s, i) { return [i, s.l]; });
        el.innerHTML = '<nav class="subtabs"><button type="button" data-m="hit" class="on">To hit</button><button type="button" data-m="P">Pummel</button><button type="button" data-m="G">Grapple</button><button type="button" data-m="O">Overbear</button></nav>' +
            '<div id="c-hit"><div class="ctl">' +
            '<label>Class <select id="c-cls">' + opts(classes, "fighter") + '</select></label><label>Level <select id="c-lvl"></select></label>' +
            '<label>Target AC <input type="number" id="c-ac" min="-10" max="10" value="5"></label>' +
            '<label>Weapon <select id="c-wep">' + opts(weapons, 0) + '</select></label>' +
            '<label>Target armour <select id="c-arm">' + opts(armours, 0) + '</select></label><label class="chk"><input type="checkbox" id="c-shield"> Shield</label>' +
            '<label>Situation <select id="c-sit">' + opts(sits, 0) + '</select></label>' +
            '<label>Bonus to hit <input type="number" id="c-bon" value="0"></label><label>Penalty <input type="number" id="c-pen" value="0"></label>' +
            '<label>Range (missile) <select id="c-rng"><option value="S">Short</option><option value="M">Medium (-2)</option><option value="L">Long (-5)</option></select></label>' +
            '<label>Target size <select id="c-size"><option value="SM">Small or medium</option><option value="L">Large</option></select></label><label>Damage bonus <input type="number" id="c-dmg" value="0"></label>' +
            '</div><div id="c-res" class="out"></div></div>' +
            '<div id="c-wl" style="display:none"><div class="ctl" id="c-wlf"></div><div class="row"><button type="button" class="btn" id="c-roll">Roll</button></div><div id="c-wres" class="out"></div></div>';
        el.querySelector(".subtabs").addEventListener("click", function (e) {
            const b = e.target.closest("[data-m]"); if (!b) return; mode = b.dataset.m;
            el.querySelectorAll(".subtabs button").forEach(function (x) { x.classList.toggle("on", x === b); });
            $("c-hit").style.display = mode === "hit" ? "" : "none"; $("c-wl").style.display = mode === "hit" ? "none" : "";
            if (mode !== "hit") buildWl();
        });
        $("c-cls").onchange = function () { fillLevels(); calc(); };
        el.querySelectorAll("#c-hit select, #c-hit input").forEach(function (x) { if (x.id !== "c-cls") x.onchange = calc; x.oninput = calc; });
        $("c-roll").onclick = rollWl;
        fillLevels(); calc();
    }
    function fillLevels() {
        const cls = $("c-cls").value, ls = GMCombat.levelChoices(cls);
        $("c-lvl").innerHTML = ls.map(function (l) { return '<option value="' + l.v + '">' + l.t + "</option>"; }).join(""); $("c-lvl").value = ls[Math.min(2, ls.length - 1)].v;
        $("c-lvl").onchange = calc;
    }
    function calc() {
        const p = { cls: $("c-cls").value, lv: num("c-lvl", 1), wi: num("c-wep", 0), ac: num("c-ac", 10), armorIdx: num("c-arm", 0), shield: $("c-shield").checked, bonus: num("c-bon", 0), penalty: num("c-pen", 0),
            sit: num("c-sit", 0), range: $("c-rng").value, size: $("c-size").value, dmgBonus: num("c-dmg", 0) };
        const s = GMCombat.toHitState(p), row = GMCombat.toHitRow(p.cls, p.lv), wr = GMCombat.weaponRow(p.wi);
        const needTxt = s.auto || s.need < 1 ? "auto" : s.need > 20 ? "over 20" : String(s.need);
        let h = '<div class="big"><div><span>Matrix</span><b>' + s.m + "</b></div><div><span>Weapon adj</span><b>" + (s.type === null ? "n/a" : GMCombat.sgn(s.adj)) + "</b></div><div><span>Need on d20</span><b>" + needTxt + "</b></div><div><span>Damage</span><b>" + esc(s.dmg) + "</b></div><div><span>Attacks</span><b>" + esc(s.atk) + "</b></div></div>";
        h += '<p class="note">' + (s.type === null ? "Natural armour: no weapon adjustment (PHB p.38 gives adjustments by armour type only)." : "AC type " + s.type + " for the weapon adjustment (PHB p.36, 38).") + " Speed factor " + esc(s.wep.spdTxt || s.wep.spd || "n/a") +
            (s.wep.kind === "melee" ? ", length " + esc(s.wep.len) + ", space " + esc(s.wep.space) : ", rate " + esc(s.wep.rate) + ", range " + esc(s.wep.range.join("/")) + '"') + ". Matrix: DMG p.74-75.</p>";
        h += '<div class="scroll"><table class="grid"><tr><th>AC</th>' + row.map(function (r) { return "<th>" + r.ac + "</th>"; }).join("") + "</tr><tr><th>To hit</th>" + row.map(function (r) { return "<td>" + r.need + "</td>"; }).join("") + "</tr></table></div>";
        h += '<div class="scroll"><table class="grid"><tr><th>Armour type</th>' + wr.map(function (r) { return "<th>" + r.ac + "</th>"; }).join("") + "</tr><tr><th>" + esc(s.wep.name) + "</th>" + wr.map(function (r) { return '<td class="' + (r.adj > 0 ? "pos" : r.adj < 0 ? "neg" : "") + '">' + (r.adj ? GMCombat.sgn(r.adj) : "--") + "</td>"; }).join("") + "</tr></table></div>";
        h += '<div class="row"><button type="button" class="btn ghost" id="c-copy">Copy</button></div>';
        $("c-res").innerHTML = h; $("c-copy").onclick = function (ev) { copyText(GMCombat.toHitText(p), ev.target); };
    }
    function buildWl() {
        const f = function (id, label, v, extra) { return '<label>' + label + ' <input type="number" id="w-' + id + '" value="' + v + '" ' + (extra || "") + "></label>"; };
        const chk = function (id, label) { return '<label class="chk"><input type="checkbox" id="w-' + id + '"> ' + label + "</label>"; };
        let h = f("aDEX", "Attacker Dex", 10) + f("aSTR", "Attacker Str", 10) + f("aPct", "Str 18 %", 0) + f("aAC", "Attacker AC", 10) + f("oAC", "Target AC", 10) + f("oDEX", "Target Dex", 10) + f("oSTR", "Target Str", 10) + f("oPct", "Target Str %", 0);
        h += '<label>Target armour <select id="w-arm"><option value="none">None / AC 10</option><option value="lp">Leather or padded</option><option value="crs">Chain, ring or scale</option><option value="bps">Banded, plate or splint</option></select></label>';
        if (mode === "P") h += '<label>Helmet <select id="w-hel"><option value="none">None</option><option value="open">Open</option><option value="nasal">Nasal</option><option value="visor">Visored</option></select></label><label>Strike with <select id="w-str"><option value="fist">Bare fist</option><option value="wood">Wood</option><option value="metal">Metal</option></select></label>' + chk("shield", "Target has shield") + chk("cloak", "Target has cloak");
        if (mode !== "P") h += f("faster", "Target faster by (steps)", 0) + f("wt", "Weight diff (x 50 lb)", 0) + f("ht", "Height diff (x 6 in)", 0);
        h += chk("slowed", "Slowed") + chk("stunned", "Stunned") + (mode === "P" ? chk("helpless", "Helpless") : "") + chk("hasted", "Hasted") + chk("prone", "Prone");
        if (mode === "O") h += chk("rush", "Rush") + chk("braced", "Braced");
        $("c-wlf").innerHTML = h; $("c-wres").innerHTML = '<p class="muted">' + { P: "Pummel: DMG p.72", G: "Grapple: DMG p.72-73", O: "Overbear: DMG p.73" }[mode] + ". Set the figures and roll.</p>";
    }
    function rollWl() {
        const n = function (k, d) { return num("w-" + k, d); }, c = function (k) { const e = $("w-" + k); return !!(e && e.checked); }, s = function (k, d) { const e = $("w-" + k); return e ? e.value : d; };
        const p = { atkDEX: n("aDEX", 10), atkSTR: n("aSTR", 10), atkPct: n("aPct", 0), atkAC: n("aAC", 10), oppAC: n("oAC", 10), oppDEX: n("oDEX", 10), oppSTR: n("oSTR", 10), oppPct: n("oPct", 0),
            armor: s("arm", "none"), helmet: s("hel", "none"), strike: s("str", "fist"), faster: n("faster", 0), wtDiff: n("wt", 0), htDiff: n("ht", 0), varHit: 0, varRes: 0,
            slowed: c("slowed"), stunned: c("stunned"), helpless: c("helpless"), hasted: c("hasted"), prone: c("prone"), rush: c("rush"), braced: c("braced"), shield: c("shield"), cloak: c("cloak") };
        const r = GMCombat.weaponless(mode, p);
        $("c-wres").innerHTML = '<div class="big"><div><span>Chance</span><b>' + r.chance + "%</b></div><div><span>Rolled</span><b>" + r.hitRoll + "</b></div><div><span>Result</span><b>" + (r.hit ? (r.entry.dmg > 0 ? r.dmg.actual + " HP" : "hit") : "miss") + "</b></div></div><p>" + esc(r.text) + '</p><div class="row"><button type="button" class="btn ghost" id="c-wcopy">Copy</button></div>';
        $("c-wcopy").onclick = function (ev) { copyText(r.text, ev.target); };
    }
    return { init: init };
})();

/* light/dark: follows the system until the user picks one, then remembers it (per browser) */
function tkToggleTheme() {
    const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    r.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("tk-theme", r.dataset.theme); } catch (e) {}
}
