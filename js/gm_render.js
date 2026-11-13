"use strict";
/* gm_render.js - DOM-free renderers for the GM tabs (HTML strings and plain text). Loaded after lib/*.js.
   The encounter card and treasure renderers are adapted from ENCOUNTER_ROLLER/js/encounter.js and treasureUI.js (same studio, same rules),
   so the Encounters tab reads like the Encounter Roller. Nothing here touches document or window. */
// ----- Rendering -----
function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const ENCOUNTER_REGISTRY = {};
let encounterSeq = 0;
function registerEncounter(enc, ctx) {
    if (enc._rid && ENCOUNTER_REGISTRY[enc._rid]) { ENCOUNTER_REGISTRY[enc._rid].ctx = ctx || {}; return enc._rid; }
    const id = ++encounterSeq;
    enc._rid = id;
    ENCOUNTER_REGISTRY[id] = { enc: enc, ctx: ctx || {} };
    return id;
}

function kvGrid(rows) {
    return '<div class="card-rows">' + rows.filter(Boolean).map(function (r) {
        return '<div class="card-row-label">' + escapeHtml(r[0]) + '</div><div class="card-row-value' + (r[2] ? " " + r[2] : "") + '">' + escapeHtml(r[1]) + "</div>";
    }).join("") + "</div>";
}

function partyLinesHtml(lines) {
    return '<div class="card-special-rows">' + lines.map(function (l) { return "<div><span>" + escapeHtml(l) + "</span></div>"; }).join("") + "</div>";
}

function fortressHtml(enc, ctx) {
    const f = enc.fortress;
    let h = '<div class="card-monster-name">\u{1F3F0} Stronghold</div><div class="card-monster-sub">' + escapeHtml(f.type) + " (" + escapeHtml(f.sizeClass) + ")</div><hr class=\"card-divider\"/>";
    const rows = [["Inhabitants", f.inhabitants + (f.humanType ? ": " + f.humanType : "")], ["Visible from", f.visualRange], ["Awareness", f.awareness.text]];
    if (f.master) rows.push(["Master", f.master.class + ", level " + f.master.level + " (" + f.master.levelRange + ")"], ["Henchmen", String(f.henchmen)]);
    if (f.artillery) rows.push(["Artillery", f.artillery.ballistaeScorpions + " ballistae/scorpions, " + f.artillery.lightCatapults + " light catapults, " + f.artillery.oilCauldrons + " oil cauldrons"]);
    h += kvGrid(rows);
    if (f.garrison.length) h += '<div class="treasure-subhead">Garrison</div>' + partyLinesHtml(f.garrison.map(function (g) { return g.number + " " + g.unit; }));
    if (enc.monster) h += '<div class="treasure-subhead">Monster therein</div>' + encounterBodyHtml(enc.monster, ctx || {});
    return h;
}

function moraleBlockHtml(id, enc) {
    if (!enc.intelligent || !enc.details) return "";
    const trig = MORALE_TRIGGERS.map(function (t) { return '<option value="' + t.id + '">' + escapeHtml(t.label) + "</option>"; }).join("");
    return '<details class="treasure-details enc-morale"><summary>Morale check (DMG p.67)</summary>' +
        '<div class="enc-tools"><select data-field="trigger">' + trig + "</select>" +
        '<label>Enemy slain <input type="number" min="0" value="0" data-field="enemySlain"></label>' +
        '<label>Friends killed <input type="number" min="0" value="0" data-field="friendKilled"></label>' +
        '<label>DM % <input type="number" value="0" data-field="extra"></label>' +
        '<button type="button" class="dungeon-btn" data-act="morale" data-enc="' + id + '">Roll morale</button></div>' +
        '<div class="enc-out" data-out="morale"></div></details>';
}

function evadeBlockHtml(id, enc, ctx) {
    if (ctx.setting === "dungeon" || enc.kind === "stronghold") {
        return enc.kind === "stronghold" ? "" : '<div class="treasure-note">Underground pursuit and evasion: DMG p.67-68 (not automated).</div>';
    }
    return '<details class="treasure-details enc-evade"><summary>Flee and evade (DMG p.63, p.67-69)</summary>' +
        '<div class="enc-tools"><button type="button" class="dungeon-btn" data-act="evade" data-enc="' + id + '">Try to evade</button></div>' +
        '<div class="enc-out" data-out="evade"></div></details>';
}

