// SHARED COPY of ENCOUNTER_ROLLER/js/reactions.js: edit the master there, then run TOOLS/sync_lib.py
"use strict";
/* ============================================================
   Encounter reactions (DMG p.63, p.37, p.106; PHB p.12-13, p.18). DOM-free.
   Reaction roll: d100, adjusted for charisma (PHB p.12 reaction adjustment) and "applicable loyalty
   adjustment as if the creature were a henchman of the character speaking" (DMG p.63). Studio ruling:
   the Liege column of DMG p.37 is used (alignment 0 / -15 / -35, racial preference -20 / -5 / 0 / +10 / +20).
   ============================================================ */

// PHB p.12-13 Charisma table, Reaction Adjustment column
const CHARISMA_MODIFIERS = {
    3: -25, 4: -20, 5: -15, 6: -10, 7: -5, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
    13: 5, 14: 10, 15: 15, 16: 25, 17: 30, 18: 35
};

// DMG p.37 Racial Preference, Liege column
const RACIAL_PREFERENCE_MODIFIERS = {
    P: +20, // preferred
    G: +10, // good will
    T: 0,   // tolerance
    N: 0,   // neutral
    A: -5,  // antipathy
    H: -20  // hatred
};

// PHB p.18 Racial Preferences Table. Row = race of the party leader, column = race encountered.
const RACIAL_PREFERENCES = {
    'dwarf':    { 'dwarf': 'P', 'elf': 'A', 'gnome': 'G', 'half-elf': 'N', 'halfling': 'G', 'half-orc': 'H', 'human': 'N' },
    'elf':      { 'dwarf': 'A', 'elf': 'P', 'gnome': 'T', 'half-elf': 'G', 'halfling': 'T', 'half-orc': 'A', 'human': 'N' },
    'gnome':    { 'dwarf': 'G', 'elf': 'T', 'gnome': 'P', 'half-elf': 'T', 'halfling': 'G', 'half-orc': 'H', 'human': 'N' },
    'half-elf': { 'dwarf': 'N', 'elf': 'P', 'gnome': 'T', 'half-elf': 'P', 'halfling': 'N', 'half-orc': 'A', 'human': 'T' },
    'halfling': { 'dwarf': 'G', 'elf': 'G', 'gnome': 'T', 'half-elf': 'N', 'halfling': 'P', 'half-orc': 'N', 'human': 'N' },
    'half-orc': { 'dwarf': 'H', 'elf': 'A', 'gnome': 'H', 'half-elf': 'A', 'halfling': 'N', 'half-orc': 'P', 'human': 'T' },
    'human':    { 'dwarf': 'N', 'elf': 'N', 'gnome': 'N', 'half-elf': 'T', 'halfling': 'N', 'half-orc': 'N', 'human': 'P' }
};
// PHB p.18 footnotes: these cells read G only for some halflings, and T for the rest. The leader's halfling
// sub-race is not tracked, so G is used and the note is shown in the result.
const RACIAL_FOOTNOTES = {
    'dwarf>halfling': 'PHB p.18: good will only towards Tallfellows and Stouts, other halflings are tolerated (T).',
    'halfling>dwarf': 'PHB p.18: only Stouts regard dwarves as acceptable (G), other halflings tolerate them (T).',
    'halfling>elf': 'PHB p.18: only Tallfellows regard elves as good company (G), other halflings are tolerant (T).'
};

// DMG p.106 Humanoid Racial Preferences Table. Row = leader, column = other. * = bully and harass, ** = rival tribe.
const HUMANOID_COLUMNS = ['bugbear', 'gnoll', 'goblin', 'hillgiant', 'hobgoblin', 'kobold', 'ogre', 'orc', 'troll'];
const HUMANOID_ROWS = {
    'bugbear':   'P T* G T A* A* T A* N',
    'gnoll':     'T P A* T N A* G T* N',
    'goblin':    'G A P N T G H N A',
    'hillgiant': 'G G A P A A G N* T',
    'hobgoblin': 'T N N* N H** A* A T* H',
    'kobold':    'A H G A A P H A T',
    'ogre':      'T T* A* G A* A* P T* T',
    'orc':       'A N T* A N A* G H** H',
    'troll':     'A N A T H T N A N**'
};
const HUMANOID_PREFERENCES = {};
Object.keys(HUMANOID_ROWS).forEach(function (row) {
    const cells = HUMANOID_ROWS[row].split(' ');
    HUMANOID_PREFERENCES[row] = {};
    HUMANOID_COLUMNS.forEach(function (col, i) { HUMANOID_PREFERENCES[row][col] = cells[i]; });
});

