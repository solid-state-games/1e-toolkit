"use strict";
/* sheet_ui.js - the six-page character record. Every figure shown comes from SheetRules.compute() (rules_1e.js derive() plus combat_rules.js).
   Stored in the token's item metadata under SheetRules.KEY; only inputs are stored (see sheet_rules.js sanitize()).
   OBR calls: scene.items.getItems / updateItems / onChange, modal.close, notification.show, player.hasPermission. */

const SheetUI = (function () {
    const SR = SheetRules, R = Rules;
    const TABS = ["Abilities", "Combat", "Skills and look", "Equipment", "Spells", "Notes", "Retainers"];
    let mode = "full", canSee = true, item = null, sheet = null, view = null, tab = 0, canWrite = false, status = "", saveTimer = null, saving = false, dirty = false, lastJson = "", root = null, tokenId = "";
    // screen-only state (never stored): pending confirmation, loyalty situation counts and results, tokens in the scene, open loyalty panels, last payment note
    let pending = null, loySit = [], loyRes = {}, loyChk = 0, loyOpen = {}, loyRow = -1, toks = [], toksJson = "", payLoc = 0, payNote = "", rsub = 0, drawer = -1, drawerAnim = false, rulesOpen = {};
    // creating a character (screen-only): null, or {phase: choose|wizard|random, ok: replace confirmed}. cre = Random PC choices and the rolled preview.
    let creating = null, cre = { band: "1", method: "1", sheet: null, line: "", err: "" };

    /* ---------- boot, load, save ---------- */
    async function start(id) {
        tokenId = id;
        root = $("app");
        mode = SR.defaultSheetView(TK.role);
        try { const m = localStorage.getItem(SR.VIEW_KEY + "-" + TK.role); if (m === "simple" || m === "full") mode = m; } catch (e) { /* private mode: keep the role default */ }
        const found = await TK.OBR.scene.items.getItems([id]);
        if (!found.length) { root.innerHTML = '<div class="notice"><h2>Token not found</h2><p>That token is no longer on this scene.</p></div>'; return; }
        loadFrom(found[0]);
        await refreshToks();
        paint();
        TK.OBR.scene.items.onChange(async function () {
            if (dirty || saving) return; // never overwrite typing in progress
            if (await refreshToks() && tab === 6) paint();
            const it = (await TK.OBR.scene.items.getItems([tokenId]))[0];
            if (!it) return;
            const incoming = JSON.stringify((it.metadata || {})[SR.KEY] || null);
            if (incoming !== lastJson) { loadFrom(it); paint(); }
        });
    }
    // character-layer tokens in this scene, for "linked token". Same private-sheet rule as the hub: GM sees all, a player the ones that are theirs.
    function mineTok(it) { const o = (it.metadata || {})[SR.OWNER_KEY]; return TK.role === "GM" || (o ? o === TK.me : it.createdUserId === TK.me); }
    async function refreshToks() {
        try {
            const list = (await TK.OBR.scene.items.getItems(function (i) { return i.layer === "CHARACTER"; })).map(function (i) { return { id: i.id, name: i.name || "(unnamed)", mine: mineTok(i) }; });
            const j = JSON.stringify(list); if (j === toksJson) return false; toksJson = j; toks = list; return true;
        } catch (e) { return false; }
    }
    function loadFrom(it) {
        item = it;
        const stored = (it.metadata || {})[SR.KEY];
        lastJson = JSON.stringify(stored || null);
        sheet = SR.sanitize(stored || Object.assign(SR.blank(), { nm: it.name || "" }));
        view = SR.compute(sheet);
        // Private sheets (1e: players keep their own records). Owner = the player the GM assigned, else whoever placed the token.
        const owner = (it.metadata || {})[SR.OWNER_KEY];
        canSee = TK.role === "GM" || (owner ? owner === TK.me : it.createdUserId === TK.me);
        canWrite = canSee && (TK.role === "GM" || it.createdUserId === TK.me);
        if (!canWrite && (it.metadata || {})[SR.OWNER_KEY] === TK.me) { TK.OBR.player.hasPermission("CHARACTER_UPDATE").then(function (ok) { if (ok && !canWrite) { canWrite = true; paint(); } }); }
        status = canWrite ? (stored ? "Saved in the token" : "New sheet: choose how to start") : "Read only: this token is not yours to edit";
        if (canWrite && !stored && !creating) creating = { phase: "choose", ok: true }; // nothing is saved until a way is chosen
    }
    function commit(rerender) {
        sheet = SR.sanitize(sheet); view = SR.compute(sheet); dirty = true;
        if (rerender !== false) paint(); else updateMeter();
        if (!canWrite) return;
        status = "Saving...";
        clearTimeout(saveTimer); saveTimer = setTimeout(save, 450);
        updateMeter();
    }
    async function save() {
        const packed = JSON.parse(SR.pack(sheet)), size = SR.sizeOf(sheet);
        if (size >= SR.MAX_BYTES) { status = "NOT SAVED: sheet is " + size + " bytes, over the 16 kB token limit. Trim gear, spells or notes."; say(status, "ERROR"); dirty = false; updateMeter(); return; }
        saving = true;
        try {
            await TK.OBR.scene.items.updateItems([tokenId], function (d) { d[0].metadata[SR.KEY] = packed; });
            lastJson = JSON.stringify(packed); status = "Saved in the token at " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        } catch (e) { status = "NOT SAVED: " + e.message; say("Could not save the sheet: " + e.message, "ERROR"); }
        saving = false; dirty = false; updateMeter();
    }
    function updateMeter() {
        const hs = $("hstatus"); if (hs) { hs.textContent = status.replace(/^Saved in the token at /, "Saved "); hs.classList.toggle("bad", /NOT SAVED/.test(status)); }
        const m = $("meter"); if (!m) return;
        const size = SR.sizeOf(sheet), pct = Math.min(100, Math.round(size / SR.MAX_BYTES * 100));
        m.innerHTML = '<span class="st' + (/NOT SAVED/.test(status) ? " bad" : "") + '">' + esc(status) + '</span><span class="bar" title="Token metadata used: ' + size + ' of 16000 bytes"><i style="width:' + pct + '%" class="' + (size >= SR.WARN_BYTES ? "warn" : "") + '"></i></span><span class="sz">' + size + " / 16000 B</span>";
    }

    /* ---------- tiny html helpers ---------- */
    function get(path) { return path.split(".").reduce(function (o, k) { return o === undefined || o === null ? o : o[k]; }, sheet); }
    function setPath(path, val) { const ks = path.split("."), last = ks.pop(); const o = ks.reduce(function (o, k) { return o[k]; }, sheet); o[last] = val; }
    const dis = function () { return canWrite ? "" : " disabled"; };
    function inp(path, o) {
        o = o || {}; const v = get(path);
        return '<input class="v ' + (o.cls || "") + '" data-f="' + path + '" data-t="' + (o.t || "s") + '" type="' + (o.t === "n" ? "number" : "text") + '" value="' + esc(v) + '"' + (o.min !== undefined ? ' min="' + o.min + '"' : "") + (o.max !== undefined ? ' max="' + o.max + '"' : "") + (o.maxlen ? ' maxlength="' + o.maxlen + '"' : "") + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : "") + (o.list ? ' list="' + o.list + '"' : "") + dis() + ">";
    }
    function sel(path, list, o) {
        o = o || {}; const v = String(get(path));
        return '<select class="v" data-f="' + path + '" data-t="' + (o.t || "s") + '"' + dis() + ">" + list.map(function (x) { const a = Array.isArray(x) ? x : [x, x]; return '<option value="' + esc(a[0]) + '"' + (String(a[0]) === v ? " selected" : "") + ">" + esc(a[1]) + "</option>"; }).join("") + "</select>";
    }
    function fld(label, val, title, cls) { return '<div class="fld ' + (cls || "") + '"' + (title ? ' title="' + esc(title) + '"' : "") + '><span class="lab">' + label + '</span><span class="val">' + val + "</span></div>"; }
    function box(title, body, cls) { return '<section class="box ' + (cls || "") + '"><h3>' + title + "</h3>" + body + "</section>"; }
    const sg = function (n) { return n > 0 ? "+" + n : String(n); };
    const nf = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 });
    function chips(list, act, extra) { return '<ul class="chips">' + list.map(function (t, i) { return "<li>" + esc(t) + (canWrite ? ' <button type="button" class="x" data-act="' + act + '" data-i="' + i + '"' + (extra || "") + ' title="Remove">&times;</button>' : "") + "</li>"; }).join("") + "</ul>"; }

    /* ---------- paint ---------- */
    function paint() {
        if (!canSee) {
            root.innerHTML = '<div class="sheet"><header class="shead"><div><h1>1e Character Sheet</h1><p class="sub">Private</p></div><div class="sbtns"><button type="button" class="btn" data-act="close">Close</button></div></header>' +
                '<div class="banner">This character belongs to another player. Only that player and the GM can see this sheet.</div></div>';
            return;
        }
        if (creating && canWrite) { paintCreate(); return; }
        const sy = window.scrollY, ae = document.activeElement, key = ae && ae.dataset && (ae.dataset.f || ae.id), v = view;
        let h = '<div class="sheet"><div class="orn"></div>';
        h += '<header class="shead' + (mode === "simple" ? " dense-head" : "") + '"><div><h1>1e Character Sheet</h1>' + (mode === "simple" ? "" : '<p class="sub">AD&amp;D 1st Edition, rules as written</p>') + '</div><div class="sbtns">' +
            '<span class="vsw" role="group" aria-label="Sheet view"><button type="button" class="btn ' + (mode === "simple" ? "" : "ghost") + '" data-act="vw" data-v="simple" aria-pressed="' + (mode === "simple") + '">Simple</button><button type="button" class="btn ' + (mode === "full" ? "" : "ghost") + '" data-act="vw" data-v="full" aria-pressed="' + (mode === "full") + '">Full</button></span>' +
            '<span class="hstatus" id="hstatus" role="status"></span>' + tkGear(canWrite ? "sheet" : "sheetro") + '<button type="button" class="btn" data-act="close">Close</button></div></header>';
        if (!canWrite) h += '<div class="banner">Read only. You can look at this sheet, and export it. Saving needs the GM to hand you the token (Characters tab, Assign) or allow character updates for players in the room settings.</div>';
        if (v.errors.length) h += '<div class="banner bad">' + v.errors.map(esc).join("<br>") + "</div>";
        else if (v.warns.length) h += '<div class="banner warn">' + v.warns.map(esc).join("<br>") + "</div>";
        if (mode === "simple" && v.d) { h += SheetSimple.html(v, canWrite); h += '<div class="orn"></div><footer class="sfoot"><div id="meter" class="meter"></div><div class="credit">' + esc(CREDIT) + '</div></footer><input type="file" id="importFile" accept="application/json,.json" hidden></div>'; root.innerHTML = h; updateMeter(); window.scrollTo(0, sy); restoreFocus(key); return; }
        h += identity();
        h += '<nav class="tabs sheettabs" role="tablist">' + TABS.map(function (t, i) { return '<button type="button" role="tab" data-act="tab" data-i="' + i + '" class="' + (i === tab ? "on" : "") + '">' + (i + 1) + ". " + t + "</button>"; }).join("") + "</nav>";
        h += '<div class="page" id="page">' + (v.d ? [pgAbilities, pgCombat, pgSkills, pgGear, pgSpells, pgNotes, pgRetainers][tab]() : "") + "</div>";
        h += '<div class="orn"></div><footer class="sfoot"><div id="meter" class="meter"></div><div class="credit">' + esc(CREDIT) + '</div></footer><input type="file" id="importFile" accept="application/json,.json" hidden></div>';
        root.innerHTML = h;
        updateMeter(); window.scrollTo(0, sy);
        restoreFocus(key);
    }

    /* ---------- making a character: Blank / Wizard / Random PC ---------- */
    const hadSheet = function () { return lastJson !== "null"; };
    const METHODS = [["1", "I: 4d6, drop the lowest, arrange"], ["2", "II: best six of twelve 3d6"], ["3", "III: best of six 3d6 for each"], ["4", "IV: best of twelve characters"]];
    const BANDS = [["1", "Level 1"], ["2-4", "Levels 2 to 4"], ["5-8", "Levels 5 to 8"], ["9-12", "Levels 9 to 12"]];
    function rollRandom() {
        cre.err = "";
        try {
            const b = cre.band.split("-").map(Number), lvl = b.length > 1 ? QPRules.rr(b[0], b[1]) : b[0];
            const rec = QPRules.genPCParty({ count: 1, levelRange: lvl, method: Number(cre.method), alignMode: "any" }).chars[0];
            cre.sheet = SR.fromQuickParty(rec, item.name || ""); cre.line = SR.previewLine(cre.sheet);
        } catch (e) { cre.sheet = null; cre.err = "Could not roll a character: " + e.message; }
    }
    function themeName() { const r = document.documentElement; return r.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); }
    function paintCreate() {
        const c = creating;
        let h = '<div class="sheet create"><div class="orn"></div><header class="shead"><div><h1>1e Character Sheet</h1><p class="sub">New character for ' + esc(item.name || "this token") + '</p></div><div class="sbtns">' +
            tkGear("hub") + (hadSheet() ? '<button type="button" class="btn ghost" data-act="mk-cancel">Cancel</button>' : "") + '<button type="button" class="btn" data-act="close">Close</button></div></header>';
        if (cre.err) h += '<div class="banner bad">' + esc(cre.err) + "</div>";
        if (hadSheet() && !c.ok) {
            h += '<div class="banner confirm">This token already has a sheet (' + esc(sheet.nm || "unnamed") + ", " + esc(sheet.cl.join("/")) + " " + esc(sheet.lv.join("/")) + "). A new character replaces it.<button type=\"button\" class=\"btn\" data-act=\"mk-ok\">Replace it</button><button type=\"button\" class=\"btn ghost\" data-act=\"mk-cancel\">Keep it</button></div>";
        } else if (c.phase === "choose") {
            const card = function (act, t, p) { return '<div class="mkcard"><h3>' + t + "</h3><p>" + p + '</p><button type="button" class="btn" data-act="' + act + '">' + t + "</button></div>"; };
            h += '<div class="mkgrid">' + card("mk-blank", "Blank sheet", "Start empty and fill it in yourself.") + card("mk-wizard", "Wizard", "Step by step: roll abilities, then race, class, kit and spells (the 1e Character Creator).") +
                card("mk-random", "Random PC", "A quick, legal character from the Quick Party generator. Preview it first.") + "</div>";
        } else if (c.phase === "wizard") {
            h += '<div class="mkbar"><button type="button" class="btn ghost" data-act="mk-back">Back</button><span class="hint">Finish on the last step sends the character to this sheet.</span></div>' +
                '<iframe id="wizframe" class="wizframe" title="1e Character Creator" src="wizard/index.html?embed=1&theme=' + themeName() + '"></iframe>';
        } else if (c.phase === "random") {
            const o = function (list, cur) { return list.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === cur ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join(""); };
            h += '<section class="box"><h3>Random PC</h3><div class="mkbar"><label>Level <select data-cre="band">' + o(BANDS, cre.band) + '</select></label><label>Ability method (DMG p.11) <select data-cre="method">' + o(METHODS, cre.method) + "</select></label></div>" +
                '<p class="preview" id="rpreview">' + (cre.sheet ? esc(cre.line) : "") + '</p><div class="mkbar"><button type="button" class="btn ghost" data-act="mk-reroll">Re-roll</button><button type="button" class="btn" data-act="mk-use"' + (cre.sheet ? "" : " disabled") + '>Use this character</button><button type="button" class="btn ghost" data-act="mk-back">Back</button></div>' +
                '<p class="hint">Made from the Quick Party tables (PHB p.9-37, DMG p.11, Appendix P). Spells, gear and magic items come with it; check the Notes page afterwards.</p></section>';
        }
        h += '<div class="orn"></div><footer class="sfoot"><div class="credit">' + esc(CREDIT) + "</div></footer></div>";
        root.innerHTML = h; window.scrollTo(0, 0);
    }
    function createAct(act) {
        if (act === "newchar") { creating = { phase: "choose", ok: false }; cre.err = ""; }
        else if (!creating) return;
        else if (act === "mk-cancel") creating = null;
        else if (act === "mk-ok") creating.ok = true;
        else if (act === "mk-back") { creating.phase = "choose"; cre.err = ""; }
        else if (act === "mk-blank") { adopt(SR.sanitize(Object.assign(SR.blank(), { nm: item.name || "" })), "Blank sheet"); return; }
        else if (act === "mk-wizard") { creating.phase = "wizard"; cre.err = ""; }
        else if (act === "mk-random") { creating.phase = "random"; rollRandom(); }
        else if (act === "mk-reroll") rollRandom();
        else if (act === "mk-use") { if (cre.sheet) { adopt(cre.sheet, "Random PC"); return; } }
        paint();
    }
    async function adopt(s, how) {
        if (SR.sizeOf(s) >= SR.MAX_BYTES) { cre.err = "That character is too large for token metadata (" + SR.sizeOf(s) + " bytes)."; paint(); return; }
        sheet = s; view = SR.compute(sheet); creating = null; tab = 0; pending = null; drawer = -1; cre.err = ""; dirty = true; status = "Saving...";
        clearTimeout(saveTimer); paint(); await save(); paint(); say(how + " saved to the token.", "SUCCESS");
    }
    window.addEventListener("message", function (e) {
        if (TK.view !== "sheet" || !creating || creating.phase !== "wizard" || e.origin !== location.origin) return;
        const fr = $("wizframe"), d = e.data;
        if (!fr || e.source !== fr.contentWindow || !d || d.type !== "1e-wizard-result" || !d.character) return;
        adopt(SR.fromCreator(d.character, item.name || ""), "Wizard character");
    });
    function restoreFocus(key) {
        if (key) setTimeout(function () { const e = document.querySelector('[data-f="' + key + '"]') || document.getElementById(key); if (e && e !== document.activeElement) { e.focus(); try { if (e.setSelectionRange && e.type === "text") e.setSelectionRange(e.value.length, e.value.length); } catch (x) { /* ignore */ } } }, 0);
    }

    function identity() {
        const s = sheet, v = view, d = v.d;
        const raceList = Object.keys(R.RACES), rc = R.RACES[s.race];
        const combos = [];
        R.CLASS_ORDER.forEach(function (c) { if (c in rc.limits) combos.push([c]); });
        (rc.multi || []).forEach(function (m) { combos.push(m.slice()); });
        const cur = s.cl.join("/");
        if (!combos.some(function (c) { return c.join("/") === cur; })) combos.unshift(s.cl.slice());
        const classSel = '<select class="v" data-act="cls"' + dis() + ">" + combos.map(function (c) { const t = c.join("/"); return '<option value="' + esc(t) + '"' + (t === cur ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("") + "</select>";
        const lvls = s.cl.map(function (c, i) { return '<span class="lv">' + (s.cl.length > 1 ? esc(c.slice(0, 3)) + " " : "") + inp("lv." + i, { t: "n", min: 1, max: 30, cls: "tiny" }) + "</span>"; }).join(" ");
        const aligns = R.ALIGNMENTS.map(function (a) { return [a, R.ALIGN_NAMES[a]]; });
        let h = '<section class="ident">';
        h += '<div class="row3">' + fld("Character name", inp("nm", { maxlen: 60 }), "", "wide") + fld("Player", inp("pl", { maxlen: 60 })) + fld("Campaign", inp("cmp", { maxlen: 60 })) + "</div>";
        h += '<div class="row3">' + fld("Race", sel("race", raceList) + (s.race === "Halfling" ? " " + sel("sub", [["", "(sub-race)"]].concat(R.HALFLING_SUBRACES.map(function (x) { return [x, x]; }))) : "") + " " + sel("sex", [["m", "Male"], ["f", "Female"]])) +
            fld("Class", classSel) + fld("Level", lvls, "Experience levels, one per class") + "</div>";
        h += '<div class="row3">' + fld("Alignment", sel("al", aligns)) + fld("Patron deity", inp("dt", { maxlen: 80 })) + fld("Religion", inp("rg", { maxlen: 80 })) + "</div>";
        h += '<div class="row3">' + fld("Place of origin", inp("og", { maxlen: 80 })) + fld("Experience points", inp("xp", { t: "n", min: 0 }) + xpNote(), "Experience is divided equally between the classes of a multi-class character (PHB p.14-17)") +
            fld("Armour class / hit points", '<b class="big">AC ' + d.ac + "</b> &nbsp; HP " + inp("hp", { t: "n", cls: "tiny" }) + " / " + inp("hm", { t: "n", min: 0, cls: "tiny" }) + " &nbsp; Move " + d.movement.move + '"', "AC from armour worn and Dex (PHB p.36, 12); movement from encumbrance (PHB p.101)") + "</div>";
        return h + "</section>";
    }
    function xpNote() {
        return view.xpRows.map(function (r) {
            const next = isFinite(r.limit) && r.limit > 0 && r.level >= r.limit ? "at level limit " + r.limit : "next level at " + nf.format(r.next);
            return '<span class="xpn">' + (view.xpRows.length > 1 ? esc(r.cls) + ": " : "") + next + (r.bonus ? " (+" + r.bonus + "% bonus)" : "") + (r.byXp > r.level ? ' <b class="up">xp reaches level ' + r.byXp + "</b>" : "") + "</span>";
        }).join("");
    }

    /* ---------- page 1: abilities ---------- */
    function pgAbilities() {
        const d = view.d, A = d.abilities, s = sheet, rc = R.RACES[s.race];
        const score = function (i, extra) { return '<div class="score">' + inp("sc." + i, { t: "n", min: 3, max: 25, cls: "sc" }) + (extra || "") + "</div>"; };
        const cell = function (l, v, t) { return '<div class="cell"' + (t ? ' title="' + esc(t) + '"' : "") + "><span>" + l + "</span><b>" + v + "</b></div>"; };
        const exc = (A.str.score >= 18 && R.isFighterType(s.cl)) ? '<label class="exc">/ <input class="v tiny" data-f="ex" data-t="n" type="number" min="0" max="100" value="' + s.ex + '"' + dis() + ' title="Exceptional strength percentile, 00 = 100 (PHB p.9)">%</label>' : "";
        let rows = "";
        rows += '<div class="arow"><div class="aname"><i>S</i><span>Strength</span>' + score(0, exc) + '</div><div class="cells">' +
            cell("Hit adj", sg(A.str.hit), "PHB p.9 Table II") + cell("Dmg adj", sg(A.str.dmg), "PHB p.9") + cell("Wt allow (gp)", sg(A.str.wgt), "PHB p.9: added to the encumbrance bands, PHB p.101") +
            cell("Open doors", A.str.openDoors, "PHB p.9; fighters' locked/barred chance in brackets") + cell("Bend bars/lift gates", (A.str.bars || 0) + "%", "PHB p.9") + "</div></div>";
        rows += '<div class="arow"><div class="aname"><i>I</i><span>Intelligence</span>' + score(1) + '</div><div class="cells">' +
            cell("Add'l languages", A.int.languages, "PHB p.10 Table I") + cell("% know spell", A.int.learnPct ? A.int.learnPct + "%" : "-", "Magic-users and illusionists, PHB p.10 Table II") +
            cell("Min spells/lvl", A.int.minSpells || "-", "PHB p.10") + cell("Max spells/lvl", A.int.maxSpells || "-", "PHB p.10") + cell("Max spell level", A.int.maxSpellLevel, "PHB p.10") + "</div></div>";
        const bonus = A.wis.bonusSpells.map(function (n, i) { return n ? n + " x " + (i + 1) + (["st", "nd", "rd", "th"][i]) : ""; }).filter(Boolean).join(", ") || "none";
        rows += '<div class="arow"><div class="aname"><i>W</i><span>Wisdom</span>' + score(2) + '</div><div class="cells">' +
            cell("Magic attack adj", sg(A.wis.magicDef), "Saving throw adjustment against mental attacks, PHB p.11") + cell("Spell bonus (clerics)", bonus, "PHB p.11 Table, bonus spells") + cell("% spell failure", A.wis.spellFail + "%", "Clerical spell failure, PHB p.11") + "</div></div>";
        rows += '<div class="arow"><div class="aname"><i>D</i><span>Dexterity</span>' + score(3) + '</div><div class="cells">' +
            cell("Reaction adj", sg(A.dex.reaction), "Surprise and attacking adjustment, PHB p.11 Table I") + cell("Missile adj", sg(A.dex.reaction), "To hit with missile weapons, PHB p.11") + cell("Defence adj (AC)", sg(A.dex.defense), "Change to armour class; negative is better, PHB p.11-12") + "</div></div>";
        rows += '<div class="arow"><div class="aname"><i>C</i><span>Constitution</span>' + score(4) + '</div><div class="cells">' +
            cell("HP adj / die", sg(A.con.hp) + (A.con.hpOther !== A.con.hpFighter ? " (" + sg(A.con.hpOther) + " non-fighters)" : ""), "Fighters (fighter, paladin, ranger) may gain more, PHB p.12") +
            cell("System shock", A.con.shock + "%", "PHB p.12") + cell("Resurrection survival", A.con.resurrection + "%", "PHB p.12") + cell("Times raised (max)", A.con.maxRaises, "PHB p.12") + "</div></div>";
        rows += '<div class="arow"><div class="aname"><i>Ch</i><span>Charisma</span>' + score(5) + '</div><div class="cells">' +
            cell("Max henchmen", A.cha.henchmen + (A.cha.ownRaceHenchmen ? " (" + A.cha.ownRaceHenchmen + " own race)" : ""), "PHB p.13") + (isGM() ? cell("Loyalty base", sg(A.cha.loyalty) + "%", "PHB p.13") : "") + cell("Reaction adj", sg(A.cha.reaction) + "%", "PHB p.13") + "</div></div>";
        let h = box("Abilities", '<p class="hint">Scores are final scores (after race and age). Races: ' + esc(s.race) + " (" + Object.keys(R.ABILITY_NAMES).map(function (a) { return R.ABILITY_NAMES[a].slice(0, 3) + " " + rc.min[a][s.sex === "f" ? 1 : 0] + "-" + rc.max[a][s.sex === "f" ? 1 : 0]; }).join(", ") + ", PHB p.15 Table III).</p>" + rows);
        // saves
        const sv = d.saves, names = [["death", "Paralysis, poison or death magic"], ["petrification", "Petrification or polymorph"], ["wand", "Rod, staff or wand"], ["breath", "Breath weapon"], ["spell", "Spell"]];
        let sh = '<table class="grid saves"><tr>' + names.map(function (n) { return "<th>" + n[1] + "</th>"; }).join("") + "</tr><tr>" + names.map(function (n) { return "<td>" + sv[n[0]] + "</td>"; }).join("") + "</tr></table>";
        sh += '<p class="hint">' + esc(sv.rule) + " Saving throw tables: DMG p.79.</p>" + sv.notes.map(function (n) { return '<p class="note">' + esc(n) + "</p>"; }).join("");
        sh += condRows("sj", "Saving throw adjustments");
        // movement
        const m = view.movement;
        let mh = '<table class="grid"><tr><th>Load</th><th>Up to (gp wt)</th><th>Move</th></tr>' + m.bands.map(function (b, i) { return '<tr class="' + (i === m.band ? "cur" : "") + '"><td>' + b.name + "</td><td>" + nf.format(b.upTo) + '</td><td>' + b.move + '"</td></tr>'; }).join("") + "</table>";
        mh += '<p class="hint">Carrying ' + nf.format(m.lb) + " lb (" + nf.format(m.gp) + " gp weight). " + (m.band > 3 ? "Over the maximum load." : "Current band: " + m.bands[m.band].name + ".") + (m.armorMove !== null ? " Armour limits movement to " + m.armorMove + '".' : "") + " Strength allowance " + sg(m.allowance) + ". PHB p.101.</p>";
        h += '<div class="two">' + box("Saving throws", sh) + box("Movement", mh) + "</div>";
        // vision, resistances
        const traits = [];
        if (d.infravision) traits.push("Infravision " + d.infravision + " ft (PHB p.14-17)");
        d.notes.forEach(function (n) { if (!/^Infravision \d/.test(n) || !d.infravision) traits.push(n); });
        view.traits.forEach(function (t) { traits.push(t); });
        h += box("Vision and resistances", traits.length ? "<ul>" + traits.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : '<p class="muted">No racial vision or resistances.</p>');
        // psionics
        const psi = function (k, l) { return fld(l, inp("psi." + k, { maxlen: 80 })); };
        h += box("Psionics", '<p class="hint">Psionic figures are set by the DM (DMG Appendix I); enter them here.</p><div class="row3">' + psi("a", "Psionic ability") + psi("m", "Attack and defence modes") + psi("d", "Detection") + "</div><div class=\"row3\">" + psi("mj", "Major disciplines") + psi("mi", "Minor disciplines") + "</div>");
        // languages
        const ls = d.languages, extra = s.lg, left = ls.bonus - extra.length;
        const choices = R.languageChoices(view.char);
        h += box("Languages", "<p>Known: " + ls.known.map(esc).join(", ") + (extra.length ? "; chosen: " : "") + "</p>" + chips(extra, "lang-rm") +
            (canWrite ? '<div class="addrow"><select id="lang-sel"><option value="">Choose a language...</option>' + choices.map(function (l) { return "<option>" + esc(l) + "</option>"; }).join("") + '</select><button type="button" class="btn" data-act="lang-add">Add</button></div>' : "") +
            '<p class="hint">Intelligence allows ' + ls.bonus + " additional language" + (ls.bonus === 1 ? "" : "s") + " (PHB p.10, race limits PHB p.14-17). " + (left < 0 ? '<b class="up">' + (-left) + " too many chosen.</b>" : left + " left to choose.") + "</p>");
        return h;
    }
    function condRows(key, title) {
        const rows = sheet[key];
        let h = '<div class="cond"><h4>' + title + "</h4>" + rows.map(function (r, i) {
            return '<div class="crow">' + inp(key + "." + i + ".0", { maxlen: 6, cls: "tiny", ph: "+/-" }) + inp(key + "." + i + ".1", { maxlen: 50, ph: "condition" }) + (canWrite ? '<button type="button" class="x" data-act="cond-rm" data-k="' + key + '" data-i="' + i + '">&times;</button>' : "") + "</div>";
        }).join("");
        if (canWrite && rows.length < SR.LIM.cond) h += '<button type="button" class="btn ghost small" data-act="cond-add" data-k="' + key + '">Add a line</button>';
        return h + "</div>";
    }

    /* ---------- page 2: combat ---------- */
    function pgCombat() {
        const d = view.d, s = sheet, A = d.abilities, wp = d.weaponProf;
        let h = "";
        const choices = SR.proficiencyChoices(s).filter(function (n) { return s.pf.indexOf(n) < 0; });
        let wh = '<p class="hint">' + wp.initial + " weapon proficiencies at the start; using a weapon you are not proficient in is " + wp.nonProficiencyPenalty + " to hit (PHB p.37; class tables PHB p.19-31). Chosen: " + s.pf.length + ".</p>" + chips(s.pf, "prof-rm");
        if (canWrite) wh += '<div class="addrow"><select id="prof-sel"><option value="">Add a weapon...</option>' + choices.map(function (n) { return "<option>" + esc(n) + "</option>"; }).join("") + '</select><button type="button" class="btn" data-act="prof-add">Add</button></div>';
        h += box("Weapons of proficiency", wh);
        // to-hit rows
        const acs = []; for (let a = 10; a >= -10; a--) acs.push(a);
        let th = '<div class="scroll"><table class="grid tohit"><tr><th>vs AC</th>' + acs.map(function (a) { return "<th>" + a + "</th>"; }).join("") + "</tr>" +
            "<tr><th>Melee</th>" + acs.map(function (a) { return "<td>" + view.toHitRows.melee[a] + "</td>"; }).join("") + "</tr>" +
            "<tr><th>Missile</th>" + acs.map(function (a) { return "<td>" + view.toHitRows.missile[a] + "</td>"; }).join("") + "</tr></table></div>";
        th += '<p class="hint">Number needed on d20 (equal or higher hits). Class and level from the attack matrix (DMG p.74-75); melee includes Strength hit adj ' + sg(A.str.hit) + ', missile includes Dexterity ' + sg(A.dex.reaction) + '. Attacks per round: ' + esc(view.attacksPerRound) + ' (PHB p.25).</p>';
        h += box("To hit by armour class", th);
        h += box("Combat adjustments", condRows("cj", "Condition adjustments (to hit and damage)") + '<p class="hint">Racial bonuses to hit (for example elves with bows and swords) are listed on page 1 under vision and resistances, and are not added to the table above.</p>');
        // weapons table
        let wt = "";
        if (view.weapons.length) {
            wt = '<div class="scroll"><table class="grid wtab"><tr><th>Weapon</th><th>Hit adj</th><th>Dmg S-M</th><th>Dmg L</th><th>Speed</th><th>Space / range</th>' + [10, 9, 8, 7, 6, 5, 4, 3, 2].map(function (t) { return "<th title=\"Weapon adjustment against armour type " + t + " (PHB p.38)\">" + t + "</th>"; }).join("") + "</tr>" +
                view.weapons.map(function (w) {
                    return "<tr><td>" + esc(w.name) + (w.kind === "missile" ? " (missile)" : "") + "</td><td>" + sg(w.hitMod) + "</td><td>" + esc(w.sm || "-") + (w.dmgMod ? " " + sg(w.dmgMod) : "") + "</td><td>" + esc(w.lg || "-") + (w.dmgMod ? " " + sg(w.dmgMod) : "") + "</td><td>" + esc(w.spd === null || w.spd === undefined ? "-" : w.spd) + "</td><td>" +
                        esc(w.kind === "missile" ? "rate " + w.rate + ", range " + w.range.join("/") + '"' : "len " + w.len + ", space " + w.space) + "</td>" +
                        w.adj.map(function (a) { return '<td class="' + (a > 0 ? "pos" : a < 0 ? "neg" : "") + '">' + (a ? sg(a) : "--") + "</td>"; }).join("") + "</tr>";
                }).join("") + "</table></div>" + '<p class="hint">Damage and weapon adjustments PHB p.37-38; speed factors and space PHB p.38. Strength damage adj ' + sg(A.str.dmg) + " is added to melee damage (PHB p.9).</p>";
        } else wt = '<p class="muted">Choose weapons of proficiency above to list their figures here.</p>';
        h += box("Weapons: damage, speed, space and adjustment against armour type", wt);
        // HP and hit dice
        let hp = '<div class="row3">' + fld("Hit points now", inp("hp", { t: "n" })) + fld("Hit points full", inp("hm", { t: "n", min: 0 })) + fld("Armour class", "<b>" + d.ac + "</b>", "From armour worn on the Equipment page, and Dexterity (PHB p.36, 12)") + "</div>";
        hp += "<ul>" + view.hitDice.map(function (x) { return "<li>" + esc(x.cls) + " level " + x.level + ": " + x.text + "</li>"; }).join("") + "</ul>";
        hp += '<p class="hint">Hit dice and flat points after name level: class tables PHB p.19-31; Constitution adjustment per die PHB p.12. Multi-class characters average their dice (PHB p.14-17).</p>';
        const maxLv = Math.max.apply(null, s.lv), n = Math.min(30, maxLv + 1);
        hp += '<div class="hpl"><span class="lab">Hit points gained per level</span>' + Array.from({ length: n }, function (_, i) { return '<label>' + (i + 1) + inp("hl." + i, { t: "n", min: 0, max: 99, cls: "tiny" }) + "</label>"; }).join("") + "</div>";
        h += box("Hit points and hit dice", hp);
        // scarring
        let sc = '<table class="grid inj"><tr><th>Injury</th><th>Date</th><th>Explanation</th><th></th></tr>' + s.ij.map(function (r, i) {
            return "<tr><td>" + inp("ij." + i + ".0", { maxlen: 40 }) + "</td><td>" + inp("ij." + i + ".1", { maxlen: 24 }) + "</td><td>" + inp("ij." + i + ".2", { maxlen: 80 }) + "</td><td>" + (canWrite ? '<button type="button" class="x" data-act="inj-rm" data-i="' + i + '">&times;</button>' : "") + "</td></tr>";
        }).join("") + "</table>";
        if (canWrite && s.ij.length < SR.LIM.injuries) sc += '<button type="button" class="btn ghost small" data-act="inj-add">Add a scar or maiming</button>';
        h += box("Scarring and maiming", sc);
        if (d.monk) h += box("Monk", "<p>" + esc(d.monk[0]) + ": armour class " + d.monk[1] + ', movement ' + d.monk[2] + '", no Strength or Dexterity bonus (PHB p.30-32).</p>');
        return h;
    }

    /* ---------- page 3: skills and description ---------- */
    function pgSkills() {
        const t = view.thief, s = sheet;
        let h = "";
        if (t) {
            const names = Object.keys(t).filter(function (k) { return k.charAt(0) !== "_"; });
            let sk = '<table class="grid skills"><tr><th>Skill</th><th>Base</th><th>Race</th><th>Dex</th><th>Other</th><th>Total</th></tr>' + names.map(function (n, i) {
                const x = t[n], idx = ["Pick Pockets", "Open Locks", "Find/Remove Traps", "Move Silently", "Hide in Shadows", "Hear Noise", "Climb Walls", "Read Languages"].indexOf(n);
                const total = x.total === null ? "-" : Math.max(0, Math.min(99, x.total + s.ta[idx])) + "%";
                return "<tr><td>" + esc(n) + "</td><td>" + x.base + "%</td><td>" + sg(x.race) + "</td><td>" + sg(x.dex) + "</td><td>" + inp("ta." + idx, { t: "n", min: -99, max: 99, cls: "tiny" }) + "</td><td><b>" + total + "</b></td></tr>";
            }).join("") + "</table>";
            sk += '<p class="hint">Level used for the table: ' + t._level + ". Thief and assassin tables, race and Dexterity adjustments: PHB p.27-29 (assassins count two levels lower, PHB p.29); monks PHB p.30-31. The Other column is for the DM's adjustments (armour, magic).</p>";
            h += box("Thieving skills", sk);
        } else h += box("Thieving skills", '<p class="muted">This character has no thieving skills. They appear here for thieves, assassins and monks.</p>');
        const f = function (k, l, w) { return fld(l, inp("d." + k, { maxlen: k === "mk" || k === "mn" || k === "ap" ? 160 : 40 }), "", w); };
        h += box("Description", '<div class="row3">' + f("bd", "Birthday") + f("ht", "Height") + f("wt", "Weight") + "</div>" + '<div class="row3">' + f("hr", "Hair") + f("ey", "Eyes") + f("sx", "Age") + "</div>" +
            '<div class="row3">' + f("st", "Social class or standing") + "</div>" + f("ap", "General appearance", "wide") + f("mk", "Distinguishing marks", "wide") + f("mn", "Mannerisms", "wide"));
        return h;
    }

    /* ---------- page 4: equipment ---------- */
    function pendingBar() {
        if (!pending) return "";
        return '<div class="banner confirm" id="confirm">' + esc(pending.msg) + ' <button type="button" class="btn small" data-act="yes">' + esc(pending.yes || "Yes") + '</button> <button type="button" class="btn ghost small" data-act="no">Cancel</button></div>';
    }
    function pgGear() {
        const s = sheet, m = view.movement, places = s.lp, LIM = SR.LIM;
        let h = pendingBar();
        // places
        let pl = '<p class="hint">Somewhere you left things: a room at an inn, a stronghold vault, a bank. Only what you carry counts toward load, movement and armour class (PHB p.101, p.36); armour left behind does not protect you.</p>';
        pl += '<table class="grid places"><tr><th>Place</th><th>Items</th><th>Coins worth (gp)</th><th></th></tr>';
        pl += '<tr><td>Carried</td><td>' + s.inv.filter(function (e) { return !SR.locOf(e); }).length + '</td><td>' + nf.format(SR.coinGp(s)) + "</td><td></td></tr>";
        places.forEach(function (p, k) {
            const c = SR.placeCounts(s, k + 1);
            pl += "<tr><td>" + inp("lp." + k + ".0", { maxlen: LIM.place }) + "</td><td>" + c.items + "</td><td>" + nf.format(SR.purseGp(p.slice(1))) + "</td><td>" + (canWrite ? '<button type="button" class="x" data-act="pl-rm" data-i="' + k + '" title="Remove this place">&times;</button>' : "") + "</td></tr>";
        });
        pl += "</table>";
        if (canWrite) pl += '<div class="addrow"><input id="pl-new" maxlength="' + LIM.place + '" placeholder="New place (Room at the Green Dragon inn, Stronghold vault, Bank in Greyhawk...)"' + (places.length >= LIM.places ? " disabled" : "") + '><button type="button" class="btn" data-act="pl-add"' + (places.length >= LIM.places ? " disabled" : "") + ">Add place</button></div>";
        pl += '<p class="hint">' + places.length + " of " + LIM.places + " places (kept small so the sheet fits the 16 kB token limit).</p>";
        h += box("Places", pl);
        // equipment grouped by location
        const where = ["Carried"].concat(places.map(function (p) { return p[0]; }));
        let g = '<div class="scroll"><table class="grid gear"><tr><th>Item</th><th>Qty</th><th>Each (lb)</th><th>Total (lb)</th><th>AC</th><th>Move to</th><th></th></tr>';
        where.forEach(function (name, loc) {
            const rows = []; s.inv.forEach(function (e, i) { if (SR.locOf(e) === loc) rows.push(i); });
            g += '<tr class="grp"><th colspan="7">' + esc(name) + (loc ? " (left here: not counted for load, movement or armour class)" : " (counts for load, movement and armour class)") + "</th></tr>";
            if (!rows.length) g += '<tr><td colspan="7" class="muted">' + (loc ? "Nothing left here." : "Nothing carried.") + "</td></tr>";
            rows.forEach(function (i) {
                const e = s.inv[i], o = SR.hydrateRow(e), nm = SR.entryParts(e).core[0];
                const mv = canWrite ? '<select data-act="mv" data-i="' + i + '" title="Move this item to another place"><option value="-1">Move to...</option>' + where.map(function (w, k) { return k === loc ? "" : '<option value="' + k + '">' + esc(w) + "</option>"; }).join("") + '</select> <input class="tiny" id="mvq-' + i + '" type="number" min="1" placeholder="all" title="How many to move (blank = all)">' : "";
                g += '<tr class="' + (loc ? "away" : "") + '"><td>' + esc(nm) + "</td><td>" + inp("inv." + i + ".1", { t: "n", min: 1, max: 9999, cls: "tiny" }) + "</td><td>" + nf.format(o.w || 0) + "</td><td>" + nf.format((o.w || 0) * e[1]) + "</td><td>" + (o.ac !== undefined && o.ac !== null ? o.ac : "") + "</td><td>" + mv + "</td><td>" + (canWrite ? '<button type="button" class="x" data-act="gear-rm" data-i="' + i + '">&times;</button>' : "") + "</td></tr>";
            });
        });
        g += "</table></div>";
        if (canWrite) {
            const grp = function (label, list) { return '<optgroup label="' + label + '">' + list.map(function (i) { return "<option>" + esc(i.n) + "</option>"; }).join("") + "</optgroup>"; };
            const E = R.EQUIPMENT;
            g += '<div class="addrow"><select id="gear-sel"><option value="">Add to Carried from the price lists...</option>' + grp("Armour and shields", E.armor) + grp("Weapons", E.weapons) + grp("Equipment", E.gear) + grp("Animals", E.beasts) + '</select>' +
                '<input id="gear-qty" type="number" min="1" value="1" class="tiny"><button type="button" class="btn" data-act="gear-add">Add</button></div>';
            g += '<div class="addrow"><input id="cg-n" placeholder="Other item (a magic item, a gem pouch...)" maxlength="60"><input id="cg-w" type="number" step="0.1" min="0" placeholder="lb each" class="tiny"><input id="cg-ac" type="number" min="-10" max="10" placeholder="AC" class="tiny"><button type="button" class="btn" data-act="gear-custom">Add other</button></div>';
        }
        g += '<p class="hint">Weights DMG p.225 and PHB p.35-37; armour values PHB p.36. Armour worn sets your armour class and caps movement. Entries marked estimated in rules_1e.js have no printed weight in the books. Magic bonuses on armour and shields are not worked out: put them in the combat adjustments.</p>';
        h += box("Equipment", g);
        // encumbrance live
        const bar = Math.min(100, Math.round(m.gp / (m.bands[3].upTo) * 100));
        let en = '<div class="enc"><div class="encbar"><i style="width:' + bar + '%" class="b' + Math.min(m.band, 4) + '"></i></div><p><b>' + nf.format(m.lb) + " lb</b> (" + nf.format(m.gp) + " gp weight) &nbsp; " + (m.band > 3 ? "<b class=\"up\">over the maximum load: cannot move</b>" : "<b>" + m.bands[m.band].name + "</b> load") + " &nbsp; Move <b>" + m.move + '"</b></p></div>';
        en += '<p class="hint">Carried items and carried coins only. Bands: normal up to ' + nf.format(m.bands[0].upTo) + " gp, heavy " + nf.format(m.bands[1].upTo) + ", loaded " + nf.format(m.bands[2].upTo) + ", maximum " + nf.format(m.bands[3].upTo) + ' (350 gp steps plus your Strength allowance, PHB p.101). Coins count one gp of weight each.</p>';
        h += box("Encumbrance (live)", en);
        // coins per place
        const names = [["pp", "Platinum"], ["gp", "Gold"], ["ep", "Electrum"], ["sp", "Silver"], ["cp", "Copper"]];
        let c = '<table class="grid coinsgrid"><tr><th>Where</th>' + names.map(function (n) { return "<th>" + n[1] + "</th>"; }).join("") + "<th>Worth (gp)</th></tr>";
        c += "<tr><td>Carried</td>" + names.map(function (n, i) { return "<td>" + inp("co." + i, { t: "n", min: 0, cls: "coin" }) + "</td>"; }).join("") + "<td>" + nf.format(SR.coinGp(s)) + "</td></tr>";
        places.forEach(function (p, k) { c += "<tr><td>" + esc(p[0]) + "</td>" + names.map(function (n, i) { return "<td>" + inp("lp." + k + "." + (i + 1), { t: "n", min: 0, cls: "coin" }) + "</td>"; }).join("") + "<td>" + nf.format(SR.purseGp(p.slice(1))) + "</td></tr>"; });
        c += "</table>";
        c += '<p class="hint">Worth is in gp. 1 pp = 5 gp, 1 ep = 1/2 gp, 20 sp = 1 gp, 200 cp = 1 gp (PHB p.35). Only the Carried row weighs you down.</p>';
        h += box("Treasure and coins", c);
        return h;
    }

    /* ---------- page 7: retainers (sub-tabs Henchmen, Hirelings, Costs; henchman drawer; loyalty is GM only) ---------- */
    const RSUBS = ["Henchmen", "Hirelings", "Costs"], GM_RSUBS = RSUBS.concat(["Loyalty"]); // the Loyalty sub-tab exists only for the GM
    function isGM() { return TK.role === "GM"; }
    function canOpenTok(id) { const t = toks.filter(function (x) { return x.id === id; })[0]; return t && t.mine; }
    function rules(k, body) { return '<details class="rules" data-k="' + k + '"' + (rulesOpen[k] ? " open" : "") + "><summary>Rules</summary>" + body + "</details>"; }
    function pgRetainers() {
        const s = sheet, r = view.ret;
        let h = pendingBar();
        if (r.rangerBlock) h += '<div class="banner warn">A ranger may not hire men-at-arms, servants, aides or henchmen until 8th level (PHB p.24).' + (r.rangerUsed ? " This sheet already lists some." : "") + "</div>";
        if (r.asn) h += '<div class="banner warn">Assassin, level ' + r.asn.lv + " (PHB p.30): hirelings may be " + r.asn.who + ". No hirelings before 4th level, thieves too from 8th, any class from 12th; only neutral or evil characters will serve an assassin; henchmen number by Charisma." + (r.asn.used ? " This sheet already lists hirelings." : "") + "</div>";
        const subs = isGM() ? GM_RSUBS : RSUBS; if (rsub >= subs.length) rsub = 0;
        h += '<nav class="subtabs rsubs" role="tablist">' + subs.map(function (t, i) { return '<button type="button" role="tab" data-act="rsub" data-i="' + i + '" class="' + (i === rsub ? "on" : "") + '">' + t + "</button>"; }).join("") + "</nav>";
        h += [subHench, subHire, subCosts, subLoy][rsub](s, r);
        if (rsub === 0 && drawer >= 0 && s.hn[drawer]) h += drawerHtml(drawer);
        return h;
    }
    function subHench(s, r) {
        const LIM = SR.LIM, H = SR.H, gm = isGM();
        let hh = '<p class="' + (r.overOwn ? "warnline" : "") + '"><b title="Charisma table, PHB p.13">Maximum henchmen: ' + r.max + "</b>" + (r.own ? " (" + r.own + " if the extra are of your own race, PHB p.16-17)" : "") + " &nbsp; Listed: <b>" + r.count + "</b>" + (gm ? " &nbsp; Charisma loyalty base: <b>" + SG(r.chaLoyalty) + "%</b>" : "") + "</p>";
        if (r.over) hh += '<div class="banner warn">' + (r.overOwn ? "Over the Charisma limit: " + r.count + " henchmen but Charisma " + s.sc[5] + " allows " + (r.own || r.max) + " (PHB p.13)." : r.count + " henchmen but Charisma " + s.sc[5] + " allows " + r.max + " (PHB p.13). The " + r.own + " figure holds only if the extra are of your own race (PHB p.16-17).") + "</div>";
        if (s.hn.length) {
            hh += '<table class="grid hench"><tr><th>Name</th><th>Race</th><th>Class and level</th><th>HP</th><th>AC</th><th>Pay</th><th>Token</th><th></th></tr>';
            s.hn.forEach(function (x, i) {
                const tk = x[H.tok], open = tk && canOpenTok(tk) ? '<button type="button" class="btn ghost small" data-act="hn-open" data-i="' + i + '" title="Open this henchman\'s own sheet on its token">Open</button>' : (tk ? '<span class="muted" title="Linked, but not a sheet you may open">linked</span>' : '<span class="muted">none</span>');
                hh += '<tr class="hrow' + (drawer === i ? " sel" : "") + '" data-act="hn-edit" data-i="' + i + '" title="Click to open this henchman\'s details"><td>' + esc(x[H.nm] || "Henchman " + (i + 1)) + "</td><td>" + esc(x[H.race]) + "</td><td>" + esc(x[H.cls]) + " " + x[H.lv] + (r.hn[i].level ? ' <span title="At or above your own level: outside the usual run (DMG p.34, p.36)">*</span>' : "") + "</td><td>" + x[H.hp] + "</td><td>" + x[H.ac] + "</td><td>" + nf.format(x[H.pay]) + "</td><td>" + open + '</td><td><button type="button" class="btn ghost small" data-act="hn-edit" data-i="' + i + '">Edit</button></td></tr>';
            });
            hh += "</table>";
        } else hh += '<p class="muted">No henchmen yet.</p>';
        if (canWrite) hh += '<div class="addrow"><button type="button" class="btn" data-act="hn-add"' + (s.hn.length >= LIM.hench ? " disabled" : "") + '>Add a henchman</button><span class="hint">' + s.hn.length + " of " + LIM.hench + " lines</span></div>";
        hh += rules("hn", '<p class="hint">Henchmen are the permanent followers of a player character: the number you may keep is set by Charisma (PHB p.13, 15 is the most), and it does not limit mercenary soldiers or servitors.' + (gm ? " Loyalty is on the Loyalty tab (DMG p.36-37)." : "") + ' A henchman at or above your own level (marked *) is outside the usual run (DMG p.34, p.36). Pay: DMG p.25 puts maintenance at 100 gp per level per month, in addition to treasure shares (DMG p.35). Click a row for the full details.</p>');
        return box("Henchmen", hh);
    }
    function subHire(s, r) {
        const LIM = SR.LIM, QP = window.QPRules || { MERC: {} };
        const soldierOpts = SR.SOLDIERS.map(function (n, i) { const m = QP.MERC[n]; return '<option value="' + i + '">' + esc(n) + " (" + (m ? m.pay : "?") + " gp)</option>"; }).join("");
        const expertOpts = SR.EXPERTS.map(function (x, i) { return '<option value="' + i + '">' + esc(x.n) + " (" + (x.c !== undefined ? x.c + " gp" : x.lv ? x.lv + " gp per level" : "agree " + x.r[0] + " to " + nf.format(x.r[1]) + (x.once ? "+" : "") + " gp") + ")</option>"; }).join("");
        let hl = '<table class="grid hires"><tr><th>Hireling</th><th>No.</th><th title="Soldiers: how many of them are serjeants (10 times the troop rate, DMG p.31). Experts: level, or the agreed gp a month">Serj., level or gp</th><th>Monthly (gp)</th><th>Source</th><th>Equipment and notes</th><th></th></tr>';
        s.hr.forEach(function (e, i) {
            const L = r.hires[i];
            let third = "";
            if (e[0] === 0) third = inp("hr." + i + ".3", { t: "n", min: 0, max: e[2], cls: "tiny" });
            else if (L.perLevel) third = inp("hr." + i + ".3", { t: "n", min: 1, max: 30, cls: "tiny", ph: "level" });
            else if (L.range) third = inp("hr." + i + ".3", { t: "n", min: 0, cls: "tiny", ph: String(L.range[0]) });
            hl += "<tr><td>" + esc(L.name) + (L.star ? ' <span title="Plus 10% of the cost of items made, per job (DMG p.29 note)">*</span>' : "") + "</td><td>" + inp("hr." + i + ".2", { t: "n", min: 1, max: 9999, cls: "tiny" }) + "</td><td>" + third + "</td><td>" + nf.format(L.cost) + (L.monthly ? "" : " once") + (L.unset ? ' <span class="hint" title="No figure entered yet: the low end of the printed range is used">(low)</span>' : "") + "</td><td>" + esc(L.page) + "</td><td>" + inp("hr." + i + ".4", { maxlen: LIM.hirenote, ph: "arms, armour, duties" }) + "</td><td>" + (canWrite ? '<button type="button" class="x" data-act="hr-rm" data-i="' + i + '">&times;</button>' : "") + "</td></tr>";
        });
        if (!s.hr.length) hl += '<tr><td colspan="7" class="muted">No hirelings yet.</td></tr>';
        hl += "</table>";
        if (canWrite) {
            const full = s.hr.length >= LIM.hire ? " disabled" : "";
            hl += '<div class="addrow"><select id="hs-sel" title="Mercenary soldiers, monthly cost per man (DMG p.29)">' + soldierOpts + '</select><input id="hs-n" type="number" min="1" value="10" class="tiny"><button type="button" class="btn" data-act="hs-add"' + full + '>Add soldiers</button></div>';
            hl += '<div class="addrow"><select id="he-sel" title="Expert hirelings (DMG p.29-34)">' + expertOpts + '</select><input id="he-n" type="number" min="1" value="1" class="tiny"><button type="button" class="btn" data-act="he-add"' + full + '>Add expert</button></div>';
        }
        hl += '<p class="hint">' + s.hr.length + " of " + LIM.hire + " hireling lines.</p>";
        const cm = r.cmd;
        if (cm.soldiers || cm.lt || cm.cpt) {
            hl += '<p class="note"><b>Command check (DMG p.30-31).</b> ' + cm.regular + " regular soldiers (direct command up to " + cm.direct + ": " + esc(cm.note) + "), " + cm.serj + " serjeants, officer levels: lieutenant " + cm.lt + ", captain " + cm.cpt + ", officer capacity " + cm.cap + ".</p>";
            cm.warn.forEach(function (x) { hl += '<div class="banner warn">' + esc(x) + "</div>"; });
        }
        hl += rules("hr", '<p class="hint">Hirelings are paid soldiers and experts, not henchmen. Monthly costs are printed in the DMG (soldiers and experts p.29-34); they cover pay, uniform, housing and food, not arms and armour for soldiers (DMG p.29). A serjeant costs 10 times the troop rate and leads up to 10 soldiers (DMG p.31); lieutenants (fighter 2nd or 3rd level, 100 gp a level) lead as many decades as levels and captains (fighter 5th to 8th, 100 gp a level) as many scores (DMG p.30-31). The direct-command limit (10 for the fighter group, 5 for others) is a TB ruling built on DMG p.30-31. Starred experts cost an extra 10% of the value of what they make, per job (DMG p.29). Sage pay is 200 to 1,200 gp for support and salary, and the same for research grants, set by 2d6 each (DMG p.33): enter what you agreed. Spies are paid per assignment, 100 gp to 10,000 or more (DMG p.34), so they are not counted in the month. Dwarven, gnomish and elvish experts cost more, and short-term artillerists 10% to 60% more (DMG p.30-31): enter the agreed figure in the notes.</p>');
        return box("Hirelings", hl);
    }
    function subCosts(s, r) {
        const places = ["Carried"].concat(s.lp.map(function (p) { return p[0]; }));
        if (payLoc >= places.length) payLoc = 0;
        let t = '<table class="grid"><tr><th>Monthly cost</th><th>gp</th></tr><tr><td>Henchmen (pay and maintenance you entered)</td><td>' + nf.format(r.hnPay) + "</td></tr><tr><td>Hirelings (soldiers and experts)</td><td>" + nf.format(r.hirePay) + '</td></tr><tr class="cur"><td>Total a month</td><td>' + nf.format(r.monthly) + "</td></tr></table>";
        if (canWrite) t += '<div class="addrow"><span class="lab">Pay from</span><select id="pay-loc" data-act="payloc">' + places.map(function (n, k) { return '<option value="' + k + '"' + (k === payLoc ? " selected" : "") + ">" + esc(n) + " (" + nf.format(SR.purseGp(SR.coinsAt(s, k))) + " gp)</option>"; }).join("") + '</select><button type="button" class="btn" data-act="pay-month"' + (r.monthly ? "" : " disabled") + '>Pay a month</button></div>';
        if (payNote) t += '<p class="note">' + esc(payNote) + "</p>";
        t += rules("co", '<p class="hint">Soldier and expert figures: DMG p.29-34. Henchmen: DMG p.25 puts maintenance at 100 gp per level per month, in addition to treasure shares; use the button in the henchman\'s details, or type the pay you agreed. Spies are per assignment and not in the month. Pay a month spends gold first, then silver, copper, electrum and platinum, with change in gp, sp and cp (the book gives no rule for change).</p>');
        return box("Monthly cost and pay", t);
    }
    function SG(n) { return n > 0 ? "+" + n : String(n); }
    // the drawer: one henchman's full details, sliding in from the right. Loyalty only for the GM.
    function drawerHtml(i) {
        const s = sheet, H = SR.H, x = s.hn[i], v = view.ret.hn[i], p = "hn." + i + ".", gm = isGM();
        const tokSel = '<select class="v" data-f="' + p + H.tok + '" data-t="s"' + dis() + '><option value="">(none)</option>' + toks.map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === x[H.tok] ? " selected" : "") + ">" + esc(t.name) + "</option>"; }).join("") + (x[H.tok] && !toks.some(function (t) { return t.id === x[H.tok]; }) ? '<option value="' + esc(x[H.tok]) + '" selected>(token not in this scene)</option>' : "") + "</select>";
        const open = x[H.tok] && canOpenTok(x[H.tok]) ? ' <button type="button" class="btn ghost small" data-act="hn-open" data-i="' + i + '" title="Open this henchman\'s own sheet on its token">Open sheet</button>' : "";
        let c = '<aside class="drawer' + (drawerAnim ? " slide" : "") + '" id="drawer" role="dialog" aria-label="Henchman details"><div class="dhead"><b>' + esc(x[H.nm] || "Henchman " + (i + 1)) + '</b><span>' + (canWrite ? '<button type="button" class="btn ghost small" data-act="hn-rm" data-i="' + i + '" title="Remove this henchman">Remove</button> ' : "") + '<button type="button" class="btn small" data-act="hn-close">Close</button></span></div><div class="dbody">';
        drawerAnim = false;
        c += '<div class="row2">' + fld("Name", inp(p + H.nm, { maxlen: SR.LIM.hname })) + fld("Race", inp(p + H.race, { maxlen: SR.LIM.hrace })) + "</div>";
        c += '<div class="row2">' + fld("Class", inp(p + H.cls, { maxlen: SR.LIM.hclass })) + fld("Level", inp(p + H.lv, { t: "n", min: 1, max: 30, cls: "tiny" })) + "</div>";
        c += '<div class="row2">' + fld("Hit points", inp(p + H.hp, { t: "n", cls: "tiny" })) + fld("Armour class", inp(p + H.ac, { t: "n", min: -10, max: 10, cls: "tiny" })) + "</div>";
        c += fld("Share of treasure", inp(p + H.sh, { maxlen: SR.LIM.hshare, ph: "1 share, half share" }), "What share of treasure and magic items the henchman was promised (DMG p.35)");
        c += fld("Pay a month (gp)", inp(p + H.pay, { t: "n", min: 0, cls: "coin" }) + (canWrite ? ' <button type="button" class="btn ghost small" data-act="hn-maint" data-i="' + i + '" title="DMG p.25: maintenance of henchmen 100 gp per level per month, in addition to treasure shares">DMG p.25: ' + SR.HENCH_MAINT + " x level</button>" : ""), "Counted in the monthly total");
        c += fld("Linked token", tokSel + open, "A henchman can have a full sheet on its own token. Open shows only if you may see that sheet (GM, or the player it belongs to).");
        c += fld("Notes", inp(p + H.nt, { maxlen: SR.LIM.hnote, ph: "equipment, duties, quirks" }), "", "wide");
        if (v.level) c += '<p class="note">Level note: DMG p.34 says new henchmen are normally 1st level (a PC over 6th level may draw a 2nd level one, over 11th a 3rd), and DMG p.36 says an NPC more than two levels above the PC will take only associate status. A henchman at or above your own level is outside the usual run.</p>';
        if (gm) c += '<p class="note">Loyalty: ' + loyNow(i).total + "% (GM: see Loyalty tab)</p>";
        return c + "</div></aside>";
    }
    // GM only sub-tab: every henchman's loyalty at a glance, per-row and all-at-once checks with the situation now (DMG p.37), row click edits that henchman's modifiers
    function lastCheck(i) {
        const rs = loyRes[i]; if (!rs) return '<span class="muted">not checked</span>';
        return "<b>" + rs.roll + "</b> vs " + rs.total + "%: " + (rs.held ? "holds" : "<b>FAILS</b> (" + esc(SR.LOY_CHECKS[rs.k][1]) + ")");
    }
    function subLoy(s, r) {
        if (!isGM()) return "";
        const H = SR.H;
        let c = '<p class="hint">Loyalty base is 50% plus the Charisma adjustment (DMG p.36, PHB p.13), then the modifiers chosen for each henchman (DMG p.36-37). A check rolls d100 (00 = 100): if the total is less than the roll, the figure is disloyal, disobedient or has poor morale (DMG p.36).</p>';
        if (!s.hn.length) return box("Loyalty (GM only)", c + '<p class="muted">No henchmen yet. Add them on the Henchmen tab.</p>');
        c += '<table class="grid hench loytable"><tr><th>Name</th><th>Class and level</th><th>Loyalty</th><th>Band (DMG p.36)</th><th>Last check</th><th></th></tr>';
        s.hn.forEach(function (x, i) {
            const L = loyNow(i);
            c += '<tr class="hrow' + (loyRow === i ? " sel" : "") + '" data-act="loy-open" data-i="' + i + '" title="Click to edit this henchman\'s loyalty modifiers"><td>' + esc(x[H.nm] || "Henchman " + (i + 1)) + "</td><td>" + esc(x[H.cls]) + " " + x[H.lv] + "</td><td><b>" + L.total + "%</b></td><td>" + esc(L.band[2]) + ": " + esc(L.band[3]) + "</td><td>" + lastCheck(i) + '</td><td><button type="button" class="btn ghost small" data-act="loy-check" data-i="' + i + '">Check</button></td></tr>';
        });
        c += "</table>";
        c += '<div class="addrow"><select data-act="loy-sit" title="Typical check situations and the result on a failed check, DMG p.36">' + SR.LOY_CHECKS.map(function (q, k) { return '<option value="' + k + '"' + (k === loyChk ? " selected" : "") + ">" + esc(q[0]) + "</option>"; }).join("") + '</select><button type="button" class="btn" data-act="loy-all">Check all</button></div>';
        c += '<div class="lc"><span class="lab">Situation now, applied to every check (not saved) <i>DMG p.37</i></span><div class="specs">' + SR.LOY_SITUATION.map(function (st, k) {
            const cur = loySit[k] || 0;
            return '<label class="chk">' + (st[1] ? '<input class="tiny" type="number" min="0" data-act="hn-sit" data-k="' + k + '" value="' + cur + '">' : '<input type="checkbox" data-act="hn-sit" data-k="' + k + '"' + (cur ? " checked" : "") + ">") + " " + esc(st[0]) + " <b>" + SG(st[2]) + "%</b></label>";
        }).join("") + "</div></div>";
        if (loyRow >= 0 && s.hn[loyRow]) c += loyaltyHtml(loyRow, s.hn[loyRow], "hn." + loyRow + ".");
        return box("Loyalty (GM only)", c);
    }
    function loyaltyHtml(i, x, p) {
        const s = sheet, H = SR.H, loy = loyNow(i);
        let c = '<div class="loydetail"><h4>' + esc(x[H.nm] || "Henchman " + (i + 1)) + ": " + loy.total + "% (" + esc(loy.band[2]) + ")</h4>";
        c += '<div class="lgrid">' + SR.LOY_CATS.map(function (cat, k) {
            const cur = (x[H.m] || [])[k] || 0;
            return '<label class="lc" title="' + esc(cat.p + (cat.note ? ". " + cat.note : "")) + '"><span class="lab">' + esc(cat.l) + ' <i>' + esc(cat.p) + '</i></span><select class="v" data-f="' + p + H.m + "." + k + '" data-t="n"' + dis() + '><option value="0">(none)</option>' + cat.o.map(function (o, j) { return '<option value="' + (j + 1) + '"' + (cur === j + 1 ? " selected" : "") + ">" + esc(o[0]) + " " + SG(o[1]) + "%</option>"; }).join("") + "</select></label>";
        }).join("") + "</div>";
        c += '<p class="hint">Alignment of liege (' + esc(R.ALIGN_NAMES[s.al]) + "): " + SG(SR.LOY_ALIGN[s.al]) + "% (DMG p.37), added automatically. " + esc(SR.LOY_CATS[5].note) + "</p>";
        const spSel = function (kind, list, slot) {
            const cur = (x[H.m] || [])[SR.LOY_CATS.length + slot] || 0;
            return '<label class="lc"><span class="lab">Special consideration, ' + kind + ' <i>DMG p.37</i></span><select class="v" data-f="' + p + H.m + "." + (SR.LOY_CATS.length + slot) + '" data-t="n"' + dis() + '><option value="0">(none)</option>' + list.map(function (q, k) { return '<option value="' + (k + 1) + '"' + (cur === k + 1 ? " selected" : "") + ">" + esc(q[0]) + " " + SG(q[1]) + "%</option>"; }).join("") + "</select></label>";
        };
        c += '<div class="lgrid">' + spSel("penalty", SR.LOY_PENALTY, 0) + spSel("bonus", SR.LOY_BONUS, 1) + '</div><p class="hint">Only one penalty and one bonus count, whichever of either category is the higher (DMG p.37): pick the highest that applies.</p>';
        c += '<table class="grid loytab"><tr><th>Loyalty total</th><th>%</th></tr>' + loy.parts.map(function (q) { return "<tr><td>" + esc(q.l) + "</td><td>" + SG(q.v) + "</td></tr>"; }).join("") + '<tr class="cur"><td>Total (' + esc(loy.band[2]) + ": " + esc(loy.band[3]) + ", DMG p.36)</td><td>" + loy.total + "</td></tr></table>";
        const rs = loyRes[i];
        if (rs) c += '<p class="loyres"><b>Rolled ' + rs.roll + " against " + rs.total + "%:</b> " + (rs.held ? "the henchman holds. The total is not less than the roll (DMG p.36)." : "the check FAILS: disloyal, disobedient or poor morale. Typical result when " + esc(SR.LOY_CHECKS[rs.k][0]) + ": " + esc(SR.LOY_CHECKS[rs.k][1]) + " (DMG p.36).") + "</p>";
        return c + "</div>";
    }

    /* ---------- page 5: spells ---------- */
    function pgSpells() {
        const d = view.d, s = sheet, A = d.abilities;
        if (!view.spellClasses.length) return box("Spells", '<p class="muted">' + esc(s.cl.join("/")) + " has no spells at this level. Spell-casting classes are cleric, druid, magic-user and illusionist, with paladins from 9th and rangers from 8th (PHB p.20-26).</p>");
        let h = "";
        view.spellClasses.forEach(function (c) {
            const slots = d.spellsPerDay[c], key = SR.SPELL_KEY[c], list = (typeof TreasureEngine !== "undefined" && TreasureEngine.SPELLS[key]) || {};
            const known = s.sk[c] || [], mem = s.sm[c] || [], n = Math.max(slots.length, known.length);
            let b = "";
            if (c === "Magic-User" || c === "Illusionist") b += '<p class="hint">Intelligence ' + A.int.score + ": " + A.int.learnPct + "% chance to learn a spell, " + A.int.minSpells + " to " + A.int.maxSpells + " spells per level, up to level " + A.int.maxSpellLevel + " (PHB p.10).</p>";
            if (c === "Cleric" || c === "Druid") b += '<p class="hint">Wisdom bonus spells are already in the numbers below (PHB p.11).</p>';
            if (!slots.length) b += '<p class="muted">No spells per day yet.</p>';
            for (let i = 0; i < n; i++) {
                const per = slots[i] || 0; if (!per && !(known[i] || []).length) continue;
                const k = known[i] || [], mm = mem[i] || [], over = mm.length > per;
                const opts = (list[String(i + 1)] || []).filter(function (x) { return k.indexOf(x) < 0; });
                b += '<div class="slvl"><h4>Level ' + (i + 1) + ' <span class="per">' + per + " per day</span></h4><div class=\"scols\"><div><span class=\"lab\">Known" + (c === "Magic-User" || c === "Illusionist" ? " (spell book)" : "") + "</span>" + chips(k, "sk-rm", ' data-c="' + esc(c) + '" data-l="' + i + '"');
                if (canWrite) b += '<div class="addrow"><input list="dl-' + key + "-" + i + '" id="sk-' + esc(c).replace(/\W/g, "") + "-" + i + '" placeholder="spell name" maxlength="40"><datalist id="dl-' + key + "-" + i + '">' + opts.map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("") + '</datalist><button type="button" class="btn" data-act="sk-add" data-c="' + esc(c) + '" data-l="' + i + '">Add</button></div>';
                b += '</div><div><span class="lab">Memorised' + (over ? ' <b class="up">' + mm.length + " of " + per + "</b>" : " " + mm.length + " of " + per) + "</span>" + chips(mm, "sm-rm", ' data-c="' + esc(c) + '" data-l="' + i + '"');
                if (canWrite) b += '<div class="addrow"><select id="sm-' + esc(c).replace(/\W/g, "") + "-" + i + '"><option value="">Memorise...</option>' + k.map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("") + '</select><button type="button" class="btn" data-act="sm-add" data-c="' + esc(c) + '" data-l="' + i + '">Add</button></div>';
                b += "</div></div></div>";
            }
            b += '<p class="hint">Spells per day: PHB p.20-26. Spell names: PHB p.40-42.</p>';
            h += box(esc(c) + " spells", b);
        });
        return h;
    }

    /* ---------- page 6: notes ---------- */
    function pgNotes() {
        return box("Notes", '<textarea class="notes" data-f="nt" data-t="s" data-live="1" maxlength="' + SR.LIM.text + '" rows="16"' + dis() + ' placeholder="Background, allies, quests, magic item details...">' + esc(sheet.nt) + '</textarea><p class="hint"><span id="ntc">' + sheet.nt.length + "</span> of " + SR.LIM.text + " characters. Notes live in the token metadata, which holds 16 kB in all.</p>");
    }

    /* ---------- events ---------- */
    function onChange(e) {
        const el = e.target;
        if (el.dataset.cre && creating) { cre[el.dataset.cre] = el.value; rollRandom(); paint(); return; }
        if (el.dataset.f && canWrite) {
            const t = el.dataset.t; let v = el.value;
            if (t === "n") { v = Number(v); if (isNaN(v)) v = 0; }
            setPath(el.dataset.f, v);
            if (el.dataset.f === "race") { const rc = R.RACES[v]; if (!sheet.cl.every(function (c) { return c in rc.limits; })) { /* kept: the banner will explain */ } }
            setTimeout(function () { commit(true); }, 0);
        }
        const a = el.dataset.act, hi = Number(el.dataset.i), hk = Number(el.dataset.k);
        if (a === "mv" && canWrite) {
            const to = Number(el.value); if (to >= 0) { const q = $("mvq-" + hi); SR.moveItem(sheet, hi, to, q && q.value ? Number(q.value) : 0); setTimeout(function () { commit(true); }, 0); }
        }
        if (a === "hn-sit" && isGM()) { loySit[hk] = el.type === "checkbox" ? (el.checked ? 1 : 0) : Math.max(0, Math.floor(Number(el.value)) || 0); loyRes = {}; paint(); }
        if (a === "loy-sit" && isGM()) { loyChk = Number(el.value); }
        if (a === "payloc") { payLoc = Number(el.value); }
        if (el.dataset.act === "cls" && canWrite) {
            const cl = el.value.split("/"); const old = sheet.cl.slice(), lv = sheet.lv.slice();
            sheet.cl = cl; sheet.lv = cl.map(function (c) { const i = old.indexOf(c); return i >= 0 ? lv[i] : 1; });
            setTimeout(function () { commit(true); }, 0);
        }
    }
    function onInput(e) {
        const el = e.target;
        if (el.dataset.live && canWrite) { setPath(el.dataset.f, el.value); sheet.nt = String(sheet.nt).slice(0, SR.LIM.text); const c = $("ntc"); if (c) c.textContent = el.value.length; commit(false); }
    }
    function addTo(path, val) { const a = get(path); a.push(val); }
    function onClick(e) {
        const b = e.target.closest("[data-act]"); if (!b || b.tagName === "SELECT" || b.tagName === "OPTION") return;
        const act = b.dataset.act, i = Number(b.dataset.i), c = b.dataset.c, l = Number(b.dataset.l), idv = function (x) { const el = $(x); return el ? el.value.trim() : ""; };
        if (act === "vw") { mode = b.dataset.v === "simple" ? "simple" : "full"; try { localStorage.setItem(SR.VIEW_KEY + "-" + TK.role, mode); } catch (e) { /* ignore */ } pending = null; drawer = -1; paint(); window.scrollTo(0, 0); return; }
        if (act === "tab") { tab = i; pending = null; drawer = -1; paint(); return; }
        if (act === "rsub") { rsub = i; pending = null; drawer = -1; paint(); return; }
        if (act === "hn-edit") { drawer = i; drawerAnim = true; paint(); return; }
        if (act === "hn-close") { drawer = -1; paint(); return; }
        if (act.indexOf("mk-") === 0 || act === "newchar") { if (canWrite) createAct(act); return; }
        if (act === "close") { TK.OBR.modal.close(SR.NS + "/sheet"); return; }
        if (act === "savenow") { clearTimeout(saveTimer); status = "Saving..."; updateMeter(); save(); return; }
        if (act === "export") { exportFile(); return; }
        if (act === "copyjson") { copyText(exportJson(), b); return; }
        if (act === "import") { const f = $("importFile"); f.value = ""; f.onchange = onImport; f.click(); return; }
        if (act === "hn-open") { const id = sheet.hn[i] && sheet.hn[i][SR.H.tok]; if (id && canOpenTok(id)) { (dirty ? save() : Promise.resolve()).then(function () { TK.OBR.modal.open({ id: SR.NS + "/sheet", url: pageUrl("view=sheet&item=" + encodeURIComponent(id)), width: 980, height: 940 }); }); } return; }
        if (!canWrite) return;
        if (act === "lang-add") { const v = idv("lang-sel"); if (v) { sheet.lg.push(v); commit(true); } }
        else if (act === "lang-rm") { sheet.lg.splice(i, 1); commit(true); }
        else if (act === "prof-add") { const v = idv("prof-sel"); if (v) { sheet.pf.push(v); commit(true); } }
        else if (act === "prof-rm") { sheet.pf.splice(i, 1); commit(true); }
        else if (act === "cond-add") { sheet[b.dataset.k].push(["", ""]); commit(true); }
        else if (act === "cond-rm") { sheet[b.dataset.k].splice(i, 1); commit(true); }
        else if (act === "inj-add") { sheet.ij.push(["", "", ""]); commit(true); }
        else if (act === "inj-rm") { sheet.ij.splice(i, 1); commit(true); }
        else if (act === "gear-add") { const v = idv("gear-sel"), q = Math.max(1, parseInt(idv("gear-qty"), 10) || 1); if (v) { const ex = sheet.inv.filter(function (r) { return r[0] === v && r.length === 2; })[0]; if (ex) ex[1] += q; else sheet.inv.push([v, q]); commit(true); } }
        else if (act === "gear-custom") { const n = idv("cg-n"); if (n) { const w = parseFloat(idv("cg-w")) || 0, ac = idv("cg-ac"); const row = [n, 1, w]; if (ac !== "") row.push(parseInt(ac, 10)); sheet.inv.push(row); commit(true); } }
        else if (act === "gear-rm") { sheet.inv.splice(i, 1); commit(true); }
        else if (act === "pl-add") { const n = idv("pl-new"); if (n && sheet.lp.length < SR.LIM.places) { sheet.lp.push([n, 0, 0, 0, 0, 0]); commit(true); } }
        else if (act === "pl-rm") {
            const c = SR.placeCounts(sheet, i + 1), nm = sheet.lp[i][0];
            if (!c.items && !c.coins) { SR.removePlace(sheet, i + 1); commit(true); }
            else { pending = { act: "pl-rm", i: i, yes: "Move to Carried and remove", msg: "Remove " + nm + "? Its " + c.items + " item line(s) and " + c.coins + " coin(s) will move to Carried (and add to your load)." }; paint(); }
        }
        else if (act === "yes" && pending) { const q = pending; pending = null; if (q.act === "pl-rm") SR.removePlace(sheet, q.i + 1); else if (q.act === "pay") doPay(q); commit(true); }
        else if (act === "no") { pending = null; paint(); }
        else if (act === "hn-add") { if (sheet.hn.length < SR.LIM.hench) { sheet.hn.push(SR.blankHench()); drawer = sheet.hn.length - 1; drawerAnim = true; commit(true); } }
        else if (act === "hn-rm") { sheet.hn.splice(i, 1); loyRes = {}; loyRow = -1; drawer = -1; commit(true); }
        else if (act === "hn-maint") { sheet.hn[i][SR.H.pay] = SR.HENCH_MAINT * sheet.hn[i][SR.H.lv]; commit(true); }
        else if (act === "hs-add") { if (sheet.hr.length < SR.LIM.hire) { sheet.hr.push([0, Number($("hs-sel").value), Math.max(1, parseInt(idv("hs-n"), 10) || 1), 0, ""]); commit(true); } }
        else if (act === "he-add") { if (sheet.hr.length < SR.LIM.hire) { sheet.hr.push([1, Number($("he-sel").value), Math.max(1, parseInt(idv("he-n"), 10) || 1), 0, ""]); commit(true); } }
        else if (act === "hr-rm") { sheet.hr.splice(i, 1); commit(true); }
        else if (act === "pay-month") {
            const gp = view.ret.monthly, coins = SR.coinsAt(sheet, payLoc), name = payLoc ? sheet.lp[payLoc - 1][0] : "Carried";
            if (SR.purseGp(coins) < gp) { payNote = "Not enough: " + nf.format(gp) + " gp due, " + nf.format(SR.purseGp(coins)) + " gp in " + name + "."; paint(); }
            else { pending = { act: "pay", loc: payLoc, gp: gp, yes: "Pay " + nf.format(gp) + " gp", msg: "Pay one month (" + nf.format(gp) + " gp) from the coins in " + name + "?" }; paint(); }
        }
        else if (act === "loy-check" || act === "loy-all") {
            if (!isGM()) return;
            const one = function (n) { const total = loyNow(n).total, roll = 1 + Math.floor(Math.random() * 100), res = SR.loyaltyCheck(total, roll); loyRes[n] = { roll: roll, total: total, held: res.held, k: loyChk }; };
            if (act === "loy-all") sheet.hn.forEach(function (x, n) { one(n); }); else { one(i); loyRow = i; }
            paint();
        }
        else if (act === "loy-open") { if (isGM()) { loyRow = loyRow === i ? -1 : i; paint(); } }
        else if (act === "sk-add") { const v = idv("sk-" + c.replace(/\W/g, "") + "-" + l); if (v) { grow("sk", c, l).push(v); commit(true); } }
        else if (act === "sk-rm") { const k = grow("sk", c, l), name = k[i]; k.splice(i, 1); if (k.indexOf(name) < 0) { grow("sm", c, l); SR.filterMem(sheet, c, l, function (x) { return x !== name; }); } commit(true); }
        else if (act === "sm-add") { const v = idv("sm-" + c.replace(/\W/g, "") + "-" + l); if (v) { grow("sm", c, l).push(v); commit(true); } }
        else if (act === "sm-rm") { grow("sm", c, l); SR.filterMem(sheet, c, l, function (x, k) { return k !== i; }); commit(true); }
        else if (act === "cast") { SR.toggleCast(sheet, c, l, i); commit(true); }
        else if (act === "rest") { SR.restSpells(sheet); commit(true); }
        else if (act === "ammo") { const a = SR.ammoLines(sheet)[i]; if (a) { SR.adjustAmmo(sheet, a.name, Number(b.dataset.d)); commit(true); } }
    }
    function doPay(q) {
        const name = q.loc ? sheet.lp[q.loc - 1][0] : "Carried", r = SR.payFrom(SR.coinsAt(sheet, q.loc), q.gp);
        if (!r.ok) { payNote = "Not enough coins in " + name + "."; return; }
        SR.setCoinsAt(sheet, q.loc, r.coins); payNote = "Paid " + nf.format(q.gp) + " gp from " + name + ".";
        say(payNote, "SUCCESS");
    }
    // loyalty for henchman i with this check's situation counts
    function loyNow(i) { return SR.loyalty(sheet, sheet.hn[i], view.d.abilities.cha.loyalty, loySit); }
    function grow(k, c, l) { const o = sheet[k]; if (!o[c]) o[c] = []; while (o[c].length <= l) o[c].push([]); return o[c][l]; }
    function onKey(e) {
        if (e.key !== "Enter") return;
        const el = e.target; if (el.id && /^sk-/.test(el.id)) { const b = el.closest(".addrow").querySelector("button"); if (b) b.click(); }
    }
    // players get no loyalty choices in their export (GM only); the GM export is complete
    function exportJson() {
        if (isGM()) return SR.exportText(sheet);
        const c = JSON.parse(JSON.stringify(sheet)); c.hn.forEach(function (h) { h[SR.H.m] = []; }); return SR.exportText(c);
    }
    function exportFile() {
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([exportJson()], { type: "application/json" }));
        a.download = (sheet.nm || "character").replace(/[^\w-]+/g, "_") + ".1e-sheet.json"; document.body.appendChild(a); a.click(); a.remove();
    }
    async function onImport(e) {
        const f = e.target.files[0]; if (!f) return;
        try { const s = SR.parseImport(await f.text()); if (!isGM()) s.hn.forEach(function (h, k) { const o = sheet.hn[k]; h[SR.H.m] = o && o[SR.H.nm] === h[SR.H.nm] ? o[SR.H.m] : []; }); sheet = s; commit(true); say("Imported " + (s.nm || "sheet") + ". Saving to the token.", "SUCCESS"); } catch (err) { say(err.message, "ERROR"); }
    }
    document.addEventListener("toggle", function (e) { const d = e.target; if (TK.view !== "sheet" || !d.classList) return; if (d.classList.contains("loy")) loyOpen[d.dataset.i] = d.open; else if (d.classList.contains("rules")) rulesOpen[d.dataset.k] = d.open; }, true);
    document.addEventListener("change", function (e) { if (TK.view === "sheet") onChange(e); });
    document.addEventListener("input", function (e) { if (TK.view === "sheet") onInput(e); });
    document.addEventListener("click", function (e) { if (TK.view === "sheet") onClick(e); });
    document.addEventListener("keydown", function (e) { if (TK.view === "sheet") onKey(e); });
    return { start: start, _state: function () { return { mode: mode, sheet: canSee ? sheet : null, view: canSee ? view : null, canWrite: canWrite, canSee: canSee, status: status }; } };
})();