// Body of a card for any encounter kind
function encounterBodyHtml(enc, ctx) {
    ctx = ctx || {};
    if (enc.kind === "stronghold") return fortressHtml(enc, ctx);
    const id = registerEncounter(enc, ctx);
    let h = "";
    if (enc.kind === "patrol") {
        const p = enc.patrol, eq = enc.equipment;
        h += '<div class="card-monster-name">\u{1F46E} Patrol</div><div class="card-monster-sub">Mounted patrol · ' + enc.number.text + " men</div><hr class=\"card-divider\"/>" +
            kvGrid([["Commander", p.commander.class + " L" + p.commander.level], ["Lieutenant", p.lieutenant.class + " L" + p.lieutenant.level],
                ["Serjeant", p.sergeant.class + " L" + p.sergeant.level], ["Spellcaster", p.spellcaster.class + " L" + p.spellcaster.level],
                ["Soldiers", String(p.soldiers)], ["1st-lvl men", String(p.firstLevelFighters)],
                ["Leaders", eq.leaders.armor + "; " + eq.leaders.weapons.join(", ")], ["Soldiers", eq.soldiers.armor.join(" or ") + "; " + eq.soldiers.weapons.join(", ")]]);
    } else if (enc.kind === "party") {
        h += '<div class="card-monster-name">Character party</div><div class="card-monster-sub">' + escapeHtml(enc.number.text) + "</div><hr class=\"card-divider\"/>" + partyLinesHtml(enc.party.lines);
    } else {
        h += '<div class="card-monster-name">' + escapeHtml(enc.name) + "</div>";
        const sub = encounterSubtitle(enc);
        if (sub) h += '<div class="card-monster-sub">' + escapeHtml(sub) + "</div>";
        h += '<hr class="card-divider"/>';
    }
    const rows = encounterRows(enc).map(function (r) { return [r[0], r[1], r[0] === "Reaction" && enc.reaction && enc.reaction.hostile ? "hostile" : ""]; });
    h += kvGrid(rows);
    if (enc.notes && enc.notes.length) h += '<div class="treasure-note">' + enc.notes.map(escapeHtml).join("<br>") + "</div>";
    if (enc.treasure && typeof renderTreasureBlock === "function") {
        const inner = renderTreasureBlock(enc.treasure);
        if (inner) h += '<details class="treasure-details"><summary>Treasure (' + escapeHtml(enc.treasure.codes || "") + ')</summary><div class="treasure-roll">' + inner + "</div></details>";
    }
    h += moraleBlockHtml(id, enc) + evadeBlockHtml(id, enc, ctx);
    return h;
}

function cardPlainText(terrain, density, period) {
    const head = period.label + " - " + terrain + " (" + (DENSITY_LABELS[density] || density) + ")";
    if (period.status === "nocheck") return head + "\nNo encounter check required this part of the day.";
    if (period.status === "clear") return head + "\n" + period.checkText + "\nNo encounter.";
    return head + "\n" + period.checkText + "\n" + encounterToText(period.encounter);
}


const TREASURE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const INDIVIDUAL_ROLL_CAP = 2000;   // total individual rolls per encounter, to keep very large crowds quick
const treasureNf = (typeof Intl !== "undefined") ? new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 }) : { format: String };

