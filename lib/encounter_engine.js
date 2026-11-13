// SHARED COPY of ENCOUNTER_ROLLER/js/encounter_engine.js: edit the master there, then run TOOLS/sync_lib.py
"use strict";
/* ============================================================
   Encounter flow and resolution (AD&D 1e RAW). DOM-free, shared with other apps (TURNMASTER) via TOOLS/sync_lib.py; so that
   test/flow.test.js can run it in node. Cards are rendered by encounter.js.
   Sources: DMG p.47-49 (outdoor checks, distance, confrontation), p.62-63 (surprise, distance, reactions),
   p.182-192 (patrols, strongholds, mode tables), MM p.5 (number appearing, % in lair).
   Data: MONSTER_TABLES (encounterTables.js), DUNGEON_TABLES (dungeonTables.js), MONSTER_DETAILS (monsters.js).
   ============================================================ */

// ----- Dice -----
let RNG = Math.random;
function setRng(fn) { RNG = fn || Math.random; }
function rollDie(sides) { return Math.floor(RNG() * sides) + 1; }
// Uniform integer min..max (a MM number-appearing range is a plain range, so Merchant 50-300 and 2-8 are not dice sums)
function rollDice(min, max) {
    if (typeof min !== 'number' || typeof max !== 'number' || isNaN(min) || isNaN(max)) return 1;
    if (min > max) { const t = min; min = max; max = t; }
    return min + Math.floor(RNG() * (max - min + 1));
}
function pickRow(rows, roll) {
    return rows.find(function (e) { return e.roll && e.roll[0] <= roll && e.roll[1] >= roll; }) || null;
}

// ----- Constants -----
// Density to encounter die: DMG p.47 (dense 1 in 20, moderate/patrolled 1 in 12, uninhabited/wilderness 1 in 10)
const ENCOUNTER_CHANCES = { high: 10, medium: 12, low: 20 };
const DENSITY_LABELS = { high: "Wilderness (1-in-10)", medium: "Patrolled (1-in-12)", low: "Dense (1-in-20)" };

// Time check matrix, DMG p.47 (true = check). Rough has no row in the book: it is given the scrub row (house assumption).
const TIME_CHECKS = {
    plains:    { morning: true,  noon: false, evening: true,  night: false, midnight: true,  predawn: false },
    scrub:     { morning: true,  noon: false, evening: true,  night: true,  midnight: false, predawn: true },
    forest:    { morning: true,  noon: true,  evening: true,  night: true,  midnight: true,  predawn: true },
    desert:    { morning: true,  noon: false, evening: false, night: true,  midnight: false, predawn: true },
    hills:     { morning: false, noon: true,  evening: false, night: true,  midnight: false, predawn: true },
    mountains: { morning: true,  noon: false, evening: false, night: true,  midnight: false, predawn: false },
    marsh:     { morning: true,  noon: true,  evening: true,  night: true,  midnight: true,  predawn: true },
    rough:     { morning: true,  noon: false, evening: true,  night: true,  midnight: false, predawn: true }
};
const DAY_PERIODS = ["morning", "noon", "evening", "night", "midnight", "predawn"];
const TIME_OF_DAY_META = {
    morning:  { icon: "\u{1F305}", label: "Morning" },
    noon:     { icon: "\u{1F31E}", label: "Noon" },
    evening:  { icon: "\u{1F307}", label: "Evening" },
    night:    { icon: "\u{1F319}", label: "Night" },
    midnight: { icon: "\u{1F30C}", label: "Midnight" },
    predawn:  { icon: "\u{1F32B}️", label: "Pre-Dawn" }
};
const LAND_TERRAINS = ["plains", "scrub", "forest", "rough", "hills", "mountains", "desert", "marsh"];

// Modes (MONSTER_TABLES.modes). Source modes replace the outdoor tables and are exclusive; airborne and psionic are procedures.
const LAND_MODES = ["arctic", "subArctic", "sylvan", "pleistocene", "dinosaurAge", "tropical"];
const WATER_MODES = ["freshWater", "saltWater", "underwater"];
const PLANE_MODES = ["astral", "ethereal"];
const CITY_MODES = ["cityDay", "cityNight"];
const SOURCE_MODES = LAND_MODES.concat(WATER_MODES, PLANE_MODES, CITY_MODES);
const FLAG_MODES = ["airborne", "psionic"];
// Short button labels (the full DMG heading is in MONSTER_TABLES.modes[x].label and the tooltip)
const MODE_SHORT = {
    arctic: "Arctic", subArctic: "Sub-Arctic", sylvan: "Sylvan", pleistocene: "Pleistocene", dinosaurAge: "Dinosaur Age", tropical: "Tropical",
    freshWater: "Fresh Water", saltWater: "Salt Water", underwater: "Underwater", airborne: "Airborne", astral: "Astral", ethereal: "Ethereal",
    psionic: "Psionic", cityDay: "City (Day)", cityNight: "City (Night)"
};

function activeSourceMode(modes) {
    return SOURCE_MODES.find(function (m) { return (modes || []).indexOf(m) >= 0; }) || null;
}
// Terrain keys a mode (or null = temperate) offers
function modeTerrains(mode) {
    if (!mode) return LAND_TERRAINS.slice();
    const m = MONSTER_TABLES.modes[mode];
    return m ? Object.keys(m.terrains) : [];
}

// ----- Settings -----
function defaultSettings() {
    return {
        modes: [], density: "high", bellCurve: true, partyNumber: 10, partyHD: 10, partyRace: "human", charisma: 10, partyAlignment: "N",
        mount: "none", encumbrance: "normal", reactionMod: 0, waterClimate: "cool", waterNearby: "auto", brightMoon: false,
        dungeonLevel: 1, lightRadius: 0
    };
}
function mergeSettings(s) { return Object.assign(defaultSettings(), s || {}); }

