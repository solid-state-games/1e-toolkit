"use strict";
/* combat_attack.js - DOM-free attack pieces (COMBAT_SPEC 8.6 checks 1 to 3 and the to-hit number). Uses CLASSES, MATRIX, toHit from lib/combat_rules.js,
   SheetRules.compute from js/sheet_rules.js (only when a PC is involved) and CombatState. Movement, range, charge, damage are later steps. */
const CombatAttack = (function () {
    const CS = CombatState, KEY = CS.NS + "/atk", CSK = CS.NS + "/cs", OWNER = CS.NS + "/owner", TYPES = [10, 9, 8, 7, 6, 5, 4, 3, 2];

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
    function problems(c, aId, tId, names, allow) {
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
        if (allow && CS.isOn(c, "cm.multi-attack")) {
            if (allow.max === 0) out.push({ id: "multi", msg: nm(aId) + " cannot fire this round (a heavy crossbow fires every other round, PHB p.38)." });
            else if (allow.used >= allow.max) out.push({ id: "multi", msg: nm(aId) + " has used all " + allow.max + " " + allow.unit + (allow.max > 1 ? "s" : "") + " this round (" + allow.used + " of " + allow.max + ")." });
        }
        return out;
    }

    /* ----- attacks per round (PHB p.25 and p.38, DMG p.62-63) ----- */
    // Token state `cs` (spec 8.4), item metadata: {rs: stamp, at: attacks used, mx: the allowance when last used}. A reader treats it as empty when rs is not the current stamp
    // (lazy reset: nothing is written at round end). The stamp is the round, and for surprise segments the segment as well.
    const stamp = function (c) { return c.rd * 100 + c.sg; };
    const csOf = function (item, c) { const k = (item.metadata || {})[CSK]; return k && k.rs === stamp(c) ? k : { rs: stamp(c), at: 0, mx: 0 }; };
    // PHB p.38 rate of fire: 1, 2, 3, "1½", "½" (heavy crossbow: one shot every other round)
    const rateOf = function (w) { const r = String(w.rate || "1"); if (r === "\u00bd") return 0.5; const m = /^(\d+)(\u00bd)?/.exec(r); return m ? Number(m[1]) + (m[2] ? 0.5 : 0) : 1; };
    // How many attacks the token may make now, and what one drag resolves.
    //  PC melee: attack routines per round from the sheet: 1, "3/2" (two routines in odd rounds, one in even; DMG p.63), 2.
    //  PC missile: one routine of `rate` shots (A18), a heavy crossbow on odd rounds only; a surprise segment triples the rate (DMG p.62), a ½ rate giving 1.
    //  Monster: one routine of the MM `attacks` count, each attack its own d20 (per = rows in one drag).
    // In a surprise segment the active side attacks as if the segment were a whole round, so a segment counts as a round for 3/2 (segment 1 = odd).
    function perRound(att, wi, c) {
        const surprise = c.rd === 0 && c.sg > 0, tri = surprise && CS.isOn(c, "cm.surprise-attacks"), odd = (surprise ? c.sg : c.rd) % 2 === 1;
        if (att.kind === "mon") return { max: 1, per: att.n, unit: "routine", forms: att.forms };
        const w = att.kind === "pc" ? att.weapons[wi] : null;
        if (w && w.kind === "missile") {
            const r = rateOf(w);
            return { max: tri ? Math.floor(3 * r) : r < 1 ? (odd ? 1 : 0) : Math.floor(r), per: 1, unit: "shot" };
        }
        const x = att.kind === "pc" ? String(att.routines || "1") : "1";
        return { max: x === "2" ? 2 : x === "3/2" ? (odd ? 2 : 1) : 1, per: 1, unit: "attack" };
    }
    // the dot on a token (js/combat_dots.js): null none, "some" attacks left, "done", "unable" (surprised this segment)
    function dotState(c, idx, cs) {
        if (idx < 0) return null;
        const side = CS.sideOf(c, idx); if (side >= c.sd.length) return null;
        if (CS.barred(c, side)) return "unable";
        const used = cs && cs.rs === stamp(c) ? cs.at : 0, mx = cs && cs.mx || 1;
        if (used > 0 && used >= mx) return "done";
        if (c.rd >= 1 && (c.ph === 4 || (c.ph === 3 && side === c.w))) return "done";
        return used > 0 ? "some" : null;
    }

    /* ----- the to-hit number (DMG p.74-75 matrices, PHB p.38 weapon adjustments, via the shared combat_rules) ----- */
    // Monster column from MM hit dice (II table: up to 1-1, 1-1, 1, 1+, 2-3+, 4-5+ ... 16+). A hit die "1-1" is 1 die less 1 hit point.
    function monsterCol(d) {
        const hd = String(d.hitDice), m = /^(\d+)([+-]\d+)?/.exec(hd), n = m ? Number(m[1]) : Math.floor(d.hdValue || 0), mod = m && m[2] ? Number(m[2]) : 0;
        if (n < 1 || (n === 1 && mod < 0)) return n === 1 ? 1 : 0;
        if (n === 1) return mod > 0 ? 3 : 2;
        return n <= 3 ? 4 : n >= 16 ? 11 : 5 + Math.floor((n - 4) / 2);
    }
    // MM `attacks`: the first number is the routine (3 = claw, claw, bite); none or "see below" counts as 1 (the GM can override)
    const mmAttacks = function (d) { const m = /\d+/.exec(String(d.attacks)); return m && Number(m[0]) > 0 ? Number(m[0]) : 1; };
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
            return { kind: "pc", name: item.name, weapons: v.weapons, rows: v.toHitRows, ac: v.ac.total, type: armourType(v), routines: v.attacksPerRound };
        }
        const mon = CS.monsterOf(item.name);
        if (mon) { const n = mmAttacks(mon.d), parts = String(mon.d.damage || "").split("/"); return { kind: "mon", name: item.name, mm: mon.key, col: monsterCol(mon.d), ac: mmAc(mon.d), type: null, page: mon.d.page, n: n, forms: parts.length === n ? parts : null }; }
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
    const text = function (an, tn, roll, nd, hit, over, form) { return an + " attacks " + tn + (form ? " (" + form + ")" : "") + ": rolled " + roll + ", needs " + nd + ": " + (hit ? "hit" : "miss") + (over ? " (GM override)" : ""); };
    return { CS: CSK, stamp: stamp, csOf: csOf, rateOf: rateOf, perRound: perRound, dotState: dotState, mmAttacks: mmAttacks, KEY: KEY, hit: hit, ownerOf: ownerOf, request: request, problems: problems, monsterCol: monsterCol, mmAc: mmAc, armourType: armourType, facts: facts, need: need, text: text };
})();
if (typeof module !== "undefined" && module.exports) module.exports = CombatAttack;
