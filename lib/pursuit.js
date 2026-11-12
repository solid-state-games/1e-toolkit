// SHARED COPY of ENCOUNTER_ROLLER/js/pursuit.js: edit the master there, then run TOOLS/sync_lib.py
"use strict";
/* ============================================================
   Pursuit and evasion, outdoors (DMG p.63 Avoiding, p.67-69). DOM-free.
   1. Does pursuit happen at all? (p.67 likelihood rules, p.63 item 6 otherwise 50%)
   2. Surprise (p.69): party surprised the creature = evasion automatic; party surprised = no evasion possible.
   3. Evasion chance = 80% + speed + terrain + both party sizes + light (p.69). Roll d100, <= chance evades.
   4. Failed: pursuit continues. If the pursuers are faster and can close within 1 hour they confront; otherwise
      an evasion check every game hour. Any check at 0% or less is an immediate confrontation.
   ============================================================ */

const BASE_EVASION_CHANCE = 80;

const SPEED_MODIFIERS = { FASTER_PURSUED: 10, EQUAL_SPEED: 0, FASTER_PURSUER: -20 };

const TERRAIN_MODIFIERS = {
    plains: -50, desert: -50, openWater: -50,
    scrub: 10, rough: 10, hills: 10, marsh: 10,
    forest: 30, mountains: 30
};

const LIGHT_MODIFIERS = { daylight: -30, twilight: -10, brightMoon: 0, starlight: 20, darkNight: 50 };

// Pursued party size (p.69)
function pursuedSizeMod(n) {
    if (n < 6) return 10;
    if (n <= 11) return 0;
    if (n <= 50) return -20;
    return -50;
}
// Pursuing party size (p.69)
function pursuerSizeMod(n) {
    if (n < 12) return -20;
    if (n <= 24) return 0;
    return 10;
}
function speedMod(partySpeed, monsterSpeed) {
    if (partySpeed > monsterSpeed) return SPEED_MODIFIERS.FASTER_PURSUED;
    if (partySpeed < monsterSpeed) return SPEED_MODIFIERS.FASTER_PURSUER;
    return SPEED_MODIFIERS.EQUAL_SPEED;
}

// Pursuit speed from stored movement modes: the fastest of ground and fly; swim only for creatures that cannot walk.
// (A creature with only burrow or web speed uses that.) Inches per round.
function monsterPursuitSpeed(details) {
    const mm = (details && details.moveModes) || {};
    const best = Math.max(mm.ground || 0, mm.fly || 0);
    if (best > 0) return best;
    return Math.max(mm.swim || 0, mm.burrow || 0, mm.web || 0, 0);
}

// Light condition for a time of day. House mapping (DMG p.69 gives only the five bands): morning, noon, evening
// daylight; night twilight; midnight dark night; pre-dawn starlight. With a bright moon, night periods are moonlight.
function lightForTime(timeOfDay, brightMoon) {
    switch (timeOfDay) {
        case 'night': return brightMoon ? 'brightMoon' : 'twilight';
        case 'midnight': return brightMoon ? 'brightMoon' : 'darkNight';
        case 'predawn': return brightMoon ? 'brightMoon' : 'starlight';
        default: return 'daylight';
    }
}

/* Whether the monsters pursue at all (DMG p.67 items 1-3 and p.63 item 6).
   details: monster record (intelligenceRank). Returns { chance, die, rule } where chance is percent, 100 = certain. */
function pursuitLikelihood(details, partyNumber, monsterNumber, opts) {
    opts = opts || {};
    if (opts.keyed) return { chance: 100, die: null, rule: 'Keyed or stated by the Monster Manual to pursue: certain (DMG p.67).' };
    const rank = details && typeof details.intelligenceRank === 'number' ? details.intelligenceRank : 4;
    if (rank <= 2) return { chance: 80, die: 'd10', rule: 'Semi-intelligent or less, assumed hungry, angry or aggressive: 80% (d10, 1-8) (DMG p.67 item 2).' };
    if (rank === 3) {
        // party outnumbers the pursuers: 20%; about as numerous: 40%; outnumbered: 80%; greatly superior: 100%
        const ratio = monsterNumber / Math.max(1, partyNumber);
        if (ratio < 0.67) return { chance: 20, die: 'd10', rule: 'Low intelligence, party outnumbers them: 20% (DMG p.67 item 3A).' };
        if (ratio <= 1.5) return { chance: 40, die: 'd10', rule: 'Low intelligence, about as numerous as the party: 40% (DMG p.67 item 3B).' };
        if (opts.greatlySuperior) return { chance: 100, die: null, rule: 'Low intelligence, party outnumbered and they think themselves greatly superior: certain (DMG p.67 item 3D).' };
        return { chance: 80, die: 'd10', rule: 'Low intelligence, party outnumbered: 80% (DMG p.67 item 3C). 100% if they think themselves greatly superior (DM call).' };
    }
    return { chance: 50, die: 'd6', rule: 'Average intelligence or better, nothing keyed: 50% (d6, 1-3 = pursuit) (DMG p.63 item 6). The DM key and the creatures\' stated behaviour come first.' };
}

