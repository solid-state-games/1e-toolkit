// SHARED COPY of 1e_CHARACTER_CREATOR/rules_1e.js: edit the master there, then run TOOLS/sync_lib.py
/*  rules_1e.js  -  AD&D 1st Edition character rules (RAW), DOM-free.
 *
 *  Plain script. In a browser it defines the global `Rules`; in node
 *  `module.exports` is the same object.  No DOM, no storage, no randomness
 *  except through an rng you pass in (default Math.random).
 *
 *  Sources: PHB = Players Handbook, DMG = Dungeon Masters Guide (1e). Page
 *  numbers in comments are printed pages. Anything the books leave open is
 *  tagged INTERPRETATION and listed in RAW_AUDIT.md.
 *
 *  ---------------------------------------------------------------------
 *  API  (all functions are pure except where an rng is taken)
 *  ---------------------------------------------------------------------
 *  Data
 *    Rules.ABILITIES, ABILITY_NAMES, ALIGNMENTS, ALIGN_NAMES
 *    Rules.RACES[name]      {min,max (per sex), adj, languages, extraLangs,
 *                            infravision, levelLimits, multi, strExcMax ...}
 *    Rules.CLASSES[name]    {req, hd, initialHD, xp[], races, align, weapons,
 *                            armor, profs, money, group ...}
 *    Rules.MULTICLASS[race] list of allowed class combinations
 *    Rules.TABLES           raw tables: str, int, wis, dex, con, cha,
 *                            saves, attack, thief, spells, xp, aging ...
 *    Rules.EQUIPMENT        {weapons, armor, gear, beasts}  (cp prices, lb)
 *  Dice
 *    Rules.makeRng(seed)            seeded rng () -> [0,1)
 *    Rules.roll(expr, rng)          '3d6', '5d4*10', '2d8+1', '3'
 *    Rules.rollAbilities(method, rng)   method 1..4 -> {pool|sets|scores}
 *  Creation
 *    Rules.applyRace(scores, race, sex)  -> {ok, scores, rolled, reasons}
 *    Rules.classOk(classes, race, scores)-> {ok, reasons}
 *    Rules.classesFor(race, scores, sex) -> every legal class / combo
 *    Rules.alignmentsFor(classes)        -> allowed alignment codes
 *    Rules.levelLimit(char, class)       -> number | Infinity | 0 (barred)
 *    Rules.rollStrExc(char, rng) / capStrExc(race, sex, exc)
 *    Rules.rollHP(char, rng)             -> {hp, rolls, perDie}
 *    Rules.startingGold(classes, rng)    -> {gp, expr, class}
 *    Rules.rollAge(char, rng) / ageCategory(race, age) / applyAging(char, rng)
 *    Rules.rollHeightWeight(char, rng)   -> {height, weight}  (inches, lb)
 *    Rules.rollSecondarySkill(rng)
 *    Rules.rollStartingSpells(classes, rng)  / spellList(class)
 *    Rules.languageSlots(char) / languageChoices(char)
 *  Equipment
 *    Rules.canUseWeapon(classes, weapon, char) -> {ok, why}
 *    Rules.canWearArmor(classes, armor)        -> {ok, why}
 *    Rules.armorClass(char)  Rules.encumbrance(char)  Rules.formatCoin(cp)
 *  Everything at once
 *    Rules.derive(char) -> {
 *       abilities:{str,int,wis,dex,con,cha}  every table row for the score,
 *       classes, levels, hitDice, xpBonus, saves, attack, thiefSkills,
 *       movement, spellsPerDay, languages, ac, weaponProf, race:{...}, notes }
 *
 *  char = { race, subrace?, sex:'m'|'f', classes:['Fighter'],
 *           levels?:{Fighter:1}, scores:{str,int,wis,dex,con,cha},
 *           strExc?:1..100 (100 = 00), chaRolled?, age?, alignment?,
 *           inventory?:[{n,qty,w,c,ac,t}], coinsCP?, languages?:[] }
 *  Scores are FINAL scores (after race and aging).
 */
