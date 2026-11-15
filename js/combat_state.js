"use strict";
/* combat_state.js - DOM-free combat state (simple combat, TB 2026-11-16: no automation). Scene metadata key `combat`:
   { v:2, on:1, rd:1, tn:1, w:-1, ro:[ids], nf:[roster idx], sd:[{n,ra,sr,in,ov,et,m:[roster idx]}], pr:[[a,t,wa,wt,acForA,acForT]], ht:[hits per side], lh:[last round's hits], sp:[[idx,name,rounds left]] }
   Uses surpriseSegments, dexSegments, dexReaction, initWinner from lib/combat_rules.js (loaded first) and MONSTER_DETAILS (lib/monsters.js). Tested by test/toolkit.test.js. */
const CombatState = (function () {
    const NS = "io.github.solid-state-games.1e-toolkit", KEY = NS + "/combat", PRE = NS + "/pre", CSK = NS + "/cs";

    /* ----- the state ----- */
    // ids: token ids (roster, stored once); side: side number per id (a number past the last side = Not fighting); names: side names; ranges: surprised-on 1 to n per side
    function create(ids, side, names, ranges) {
        const n = Math.max(2, names.length);
        const c = { v: 2, on: 1, rd: 1, tn: 1, w: -1, ro: ids.slice(), nf: [], pr: [], ht: [], lh: null, sp: [],
            sd: Array.apply(null, Array(n)).map(function (x, i) { return { n: String(names[i] || (i ? "Foes" : "Party")).slice(0, 24), ra: clampRange(ranges ? ranges[i] : 2), sr: 0, in: 0, m: [] }; }) };
        c.ht = c.sd.map(function () { return 0; });
        ids.forEach(function (id, k) { if (side[k] >= c.sd.length) c.nf.push(k); else c.sd[side[k] || 0].m.push(k); });
        return c;
    }
    function clampRange(r) { r = Math.round(Number(r)); return isNaN(r) ? 2 : Math.max(0, Math.min(6, r)); }
    // 0..n-1 are the sides, n is Not fighting (bystanders, captives, mounts, hirelings out of it): never rolled for, never counted
    function sideOf(c, k) { for (let i = 0; i < c.sd.length; i++) if (c.sd[i].m.indexOf(k) >= 0) return i; return c.sd.length; }
    function moveToken(c, k, to) {
        c.sd.forEach(function (s) { s.m = s.m.filter(function (x) { return x !== k; }); }); c.nf = (c.nf || []).filter(function (x) { return x !== k; });
        (to >= c.sd.length ? c.nf : c.sd[to].m).push(k); c.sd.map(function (s) { return s.m; }).concat([c.nf]).forEach(function (a) { a.sort(function (x, y) { return x - y; }); });
        if (to >= c.sd.length) c.pr = c.pr.filter(function (p) { return p[0] !== k && p[1] !== k; });   // a token that is not fighting is in no pair
    }
    const fighters = function (c) { return [].concat.apply([], c.sd.map(function (s) { return s.m; })); };
    // Right-click side assignment (GM): put tokens on side `to` or Not fighting. In a combat it edits the roster (adding tokens not yet in it); before a combat it records the choice in `pre`.
    function sidesPatch(meta, ids, to) {
        const r = read(meta), o = {};
        if (r.c) {
            const c = JSON.parse(JSON.stringify(r.c));
            ids.forEach(function (id) { let k = c.ro.indexOf(id); if (k < 0) { c.ro.push(id); k = c.ro.length - 1; c.nf.push(k); } moveToken(c, k, to); });
            o[KEY] = c;
        } else { const pre = Object.assign({}, (meta || {})[PRE] || {}); ids.forEach(function (id) { pre[id] = to; }); o[PRE] = pre; }
        return o;
    }

    /* ----- surprise: report only, blocks nothing (DMG p.61-62, ruling A1: segments lost = the surprised side's die, both surprised subtract) ----- */
    function setRange(c, i, r) { c.sd[i].ra = clampRange(r); c.sd[i].ov = 1; }
    function setSurprise(c, i, d) { c.sd[i].sr = d ? Math.max(1, Math.min(6, Math.round(d))) : 0; }
    const surpriseReady = function (c) { return c.sd.slice(0, 2).every(function (s) { return s.ra === 0 || s.sr > 0; }); };
    // segments lost by each of the first two sides
    function surpriseSegs(c) { if (!surpriseReady(c)) return null; const r = surpriseSegments(c.sd[0].sr, c.sd[0].ra, c.sd[1].sr, c.sd[1].ra); return [r.a, r.b]; }
    // the result in words, and the DEX line for each PC of the surprised side (PHB p.11 Table I via dexReaction; DMG p.62, p.71): dex(k) = score or null (no sheet)
    function surpriseWords(c, dex, nameOf) {
        const sg = surpriseSegs(c); if (!sg) return { text: "Roll or type both dice.", dex: [] };
        const a = c.sd[0], b = c.sd[1], inA = a.ra && a.sr <= a.ra, inB = b.ra && b.sr <= b.ra;
        if (!sg[0] && !sg[1]) return { text: inA && inB ? "Both sides surprised equally: no effect." : "Nobody is surprised.", dex: [] };
        const s = sg[0] ? 0 : 1, o = 1 - s, n = sg[s];
        const list = c.sd[s].m.map(function (k) { const d = dex(k); return d ? nameOf(k) + " (DEX " + d + "): " + (function () { const l = dexSegments(n, dexReaction(d)); return l ? "loses " + l + (l > 1 ? " segments" : " segment") : "not surprised"; })() : null; }).filter(Boolean);
        return { text: c.sd[s].n + " surprised: lose " + n + (n > 1 ? " segments" : " segment") + "; " + c.sd[o].n + " may act in segment" + (n > 1 ? "s 1-" + n : " 1") + ".", dex: list };
    }

    /* ----- initiative (DMG p.62-63): d6 per side, higher first, a tie is simultaneous ----- */
    function rollInit(c, i, v) { c.sd[i].in = Math.max(1, Math.min(6, Math.round(v))); if (c.sd[0].in && c.sd[1].in) c.w = { A: 0, B: 1, tie: 2 }[initWinner(c.sd[0].in, c.sd[1].in)]; return c.w; }
    const TIE_NOTE = "Tie: both sides act together and damage is applied to both. Where both use weapons: in the round melee is joined the longer weapon strikes first, in later rounds the lower speed factor first (DMG p.63, p.66).";
    function initText(c) {
        if (c.w < 0) return "";
        const sc = c.sd[0].n + " " + c.sd[0].in + ", " + c.sd[1].n + " " + c.sd[1].in;
        return sc + (c.w === 2 ? ": tie, both sides act together" : ": " + c.sd[c.w].n + " goes first");
    }

    /* ----- rounds and turns: 1 round = 1 minute, 1 turn = 10 rounds (PHB p.39) ----- */
    const roundInTurn = function (c) { return ((c.rd - 1) % 10) + 1; };
    // Next round: this round's hits become "last round", hits and initiative clear, spell countdowns tick. Returns the names of spells that ran out.
    function nextRound(c) {
        c.lh = c.ht.slice(); c.ht = c.sd.map(function () { return 0; }); c.w = -1; c.sd.forEach(function (s) { s.in = 0; });
        c.rd++; c.tn = Math.floor((c.rd - 1) / 10) + 1;
        const done = []; c.sp.forEach(function (s) { s[2]--; if (s[2] <= 0) done.push(s); }); c.sp = c.sp.filter(function (s) { return s[2] > 0; });
        return done;
    }

    /* ----- who is fighting whom: pairs [a, t, weapon of a, weapon of t, AC override for a's target, AC override for t's target] (roster indexes) ----- */
    function addPair(c, a, t) {
        if (a === t || a < 0 || t < 0 || c.nf.indexOf(a) >= 0 || c.nf.indexOf(t) >= 0) return false;
        if (c.pr.some(function (p) { return (p[0] === a && p[1] === t) || (p[0] === t && p[1] === a); })) return false;
        c.pr.push([a, t, 0, 0, null, null]); return true;
    }
    const removePair = function (c, k) { c.pr.splice(k, 1); };
    // Right-click or tool: add a pair by token ids; both must be in the roster and fighting. Returns {patch} or {msg}.
    function pairPatch(meta, aId, tId) {
        const r = read(meta); if (!r.c) return { msg: "Start combat first." };
        const c = JSON.parse(JSON.stringify(r.c)), a = c.ro.indexOf(aId), t = c.ro.indexOf(tId);
        if (a < 0 || t < 0) return { msg: "Both tokens must be in the combat (right-click: Combat side)." };
        if (!addPair(c, a, t)) return { msg: a === t ? "A token cannot fight itself." : c.nf.indexOf(a) >= 0 || c.nf.indexOf(t) >= 0 ? "A token that is not fighting cannot be paired." : "Those two are already paired." };
        const o = {}; o[KEY] = c; return { patch: o };
    }
    // pairs that include a token that is down (a monster at 0 hit points or less) go away
    function dropDown(c, down) { c.pr = c.pr.filter(function (p) { return down.indexOf(p[0]) < 0 && down.indexOf(p[1]) < 0; }); }

    /* ----- hits this round per side: a tally for the GM; twice as often as the other side, and at least 2, means a morale check (DMG p.67 footnote) ----- */
    function hit(c, i, d) { c.ht[i] = Math.max(0, (c.ht[i] || 0) + d); }
    // a side hitting at least twice as often as another (and at least twice in all) means the other side checks morale
    function moraleFlags(c) {
        const out = [];
        c.sd.forEach(function (s, i) { const mine = c.ht[i] || 0; if (mine < 2) return; c.sd.forEach(function (o, j) { if (j !== i && mine >= 2 * (c.ht[j] || 0)) out.push(o.n + " check morale: " + s.n + " hit twice as often (DMG p.67)."); }); });
        return out;
    }

    /* ----- spell rounds on PCs (optional): [roster idx, name, rounds left] ----- */
    function addSpell(c, k, name, rounds) { rounds = Math.round(Number(rounds)); name = String(name || "").trim().slice(0, 30); if (!name || !(rounds >= 1)) return false; c.sp.push([k, name, Math.min(rounds, 999)]); return true; }

    /* ----- hit points (GM only, monsters and NPCs; PCs keep their sheet hit points): item `cs` = {h:[hp,max]} ----- */
    // "-6" or "+3" changes it, a plain number sets it (and raises the maximum if it is higher). Returns the new [hp,max] or null when the text is no number.
    function hpEdit(cur, text) {
        const t = String(text).trim(); if (!/^[+-]?\d+$/.test(t)) return null;
        const n = parseInt(t, 10);
        if (!cur) return /^\d+$/.test(t) ? [n, n] : null;   // no maximum yet: the first plain number is the maximum
        if (/^[+-]/.test(t)) return [cur[0] + n, cur[1]];
        return [n, Math.max(cur[1], n)];
    }
    const isDead = function (h) { return !!h && h[0] <= 0; };   // 0 or less is dead (TB's table, PHB p.105)
    // MM hit dice: "3+3" and "1-1" are n d8 and the modifier; "1-7 hit points" is a number from 1 to 7; "100 hit points" and "16 (128 hit points)" are that many;
    // a half or quarter die is the d8 scaled; "8, 12 or 16" takes the first number. At least 1 hit point; null when there is no number (the GM types the maximum).
    function rollHd(hd, rng) {
        rng = rng || Math.random; const t = String(hd);
        let m = /\((\d+) hit points?\)/i.exec(t) || /^(\d+) hit points?/i.exec(t); if (m) return [Number(m[1]), Number(m[1])];
        m = /^(\d+)-(\d+) hit points?/i.exec(t); if (m) { const a = Number(m[1]), b = Number(m[2]), v = a + Math.floor(rng() * (b - a + 1)); return [Math.max(1, v), Math.max(1, v)]; }
        if (t.charAt(0) === "\u00bd" || t.charAt(0) === "\u00bc") { const v = Math.max(1, Math.round((1 + Math.floor(rng() * 8)) * (t.charAt(0) === "\u00bd" ? 0.5 : 0.25))); return [v, v]; }
        m = /^(\d+)([+-]\d+)?/.exec(t); if (!m) return null;
        let n = Number(m[1]), v = m[2] ? Number(m[2]) : 0; if (n < 1) n = 1;
        for (let k = 0; k < n; k++) v += 1 + Math.floor(rng() * 8);
        v = Math.max(1, v); return [v, v];
    }
    // side casualties: Goblins down: 1 of 3 (33%), with the DMG p.67 morale reminders
    function casualties(c, isDownIdx) {
        return c.sd.map(function (s) {
            const total = s.m.length, down = s.m.filter(isDownIdx).length, pct = total ? Math.round(down * 100 / total) : 0;
            return { side: s.n, down: down, total: total, pct: pct, text: s.n + " down: " + down + " of " + total + " (" + pct + "%)", morale: total && down * 2 >= total ? "50% lost: morale +15 (DMG p.67)" : total && down * 4 >= total ? "25% lost: morale +5 (DMG p.67)" : "" };
        });
    }

    /* ----- surprise ranges from the best member of each side (DMG p.61-62, PHB p.16, 17, 24, MM) ----- */
    const DEF = 2;   // surprised on 1-2, surprises on 1-2 (DMG p.61)
    function monsterOf(name) {
        if (typeof MONSTER_DETAILS === "undefined") return null;
        const n = String(name || "").toLowerCase().replace(/\s*\(.*$/, "").replace(/\s+\d+$/, "").trim();
        const k = Object.keys(MONSTER_DETAILS).filter(function (x) { return x.toLowerCase() === n; })[0];
        return k ? { key: k, d: MONSTER_DETAILS[k] } : null;   // ponytail: exact name only; step 2 fills in the fuzzy match
    }
    // members: [{name, cls:[], race, mon:{key,d}|null}]; elfTick: elves/halflings alone or ahead, no metal armour (GM's call)
    function sideFacts(members, elfTick) {
        let on = DEF, onWho = "", sur = DEF, surWho = "";
        members.forEach(function (m) {
            let mo = DEF, ms = DEF, ow = "", sw = "";
            if ((m.cls || []).indexOf("Ranger") >= 0) { mo = 1; ms = 3; ow = sw = m.name + " (ranger), PHB p.24"; }
            if (elfTick && (m.race === "Elf" || m.race === "Halfling") && ms < 4) { ms = 4; sw = m.name + " (" + m.race.toLowerCase() + "), PHB p." + (m.race === "Elf" ? 16 : 17); }
            if (m.mon && !(m.cls && m.cls.length)) { const d = m.mon.d; if (typeof d.surprisedOn === "number") { mo = d.surprisedOn; ow = m.mon.key + ", " + d.page; } if (typeof d.surprisesOn === "number") { ms = d.surprisesOn; sw = m.mon.key + ", " + d.page; } }
            if (mo < on) { on = mo; onWho = ow; }
            if (ms > sur) { sur = ms; surWho = sw; }
        });
        return { on: on, onWho: onWho, sur: sur, surWho: surWho };
    }
    // The side's surprised-on range = what the other side surprises on, less this side's favourable factor (DMG p.62 example), floor 0.
    function deriveRanges(sides) {
        const f = sides.map(function (x) { return sideFacts(x.members, x.elfTick); });
        return [0, 1].map(function (i) {
            const o = f[1 - i], me = f[i], factor = DEF - me.on, ra = Math.max(0, Math.min(6, o.sur - factor)), why = [], pg = [];
            if (me.onWho) why.push(me.onWho.split(", ")[0]);
            if (me.onWho) pg.push(me.onWho);
            if (o.sur !== DEF) { why.push("other side surprises on 1-" + o.sur + " (" + o.surWho.split(", ")[0] + ")"); pg.push(o.surWho); }
            return { ra: ra, txt: (ra ? "1-" + ra : "cannot be surprised") + (why.length ? ": " + why.join("; ") : ": usual"), pg: pg.join("; ") || "DMG p.61" };
        });
    }
    function applyRanges(c, derived) { derived.forEach(function (d, i) { if (!c.sd[i].ov) c.sd[i].ra = d.ra; }); }

    /* ----- scene metadata in and out ----- */
    const LEGACY = [NS + "/undo", NS + "/log/"];
    function read(meta) { meta = meta || {}; const c = meta[KEY]; return { c: c && c.on ? (c.v === 2 ? c : migrate(c)) : null }; }
    // An earlier build's combat (phases, logs) keeps its sides, roster, ranges and round; everything else is dropped.
    function migrate(o) {
        const c = create(o.ro || [], (o.ro || []).map(function (id, k) { for (let i = 0; i < o.sd.length; i++) if (o.sd[i].m.indexOf(k) >= 0) return i; return o.sd.length; }), o.sd.map(function (s) { return s.n; }), o.sd.map(function (s) { return s.ra; }));
        c.rd = Math.max(1, o.rd || 1); c.tn = Math.floor((c.rd - 1) / 10) + 1; o.sd.forEach(function (s, i) { if (s.ov) { c.sd[i].ov = 1; } if (s.et) c.sd[i].et = s.et; }); return c;
    }
    // scene keys an earlier build left behind: undo, every log/<round>, and a combat key in the old shape
    function cleanPatch(meta) {
        const o = {}; Object.keys(meta || {}).forEach(function (k) { if (k === LEGACY[0] || k.indexOf(LEGACY[1]) === 0) o[k] = undefined; });
        const c = (meta || {})[KEY]; if (c && c.on && c.v !== 2) o[KEY] = migrate(c); else if (c && !c.on) o[KEY] = undefined;
        return o;
    }
    // old per-token attack counts in `cs` ({rs, at, mx}) are no longer used
    const oldCs = function (cs) { return !!cs && (cs.rs !== undefined || cs.at !== undefined || cs.mx !== undefined); };
    function clearPatch(meta) { const o = {}; Object.keys(meta || {}).forEach(function (k) { if (k === KEY || k === PRE || k === NS + "/undo" || k.indexOf(NS + "/log/") === 0) o[k] = undefined; }); o[KEY] = undefined; return o; }
    return { NS: NS, KEY: KEY, PRE: PRE, CS: CSK, TIE_NOTE: TIE_NOTE, create: create, clampRange: clampRange, sideOf: sideOf, moveToken: moveToken, fighters: fighters, sidesPatch: sidesPatch,
        setRange: setRange, setSurprise: setSurprise, surpriseReady: surpriseReady, surpriseSegs: surpriseSegs, surpriseWords: surpriseWords, rollInit: rollInit, initText: initText,
        roundInTurn: roundInTurn, nextRound: nextRound, addPair: addPair, removePair: removePair, pairPatch: pairPatch, dropDown: dropDown, hit: hit, moraleFlags: moraleFlags, addSpell: addSpell,
        hpEdit: hpEdit, isDead: isDead, rollHd: rollHd, casualties: casualties, monsterOf: monsterOf, sideFacts: sideFacts, deriveRanges: deriveRanges, applyRanges: applyRanges,
        read: read, migrate: migrate, cleanPatch: cleanPatch, oldCs: oldCs, clearPatch: clearPatch };
})();
if (typeof module !== "undefined" && module.exports) module.exports = CombatState;
