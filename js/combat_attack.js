"use strict";
/* combat_attack.js - DOM-free to-hit and weapon facts for the "who's fighting whom" pairs (simple combat: nothing is rolled or enforced).
   Uses CLASSES, MATRIX, toHit from lib/combat_rules.js, SheetRules.compute from js/sheet_rules.js (PCs) and CombatState (MM lookup). */
const CombatAttack = (function () {
    const CS = CombatState, TYPES = [10, 9, 8, 7, 6, 5, 4, 3, 2];
    // boxes: [{id, min:{x,y}, max:{x,y}}]. The token whose bounds hold the point; if several, the one whose centre is nearest.
    function hit(pt, boxes) {
        let best = null, bd = Infinity;
        boxes.forEach(function (b) {
            if (pt.x < b.min.x || pt.x > b.max.x || pt.y < b.min.y || pt.y > b.max.y) return;
            const dx = pt.x - (b.min.x + b.max.x) / 2, dy = pt.y - (b.min.y + b.max.y) / 2, d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = b.id; }
        });
        return best;
    }
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
        return base - adj - bonus;
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
        const w = f.weapons[wi], b = w.dmgMod ? " " + (w.dmgMod > 0 ? "+" : "") + w.dmgMod + " STR" : "";
        return "damage " + w.sm + " vs S-M, " + w.lg + " vs L" + b;
    }
    const speedText = function (f, wi) { const w = f.kind === "pc" && f.weapons[wi]; return w && w.spd !== null && w.spd !== undefined && w.spd !== "" ? "speed " + w.spd : ""; };
    const isMissile = function (f, wi) { return f.kind === "pc" && !!f.weapons[wi] && f.weapons[wi].kind === "missile"; };
    const MISSILE_NOTE = "Firing into a melee: the DM gives each fighter a chance by numbers (a small creature counts half, man-size one, large one and a half) and picks who each missile hits at random by those chances (DMG p.63).";
    return { hit: hit, monsterCol: monsterCol, mmAttacks: mmAttacks, mmAc: mmAc, armourType: armourType, facts: facts, need: need, rateOf: rateOf, attacksText: attacksText, damageText: damageText, speedText: speedText, isMissile: isMissile, MISSILE_NOTE: MISSILE_NOTE };
})();
if (typeof module !== "undefined" && module.exports) module.exports = CombatAttack;