// ----- Name resolution -----
const GENERIC_PICKS = {
    "Demon": ["Demon, type I", "Demon, type II", "Demon, type III", "Demon, type IV", "Demon, type V", "Demon, type VI"],
    "Demon, minor": ["Demon, type I", "Demon, type II", "Demon, type III"],
    "Demon, major": ["Demon, type IV", "Demon, type V", "Demon, type VI"],
    "Demon, prince": ["Demon, demogorgon", "Demon, juiblex", "Demon, orcus", "Demon, yeenoghu"],
    "Devil": ["Devil, lemure", "Devil, barbed", "Devil, bone", "Devil, erinyes", "Devil, horned", "Devil, ice", "Devil, pit fiend"],
    "Devil, lesser": ["Devil, lemure", "Devil, barbed", "Devil, bone", "Devil, erinyes"],
    "Devil, greater": ["Devil, horned", "Devil, ice", "Devil, pit fiend"],
    "Devil, arch-devil": ["Devil, asmodeus", "Devil, baalzebul", "Devil, dispater", "Devil, geryon"],
    "Elemental": ["Elemental, air", "Elemental, earth", "Elemental, fire", "Elemental, water"]
};
// DMG p.174: results calling for module D3 monsters are ignored (roll again) when the module is not used
const IGNORED_NAMES = /^(Mezzodaemon|Nycadaemon)$/;

// -> { key, details } or null when the name is not a Monster Manual monster (NPC types, class names)
function lookupMonster(name) {
    if (GENERIC_PICKS[name]) {
        const opts = GENERIC_PICKS[name];
        name = opts[rollDice(1, opts.length) - 1];
    }
    if (MONSTER_DETAILS[name]) return { key: name, details: MONSTER_DETAILS[name] };
    const alias = MONSTER_ALIASES[name];
    if (alias && MONSTER_DETAILS[alias]) return { key: alias, details: MONSTER_DETAILS[alias] };
    return null;
}

function isIntelligentDetails(details) {
    if (!details) return true;                    // NPC types and parties talk
    const r = details.intelligenceRank;
    return r === null || r === undefined || r >= 3; // low or better; "See below" counts as intelligent
}

// ----- Context and table rolling -----
function newCtx(settings, terrain, extra) {
    return Object.assign({ settings: mergeSettings(settings), terrain: terrain, trace: [], errors: [], notes: [], dungeon: null,
        ignoreMen: false, label: "" }, extra || {});
}

function isWarmWater(ctx) { return ctx.settings.waterClimate === "warm" || ["tropical", "dinosaurAge"].indexOf(activeSourceMode(ctx.settings.modes)) >= 0; }
function isFreshWater(ctx) {
    const src = activeSourceMode(ctx.settings.modes);
    return src === "freshWater" || /^fresh/.test(ctx.terrain || "");
}
function isDeepWater(ctx) { return /deep|largeBody/i.test(ctx.terrain || ""); }
function waterNearby(ctx) {
    const w = ctx.settings.waterNearby;
    if (w === "yes") return true;
    if (w === "no") return false;
    return ctx.terrain === "marsh" || WATER_MODES.indexOf(activeSourceMode(ctx.settings.modes)) >= 0;
}

function rowAllowed(row, ctx) {
    if (row.only === "cool" && isWarmWater(ctx)) return false;
    if (row.only === "warm" && !isWarmWater(ctx)) return false;
    if (row.only === "deep" && !isDeepWater(ctx)) return false;
    if (row.only === "water" && !waterNearby(ctx)) return false;
    // Dinosaur subtable: "in fresh water only in a relatively warm clime"
    if (row.notes && /fresh water/.test(row.notes) && /warm/.test(row.notes) && isFreshWater(ctx) && !isWarmWater(ctx)) return false;
    return true;
}

// Roll one row. ROLL_AGAIN rows, out-of-climate rows and gaps roll again.
function rollRow(rows, die, ctx, label) {
    for (let tries = 0; tries < 400; tries++) {
        const r = rollDice(1, die);
        let row = pickRow(rows, r);
        if (!row) { ctx.errors.push("gap at " + r + " in " + (label || "table")); continue; }
        if (row.type === "ROLL_AGAIN" || !rowAllowed(row, ctx)) { ctx.trace.push((label || "") + " " + r + ": roll again"); continue; }
        if (row.maxDungeonLevel && ctx.dungeon && ctx.dungeon.dungeonLevel > row.maxDungeonLevel) {
            const sub = rows.find(function (x) { return x.type === row.thereafter; });
            ctx.trace.push((label || "") + " " + r + ": " + row.type + " not met below level " + row.maxDungeonLevel + ", treated as " + row.thereafter);
            if (sub) row = sub;
        } else {
            ctx.trace.push((label || "") + " " + r + ": " + (row.oneOf ? row.oneOf.join(" or ") : row.type));
        }
        return row;
    }
    ctx.errors.push("no usable row in " + (label || "table"));
    return null;
}

function subtableRows(name, terrainKey, ctx) {
    if (ctx.dungeon) {
        if (name === "dragon") return DUNGEON_TABLES.subtables.dragon[ctx.dungeon.monsterLevelName] || null;
        if (name === "human") return DUNGEON_TABLES.subtables.human || null;
    }
    const sub = MONSTER_TABLES.subtables[name];
    if (!sub) return null;
    return sub[terrainKey] || sub.any || null;
}

function weightedPick(row) {
    const list = row.oneOf;
    if (!row.weights) return list[rollDice(1, list.length) - 1];
    let r = rollDice(1, row.weights.reduce(function (a, b) { return a + b; }, 0));
    for (let i = 0; i < list.length; i++) { r -= row.weights[i]; if (r <= 0) return list[i]; }
    return list[list.length - 1];
}

