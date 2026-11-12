"use strict";
/* gm_combat.js - DOM-free helpers for the Combat tab. Uses the tables and functions of lib/combat_rules.js (loaded before this file).
   Mirrors COMBAT_CALC/iron-wheel.html (Combat and Grapple tabs) without its page code. */
const GMCombat = (function () {
    const sgn = function (n) { return n > 0 ? "+" + n : "" + n; };
    const rnd = function (n, rng) { return Math.floor((rng || Math.random)() * n) + 1; };

    function levelChoices(cls) {
        const c = CLASSES[cls];
        if (c.byHD) return MATRIX.II.cols.map(function (l, i) { return { v: i, t: l + " HD" }; });
        if (c.fixedCol !== undefined) return [{ v: 0, t: "Level 0" }];
        const o = [];
        for (let i = 1; i <= 21; i++) o.push({ v: i, t: i === 21 ? "Level 21+" : "Level " + i });
        return o;
    }
    // p: {cls, lv, wi (index in WEAPONS), ac (target AC), armorIdx, shield, bonus, penalty, sit, range S|M|L, size SM|L, dmgBonus}
    function toHitState(p) {
        const c = CLASSES[p.cls], col = classCol(p.cls, p.lv), wep = WEAPONS[p.wi], sit = SITUATIONS[p.sit || 0];
        const type = acType(p.armorIdx || 0, !!p.shield), adj = weaponAdj(wep, type);
        const rp = wep.kind === "missile" ? RANGE_PEN[p.range || "S"] : 0;
        const m = toHit(c.group, col, p.ac);
        const need = m - adj - (p.bonus || 0) - sit.b + (p.penalty || 0) - rp;
        const dice = (p.size === "L") ? wep.lg : wep.sm;
        return { m: m, adj: adj, type: type, need: need, auto: !!sit.auto, sit: sit, wep: wep, dice: dice, dmg: dice ? diceTxt(dice, p.dmgBonus || 0) : "--",
            atk: attacksPerRound(p.cls, p.lv), group: c.group, col: col };
    }
    function toHitText(p) {
        const s = toHitState(p);
        const needTxt = s.auto || s.need < 1 ? "automatic" : s.need > 20 ? "above 20 (bonuses only)" : String(s.need);
        return CLASSES[p.cls].label + " " + (CLASSES[p.cls].byHD ? MATRIX.II.cols[p.lv] + " HD" : "level " + p.lv) + " vs AC " + p.ac + ": table " + s.m + ", " +
            s.wep.name + " " + (s.type === null ? "n/a" : sgn(s.adj)) + " vs AC type " + s.type + ", need " + needTxt + ", damage " + s.dmg + ", attacks " + s.atk + "/round";
    }
    // weapon adjustment vs armour row for one weapon: AC types 10 down to 2 (PHB p.38)
    function weaponRow(wi) {
        const w = WEAPONS[wi], out = [];
        for (let t = 10; t >= 2; t--) out.push({ ac: t, adj: w.adj[t - 2] });
        return out;
    }
    // the whole to-hit row AC 10 .. -10 for a class and level
    function toHitRow(cls, lv) {
        const c = CLASSES[cls], col = classCol(cls, lv), out = [];
        for (let ac = 10; ac >= -10; ac--) out.push({ ac: ac, need: toHit(c.group, col, ac) });
        return out;
    }
    // mode P pummel, G grapple, O overbear. rng optional (tests).
    function weaponless(mode, p, rng) {
        const h = hitChance(mode, p), name = mode === "P" ? "Pummel" : mode === "G" ? "Grapple" : "Overbear";
        const hitRoll = rnd(100, rng), hit = h.auto || hitRoll <= h.chance;
        const r = { name: name, base: h.base, mods: h.mods, chance: h.chance, auto: h.auto, hitRoll: hitRoll, hit: hit };
        if (!hit) { r.text = name + " fails: rolled " + hitRoll + " against " + h.chance + "%."; return r; }
        const resRoll = rnd(100, rng), resMods = resultMods(mode, p), adjResult = resRoll + resMods;
        const tbl = mode === "P" ? PUMMEL_TABLE : mode === "G" ? GRAPPLE_TABLE : OVERBEAR_TABLE;
        const entry = lookupTable(adjResult, tbl), sb = strAdj(p.atkSTR, p.atkPct).dmg, w = weaponlessDamage(mode, entry.dmg, sb);
        r.resRoll = resRoll; r.resMods = resMods; r.adjResult = adjResult; r.entry = entry; r.strBonus = sb; r.dmg = w;
        r.text = name + " hits (" + (h.auto ? "automatic" : hitRoll + " <= " + h.chance + "%") + "). d100 " + resRoll + (resMods ? " " + sgn(resMods) + " = " + adjResult : "") + ": " + entry.res +
            (entry.dmg > 0 ? ". Score " + entry.dmg + (sb ? " " + sgn(sb) : "") + " = " + w.total + ", " + w.pct + "% actual = " + w.actual + " HP, " + w.incidental + " incidental" : "") +
            (entry.note ? ". " + entry.note : "");
        return r;
    }
    function defaultP() {
        return { atkDEX: 10, atkSTR: 10, atkPct: 0, atkAC: 10, oppAC: 10, oppDEX: 10, oppSTR: 10, oppPct: 0, armor: "none", helmet: "none", strike: "fist",
            faster: 0, wtDiff: 0, htDiff: 0, varHit: 0, varRes: 0 };
    }
    return { sgn: sgn, rnd: rnd, levelChoices: levelChoices, toHitState: toHitState, toHitText: toHitText, weaponRow: weaponRow, toHitRow: toHitRow, weaponless: weaponless, defaultP: defaultP };
})();
if (typeof module !== "undefined" && module.exports) module.exports = GMCombat;
