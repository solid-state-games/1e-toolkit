"use strict";
/* combat_state.js - DOM-free combat mode state (COMBAT_SPEC.md 8.2, 8.3, 9): the scene-metadata shape, the phase machine, surprise,
   initiative, the per-round log and its fold. Uses surpriseSegments, dexSegments, dexReaction, initWinner from lib/combat_rules.js
   (loaded first). Tested by test/toolkit.test.js. The GM tab (js/combat_ui.js) calls this and writes the result to scene metadata. */
const CombatState = (function () {
    const NS = "io.github.solid-state-games.1e-toolkit", KEY = NS + "/combat", LOGP = NS + "/log/";
    const MAX_BYTES = 14000, KEEP = 6, MAX_SUM = 100;       // spec 8.3: 14 kB ceiling, last 6 rounds in detail, at most 100 summary lines
    const SRC = ["sheet", "typed", "tray", "earlier"];                   // roll source codes stored in a log entry's flags
    const SRC_LABEL = ["rolled in the sheet", "physical die typed in", "Owlbear Dice tray", "rolled earlier"];
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
        const c = { v: 1, on: 1, rd: 0, ph: 1, sg: 0, op: 0, rs: 0, w: -1, ro: ids.slice(), nf: [],
            sd: [0, 1].map(function (i) { return { n: String(names[i] || (i ? "Foes" : "Party")).slice(0, 24), ra: clampRange(ranges ? ranges[i] : 2), sr: 0, sl: 0, in: 0, m: [] }; }) };
        ids.forEach(function (id, n) { if (side[n] === 2) c.nf.push(n); else c.sd[side[n] ? 1 : 0].m.push(n); });   // side 2 = Not fighting: in the roster, in no side
        return c;
    }
    function clampRange(r) { r = Math.round(Number(r)); return isNaN(r) ? 2 : Math.max(0, Math.min(6, r)); }
    // 0 and 1 are the sides, 2 is Not fighting (bystanders, captives, mounts, hirelings out of it): never rolled for, never in a count
    function sideOf(c, n) { return c.sd[0].m.indexOf(n) >= 0 ? 0 : c.sd[1].m.indexOf(n) >= 0 ? 1 : 2; }
    function moveToken(c, n, to) {
        c.sd.forEach(function (s) { s.m = s.m.filter(function (x) { return x !== n; }); }); c.nf = (c.nf || []).filter(function (x) { return x !== n; });
        (to === 2 ? c.nf : c.sd[to ? 1 : 0].m).push(n); [c.sd[0].m, c.sd[1].m, c.nf].forEach(function (a) { a.sort(function (x, y) { return x - y; }); });
    }
    const fighters = function (c) { return c.sd[0].m.concat(c.sd[1].m); };
    const changed = function (c) { return TOGGLES.filter(function (t) { return isOn(c, t.k) !== !!t.on; }).length; };

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
    function setRange(c, i, r) { c.sd[i].ra = clampRange(r); c.sd[i].ov = 1; if (c.sd[i].ra === 0) c.sd[i].sr = 0; return c.rd === 0 ? resolveSurprise(c) : false; }
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
    const TIE_NOTE = "Tie: both sides act together and damage is applied to both. Where both use weapons: in the round melee is joined the longer weapon strikes first, in later rounds the lower speed factor first (display only for now).", TIE_PG = "DMG p.63, p.66; ruling A23";

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
    const entry = function (seg, kind, actor, roll, need, flags, text, who) { const e = [seg, kind, actor, -1, roll || 0, need || 0, 0, 0, flags || 0]; if (text || who) e.push(text || ""); if (who) e.push(who); return e; };
    function logAdd(logs, rd, e) { (logs[rd] = logs[rd] || []).push(e); }
    // kinds used now: 0 initiative, 1 surprise, 10 restriction switched (kind 10 is ours; 2 to 9 are the spec's later kinds)
    function entryText(e, c) {
        const sn = function (i) { return c && c.sd[i] ? c.sd[i].n : "Side " + (i + 1); };
        if (e[9]) return e[9];
        const how = " (" + SRC_LABEL[e[8] & 3] + (e[10] ? " by " + e[10] : "") + ")";
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

    /* ----- one-button steps (the GM card): each step does its work and moves on ----- */
    const acts = function (n) { return n + (/s$/i.test(n) ? " act" : " acts"); };   // ponytail: plural by the final s
    function stepKind(c) { if (c.rd === 0) return surpriseReady(c) && maxSl(c) > 0 ? "seg" : "sur"; return ["decl", "init", "first", "second", "end"][c.ph]; }
    // sides that must roll a d6 for the current step
    function needs(c) {
        if (c.rd === 0 && stepKind(c) === "sur") return surpriseReady(c) ? [] : [0, 1].filter(function (i) { return c.sd[i].ra > 0; });
        return c.rd > 0 && c.ph === 1 && isOn(c, "cm.initiative") ? [0, 1] : [];
    }
    const freeSides = function (c, i) { return [0, 1].filter(function (x) { return c.sd[x].sl < i; }); };
    function primary(c) {
        const k = stepKind(c), n = function (i) { return c.sd[i].n; };
        if (k === "sur") return "Roll surprise";
        if (k === "seg") { const f = freeSides(c, c.sg); return f.length === 1 ? acts(n(f[0])) + ": done" : "Segment " + c.sg + ": done"; }
        if (k === "decl") return "Declare actions: done";
        if (k === "init") return "Roll initiative";
        if (k === "end") return "Next round";
        if (c.w === 2) return "Both sides act: done";
        if (!isOn(c, "cm.phase-order")) return "Sides act: done";
        return acts(n(k === "first" ? c.w : 1 - c.w)) + ": done";
    }
    // the round's steps in order: [{k, label, st: done|cur|todo, res}]
    function stepList(c) {
        const n = function (i) { return c.sd[i].n; }, L = [];
        if (c.rd === 0) {
            const ready = surpriseReady(c) && maxSl(c) > 0, m = maxSl(c);
            L.push({ k: "sur", label: "Surprise rolls", st: ready ? "done" : "cur", res: ready ? c.sd.filter(function (s) { return s.sl > 0; }).map(function (s) { return s.n + " lose " + s.sl; }).join(", ") : "" });
            if (ready) for (let i = 1; i <= m; i++) { const f = freeSides(c, i); L.push({ k: "seg", label: "Segment " + i + ": " + (f.length === 1 ? acts(n(f[0])) : "both sides may act"), st: i < c.sg ? "done" : i === c.sg ? "cur" : "todo", res: "" }); }
            L.push({ k: "r1", label: "Round 1: initiative", st: "todo", res: "" });
            return L;
        }
        const add = function (k, p, label, res) { L.push({ k: k, label: label, st: p < c.ph ? "done" : p === c.ph ? "cur" : "todo", res: p < c.ph ? res || "" : "" }); };
        if (isOn(c, "cm.declare")) add("decl", 0, "Declare actions");
        const on = isOn(c, "cm.initiative"), both = c.sd[0].in && c.sd[1].in;
        add("init", 1, on ? "Roll initiative" : "Who goes first", c.w < 0 ? "" : c.w === 2 ? "Tie" + (both ? " (" + c.sd[0].in + " each)" : "") : n(c.w) + (on && both ? " wins (" + Math.max(c.sd[0].in, c.sd[1].in) + " to " + Math.min(c.sd[0].in, c.sd[1].in) + ")" : " first"));
        if (c.w === 2) add("first", 2, "Both sides act together");
        else if (!isOn(c, "cm.phase-order")) add("first", 2, "Sides act in any order");
        else if (c.w >= 0) { add("first", 2, acts(n(c.w))); add("second", 3, acts(n(1 - c.w))); }
        else { add("first", 2, "First side acts"); add("second", 3, "Second side acts"); }
        add("end", 4, "End of round");
        return L;
    }
    // Do the current step and move on. vals: one d6 per side in needs(c); src: roll source; who: names of whoever rolled (tray).
    function step(c, logs, vals, src, who) {
        const k = stepKind(c), nd = needs(c), nm = function (i) { return c.sd[i].n; };
        if (nd.length && (!vals || vals.length < nd.length)) return { ok: false, need: nd };
        if (k === "init" && !isOn(c, "cm.initiative")) return { ok: false, first: true };
        if (k === "sur") {
            nd.forEach(function (i, j) { logAdd(logs, 0, entry(0, 1, i, vals[j], c.sd[i].ra, src, "", who && who[j])); rollSurprise(c, i, vals[j]); });
            const m = maxSl(c), s = c.sd[0].sl ? 0 : 1;
            logAdd(logs, 0, entry(0, 1, -1, 0, 0, 0, m ? nm(s) + " lose " + m + (m > 1 ? " segments." : " segment.") : "No one is surprised."));
            if (!m) startRound(c, 1);
        } else if (k === "init") {
            nd.forEach(function (i, j) { logAdd(logs, c.rd, entry(0, 0, i, vals[j], 0, src, "", who && who[j])); rollInit(c, i, vals[j]); });
            logAdd(logs, c.rd, entry(0, 0, -1, 0, 0, 0, c.w === 2 ? "Tie: both sides act together." : nm(c.w) + " wins initiative."));
            c.ph = 2;
        } else if (k === "seg") { if (c.sg >= maxSl(c)) startRound(c, 1); else c.sg++; }
        else advance(c);
        return { ok: true };
    }
    // Surprise dice rolled before this scene (Encounters tab, Turnmaster, the table): dice[side] = d6 or 0. Same maths as rolling. A held encounter (later step) calls this.
    function applyEarlierSurprise(c, logs, dice) { return step(c, logs, needs(c).map(function (i) { return dice[i]; }), 3, []); }
    function noSurprise(c, logs) { skipSurprise(c); logAdd(logs, 0, entry(0, 1, -1, 0, 0, 0, "No surprise: round 1 follows.")); }
    // cm.initiative off: the GM names who goes first (0, 1, or 2 = together)
    function stepFirst(c, logs, w) { setFirst(c, w); c.ph = 2; logAdd(logs, c.rd, entry(0, 0, -1, 0, 0, 0, w === 2 ? "Both sides act together." : c.sd[w].n + " goes first.")); }
    // which sides may act right now (for "Your side acts now")
    function actingSides(c) {
        if (c.rd === 0) return c.sg > 0 ? [0, 1].filter(function (i) { return !barred(c, i); }) : [];
        if (c.ph === 2) return c.w === 2 || !isOn(c, "cm.phase-order") ? [0, 1] : c.w >= 0 ? [c.w] : [];
        return c.ph === 3 && c.w >= 0 ? [1 - c.w] : [];
    }
    // undo: remember the step fields (not names, roster, toggles) and the round's log before a step; put them back and log kind 9
    function takeSnap(c, logs) { return { rd: c.rd, ph: c.ph, sg: c.sg, w: c.w, sd: c.sd.map(function (s) { return { sr: s.sr, sl: s.sl, in: s.in }; }), log: logs[c.rd] ? JSON.parse(JSON.stringify(logs[c.rd])) : null }; }
    function undo(c, logs, snap, label) {
        const gone = c.rd, removed = [];
        if (gone !== snap.rd) { delete logs[gone]; removed.push(gone); }
        c.rd = snap.rd; c.ph = snap.ph; c.sg = snap.sg; c.w = snap.w; snap.sd.forEach(function (s, i) { c.sd[i].sr = s.sr; c.sd[i].sl = s.sl; c.sd[i].in = s.in; });
        if (snap.log) logs[snap.rd] = JSON.parse(JSON.stringify(snap.log)); else delete logs[snap.rd];
        logAdd(logs, c.rd, entry(0, 9, -1, 0, 0, 0, "GM undid: " + label));
        return removed;
    }
    // the log a person sees: only the last roll a side made for each kind (a replaced roll is hidden)
    function visible(list) {
        const last = {}, roll = function (e) { return (e[1] === 0 || e[1] === 1) && e[2] >= 0; };
        (list || []).forEach(function (e, i) { if (roll(e)) last[e[1] + ":" + e[2]] = i; });
        return (list || []).filter(function (e, i) { return !roll(e) || last[e[1] + ":" + e[2]] === i; });
    }
    // Dice tray: take the first NEW single d6 from anyone. A roll counts as new when anything the Dice extension keeps in that
    // player's metadata differs from what was captured when the step asked, so a stale last roll is never reused.
    const TRAY = "rodeo.owlbear.dice/", sigOf = function (md) { md = md || {}; return JSON.stringify(Object.keys(md).filter(function (k) { return k.indexOf(TRAY) === 0; }).sort().map(function (k) { return [k, md[k]]; })); };
    function dieOf(md) {
        let v = (md || {})[TRAY + "rollValues"];
        if (v && typeof v === "object" && !Array.isArray(v)) v = Object.keys(v).map(function (k) { return v[k]; });
        if (!Array.isArray(v) || v.length !== 1) return null;
        v = v[0] && typeof v[0] === "object" ? v[0].value : v[0];
        return v >= 1 && v <= 6 && v === Math.floor(v) ? v : null;
    }
    function traySnap(players) { const o = {}; players.forEach(function (p) { o[p.id] = sigOf(p.metadata); }); return o; }
    // wants[j] = ids allowed to roll for need j (null once filled). Takes the first new d6 from an allowed roller; rolls from anyone else are ignored.
    function trayPick(base, players, wants) {
        for (let i = 0; i < players.length; i++) {
            const p = players[i], sg = sigOf(p.metadata); if (sg === base[p.id]) continue;
            base[p.id] = sg; const v = dieOf(p.metadata); if (!v) continue;
            for (let j = 0; j < wants.length; j++) if (wants[j] && wants[j].indexOf(p.id) >= 0) return { j: j, id: p.id, name: p.name, value: v };
        }
        return null;
    }
    // Who may roll for a side or a token: its owner(s), else the GM. owners[n] = player id of roster token n ("" = none). Step 2 reuses this for single rolls.
    function rollerFor(c, owners, gmId, target) {
        const ids = target.token !== undefined ? [owners[target.token] || ""] : c.sd[target.side].m.map(function (n) { return owners[n] || ""; });
        const out = ids.filter(function (x, k) { return x && ids.indexOf(x) === k; });
        return out.length ? out : [gmId];
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
    // read everything back out of scene metadata
    function read(meta) {
        meta = meta || {}; const logs = {}; let sum = [];
        Object.keys(meta).forEach(function (k) { if (k.indexOf(LOGP) === 0) { const r = k.slice(LOGP.length); if (r === "s") sum = meta[k]; else logs[r] = meta[k]; } });
        return { c: meta[KEY] && meta[KEY].on ? meta[KEY] : null, logs: logs, sum: sum };
    }
    // the metadata patch to write: combat, the kept rounds' logs, the summary if folded; removed keys are set undefined (clears them)
    function patch(c, logs, sum, removed) {
        const o = {}; o[KEY] = c;
        Object.keys(logs).forEach(function (k) { o[LOGP + k] = logs[k]; });   // all kept rounds: a step can log into round 0 as round 1 starts
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
    return { NS: NS, KEY: KEY, LOGP: LOGP, MAX_BYTES: MAX_BYTES, KEEP: KEEP, SRC: SRC, SRC_LABEL: SRC_LABEL, PHASE: PHASE, TOGGLES: TOGGLES, TIE_NOTE: TIE_NOTE, TIE_PG: TIE_PG, fighters: fighters, changed: changed, acts: acts, stepKind: stepKind, needs: needs, primary: primary, stepList: stepList, step: step, stepFirst: stepFirst, applyEarlierSurprise: applyEarlierSurprise, noSurprise: noSurprise, actingSides: actingSides, takeSnap: takeSnap, undo: undo, visible: visible, sigOf: sigOf, dieOf: dieOf, traySnap: traySnap, trayPick: trayPick, rollerFor: rollerFor, monsterOf: monsterOf, sideFacts: sideFacts, deriveRanges: deriveRanges, applyRanges: applyRanges,
        isOn: isOn, setToggle: setToggle, create: create, sideOf: sideOf, moveToken: moveToken, clampRange: clampRange, surpriseReady: surpriseReady, maxSl: maxSl, resolveSurprise: resolveSurprise,
        setRange: setRange, rollSurprise: rollSurprise, indivSegs: indivSegs, barred: barred, skipSurprise: skipSurprise, rollInit: rollInit, setFirst: setFirst, startRound: startRound,
        advance: advance, banner: banner, entry: entry, logAdd: logAdd, entryText: entryText, winnerOf: winnerOf, bytesOf: bytesOf, fold: fold, read: read, patch: patch,
        clearPatch: clearPatch, exportText: exportText };
})();
if (typeof module !== "undefined" && module.exports) module.exports = CombatState;
