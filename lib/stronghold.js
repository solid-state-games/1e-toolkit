// SHARED COPY of ENCOUNTER_ROLLER/js/stronghold.js: edit the master there, then run TOOLS/sync_lib.py
"use strict";
/* ============================================================
   Strongholds in uninhabited areas (DMG p.182-184). DOM-free; uses MONSTER_TABLES.castle.
   Inhabited areas never roll a stronghold: their fortresses are placed by the DM (DMG p.182).
   ============================================================ */

// "9th-12th" -> {min:9,max:12}; "14th" -> {min:14,max:14}
function parseLevelRange(text) {
    const nums = String(text).match(/\d+/g) || [];
    const min = parseInt(nums[0], 10), max = parseInt(nums[nums.length - 1], 10);
    return { min: min, max: max };
}

function rollRows(rows, die) {
    const r = rollDice(1, die || 100);
    return rows.find(function (e) { return r >= e.roll[0] && r <= e.roll[1]; });
}

// Fortress type -> artillery row (DMG p.183). The table has no row for a "Concentric castle" size, so Medium concentric is
// used; "Fortress complex" and "Large walled castle" use Large castle.
function artilleryFor(type) {
    const map = {
        "Small shell keep": "Shell keep", "Large shell keep": "Shell keep", "Tower": "Tower", "Moat house or friary": "Moat house",
        "Small walled castle with keep": "Small castle", "Medium walled castle with keep": "Medium castle",
        "Concentric castle": "Medium concentric castle", "Large walled castle with keep": "Large castle", "Fortress complex": "Large castle"
    };
    const name = map[type];
    return MONSTER_TABLES.castle.artillery.find(function (a) { return a.fortress === name; }) || null;
}

// Visual range in miles, "1/2 to 5 miles depending upon terrain" (DMG p.182). Studio guess per terrain.
const STRONGHOLD_VISUAL_RANGE = {
    plains: "5 miles", desert: "5 miles", hills: "3 miles", mountains: "3 miles", scrub: "2 miles", rough: "2 miles",
    marsh: "1 mile", forest: "1/2 mile"
};

/* stronghold(terrain) -> { sizeClass, type, kind, inhabitants, humanType (MM key), master {class, level, levelRange},
   henchmen (2-5), garrison [{unit, number}], artillery, visualRange, awareness {die, known, outside, text}, notes [] }
   kind is one of TOTALLY_DESERTED, DESERTED_MONSTER, HUMANS, CHARACTER_TYPES. A deserted-with-monster stronghold needs
   a monster rolled on the outdoor table ignoring men: the caller does that (kind DESERTED_MONSTER). */
function stronghold(terrain) {
    const C = MONSTER_TABLES.castle;
    const st = rollRows(C.sizeAndType);
    const sizeKey = st.size.toLowerCase();
    const inh = rollRows(C.inhabitants[sizeKey]);
    const out = {
        sizeClass: st.size, type: st.type, kind: inh.type, inhabitants: inh.label,
        humanType: null, master: null, henchmen: null, garrison: [], artillery: artilleryFor(st.type),
        visualRange: STRONGHOLD_VISUAL_RANGE[terrain] || "1/2 to 5 miles", awareness: null, notes: []
    };
    if (inh.type === "HUMANS") {
        out.humanType = rollRows(C.humans).type;
    } else if (inh.type === "CHARACTER_TYPES") {
        const m = rollRows(C.characters);
        const range = parseLevelRange(m.level);
        out.master = { class: m.class, levelRange: m.level, level: rollDice(range.min, range.max) };
        out.henchmen = rollDice(2, 5);
        C.garrison.forEach(function (g) {
            const range2 = String(g.number).split("-");
            out.garrison.push({ unit: g.unit, number: rollDice(parseInt(range2[0], 10), parseInt(range2[1], 10)) });
        });
        out.notes.push("Each garrison unit is led by a fighter of 3rd or 4th level, in addition to the figures shown. Henchmen levels and the master's magic items: Character Subtable (DMG p.175-176), not rolled here.");
        if (m.class === "Illusionist") out.notes.push("Illusionist strongholds are often covered by an illusion (a mound of rock, a ruin or a huge castle).");
        if (m.class === "Monk") out.notes.push("Monk strongholds are usually monasteries, resembling an enlarged moat house.");
    }
    // Awareness (DMG p.183): roll a surprise die for the party. If the party is surprised (1-2) the occupants know they are
    // there; if the surprise value is 2 or greater the occupants are actually outside, within normal surprise distance.
    const die = rollDice(1, 6);
    const known = die <= 2, outside = known && die >= 2;
    out.awareness = { die: die, known: known, outside: outside,
        text: "Surprise die " + die + ": " + (known ? "the occupants know the party is there" + (outside ? " and are outside, within normal surprise distance" : "") :
              "the party has not been detected; it may pass by or investigate") + "." };
    return out;
}

if (typeof window !== 'undefined') window.stronghold = stronghold;