// DMG p.37 Alignment Factors: places removed along this list (no wrap-round)
const ALIGNMENT_ORDER = ['LG', 'LN', 'LE', 'NG', 'N', 'CG', 'CN', 'NE', 'CE'];

function alignmentPlaces(a, b) {
    const i = ALIGNMENT_ORDER.indexOf(a), j = ALIGNMENT_ORDER.indexOf(b);
    if (i < 0 || j < 0) return null;
    return Math.abs(i - j);
}
// Liege column: 1 place removed 0%, 2 places -15%, 3 or more places -35%
function alignmentModForPlaces(places) {
    if (places === null || places === undefined) return 0;
    if (places <= 1) return 0;
    if (places === 2) return -15;
    return -35;
}

// DMG p.63 reaction table. morale = the asterisk "or morale check if appropriate".
const REACTION_BANDS = [
    { max: 5,        text: 'Violently hostile, immediate attack',                 hostile: true,  morale: true,  cls: 'r-hostile' },
    { max: 25,       text: 'Hostile, immediate action',                           hostile: true,  morale: true,  cls: 'r-hostile' },
    { max: 45,       text: 'Uncertain but 55% prone toward negative',             hostile: false, uncertain: 'negative', cls: 'r-uncertain' },
    { max: 55,       text: 'Neutral, uninterested, uncertain',                    hostile: false, uncertain: 'neutral',  cls: 'r-neutral' },
    { max: 75,       text: 'Uncertain but 55% prone toward positive',             hostile: false, uncertain: 'positive', cls: 'r-friendly' },
    { max: 95,       text: 'Friendly, immediate action',                          hostile: false, cls: 'r-friendly' },
    { max: Infinity, text: 'Enthusiastically friendly, immediate acceptance',     hostile: false, cls: 'r-friendly' }
];

function getReactionBand(adjusted) {
    return REACTION_BANDS.find(function (b) { return adjusted <= b.max; });
}

function charismaReactionMod(score) {
    const n = parseInt(score, 10);
    if (isNaN(n)) return 0;
    return CHARISMA_MODIFIERS[Math.min(18, Math.max(3, n))] || 0;
}

// Racial preference letter (with footnote), leader race vs encountered race. null = no table covers the pair.
function racialPreference(leaderRace, otherRace) {
    const a = String(leaderRace || '').toLowerCase(), b = String(otherRace || '').toLowerCase();
    if (!a || !b) return null;
    let letter = null;
    if (RACIAL_PREFERENCES[a] && RACIAL_PREFERENCES[a][b]) letter = RACIAL_PREFERENCES[a][b];
    else if (HUMANOID_PREFERENCES[a] && HUMANOID_PREFERENCES[a][b]) letter = HUMANOID_PREFERENCES[a][b];
    if (!letter) return null;
    return { letter: letter.replace(/\*/g, ''), raw: letter, note: RACIAL_FOOTNOTES[a + '>' + b] || null };
}
function racialPreferenceMod(leaderRace, otherRace) {
    const p = racialPreference(leaderRace, otherRace);
    return p ? (RACIAL_PREFERENCE_MODIFIERS[p.letter] || 0) : 0;
}

// Race of an encountered creature as used by the two preference tables, from its Monster Manual key or an NPC race word.
function reactionRaceOf(key, npcRace) {
    if (npcRace) {
        const r = String(npcRace).toLowerCase().replace(/^dwarven$/, 'dwarf').replace(/^elven$/, 'elf').replace(/^gnomish$/, 'gnome')
            .replace(/^half-elven$/, 'half-elf').replace(/^hal$/, 'halfling');
        return r;
    }
    const k = String(key || '');
    const direct = { 'Dwarf': 'dwarf', 'Elf': 'elf', 'Gnome': 'gnome', 'Halfling': 'halfling', 'Bugbear': 'bugbear', 'Gnoll': 'gnoll',
        'Goblin': 'goblin', 'Hobgoblin': 'hobgoblin', 'Kobold': 'kobold', 'Ogre': 'ogre', 'Orc': 'orc', 'Troll': 'troll', 'Giant, hill': 'hillgiant' };
    if (direct[k]) return direct[k];
    if (/^Men, /.test(k)) return 'human';
    return null;
}

