// SHARED COPY of ENCOUNTER_ROLLER/js/troopBuilders.js: edit the master there, then run TOOLS/sync_lib.py
"use strict";
/* ============================================================
   Patrols (DMG p.182) and character parties (DMG p.175, p.186 note). DOM-free.
   ============================================================ */

const PATROL_TABLES = {
    leadership: {
        commander:  { class: "Fighter", level: function () { return rollDice(6, 8); } },   // 6th-8th
        lieutenant: { class: "Fighter", level: function () { return rollDice(4, 5); } },   // 4th-5th
        sergeant:   { class: "Fighter", level: function () { return rollDice(2, 3); } }    // 2nd-3rd
    },
    composition: {
        soldiers:   function () { return rollDice(13, 24); },       // 13-24 men-at-arms
        firstLevel: function () { return rollDice(3, 4); },         // 3-4 first level men
        spellcaster: {
            type: function () { return rollDice(1, 100) <= 40 ? "Cleric" : "Magic-User"; },   // cleric 40%, magic-user 60%
            level: {
                "Cleric": function () { return rollDice(6, 7); },
                "Magic-User": function () { return rollDice(5, 8); }
            }
        }
    },
    equipment: {
        leaders:  { armor: "Plate mail", weapons: ["shield", "lance", "flail", "long sword"] },
        soldiers: { armor: ["chain mail", "scale mail"], weapons: ["shield", "bow or light crossbow", "hand weapon"] }
    }
};

function generatePatrol() {
    const t = PATROL_TABLES;
    const patrol = {
        commander: { class: t.leadership.commander.class, level: t.leadership.commander.level() },
        lieutenant: { class: t.leadership.lieutenant.class, level: t.leadership.lieutenant.level() },
        sergeant: { class: t.leadership.sergeant.class, level: t.leadership.sergeant.level() },
        soldiers: t.composition.soldiers(),
        firstLevelFighters: t.composition.firstLevel()
    };
    const type = t.composition.spellcaster.type();
    patrol.spellcaster = { class: type, level: t.composition.spellcaster.level[type]() };
    patrol.mounted = true;
    patrol.total = 3 + patrol.soldiers + patrol.firstLevelFighters + 1;
    patrol.notes = ["Racial composition appropriate to the area; always mounted unless terrain or culture prevents it; leaders ride warhorses (DMG p.182).",
        "Magic items: Character Subtable, Party Magic Items (DMG p.175-176), not rolled here."];
    return patrol;
}

/* ---- Character parties ---- */

// Character Subtable (DMG p.175), from DUNGEON_TABLES.subtables.character
function characterSubtable() {
    return DUNGEON_TABLES.subtables.character;
}

function rollCharacterClass(party, avoid) {
    const rows = characterSubtable();
    for (let tries = 0; tries < 200; tries++) {
        const r = rollDice(1, 100);
        const row = rows.find(function (e) { return r >= e.roll[0] && r <= e.roll[1]; });
        if (!row) continue;
        let cls = row.type;
        if (row.oneOf) cls = row.oneOf[rollDice(1, row.oneOf.length) - 1];
        const used = party.filter(function (c) { return c === cls; }).length;
        if (used >= row.max) continue;                      // class maximum per party
        if (avoid && avoid(cls)) continue;                  // contradictory result, ignored (DMG p.175)
        return cls;
    }
    return "Fighter";
}

// A paladin and an assassin cannot be in one party (DMG p.175 example)
function incompatibleInParty(cls, party) {
    if (cls === "Paladin" && party.indexOf("Assassin") >= 0) return true;
    if (cls === "Assassin" && party.indexOf("Paladin") >= 0) return true;
    return false;
}

/* Henchman level. Dungeon (DMG p.175): one-third of the master's level, fractions below one-half dropped, plus 1 per 3
   levels of the master above 8th. Wilderness (DMG p.186 note): approximately one-half (round up). */
function henchmanLevel(masterLevel, wilderness) {
    if (wilderness) return Math.ceil(masterLevel / 2);
    const third = masterLevel / 3;
    let base = Math.floor(third);
    if (third - base >= 0.5) base += 1;
    const bonus = masterLevel > 8 ? Math.floor(masterLevel / 3) : 0;
    return Math.max(1, base + bonus);
}