// Expand a row to a pick: { kind: 'monster'|'party'|'none', name, row, via: [subtable names] } or "again"
function expandRow(row, ctx, depth) {
    const t = row.type;
    if (/^SUBTABLE:/.test(t)) {
        const sub = t.slice(9);
        if (ctx.ignoreMen && sub === "men") return "again";
        const rows = subtableRows(sub, ctx.terrain, ctx);
        if (!rows) { ctx.errors.push("no " + sub + " subtable for " + ctx.terrain); return "again"; }
        if (depth > 5) { ctx.errors.push("subtable loop"); return "again"; }
        const r2 = rollRow(rows, 100, ctx, sub);
        if (!r2) return "again";
        const p = expandRow(r2, ctx, depth + 1);
        if (p === "again") return p;
        p.via = [sub].concat(p.via || []);
        if (row.noAppearing && !p.row.noAppearing) p.parentNumber = row.noAppearing;
        p.parentRow = row;
        return p;
    }
    if (t === "CHARACTER_PARTY") { return ctx.ignoreMen ? "again" : { kind: "party", name: "Character party", row: row, via: [] }; }
    if (t === "NO_ENCOUNTER") return { kind: "none", name: "", row: row, via: [], reason: "no encounter on this table result" };
    if (/^(PATROL|STRONGHOLD|ENCOUNTER)$/.test(t)) return { kind: t.toLowerCase(), name: t, row: row, via: [] };
    let name = row.oneOf ? weightedPick(row) : t;
    if (IGNORED_NAMES.test(name)) { ctx.trace.push(name + " (module D3): roll again, DMG p.174"); return "again"; }
    if (ctx.ignoreMen && /^Men, /.test(name)) return "again";
    // DMG p.185 notes: 10% of uninhabited Jackal results are jackalwere, 10% of Ogre results are ogre magi
    if (row.notes && /10% of these encounters are jackalwere/.test(row.notes) && rollDice(1, 100) <= 10) { name = "Jackalwere"; ctx.trace.push("10% jackalwere"); }
    if (row.notes && /10% of these encounters are ogre magi/.test(row.notes) && rollDice(1, 100) <= 10) { name = "Ogre mage"; ctx.trace.push("10% ogre magi"); }
    return { kind: "monster", name: name, row: row, via: [] };
}

function rollPick(rows, ctx, label) {
    for (let tries = 0; tries < 400; tries++) {
        const row = rollRow(rows, 100, ctx, label);
        if (!row) return null;
        const p = expandRow(row, ctx, 0);
        if (p !== "again") return p;
    }
    ctx.errors.push("no pick in " + label);
    return null;
}

// ----- Table selection (outdoor and modes) -----
function selectTable(settings, terrain) {
    const src = activeSourceMode(settings.modes);
    if (!src) {
        const key = settings.density === "high" ? "uninhabited" : "inhabited";
        const rows = MONSTER_TABLES[key][terrain];
        return rows ? { rows: rows, label: (key === "uninhabited" ? "Wilderness " : "Inhabited ") + terrain, mode: null, inhabited: key === "inhabited" } : null;
    }
    const m = MONSTER_TABLES.modes[src];
    const rows = m && m.terrains[terrain];
    return rows ? { rows: rows, label: (MODE_SHORT[src] || m.label) + " " + terrain, mode: src, inhabited: false } : null;
}

// ----- Surprise (DMG p.62) -----
/* Each side rolls d6; a side is surprised if its die is within its range (party 1-2 unless the monster surprises on 1-X;
   monster 1-2 unless its entry says otherwise, 0 = never). A side surprised alone loses segments equal to its die.
   Both surprised: the higher die is inactive for the difference; equal dice = both surprised, no segments.
   This is the p.62 text and both worked examples, and PHB p.103. The printed table's 1 vs 2 rows say the opposite;
   TB ruled for the text on 2026-11-13 (FLOW_NOTES interpretation 1, 1E_TOOLKIT/COMBAT_SPEC.md A1). */
function rollSurprise(details, opts) {
    opts = opts || {};
    const partyRange = Math.max(2, (details && details.surprisesOn) || 0);
    const monsterRange = details && typeof details.surprisedOn === "number" ? details.surprisedOn : 2;
    const pd = rollDie(6), md = rollDie(6);
    const pIn = pd <= partyRange, mIn = md <= monsterRange;
    let net = "none", segments = 0, party = false, monster = false;
    if (pIn && mIn) {
        if (pd === md) { net = "both"; party = monster = true; }
        else if (pd > md) { net = "party"; party = true; segments = pd - md; }
        else { net = "monster"; monster = true; segments = md - pd; }
    } else if (pIn) { net = "party"; party = true; segments = pd; }
    else if (mIn) { net = "monster"; monster = true; segments = md; }
    const names = { none: "No surprise", party: "Party surprised", monster: "Monster surprised", both: "Both surprised" };
    let text = names[net] + (segments ? " (" + segments + " segment" + (segments > 1 ? "s" : "") + ")" : "");
    text += " [party d6 " + pd + " vs 1-" + partyRange + ", monster d6 " + md + " vs " + (monsterRange ? "1-" + monsterRange : "never surprised") + "]";
    return { net: net, partySurprised: party, monsterSurprised: monster, partyRoll: pd, monsterRoll: md, partyRange: partyRange,
        monsterRange: monsterRange, segments: segments, text: text };
}

