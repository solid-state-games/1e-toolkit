"use strict";
/* foe_ui.js - the GM's foe mini sheet (modal, view=foe). Opens from the token's right-click "Foe sheet" or the Monsters tab.
   Stats come from the Monster Manual entry matching the token name (CombatState.monsterOf); every field can be overridden per token.
   Stored on the token in `cs` (GM only): h = [hp, max] (shared with combat), fo = overrides, fn = notes. Combat rolls still read the MM entry.
   OBR calls used: scene.items.getItems/updateItems/onChange (SDK 3.1.0). */
const FoeUI = (function () {
    const CS = CombatState;
    const FIELDS = [["ac", "Armour class", function (d) { return d.ac; }], ["mv", "Move", function (d) { return d.move; }], ["hd", "Hit dice", function (d) { return d.hitDice; }],
        ["at", "Attacks", function (d) { return d.attacks; }], ["dm", "Damage", function (d) { return d.damage; }], ["mr", "Magic resistance", function (d) { return d.magicResistance; }],
        ["al", "Alignment", function (d) { return d.alignment; }], ["sz", "Size", function (d) { return d.size; }], ["xp", "XP value", function (d) { return d.xp && d.xp.text; }],
        ["sa", "Special attacks", function (d) { return d.specialAttacks; }, 1], ["sd", "Special defences", function (d) { return d.specialDefences; }, 1]];
    let id = "", item = null, root = null;
    const csOf = function () { return (item && (item.metadata || {})[CS.CS]) || {}; };
    const mm = function () { const m = CS.monsterOf(item.name); return m ? m.d : null; };

    async function start(itemId) {
        id = itemId; root = $("app");
        if (TK.role !== "GM") { root.innerHTML = '<div class="notice"><h2>GM only</h2><p>Foe sheets are for the GM.</p></div>'; return; }
        if (!(await load())) return;
        root.addEventListener("change", onChange); root.addEventListener("click", onClick);
        TK.OBR.scene.items.onChange(async function () { const a = document.activeElement; if (a && root.contains(a) && /INPUT|TEXTAREA/.test(a.tagName)) return; await load(); });
    }
    async function load() {
        const f = await TK.OBR.scene.items.getItems([id]);
        if (!f.length) { root.innerHTML = '<div class="notice"><h2>Token not found</h2><p>That token is no longer on this scene.</p></div>'; return false; }
        item = f[0]; paint(); return true;
    }
    function paint() {
        const d = mm(), cs = csOf(), fo = cs.fo || {}, h = cs.h || ["", ""], m = CS.monsterOf(item.name);
        let s = '<div class="foe"><h1>' + esc(item.name || "Unnamed token") + '</h1><p class="sub">' + (m ? esc(m.key) + " &middot; " + esc(d.page) : "No Monster Manual match for this token name: fill in the fields yourself") + "</p>";
        if ((item.metadata || {})[SheetRules.KEY]) s += '<p class="banner warn">This token has a character sheet. Use the sheet instead.</p>';
        s += '<div class="foehp"><b>HP</b> <input type="number" data-hp="0" value="' + esc(h[0]) + '" aria-label="Hit points now"> / <input type="number" data-hp="1" value="' + esc(h[1]) + '" aria-label="Hit points full"> <button type="button" class="btn ghost small" data-act="rollhp" title="Roll the hit dice (d8 each)">Roll from HD</button></div>';
        s += '<div class="foegrid">' + FIELDS.map(function (f) {
            const base = d ? f[2](d) : "", v = fo[f[0]] !== undefined ? fo[f[0]] : base === undefined || base === null ? "" : base;
            return '<label' + (f[3] ? ' class="wide"' : "") + ">" + f[1] + '<input data-fo="' + f[0] + '" value="' + esc(v) + '"></label>'; }).join("") + "</div>";
        if (d) s += '<p class="hint">' + ["noAppearing", "frequency", "treasure", "intelligence", "psionics"].map(function (k) { return d[k] ? esc({ noAppearing: "No. appearing", frequency: "Frequency", treasure: "Treasure", intelligence: "Intelligence", psionics: "Psionics" }[k]) + " " + esc(d[k]) : ""; }).filter(Boolean).join(" &middot; ") + "</p>";
        s += '<label class="lab">GM notes</label><textarea data-note="1" aria-label="GM notes">' + esc(cs.fn || "") + "</textarea>";
        root.innerHTML = s + '<p class="hint">Stats are the Monster Manual figures for this token\'s name; a change here is for this token only. Combat rolls still use the Monster Manual entry.</p></div>';
    }
    function patch(fn) { return TK.OBR.scene.items.updateItems([id], function (d) { const cs = Object.assign({}, d[0].metadata[CS.CS] || {}); fn(cs); d[0].metadata[CS.CS] = cs; }).then(load).catch(function (e) { say(e.message, "ERROR"); }); }
    function onChange(e) {
        const t = e.target;
        if (t.dataset.hp !== undefined) {
            const a = root.querySelector('[data-hp="0"]').value, b = root.querySelector('[data-hp="1"]').value;
            if (a === "" && b === "") return patch(function (cs) { delete cs.h; });
            const mx = Number(b === "" ? a : b), now = Number(a === "" ? mx : a); patch(function (cs) { cs.h = [now, mx]; });
        } else if (t.dataset.fo) {
            const f = FIELDS.filter(function (x) { return x[0] === t.dataset.fo; })[0], d = mm(), base = d ? f[2](d) : "", v = t.value.trim();
            patch(function (cs) { cs.fo = Object.assign({}, cs.fo || {}); if (v === "" || v === String(base)) delete cs.fo[f[0]]; else cs.fo[f[0]] = v.slice(0, 120); if (!Object.keys(cs.fo).length) delete cs.fo; });
        } else if (t.dataset.note) patch(function (cs) { if (t.value.trim()) cs.fn = t.value.slice(0, 1000); else delete cs.fn; });
    }
    function onClick(e) {
        if (!e.target.closest('[data-act="rollhp"]')) return;
        const d = mm(), fo = csOf().fo || {}, h = CS.rollHd(fo.hd || (d && d.hitDice) || "");
        if (!h) { say("No hit dice to roll: type the hit points.", "WARNING"); return; }
        patch(function (cs) { cs.h = h; });
    }
    return { start: start };
})();
