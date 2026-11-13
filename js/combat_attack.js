"use strict";
/* combat_attack.js - DOM-free attack pieces (COMBAT_SPEC 8.6 checks 1 to 3 and the to-hit number). Uses CLASSES, MATRIX, toHit from lib/combat_rules.js,
   SheetRules.compute from js/sheet_rules.js (only when a PC is involved) and CombatState. Movement, range, charge, damage are later steps. */
const CombatAttack = (function () {
    const CS = CombatState, KEY = CS.NS + "/atk", OWNER = CS.NS + "/owner", TYPES = [10, 9, 8, 7, 6, 5, 4, 3, 2];

    /* ----- picking tokens (tool drag and click) ----- */
    // boxes: [{id, min:{x,y}, max:{x,y}}]. The token whose bounds contain the point; if several, the one whose centre is nearest.
    function hit(pt, boxes) {
        let best = null, bd = Infinity;
        boxes.forEach(function (b) {
            if (pt.x < b.min.x || pt.x > b.max.x || pt.y < b.min.y || pt.y > b.max.y) return;
            const dx = pt.x - (b.min.x + b.max.x) / 2, dy = pt.y - (b.min.y + b.max.y) / 2, d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = b.id; }
        });
        return best;
    }
    // owner = the player the GM assigned, else whoever placed it (as the sheet works it out)
    const ownerOf = function (it) { return (it.metadata || {})[OWNER] || it.createdUserId; };
    // The request a client writes to its own player metadata. A player may attack only from tokens they own; the GM from any.
    function request(role, me, items, aId, tId, n) {
        const a = items.filter(function (x) { return x.id === aId; })[0], t = items.filter(function (x) { return x.id === tId; })[0];
        if (!a || !t) return { ok: false, msg: "Drop on a token to pick the target." };
        if (a.id === t.id) return { ok: false, msg: "A token cannot attack itself." };
        if (role !== "GM" && ownerOf(a) !== me) return { ok: false, msg: "You can only attack from your own tokens." };
        return { ok: true, req: { n: n, a: a.id, t: t.id } };
    }

    /* ----- spec 8.6 checks 1 to 3: [{id, msg}], empty = fine. The GM can override the lot. ----- */
    function problems(c, aId, tId, names) {
        const out = [], nm = function (id) { return names && names[id] || "That token"; }, ai = c.ro.indexOf(aId), ti = c.ro.indexOf(tId);
        [[aId, ai], [tId, ti]].forEach(function (x) {
            if (x[1] < 0) out.push({ id: "roster", msg: nm(x[0]) + " is not in the combat. Add it with Combat side... (right-click)." });
            else if (CS.sideOf(c, x[1]) >= c.sd.length) out.push({ id: "nf", msg: nm(x[0]) + " is not fighting." });
        });
        if (out.length) return out;
        const sa = CS.sideOf(c, ai), st = CS.sideOf(c, ti);
        if (sa === st) out.push({ id: "side", msg: nm(aId) + " and " + nm(tId) + " are on the same side." });
        const acting = CS.actingSides(c);
        if (CS.isOn(c, "cm.phase-order") && acting.indexOf(sa) < 0) {
            if (c.rd === 0 && c.sg > 0 && CS.barred(c, sa)) out.push({ id: "surprise", msg: c.sd[sa].n + " is surprised for this segment and cannot act." });
            else out.push({ id: "phase", msg: c.sd[sa].n + " does not act now (" + CS.banner(c).b + ")." });
        }
        return out;
    }

    /* ----- the to-hit number (DMG p.74-75 matrices, PHB p.38 weapon adjustments, via the shared combat_rules) ----- */
    // Monster column from MM hit dice (II table: up to 1-1, 1-1, 1, 1+, 2-3+, 4-5+ ... 16+). A hit die "1-1" is 1 die less 1 hit point.
    function monsterCol(d) {
        const hd = String(d.hitDice), m = /^(\d+)([+-]\d+)?/.exec(hd), n = m ? Number(m[1]) : Math.floor(d.hdValue || 0), mod = m && m[2] ? Number(m[2]) : 0;
        if (n < 1 || (n === 1 && mod < 0)) return n === 1 ? 1 : 0;
        if (n === 1) return mod > 0 ? 3 : 2;
        return n <= 3 ? 4 : n >= 16 ? 11 : 5 + Math.floor((n - 4) / 2);
    }
    const mmAc = function (d) { const m = /-?\d+/.exec(String(d.ac)); return m ? Number(m[0]) : null; };
    // The armour type a weapon adjusts against (PHB p.38): the suit and shield only, never magic plusses or Dexterity; null for monsters and monks
    function armourType(comp) {
        if (!comp.ac || (comp.d && comp.d.monk)) return null;
        let t = 10; comp.ac.rows.forEach(function (r) { if (r.p === "PHB p.36") t += r.d; });
        return Math.max(2, Math.min(10, t));
    }
    // What we know about a token as attacker and as target. item = the Owlbear token; sheet = its sheet or undefined
    function facts(item) {
        const sh = (item.metadata || {})[SheetRules.KEY];
        if (sh) {
            const v = SheetRules.compute(sh);
            if (v.errors && v.errors.length) return { kind: "pc", name: item.name, weapons: [], ac: null, type: null, why: v.errors[0] };
            return { kind: "pc", name: item.name, weapons: v.weapons, rows: v.toHitRows, ac: v.ac.total, type: armourType(v), attacks: v.attacksPerRound };
        }
        const mon = CS.monsterOf(item.name);
        if (mon) return { kind: "mon", name: item.name, mm: mon.key, col: monsterCol(mon.d), ac: mmAc(mon.d), type: null, page: mon.d.page };
        return { kind: "none", name: item.name, weapons: [], ac: null, type: null };
    }
    // d20 needed to hit: PC = its to-hit row for the target AC (class, level, STR or DEX bonus) less the weapon's adjustment against the armour type and any bonus;
    // monster = the monster matrix by hit dice. Hit when the d20 is at least this (no automatic hit on 20 or miss on 1, COMBAT_CALC). null = unknown, GM types it.
    function need(att, wi, ac, type, bonus) {
        if (ac === null || ac === undefined || isNaN(ac)) return null;
        bonus = bonus || 0; const a = Math.max(-10, Math.min(10, Math.round(ac)));
        if (att.kind === "mon") return toHit("II", att.col, a) - bonus;
        if (att.kind !== "pc" || !att.rows) return null;
        const w = att.weapons[wi], base = (w && w.kind === "missile" ? att.rows.missile : att.rows.melee)[a];
        const adj = w && type !== null && type !== undefined ? w.adj[TYPES.indexOf(type)] || 0 : 0;
        return base - adj - bonus;
    }
    const text = function (an, tn, roll, nd, hit, over) { return an + " attacks " + tn + ": rolled " + roll + ", needs " + nd + ": " + (hit ? "hit" : "miss") + (over ? " (GM override)" : ""); };
    return { KEY: KEY, hit: hit, ownerOf: ownerOf, request: request, problems: problems, monsterCol: monsterCol, mmAc: mmAc, armourType: armourType, facts: facts, need: need, text: text };
})();
if (typeof module !== "undefined" && module.exports) module.exports = CombatAttack;