// ----- Encounter distance -----
// Outdoors (DMG p.49): 6d4 inches, terrain per die (scrub -1 on 3-4, forest -1 on all, marsh -1 on 2-4), surprise die subtracted.
function outdoorDistance(terrain, surprise) {
    const dice = [];
    for (let i = 0; i < 6; i++) dice.push(rollDie(4));
    const adj = dice.map(function (r) {
        if (terrain === "scrub") return (r === 3 || r === 4) ? r - 1 : r;
        if (terrain === "forest") return r - 1;
        if (terrain === "marsh") return r >= 2 ? r - 1 : r;
        return r;
    });
    let total = adj.reduce(function (s, r) { return s + r; }, 0);
    let surpriseValue = 0;
    if (surprise && (surprise.partySurprised || surprise.monsterSurprised)) {
        surpriseValue = Math.max(surprise.partySurprised ? surprise.partyRoll : 0, surprise.monsterSurprised ? surprise.monsterRoll : 0);
        total -= surpriseValue;
    }
    const inches = Math.max(0, total);
    return { inches: inches, unit: "inch", surpriseValue: surpriseValue, scale: "outdoor" };
}
// Dungeon and underwater (DMG p.62): d6+4 inches (10 ft each); a light source caps it at twice its radius; surprise 1-3 inches
function dungeonDistance(surprise, lightRadius) {
    let feet = (rollDie(6) + 4) * 10;
    const notes = [];
    if (lightRadius > 0 && feet > lightRadius * 2) { feet = lightRadius * 2; notes.push("light-limited"); }
    if (surprise && (surprise.partySurprised || surprise.monsterSurprised)) {
        feet = Math.min(feet, rollDie(3) * 10);
        notes.push("surprise");
    }
    return { inches: feet / 10, feet: feet, unit: "foot", notes: notes, scale: "dungeon" };
}
function formatDistance(d) {
    if (!d) return "";
    if (d.scale === "dungeon") return d.feet + " ft (" + d.inches + '")' + (d.notes && d.notes.length ? " " + d.notes.join(", ") : "");
    const yards = d.inches * 10, meters = Math.round(yards * 0.9144);
    return d.inches + '" = ' + yards + " yards (" + meters + "m)";
}
// DMG p.49: 1" or less is usually a confrontation. DMG p.49 item 1: intelligent creatures that think themselves weaker avoid it.
function distanceNotes(d, enc, settings) {
    const out = [];
    if (d.inches <= 1) out.push("Confrontation: final distance 1\" or less usually means the parties meet at once (DMG p.49).");
    if (enc && enc.intelligent && enc.force > 0 && enc.force < (settings.partyHD || 0)) {
        out.push("Intelligent creatures that deem themselves weaker than the party will seek to avoid confrontation (DMG p.49).");
    }
    return out;
}

// ----- Number appearing -----
// Number ranges as dice (MONSTER MANUAL II p.5, "Number Ranges"; image supplied by TB, 2026-11-12).
// DMG p.9-10: added dice give a bell curve, a single die a linear one. "Bell" mode rolls these dice;
// "Linear" mode rolls every number in the range with equal chance. Spec: [count, sides, plus, times].
// MM II also lists 3-12* as 1d10+2 (asterisk note cut off); the plain 3-12 = 3d4 is used.
const MM2_RANGE_DICE = {
    "1-2": "third", "1-3": "half", "1-4": [1,4,0,1], "1-6": [1,6,0,1], "1-8": [1,8,0,1], "1-10": [1,10,0,1],
    "1-12": [1,12,0,1], "1-20": [1,20,0,1], "1-100": [1,100,0,1],
    "2-5": [1,4,1,1], "2-7": [1,6,1,1], "2-8": [2,4,0,1], "2-9": [1,8,1,1], "2-12": [2,6,0,1], "2-13": [1,12,1,1],
    "2-16": [2,8,0,1], "2-24": [2,12,0,1], "3-9": [2,4,1,1],
    "3-12": [3,4,0,1], "3-17": [2,8,1,1], "3-18": [3,6,0,1], "3-30": [3,10,0,1], "3-36": [3,12,0,1],
    "4-15": [1,12,3,1], "4-16": [4,4,0,1], "4-24": [4,6,0,1], "4-26": [2,12,2,1], "4-36": "2d12+2d6",
    "5-8": [1,4,4,1], "5-20": [5,4,0,1], "5-30": [5,6,0,1], "5-40": [5,8,0,1], "5-50": [5,10,0,1], "6-24": [6,4,0,1],
    "6-36": [6,6,0,1], "6-72": [6,12,0,1], "7-10": [1,4,6,1], "7-12": [1,6,6,1], "7-28": [3,8,4,1], "9-16": [1,8,8,1],
    "10-40": [1,4,0,10], "11-20": [1,10,10,1], "11-30": [1,20,10,1], "12-30": [2,10,10,1], "12-48": [4,10,8,1],
    "13-18": [1,6,12,1], "20-160": [2,8,0,10], "21-40": [1,20,20,1]
};
function diceForRange(min, max) {
    const hit = MM2_RANGE_DICE[min + "-" + max];
    if (hit) return { spec: hit, source: "MM II p.5" };
    // not listed: DMG p.10 reads ranges with "one decimal place added" (2-20 x10 = 20-200), so try the range in tens
    if (min % 10 === 0 && max % 10 === 0 && min >= 10) {
        const t = diceForRange(min / 10, max / 10);
        if (t && Array.isArray(t.spec)) return { spec: [t.spec[0], t.spec[1], t.spec[2], t.spec[3] * 10], source: t.source + " x10" };
    }
    // then N dice of M sides for N to N*M, up to 5 dice (DMG p.10: 2d4 = 2-8, 3d4 = 3-12, "2, 3, 4 or 5d20")
    for (const m of [4, 6, 8, 10, 12, 20]) if (min > 1 && min <= 5 && max === min * m) return { spec: [min, m, 0, 1], source: "DMG p.10" };
    return null;
}
function rollSpec(spec) {
    if (spec === "third") return Math.ceil(rollDie(6) / 3);
    if (spec === "half") return Math.ceil(rollDie(6) / 2);
    if (spec === "2d12+2d6") return rollDie(12) + rollDie(12) + rollDie(6) + rollDie(6);
    let t = 0;
    for (let i = 0; i < spec[0]; i++) t += rollDie(spec[1]);
    return (t + spec[2]) * spec[3];
}
function specText(spec) {
    if (spec === "third") return "1/3 d6";
    if (spec === "half") return "1/2 d6";
    if (typeof spec === "string") return spec;
    return spec[0] + "d" + spec[1] + (spec[2] ? "+" + spec[2] : "") + (spec[3] > 1 ? "x" + spec[3] : "");
}
function rollRange(min, max, bell) {
    const d = bell ? diceForRange(min, max) : null;
    if (d) return { value: rollSpec(d.spec), dice: specText(d.spec) + ", " + d.source };
    return { value: rollDice(min, max), dice: bell ? "linear, no dice listed" : "linear" };
}
function parseRangeText(s) {
    const nums = String(s === undefined || s === null ? "" : s).match(/\d+/g);
    if (!nums) return null;
    return { min: parseInt(nums[0], 10), max: parseInt(nums[nums.length - 1], 10) };
}