function tEsc(str) { return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function tGp(v) { return v < 1 ? treasureNf.format(v * 20) + " sp" : treasureNf.format(v) + " gp"; }

// Group letters by their multiplier: { "1": ["Q","S"], "3": ["Q"] }
function groupByMultiplier(letters, multipliers) {
    const g = {};
    letters.forEach(function (l) { const m = (multipliers && multipliers[l]) || 1; (g[m] = g[m] || []).push(l); });
    return g;
}

/* rollEncounterTreasure(details, number, inLair) -> { codes, parts: [{label, res}], notes: [] } or null.
   details.treasureParsed = { lair: [], individual: [], multipliers: {} } (monsters.js). */
function rollEncounterTreasure(details, number, inLair) {
    if (!details || typeof TreasureEngine === "undefined") return null;
    const raw = String(details.treasure || "").trim();
    if (!raw || /^nil$/i.test(raw)) return null;
    const tp = details.treasureParsed || { lair: [], individual: [], multipliers: {} };
    const out = { codes: raw, parts: [], notes: [] };
    if (!tp.lair.length && !tp.individual.length) {
        out.notes.push("Treasure: " + raw + " (see the Monster Manual entry; not rolled).");
        return out;
    }
    const n = Math.max(1, number || 1);
    const g = groupByMultiplier(tp.individual, tp.multipliers);
    Object.keys(g).forEach(function (m) {
        const rolls = Math.min(INDIVIDUAL_ROLL_CAP, n * Number(m));
        const res = TreasureEngine.generate({ types: g[m], individuals: rolls, multiplier: rolls, log: false });   // letters that are not J-N loop on multiplier
        out.parts.push({ label: "Carried: " + g[m].join(", ") + " x " + n + (Number(m) > 1 ? " (x" + m + " each)" : "") + (rolls < n * Number(m) ? " (capped at " + rolls + " rolls)" : ""), res: res });
    });
    if (tp.lair.length) {
        if (inLair) {
            const lg = groupByMultiplier(tp.lair, tp.multipliers);
            Object.keys(lg).forEach(function (m) {
                const res = TreasureEngine.generate({ types: lg[m], individuals: Number(m), multiplier: Number(m), log: false });
                out.parts.push({ label: "Lair hoard: " + lg[m].join(", ") + (Number(m) > 1 ? " (x" + m + ")" : ""), res: res });
            });
        } else {
            out.notes.push("Lair treasure (" + tp.lair.map(function (l) { return l + (tp.multipliers[l] > 1 ? " x" + tp.multipliers[l] : ""); }).join(", ") + ") is not here: not in the lair.");
        }
    }
    return out;
}

// ----- Rendering a TreasureEngine result -----
function itemHtml(it) {
    let h = "<li><b>" + tEsc(it.playerName || it.name) + "</b>";
    const bits = [];
    if (it.size) bits.push(tEsc(it.size));
    if (it.swordType) bits.push(tEsc(it.swordType));
    (it.notes || []).forEach(function (n) { if (n !== it.size && n !== it.swordType) bits.push(tEsc(n)); });
    if (bits.length) h += ' <span class="note">(' + bits.join("; ") + ")</span>";
    const val = [];
    val.push(typeof it.xp === "number" ? treasureNf.format(it.xp) + " x.p." : (it.unit ? "x.p. " + tEsc(it.unit) : "x.p. varies"));
    val.push(typeof it.gp === "number" ? treasureNf.format(it.gp) + " gp" : (it.unit ? "gp " + tEsc(it.unit) : "gp varies"));
    h += ' <span class="val">' + val.join(", ") + "</span>";
    (it.dm || []).forEach(function (d) { h += '<div class="treasure-note">' + tEsc(d) + "</div>"; });
    if (it.sword) {
        const s = it.sword;
        h += '<div class="treasure-note">Int ' + s.intelligence + ", " + tEsc(s.communication) + "; alignment " + tEsc(s.alignment) + "; ego " + s.ego + "; personality " + s.personality + "</div>";
        if (s.primary && s.primary.length) h += '<div class="treasure-note">Primary abilities: ' + s.primary.map(tEsc).join("; ") + "</div>";
        if (s.extraordinary && s.extraordinary.length) h += '<div class="treasure-note">Extraordinary powers: ' + s.extraordinary.map(tEsc).join("; ") + "</div>";
        if (s.purpose) h += '<div class="treasure-note">Special purpose: ' + tEsc(s.purpose.purpose) + "; power: " + tEsc(s.purpose.power) + "</div>";
    }
    return h + "</li>";
}

function treasureResultHtml(res) {
    const E = TreasureEngine;
    let h = "", any = false;
    const c = res.coins;
    const coins = E.COIN_KEYS.filter(function (k) { return c[k] > 0; });
    if (coins.length) {
        any = true;
        h += '<div class="card-rows">' + coins.map(function (k) { return '<div class="card-row-label">' + k.toUpperCase() + '</div><div class="card-row-value">' + treasureNf.format(c[k]) + "</div>"; }).join("") + "</div>";
        h += '<div class="treasure-note">Coins total ' + treasureNf.format(c.totalGp) + " gp</div>";
    }
    if (res.gems.count) {
        any = true;
        h += '<div class="treasure-subhead">Gems (' + res.gems.count + ")</div><ul>" + res.gems.groups.map(function (g) { return "<li>" + g.count + " x " + tGp(g.value) + (g.value !== g.base ? " (base " + tGp(g.base) + ")" : "") + "</li>"; }).join("") + "</ul>";
        h += '<div class="treasure-note">Gems total ' + treasureNf.format(res.gems.total) + " gp</div>";
    }
    if (res.jewellery.count) {
        any = true;
        h += '<div class="treasure-subhead">Jewellery (' + res.jewellery.count + ")</div><ul>" + res.jewellery.pieces.map(function (p) {
            return "<li>" + treasureNf.format(p.value) + " gp <span class=\"note\">(" + tEsc(p.kind) + (p.workmanship && p.workmanship.length ? "; " + tEsc(p.workmanship.join("; ")) : "") + ")</span></li>"; }).join("") + "</ul>";
        h += '<div class="treasure-note">Jewellery total ' + treasureNf.format(res.jewellery.total) + " gp</div>";
    }
    if (res.magic.items.length) {
        any = true;
        E.CAT_ORDER.forEach(function (cat) {
            const items = res.magic.items.filter(function (i) { return i.category === cat; });
            if (items.length) h += '<div class="treasure-subhead">' + tEsc(cat) + "</div><ul>" + items.map(itemHtml).join("") + "</ul>";
        });
        h += '<div class="treasure-note">Magic items: ' + treasureNf.format(res.magic.totalXp) + " x.p. and " + treasureNf.format(res.magic.totalGp) + " gp sale value" +
            (res.magic.unvalued ? " (" + res.magic.unvalued + " item" + (res.magic.unvalued > 1 ? "s" : "") + " priced per unit are not in the totals)" : "") + "</div>";
    }
    if (res.maps && res.maps.length) {
        any = true;
        h += '<div class="treasure-subhead">Maps</div><ul>' + res.maps.map(function (m) {
            let s = "<li><b>" + tEsc(m.name) + "</b>";
            if (m.situation) s += ' <span class="note">(treasure is ' + tEsc(m.situation) + ")</span>";
            (m.dm || []).forEach(function (d) { s += '<div class="treasure-note">' + tEsc(d) + "</div>"; });
            if (m.dmTreasure) s += "<details><summary>Treasure behind the map</summary>" + treasureResultHtml(m.dmTreasure) + "</details>";
            return s + "</li>";
        }).join("") + "</ul>";
    }
    if (!any) h += '<div class="treasure-note">Nothing rolled.</div>';
    (res.notes || []).forEach(function (n) { h += '<div class="treasure-note">' + tEsc(n) + "</div>"; });
    return h;
}

function renderTreasureBlock(t) {
    if (!t) return "";
    let h = "";
    t.parts.forEach(function (p) { h += '<div class="treasure-subhead">' + tEsc(p.label) + "</div>" + treasureResultHtml(p.res); });
    t.notes.forEach(function (n) { h += '<div class="treasure-note">' + tEsc(n) + "</div>"; });
    return h;
}

// Plain text of a treasure result (for copy)
function treasureResultText(res) {
    const E = TreasureEngine, lines = [];
    E.COIN_KEYS.forEach(function (k) { if (res.coins[k] > 0) lines.push("  " + k.toUpperCase() + ": " + treasureNf.format(res.coins[k])); });
    if (res.gems.count) lines.push("  Gems (" + res.gems.count + "): " + res.gems.groups.map(function (g) { return g.count + " x " + tGp(g.value); }).join(", "));
    if (res.jewellery.count) lines.push("  Jewellery (" + res.jewellery.count + "): " + res.jewellery.pieces.map(function (p) { return treasureNf.format(p.value) + " gp " + p.kind; }).join(", "));
    res.magic.items.forEach(function (i) { lines.push("  " + (i.playerName || i.name) + (typeof i.xp === "number" ? " (" + treasureNf.format(i.xp) + " x.p., " + (typeof i.gp === "number" ? treasureNf.format(i.gp) + " gp" : "gp varies") + ")" : "")); });
    (res.maps || []).forEach(function (m) { lines.push("  " + m.name); });
    return lines.join("\n");
}

function treasureToText(t) {
    if (!t) return "";
    const lines = [];
    t.parts.forEach(function (p) { lines.push(p.label + ":"); lines.push(treasureResultText(p.res)); });
    t.notes.forEach(function (n) { lines.push(n); });
    return lines.filter(Boolean).join("\n");
}


// ----- Treasure tab views (adapted from TREASURE_GENERATOR/index.html; DM view shows x.p., notes and sword details, player view hides them) -----
function treasureViewHtml(res, isDm) {
    const E = TreasureEngine;
    let h = "", c = res.coins, any = false;
    const coins = E.COIN_KEYS.filter(function (k) { return c[k] > 0; });
    if (coins.length) {
        any = true;
        h += "<h4>Coins</h4><ul>" + coins.map(function (k) { return "<li>" + treasureNf.format(c[k]) + " " + E.COIN_NAME[k] + " pieces</li>"; }).join("") + "</ul>";
        h += '<p class="total">Total coin value: ' + treasureNf.format(c.totalGp) + " gp</p>";
    }
    if (res.gems.count) {
        any = true;
        h += "<h4>Gems (" + res.gems.count + ")</h4><table><tr><th>Base value</th><th>Value</th><th>Stones</th></tr>" +
            res.gems.groups.map(function (g) { return "<tr><td>" + tGp(g.base) + "</td><td>" + tGp(g.value) + "</td><td>" + g.count + "</td></tr>"; }).join("") + "</table>";
        h += '<p class="total">Total gem value: ' + treasureNf.format(res.gems.total) + " gp</p>";
    }
    if (res.jewellery.count) {
        any = true;
        h += "<h4>Jewellery (" + res.jewellery.count + ")</h4><ul>" + res.jewellery.pieces.map(function (p) {
            return "<li>" + treasureNf.format(p.value) + ' gp <span class="note">(' + tEsc(p.kind) + (isDm && p.workmanship && p.workmanship.length ? "; " + tEsc(p.workmanship.join("; ")) : "") + ")</span></li>"; }).join("") +
            '</ul><p class="total">Total jewellery value: ' + treasureNf.format(res.jewellery.total) + " gp</p>";
    }
    if (res.magic.items.length) {
        any = true;
        E.CAT_ORDER.forEach(function (cat) {
            const items = res.magic.items.filter(function (i) { return i.category === cat; });
            if (items.length) h += "<h4>" + tEsc(cat) + "</h4><ul>" + items.map(function (i) { return treasureItemView(i, isDm); }).join("") + "</ul>";
        });
        h += '<p class="total">Magic items: ' + (isDm ? treasureNf.format(res.magic.totalXp) + " x.p. and " : "") + treasureNf.format(res.magic.totalGp) + " gp sale value" +
            (res.magic.unvalued ? ' <span class="note">(' + res.magic.unvalued + " item" + (res.magic.unvalued > 1 ? "s" : "") + " priced per unit are not in the totals)</span>" : "") + "</p>";
    }
    if (res.maps && res.maps.length) {
        any = true;
        h += "<h4>Maps</h4><ul>" + res.maps.map(function (m) {
            let s = "<li><b>" + tEsc(m.name) + "</b>";
            if (isDm) {
                if (m.situation) s += ' <span class="note">(treasure is ' + tEsc(m.situation) + ")</span>";
                (m.dm || []).forEach(function (d) { s += '<div class="dmnote">' + tEsc(d) + "</div>"; });
                if (m.dmTreasure) s += "<details><summary>Treasure behind the map</summary>" + treasureViewHtml(m.dmTreasure, true) + "</details>";
            }
            return s + "</li>";
        }).join("") + "</ul>";
    }
    if (!any) h += "<p>No treasure rolled.</p>";
    return h;
}
function treasureItemView(it, isDm) {
    let h = "<li><b>" + tEsc(isDm ? it.name : (it.playerName || it.name)) + "</b>";
    const bits = [];
    if (it.size) bits.push(tEsc(it.size));
    if (it.swordType) bits.push(tEsc(it.swordType));
    (it.notes || []).forEach(function (n) { if (n !== it.size && n !== it.swordType) bits.push(tEsc(n)); });
    if (bits.length) h += ' <span class="note">(' + bits.join("; ") + ")</span>";
    const val = [];
    if (isDm) val.push(typeof it.xp === "number" ? treasureNf.format(it.xp) + " x.p." : (it.unit ? "x.p. " + tEsc(it.unit) : "x.p. varies"));
    val.push(typeof it.gp === "number" ? treasureNf.format(it.gp) + " gp" : (it.unit ? "gp " + tEsc(it.unit) : "gp varies"));
    h += ' <span class="val">' + val.join(", ") + "</span>";
    if (isDm) (it.dm || []).forEach(function (d) { h += '<div class="dmnote">' + tEsc(d) + "</div>"; });
    if (isDm && it.sword) {
        const s = it.sword;
        h += '<div class="dmnote">Int ' + s.intelligence + ", " + tEsc(s.communication) + "; alignment " + tEsc(s.alignment) + "; ego " + s.ego + "; personality " + s.personality + "</div>";
        if (s.primary && s.primary.length) h += '<div class="dmnote">Primary abilities: ' + s.primary.map(tEsc).join("; ") + "</div>";
        if (s.extraordinary && s.extraordinary.length) h += '<div class="dmnote">Extraordinary powers: ' + s.extraordinary.map(tEsc).join("; ") + "</div>";
        if (s.purpose) h += '<div class="dmnote">Special purpose: ' + tEsc(s.purpose.purpose) + "; power: " + tEsc(s.purpose.power) + "</div>";
    }
    return h + "</li>";
}
function treasureCaption(res) {
    return res.hoard ? "Hoard II." + res.hoard : "Treasure types: " + res.types.join(", ") + (res.multiplier > 1 ? " (x" + res.multiplier + " lair)" : "");
}

// ----- Encounters tab: one day as plain data for the page -----
// The day at a glance: a two-row grid, the day's periods on top and each one's result below (monster, "none", or a grey dash where no check is made).
// An encounter cell scrolls to its card (id ecard-<period>). The check roll is the cell's tooltip.
function encounterShortName(enc) { return { patrol: "Patrol", stronghold: "Stronghold", party: "Party" }[enc.kind] || enc.name || "Encounter"; }
function dayGridHtml(day) {
    const ps = day.periods || []; if (!ps.length) return "";
    const head = ps.map(function (p) { return p.status === "encounter" ? '<button type="button" class="ehd go" data-goto="ecard-' + p.id + '">' + escapeHtml(p.label) + "</button>" : '<div class="ehd">' + escapeHtml(p.label) + "</div>"; }).join("");
    const cells = ps.map(function (p) {
        if (p.status === "nocheck") return '<div class="ecell na" title="No encounter check required this part of the day">&ndash;</div>';
        if (p.status === "clear") return '<div class="ecell none" title="' + escapeHtml(p.checkText || "") + '">none</div>';
        const n = encounterShortName(p.encounter);
        return '<button type="button" class="ecell hit go" data-goto="ecard-' + p.id + '" title="' + escapeHtml((p.checkText || "") + " - " + n) + '">' + escapeHtml(n) + "</button>";
    }).join("");
    return '<div class="egrid" style="--n:' + ps.length + '">' + head + cells + "</div>";
}
// only = true: the detail cards are for encounters only (the grid already says "none" or a dash for the rest)
function dayCardsHtml(day, terrain, settings, only) {
    if (!day.plan) return '<div class="empty">That mode has no table for ' + escapeHtml(terrain) + ".</div>";
    return day.periods.filter(function (p) { return !only || p.status === "encounter"; }).map(function (p) {
        let tag = p.status === "nocheck" ? "No check" : p.status === "clear" ? "Clear" : "Encounter";
        if (p.encounter) tag = { patrol: "Patrol", stronghold: "Stronghold", party: "Party" }[p.encounter.kind] || tag;
        let body;
        if (p.status === "nocheck") body = '<div class="muted">No encounter check required.</div>';
        else if (p.status === "clear") body = '<div class="muted">' + escapeHtml(p.note ? "No encounter. " + p.note : "No encounter.") + "</div>";
        else { p.encounter.terrain = terrain; body = encounterBodyHtml(p.encounter, { terrain: terrain, light: p.light, setting: "outdoor" }); }
        return '<div class="ecard status-' + p.status + '" id="ecard-' + p.id + '"><div class="ehead"><span>' + escapeHtml(p.label) + '</span><span class="etag">' + tag + "</span></div>" +
            '<div class="ebody">' + body + "</div></div>";
    }).join("");
}
