"use strict";
/* combat_attack.js - DOM-free to-hit and weapon facts for the "who's fighting whom" pairs (simple combat: nothing is rolled or enforced).
   Uses CLASSES, MATRIX, toHit from lib/combat_rules.js, SheetRules.compute from js/sheet_rules.js (PCs) and CombatState (MM lookup). */
const CombatAttack = (function () {
    const CS = CombatState, TYPES = [10, 9, 8, 7, 6, 5, 4, 3, 2];
    // Monster column from MM hit dice (II table: up to 1-1, 1-1, 1, 1+, 2-3+, 4-5+ ... 16+). A hit die "1-1" is 1 die less 1 hit point.
    function monsterCol(d) {
        const hd = String(d.hitDice), m = /^(\d+)([+-]\d+)?/.exec(hd), n = m ? Number(m[1]) : Math.floor(d.hdValue || 0), mod = m && m[2] ? Number(m[2]) : 0;
        if (n < 1 || (n === 1 && mod < 0)) return n === 1 ? 1 : 0;
        if (n === 1) return mod > 0 ? 3 : 2;
        return n <= 3 ? 4 : n >= 16 ? 11 : 5 + Math.floor((n - 4) / 2);
    }
    // MM `attacks`: the first number is the routine (3 = claw, claw, bite); none or "see below" counts as 1
    const mmAttacks = function (d) { const m = /\d+/.exec(String(d.attacks)); return m && Number(m[0]) > 0 ? Number(m[0]) : 1; };
    const mmAc = function (d) { const m = /-?\d+/.exec(String(d.ac)); return m ? Number(m[0]) : null; };
    // The armour type a weapon adjusts against (PHB p.38): suit and shield only, never magic plusses or Dexterity; null for monsters and monks
    function armourType(comp) {
        if (!comp.ac || (comp.d && comp.d.monk)) return null;
        let t = 10; comp.ac.rows.forEach(function (r) { if (r.p === "PHB p.36") t += r.d; });
        return Math.max(2, Math.min(10, t));
    }
    // What we know about a token as attacker and as target. item = the Owlbear token
    function facts(item) {
        const sh = (item.metadata || {})[SheetRules.KEY];
        if (sh) {
            const v = SheetRules.compute(sh);
            if (v.errors && v.errors.length) return { kind: "pc", name: item.name, weapons: [], ac: null, type: null, why: v.errors[0] };
            return { kind: "pc", name: item.name, weapons: v.weapons, rows: v.toHitRows, ac: v.ac.total, type: armourType(v), routines: v.attacksPerRound };
        }
        const mon = CS.monsterOf(item.name);
        if (mon) { const n = mmAttacks(mon.d), parts = String(mon.d.damage || "").split("/"); return { kind: "mon", name: item.name, mm: mon.key, d: mon.d, col: monsterCol(mon.d), ac: mmAc(mon.d), type: null, page: mon.d.page, n: n, forms: parts.length === n ? parts : null }; }
        return { kind: "none", name: item.name, weapons: [], ac: null, type: null };
    }
    // d20 needed to hit: PC = its to-hit row for the target AC (class, level, STR or DEX bonus) less the weapon's adjustment against the armour type and any bonus;
    // monster = the monster matrix by hit dice. Hit when the d20 is at least this (no automatic hit on 20 or miss on 1, COMBAT_CALC). null = unknown, the GM types the AC.
    function need(att, wi, ac, type, bonus) {
        if (ac === null || ac === undefined || isNaN(ac)) return null;
        bonus = bonus || 0; const a = Math.max(-10, Math.min(10, Math.round(ac)));
        if (att.kind === "mon") return toHit("II", att.col, a) - bonus;
        if (att.kind !== "pc" || !att.rows) return null;
        const w = att.weapons[wi], base = (w && w.kind === "missile" ? att.rows.missile : att.rows.melee)[a];
        const adj = w && type !== null && type !== undefined ? w.adj[TYPES.indexOf(type)] || 0 : 0;
        return base - adj - bonus - ((w && w.hitExtra) || 0); // hitExtra: magic plus, non-proficiency and two-weapon penalties (sheet_rules handView)
    }
    // PHB p.38 rate of fire: 1, 2, 3, "1½", "½"
    const rateOf = function (w) { const r = String(w.rate || "1"); if (r === "½") return 0.5; const m = /^(\d+)(½)?/.exec(r); return m ? Number(m[1]) + (m[2] ? 0.5 : 0) : 1; };
    // attacks per round as text: PC melee 1, 3/2 or 2/1 (PHB p.25); PC missile "2 shots" (PHB p.38); monster "3 attacks (1-4/1-4/1-8)" (MM)
    function attacksText(f, wi) {
        if (f.kind === "mon") return f.n + (f.n > 1 ? " attacks" : " attack") + (f.forms ? " (" + f.forms.join(", ") + ")" : "");
        if (f.kind !== "pc") return "1 attack";
        const w = f.weapons[wi];
        if (w && w.kind === "missile") { const r = rateOf(w); return r === 0.5 ? "1 shot every other round" : r + (r === 1 ? " shot" : " shots"); }
        return f.routines === "2" ? "2/1" : String(f.routines || "1");
    }
    // damage die against small-medium and large (PHB p.37 weapons; MM for monsters), with the STR bonus for melee
    function damageText(f, wi) {
        if (f.kind === "mon") return "damage " + (f.d.damage || "see MM");
        if (f.kind !== "pc" || !f.weapons[wi]) return "";
        const w = f.weapons[wi], sg = function (n) { return (n > 0 ? "+" : "") + n; }, b = (w.strDmg ? " " + sg(w.strDmg) + " STR" : "") + (w.bonus ? " " + sg(w.bonus) + " magic" : "");
        return "damage " + w.sm + " vs S-M, " + w.lg + " vs L" + b;
    }
    const speedText = function (f, wi) { const w = f.kind === "pc" && f.weapons[wi]; return w && w.spd !== null && w.spd !== undefined && w.spd !== "" ? "speed " + w.spd : ""; };
    const isMissile = function (f, wi) { return f.kind === "pc" && !!f.weapons[wi] && f.weapons[wi].kind === "missile"; };
    /* ----- one row of the Hit points table: a token, its target, what it needs, what it does, and the roll ----- */
    // a target's size for the damage die: MM size "S", "M" or "L (...)"; PCs and anyone else are man-size
    function sizeOf(f) { if (f.kind === "mon") { const m = /^([SML])/.exec(String(f.d.size || "")); return m ? m[1] : "M"; } return "M"; }
    // damage per attack: PC = the weapon's die against S-M or L (PHB p.37) plus the STR bonus for melee; monster = each attack form from the MM, "1-4" being d4, "2-8" 2d4, "1-6" d6 (n-m with n dice)
    function dmgDice(f, wi, size) {
        if (f.kind === "pc") { const w = f.weapons[wi], a = w && (size === "L" ? w.lgD : w.smD); return a ? [{ label: w.name, n: a[0], die: a[1], plus: a[2] + (w.dmgMod || 0) }] : []; }
        if (f.kind !== "mon") return [];
        return (f.forms || [String(f.d.damage || "")]).map(function (x) {
            const m = /(\d+)-(\d+)/.exec(x), lo = m && Number(m[1]), hi = m && Number(m[2]);
            return m ? { label: x.trim(), lo: lo, hi: hi } : { label: x.trim() };
        });
    }
    const diceText = function (d) { return d.die ? d.n + "d" + d.die + (d.plus ? (d.plus > 0 ? "+" : "") + d.plus : "") : d.lo !== undefined ? d.lo + "-" + d.hi : d.label || ""; };
    // attacks in one press of Roll: a bow's shots at its rate (PHB p.38), a monster's attack forms (MM), one swing for a PC in melee
    function attackCount(f, wi) {
        if (f.kind === "mon") return f.n;
        const w = f.kind === "pc" && f.weapons[wi];
        return w && w.kind === "missile" ? Math.max(1, Math.floor(rateOf(w))) : 1;
    }
    // f: attacker facts, wi: weapon, tf: target facts, acOv: typed AC or null. need = null until the target's AC is known.
    function rowModel(f, wi, tf, acOv) {
        const ac = acOv !== null && acOv !== undefined && acOv !== "" ? Number(acOv) : tf.ac, size = sizeOf(tf);
        return { ac: ac, need: need(f, wi, ac, tf.type, 0), size: size, dice: dmgDice(f, wi, size), count: attackCount(f, wi), attacks: attacksText(f, wi) };
    }
    function rollDie(rng, n) { return 1 + Math.floor((rng || Math.random)() * n); }
    // damage for one hit: n dice of a die plus a modifier; a monster's "a-b" is a dice of b/a sides when that is whole, else a number from a to b
    function rollDmg(d, rng) {
        if (!d) return 0;
        if (d.die) { let t = d.plus || 0; for (let i = 0; i < d.n; i++) t += rollDie(rng, d.die); return Math.max(0, t); }
        if (d.lo === undefined) return 0;
        if (d.hi % d.lo === 0) { let t = 0; for (let i = 0; i < d.lo; i++) t += rollDie(rng, d.hi / d.lo); return t; }
        return d.lo + Math.floor((rng || Math.random)() * (d.hi - d.lo + 1));
    }
    // d20 at least the number needed is a hit (no automatic hit on 20 or miss on 1, COMBAT_CALC); a hit rolls damage. Returns the lines, hits and total damage.
    function rollRow(m, rng) {
        const lines = []; let hits = 0, dm = 0;
        for (let j = 0; j < m.count; j++) {
            const r = rollDie(rng, 20), hit = m.need !== null && r >= m.need, d = m.dice[m.dice.length > 1 ? j : 0], x = hit ? rollDmg(d, rng) : 0;
            if (hit) { hits++; dm += x; }
            const form = m.dice.length > 1 && d ? " (" + d.label + ")" : m.count > 1 ? " (shot " + (j + 1) + ")" : "";
            lines.push(r + " vs " + (m.need === null ? "?" : m.need) + form + ": " + (hit ? "hit, " + x + " damage" : "miss"));
        }
        return { lines: lines, hits: hits, dm: dm };
    }
    // damage off hit points: [hp, max] -> [hp - dm, max]
    const applyDamage = function (h, dm) { return [h[0] - dm, h[1]]; };
    const MISSILE_NOTE = "Firing into a melee: the DM gives each fighter a chance by numbers (a small creature counts half, man-size one, large one and a half) and picks who each missile hits at random by those chances (DMG p.63).";
    return { monsterCol: monsterCol, mmAttacks: mmAttacks, mmAc: mmAc, armourType: armourType, facts: facts, need: need, rateOf: rateOf, attacksText: attacksText, damageText: damageText, speedText: speedText, sizeOf: sizeOf, dmgDice: dmgDice, diceText: diceText, attackCount: attackCount, rowModel: rowModel, rollDmg: rollDmg, rollRow: rollRow, applyDamage: applyDamage, isMissile: isMissile, MISSILE_NOTE: MISSILE_NOTE };
})();
if (typeof module !== "undefined" && module.exports) module.exports = CombatAttack;