// Level adjustment of numbers (DMG p.174-175). dl = dungeon level, ml = monster level (1-10).
function adjustForDungeonLevel(n, dl, ml) {
    if (dl > ml) return { value: n * (1 + dl - ml), note: "lesser monster on a lower level: numbers x" + (1 + dl - ml) + " (DMG p.174)" };
    if (dl < ml) return { value: Math.max(1, n - (ml - dl)), note: "greater monster on a higher level: numbers reduced by " + (ml - dl) + ", minimum 1 (DMG p.174-175)" };
    return { value: n, note: null };
}

function rollNumberAppearing(row, details, ctx, parentNumber) {
    let range = null, source = "";
    const text = row && (row.noAppearing || parentNumber);
    if (text) { range = parseRangeText(text); source = ctx.dungeon ? "DMG table" : "table"; }
    else if (details && details.noAppearingDice) { range = details.noAppearingDice; source = "MM"; }
    if (!range) return { value: null, text: "number not given (DM decides)", source: "none" };
    const bell = !ctx.settings || ctx.settings.bellCurve !== false;
    const rolled = rollRange(range.min, range.max, bell);
    let value = rolled.value;
    let note = null;
    if (ctx.dungeon && !(text === undefined)) {
        const ml = ctx.dungeon.monsterLevel;
        if (ml >= 9) note = "level IX and X monsters get attendants rather than greater numbers on lower levels (DMG p.175)";
        else { const adj = adjustForDungeonLevel(value, ctx.dungeon.dungeonLevel, ml); value = adj.value; note = adj.note; }
    }
    const printed = range.min === range.max ? String(range.min) : range.min + "-" + range.max;
    return { value: value, text: value + " (" + source + " " + printed + ", " + rolled.dice + ")", source: source, note: note };
}

// ----- Lair (MM p.5) -----
function rollLair(details, ctx) {
    if (!details || ctx.dungeon || ctx.noLair) return null;
    const chance = details.inLair || 0;
    if (!chance) return { chance: 0, roll: null, inLair: false };
    const roll = rollDice(1, 100);
    return { chance: chance, roll: roll, inLair: roll <= chance };
}

// ----- Reaction -----
function racesAndAlignment(enc) {
    const d = enc.details;
    return { monsterAlignmentCode: d ? d.alignmentCode : null, monsterRace: reactionRaceOf(enc.key, enc.npcRace) };
}

function reactionFor(enc, settings) {
    const r = racesAndAlignment(enc);
    return rollReaction({ charisma: settings.charisma, partyAlignment: settings.partyAlignment, partyRace: settings.partyRace,
        monsterAlignmentCode: r.monsterAlignmentCode, monsterRace: r.monsterRace, extraMod: settings.reactionMod });
}