/* buildCharacterParty({ setting: 'wilderness'|'dungeon', dungeonLevel, monsterLevel })
   2-5 characters (d4+1), class by the Character Subtable (class maxima, contradictory results ignored), rounded out to 9
   with men-at-arms (dungeon levels 1-3 only) or henchmen. Level: dungeon = dungeon or monster level through 4th, then d6+6
   adjusted one step toward the dungeon level, not above 12 unless dungeon level 16+ (DMG p.175). Wilderness: 7th-10th,
   90% mounted (DMG p.186 note). */
function buildCharacterParty(opts) {
    opts = opts || {};
    const wilderness = opts.setting === 'wilderness';
    const dl = opts.dungeonLevel || 1;
    const ml = opts.monsterLevel || 1;
    const n = rollDice(1, 4) + 1;
    const classes = [];
    const members = [];
    for (let i = 0; i < n; i++) {
        const cls = rollCharacterClass(classes, function (c) { return incompatibleInParty(c, classes); });
        classes.push(cls);
        let level;
        if (wilderness) level = rollDice(7, 10);
        else {
            const top = Math.max(dl, ml);
            if (top <= 4) level = top;
            else {
                level = rollDice(1, 6) + 6;
                if (level > dl) level -= 1;
                else if (level < dl) level += 1;
                if (dl < 16 && level > 12) level = 12;
            }
        }
        members.push({ cls: cls, level: level, mounted: wilderness ? rollDice(1, 100) <= 90 : false, henchmen: [] });
    }
    const followers = 9 - n;
    const menAtArmsOk = !wilderness && dl <= 3;
    const followerKind = menAtArmsOk ? "man-at-arms" : "henchman";
    for (let f = 0; f < followers; f++) {
        const master = members[f % n];
        if (menAtArmsOk) {
            master.henchmen.push({ kind: followerKind, cls: "Man-at-arms", level: 0 });
        } else {
            let cls = "Fighter";
            const lvl = henchmanLevel(master.level, wilderness);
            for (let tries = 0; tries < 100; tries++) {
                const c = rollCharacterClass([], null);
                const bad = (c === "Paladin" && (master.cls === "Thief" || master.cls === "Assassin")) ||
                            (c === "Assassin" && master.cls === "Paladin") || (c === "Ranger" && lvl < 8);
                if (!bad) { cls = c; break; }
            }
            master.henchmen.push({ kind: followerKind, cls: cls, level: henchmanLevel(master.level, wilderness),
                mounted: wilderness ? rollDice(1, 100) <= 90 : false });
        }
    }
    const lines = members.map(function (m, i) {
        let s = (i + 1) + ". " + m.cls + ", level " + m.level;
        if (wilderness) s += m.mounted ? ", mounted (" + (m.cls === "Fighter" || m.cls === "Paladin" || m.cls === "Ranger" ? "lance, warhorse" : "warhorse") + ")" : ", afoot" + (m.cls === "Fighter" ? " (spear)" : "");
        if (m.henchmen.length) {
            const counts = {};
            m.henchmen.forEach(function (h) { const k = h.level ? h.cls + " " + h.level : h.cls; counts[k] = (counts[k] || 0) + 1; });
            s += "; with " + Object.keys(counts).map(function (k) { return counts[k] + " " + k; }).join(", ");
        }
        return s;
    });
    return {
        setting: wilderness ? 'wilderness' : 'dungeon', members: members, total: 9, lines: lines,
        notes: [wilderness
            ? "Typical party of dungeon characters, 90% mounted (warhorses where applicable), 7th-10th level, henchmen about half level rounded up; fighters mounted carry lances, those afoot spears (DMG p.186 note)."
            : "Character Subtable (DMG p.175). Alignments must be compatible; abilities per the Personae of Non-Player Characters; party magic items by level (DMG p.175-176) are not rolled here."]
    };
}

function characterPartyText(party) {
    return party.lines.join("\n");
}

if (typeof window !== 'undefined') { window.generatePatrol = generatePatrol; window.buildCharacterParty = buildCharacterParty; }