// Outdoor evasion chance with its parts. terrainKey: plains ... marsh or openWater. lightKey: see LIGHT_MODIFIERS.
function evasionChance(terrainKey, lightKey, partyNumber, monsterNumber, partySpeed, monsterSpeed) {
    const mods = {
        terrain: TERRAIN_MODIFIERS[terrainKey] || 0,
        light: LIGHT_MODIFIERS[lightKey] || 0,
        pursuedSize: pursuedSizeMod(partyNumber),
        pursuerSize: pursuerSizeMod(monsterNumber),
        speed: speedMod(partySpeed, monsterSpeed)
    };
    const chance = BASE_EVASION_CHANCE + mods.terrain + mods.light + mods.pursuedSize + mods.pursuerSize + mods.speed;
    return { chance: chance, mods: mods };
}

/* evadeOutdoors(p): p = { surprise: 'party'|'monster'|'both'|'none' (net surprise), terrain, light, partyNumber, monsterNumber,
     partySpeed, monsterSpeed, distanceInches, likelihood (from pursuitLikelihood), maxHours }
   Returns { outcome: 'automatic'|'impossible'|'no-pursuit'|'evaded'|'confrontation'|'continuing', steps: [text], chance, mods } */
function evadeOutdoors(p) {
    const steps = [];
    const res = { outcome: null, steps: steps, chance: null, mods: null };
    if (p.surprise === 'monster') {
        steps.push('The party surprised the creatures: evasion is automatic (DMG p.69).');
        res.outcome = 'automatic'; return res;
    }
    if (p.surprise === 'party') {
        steps.push('The party was surprised: no evasion is possible, confrontation is unavoidable (DMG p.69).');
        res.outcome = 'impossible'; return res;
    }
    if (p.distanceInches !== undefined && p.distanceInches <= 1) {
        steps.push('Within striking range at once: it is never possible to flee from an opponent in striking range (DMG p.63).');
        res.outcome = 'impossible'; return res;
    }
    const lk = p.likelihood;
    if (lk && lk.chance < 100) {
        const r = lk.die === 'd6' ? rollDice(1, 6) : rollDice(1, 10);
        const pursue = lk.die === 'd6' ? r <= 3 : r <= lk.chance / 10;
        steps.push('Pursuit check: ' + lk.die + ' ' + r + ', ' + lk.chance + '% to pursue: ' + (pursue ? 'they pursue.' : 'they break off. Not pursued.'));
        if (!pursue) { res.outcome = 'no-pursuit'; return res; }
    } else if (lk) {
        steps.push('Pursuit is certain (' + lk.rule + ')');
    }
    const ev = evasionChance(p.terrain, p.light, p.partyNumber, p.monsterNumber, p.partySpeed, p.monsterSpeed);
    res.chance = ev.chance; res.mods = ev.mods;
    const m = ev.mods;
    steps.push('Evasion chance ' + ev.chance + '% = 80 + terrain ' + m.terrain + ' + light ' + m.light + ' + party size ' + m.pursuedSize +
        ' + pursuer size ' + m.pursuerSize + ' + speed ' + m.speed + '.');
    if (ev.chance <= 0) {
        steps.push('0% or less: immediate confrontation, no further chance of evasion (DMG p.69).');
        res.outcome = 'confrontation'; return res;
    }
    const first = rollDice(1, 100);
    if (first <= ev.chance) {
        steps.push('d100 ' + first + ' <= ' + ev.chance + ': evaded.');
        res.outcome = 'evaded'; return res;
    }
    steps.push('d100 ' + first + ' > ' + ev.chance + ': pursuit continues.');
    const diff = p.monsterSpeed - p.partySpeed;
    if (diff > 0 && p.distanceInches !== undefined) {
        const minutes = p.distanceInches / diff;
        if (minutes <= 60) {
            steps.push('Pursuers are faster and close ' + p.distanceInches + '" in about ' + Math.max(1, Math.ceil(minutes)) + ' minutes (within 1 hour): confrontation (DMG p.69).');
            res.outcome = 'confrontation'; return res;
        }
        steps.push('Pursuers are faster but cannot close within 1 hour; an evasion check is made each game hour.');
    } else {
        steps.push('An evasion check is made each game hour (DMG p.69).');
    }
    const maxHours = p.maxHours || 12;
    for (let h = 1; h <= maxHours; h++) {
        // same procedure each hour; the DM may change light or terrain as the hours pass
        if (ev.chance <= 0) { steps.push('Hour ' + h + ': 0% or less, immediate confrontation.'); res.outcome = 'confrontation'; return res; }
        const r = rollDice(1, 100);
        if (r <= ev.chance) { steps.push('Hour ' + h + ': d100 ' + r + ' <= ' + ev.chance + ': evaded.'); res.outcome = 'evaded'; return res; }
        steps.push('Hour ' + h + ': d100 ' + r + ' > ' + ev.chance + ': still pursued.');
    }
    steps.push('Still pursued after ' + maxHours + ' hours. The DM carries on with hourly checks at the current chance.');
    res.outcome = 'continuing';
    return res;
}

if (typeof window !== 'undefined') window.evadeOutdoors = evadeOutdoors;
