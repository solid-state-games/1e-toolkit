"use strict";
/* combat_state.js - DOM-free combat mode state (COMBAT_SPEC.md 8.2, 8.3, 9): the scene-metadata shape, the phase machine, surprise,
   initiative, the per-round log and its fold. Uses surpriseSegments, dexSegments, dexReaction, initWinner from lib/combat_rules.js
   (loaded first). Tested by test/toolkit.test.js. The GM tab (js/combat_ui.js) calls this and writes the result to scene metadata. */
const CombatState = (function () {
    const NS = "io.github.solid-state-games.1e-toolkit", KEY = NS + "/combat", LOGP = NS + "/log/";
    const MAX_BYTES = 14000, KEEP = 6, MAX_SUM = 100;       // spec 8.3: 14 kB ceiling, last 6 rounds in detail, at most 100 summary lines
    const SRC = ["sheet", "typed", "tray"];                   // roll source codes stored in a log entry's flags
    const SRC_LABEL = ["rolled in the sheet", "physical die typed in", "Owlbear Dice tray"];
    const PHASE = ["Declare actions", "Initiative", "First side acts", "Second side acts", "End of round"];
    // Toggles used so far. b = bit in `op`, the spec section 9 position (so later steps keep the same bits). on = RAW default (section 9).
    // `op` stores only the difference from the defaults, so op 0 means all defaults and a toggle added later cannot upset a combat in progress.
    // ponytail: bits 31 and up need a second integer; none of the toggles used so far is that high.
    const TOGGLES = [
        { k: "cm.rounds", b: 0, on: 1, t: "Round counter", d: "Count rounds (1 round = 1 minute = 10 segments).", pg: "PHB p.39; DMG p.61" },
        { k: "cm.declare", b: 1, on: 0, t: "Declare actions", d: "Add a declare step at the start of each round.", pg: "DMG p.71, p.65" },
        { k: "cm.surprise", b: 2, on: 1, t: "Surprise", d: "Roll surprise, d6 per side, before round 1.", pg: "DMG p.61-62; PHB p.102" },
        { k: "cm.surprise-dex", b: 3, on: 1, t: "Dexterity reaction in surprise", d: "A PC's reaction adjustment shortens only that PC's lost segments.", pg: "DMG p.62, p.71; PHB p.11" },
        { k: "cm.surprise-bar", b: 5, on: 1, t: "Surprised side cannot act", d: "The banner bars the surprised side during its lost segments.", pg: "DMG p.61" },
        { k: "cm.initiative", b: 6, on: 1, t: "Roll initiative", d: "d6 per side each round, higher acts first, a tie is simultaneous. Off: the GM picks who goes first.", pg: "DMG p.62-63; PHB p.104" },
        { k: "cm.phase-order", b: 7, on: 1, t: "Side order", d: "Winner acts, then the other side. Off: both sides act in any order.", pg: "DMG p.61, p.63" }];
    const tog = function (name) { return TOGGLES.filter(function (t) { return t.k === name; })[0]; };
    function isOn(c, name) { const t = tog(name); return !!(t.on ^ ((c.op >> t.b) & 1)); }
    function setToggle(c, name, on) { if (isOn(c, name) !== !!on) c.op ^= (1 << tog(name).b); }

    /* ----- the state ----- */
    // ids: token ids (roster, stored once); side: 0 or 1 per id; names: two side names; ranges: surprise range per side (surprised on 1 to range).
    function create(ids, side, names, ranges) {
        const c = { v: 1, on: 1, rd: 0, ph: 1, sg: 0, op: 0, rs: 0, w: -1, ro: ids.slice(),
            sd: [0, 1].map(function (i) { return { n: String(names[i] || (i ? "Foes" : "Party")).slice(0, 24), ra: clampRange(ranges ? ranges[i] : 2), sr: 0, sl: 0, in: 0, m: [] }; }) };
        ids.forEach(function (id, n) { c.sd[side[n] ? 1 : 0].m.push(n); });
        return c;
    }
    function clampRange(r) { r = Math.round(Number(r)); return isNaN(r) ? 2 : Math.max(0, Math.min(6, r)); }
    function sideOf(c, n) { return c.sd[0].m.indexOf(n) >= 0 ? 0 : 1; }
    function moveToken(c, n, to) { c.sd.forEach(function (s) { s.m = s.m.filter(function (x) { return x !== n; }); }); c.sd[to ? 1 : 0].m.push(n); c.sd.forEach(function (s) { s.m.sort(function (a, b) { return a - b; }); }); }

    /* ----- surprise (S01 to S06, DMG p.61-62) ----- */
    const surpriseReady = function (c) { return c.sd.every(function (s) { return s.ra === 0 || s.sr > 0; }); };
    const maxSl = function (c) { return Math.max(c.sd[0].sl, c.sd[1].sl); };
    // Segments lost: surpriseSegments is the text reading (ruling A1): the surprised side loses its die score, both surprised subtract.
    function resolveSurprise(c) {
        if (!surpriseReady(c)) { c.sd[0].sl = c.sd[1].sl = 0; return false; }
        const r = surpriseSegments(c.sd[0].sr, c.sd[0].ra, c.sd[1].sr, c.sd[1].ra);
        c.sd[0].sl = r.a; c.sd[1].sl = r.b;
        if (c.sg === 0 && maxSl(c) > 0) c.sg = 1;
        if (maxSl(c) === 0) c.sg = 0;
        if (c.sg > maxSl(c)) c.sg = maxSl(c);
        return true;
    }
    function setRange(c, i, r) { c.sd[i].ra = clampRange(r); if (c.sd[i].ra === 0) c.sd[i].sr = 0; return c.rd === 0 ? resolveSurprise(c) : false; }
    function rollSurprise(c, i, v) { c.sd[i].sr = Math.max(1, Math.min(6, Math.round(v))); return resolveSurprise(c); }
    // Individual segments lost: reaction (PHB p.11) takes segments off one PC only (DMG p.62, p.71).
    function indivSegs(c, side, dex) { return isOn(c, "cm.surprise-dex") ? dexSegments(c.sd[side].sl, dexReaction(dex)) : c.sd[side].sl; }
    function barred(c, i) { return c.rd === 0 && c.sg > 0 && isOn(c, "cm.surprise-bar") && c.sd[i].sl >= c.sg; }
    function skipSurprise(c) { c.sd.forEach(function (s) { s.sr = 0; s.sl = 0; }); startRound(c, 1); }

    /* ----- initiative (I01, I02, DMG p.62-63) ----- */
    function rollInit(c, i, v) {
        c.sd[i].in = Math.max(1, Math.min(6, Math.round(v)));
        if (c.sd[0].in && c.sd[1].in) c.w = { A: 0, B: 1, tie: 2 }[initWinner(c.sd[0].in, c.sd[1].in)];
        return c.w;
    }
    function setFirst(c, w) { c.w = w; }   // cm.initiative off: the GM says who acts first (2 = simultaneous)
    const TIE_NOTE = "Tie: both sides act together and damage is applied to both. Where both use weapons: in the round melee is joined the longer weapon strikes first, in later rounds the lower speed factor first (DMG p.66, ruling A23; display only for now).";

    /* ----- the phase machine (R02) ----- */
    function startRound(c, n) { c.rd = n; c.sg = 0; c.w = -1; c.sd.forEach(function (s) { s.in = 0; }); c.ph = isOn(c, "cm.declare") ? 0 : 1; }
    function advance(c) {
        if (c.rd === 0) {
            if (!surpriseReady(c)) return { ok: false, msg: "Roll surprise for both sides first, or skip surprise." };
            if (c.sg >= maxSl(c)) startRound(c, 1); else c.sg++;
            return { ok: true };
        }
        if (c.ph === 0) c.ph = 1;
        else if (c.ph === 1) {
            if (c.w < 0) return { ok: false, msg: isOn(c, "cm.initiative") ? "Roll initiative for both sides first." : "Pick which side goes first." };
            c.ph = 2;
        } else if (c.ph === 2) c.ph = (c.w === 2 || !isOn(c, "cm.phase-order")) ? 4 : 3;
        else if (c.ph === 3) c.ph = 4;
        else startRound(c, c.rd + 1);
        return { ok: true };
    }
    // What the phase banner says: {a: headline, b: second line}
    function banner(c) {
        const n = function (i) { return c.sd[i].n; }, rd = isOn(c, "cm.rounds") ? "Round " + c.rd : "Combat";
        if (c.rd === 0) {
            if (!c.sg) return { a: "Surprise", b: surpriseReady(c) ? "No one is surprised" : "Rolling surprise" };
            const lost = [0, 1].filter(function (i) { return barred(c, i); }), free = [0, 1].filter(function (i) { return !barred(c, i); });
            return { a: "Surprise segment " + c.sg + " of " + maxSl(c), b: lost.length ? n(free[0]) + " acts. " + n(lost[0]) + " cannot act." : "Both sides may act." };
        }
        if (c.ph === 0) return { a: rd, b: "Declare actions" };
        if (c.ph === 1) return { a: rd, b: "Rolling initiative" };
        if (c.w === 2) return { a: rd, b: c.ph === 4 ? "End of round" : "Both sides act together (tie)" };
        if (!isOn(c, "cm.phase-order")) return { a: rd, b: c.ph === 4 ? "End of round" : n(c.w) + " has initiative. Sides act in any order" };
        if (c.ph === 2) return { a: rd, b: n(c.w) + " acts" };
        if (c.ph === 3) return { a: rd, b: n(1 - c.w) + " acts" };
        return { a: rd, b: "End of round" };
    }

    /* ----- the log (8.3): log/<round> = [[seg,kind,actor,target,roll,need,dmg,hpBefore,flags,text?],...]; log/s = summary lines ----- */
    const entry = function (seg, kind, actor, roll, need, flags, text) { const e = [seg, kind, actor, -1, roll || 0, need || 0, 0, 0, flags || 0]; if (text) e.push(text); return e; };
    function logAdd(logs, rd, e) { (logs[rd] = logs[rd] || []).push(e); }
    // kinds used now: 0 initiative, 1 surprise, 10 restriction switched (kind 10 is ours; 2 to 9 are the spec's later kinds)
    function entryText(e, c) {
        const sn = function (i) { return c && c.sd[i] ? c.sd[i].n : "Side " + (i + 1); };
        if (e[9]) return e[9];
        const how = " (" + SRC_LABEL[e[8]] + ")";
        if (e[1] === 0) return sn(e[2]) + " rolled " + e[4] + " for initiative" + how;
        if (e[1] === 1) return sn(e[2]) + " rolled " + e[4] + " for surprise, surprised on 1 to " + e[5] + how;
        if (e[1] === 10) { const t = TOGGLES.filter(function (x) { return x.b === e[2]; })[0]; return "Restriction " + (t ? t.t : "bit " + e[2]) + " switched " + (e[4] ? "on" : "off"); }
        return "Entry kind " + e[1];
    }
    const winnerOf = function (arr) {
        const r = (arr || []).filter(function (e) { return e[1] === 0 && e[2] >= 0 && e[2] <= 1; }), last = {};
        r.forEach(function (e) { last[e[2]] = e[4]; });
        return last[0] && last[1] ? { A: 0, B: 1, tie: 2 }[initWinner(last[0], last[1])] : -1;
    };
    // [round, initiative winner (0, 1, 2 tie, -1 none), kills side 0, kills side 1, hp lost side 0, hp lost side 1]: the last four are filled once attacks exist
    const summary = function (rd, arr) { return [Number(rd), winnerOf(arr), 0, 0, 0, 0]; };
    const bytesOf = function (c, logs, sum) { const o = {}; o[KEY] = c; Object.keys(logs).forEach(function (k) { o[LOGP + k] = logs[k]; }); if (sum.length) o[LOGP + "s"] = sum; return JSON.stringify(o).length; };
    // Fold rounds older than the last 6 into summaries; fold more early if the scene would pass the ceiling. Returns the round keys removed.
    function fold(c, logs, sum, max) {
        const removed = [], keys = function () { return Object.keys(logs).map(Number).sort(function (a, b) { return a - b; }); };
        const one = function (k) { sum.push(summary(k, logs[k])); delete logs[k]; removed.push(k); };
        keys().filter(function (k) { return k <= c.rd - KEEP; }).forEach(one);
        for (let old = keys().filter(function (k) { return k < c.rd; })[0]; old !== undefined && bytesOf(c, logs, sum) > (max || MAX_BYTES); old = keys().filter(function (k) { return k < c.rd; })[0]) one(old);
        while (sum.length > MAX_SUM) sum.shift();
        return removed;
    }
    // read everything back out of scene metadata
    function read(meta) {
        meta = meta || {}; const logs = {}; let sum = [];
        Object.keys(meta).forEach(function (k) { if (k.indexOf(LOGP) === 0) { const r = k.slice(LOGP.length); if (r === "s") sum = meta[k]; else logs[r] = meta[k]; } });
        return { c: meta[KEY] && meta[KEY].on ? meta[KEY] : null, logs: logs, sum: sum };
    }
    // the metadata patch to write: combat, the current round's log, the summary if folded; removed keys are set undefined (clears them)
    function patch(c, logs, sum, removed) {
        const o = {}; o[KEY] = c;
        if (logs[c.rd]) o[LOGP + c.rd] = logs[c.rd];
        if (removed && removed.length) { o[LOGP + "s"] = sum; removed.forEach(function (k) { o[LOGP + k] = undefined; }); }
        return o;
    }
    // end combat: every key we own goes
    function clearPatch(meta) { const o = {}; Object.keys(meta || {}).forEach(function (k) { if (k === KEY || k.indexOf(LOGP) === 0) o[k] = undefined; }); o[KEY] = undefined; return o; }
    function exportText(c, logs, sum, nameOf) {
        const L = ["1e Toolkit combat log", "Sides: " + c.sd.map(function (s) { return s.n + " (" + s.m.map(nameOf).join(", ") + ")"; }).join(" | "), "Ended in round " + c.rd, ""];
        if (sum.length) { L.push("Earlier rounds (summary: round, initiative winner, kills, hit points lost):"); sum.forEach(function (s) { L.push("  round " + s[0] + ": " + (s[1] === 2 ? "tie" : s[1] < 0 ? "no initiative" : c.sd[s[1]].n + " won initiative")); }); L.push(""); }
        Object.keys(logs).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) {
            L.push(k === 0 ? "Surprise segments" : "Round " + k);
            logs[k].forEach(function (e) { L.push("  " + (e[0] ? "segment " + e[0] + ": " : "") + entryText(e, c)); });
        });
        return L.join("\n") + "\n";
    }
    return { NS: NS, KEY: KEY, LOGP: LOGP, MAX_BYTES: MAX_BYTES, KEEP: KEEP, SRC: SRC, SRC_LABEL: SRC_LABEL, PHASE: PHASE, TOGGLES: TOGGLES, TIE_NOTE: TIE_NOTE,
        isOn: isOn, setToggle: setToggle, create: create, sideOf: sideOf, moveToken: moveToken, clampRange: clampRange, surpriseReady: surpriseReady, maxSl: maxSl, resolveSurprise: resolveSurprise,
        setRange: setRange, rollSurprise: rollSurprise, indivSegs: indivSegs, barred: barred, skipSurprise: skipSurprise, rollInit: rollInit, setFirst: setFirst, startRound: startRound,
        advance: advance, banner: banner, entry: entry, logAdd: logAdd, entryText: entryText, winnerOf: winnerOf, bytesOf: bytesOf, fold: fold, read: read, patch: patch,
        clearPatch: clearPatch, exportText: exportText };
})();
if (typeof module !== "undefined" && module.exports) module.exports = CombatState;
