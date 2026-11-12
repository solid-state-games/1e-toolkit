// SHARED COPY of ENCOUNTER_ROLLER/js/morale.js: edit the master there, then run TOOLS/sync_lib.py
"use strict";
/* ============================================================
   Morale (DMG p.67). DOM-free.
   Intelligent monsters: base 50%, +5% per hit die above 1, +1% per hit point above any whole hit dice.
   Roll d100, adjust the roll for the circumstances; adjusted roll <= morale score = morale holds.
   The difference (adjusted roll - score) is the percent of failure: 1-15 fall back fighting,
   16-30 disengage and retreat, 31-50 flee in panic, 51+ surrender.
   Nothing here is rolled automatically: morale is checked only on the DMG p.67 triggers (or a 01-25 reaction, p.63).
   ============================================================ */

// DMG p.67 "Morale Checks Made When". bonus = the "check at +N%" adjustment to the roll.
const MORALE_TRIGGERS = [
    { id: 'superior',         label: 'Faced by an obviously superior force (check each round)', bonus: 0 },
    { id: 'casualties25',     label: '25% of party eliminated or slain',                         bonus: 5 },
    { id: 'leaderUnconscious', label: 'Leader unconscious',                                       bonus: 10 },
    { id: 'casualties50',     label: '50%+ of party eliminated or slain',                        bonus: 15 },
    { id: 'leaderSlain',      label: 'Leader slain or deserts',                                  bonus: 30 }
];

// DMG p.67 "Other Morale Check Modifiers": per-count items give value x count; flags apply once. Applied to the d100 roll.
const MORALE_MODIFIERS = [
    { id: 'enemyDeserting',      label: 'Each enemy deserting',                         value: -5,  perCount: true },
    { id: 'enemySlain',          label: 'Each enemy slain',                             value: -10, perCount: true },
    { id: 'inflictingNoLoss',    label: 'Inflicting casualties without receiving any',  value: -20, perCount: false },
    { id: 'friendKilled',        label: 'Each friend killed',                           value: 10,  perCount: true },
    { id: 'takingNoReturn',      label: 'Taking casualties without receiving any',      value: 10,  perCount: false },
    { id: 'friendDeserting',     label: 'Each friend deserting',                        value: 15,  perCount: true },
    { id: 'outnumbered3to1',     label: 'Outnumbered and outclassed by 3 or more to 1', value: 20,  perCount: false }
];

// Split a hit dice string into whole dice and extra hit points. "5+2" = 5 dice and 2 points. Ranges, fractions and
// hit-point forms use the stored hdValue (N + P/8 for N+P, so points = fraction x 8).
function parseHitDice(hitDice, hdValue) {
    const s = String(hitDice === undefined || hitDice === null ? '' : hitDice).trim();
    let m = /^(\d+)\s*\+\s*(\d+)$/.exec(s);
    if (m) return { dice: parseInt(m[1], 10), points: parseInt(m[2], 10) };
    m = /^(\d+)$/.exec(s);
    if (m) return { dice: parseInt(m[1], 10), points: 0 };
    const v = typeof hdValue === 'number' ? hdValue : parseFloat(s);
    if (!isFinite(v) || v <= 0) return { dice: 1, points: 0 };
    if (v < 1) return { dice: 1, points: 0 };
    const dice = Math.floor(v + 1e-9);
    return { dice: dice, points: Math.round((v - dice) * 8) };
}

// DMG p.67: 50% + 5% per hit die above 1 + 1% per hit point above whole hit dice
function baseMorale(hitDice, hdValue) {
    const p = parseHitDice(hitDice, hdValue);
    return 50 + 5 * Math.max(0, p.dice - 1) + p.points;
}

function moraleFailureResult(failureBy) {
    if (failureBy <= 0) return 'Morale holds';
    if (failureBy <= 15) return 'Falls back, fighting';
    if (failureBy <= 30) return 'Disengages and retreats';
    if (failureBy <= 50) return 'Flees in panic';
    return 'Surrenders';
}

/* checkMorale({hitDice, hdValue, trigger (id), counts {id: n or true}, extra (DM %), roll})
   Returns { base, adjustments [{label, value}], total, roll, adjusted, holds, failureBy, result, text } */
function checkMorale(unit) {
    unit = unit || {};
    const base = unit.baseOverride !== undefined ? unit.baseOverride : baseMorale(unit.hitDice, unit.hdValue);
    const adjustments = [];
    const trig = MORALE_TRIGGERS.find(function (t) { return t.id === unit.trigger; });
    if (trig && trig.bonus) adjustments.push({ label: trig.label, value: trig.bonus });
    const counts = unit.counts || {};
    MORALE_MODIFIERS.forEach(function (mod) {
        const c = counts[mod.id];
        if (!c) return;
        const n = mod.perCount ? Math.max(0, parseInt(c, 10) || 0) : 1;
        if (n > 0) adjustments.push({ label: mod.label + (mod.perCount ? ' x' + n : ''), value: mod.value * n });
    });
    const extra = parseInt(unit.extra, 10) || 0;
    if (extra) adjustments.push({ label: 'DM adjustment', value: extra });
    const total = adjustments.reduce(function (s, a) { return s + a.value; }, 0);
    const roll = unit.roll !== undefined ? unit.roll : rollDice(1, 100);
    const adjusted = roll + total;
    const holds = adjusted <= base;
    const failureBy = holds ? 0 : adjusted - base;
    const result = moraleFailureResult(failureBy);
    return {
        base: base, adjustments: adjustments, total: total, roll: roll, adjusted: adjusted,
        holds: holds, failureBy: failureBy, result: result,
        text: 'd100 ' + roll + (total ? (total > 0 ? ' +' : ' ') + total : '') + ' = ' + adjusted + ' vs morale ' + base + '%: ' +
            (holds ? 'holds' : result + ' (failed by ' + failureBy + '%)')
    };
}

if (typeof window !== 'undefined') window.checkMorale = checkMorale;