/* rollReaction(opts)
   opts: charisma, partyAlignment (code), partyRace, monsterAlignmentCode, monsterRace, extraMod (DM entered, %), roll (optional d100)
   Returns every part so the card can show the working. Unknown or "any/varies" alignment: no modifier, and a note says so. */
function rollReaction(opts) {
    opts = opts || {};
    const roll = opts.roll !== undefined ? opts.roll : rollDice(1, 100);
    const notes = [];
    const charismaMod = charismaReactionMod(opts.charisma === undefined ? 10 : opts.charisma);

    let alignmentMod = 0, places = null;
    const pa = opts.partyAlignment, ma = opts.monsterAlignmentCode;
    if (!ma || ma === 'any' || ma === 'varies') {
        notes.push('Alignment ' + (ma ? '"' + ma + '"' : 'unknown') + ': no alignment modifier (DM may adjust).');
    } else if (ALIGNMENT_ORDER.indexOf(pa) < 0) {
        notes.push('Party alignment not set: no alignment modifier.');
    } else {
        places = alignmentPlaces(pa, ma);
        alignmentMod = alignmentModForPlaces(places);
    }

    let racialMod = 0, racial = null;
    const mr = opts.monsterRace;
    if (opts.partyRace && mr) {
        racial = racialPreference(opts.partyRace, mr);
        if (racial) {
            racialMod = RACIAL_PREFERENCE_MODIFIERS[racial.letter] || 0;
            if (racial.note) notes.push(racial.note);
        }
    }

    const extraMod = parseInt(opts.extraMod, 10) || 0;
    const adjusted = roll + charismaMod + alignmentMod + racialMod + extraMod;
    const band = getReactionBand(adjusted);

    let leanRoll = null, leanResult = null;
    if (band.uncertain === 'negative' || band.uncertain === 'positive') {
        leanRoll = rollDice(1, 100);
        const toward = leanRoll <= 55;
        leanResult = toward ? band.uncertain : (band.uncertain === 'negative' ? 'positive' : 'negative');
    }

    return {
        roll: roll, charismaMod: charismaMod, alignmentMod: alignmentMod, alignmentPlaces: places,
        racialMod: racialMod, racialLetter: racial ? racial.raw : null, extraMod: extraMod,
        adjusted: adjusted, text: band.text, hostile: !!band.hostile, moraleMayApply: !!band.morale,
        uncertain: band.uncertain || null, cls: band.cls, leanRoll: leanRoll, leanResult: leanResult, notes: notes,
        guidance: band.uncertain === 'negative' || band.uncertain === 'positive'
            ? 'DM decides (DMG p.63). The 55% lean roll below is a suggestion only.' : (band.morale ? 'Or a morale check if appropriate (DMG p.63).' : '')
    };
}

// One-line summary of a reaction result for cards and text
function reactionSummary(r) {
    if (!r) return '';
    const parts = ['d100 ' + r.roll];
    if (r.charismaMod) parts.push('CHA ' + (r.charismaMod > 0 ? '+' : '') + r.charismaMod);
    if (r.alignmentMod) parts.push('alignment ' + r.alignmentMod);
    if (r.racialMod) parts.push('race ' + (r.racialMod > 0 ? '+' : '') + r.racialMod);
    if (r.extraMod) parts.push('DM ' + (r.extraMod > 0 ? '+' : '') + r.extraMod);
    let s = r.text + ' (' + r.adjusted + ' = ' + parts.join(', ') + ')';
    if (r.leanRoll !== null) s += ' Lean roll ' + r.leanRoll + ': ' + r.leanResult + '.';
    return s;
}

if (typeof window !== 'undefined') {
    window.rollReaction = rollReaction;
    window.RACIAL_PREFERENCES = RACIAL_PREFERENCES;
    window.HUMANOID_PREFERENCES = HUMANOID_PREFERENCES;
}