function capitalise(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
const RACE_WORDS = { Dwarven: "dwarf", Elven: "elf", Gnomish: "gnome", "Half-elven": "half-elf", Hal: "halfling", "Half-orc": "half-orc", Human: "human" };

// ----- Build encounters -----
function baseEncounter(ctx, setting) {
    return { kind: "monster", setting: setting, table: ctx.label, trace: ctx.trace, errors: ctx.errors, notes: ctx.notes };
}

// Pick -> full monster encounter (number, lair, surprise, distance, reaction, treasure)
function buildMonsterEncounter(pick, ctx) {
    const settings = ctx.settings;
    const enc = baseEncounter(ctx, ctx.dungeon ? "dungeon" : "outdoor");
    const row = pick.row;
    const mon = lookupMonster(pick.name);
    enc.name = pick.name;
    enc.key = mon ? mon.key : null;
    enc.hasStats = !!mon;
    enc.details = mon ? mon.details : null;
    if (mon && mon.key !== pick.name) enc.name = mon.key;
    if (row.raceCheck && ctx.raceCheck) { enc.npcRace = RACE_WORDS[ctx.raceCheck] || null; enc.name = ctx.raceCheck + " " + enc.name.toLowerCase(); }
    if (row.variant) enc.name += " (" + row.variant + ")";
    if (row.heads) enc.name += ", " + row.heads + " heads";
    if (row.age) { enc.age = row.age; enc.notes.push("Age category: " + row.age + " (DMG p.177-179 dragon subtables)."); }
    if (row.notes && /former|upper level leaders/.test(row.notes)) enc.notes.push(capitalise(row.notes) + " (DMG).");
    if (ctx.terrain === "rough" && !ctx.dungeon && !ctx.underwater) enc.notes.push("Rough includes ruins (cities, temples, fortresses) within up to five miles of the party; if ruins are indicated the encounter occurs there (DMG p.182, p.184).");
    if (!mon) enc.notes.push("Not a Monster Manual monster: no stats held. Number, treatment and reactions are the DM's call.");
    enc.via = pick.via || [];
    enc.number = rollNumberAppearing(row, enc.details, ctx, pick.parentNumber);
    if (enc.number.note) enc.notes.push(enc.number.note);
    enc.lair = rollLair(enc.details, ctx);
    if (ctx.forceLair && enc.details) enc.lair = { chance: enc.details.inLair || 0, roll: null, inLair: true, forced: true };
    enc.intelligent = isIntelligentDetails(enc.details);
    enc.surprise = rollSurprise(enc.details);
    enc.distance = (ctx.dungeon || ctx.underwater) ? dungeonDistance(enc.surprise, settings.lightRadius) : outdoorDistance(ctx.terrain, enc.surprise);
    enc.force = enc.details && enc.number.value ? enc.details.hdValue * enc.number.value : 0;
    enc.notes = enc.notes.concat(distanceNotes(enc.distance, enc, settings));
    if (enc.intelligent) enc.reaction = reactionFor(enc, settings);
    if (enc.reaction) enc.reaction.notes.forEach(function (n) { if (enc.notes.indexOf(n) < 0) enc.notes.push(n); });
    if (enc.details && enc.details.notes && /never surprised/i.test(enc.details.notes)) enc.notes.push("Never surprised (Monster Manual).");
    if (typeof rollEncounterTreasure === "function" && enc.details) {
        enc.treasure = rollEncounterTreasure(enc.details, enc.number.value || 1, !!(enc.lair && enc.lair.inLair));
    }
    return enc;
}

function buildPartyEncounter(pick, ctx, setting) {
    const enc = baseEncounter(ctx, ctx.dungeon ? "dungeon" : "outdoor");
    enc.kind = "party";
    enc.name = "Character party";
    enc.hasStats = false;
    enc.intelligent = true;
    enc.party = buildCharacterParty({ setting: ctx.dungeon ? "dungeon" : "wilderness", dungeonLevel: ctx.dungeon && ctx.dungeon.dungeonLevel,
        monsterLevel: ctx.dungeon && ctx.dungeon.monsterLevel });
    enc.notes = enc.notes.concat(enc.party.notes);
    enc.surprise = rollSurprise(null);
    enc.distance = (ctx.dungeon || ctx.underwater) ? dungeonDistance(enc.surprise, ctx.settings.lightRadius) : outdoorDistance(ctx.terrain, enc.surprise);
    enc.number = { value: 9, text: "9 (2-5 characters with followers)", source: "DMG p.175" };
    enc.force = 0;
    enc.notes = enc.notes.concat(distanceNotes(enc.distance, enc, ctx.settings));
    enc.reaction = reactionFor(enc, ctx.settings);
    return enc;
}

function buildPatrolEncounter(ctx) {
    const enc = baseEncounter(ctx, "outdoor");
    enc.kind = "patrol";
    enc.name = "Patrol";
    enc.patrol = generatePatrol();
    enc.equipment = PATROL_TABLES.equipment;
    enc.intelligent = true;
    enc.number = { value: enc.patrol.total, text: String(enc.patrol.total), source: "DMG p.182" };
    enc.surprise = rollSurprise(null);
    enc.distance = outdoorDistance(ctx.terrain, enc.surprise);
    enc.notes = enc.notes.concat(enc.patrol.notes, distanceNotes(enc.distance, enc, ctx.settings));
    enc.reaction = reactionFor(enc, ctx.settings);
    return enc;
}

function buildStrongholdEncounter(ctx) {
    const enc = baseEncounter(ctx, "outdoor");
    enc.kind = "stronghold";
    enc.name = "Stronghold";
    enc.fortress = stronghold(ctx.terrain);
    enc.notes = enc.notes.concat(enc.fortress.notes);
    if (enc.fortress.kind === "DESERTED_MONSTER") {
        const c2 = newCtx(ctx.settings, ctx.terrain, { ignoreMen: true, forceLair: true, label: ctx.label });
        const pick = rollPick(selectTable(c2.settings, ctx.terrain).rows, c2, "monster in stronghold");
        if (pick && pick.kind === "monster") {
            enc.monster = buildMonsterEncounter(pick, c2);
            enc.monster.notes.push("Roll on the outdoor table, ignoring men (DMG p.183). The creature is in its lair, in the construction.");
        } else {
            enc.notes.push("No monster could be rolled for the deserted stronghold.");
        }
    }
    return enc;
}

// ----- One outdoor (or mode) encounter -----
function rollOutdoorEncounter(settings, terrain, period) {
    settings = mergeSettings(settings);
    const src = activeSourceMode(settings.modes);
    const table = selectTable(settings, terrain);
    if (!table) return { kind: "none", reason: "No table for " + terrain + (src ? " in " + MONSTER_TABLES.modes[src].label : ""), trace: [], errors: [], notes: [] };
    const ctx = newCtx(settings, terrain, { label: table.label, underwater: src === "underwater", noLair: CITY_MODES.indexOf(src) >= 0 });

    // DMG p.182: inhabited areas, 5 in 20 are patrols; uninhabited areas, 1 in 20 is a stronghold (temperate tables only)
    if (!src) {
        const chk = MONSTER_TABLES.checks[table.inhabited ? "inhabited" : "uninhabited"];
        const r = rollDice(1, 20);
        const row = pickRow(chk.rows, r);
        ctx.trace.push("d20 " + r + ": " + row.type.toLowerCase());
        if (row.type === "PATROL") return buildPatrolEncounter(ctx);
        if (row.type === "STRONGHOLD") return buildStrongholdEncounter(ctx);
    }

    // DMG p.182: party used psionics, 1 in 4 of encounters are psionic
    let rows = table.rows, label = table.label;
    if (settings.modes.indexOf("psionic") >= 0) {
        const d4 = rollDice(1, 4);
        ctx.trace.push("psionic d4 " + d4 + (d4 === 1 ? ": psionic encounter" : ": not psionic"));
        if (d4 === 1) { rows = MONSTER_TABLES.modes.psionic.terrains.psionic; label = "Psionic"; ctx.label = label; }
    }

    const pick = rollPick(rows, ctx, label);
    if (!pick) return { kind: "none", reason: "No result: " + ctx.errors.join("; "), trace: ctx.trace, errors: ctx.errors, notes: [] };
    if (pick.kind === "none") return { kind: "none", reason: pick.reason, trace: ctx.trace, errors: ctx.errors, notes: [] };

    // city rows with a race check
    if (pick.row.raceCheck) {
        const rc = MONSTER_TABLES.modes[src].extraTables.raceCheck;
        const rr = rollRow(rc.rows, 100, ctx, "race");
        ctx.raceCheck = rr.type;
    }
    // Drunk and Harlot rows have their own explanation tables (DMG p.191-193)
    if (CITY_MODES.indexOf(src) >= 0 && (pick.name === "Drunk" || pick.name === "Harlot")) {
        const et = MONSTER_TABLES.modes[src].extraTables[pick.name.toLowerCase()];
        if (et) { const rr = rollRow(et.rows, 100, ctx, pick.name.toLowerCase()); ctx.notes.push(pick.name + ": " + rr.type); }
    }

    if (settings.modes.indexOf("airborne") >= 0) {
        // DMG p.190: an encounter occurs only if the creature indicated can fly or is flying
        const mon = pick.kind === "monster" ? lookupMonster(pick.name) : null;
        const flies = mon && mon.details.moveModes && mon.details.moveModes.fly > 0;
        if (!flies) return { kind: "none", reason: (pick.name || "result") + " cannot fly: no airborne encounter (DMG p.190)", trace: ctx.trace, errors: ctx.errors, notes: [] };
    }

    if (pick.kind === "party") {
        const pe = buildPartyEncounter(pick, ctx);
        const ht = src && MONSTER_TABLES.modes[src].humanTraveller;
        if (ht) {
            pe.notes.push("Human traveller on the " + (src === "astral" ? "astral" : "ethereal") + " plane (DMG p.181-182): party of " + ht.partySize + ", class limits " + ht.classLimits +
                ", always " + ht.alwaysIncluded + ". Levels: " + Object.keys(ht.levels).map(function (k) { return k + " " + ht.levels[k]; }).join(", ") + ".");
        }
        return pe;
    }
    return buildMonsterEncounter(pick, ctx);
}

// ----- The day (or the check set of the active mode) -----
function checkPlan(settings, terrain) {
    settings = mergeSettings(settings);
    const src = activeSourceMode(settings.modes);
    const air = settings.modes.indexOf("airborne") >= 0;
    const hundredPlus = settings.partyNumber > 100;       // DMG p.47: "over 100 creatures"
    const periods = [];
    let title = "", die = ENCOUNTER_CHANCES[settings.density];
    if (src && modeTerrains(src).indexOf(terrain) < 0) return null;
    if (!src || LAND_MODES.indexOf(src) >= 0) {
        if (air) {
            title = "Airborne (4 flying checks in daylight, DMG p.190)";
            for (let i = 1; i <= 4; i++) periods.push({ id: "flight" + i, label: "Flight " + i, icon: "\u{1F985}", check: true, die: die, light: "daylight" });
        } else {
            title = src ? MONSTER_TABLES.modes[src].label : "";
            DAY_PERIODS.forEach(function (p) {
                const m = TIME_OF_DAY_META[p];
                periods.push({ id: p, label: m.label, icon: m.icon, check: !!(TIME_CHECKS[terrain] && TIME_CHECKS[terrain][p]) || hundredPlus, die: die, light: lightForTime(p, settings.brightMoon) });
            });
        }
    } else if (src === "freshWater") {
        title = "Fresh water, 1 in 20 (morning, evening and midnight, DMG p.190)"; die = 20;
        ["morning", "evening", "midnight"].forEach(function (p) { periods.push({ id: p, label: TIME_OF_DAY_META[p].label, icon: TIME_OF_DAY_META[p].icon, check: true, die: 20, light: lightForTime(p, settings.brightMoon) }); });
    } else if (src === "saltWater") {
        title = "Salt water, 1 in 20 (DMG p.190)"; die = 20;
        const ps = terrain === "deep" ? ["noon"] : ["morning", "noon"];
        ps.forEach(function (p) { periods.push({ id: p, label: (p === "morning" ? "Dawn" : "Noon"), icon: TIME_OF_DAY_META[p].icon, check: true, die: 20, light: "daylight" }); });
    } else if (src === "astral" || src === "ethereal") {
        title = MONSTER_TABLES.modes[src].label + ", 1 in 20 at the beginning, midpoint and end of the journey (DMG p.181-182)"; die = 20;
        ["Beginning", "Midpoint", "End"].forEach(function (l, i) { periods.push({ id: "leg" + i, label: l, icon: "✨", check: true, die: 20, light: "daylight" }); });
    } else {
        // underwater and city: "check every three turns as normally" (1 in 6); four checks shown (two hours)
        title = MONSTER_TABLES.modes[src].label + ", 1 in 6 every 3 turns";
        for (let i = 1; i <= 4; i++) periods.push({ id: "turn" + i * 3, label: "Turn " + i * 3, icon: "⏳", check: true, die: 6, light: src === "cityNight" ? "twilight" : "daylight" });
    }
    return { title: title, periods: periods, terrain: terrain };
}

function rollDay(settings, terrain) {
    settings = mergeSettings(settings);
    const plan = checkPlan(settings, terrain);
    if (!plan) return { terrain: terrain, settings: settings, plan: null, periods: [] };
    const periods = plan.periods.map(function (p) {
        const period = { id: p.id, label: p.label, icon: p.icon, light: p.light, status: "nocheck", checkText: "", encounter: null };
        if (!p.check) return period;
        const roll = rollDice(1, p.die);
        period.checkText = "Encounter check: rolled " + roll + " on d" + p.die;
        if (roll !== 1) { period.status = "clear"; return period; }
        period.status = "encounter";
        const enc = rollOutdoorEncounter(settings, terrain, p);
        enc.light = p.light;
        if (enc.kind === "none") { period.status = "clear"; period.note = enc.reason; period.checkText += ". " + enc.reason; period.encounter = null; return period; }
        period.encounter = enc;
        return period;
    });
    return { terrain: terrain, settings: settings, plan: plan, periods: periods };
}

// ----- Plain text and rows (shared by cards and copy) -----
function sign(n) { return n > 0 ? "+" + n : String(n); }

function encounterSubtitle(enc) {
    const parts = [];
    if (enc.number && enc.number.text) parts.push(enc.number.text);
    if (enc.lair) parts.push(enc.lair.inLair ? "in lair" + (enc.lair.forced ? "" : " (" + enc.lair.roll + "/" + enc.lair.chance + "%)") : (enc.lair.chance ? "wilderness (" + enc.lair.roll + " > " + enc.lair.chance + "% lair)" : "no lair"));
    if (enc.details && enc.details.intelligence) parts.push("Int " + enc.details.intelligence);
    if (enc.details && enc.details.alignment) parts.push(enc.details.alignment);
    return parts.join("  ·  ");
}

function encounterRows(enc) {
    const rows = [];
    if (enc.trace && enc.trace.length) rows.push(["Rolled", enc.trace.slice(-3).join("; ")]);
    if (enc.surprise) rows.push(["Surprise", enc.surprise.text]);
    if (enc.distance) rows.push(["Distance", formatDistance(enc.distance)]);
    if (enc.force) rows.push(["Force", enc.force.toFixed(1) + " HD"]);
    if (enc.reaction) rows.push(["Reaction", reactionSummary(enc.reaction)]);
    if (enc.reaction && enc.reaction.guidance) rows.push(["", enc.reaction.guidance]);
    if (enc.intelligent && enc.details) rows.push(["Morale", "base " + baseMorale(enc.details.hitDice, enc.details.hdValue) + "% (DMG p.67), checked only on a trigger"]);
    return rows;
}

function encounterToText(enc, header) {
    const out = [];
    if (header) out.push(header);
    if (enc.kind === "none") { out.push(enc.reason || "No encounter."); return out.join("\n"); }
    if (enc.kind === "patrol") {
        const p = enc.patrol;
        out.push("Patrol, mounted, " + enc.number.text + " (commander " + p.commander.class + " " + p.commander.level + ", lieutenant " + p.lieutenant.level +
            ", serjeant " + p.sergeant.level + ", " + p.firstLevelFighters + " first level men, " + p.soldiers + " soldiers, " + p.spellcaster.class + " " + p.spellcaster.level + ")");
    } else if (enc.kind === "stronghold") {
        const f = enc.fortress;
        out.push("Stronghold: " + f.type + " (" + f.sizeClass + "), " + f.inhabitants + (f.humanType ? " (" + f.humanType + ")" : "") + ", visible at " + f.visualRange);
        if (f.master) out.push("Master: " + f.master.class + " level " + f.master.level + ", " + f.henchmen + " henchmen");
        out.push(f.awareness.text);
        if (enc.monster) out.push(encounterToText(enc.monster));
    } else if (enc.kind === "party") {
        out.push("Character party");
        out.push(enc.party.lines.join("\n"));
    } else {
        out.push(enc.name + " " + (enc.number ? enc.number.text : ""));
        const sub = encounterSubtitle(enc);
        if (sub) out.push(sub);
    }
    if (enc.kind !== "stronghold") encounterRows(enc).forEach(function (r) { out.push((r[0] ? r[0] + ": " : "") + r[1]); });
    (enc.notes || []).forEach(function (n) { out.push("Note: " + n); });
    if (enc.treasure && typeof treasureToText === "function") { const t = treasureToText(enc.treasure); if (t) out.push(t); }
    return out.filter(Boolean).join("\n");
}

// ----- Party settings and evade/morale resolution (called by the card buttons) -----
function evadeEncounter(enc, settings, extra) {
    settings = mergeSettings(settings);
    const d = enc.details;
    const monsterNumber = enc.number && enc.number.value ? enc.number.value : (enc.kind === "patrol" ? enc.number.value : 1);
    const speed = d ? monsterPursuitSpeed(d) : 12;
    const pSpeed = partySpeed(settings.mount, settings.encumbrance);
    let terrain = (extra && extra.terrain) || enc.terrain || "plains";
    if (/Body$|^shallow$|^deep$|Shallow$|Deep$/.test(terrain)) terrain = "openWater";   // DMG p.69: open water -50%
    const lk = pursuitLikelihood(d || { intelligenceRank: 4 }, settings.partyNumber, monsterNumber, extra);
    const res = evadeOutdoors({ surprise: enc.surprise ? enc.surprise.net : "none", terrain: terrain, light: (extra && extra.light) || "daylight",
        partyNumber: settings.partyNumber, monsterNumber: monsterNumber, partySpeed: pSpeed, monsterSpeed: speed,
        distanceInches: enc.distance ? enc.distance.inches : undefined, likelihood: lk });
    res.partySpeed = pSpeed; res.monsterSpeed = speed;
    return res;
}

function moraleForEncounter(enc, opts) {
    const d = enc.details || {};
    return checkMorale(Object.assign({ hitDice: d.hitDice, hdValue: d.hdValue }, opts || {}));
}