(function (root) {
'use strict';

const ABILITIES = ['str', 'int', 'wis', 'dex', 'con', 'cha'];
const ABILITY_NAMES = { str: 'Strength', int: 'Intelligence', wis: 'Wisdom', dex: 'Dexterity', con: 'Constitution', cha: 'Charisma' };
const ALIGNMENTS = ['LG', 'NG', 'CG', 'LN', 'N', 'CN', 'LE', 'NE', 'CE'];
const ALIGN_NAMES = { LG: 'Lawful Good', NG: 'Neutral Good', CG: 'Chaotic Good', LN: 'Lawful Neutral', N: 'True Neutral', CN: 'Chaotic Neutral', LE: 'Lawful Evil', NE: 'Neutral Evil', CE: 'Chaotic Evil' };
const ALIGN_LANG = { LG: 'Lawful Good', NG: 'Neutral Good', CG: 'Chaotic Good', LN: 'Lawful Neutral', N: 'Neutrality', CN: 'Chaotic Neutral', LE: 'Lawful Evil', NE: 'Neutral Evil', CE: 'Chaotic Evil' };
const NO_N = ['LG', 'NG', 'CG', 'LN', 'CN', 'LE', 'NE', 'CE'];

/* ---------------- dice ---------------- */
function makeRng(seed) { // mulberry32
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function die(sides, rng) { return Math.floor((rng || Math.random)() * sides) + 1; }
function dice(n, sides, rng) { let t = 0; for (let i = 0; i < n; i++) t += die(sides, rng); return t; }
function roll(expr, rng) {
    const m = /^(\d+)d(\d+)(?:\*(\d+))?(?:\+(\d+))?$/.exec(String(expr).replace(/\s/g, ''));
    if (!m) return Number(expr);
    return dice(+m[1], +m[2], rng) * (m[3] ? +m[3] : 1) + (m[4] ? +m[4] : 0);
}
function diceMax(expr) {
    const m = /^(\d+)d(\d+)/.exec(expr); return m ? +m[1] * +m[2] : Number(expr);
}
function parseRange(s) { const m = /^(\d+)-(\d+)$/.exec(s); return [+m[1], +m[2]]; }
function between(lo, hi, rng) { return lo + Math.floor((rng || Math.random)() * (hi - lo + 1)); }

/* ---------------- ability tables ---------------- */
// STR  PHB p.9 Table II. doors = chances in 6; doorsM = chances in 6 for locked/barred/held (fighters)
const STR_ROWS = [
    [3, 3, -3, -1, -350, 1, 0, 0], [4, 5, -2, -1, -250, 1, 0, 0], [6, 7, -1, 0, -150, 1, 0, 0], [8, 9, 0, 0, 0, 2, 0, 1],
    [10, 11, 0, 0, 0, 2, 0, 2], [12, 13, 0, 0, 100, 2, 0, 4], [14, 15, 0, 0, 200, 2, 0, 7], [16, 16, 0, 1, 350, 3, 0, 10],
    [17, 17, 1, 1, 500, 3, 0, 13], [18, 18, 1, 2, 750, 3, 0, 16]
];
const STR_EXC = [ // PHB p.9: max exceptional roll in band
    [50, 1, 3, 1000, 3, 0, 20], [75, 2, 3, 1250, 4, 0, 25], [90, 2, 4, 1500, 4, 0, 30], [99, 2, 5, 2000, 4, 1, 35], [100, 3, 6, 3000, 5, 2, 40]
];
function strRow(score, exc) {
    let s = Math.max(3, score), r;
    if (s >= 18 && exc > 0) {
        const e = STR_EXC.find(x => exc <= x[0]) || STR_EXC[4];
        r = { hit: e[1], dmg: e[2], wgt: e[3], doors: e[4], doorsM: e[5], bars: e[6] };
        r.openDoors = e[4] + (e[5] ? ' (' + e[5] + ')' : '') + ' in 6';
    } else {
        s = Math.min(s, 18);
        const x = STR_ROWS.find(q => s >= q[0] && s <= q[1]);
        r = { hit: x[2], dmg: x[3], wgt: x[4], doors: x[5], doorsM: x[6], bars: x[7] };
        r.openDoors = x[5] + ' in 6';
    }
    return r;
}
// INT  PHB p.10. languages = additional languages (Table I); learn/min/max = Table II (MU)
const INT_LANG = { 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1, 9: 1, 10: 2, 11: 2, 12: 3, 13: 3, 14: 4, 15: 4, 16: 5, 17: 6, 18: 7 };
const INT2 = [[9, 9, 35, 4, 6], [10, 12, 45, 5, 7], [13, 14, 55, 6, 9], [15, 16, 65, 7, 11], [17, 17, 75, 8, 14], [18, 18, 85, 9, 18], [19, 99, 95, 10, 'All']];
function intRow(score) {
    const s = Math.min(Math.max(score, 3), 19);
    const r = { languages: INT_LANG[Math.min(s, 18)], learnPct: 0, minSpells: 0, maxSpells: 0 };
    const x = INT2.find(q => s >= q[0] && s <= q[1]);
    if (x) { r.learnPct = x[2]; r.minSpells = x[3]; r.maxSpells = x[4]; }
    r.maxSpellLevel = s >= 18 ? 9 : s >= 16 ? 8 : s >= 14 ? 7 : s >= 12 ? 6 : s >= 10 ? 5 : 4;
    return r;
}
// WIS  PHB p.11. magic def adj; cleric bonus spells (cumulative) ; spell failure
const WIS_MDA = { 3: -3, 4: -2, 5: -1, 6: -1, 7: -1, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 1, 16: 2, 17: 3, 18: 4 };
const WIS_FAIL = { 9: 20, 10: 15, 11: 10, 12: 5 };
const WIS_BONUS_AT = { 13: 1, 14: 1, 15: 2, 16: 2, 17: 3, 18: 4 }; // score -> spell level of the bonus spell gained at that score
function wisRow(score) {
    const s = Math.min(Math.max(score, 3), 18);
    const bonus = [0, 0, 0, 0];
    for (let k = 13; k <= s; k++) bonus[WIS_BONUS_AT[k] - 1]++;
    return { magicDef: WIS_MDA[s], bonusSpells: bonus, spellFail: s >= 13 ? 0 : (WIS_FAIL[s] || 0) };
}
// DEX  PHB p.11 table I; p.12 table II
const DEX_ROWS = { 3: [-3, 4], 4: [-2, 3], 5: [-1, 2], 6: [0, 1], 7: [0, 0], 8: [0, 0], 9: [0, 0], 10: [0, 0], 11: [0, 0], 12: [0, 0], 13: [0, 0], 14: [0, 0], 15: [0, -1], 16: [1, -2], 17: [2, -3], 18: [3, -4] };
// thief adj: pick pockets, open locks, find/remove traps, move silently, hide in shadows
const DEX_THIEF = { 9: [-15, -10, -10, -20, -10], 10: [-10, -5, -10, -15, -5], 11: [-5, 0, -5, -10, 0], 12: [0, 0, 0, -5, 0], 13: [0, 0, 0, 0, 0], 14: [0, 0, 0, 0, 0], 15: [0, 0, 0, 0, 0], 16: [0, 5, 0, 0, 0], 17: [5, 10, 0, 5, 5], 18: [10, 15, 5, 10, 10] };
function dexRow(score) {
    const s = Math.min(Math.max(score, 3), 18);
    return { reaction: DEX_ROWS[s][0], defense: DEX_ROWS[s][1], // defense = change to AC value (negative is better)
        thief: s >= 9 ? DEX_THIEF[s] : null };
}
// CON  PHB p.12   [hp, hp fighter, shock, resurrection]
const CON_ROWS = { 3: [-2, -2, 35, 40], 4: [-1, -1, 40, 45], 5: [-1, -1, 45, 50], 6: [-1, -1, 50, 55], 7: [0, 0, 55, 60], 8: [0, 0, 60, 65], 9: [0, 0, 65, 70], 10: [0, 0, 70, 75], 11: [0, 0, 75, 80], 12: [0, 0, 80, 85], 13: [0, 0, 85, 90], 14: [0, 0, 88, 92], 15: [1, 1, 91, 94], 16: [2, 2, 95, 96], 17: [2, 3, 97, 98], 18: [2, 4, 99, 100] };
function conRow(score, fighterType) {
    const s = Math.min(Math.max(score, 3), 18), r = CON_ROWS[s];
    return { hp: fighterType ? r[1] : r[0], hpOther: r[0], hpFighter: r[1], shock: r[2], resurrection: r[3], maxRaises: score };
}
// CHA  PHB p.13  [henchmen, loyalty, reaction]
const CHA_ROWS = { 3: [1, -30, -25], 4: [1, -25, -20], 5: [2, -20, -15], 6: [2, -15, -10], 7: [3, -10, -5], 8: [3, -5, 0], 9: [4, 0, 0], 10: [4, 0, 0], 11: [4, 0, 0], 12: [5, 0, 0], 13: [5, 0, 5], 14: [6, 5, 10], 15: [7, 15, 15], 16: [8, 20, 25], 17: [10, 30, 30], 18: [15, 40, 35] };
function chaRow(score) {
    const s = Math.min(Math.max(score, 3), 18), r = CHA_ROWS[s];
    return { henchmen: r[0], loyalty: r[1], reaction: r[2] };
}

/* ---------------- races ---------------- */
// min/max per sex [m,f] from PHB p.15 Table III. adj PHB p.14. Level limits PHB p.14 Table II.
function R(o) { return o; }
const RACES = {
    'Human': R({
        min: { str: [3, 3], int: [3, 3], wis: [3, 3], dex: [3, 3], con: [3, 3], cha: [3, 3] },
        max: { str: [18, 18], int: [18, 18], wis: [18, 18], dex: [18, 18], con: [18, 18], cha: [18, 18] },
        adj: {}, strExcMax: [100, 50], infravision: 0, saveBonus: false, extraLangRule: 'table', extraLangCap: null,
        languages: [], limits: { Cleric: Infinity, Druid: Infinity, Fighter: Infinity, Paladin: Infinity, Ranger: Infinity, 'Magic-User': Infinity, Illusionist: Infinity, Thief: Infinity, Assassin: Infinity, Monk: Infinity },
        multi: []
    }),
    'Dwarf': R({
        min: { str: [8, 8], int: [3, 3], wis: [3, 3], dex: [3, 3], con: [12, 12], cha: [3, 3] },
        max: { str: [18, 17], int: [18, 18], wis: [18, 18], dex: [17, 17], con: [19, 19], cha: [16, 16] },
        adj: { con: 1, cha: -1 }, strExcMax: [99, 0], infravision: 60, saveBonus: true, extraLangRule: 'cap2', extraLangCap: 2,
        languages: ['Dwarvish', 'Gnome', 'Goblin', 'Kobold', 'Orcish'],
        limits: { Fighter: 9, Thief: Infinity, Assassin: 9 }, npcOnly: ['Cleric'],
        multi: [['Fighter', 'Thief']]
    }),
    'Elf': R({
        min: { str: [3, 3], int: [8, 8], wis: [3, 3], dex: [7, 7], con: [6, 6], cha: [8, 8] },
        max: { str: [18, 16], int: [18, 18], wis: [18, 18], dex: [19, 19], con: [18, 18], cha: [18, 18] },
        adj: { dex: 1, con: -1 }, strExcMax: [75, 0], infravision: 60, saveBonus: false, extraLangRule: 'above', extraLangAbove: 15, extraLangCap: null,
        languages: ['Elvish', 'Gnome', 'Halfling', 'Goblin', 'Hobgoblin', 'Orcish', 'Gnoll'],
        limits: { Fighter: 7, 'Magic-User': 11, Thief: Infinity, Assassin: 10 }, npcOnly: ['Cleric'],
        multi: [['Fighter', 'Magic-User'], ['Fighter', 'Thief'], ['Magic-User', 'Thief'], ['Fighter', 'Magic-User', 'Thief']]
    }),
    'Gnome': R({
        min: { str: [6, 6], int: [7, 7], wis: [3, 3], dex: [3, 3], con: [8, 8], cha: [3, 3] },
        max: { str: [18, 15], int: [18, 18], wis: [18, 18], dex: [18, 18], con: [18, 18], cha: [18, 18] },
        adj: {}, strExcMax: [50, 0], infravision: 60, saveBonus: true, extraLangRule: 'cap2', extraLangCap: 2,
        languages: ['Dwarvish', 'Gnome', 'Halfling', 'Goblin', 'Kobold', 'Burrowing mammals'],
        limits: { Fighter: 6, Illusionist: 7, Thief: Infinity, Assassin: 8 }, npcOnly: ['Cleric'],
        multi: [['Fighter', 'Illusionist'], ['Fighter', 'Thief'], ['Illusionist', 'Thief']]
    }),
    'Half-Elf': R({
        min: { str: [3, 3], int: [4, 4], wis: [3, 3], dex: [6, 6], con: [6, 6], cha: [3, 3] },
        max: { str: [18, 17], int: [18, 18], wis: [18, 18], dex: [18, 18], con: [18, 18], cha: [18, 18] },
        adj: {}, strExcMax: [90, 0], infravision: 60, saveBonus: false, extraLangRule: 'above', extraLangAbove: 16, extraLangCap: null,
        languages: ['Elvish', 'Gnome', 'Halfling', 'Goblin', 'Hobgoblin', 'Orcish', 'Gnoll'],
        limits: { Cleric: 5, Druid: Infinity, Fighter: 8, Ranger: 8, 'Magic-User': 8, Thief: Infinity, Assassin: 11 },
        multi: [['Cleric', 'Fighter'], ['Cleric', 'Ranger'], ['Cleric', 'Magic-User'], ['Fighter', 'Magic-User'], ['Fighter', 'Thief'], ['Magic-User', 'Thief'], ['Cleric', 'Fighter', 'Magic-User'], ['Fighter', 'Magic-User', 'Thief']]
    }),
    'Halfling': R({
        min: { str: [6, 6], int: [6, 6], wis: [3, 3], dex: [8, 8], con: [10, 10], cha: [3, 3] },
        max: { str: [17, 14], int: [18, 18], wis: [17, 17], dex: [18, 18], con: [19, 19], cha: [18, 18] },
        adj: { str: -1, dex: 1 }, strExcMax: [0, 0], infravision: 0, saveBonus: true, extraLangRule: 'above', extraLangAbove: 16, extraLangCap: null,
        languages: ['Dwarvish', 'Elvish', 'Gnome', 'Goblin', 'Halfling', 'Orcish'],
        limits: { Fighter: 6, Thief: Infinity }, npcOnly: ['Druid'],
        multi: [['Fighter', 'Thief']]
    }),
    'Half-Orc': R({
        min: { str: [6, 6], int: [3, 3], wis: [3, 3], dex: [3, 3], con: [13, 13], cha: [3, 3] },
        max: { str: [18, 18], int: [17, 17], wis: [14, 14], dex: [17, 17], con: [19, 19], cha: [12, 12] },
        adj: { str: 1, con: 1, cha: -2 }, strExcMax: [99, 75], infravision: 60, saveBonus: false, extraLangRule: 'cap2', extraLangCap: 2,
        languages: ['Orcish'],
        limits: { Cleric: 4, Fighter: 10, Thief: 8, Assassin: Infinity },
        multi: [['Cleric', 'Fighter'], ['Cleric', 'Thief'], ['Cleric', 'Assassin'], ['Fighter', 'Thief'], ['Fighter', 'Assassin']]
    })
};
// races whose rolled charisma is kept for dealings with their own kind (PHB p.16, p.17)
const CHA_KEPT = { 'Dwarf': 16, 'Half-Orc': 12 };
const HALFLING_SUBRACES = ['Hairfoot', 'Tallfellow', 'Stout'];

/* ---------------- classes ---------------- */
// xp = XP needed for level 1,2,3... (PHB class tables). after = XP per level past the table. hpAfter = hp per level after maxHD.
const ALL9 = ALIGNMENTS.slice();
function C(o) { return o; }
const CLASSES = {
    'Cleric': C({ req: { wis: 9 }, hd: 8, initialHD: 1, maxHD: 9, hpAfter: 2, group: 'Cleric', parent: 'Cleric',
        xp: [0, 1501, 3001, 6001, 13001, 27501, 55001, 110001, 225001, 450001, 675001, 900001], after: 225000,
        titles: ['Acolyte', 'Adept', 'Priest', 'Curate', 'Canon', 'Lama', 'Patriarch', 'High Priest'],
        align: NO_N, bonusReq: ['wis'], weapons: ['club', 'flail', 'hammer', 'mace', 'staff'], armor: 'any', shield: 'any',
        profs: 2, nonProf: -3, profEvery: 4, money: '3d6*10', ageCol: 0, saveClass: 'Cleric', attackClass: 'Cleric', spellType: 'cleric' }),
    'Druid': C({ req: { wis: 12, cha: 15 }, hd: 8, initialHD: 1, maxHD: 14, hpAfter: 2, group: 'Cleric', parent: 'Cleric',
        xp: [0, 2001, 4001, 7501, 12501, 20001, 35001, 60001, 90001, 125001, 200001, 300001, 750001, 1500001], after: 0, maxLevel: 14,
        align: ['N'], bonusReq: ['wis', 'cha'], weapons: ['club', 'dagger', 'dart', 'hammer', 'scimitar', 'sling', 'spear', 'staff'],
        armor: 'leather', shield: 'wooden', profs: 2, nonProf: -4, profEvery: 5, money: '3d6*10', ageCol: 0, saveClass: 'Cleric', attackClass: 'Cleric', spellType: 'druid' }),
    'Fighter': C({ req: { str: 9, con: 7 }, hd: 10, initialHD: 1, maxHD: 9, hpAfter: 3, group: 'Fighter', parent: 'Fighter',
        xp: [0, 2001, 4001, 8001, 18001, 35001, 70001, 125001, 250001, 500001, 750001, 1000001], after: 250000,
        align: ALL9, bonusReq: ['str'], weapons: 'any', armor: 'any', shield: 'any', profs: 4, nonProf: -2, profEvery: 3, money: '5d4*10', ageCol: 1, saveClass: 'Fighter', attackClass: 'Fighter' }),
    'Paladin': C({ req: { str: 12, int: 9, wis: 13, con: 9, cha: 17 }, hd: 10, initialHD: 1, maxHD: 9, hpAfter: 3, group: 'Fighter', parent: 'Fighter',
        xp: [0, 2751, 5501, 12001, 24001, 45001, 95001, 175001, 350001, 700001, 1050001, 1400001], after: 350000,
        align: ['LG'], bonusReq: ['str', 'wis'], weapons: 'any', armor: 'any', shield: 'any', profs: 3, nonProf: -2, profEvery: 3, money: '5d4*10', ageCol: 1, saveClass: 'Fighter', attackClass: 'Fighter', saveAdj: 2, spellType: 'paladin' }),
    'Ranger': C({ req: { str: 13, int: 13, wis: 14, con: 14 }, hd: 8, initialHD: 2, maxHD: 11, hpAfter: 2, group: 'Fighter', parent: 'Fighter',
        xp: [0, 2251, 4501, 10001, 20001, 40001, 90001, 150001, 225001, 325001, 650001, 975001, 1300001], after: 325000,
        align: ['LG', 'NG', 'CG'], bonusReq: ['str', 'int', 'wis'], weapons: 'any', armor: 'any', shield: 'any', profs: 3, nonProf: -2, profEvery: 3, money: '5d4*10', ageCol: 1, saveClass: 'Fighter', attackClass: 'Fighter', spellType: 'ranger' }),
    'Magic-User': C({ req: { int: 9, dex: 6 }, hd: 4, initialHD: 1, maxHD: 11, hpAfter: 1, group: 'Magic-User', parent: 'Magic-User',
        xp: [0, 2501, 5001, 10001, 22501, 40001, 60001, 90001, 135001, 250001, 375001, 750001, 1125001, 1500001, 1875001, 2250001, 2625001, 3000001, 3375001], after: 375000,
        align: ALL9, bonusReq: ['int'], weapons: ['dagger', 'dart', 'staff'], armor: 'none', shield: 'none', profs: 1, nonProf: -5, profEvery: 6, money: '2d4*10', ageCol: 2, saveClass: 'Magic-User', attackClass: 'Magic-User', spellType: 'mu' }),
    'Illusionist': C({ req: { int: 15, dex: 16 }, hd: 4, initialHD: 1, maxHD: 10, hpAfter: 1, group: 'Magic-User', parent: 'Magic-User',
        xp: [0, 2251, 4501, 9001, 18001, 35001, 60001, 95001, 145001, 220001, 440001, 660001], after: 220000,
        align: ALL9, bonusReq: [], weapons: ['dagger', 'dart', 'staff'], armor: 'none', shield: 'none', profs: 1, nonProf: -5, profEvery: 6, money: '2d4*10', ageCol: 2, saveClass: 'Magic-User', attackClass: 'Magic-User', spellType: 'ill' }),
    'Thief': C({ req: { dex: 9 }, hd: 6, initialHD: 1, maxHD: 10, hpAfter: 2, group: 'Thief', parent: 'Thief',
        xp: [0, 1251, 2501, 5001, 10001, 20001, 42501, 70001, 110001, 160001, 220001, 440001, 660001], after: 220000,
        align: ['NG', 'LN', 'N', 'CN', 'LE', 'NE', 'CE'], bonusReq: ['dex'], weapons: ['club', 'dagger', 'dart', 'sling', 'sword'], swordNot: ['Sword, Bastard', 'Sword, Two-handed'],
        armor: 'leather', shield: 'none', profs: 2, nonProf: -3, profEvery: 4, money: '2d6*10', ageCol: 3, saveClass: 'Thief', attackClass: 'Thief', thiefSkills: 'thief' }),
    'Assassin': C({ req: { str: 12, int: 11, dex: 12 }, hd: 6, initialHD: 1, maxHD: 15, hpAfter: 2, group: 'Thief', parent: 'Thief',
        xp: [0, 1501, 3001, 6001, 12001, 25001, 50001, 100001, 200001, 300001, 425001, 575001, 750001, 1000001, 1500001], after: 0, maxLevel: 14, /* PHB p.19 prints 14 (Master of Assassins) though the table runs to 15 */
        align: ['LE', 'NE', 'CE'], bonusReq: [], weapons: 'any', armor: 'leather', shield: 'any', profs: 3, nonProf: -2, profEvery: 4, money: '2d6*10', ageCol: 3, saveClass: 'Thief', attackClass: 'Thief', thiefSkills: 'assassin' }),
    'Monk': C({ req: { str: 15, wis: 15, dex: 15, con: 11 }, hd: 4, initialHD: 2, maxHD: 18, hpAfter: 0, group: 'Thief', parent: 'Monk',
        xp: [0, 2251, 4751, 10001, 22501, 47501, 98001, 200001, 350001, 500001, 700001, 950001, 1250001, 1750001, 2250001, 2750001, 3250001], after: 0, maxLevel: 17,
        align: ['LG', 'LN', 'LE'], bonusReq: [], weapons: ['bo', 'club', 'crossbow', 'axe-hand', 'dagger', 'javelin', 'jo', 'pole', 'spear', 'staff'], armor: 'none', shield: 'none',
        profs: 1, nonProf: -3, profEvery: 2, money: '5d4', ageCol: 3, saveClass: 'Thief', attackClass: 'Cleric', thiefSkills: 'monk' })
};
const CLASS_ORDER = ['Cleric', 'Druid', 'Fighter', 'Paladin', 'Ranger', 'Magic-User', 'Illusionist', 'Thief', 'Assassin', 'Monk'];
const FIGHTER_TYPES = ['Fighter', 'Paladin', 'Ranger'];

const MULTICLASS = {};
Object.keys(RACES).forEach(r => { MULTICLASS[r] = RACES[r].multi; });

// Monk table II PHB p.31: [title, AC, move, attacks/round, open hand damage lo, hi]
const MONK_TABLE = [null,
    ['Novice', 10, 15, '1', 1, 3], ['Initiate', 9, 16, '1', 1, 4], ['Brother', 8, 17, '1', 1, 6], ['Disciple', 7, 18, '5/4', 1, 6],
    ['Immaculate', 7, 19, '5/4', 2, 7], ['Master', 6, 20, '3/2', 2, 8], ['Superior Master', 5, 21, '3/2', 3, 9], ['Master of Dragons', 4, 22, '3/2', 2, 12],
    ['Master of the North Wind', 3, 23, '2', 3, 12], ['Master of the West Wind', 3, 24, '2', 3, 13], ['Master of the South Wind', 2, 25, '5/2', 4, 13],
    ['Master of the East Wind', 1, 26, '5/2', 4, 16], ['Master of Winter', 0, 27, '5/2', 5, 17], ['Master of Autumn', -1, 28, '3', 5, 20],
    ['Master of Summer', -1, 29, '3', 6, 24], ['Master of Spring', -2, 30, '4', 5, 30], ['Grand Master of Flowers', -3, 32, '4', 8, 32]
];

/* ---------------- spell slots (PHB p.20-26) ---------------- */
const SPELL_SLOTS = {
  cleric: [null,
    [1, 0, 0, 0, 0, 0, 0],
    [2, 0, 0, 0, 0, 0, 0],
    [2, 1, 0, 0, 0, 0, 0],
    [3, 2, 0, 0, 0, 0, 0],
    [3, 3, 1, 0, 0, 0, 0],
    [3, 3, 2, 0, 0, 0, 0],
    [3, 3, 2, 1, 0, 0, 0],
    [3, 3, 3, 2, 0, 0, 0],
    [4, 4, 3, 2, 1, 0, 0],
    [4, 4, 3, 3, 2, 0, 0],
    [5, 4, 4, 3, 2, 1, 0],
    [6, 5, 5, 3, 2, 2, 0],
    [6, 6, 6, 4, 2, 2, 0],
    [6, 6, 6, 5, 3, 2, 0],
    [7, 7, 7, 5, 4, 2, 0],
    [7, 7, 7, 6, 5, 3, 1],
    [8, 8, 8, 6, 5, 3, 1],
    [8, 8, 8, 7, 6, 4, 1],
    [9, 9, 9, 7, 6, 4, 2],
    [9, 9, 9, 8, 7, 5, 2],
    [9, 9, 9, 9, 8, 6, 2],
    [9, 9, 9, 9, 9, 6, 3],
    [9, 9, 9, 9, 9, 7, 3],
    [9, 9, 9, 9, 9, 8, 3],
    [9, 9, 9, 9, 9, 8, 4],
    [9, 9, 9, 9, 9, 9, 4],
    [9, 9, 9, 9, 9, 9, 5],
    [9, 9, 9, 9, 9, 9, 6],
    [9, 9, 9, 9, 9, 9, 7]
],
  druid: [null,
    [2, 0, 0, 0, 0, 0, 0],
    [2, 1, 0, 0, 0, 0, 0],
    [3, 2, 1, 0, 0, 0, 0],
    [4, 2, 2, 0, 0, 0, 0],
    [4, 3, 2, 0, 0, 0, 0],
    [4, 3, 2, 1, 0, 0, 0],
    [4, 4, 3, 1, 0, 0, 0],
    [4, 4, 3, 2, 0, 0, 0],
    [5, 4, 3, 2, 1, 0, 0],
    [5, 4, 3, 3, 2, 0, 0],
    [5, 5, 3, 3, 2, 1, 0],
    [5, 5, 4, 4, 3, 2, 1],
    [6, 5, 5, 5, 4, 3, 2],
    [6, 6, 6, 6, 5, 4, 3]
],
  mu: [null,
    [1, 0, 0, 0, 0, 0, 0, 0, 0],
    [2, 0, 0, 0, 0, 0, 0, 0, 0],
    [2, 1, 0, 0, 0, 0, 0, 0, 0],
    [3, 2, 0, 0, 0, 0, 0, 0, 0],
    [4, 2, 1, 0, 0, 0, 0, 0, 0],
    [4, 2, 2, 0, 0, 0, 0, 0, 0],
    [4, 3, 2, 1, 0, 0, 0, 0, 0],
    [4, 3, 3, 2, 0, 0, 0, 0, 0],
    [4, 3, 3, 2, 1, 0, 0, 0, 0],
    [4, 4, 3, 2, 2, 0, 0, 0, 0],
    [4, 4, 4, 3, 3, 0, 0, 0, 0],
    [4, 4, 4, 4, 4, 1, 0, 0, 0],
    [5, 5, 5, 4, 4, 2, 0, 0, 0],
    [5, 5, 5, 4, 4, 2, 1, 0, 0],
    [5, 5, 5, 5, 5, 2, 1, 0, 0],
    [5, 5, 5, 5, 5, 3, 2, 1, 0],
    [5, 5, 5, 5, 5, 3, 3, 2, 0],
    [5, 5, 5, 5, 5, 3, 3, 2, 1],
    [5, 5, 5, 5, 5, 3, 3, 3, 1],
    [5, 5, 5, 5, 5, 4, 3, 3, 2],
    [5, 5, 5, 5, 5, 4, 4, 4, 2],
    [5, 5, 5, 5, 5, 5, 4, 4, 3],
    [5, 5, 5, 5, 5, 5, 5, 5, 3],
    [5, 5, 5, 5, 5, 5, 5, 5, 4],
    [5, 5, 5, 5, 5, 5, 5, 5, 5],
    [6, 6, 6, 6, 5, 5, 5, 5, 5],
    [6, 6, 6, 6, 6, 6, 6, 5, 5],
    [6, 6, 6, 6, 6, 6, 6, 6, 6],
    [7, 7, 7, 7, 6, 6, 6, 6, 6]
],
  ill: [null,
    [1, 0, 0, 0, 0, 0, 0],
    [2, 0, 0, 0, 0, 0, 0],
    [2, 1, 0, 0, 0, 0, 0],
    [3, 2, 0, 0, 0, 0, 0],
    [4, 2, 1, 0, 0, 0, 0],
    [4, 2, 2, 0, 0, 0, 0],
    [4, 3, 2, 1, 0, 0, 0],
    [4, 3, 3, 2, 0, 0, 0],
    [4, 3, 3, 2, 1, 0, 0],
    [4, 4, 3, 2, 2, 0, 0],
    [4, 4, 4, 3, 3, 0, 0],
    [4, 4, 4, 4, 4, 1, 0],
    [5, 5, 5, 4, 4, 2, 0],
    [5, 5, 5, 4, 4, 2, 1],
    [5, 5, 5, 5, 5, 2, 1],
    [5, 5, 5, 5, 5, 3, 2],
    [5, 5, 5, 5, 5, 3, 3],
    [5, 5, 5, 5, 5, 3, 3],
    [5, 5, 5, 5, 5, 3, 3],
    [5, 5, 5, 5, 5, 4, 3],
    [5, 5, 5, 5, 5, 4, 4],
    [5, 5, 5, 5, 5, 5, 4],
    [5, 5, 5, 5, 5, 5, 5],
    [6, 6, 6, 6, 5, 5, 5],
    [6, 6, 6, 6, 6, 6, 6],
    [7, 7, 7, 7, 6, 6, 6]
],
  // PHB p.24: paladin clerical spells (level 9-20), ranger druidic and magic-user spells (level 8-17, p.25)
  paladin: { 9: [1], 10: [2], 11: [2, 1], 12: [2, 2], 13: [2, 2, 1], 14: [3, 2, 1], 15: [3, 2, 1, 1], 16: [3, 3, 1, 1], 17: [3, 3, 2, 1], 18: [3, 3, 3, 1], 19: [3, 3, 3, 2], 20: [3, 3, 3, 3] },
  rangerDruid: { 8: [1], 9: [1], 10: [2], 11: [2], 12: [2, 1], 13: [2, 1], 14: [2, 2], 15: [2, 2], 16: [2, 2, 1], 17: [2, 2, 2] },
  rangerMU: { 8: [0], 9: [1], 10: [1], 11: [2], 12: [2, 1], 13: [2, 1], 14: [2, 2], 15: [2, 2], 16: [2, 2], 17: [2, 2] }
};

// THIEF  PHB p.28  [level, pick pockets, open locks, traps, move silently, hide, hear noise, climb walls, read languages]
const THIEF_BASE = [null,
    [30, 25, 20, 15, 10, 10, 85.0, 0],
    [35, 29, 25, 21, 15, 10, 86.0, 0],
    [40, 33, 30, 27, 20, 15, 87.0, 0],
    [45, 37, 35, 33, 25, 15, 88.0, 20],
    [50, 42, 40, 40, 31, 20, 90.0, 25],
    [55, 47, 45, 47, 37, 20, 92.0, 30],
    [60, 52, 50, 55, 43, 25, 94.0, 35],
    [65, 57, 55, 62, 49, 25, 96.0, 40],
    [70, 62, 60, 70, 56, 30, 98.0, 45],
    [80, 67, 65, 78, 63, 30, 99.0, 50],
    [90, 72, 70, 86, 70, 35, 99.1, 55],
    [100, 77, 75, 94, 77, 35, 99.2, 60],
    [105, 82, 80, 99, 85, 40, 99.3, 65],
    [110, 87, 85, 99, 93, 40, 99.4, 70],
    [115, 92, 90, 99, 99, 50, 99.5, 75],
    [125, 97, 95, 99, 99, 50, 99.6, 80],
    [125, 99, 99, 99, 99, 55, 99.7, 80]
];
// racial adjustments, same column order (read languages last)
const THIEF_RACE = {"Dwarf": [0, 10, 15, 0, 0, 0, -10, -5], "Elf": [5, -5, 0, 5, 10, 5, 0, 0], "Gnome": [0, 5, 10, 5, 5, 10, -15, 0], "Half-Elf": [10, 0, 0, 0, 5, 0, 0, 0], "Halfling": [5, 5, 5, 10, 15, 5, -15, -5], "Half-Orc": [-5, 5, 5, 0, 0, 5, 5, -10]};
const THIEF_RACE_KEYS = {'Dwarf':'Dwarf','Elf':'Elf','Gnome':'Gnome','Half-Elf':'Half-Elf','Halfling':'Halfling','Half-Orc':'Half-Orc'};
// SAVES  DMG p.79 [level range, death/poison/paralysis, petrification/polymorph, rod/staff/wand, breath, spell]
const SAVES = {"Cleric": [["1-3", 10, 13, 14, 16, 15], ["4-6", 9, 12, 13, 15, 14], ["7-9", 7, 10, 11, 13, 12], ["10-12", 6, 9, 10, 12, 11], ["13-15", 5, 8, 9, 11, 10], ["16-18", 4, 7, 8, 10, 9], ["19+", 2, 5, 6, 8, 7]], "Fighter": [["0", 16, 17, 18, 20, 19], ["1-2", 14, 15, 16, 17, 17], ["3-4", 13, 14, 15, 16, 16], ["5-6", 11, 12, 13, 13, 14], ["7-8", 10, 11, 12, 12, 13], ["9-10", 8, 9, 10, 9, 11], ["11-12", 7, 8, 9, 8, 10], ["13-14", 5, 6, 7, 5, 8], ["15-16", 4, 5, 6, 4, 7], ["17+", 3, 4, 5, 4, 6]], "Magic-User": [["1-5", 14, 13, 11, 15, 12], ["6-10", 13, 11, 9, 13, 10], ["11-15", 11, 9, 7, 11, 8], ["16-20", 10, 7, 5, 9, 6], ["21+", 8, 5, 3, 7, 4]], "Thief": [["1-4", 13, 12, 14, 16, 15], ["5-8", 12, 11, 12, 15, 13], ["9-12", 11, 10, 10, 14, 11], ["13-16", 10, 9, 8, 13, 9], ["17-20", 9, 8, 6, 12, 7], ["21+", 8, 7, 4, 11, 5]]};
// ATTACK MATRICES  DMG p.74: by AC -10..10, target number per level column
const ATTACK = {
  'Cleric': { cols: ["1-3", "4-6", "7-9", "10-12", "13-15", "16-18", "19+"], rows: {'-10': [25, 23, 21, 20, 20, 20, 19], '-9': [24, 22, 20, 20, 20, 19, 18], '-8': [23, 21, 20, 20, 20, 18, 17], '-7': [22, 20, 20, 20, 19, 17, 16], '-6': [21, 20, 20, 20, 18, 16, 15], '-5': [20, 20, 20, 19, 17, 15, 14], '-4': [20, 20, 20, 18, 16, 14, 13], '-3': [20, 20, 19, 17, 15, 13, 12], '-2': [20, 20, 18, 16, 14, 12, 11], '-1': [20, 19, 17, 15, 13, 11, 10], 0: [20, 18, 16, 14, 12, 10, 9], 1: [19, 17, 15, 13, 11, 9, 8], 2: [18, 16, 14, 12, 10, 8, 7], 3: [17, 15, 13, 11, 9, 7, 6], 4: [16, 14, 12, 10, 8, 6, 5], 5: [15, 13, 11, 9, 7, 5, 4], 6: [14, 12, 10, 8, 6, 4, 3], 7: [13, 11, 9, 7, 5, 3, 2], 8: [12, 10, 8, 6, 4, 2, 1], 9: [11, 9, 7, 5, 3, 1, 0], 10: [10, 8, 6, 4, 2, 0, -1]} },
  'Magic-User': { cols: ["1-5", "6-10", "11-15", "16-20", "21+"], rows: {'-10': [26, 24, 21, 20, 20], '-9': [25, 23, 20, 20, 20], '-8': [24, 22, 20, 20, 19], '-7': [23, 21, 20, 20, 18], '-6': [22, 20, 20, 19, 17], '-5': [21, 20, 20, 18, 16], '-4': [20, 20, 20, 17, 15], '-3': [20, 20, 19, 16, 14], '-2': [20, 20, 18, 15, 13], '-1': [20, 20, 17, 14, 12], 0: [20, 19, 16, 13, 11], 1: [20, 18, 15, 12, 10], 2: [19, 17, 14, 11, 9], 3: [18, 16, 13, 10, 8], 4: [17, 15, 12, 9, 7], 5: [16, 14, 11, 8, 6], 6: [15, 13, 10, 7, 5], 7: [14, 12, 9, 6, 4], 8: [13, 11, 8, 5, 3], 9: [12, 10, 7, 4, 2], 10: [11, 9, 6, 3, 1]} },
  'Fighter': { cols: ["0", "1-2", "3-4", "5-6", "7-8", "9-10", "11-12", "13-14", "15-16", "17+"], rows: {'-10': [26, 25, 23, 21, 20, 20, 20, 18, 16, 14], '-9': [25, 24, 22, 20, 20, 20, 19, 17, 15, 13], '-8': [24, 23, 21, 20, 20, 20, 18, 16, 14, 12], '-7': [23, 22, 20, 20, 20, 19, 17, 15, 13, 11], '-6': [22, 21, 20, 20, 20, 18, 16, 14, 12, 10], '-5': [21, 20, 20, 20, 19, 17, 15, 13, 11, 9], '-4': [20, 20, 20, 20, 18, 16, 14, 12, 10, 8], '-3': [20, 20, 20, 19, 17, 15, 13, 11, 9, 7], '-2': [20, 20, 20, 18, 16, 14, 12, 10, 8, 6], '-1': [20, 20, 19, 17, 15, 13, 11, 9, 7, 5], 0: [20, 20, 18, 16, 14, 12, 10, 8, 6, 4], 1: [20, 19, 17, 15, 13, 11, 9, 7, 5, 3], 2: [19, 18, 16, 14, 12, 10, 8, 6, 4, 2], 3: [18, 17, 15, 13, 11, 9, 7, 5, 3, 1], 4: [17, 16, 14, 12, 10, 8, 6, 4, 2, 0], 5: [16, 15, 13, 11, 9, 7, 5, 3, 1, -1], 6: [15, 14, 12, 10, 8, 6, 4, 2, 0, -2], 7: [14, 13, 11, 9, 7, 5, 3, 1, -1, -3], 8: [13, 12, 10, 8, 6, 4, 2, 0, -2, -4], 9: [12, 11, 9, 7, 5, 3, 1, -1, -3, -5], 10: [11, 10, 8, 6, 4, 2, 0, -2, -4, -6]} },
  'Thief': { cols: ["1-4", "5-8", "9-12", "13-16", "17-20", "21+"], rows: {'-10': [26, 24, 21, 20, 20, 20], '-9': [25, 23, 20, 20, 20, 19], '-8': [24, 22, 20, 20, 20, 18], '-7': [23, 21, 20, 20, 19, 17], '-6': [22, 20, 20, 20, 18, 16], '-5': [21, 20, 20, 19, 17, 15], '-4': [20, 20, 20, 18, 16, 14], '-3': [20, 20, 19, 17, 15, 13], '-2': [20, 20, 18, 16, 14, 12], '-1': [20, 20, 17, 15, 13, 11], 0: [20, 19, 16, 14, 12, 10], 1: [20, 18, 15, 13, 11, 9], 2: [19, 17, 14, 12, 10, 8], 3: [18, 16, 13, 11, 9, 7], 4: [17, 15, 12, 10, 8, 6], 5: [16, 14, 11, 9, 7, 5], 6: [15, 13, 10, 8, 6, 4], 7: [14, 12, 9, 7, 5, 3], 8: [13, 11, 8, 6, 4, 2], 9: [12, 10, 7, 5, 3, 1], 10: [11, 9, 6, 4, 2, 0]} },
};

/* ---------------- equipment ----------------
 * Prices PHB p.35-36 in copper pieces (10 cp = 1 sp, 20 sp = 1 gp, so 200 cp = 1 gp).
 * Weights in pounds = gold-piece weight / 10 (PHB p.9, p.101).  Weapon weight and damage PHB p.37,
 * length PHB p.38.  Armor weight DMG p.27.  Gear weight DMG p.225 (Appendix O); est:true = the books
 * give no weight, value kept from v1.8.0 (INTERPRETATION).
 * Weapon tuple: name, cp, lb, dmg S/M, dmg L, length ft, kind, ui category
 *   cat: s swords, r ranged, p pole/mounted, b blunt, a axe/dagger.   ammo: launcher kind.  */
function W(n, c, w, dm, dl, len, kind, cat, extra) { return Object.assign({ n, c, w, dm, dl, len, kind, cat }, extra || {}); }
const WEAPONS = [
    W('Arrow, normal (single)', 20, 0.2, '1d6', '1d6', 0, 'ammo', 'r', { ammo: 'bow', bulk: true }),
    W('Arrow, normal (12)', 200, 2.4, '1d6', '1d6', 0, 'ammo', 'r', { ammo: 'bow', bulk: true }),
    W('Arrow, silver (single)', 200, 0.2, '1d6', '1d6', 0, 'ammo', 'r', { ammo: 'bow', bulk: true }),
    W('Axe, battle', 1000, 7.5, '1d8', '1d4', 4, 'axe', 'a'),
    W('Axe, hand or throwing', 200, 5, '1d6', '1d4', 1.5, 'axe-hand', 'a'),
    W('Bardiche', 1400, 12.5, '2d8', '3d12', 5, 'pole', 'p', { pole: true }),
    W('Bec de corbin', 1200, 10, '1d8', '1d6', 6, 'pole', 'p', { pole: true }),
    W('Bill-Guisarme', 1200, 15, '2d8', '1d10', 8, 'pole', 'p', { pole: true }),
    W('Bo Stick', 0, 1.5, '1d6', '1d3', 5, 'bo', 'b', { unpriced: true }),
    W('Bow, composite short', 15000, 5, '', '', 0, 'bow', 'r'),
    W('Bow, composite long', 20000, 8, '', '', 0, 'bow', 'r'),
    W('Bow, long', 12000, 10, '', '', 0, 'bow', 'r', { longbow: true }),
    W('Bow, short', 3000, 5, '', '', 0, 'bow', 'r'),
    W('Club', 0, 3, '1d6', '1d3', 3, 'club', 'b', { unpriced: true }),
    W('Crossbow, heavy', 4000, 8, '', '', 0, 'crossbow', 'r', { heavyXbow: true }),
    W('Crossbow, light', 2400, 5, '', '', 0, 'crossbow', 'r'),
    W('Dagger and scabbard', 400, 1, '1d4', '1d3', 1.25, 'dagger', 'a'),
    W('Dart', 50, 0.5, '1d3', '1d2', 0, 'dart', 'r'),
    W('Fauchard', 600, 6, '1d6', '1d8', 8, 'pole', 'p', { pole: true }),
    W('Fauchard-Fork', 1600, 8, '1d8', '1d10', 8, 'pole', 'p', { pole: true }),
    W("Flail, footman's", 600, 15, '2d7', '2d8', 4, 'flail', 'b'),
    W("Flail, horseman's", 1600, 3.5, '2d5', '2d5', 2, 'flail', 'b'),
    W('Fork, Military', 800, 7.5, '1d8', '2d8', 7, 'pole', 'p', { pole: true }),
    W('Glaive', 1200, 7.5, '1d6', '1d10', 8, 'pole', 'p', { pole: true }),
    W('Glaive-Guisarme', 2000, 10, '2d8', '2d12', 8, 'pole', 'p', { pole: true }),
    W('Guisarme', 1000, 8, '2d8', '1d8', 6, 'pole', 'p', { pole: true }),
    W('Guisarme-Voulge', 1400, 15, '2d8', '2d8', 7, 'pole', 'p', { pole: true }),
    W('Halberd', 1800, 17.5, '1d10', '2d12', 5, 'pole', 'p', { pole: true }),
    W('Hammer, Lucern', 1400, 15, '2d8', '1d6', 5, 'pole', 'p', { pole: true }),
    W('Hammer', 200, 5, '2d5', '1d4', 1.5, 'hammer', 'b'),
    W('Javelin', 100, 2, '1d6', '1d6', 0, 'javelin', 'r', { bulk: true }),
    W('Jo Stick', 0, 4, '1d6', '1d4', 3, 'jo', 'b', { unpriced: true }),
    W('Lance (light horse)', 1200, 5, '1d6', '1d8', 10, 'lance', 'p'),
    W('Lance (medium horse)', 1200, 10, '2d7', '2d12', 12, 'lance', 'p'),
    W('Lance (heavy horse)', 1200, 15, '3d9', '3d18', 14, 'lance', 'p'),
    W("Mace, footman's", 1600, 10, '2d7', '1d6', 2.5, 'mace', 'b'),
    W("Mace, horseman's", 800, 5, '1d6', '1d4', 1.5, 'mace', 'b'),
    W('Morning Star', 1000, 12.5, '2d8', '2d7', 4, 'morning', 'b'),
    W('Partisan', 2000, 8, '1d6', '2d7', 7, 'pole', 'p', { pole: true }),
    W("Pick, Military, footman's", 1600, 6, '2d7', '2d8', 4, 'pick', 'a'),
    W("Pick, Military, horseman's", 1000, 4, '2d5', '1d4', 2, 'pick', 'a'),
    W('Pike, awl', 600, 8, '1d6', '1d12', 18, 'pole', 'p', { pole: true }),
    W('Quarrel/Bolt, light (single)', 10, 0.1, '1d4', '1d4', 0, 'ammo', 'r', { ammo: 'crossbow', bulk: true }),
    W('Quarrel/Bolt, heavy (20)', 400, 4, '2d5', '2d7', 0, 'ammo', 'r', { ammo: 'crossbow', bulk: true }),
    W('Ranseur', 800, 5, '2d8', '2d8', 8, 'pole', 'p', { pole: true }),
    W('Scimitar', 3000, 4, '1d8', '1d8', 3, 'scimitar', 's'),
    W('Sling & bullets (12)', 150, 2.6, '', '', 0, 'sling', 'r'),
    W('Sling bullets (20)', 100, 4, '2d5', '2d7', 0, 'ammo', 'r', { ammo: 'sling', bulk: true }),
    W('Sling stone', 0, 0.1, '1d4', '1d4', 0, 'ammo', 'r', { ammo: 'sling', bulk: true, unpriced: true }),
    W('Spear', 200, 5, '1d6', '1d8', 5, 'spear', 'p'),
    W('Spetum', 600, 5, '2d7', '2d12', 8, 'pole', 'p', { pole: true }),
    W('Staff, Quarter', 0, 5, '1d6', '1d6', 7, 'staff', 'b', { unpriced: true }),
    W('Sword, Bastard & scabbard', 5000, 10, '2d8', '2d16', 4.5, 'sword', 's'),
    W('Sword, Broad & scabbard', 2000, 7.5, '2d8', '2d7', 3.5, 'sword', 's'),
    W('Sword, Long & scabbard', 3000, 6, '1d8', '1d12', 3.5, 'sword', 's'),
    W('Sword, Short & scabbard', 1600, 3.5, '1d6', '1d8', 2, 'sword', 's'),
    W('Sword, Two-handed', 6000, 25, '1d10', '3d18', 6, 'sword', 's'),
    W('Trident', 800, 5, '2d7', '3d12', 6, 'trident', 'p'),
    W('Voulge', 400, 12.5, '2d8', '2d8', 8, 'pole', 'p', { pole: true })
];
// armour: ac = AC value of the suit worn alone (PHB p.36); move = base movement inches (DMG p.27)
function A(n, ac, c, w, move, extra) { return Object.assign({ n, ac, c, w, move }, extra || {}); }
const ARMOR = [
    A('Banded', 4, 18000, 35, 9, { type: 'metal' }), A('Chain', 5, 15000, 30, 9, { type: 'metal' }),
    A('Helmet, great', null, 3000, 10, null, { helm: true }), A('Helmet, small', null, 2000, 4.5, null, { helm: true }),
    A('Leather', 8, 1000, 15, 12, { type: 'leather' }), A('Padded', 8, 800, 10, 9, { type: 'padded' }),
    A('Plate', 3, 80000, 45, 6, { type: 'metal' }), A('Ring', 7, 6000, 25, 9, { type: 'metal' }),
    A('Scale', 6, 9000, 40, 6, { type: 'metal' }),
    A('Shield, large', -1, 3000, 10, null, { shield: true }), A('Shield, small', -1, 2000, 5, null, { shield: true }),
    A('Shield, small, wooden', -1, 200, 3, null, { shield: true, wooden: true }),
    A('Splinted', 4, 16000, 40, 6, { type: 'metal' }), A('Studded', 7, 3000, 20, 9, { type: 'studded' })
];
// gear: cat c clothing, f provisions, t tack/transport, r religious/herbs, m misc. w from DMG p.225 unless est
function G(n, c, w, cat, extra) { return Object.assign({ n, c, w, cat }, extra || {}); }
const GEAR = [
    G('Backpack, leather', 400, 2, 'm'), G('Barding, chain', 50000, 0, 't', { est: true }), G('Barding, leather', 20000, 0, 't', { est: true }),
    G('Barding, plate', 150, 0, 't', { est: true }), G('Beads, Prayer', 200, 0.1, 'r', { est: true }), G('Belladona, sprig', 40, 0, 'r', { bulk: true, est: true }),
    G('Belt', 30, 0.3, 'c'), G('Bit and Bridle', 150, 3, 't', { est: true }), G('Boots, high, hard', 400, 6, 'c'), G('Boots, high, soft', 200, 3, 'c'),
    G('Boots, low, hard', 200, 6, 'c'), G('Boots, low, soft', 80, 3, 'c'), G('Box, iron, large', 5600, 50, 'm', { est: true }), G('Box, iron, small', 1800, 20, 'm', { est: true }),
    G('Candle, tallow', 1, 0.5, 'm', { bulk: true }), G('Candle, wax', 10, 0.5, 'm', { bulk: true }), G('Cap', 10, 3, 'c', { est: true }),
    G('Cart', 10000, 0, 't', { est: true }), G('Case, bone, map or scroll', 1000, 5, 'm'), G('Case, leather, map or scroll', 150, 2.5, 'm'),
    G('Chest, wooden, large', 170, 50, 'm'), G('Chest, wooden, small', 80, 10, 'm'), G('Cloak', 50, 2.5, 'c'),
    G('Garlic, bud', 5, 0, 'r', { bulk: true, est: true }), G('Girdle, broad', 400, 1, 'c', { est: true }), G('Girdle, normal', 100, 0.5, 'c', { est: true }),
    G('Harness', 120, 0, 't', { est: true }), G('Hat', 70, 1, 'c', { est: true }), G('Incense, stick', 200, 0.1, 'r', { bulk: true, est: true }),
    G('Lantern, bullseye', 2400, 6, 'm'), G('Lantern, hooded', 1400, 6, 'm'), G('Mirror, large metal', 2000, 5, 'm', { est: true }), G('Mirror, small, silver', 4000, 0.5, 'm'),
    G('Oil, flask of', 200, 2, 'm', { bulk: true }), G('Pole, 10\'', 3, 10, 'm'), G('Pouch, belt, large', 200, 1, 'm'), G('Pouch, belt, small', 150, 0.5, 'm'),
    G('Quiver, 1 doz. arrows cap.', 80, 3, 'm'), G('Quiver, 1 score arrows cap.', 120, 3, 'm'), G('Quiver, 1 score bolts cap.', 150, 3, 'm'), G('Quiver, 2 score bolts cap.', 200, 3, 'm'),
    G('Robe', 60, 2.5, 'c'), G('Rope, 50\'', 80, 7.5, 'm'), G('Sack, large', 16, 2, 'm'), G('Sack, small', 10, 0.5, 'm'), G('Saddle', 2000, 25, 't'),
    G('Saddle Bags, large', 800, 15, 't'), G('Saddle Bags, small', 600, 10, 't', { est: true }), G('Saddle Blanket', 30, 2, 't'),
    G('Skin for water or wine', 150, 5, 'm'), G('Spike, iron, large', 1, 1, 'm', { bulk: true }),
    G('Symbol, Holy, iron', 400, 0.5, 'r', { est: true }), G('Symbol, Holy, silver', 10000, 0.5, 'r', { est: true }), G('Symbol, Holy, wooden', 140, 0.5, 'r', { est: true }),
    G("Thieves' picks & tools", 6000, 0, 'm'), G('Tinder Box, with flint & steel', 200, 0.2, 'm'), G('Torch', 1, 2.5, 'm', { bulk: true }),
    G('Water, Holy, vial', 5000, 2.5, 'r', { bulk: true }), G('Wolvesbane, sprig', 100, 0, 'r', { bulk: true, est: true }),
    G('Ale, pint', 10, 2, 'f', { bulk: true, est: true }), G('Beer, small, pint', 5, 2, 'f', { bulk: true, est: true }), G("Food, merchant's meal", 10, 0, 'f', { bulk: true }),
    G('Food, rich meal', 200, 0, 'f', { bulk: true }), G('Grain, horse meal, 1 day', 10, 10, 'f', { bulk: true, est: true }), G('Mead, pint', 50, 2, 'f', { bulk: true, est: true }),
    G('Rations, iron, 1 week', 1000, 7.5, 'f', { bulk: true }), G('Rations, standard, 1 week', 600, 20, 'f', { bulk: true }),
    G('Wine, pint, good', 100, 2, 'f', { bulk: true, est: true }), G('Wine, pint, watered', 50, 2, 'f', { bulk: true, est: true }),
    G('Wagon', 30000, 0, 't', { est: true })
];
const BEASTS = [
    ['Chicken', 3], ['Cow', 2000], ['Dog, guard', 5000], ['Dog, hunting', 3400], ['Donkey', 1600], ['Goat', 200], ['Hawk, large', 8000], ['Hawk, small', 3600],
    ['Horse, draft', 6000], ['Horse, heavy war', 60000], ['Horse, light war', 30000], ['Horse, medium war', 45000], ['Horse, riding (light)', 5000], ['Mule', 4000],
    ['Ox', 3000], ['Pigeon', 2], ['Piglet', 200], ['Pig', 600], ['Pony', 3000], ['Sheep', 400], ['Songbird', 4]
].map(x => ({ n: x[0], c: x[1], w: 0 }));
const EQUIPMENT = { weapons: WEAPONS, armor: ARMOR, gear: GEAR, beasts: BEASTS };

/* ---------------- text tables ---------------- */
// secondary skills DMG p.12 (d100; 00 = 100)
const SECONDARY = [[2, 'Armorer'], [4, 'Bowyer/fletcher'], [10, 'Farmer/gardener'], [14, 'Fisher (netting)'], [20, 'Forester'], [23, 'Gambler'], [27, 'Hunter/fisher (hook and line)'],
    [32, 'Husbandman (animal husbandry)'], [34, 'Jeweler/lapidary'], [37, 'Leather worker/tanner'], [39, 'Limner/painter'], [42, 'Mason/carpenter'], [44, 'Miner'],
    [46, 'Navigator (fresh or salt water)'], [49, 'Sailor (fresh or salt)'], [51, 'Shipwright (boats or ships)'], [54, 'Tailor/weaver'], [57, 'Teamster/freighter'],
    [60, 'Trader/barterer'], [64, 'Trapper/furrier'], [67, 'Woodworker/cabinetmaker'], [85, 'NO SKILL OF MEASURABLE WORTH'], [100, 'ROLL TWICE']];
// starting spells DMG p.39: one from each list by d10 (0 = player's choice); Nystul's and Tenser's never known at start
const MU_START = {
    offensive: ['Burning Hands', 'Charm Person', 'Enlarge', 'Friends', 'Light', 'Magic Missile', 'Push', 'Shocking Grasp', 'Sleep'],
    defensive: ['Affect Normal Fires', 'Dancing Lights', 'Feather Fall', 'Hold Portal', 'Jump', 'Protection From Evil', 'Shield', 'Spider Climb', 'Ventriloquism'],
    misc: ['Comprehend Languages', 'Detect Magic', 'Erase', 'Find Familiar', 'Identify', 'Mending', 'Message', 'Unseen Servant', 'Write']
};
// PHB p.64-70 magic-user 1st level, minus Nystul's Magic Aura and Tenser's Floating Disc (DMG p.39)
const MU_LEVEL1 = ['Affect Normal Fires', 'Burning Hands', 'Charm Person', 'Comprehend Languages', 'Dancing Lights', 'Detect Magic', 'Enlarge', 'Erase', 'Feather Fall', 'Find Familiar',
    'Friends', 'Hold Portal', 'Identify', 'Jump', 'Light', 'Magic Missile', 'Mending', 'Message', 'Mount', 'Protection From Evil', 'Push', 'Read Magic', 'Shield', 'Shocking Grasp',
    'Sleep', 'Spider Climb', 'Unseen Servant', 'Ventriloquism', 'Write'];
// PHB p.94-96 illusionist 1st level (12 spells, d12 per DMG p.39)
const ILL_LEVEL1 = ['Audible Glamer', 'Change Self', 'Color Spray', 'Dancing Lights', 'Darkness', 'Detect Illusion', 'Detect Invisibility', 'Gaze Reflection', 'Hypnotism', 'Light', 'Phantasmal Force', 'Wall Of Fog'];
const LANGUAGES_KNOWABLE = ['Dwarvish', 'Elvish', 'Goblin', 'Halfling', 'Hobgoblin', 'Kobold', 'Lizardman', 'Ogrish', 'Orcish', 'Gnome', 'Gnoll']; // PHB p.34 list + Gnome/Gnoll (PHB p.16, DMG p.102)

/* ---------------- ages (DMG p.12-13) ---------------- */
// age categories [young adult, mature, middle aged, old, venerable] as [lo, hi]
const AGE_CATS = {
    'Dwarf': [[35, 50], [51, 150], [151, 250], [251, 350], [351, 450]],
    'Elf': [[100, 175], [176, 550], [551, 875], [876, 1200], [1201, 1600]],
    'Gnome': [[50, 90], [91, 300], [301, 450], [451, 600], [601, 750]],
    'Half-Elf': [[24, 40], [41, 100], [101, 175], [176, 250], [251, 325]],
    'Halfling': [[22, 33], [34, 68], [69, 101], [102, 144], [145, 199]],
    'Half-Orc': [[12, 15], [16, 30], [31, 45], [46, 60], [61, 80]],
    'Human': [[14, 20], [21, 40], [41, 60], [61, 90], [91, 120]]
};
const AGE_NAMES = ['Young Adult', 'Mature', 'Middle Aged', 'Old', 'Venerable'];
// cumulative ability changes DMG p.13: young adult, mature, middle aged, old, venerable
const AGE_MODS = [{ wis: -1, con: 1 }, { str: 1, wis: 1 }, { str: -1, con: -1, int: 1, wis: 1 }, { str: -2, dex: -2, con: -1, wis: 1 }, { str: -1, dex: -1, con: -1, int: 1, wis: 1 }];
// non-human starting age: [cleric, fighter, magic-user, thief] base + dice (DMG p.12); null = class not open
const START_AGE = {
    'Dwarf': ['250+2d20', '40+5d4', null, '75+3d6'], 'Elf': ['500+10d10', '130+5d6', '150+5d6', '100+5d6'],
    'Gnome': ['300+3d12', '60+5d4', '100+2d12', '80+5d4'], 'Half-Elf': ['40+2d4', '22+3d4', '30+2d8', '22+3d8'],
    'Halfling': [null, '20+3d4', null, '40+2d4'], 'Half-Orc': ['20+1d4', '13+1d4', null, '20+2d4']
};
const HUMAN_AGE = { Cleric: '18+1d4', Druid: '18+1d4', Fighter: '15+1d4', Paladin: '17+1d4', Ranger: '20+1d4', 'Magic-User': '24+2d8', Illusionist: '30+1d6', Thief: '18+1d4', Assassin: '20+1d4', Monk: '21+1d4' };
// height/weight DMG p.102: [base in, under dice, over dice, base lb, under dice, over dice]; chance bands
const HW = {
    m: { 'Dwarf': [48, '1-4', '1-6', 150, '2-16', '2-24'], 'Elf': [60, '1-4', '1-6', 100, '1-10', '1-20'], 'Gnome': [42, '1-3', '1-3', 80, '2-8', '2-12'],
        'Half-Elf': [66, '1-6', '1-6', 130, '1-20', '1-20'], 'Halfling': [36, '1-3', '1-6', 60, '2-8', '2-12'], 'Half-Orc': [66, '1-4', '1-4', 150, '2-16', '4-40'], 'Human': [72, '1-12', '1-12', 175, '3-36', '5-60'] },
    f: { 'Dwarf': [46, '1-4', '1-4', 120, '2-16', '2-20'], 'Elf': [54, '1-4', '1-6', 80, '1-10', '2-12'], 'Gnome': [39, '1-3', '1-3', 75, '1-8', '1-8'],
        'Half-Elf': [62, '1-6', '1-6', 100, '1-12', '2-16'], 'Halfling': [33, '1-3', '1-3', 50, '2-8', '2-8'], 'Half-Orc': [62, '1-3', '1-3', 120, '3-18', '4-32'], 'Human': [66, '1-6', '1-8', 130, '3-30', '4-48'] }
};
// chance bands: [under max, average max] on d100; weight bands separate
const HW_BANDS = { 'Dwarf': [15, 80, 20, 65], 'Elf': [10, 80, 15, 90], 'Gnome': [20, 85, 20, 75], 'Half-Elf': [35, 90, 20, 85], 'Halfling': [10, 90, 10, 50], 'Half-Orc': [45, 75, 30, 55], 'Human': [20, 80, 25, 75] };

/* ---------------- creation helpers ---------------- */
const sexIdx = s => (s === 'f' ? 1 : 0);
const classList = c => (Array.isArray(c) ? c : [c]);
const isFighterType = classes => classList(classes).some(c => FIGHTER_TYPES.indexOf(c) >= 0);

function rollAbilities(method, rng) {
    const d6 = () => die(6, rng);
    if (method === 1) {
        const pool = [];
        for (let i = 0; i < 6; i++) { const r = [d6(), d6(), d6(), d6()].sort((a, b) => b - a); pool.push(r[0] + r[1] + r[2]); }
        return { method, pool };
    }
    if (method === 2) {
        const all = []; for (let i = 0; i < 12; i++) all.push(dice(3, 6, rng));
        return { method, pool: all.sort((a, b) => b - a).slice(0, 6) };
    }
    if (method === 3) {
        const scores = {};
        ABILITIES.forEach(a => { let b = 0; for (let i = 0; i < 6; i++) b = Math.max(b, dice(3, 6, rng)); scores[a] = b; });
        return { method, scores };
    }
    const sets = [];
    for (let s = 0; s < 12; s++) { const o = {}; ABILITIES.forEach(a => { o[a] = dice(3, 6, rng); }); sets.push(o); }
    return { method: 4, sets };
}

// race modifiers first, then minimums on the modified score, then maximums by lowering (PHB p.14-15)
function applyRace(scores, race, sex) {
    const R_ = RACES[race], i = sexIdx(sex), out = {}, adjusted = {}, reasons = [];
    ABILITIES.forEach(a => {
        const v = scores[a] + (R_.adj[a] || 0);
        adjusted[a] = v;
        if (v < R_.min[a][i]) reasons.push(ABILITY_NAMES[a] + ' ' + v + ' is under the ' + race + ' minimum of ' + R_.min[a][i]);
        out[a] = Math.min(v, R_.max[a][i]);
    });
    return { ok: reasons.length === 0, scores: out, adjusted, rolled: Object.assign({}, scores), reasons };
}
function combosAllowed(race, classes) {
    const cl = classList(classes);
    if (cl.length === 1) return true;
    const key = cl.slice().sort().join('/');
    return RACES[race].multi.some(m => m.slice().sort().join('/') === key);
}
function classOk(classes, race, scores) {
    const cl = classList(classes), reasons = [], R_ = RACES[race];
    cl.forEach(c => {
        if (!CLASSES[c]) { reasons.push('Unknown class ' + c); return; }
        if (!(c in R_.limits)) reasons.push(race + 's cannot be ' + c + (R_.npcOnly && R_.npcOnly.indexOf(c) >= 0 ? ' (non-player characters only, PHB p.14)' : ''));
        Object.keys(CLASSES[c].req).forEach(a => {
            let need = CLASSES[c].req[a];
            if (c === 'Cleric' && cl.length > 1 && race === 'Half-Elf') need = 13; // PHB p.20
            if (scores[a] < need) reasons.push(c + ' needs ' + ABILITY_NAMES[a] + ' ' + need);
        });
    });
    if (!combosAllowed(race, cl)) reasons.push(race + 's cannot be ' + cl.join('/'));
    return { ok: reasons.length === 0, reasons };
}
function classesFor(race, scores) {
    const out = [];
    CLASS_ORDER.forEach(c => { if (classOk([c], race, scores).ok) out.push([c]); });
    RACES[race].multi.forEach(m => { if (classOk(m, race, scores).ok) out.push(m.slice()); });
    return out;
}
function alignmentsFor(classes) {
    return ALIGNMENTS.filter(a => classList(classes).every(c => CLASSES[c].align.indexOf(a) >= 0));
}
function levelLimit(char, cls) {
    const R_ = RACES[char.race], s = char.scores, sub = char.subrace || 'Hairfoot';
    if (!(cls in R_.limits)) return 0;
    let lim = R_.limits[cls];
    const by = (v, lo, mid, hi) => (v >= 18 ? hi : v >= 17 ? mid : lo);
    if (char.race === 'Dwarf' && cls === 'Fighter') lim = by(s.str, 7, 8, 9);
    if (char.race === 'Elf' && cls === 'Fighter') lim = by(s.str, 5, 6, 7);
    if (char.race === 'Elf' && cls === 'Magic-User') lim = by(s.int, 9, 10, 11);
    if (char.race === 'Gnome' && cls === 'Fighter') lim = s.str >= 18 ? 6 : 5;
    if (char.race === 'Gnome' && cls === 'Illusionist') lim = Math.min(s.int, s.dex) >= 18 ? 7 : Math.min(s.int, s.dex) >= 17 ? 6 : 5;
    if (char.race === 'Half-Elf' && cls === 'Fighter') lim = by(s.str, 6, 7, 8);
    if (char.race === 'Half-Elf' && cls === 'Magic-User') lim = by(s.int, 6, 7, 8);
    if (char.race === 'Half-Orc' && cls === 'Thief') lim = by(s.dex, 6, 7, 8);
    if (char.race === 'Halfling' && cls === 'Fighter') {
        lim = 4;
        if (sub === 'Tallfellow' && s.str >= 18) lim = 6; else if (sub === 'Tallfellow' && s.str >= 17) lim = 5; else if (sub === 'Stout' && s.str >= 18) lim = 5;
    }
    const cap = CLASSES[cls].maxLevel || Infinity;
    return Math.min(lim, cap);
}
function capStrExc(race, sex, exc) {
    const cap = RACES[race].strExcMax[sexIdx(sex)];
    return cap ? Math.min(exc, cap) : 0;
}
function rollStrExc(char, rng) {
    if (char.scores.str !== 18 || !isFighterType(char.classes)) return 0;
    return capStrExc(char.race, char.sex, die(100, rng));
}
// hit points at 1st level: each hit die rolled, constitution adjusted per die (never below 1), summed,
// then divided by the number of classes rounding .5 up (PHB p.12, p.19)
function rollHP(char, rng) {
    const cl = classList(char.classes), per = [];
    let total = 0;
    cl.forEach(c => {
        const k = CLASSES[c], adj = conRow(char.scores.con, FIGHTER_TYPES.indexOf(c) >= 0).hp;
        for (let i = 0; i < k.initialHD; i++) { const r = die(k.hd, rng); per.push({ class: c, die: k.hd, roll: r, adj }); total += Math.max(1, r + adj); }
    });
    const hp = Math.max(1, Math.floor(total / cl.length + 0.5));
    return { hp, total, perDie: per };
}
function startingGold(classes, rng) {
    const c = classList(classes)[0], expr = CLASSES[c].money;
    return { gp: roll(expr, rng), expr, class: c };
}

/* ---------------- age, height and weight ---------------- */
function ageExpr(char) {
    const cl = classList(char.classes);
    if (char.race === 'Human') return HUMAN_AGE[cl[0]];
    const cols = cl.map(c => START_AGE[char.race][CLASSES[c].ageCol]).filter(Boolean);
    if (cl.length === 1) return cols[0];
    // multi-class: column giving the highest age, taking the greatest possible variable (DMG p.12)
    const mx = e => { const m = /^(\d+)\+(\d+)d(\d+)$/.exec(e); return +m[1] + +m[2] * +m[3]; };
    return cols.sort((a, b) => mx(b) - mx(a))[0];
}
function rollAge(char, rng) {
    const e = ageExpr(char), m = /^(\d+)\+(\d+)d(\d+)$/.exec(e);
    if (classList(char.classes).length > 1) return +m[1] + +m[2] * +m[3];
    return +m[1] + dice(+m[2], +m[3], rng);
}
function ageCategory(race, age) {
    const cats = AGE_CATS[race];
    if (age < cats[0][0]) return -1;
    for (let i = 0; i < 5; i++) if (age <= cats[i][1]) return i;
    return 4;
}
// apply the DMG p.13 ability changes cumulatively from young adult; never past racial maximums or below racial/class minimums
function applyAging(char, rng) {
    const R_ = RACES[char.race], i = sexIdx(char.sex), s = Object.assign({}, char.scores);
    let exc = char.strExc || 0;
    const cat = ageCategory(char.race, char.age), changes = [];
    const mins = {};
    ABILITIES.forEach(a => { mins[a] = R_.min[a][i]; });
    classList(char.classes).forEach(c => Object.keys(CLASSES[c].req).forEach(a => { mins[a] = Math.max(mins[a], CLASSES[c].req[a]); }));
    for (let k = 0; k <= cat; k++) {
        const mod = AGE_MODS[k];
        Object.keys(mod).forEach(a => {
            let d = mod[a];
            const maxv = a === 'wis' ? (R_.max.wis[i] >= 18 ? 99 : R_.max.wis[i]) : R_.max[a][i];
            while (d !== 0) {
                if (d > 0) {
                    if (a === 'str' && s.str >= 18) break;
                    if (s[a] + 1 > maxv) break;
                    s[a]++; d--; changes.push(a + ' +1');
                } else {
                    if (a === 'str' && s.str === 18 && exc > 0) { exc = Math.floor(exc / 2); d++; changes.push('str exceptional halved'); continue; }
                    if (s[a] - 1 < mins[a]) break;
                    s[a]--; d++; changes.push(a + ' -1');
                }
            }
        });
    }
    if (s.str === 18 && !exc && isFighterType(char.classes) && rng) exc = capStrExc(char.race, char.sex, die(100, rng));
    if (s.str !== 18) exc = 0;
    return { scores: s, strExc: exc, category: cat, changes };
}
function rangeRoll(r, rng) { const m = parseRange(r); return between(m[0], m[1], rng); }
function rollHeightWeight(char, rng) {
    const r = (rng || Math.random), t = HW[char.sex === 'f' ? 'f' : 'm'][char.race], b = HW_BANDS[char.race];
    let [baseH, hu, ho, baseW, wu, wo] = t;
    if (char.race === 'Human') { // DMG p.12: wider upper limits for human player characters
        if (char.sex === 'f') { ho = '2-12'; wo = '10-120'; } else { ho = '2-20'; wo = '10-200'; }
    }
    const small = baseH < 60;
    let h = baseH, w = baseW;
    const hr = die(100, r), wr = die(100, r);
    if (hr <= b[0]) h = baseH - rangeRoll(hu, r);
    else if (hr <= b[1]) {
        const a = die(100, r), half = between(1, small ? 7 : 9, r) / 2; // 1-3.5 or 1-4.5 inches
        h = a <= 30 ? baseH - half : a >= 71 ? baseH + half : baseH;
    } else h = baseH + rangeRoll(ho, r);
    if (wr <= b[2]) w = baseW - rangeRoll(wu, r);
    else if (wr <= b[3]) {
        const a = die(100, r), adj = between(1, baseW <= 100 ? 4 : 8, r);
        w = a <= 30 ? baseW - adj : a >= 71 ? baseW + adj : baseW;
    } else w = baseW + rangeRoll(wo, r);
    return { height: h, weight: Math.max(1, w) };
}
function rollSecondarySkill(rng) {
    const one = () => { const x = die(100, rng); return SECONDARY.find(e => x <= e[0])[1]; };
    let s = one();
    if (s === 'ROLL TWICE') { let a = one(), b = one(); while (a === 'ROLL TWICE') a = one(); while (b === 'ROLL TWICE') b = one(); s = a === b ? a : a + ' and ' + b; }
    return s;
}
function spellList(cls) { return cls === 'Illusionist' ? ILL_LEVEL1 : cls === 'Magic-User' ? MU_LEVEL1 : []; }
function rollStartingSpells(classes, rng) {
    const out = [];
    classList(classes).forEach(c => {
        if (c === 'Magic-User') {
            const picks = [['offensive', die(10, rng)], ['defensive', die(10, rng)], ['misc', die(10, rng)]].map(p => ({ list: p[0], roll: p[1], spell: p[1] === 10 ? null : MU_START[p[0]][p[1] - 1] }));
            out.push({ class: c, fixed: ['Read Magic'], picks });
        } else if (c === 'Illusionist') {
            const got = [];
            while (got.length < 3) { const r = die(12, rng); if (got.indexOf(r) < 0) got.push(r); }
            out.push({ class: c, fixed: [], picks: got.map(r => ({ list: 'illusionist', roll: r, spell: ILL_LEVEL1[r - 1] })) });
        }
    });
    return out;
}

/* ---------------- languages (PHB p.15-17, p.34) ---------------- */
function languageSlots(char) {
    const R_ = RACES[char.race], t = intRow(char.scores.int).languages;
    let bonus = t;
    if (R_.extraLangRule === 'cap2') bonus = Math.min(2, t);
    if (R_.extraLangRule === 'above') bonus = Math.max(0, char.scores.int - R_.extraLangAbove);
    const known = ['Common'];
    if (char.alignment) known.push(ALIGN_LANG[char.alignment]);
    R_.languages.forEach(l => known.push(l));
    const cl = classList(char.classes);
    if (cl.indexOf('Druid') >= 0) known.push('Druidic');
    if (cl.indexOf('Thief') >= 0 || cl.indexOf('Assassin') >= 0) known.push("Thieves' Cant");
    return { known, bonus };
}
function languageChoices(char) {
    const k = languageSlots(char).known.concat(char.languages || []);
    return LANGUAGES_KNOWABLE.filter(l => k.indexOf(l) < 0);
}

/* ---------------- equipment rules ---------------- */
function weaponKindOk(c, w) {
    const k = CLASSES[c];
    if (k.weapons === 'any') return true;
    const kind = w.ammo ? w.ammo : w.kind;
    if (k.weapons.indexOf(kind) < 0) return false;
    if (kind === 'sword' && (k.swordNot || []).some(n => w.n.indexOf(n) === 0)) return false;
    return true;
}
function canUseWeapon(classes, w, char) {
    const cl = classList(classes);
    if (!cl.some(c => weaponKindOk(c, w))) return { ok: false, why: 'not a permitted weapon for ' + cl.join('/') + ' (PHB p.19)' };
    if (char) { // PHB p.19 note ***
        if (char.height && char.height < 60 && (w.longbow || w.len > 12)) return { ok: false, why: 'under 5 ft: no longbow or weapon over 12 ft' };
        if (char.weight && char.weight < 100 && (w.heavyXbow || ((w.pole || w.n.indexOf('Two-handed') >= 0) && w.w * 10 > 200))) return { ok: false, why: 'under 100 lb: no heavy crossbow or pole arm/two-handed sword over 200 gp weight' };
    }
    return { ok: true };
}
function canWearArmor(classes, a) {
    const cl = classList(classes);
    const ok = cl.some(c => {
        const k = CLASSES[c];
        if (a.shield) return k.shield === 'any' || (k.shield === 'wooden' && a.wooden);
        if (a.helm) return k.armor === 'any';
        return k.armor === 'any' || (k.armor === 'leather' && a.type === 'leather');
    });
    return ok ? { ok } : { ok, why: 'not permitted for ' + cl.join('/') + ' (PHB p.19)' };
}
function armorClass(char) {
    const cl = classList(char.classes), lv = (char.levels && char.levels.Monk) || 1;
    if (cl.length === 1 && cl[0] === 'Monk') return MONK_TABLE[Math.min(lv, 17)][1]; // PHB p.31; no dex adjustment (p.30)
    let ac = 10, shield = false;
    (char.inventory || []).forEach(i => {
        if (i.ac === undefined || i.ac === null) return;
        if (i.shield || /^Shield/.test(i.n)) shield = true; else if (i.ac < ac) ac = i.ac;
    });
    if (shield) ac -= 1;
    return ac + dexRow(char.scores.dex).defense;
}
function encumbrance(char) {
    const inv = char.inventory || [], cl = classList(char.classes);
    const hasBody = inv.some(i => i.ac !== undefined && i.ac !== null && !i.shield && !/^Shield|^Helmet/.test(i.n));
    let gp = 0;
    inv.forEach(i => { if (hasBody && i.n === 'Helmet, small') return; gp += (i.w || 0) * 10 * (i.qty || 1); }); // DMG p.225
    gp += Math.floor((char.coinsCP || 0) / 200); // one gp of weight per gold piece, INTERPRETATION
    const monk = cl.length === 1 && cl[0] === 'Monk';
    const allowance = monk ? 0 : strRow(char.scores.str, char.strExc || 0).wgt; // PHB p.9; monks get no strength bonus (p.32)
    const base = monk ? MONK_TABLE[Math.min((char.levels && char.levels.Monk) || 1, 17)][2] : 12;
    let armorMove = Infinity;
    inv.forEach(i => { if (i.move) armorMove = Math.min(armorMove, i.move); });
    const lim = [350, 700, 1050, 1500];
    let band = lim.findIndex(l => gp <= l + allowance);
    if (band < 0) band = 4;
    const byLoad = band >= 4 ? 0 : base - 3 * band; // 12, 9, 6, 3 inches (PHB p.101)
    return { gp, lb: gp / 10, allowance, band, armorMove: armorMove === Infinity ? null : armorMove, move: Math.max(0, Math.min(armorMove, byLoad)) };
}
function formatCoin(cp) {
    if (cp === 0) return 'Free';
    const gp = Math.floor(cp / 200), rem = cp % 200, sp = Math.floor(rem / 10), c = rem % 10, p = [];
    if (gp) p.push(gp + ' g.p.'); if (sp) p.push(sp + ' s.p.'); if (c) p.push(c + ' c.p.');
    return p.join(', ');
}

/* ---------------- level based figures ---------------- */
function xpForLevel(cls, level) {
    const k = CLASSES[cls];
    if (level <= k.xp.length) return k.xp[level - 1];
    return k.xp[k.xp.length - 1] + (level - k.xp.length) * k.after;
}
function levelForXP(cls, xp) {
    let l = 1;
    while (l < (CLASSES[cls].maxLevel || 99) && xp >= xpForLevel(cls, l + 1)) l++;
    return l;
}
function hitDice(cls, level) { // [dice, flat hit points] PHB class tables
    const k = CLASSES[cls], dice_ = k.initialHD === 2 ? Math.min(level + 1, k.maxHD) : Math.min(level, k.maxHD);
    const extra = Math.max(0, level - (k.initialHD === 2 ? k.maxHD - 1 : k.maxHD));
    return { dice: dice_, die: k.hd, flat: extra * k.hpAfter };
}
function groupRow(table, level) {
    for (let i = 0; i < table.length; i++) {
        const m = /^(\d+)(?:-(\d+)|\+)?$/.exec(table[i][0]);
        const lo = +m[1], hi = m[2] ? +m[2] : (/\+/.test(table[i][0]) ? Infinity : lo);
        if (level >= lo && level <= hi) return table[i];
    }
    return table[table.length - 1];
}
const SAVE_NAMES = ['death', 'petrification', 'wand', 'breath', 'spell'];
function saveBlock(char, levels) {
    const out = {}, notes = [];
    SAVE_NAMES.forEach((n, i) => {
        let best = 99;
        classList(char.classes).forEach(c => {
            const row = groupRow(SAVES[CLASSES[c].saveClass], levels[c]);
            let v = row[i + 1];
            if (CLASSES[c].saveAdj) v -= CLASSES[c].saveAdj; // paladin +2 (PHB p.22)
            best = Math.min(best, v);
        });
        out[n] = best;
    });
    // racial constitution bonus against wands/staves/rods/spells and poison (PHB p.15-17); lower is better
    const R_ = RACES[char.race];
    if (R_.saveBonus) {
        const b = Math.min(5, Math.floor(char.scores.con / 3.5));
        out.death -= b; out.wand -= b; out.spell -= b;
        notes.push('+' + b + ' vs wands, staves, rods, spells and poison (constitution, PHB p.15-17)');
    }
    if (classList(char.classes).indexOf('Druid') >= 0) notes.push('+2 vs fire and lightning (druid, PHB p.21)');
    if (classList(char.classes).indexOf('Paladin') >= 0) notes.push('+2 on all saving throws is already applied (paladin, PHB p.22)');
    if (classList(char.classes).indexOf('Monk') >= 0) notes.push('Monk save-or-no-damage and half damage from 9th level (PHB p.30)');
    out.notes = notes;
    out.rule = 'A roll of 1 always fails (DMG p.79). Roll d20, equal or higher passes.';
    return out;
}
function attackBlock(char, levels) {
    const byAC = {};
    for (let ac = -10; ac <= 10; ac++) byAC[ac] = 99;
    classList(char.classes).forEach(c => {
        const t = ATTACK[CLASSES[c].attackClass], row = groupRow(t.cols.map(x => [x]), levels[c]);
        const idx = t.cols.indexOf(row[0]);
        for (let ac = -10; ac <= 10; ac++) byAC[ac] = Math.min(byAC[ac], t.rows[ac][idx]);
    });
    return byAC;
}
function thiefSkills(char, levels) {
    const cl = classList(char.classes), names = ['Pick Pockets', 'Open Locks', 'Find/Remove Traps', 'Move Silently', 'Hide in Shadows', 'Hear Noise', 'Climb Walls', 'Read Languages'];
    let level = 0, kind = null;
    cl.forEach(c => {
        const k = CLASSES[c].thiefSkills; if (!k) return;
        const eff = k === 'assassin' ? levels[c] - 2 : levels[c]; // PHB p.29: two levels below
        if (eff > level) { level = eff; kind = k; }
    });
    if (!kind) return null;
    const out = {}, dex = dexRow(char.scores.dex).thief, race = THIEF_RACE[char.race] || [0, 0, 0, 0, 0, 0, 0, 0];
    const base = THIEF_BASE[Math.min(level, 17)];
    names.forEach((n, i) => {
        if (kind === 'monk' && (i === 0 || i === 7)) return; // monk thief abilities PHB p.30-31
        const b = base[i], r = (kind === 'monk' ? 0 : race[i]) || 0, d = (kind !== 'monk' && i < 5 && dex) ? dex[i] : 0;
        if (i === 7 && level < 4) { out[n] = { base: 0, race: 0, dex: 0, total: null }; return; }
        out[n] = { base: b, race: r, dex: d, total: Math.max(0, b + r + d) };
    });
    out._level = level;
    return out;
}
function spellsPerDay(char, levels) {
    const out = {};
    classList(char.classes).forEach(c => {
        const k = CLASSES[c], lv = levels[c], t = k.spellType;
        if (!t) return;
        let slots = [];
        if (t === 'cleric' || t === 'druid') slots = (SPELL_SLOTS[t][Math.min(lv, SPELL_SLOTS[t].length - 1)] || []).slice();
        if (t === 'mu' || t === 'ill') slots = (SPELL_SLOTS[t][Math.min(lv, SPELL_SLOTS[t].length - 1)] || []).slice();
        if (t === 'paladin') slots = (SPELL_SLOTS.paladin[Math.min(lv, 20)] || []).slice();
        if (t === 'ranger') { out['Ranger (druidic)'] = (SPELL_SLOTS.rangerDruid[Math.min(lv, 17)] || []).slice(); out['Ranger (magic-user)'] = (SPELL_SLOTS.rangerMU[Math.min(lv, 17)] || []).slice(); return; }
        const w = wisRow(char.scores.wis);
        if (t === 'cleric' || t === 'druid') {
            // wisdom bonus spells only for spell levels the cleric can already cast (PHB p.11); 6th/7th need wis 17/18 (PHB p.11)
            for (let i = 0; i < 4; i++) if (slots[i]) slots[i] += w.bonusSpells[i];
            if (char.scores.wis < 17) { if (slots[5]) slots[5] = 0; }
            if (char.scores.wis < 18) { if (slots[6]) slots[6] = 0; }
        }
        out[c] = slots;
    });
    return out;
}

/* ---------------- derive everything ---------------- */
function derive(char) {
    const cl = classList(char.classes), s = char.scores, levels = {};
    cl.forEach(c => { levels[c] = (char.levels && char.levels[c]) || 1; });
    const fighter = isFighterType(cl), monk = cl.length === 1 && cl[0] === 'Monk';
    const exc = char.strExc || 0;
    const str = strRow(s.str, fighter ? exc : 0);
    if (monk) { str.hit = 0; str.dmg = 0; str.wgt = 0; } // PHB p.32: no strength hit/damage/weight bonus
    const abilities = {
        str: Object.assign({ score: s.str, exc }, str), int: Object.assign({ score: s.int }, intRow(s.int)),
        wis: Object.assign({ score: s.wis }, wisRow(s.wis)), dex: Object.assign({ score: s.dex }, dexRow(s.dex)),
        con: Object.assign({ score: s.con }, conRow(s.con, fighter)), cha: Object.assign({ score: s.cha }, chaRow(s.cha))
    };
    if (monk) abilities.dex.defense = 0; // PHB p.30
    const keptCha = CHA_KEPT[char.race] ? (char.chaRolled || s.cha) : null;
    if (keptCha) abilities.cha.ownRaceHenchmen = chaRow(keptCha).henchmen;
    // experience bonus: +10% for prime requisites 16+ (PHB p.9-30)
    const xpBonus = {};
    cl.forEach(c => { const rq = CLASSES[c].bonusReq; xpBonus[c] = rq.length && rq.every(a => s[a] >= 16) ? 10 : 0; });
    const hd = {};
    cl.forEach(c => { hd[c] = hitDice(c, levels[c]); });
    const limits = {};
    cl.forEach(c => { limits[c] = levelLimit(char, c); });
    const known = char.proficiencies || [];
    const profs = Math.max.apply(null, cl.map(c => CLASSES[c].profs));
    const nonProf = Math.max.apply(null, cl.map(c => CLASSES[c].nonProf)); // least severe penalty, INTERPRETATION
    const spells = spellsPerDay(char, levels);
    const notes = [];
    if (cl.length > 1) notes.push('Experience is divided equally between the classes (PHB p.14-17).');
    if (RACES[char.race].infravision) notes.push('Infravision ' + RACES[char.race].infravision + ' ft');
    if (char.race === 'Halfling') notes.push((char.subrace === 'Stout' || char.subrace === 'Tallfellow' ? 'Infravision 60 ft (Stout), 30 ft (mixed blood)' : 'Hairfoot: no infravision stated') + ' (PHB p.17)');
    return {
        race: char.race, sex: char.sex, classes: cl, levels, abilities, xpBonus, hitDice: hd, levelLimits: limits,
        hpAdjPerDie: abilities.con.hp, saves: saveBlock(char, levels), attack: attackBlock(char, levels),
        attackMods: { melee: abilities.str.hit, missile: abilities.dex.reaction, damage: abilities.str.dmg, longRange: -5, mediumRange: -2 },
        thiefSkills: thiefSkills(char, levels), movement: encumbrance(char), spellsPerDay: spells,
        languages: languageSlots(char), ac: armorClass(char), weaponProf: { initial: profs, nonProficiencyPenalty: nonProf, known },
        infravision: RACES[char.race].infravision, monk: monk ? MONK_TABLE[Math.min(levels.Monk, 17)] : null, notes
    };
}

const Rules = {
    ABILITIES, ABILITY_NAMES, ALIGNMENTS, ALIGN_NAMES, ALIGN_LANG, RACES, CLASSES, CLASS_ORDER, MULTICLASS, FIGHTER_TYPES, HALFLING_SUBRACES, CHA_KEPT,
    EQUIPMENT, MONK_TABLE, LANGUAGES_KNOWABLE, MU_START, MU_LEVEL1, ILL_LEVEL1, AGE_NAMES, AGE_CATS, AGE_MODS, START_AGE, HUMAN_AGE, HW, HW_BANDS, SECONDARY,
    TABLES: { strRows: STR_ROWS, strExc: STR_EXC, intLang: INT_LANG, int2: INT2, wisMda: WIS_MDA, wisFail: WIS_FAIL, dex: DEX_ROWS, dexThief: DEX_THIEF, con: CON_ROWS, cha: CHA_ROWS,
        saves: SAVES, attack: ATTACK, thiefBase: THIEF_BASE, thiefRace: THIEF_RACE, spells: SPELL_SLOTS },
    makeRng, die, dice, roll, diceMax, rollAbilities, applyRace, classOk, classesFor, combosAllowed, alignmentsFor, levelLimit, capStrExc, rollStrExc, rollHP, startingGold,
    rollAge, ageExpr, ageCategory, applyAging, rollHeightWeight, rollSecondarySkill, rollStartingSpells, spellList, languageSlots, languageChoices,
    canUseWeapon, canWearArmor, armorClass, encumbrance, formatCoin, xpForLevel, levelForXP, hitDice,
    strRow, intRow, wisRow, dexRow, conRow, chaRow, isFighterType, derive
};
if (typeof module !== 'undefined' && module.exports) module.exports = Rules;
root.Rules = Rules;
})(typeof globalThis !== 'undefined' ? globalThis : this);
