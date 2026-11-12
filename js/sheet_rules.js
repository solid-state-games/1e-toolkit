/*  sheet_rules.js - the compact stored sheet and everything the sheet needs on top of the shared libs. DOM-free.
 *  Loaded as a plain script after lib/rules_1e.js and lib/combat_rules.js (browser) or in a vm (node test).
 *  Every rules number comes from Rules (rules_1e.js) or the combat tables (combat_rules.js). The few figures
 *  the libs do not carry are in this file with a page citation and are listed in NOTES.md ("Figures this file adds").
 *  Pages are printed pages: PHB = Players Handbook, DMG = Dungeon Masters Guide.
 */
(function (root) {
'use strict';
const Rules = root.Rules;

const NS = 'io.github.solid-state-games.1e-toolkit';
const KEY = NS + '/sheet';       // item metadata: the compact sheet
const OWNER_KEY = NS + '/owner'; // item metadata: player id the GM assigned
const FORMAT = '1e-toolkit-sheet';
const MAX_BYTES = 16000;          // OBR item metadata limit used as the hard cap
const WARN_BYTES = 14000;
const LIM = { name: 60, short: 80, text: 3000, gear: 120, known: 160, injuries: 16, profs: 16, langs: 12, cond: 6,
    places: 10, place: 30, placeCoin: 99999, hench: 15, hname: 24, hrace: 10, hclass: 14, hshare: 14, hnote: 32, hire: 20, hirenote: 30 };

const SPELL_KEY = { 'Cleric': 'cleric', 'Druid': 'druid', 'Magic-User': 'mu', 'Illusionist': 'illusionist', 'Paladin': 'cleric',
    'Ranger (druidic)': 'druid', 'Ranger (magic-user)': 'mu' };
const COIN_NAMES = ['pp', 'gp', 'ep', 'sp', 'cp'];
const COIN_GP = { pp: 5, gp: 1, ep: 0.5, sp: 0.05, cp: 0.005 }; // PHB p.35 coin exchange (1 pp = 5 gp, 1 ep = 1/2 gp, 20 sp = 1 gp, 200 cp = 1 gp)
const CAST_BITS = 12; // most memorised spells of one level that can be ticked off
const ABIL = ['str', 'int', 'wis', 'dex', 'con', 'cha'];

/* ---------- the stored sheet ---------- */
function blank() {
    return { v: 1, nm: '', pl: '', cmp: '', race: 'Human', sub: '', sex: 'm', cl: ['Fighter'], lv: [1], sc: [10, 10, 10, 10, 10, 10], ex: 0,
        al: 'N', dt: '', og: '', rg: '', hp: 0, hm: 0, xp: 0, hl: [], pf: [], inv: [], co: [0, 0, 0, 0, 0], sk: {}, sm: {}, lg: [],
        d: { bd: '', ht: '', wt: '', hr: '', ey: '', sx: '', st: '', mk: '', mn: '', ap: '' }, ij: [], nt: '', ta: [0, 0, 0, 0, 0, 0, 0, 0],
        sj: [], cj: [], psi: { a: '', m: '', d: '', mj: '', mi: '' }, dn: '', lp: [], hn: [], hr: [], cs: {}, am: {} };
}
const clampInt = (v, lo, hi, dflt) => { v = Math.floor(Number(v)); return isNaN(v) ? dflt : Math.min(hi, Math.max(lo, v)); };
const str = (v, n) => String(v === undefined || v === null ? '' : v).slice(0, n);


/* ---------- retainer tables (DMG p.29-37). Every figure carries its page; test/toolkit.test.js diffs them against ADD-BOOKS-PDF/TEXT. ---------- */
// Soldiers: ids are indexes into this fixed list (append only). Pay and numbers come from QPRules.MERC (lib/quickparty_rules.js, DMG p.29-31).
const SOLDIERS = ['archer (longbow)', 'archer (shortbow)', 'artillerist', 'crossbowman', 'footman, heavy', 'footman, light', 'footman, pikeman', 'hobilar, heavy', 'hobilar, light',
    'horseman, archer', 'horseman, crossbowman', 'horseman, heavy', 'horseman, light', 'horseman, medium', 'sapper/miner', 'slinger'];
// Expert hirelings: c = printed fixed monthly gp, lv = gp per level per month, r = printed range (agreed figure typed in), once = not a monthly cost.
// star = the table's asterisk: add 10% of the cost of items made, per job (DMG p.29 note). t = one-line fragments of the page text that carry the figure.
const EXPERTS = [
    { n: 'alchemist', c: 300, p: 'DMG p.29', t: ['alchemist 300'] },
    { n: 'armorer', c: 100, star: 1, p: 'DMG p.29', t: ['armorer 100*'] },
    { n: 'blacksmith', c: 30, p: 'DMG p.29', t: ['blacksmith 30'] },
    { n: 'engineer-architect', c: 100, star: 1, p: 'DMG p.29', t: ['engineer-architect 100*'] },
    { n: 'engineer-artillerist', c: 150, p: 'DMG p.29', t: ['engineer-artillerist 150'] },
    { n: 'engineer-sapper/miner', c: 150, p: 'DMG p.29', t: ['engineer-sapper/miner 150'] },
    { n: 'jeweler-gemcutter', c: 100, star: 1, p: 'DMG p.29', t: ['jeweler-gemcutter 100*'] },
    { n: 'scribe', c: 15, p: 'DMG p.29', t: ['scribe 15'] },
    { n: 'weapon maker', c: 100, star: 1, p: 'DMG p.29', t: ['weapon maker 100*'] },
    { n: 'captain (per level)', lv: 100, p: 'DMG p.30', t: ['monthly cost of a captain is 100 gold pieces'] },
    { n: 'lieutenant (per level)', lv: 100, p: 'DMG p.31', t: ['monthly cost of a lieutenant is'] },
    { n: 'steward/castellan (per level)', lv: 200, p: 'DMG p.34', t: ['(200 g.p./level)'] },
    { n: 'ship master, captain or lieutenant (per level)', lv: 100, p: 'DMG p.34', t: ['masters, captains and lieutenants is 100 g.p. per month per level'] },
    { n: 'ship sailor', c: 2, p: 'DMG p.33', t: ['Sailors cost the same as heavy infantry soldiers (2 g.p. per month)'] },
    { n: 'ship oarsman', c: 5, p: 'DMG p.33', t: ['they cost 5 g.p. per month'] },
    { n: 'ship marine', c: 3, p: 'DMG p.33', t: ['they cost 3 g.p. per month'] },
    { n: 'ship mate', c: 30, p: 'DMG p.33', t: ['cost 30 g.p. per month'] },
    { n: 'sage, support and salary', r: [200, 1200], p: 'DMG p.33', t: ['SUPPORT & SALARY PER MONTH 200 to 1,200 g.p.'] },
    { n: 'sage, research grants', r: [200, 1200], p: 'DMG p.33', t: ['RESEARCH GRANTS PER MONTH 200 to 1,200 g.p.'] },
    { n: 'spy (per assignment, not monthly)', r: [100, 10000], once: 1, p: 'DMG p.34', t: ['from as little as 100 g.p. to as great as 10,000'] }
];
const SOLDIER_PAY_PAGE = 'DMG p.29'; // table of monthly costs: "archer (longbow) 4" and so on
const SERJEANT_MULT = 10;            // DMG p.31: "The monthly cost for a serjeant is 10 times the rate of the troops he or she commands"

// Loyalty (DMG p.36-37, base from Charisma PHB p.13). cats: choose one option each (default none). Option = [printed label, modifier %, optional one-line page fragment].
const LOY_BASE = 50; // DMG p.36 "NORMAL LOYALTY BASE: 50%, +/- charisma adjustment"
const LOY_CATS = [
    { id: 'enl', l: 'Enlistment or association', p: 'DMG p.36', o: [['associated non-player character', -10], ['captured and enlisted', -15], ['henchman', 5], ['hired mercenary', 0], ['hired mercenary, short term', -5], ['slave', -30]] },
    { id: 'len', l: 'Length of enlistment or association', p: 'DMG p.36', o: [['less than 1 month', -5], ['less than 1 year', 0], ['1 to 5 years', 10], ['more than 5 years', 25]] },
    { id: 'trn', l: 'Training or status level', p: 'DMG p.36', o: [['untrained or peasant', -25], ['little training, levied troops', -15], ['newly recruited regulars', -5], ['trained regulars', 10], ['elite, sub-officers, minor officials/expert hireling', 20], ['guards, officers, or major officials/henchmen', 30]] },
    { id: 'pay', l: 'Pay or treasure shared', p: 'DMG p.36', o: [['none', -20], ['partial, late, or unfair', -10], ['average', 0], ['above average, choice shares', 5], ['exceptional, bonuses, gift items', 10]] },
    { id: 'dis', l: 'Discipline or activity', p: 'DMG p.36', o: [['none/one', -10], ['lax/little', -5], ['firm and harsh/occasional', 0], ['firm and fair/often', 10]] },
    { id: 'trt', l: 'General treatment by liege', p: 'DMG p.36', o: [['inhuman and heartless', -25], ['cruel and domineering', -10], ['indifferent and uncaring or variable', -5], ['just and invariable', 10], ['just, kind, and invariable', 15]],
        note: 'The printed note: the cruel and domineering minus applies only when the liege is not present, is incapacitated or dead; if the liege is near and in power, minuses are treated as pluses, otherwise treat as 0% (fear). Tick the figure you decide applies.' },
    { id: 'rpl', l: 'Racial preference for the liege', p: 'DMG p.37', o: [['antipathy', -5], ['good will', 10], ['hatred', -20], ['neutral', 0], ['preferred', 20], ['tolerance', 0]] },
    { id: 'rpg', l: 'Racial preference for the associated group', p: 'DMG p.37', o: [['antipathy', -10], ['good will', 5], ['hatred', -15], ['neutral', 0], ['preferred', 15], ['tolerance', -5]] },
    { id: 'all', l: 'Alignment places removed from the liege', p: 'DMG p.37', o: [['1 place removed', 0], ['2 places removed', -15], ['3 places removed', -35]] },
    { id: 'alg', l: 'Alignment places removed from the associated group', p: 'DMG p.37', o: [['1 place removed', 0], ['2 places removed', -5], ['3 places removed', -20]] }
];
// Racial preference and alignment lines are printed in two columns; the test reads the printed row by label and either figure.
const LOY_ALIGN = { LG: 15, LN: 10, LE: 5, NG: 0, N: 0, CG: -5, CN: -10, NE: -15, CE: -20 }; // DMG p.37 "Alignment of Liege"
const LOY_ALIGN_ROWS = [['LG', 'lawful good', 15], ['LN', 'lawful neutral', 10], ['LE', 'lawful evil', 5], ['NG', 'neutral good', 0], ['N', 'neutral', 0], ['CG', 'chaotic good', -5], ['CN', 'chaotic neutral', -10], ['NE', 'neutral evil', -15], ['CE', 'chaotic evil', -20]];
// Special considerations (DMG p.37): "Apply only one penalty and one bonus maximum, whichever of either category is the higher."
const LOY_SPECIAL = [
    ['killed faithful henchman or hireling in front of a witness(es)', -40, 'witness(es) -40%'], ['tortured faithful henchman or hireling in front of a witness(es)', -30, 'witness(es) -30%'],
    ['reputed to have slain faithful henchmen or hirelings or actually left them to die', -20, 'actually left them to die -20%'], ['foresworn or oath breaker or deserter', -15, 'foresworn or oath breaker or deserter -15%'],
    ['rumored to have tortured faithful henchmen or hirelings', -10, 'hirelings -10%'], ['discharged faithful henchmen or hirelings without cause', -5, 'without cause -5%'],
    ['given a choice gift or bonus within last two months (hireling) or three months (henchman)', 5, 'three months (henchman) +5%'], ['risked life for within last six months (hireling) or one year (henchman)', 10, 'one year (henchman) +10%'],
    ['ransomed or rescued within one year', 15, 'ransomed or rescued within one year +15%'], ['saved life directly or personally', 25, 'saved life directly or personally +25%'],
    ['uses and diminishes his or her own magic to benefit the NPC (including use of spells, especially cures)', 25, 'especially cures). +25%'], ['returned henchman or hireling to normal state from death-like state, had raised or resurrected', 50, 'resurrected +50%']
];
// Situation modifiers (DMG p.37), this check only: [label, per, figure, fragment]. per = 1 tick or a count.
const LOY_SITUATION = [
    ['liege dead or surrounded and outnumbered', 0, -25, 'liege dead or surrounded and outnumbered -25%'], ['liege hors de combat', 0, -15, 'liege hors de combat -15%'],
    ['each henchman dead or hors de combat', 1, -5, 'each henchman dead or hors de combat -5%'], ['each hit die or level dead, friendly', 1, -3, 'each hit die or level dead, friendly -3%'],
    ['each hit die or level alive, enemy', 1, -1, 'each hit die or level alive, enemy -1%'], ['each hit die or level dead, enemy', 1, 1, 'each hit die or level dead, enemy +1%'],
    ['each hit die or level alive, friendly', 1, 2, 'each hit die or level alive, friendly +2%'], ['each henchman present, in sight, alive', 1, 5, 'each henchman present, in sight, alive +5%'],
    ['liege present, in sight, alive', 0, 15, 'liege present, in sight, alive +15%']
];
// Loyalty score bands (DMG p.36): [from, to, name, meaning, fragment]
const LOY_BANDS = [[-Infinity, 0, 'None', 'will attempt to kill, capture, harm, or desert at first possible opportunity', 'less than 01 none'], [1, 25, 'Disloyal', 'will always seek own advantage regardless of circumstances', '01-25 disloyal'],
    [26, 50, 'Little', 'will seek own advantage at first sign of weakness', '26-50 little'], [51, 75, 'Fair', 'will support cause if no great risk is involved', '51-75 fair'],
    [76, 100, 'Loyal', 'will always attempt to further the ends of the liege, even at great risk', '76-00 loyal'], [101, Infinity, 'Fanatical', 'will serve unquestioningly and lay down own life if necessary without hesitation', 'greater than 00 fanatical']];
// Typical check situations (DMG p.36): [situation, failure result]
const LOY_CHECKS = [['offered bribe', 'co-operates'], ['ordered to testify against liege', 'agrees'], ['has a chance to steal goods', 'steals'], ['left alone in possible danger', 'deserts'], ['abandoned', 'deserts'],
    ['ordered into possible danger', 'refuses'], ['ordered to perform heroic act', 'refuses'], ['ordered to perform heroic and dangerous act', 'refuses'], ['ordered to rescue party member(s)', 'refuses'], ['ordered to rescue liege', 'refuses'],
    ['in combat with possibly dangerous foe', 'runs away'], ['liege incapacitated or slain', 'runs away'], ['offered surrender terms', 'surrenders'], ['surrounded by superior foe', 'surrenders'], ['ordered to use up or diminish own magic item', 'refuses']];
const HENCH_MAINT = 100; // DMG p.25: "MAINTENANCE OF HENCHMEN 100 g.p. per level per month*" (in addition to treasure shares)

// mods = one choice per loyalty category (0 = none), then the chosen special penalty and special bonus (indexes into LOY_PENALTY / LOY_BONUS, 1-based); trailing zeros dropped
const LOY_PENALTY = LOY_SPECIAL.filter(x => x[1] < 0), LOY_BONUS = LOY_SPECIAL.filter(x => x[1] > 0);
const cleanMods = m => {
    const lim = LOY_CATS.map(c => c.o.length).concat([LOY_PENALTY.length, LOY_BONUS.length]);
    const a = lim.map((n, i) => clampInt(Array.isArray(m) ? m[i] : 0, 0, n, 0)); while (a.length && !a[a.length - 1]) a.pop(); return a;
};

// an inventory entry = [name, qty], [name, qty, lb], [name, qty, lb, ac]; plus an optional trailing string: "n" = in place n (1-based, no string = Carried),
// or, for Carried items only, a worn mark: "w" worn, "wN" worn with N of a Defender's bonus held back for armour class, "x" not worn. No mark = the item's default
// (ordinary armour and shields worn, magic items not worn), so old saves load unchanged.
function entryParts(e) {
    const last = e[e.length - 1], has = e.length > 2 && typeof last === 'string' && /^(\d+|w\d?|x)$/.test(last);
    const place = has && /^\d+$/.test(last);
    return { core: has ? e.slice(0, -1) : e, loc: place ? Number(last) : 0, flag: has && !place ? last : '' };
}

// Make any input (loaded, imported, half-typed) into a legal, bounded sheet. Never throws.
function sanitize(x) {
    const b = blank(), s = (x && typeof x === 'object') ? x : {};
    const out = b;
    out.nm = str(s.nm, LIM.name); out.pl = str(s.pl, LIM.name); out.cmp = str(s.cmp, LIM.name);
    out.race = Rules.RACES[s.race] ? s.race : 'Human';
    out.sub = out.race === 'Halfling' && Rules.HALFLING_SUBRACES.indexOf(s.sub) >= 0 ? s.sub : '';
    out.sex = s.sex === 'f' ? 'f' : 'm';
    let cl = Array.isArray(s.cl) ? s.cl.filter(c => Rules.CLASSES[c]).filter((c, i, a) => a.indexOf(c) === i).slice(0, 3) : [];
    if (!cl.length) cl = ['Fighter'];
    out.cl = cl;
    out.lv = cl.map((c, i) => clampInt(Array.isArray(s.lv) ? s.lv[i] : 1, 1, 30, 1));
    out.sc = ABIL.map((a, i) => clampInt(Array.isArray(s.sc) ? s.sc[i] : 10, 3, 25, 10));
    out.ex = clampInt(s.ex, 0, 100, 0);
    out.al = Rules.ALIGNMENTS.indexOf(s.al) >= 0 ? s.al : 'N';
    out.dt = str(s.dt, LIM.short); out.og = str(s.og, LIM.short); out.rg = str(s.rg, LIM.short);
    out.hp = clampInt(s.hp, -99, 999, 0); out.hm = clampInt(s.hm, 0, 999, 0); out.xp = clampInt(s.xp, 0, 99999999, 0);
    out.hl = (Array.isArray(s.hl) ? s.hl : []).slice(0, 30).map(v => clampInt(v, 0, 99, 0));
    out.pf = (Array.isArray(s.pf) ? s.pf : []).map(v => str(v, LIM.name)).filter(Boolean).slice(0, LIM.profs);
    // places: [name, pp, gp, ep, sp, cp] each; inventory entry location is a trailing string "n" = place n (1-based), none = Carried
    out.lp = (Array.isArray(s.lp) ? s.lp : []).slice(0, LIM.places).map(e => { e = Array.isArray(e) ? e : []; return [str(e[0], LIM.place) || 'Place'].concat(COIN_NAMES.map((c, i) => clampInt(e[i + 1], 0, LIM.placeCoin, 0))); });
    out.inv = (Array.isArray(s.inv) ? s.inv : []).filter(Array.isArray).slice(0, LIM.gear).map(e => {
        const p = entryParts(e), r = [str(p.core[0], LIM.name), clampInt(p.core[1], 1, 9999, 1)];
        if (p.core.length > 2 && p.core[2] !== null && p.core[2] !== undefined && p.core[2] !== '') { r.push(Math.max(0, Math.round(Number(p.core[2]) * 100) / 100 || 0)); }
        if (p.core.length > 3 && p.core[3] !== null && p.core[3] !== undefined && p.core[3] !== '') { r.push(clampInt(p.core[3], -10, 10, 10)); }
        if (p.loc >= 1 && p.loc <= out.lp.length) r.push(String(p.loc));
        else if (!p.loc && p.flag) { const f = cleanFlag(p.flag, r); if (f) r.push(f); }
        return r;
    }).filter(e => e[0]);
    out.co = COIN_NAMES.map((c, i) => clampInt(Array.isArray(s.co) ? s.co[i] : 0, 0, 99999999, 0));
    ['sk', 'sm'].forEach(k => {
        out[k] = {};
        const src = s[k] && typeof s[k] === 'object' ? s[k] : {};
        Object.keys(src).slice(0, 6).forEach(c => {
            if (!Array.isArray(src[c])) return;
            out[k][str(c, 24)] = src[c].slice(0, 10).map(l => (Array.isArray(l) ? l : []).slice(0, 30).map(n => str(n, 40)).filter(Boolean));
        });
    });
    out.lg = (Array.isArray(s.lg) ? s.lg : []).map(v => str(v, 30)).filter(Boolean).slice(0, LIM.langs);
    Object.keys(b.d).forEach(k => { out.d[k] = str(s.d && s.d[k], k === 'mk' || k === 'mn' || k === 'ap' ? 160 : 40); });
    out.ij = (Array.isArray(s.ij) ? s.ij : []).filter(Array.isArray).slice(0, LIM.injuries).map(e => [str(e[0], 40), str(e[1], 24), str(e[2], 80)]);
    out.nt = str(s.nt, LIM.text);
    out.ta = Array.isArray(s.ta) ? b.ta.map((z, i) => clampInt(s.ta[i], -99, 99, 0)) : b.ta;
    ['sj', 'cj'].forEach(k => { out[k] = (Array.isArray(s[k]) ? s[k] : []).filter(Array.isArray).slice(0, LIM.cond).map(e => [str(e[0], 6), str(e[1], 50)]); });
    Object.keys(b.psi).forEach(k => { out.psi[k] = str(s.psi && s.psi[k], 80); });
    out.dn = str(s.dn, 60);
    out.hn = (Array.isArray(s.hn) ? s.hn : []).filter(Array.isArray).slice(0, LIM.hench).map(e => [str(e[0], LIM.hname), str(e[1], LIM.hrace), str(e[2], LIM.hclass), clampInt(e[3], 1, 30, 1),
        clampInt(e[4], -99, 999, 0), clampInt(e[5], -10, 10, 10), str(e[6], LIM.hshare), clampInt(e[7], 0, 99999, 0), str(e[8], 40), str(e[9], LIM.hnote), cleanMods(e[10])]);
    out.hr = (Array.isArray(s.hr) ? s.hr : []).filter(Array.isArray).slice(0, LIM.hire).map(e => {
        const t = e[0] === 1 ? 1 : 0, list = t ? EXPERTS : SOLDIERS, i = clampInt(e[1], 0, list.length - 1, -1);
        if (i < 0) return null;
        const n = clampInt(e[2], 1, 9999, 1);
        return [t, i, n, t ? clampInt(e[3], 0, 99999, 0) : clampInt(e[3], 0, n, 0), str(e[4], LIM.hirenote)];
    }).filter(Boolean);
    // Simple view state. cs = spells cast today: per class, per level, a bit mask over the memorised list (bit i = memorised spell i is cast).
    // am = ammunition spent: carried ammunition line name -> number used. Both are dropped when the line or spell they refer to is gone.
    out.cs = {};
    const csrc = s.cs && typeof s.cs === 'object' ? s.cs : {};
    Object.keys(out.sm).forEach(c => {
        if (!Array.isArray(csrc[c])) return;
        const r = out.sm[c].map((l, i) => clampInt(csrc[c][i], 0, Math.pow(2, Math.min(l.length, CAST_BITS)) - 1, 0));
        while (r.length && !r[r.length - 1]) r.pop(); if (r.length) out.cs[c] = r;
    });
    out.am = {};
    const asrc = s.am && typeof s.am === 'object' ? s.am : {};
    ammoLines(out).forEach(a => { const v = clampInt(asrc[a.name], 0, a.total, 0); if (v) out.am[a.name] = v; });
    return out;
}
function pack(sheet) { return JSON.stringify(sanitize(sheet)); }
function bytes(text) { let n = 0; for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); n += c < 0x80 ? 1 : c < 0x800 ? 2 : (c >= 0xD800 && c <= 0xDBFF) ? (i++, 4) : 3; } return n; }
function sizeOf(sheet) { return bytes(pack(sheet)); }
function exportText(sheet) { return JSON.stringify({ format: FORMAT, version: 1, sheet: sanitize(sheet) }, null, 1); }
function parseImport(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('That is not valid JSON.'); }
    const s = o && o.format === FORMAT ? o.sheet : (o && o.cl && o.sc ? o : null);
    if (!s) throw new Error('That file is not a 1e Character Sheet export.');
    return sanitize(s);
}

/* ---------- armour class from what is worn (TB 2026-11-12): DMG p.28, p.81, p.124, p.125-169, p.164-165 ----------
 * Every item that changes armour class is recognised by name (typed or picked), carries a "worn" mark, and combines by the rules printed in its own DMG entry.
 * WEAR_TEXT lists one-line fragments of the page text; test/toolkit.test.js (f) diffs them against ADD-BOOKS-PDF/TEXT. Rules as read are in NOTES.md "Magic items and armour class". */
const ARMOUR_NAMES = { plate: 'Plate', banded: 'Banded', splint: 'Splinted', splinted: 'Splinted', chain: 'Chain', scale: 'Scale', ring: 'Ring', studded: 'Studded', 'studded leather': 'Studded', leather: 'Leather', padded: 'Padded' };
const MAG_ARMOUR_RE = /^(Plate|Banded|Splint(?:ed)?|Chain|Scale|Ring|Studded Leather|Studded|Leather|Padded)(?: Mail| Armou?r)*,?\s*(?:([+\-−]\s*\d)|of (Etherealness|Vulnerability)\b\s*([+\-−]\s*\d)?)/i;
const sgnInt = t => Number(String(t).replace(/−/g, '-').replace(/\s+/g, ''));
const WEAR_TEXT = [ // [id, page, one-line fragments of the page text]
    ['armour', 164, ['each +1 of armor, regardless of the type of armor, the wearer moves upwards', 'chain mail +1 is chain mail', 'while a shield +1 is equal to armor class 8', 'Plate Mail of Etherealness is seemingly normal +5 armor']],
    ['armour-list', 124, ['Chain Mail +3', 'Leather Armor +1', 'Plate Mail +5', 'Plate Mail of Etherealness', 'Plate Mail of Vulnerability', 'Ring Mail +1', 'Scale Mail +2', 'Splint Mail +4', 'Studded Leather +1', 'Shield +5', 'Shield, large, +1, +4 vs. missiles', 'Shield -1, missile attractor', 'Sword +4, Defender', 'Sword +5, Defender']],
    ['vulnerable', 165, ['but it is actually -2, -3, or -4 cursed plate mail', 'Shield, large, +1, +4 versus missiles is a typical large shield', 'shieldless person, it also attracts missiles of all sorts to itself', 'Sword +4, Defender, gives its wielder the option of using all, some, or none of', 'be added on to his or her armor class.']],
    ['ethereal', 165, ['armor is +4, if 10 are used it is +3, +2 if 15 are used, and only +1 if all 20']],
    ['rings2', 129, ['No more than 2 magic rings can be worn by a character at the same time.', 'worn on the same hand; a 2nd will cause both to be useless.']],
    ['ring', 130, ['A +1 ring raises AC by 1', 'does not add to armor value if magical armor is worn', 'does add to saving throw die rolls', 'do not combine protection; only one', '01-70 +1', '71-82 +2', "83 +2, 5' radius protection", '84-90 +3', "91 +3, 5' radius protection", '92-97 +4 on AC, +2 on saving throws', '98-00 +6 on AC, +1 on saving throws', 'only the ring wearer gains armor class additions']],
    ['bracers', 139, ['armor and employing a shield. Of course, if armor is actually worn, the bracers', 'will not be effective, but they do work in conjunction with other magical items of', '01-05 8', '16-35 6', '86-00 2']],
    ['cloakP', 141, ['each plus of the cloak of protection bettering', '10 (no armor) into armor class 9, and add +1 to saving throw dice rolls', 'It cannot function in conjunction with any sort of magical armor, normal', 'armor other than that of leather, or in conjunction with a shield of any sort.', '01-35 +1 cloak', '96-00 +5 cloak']],
    ['cloakD', 140, ['affords +2 protection, i.e. 2 classes better on armor class, as well as +2 on']],
    ['bootsS', 139, ['the wearer increases armor class value by +1 due to the']],
    ['bootsF', 139, ['speed give +2 to armor class value in combat situations where movement']],
    ['ioun', 147, ['dusty rose prism gives +1 protection']],
    ['staff', 134, ['The wielder of this staff gains +2 on armor class and saving throws.']],
    ['helm', 145, ['The helm is armor of +2 value.']],
    ['saves', 81, ['throws will NOT be aided by magic armor against:', 'Saving throw rolls WILL receive an armor bonus against:', 'ACID, EXCEPT WHEN IMMERSION OCCURS', 'DISINTEGRATION', 'FALLING DAMAGE', 'FIRE, MAGICAL AND OTHERWISE', 'SPELLS WHICH CAUSE PHYSICAL DAMAGE', 'Exception: Metallic armor will NOT add to saving throws versus electrical']]
];
const WEAR_PAGE = {}; WEAR_TEXT.forEach(x => { WEAR_PAGE[x[0]] = 'DMG p.' + x[1]; });
// The picker: [group, name, lb]. Typed names that match work as well.
const MAGIC_AC_PICK = (() => {
    const L = [], arm = (n, w) => L.push(['Magic armour (DMG p.124)', n, w]);
    [['Chain Mail', 30, [1, 2, 3]], ['Leather Armor', 15, [1]], ['Plate Mail', 45, [1, 2, 3, 4, 5]], ['Ring Mail', 25, [1]], ['Scale Mail', 40, [1, 2]], ['Splint Mail', 40, [1, 2, 3, 4]], ['Studded Leather', 20, [1]]]
        .forEach(a => a[2].forEach(p => arm(a[0] + ' +' + p, a[1])));
    arm('Plate Mail of Etherealness', 45); [2, 3, 4].forEach(p => arm('Plate Mail of Vulnerability -' + p, 45));
    [1, 2, 3, 4, 5].forEach(p => L.push(['Magic shields (DMG p.124)', 'Shield +' + p, 5]));
    L.push(['Magic shields (DMG p.124)', 'Shield, large, +1, +4 vs. missiles', 10], ['Magic shields (DMG p.124)', 'Shield -1, missile attractor', 5]);
    ['Ring of Protection +1', 'Ring of Protection +2', "Ring of Protection +2, 5' radius", 'Ring of Protection +3', "Ring of Protection +3, 5' radius", 'Ring of Protection +4 on AC, +2 on saving throws', 'Ring of Protection +6 on AC, +1 on saving throws'].forEach(n => L.push(['Rings (DMG p.130)', n, 0]));
    [8, 7, 6, 5, 4, 3, 2].forEach(a => L.push(['Other protective items (DMG p.139-147)', 'Bracers of Defense AC ' + a, 0]));
    [1, 2, 3, 4, 5].forEach(p => L.push(['Other protective items (DMG p.139-147)', 'Cloak of Protection +' + p, 2.5]));
    [['Cloak of Displacement', 2.5], ['Boots of Striding and Springing', 3], ['Boots of Speed', 3], ['Ioun Stone, dusty rose prism', 0], ['Staff of Power', 10], ['Helm of Brilliance', 4.5], ['Sword +4, Defender', 5], ['Sword +5, Defender', 5]]
        .forEach(a => L.push(['Other protective items (DMG p.139-147)', a[0], a[1]]));
    return L;
})();
function itemInfo(kind, extra) { return Object.assign({ kind, magic: true, def: false }, extra); }
// What a row is, as far as armour class goes, or null (a plain item). name, and the stored AC for custom rows.
function protectiveInfo(name, acStored) {
    const n = String(name || '').trim().replace(/\s+/g, ' ');
    const idx = eqIndex(), plain = idx[n];
    const m = MAG_ARMOUR_RE.exec(n);
    if (m) {
        const base = idx[ARMOUR_NAMES[m[1].toLowerCase()]];
        const plus = m[2] ? sgnInt(m[2]) : m[3].toLowerCase() === 'etherealness' ? (m[4] ? sgnInt(m[4]) : 5) : (m[4] ? sgnInt(m[4]) : -2);
        if (!base || plus < -4 || plus > 5 || plus === 0) return null;
        return itemInfo('armor', { name: n, base: base.n, baseAc: base.ac, plus, ac: base.ac - plus, leather: false, w: base.w, p: WEAR_PAGE.armour,
            tip: 'Magic armour: each plus moves armour class one better than the suit (DMG p.164). ' + (plus < 0 ? 'Cursed: worse than the plain suit (DMG p.165). ' : '') + 'A ring of protection adds no armour class with it and a cloak of protection does not work with it (DMG p.130, p.141).' });
    }
    if (/^Shield\b/i.test(n) && !plain) {
        if (/missile attract/i.test(n)) return itemInfo('shield', { name: n, plus: 0, v: 0, attractor: true, w: 5, p: 'DMG p.165', tip: 'Shield -1, missile attractor: no better than carrying no shield, and it draws missiles (DMG p.165).' });
        const sm = /^Shield(?:,\s*(?:large|small))?,?\s*([+\-−]\s*\d)(?:,\s*([+\-−]\s*\d)\s*(?:vs\.?|versus)\s*missiles)?/i.exec(n);
        if (sm) {
            const plus = sgnInt(sm[1]), mis = sm[2] ? sgnInt(sm[2]) : 0;
            if (plus >= 1 && plus <= 5) return itemInfo('shield', { name: n, plus, mis, v: 1 + plus, w: /large/i.test(n) ? 10 : 5, p: WEAR_PAGE.armour,
                tip: 'Magic shield: one better for the shield and one more for each plus (DMG p.164: a shield +1 is armour class 8 alone)' + (mis ? '; +' + mis + ' against missiles (DMG p.165)' : '') + '. A cloak of protection does not work with any shield (DMG p.141).' });
        }
        return null;
    }
    if (plain && plain.ac !== undefined && plain.ac !== null) {
        const o = itemInfo('armor', { name: n, base: n, baseAc: plain.ac, plus: 0, ac: plain.ac, magic: false, def: true, leather: n === 'Leather', w: plain.w, p: 'PHB p.36', tip: 'Armour class of the suit alone (PHB p.36). Only the best suit worn counts.' });
        return plain.shield ? Object.assign(o, { kind: 'shield', v: 1, tip: 'A shield is one better for armour class (PHB p.36).' }) : o;
    }
    if (acStored !== undefined && acStored !== null && !plain && !/^(Ring of|Bracers|Cloak|Boots|Staff|Helm|Sword)\b/i.test(n)) {
        const o = itemInfo('armor', { name: n, base: n, baseAc: acStored, plus: 0, ac: acStored, magic: false, def: true, leather: false, p: 'PHB p.36', tip: 'Armour class entered for this item (PHB p.36). Only the best suit worn counts.' });
        return /^Shield/i.test(n) ? Object.assign(o, { kind: 'shield', v: 1 }) : o;
    }
    let r;
    if ((r = /^Ring of Protection\b\s*([+\-−]\s*\d)?(.*)$/i.exec(n))) {
        const a = r[1] ? sgnInt(r[1]) : 1; let sv = a === 4 ? 2 : a === 6 ? 1 : a;
        const e = /([+\-−]\s*\d)\s*(?:on\s*)?(?:saves|saving throws)/i.exec(r[2] || ''); if (e) sv = sgnInt(e[1]);
        if (a < 1 || a > 6) return null;
        return itemInfo('ring', { name: n, a, s: sv, radius: /radius/i.test(n), p: WEAR_PAGE.ring, tip: 'Ring of protection: +' + a + ' armour class and +' + sv + ' on saving throws (DMG p.130). It adds no armour class while magic armour is worn, only the strongest ring works, and no more than 2 magic rings may be worn (DMG p.129-130).' });
    }
    if (/^Ring of /i.test(n)) return itemInfo('ring', { name: n, a: 0, s: 0, p: WEAR_PAGE.rings2, tip: 'Counts toward the limit of 2 magic rings worn at once; with more, none function (DMG p.129).' });
    if ((r = /^Bracers of Defen[cs]e,?\s*(?:AC\s*)?(\d)/i.exec(n)) && Number(r[1]) >= 1) return itemInfo('bracers', { name: n, ac: Number(r[1]), p: WEAR_PAGE.bracers, tip: 'Bracers of defense: armour class ' + r[1] + ' as if armour and a shield were worn. Not effective if armour is worn; works with other magical protection (DMG p.139).' });
    if ((r = /^Cloak of Protection\s*([+\-−]\s*\d)/i.exec(n)) && sgnInt(r[1]) >= 1 && sgnInt(r[1]) <= 5) return itemInfo('cloakP', { name: n, a: sgnInt(r[1]), s: sgnInt(r[1]), p: WEAR_PAGE.cloakP, tip: 'Cloak of protection: each plus is one better on armour class and +1 on saving throws. Works with leather armour only: not with magic armour, other armour or any shield (DMG p.141).' });
    if (/^Cloak of Displacement/i.test(n)) return itemInfo('cloakD', { name: n, a: 2, s: 2, p: WEAR_PAGE.cloakD, tip: 'Cloak of displacement: the first attack automatically misses, then +2 protection (2 better on armour class) and +2 on saves against attacks aimed at the wearer (DMG p.140-141).' });
    if (/^Boots of Striding and (Springing|Leaping)/i.test(n)) return itemInfo('bootsS', { name: n, a: 1, p: WEAR_PAGE.bootsS, tip: 'Boots of striding and springing: +1 armour class from the quickness of movement (DMG p.139).' });
    if (/^Boots of Speed/i.test(n)) return itemInfo('bootsF', { name: n, a: 2, p: WEAR_PAGE.bootsF, tip: 'Boots of speed: +2 armour class only in combat where movement of that sort is possible (DMG p.139). Tick Worn when it applies.' });
    if (/^Ioun Stone\b.*dusty rose/i.test(n)) return itemInfo('ioun', { name: n, a: 1, p: WEAR_PAGE.ioun, tip: 'Dusty rose prism ioun stone: +1 protection, that is 1 better on armour class (DMG p.147; protection defined at p.140).' });
    if (/^Staff of Power/i.test(n)) return itemInfo('staff', { name: n, a: 2, s: 2, p: WEAR_PAGE.staff, tip: 'Staff of power: the wielder gains +2 on armour class and saving throws (DMG p.134). Tick Worn while it is wielded.' });
    if (/^Helm of Brilliance/i.test(n)) return itemInfo('helm', { name: n, a: 2, p: WEAR_PAGE.helm, tip: 'Helm of brilliance: "armor of +2 value" (DMG p.145), read as +2 on armour class.' });
    if ((r = /^Sword \+([45]),?\s*Defender/i.exec(n))) return itemInfo('defender', { name: n, max: Number(r[1]), p: 'DMG p.165', tip: 'Defender: each round the wielder may put some, all or none of the +' + r[1] + ' into armour class (DMG p.165). Choose how much is held back for armour class.' });
    return null;
}
function cleanFlag(flag, core) {
    const info = protectiveInfo(core[0], core.length > 3 ? core[3] : undefined); if (!info) return '';
    if (flag === 'x') return info.def ? 'x' : '';
    if (info.kind === 'defender') { const h = Math.min(info.max, Number(flag.slice(1)) || 0); return h ? 'w' + h : 'w'; }
    return info.def ? '' : 'w';
}
// what an inventory row is for armour class: {info, worn, held}, or null for a plain item or one left at a place
function wearState(e) {
    const p = entryParts(e), info = p.loc ? null : protectiveInfo(p.core[0], p.core.length > 3 ? p.core[3] : undefined);
    if (!info) return null;
    return { info, worn: p.flag ? p.flag !== 'x' : info.def, held: /^w\d$/.test(p.flag) ? Number(p.flag.slice(1)) : 0 };
}
function wearables(sheet) { const out = []; sheet.inv.forEach((e, i) => { const w = wearState(e); if (w) out.push(Object.assign({ i }, w)); }); return out; }
// Mark row i worn or not (held = Defender bonus held back for armour class). Only exceptions to the item's default are stored.
function setWorn(sheet, i, on, held) {
    const e = sheet.inv[i], w = e && wearState(e); if (!w) return sheet;
    const p = entryParts(e); let f = on ? (w.info.kind === 'defender' && held > 0 ? 'w' + Math.min(held, w.info.max) : 'w') : 'x';
    if ((f === 'w' && w.info.def) || (f === 'x' && !w.info.def)) f = '';
    e.length = p.core.length; if (f) e.push(f);
    return sheet;
}
// Armour class from the items worn. items: [{info, worn, held}]; ctx: {dex: defensive adjustment (negative is better, PHB p.11), monk: the monk table AC or null}.
// Returns {total, rows: [{label, d, p}], skipped: [{label, why, p}], save, saveRows, armourSave, vsMissiles, warns}.
function acBuild(items, ctx) {
    const rows = [], skipped = [], saveRows = [], warns = [];
    const W = items.filter(x => x.worn && x.info), of = k => W.filter(x => x.info.kind === k);
    const add = (label, d, p) => rows.push({ label, d, p }), skip = (label, why, p) => skipped.push({ label, why, p });
    const best = (list, f) => list.reduce((b, x) => !b || f(x) < f(b) ? x : b, null);
    const monk = ctx.monk !== null && ctx.monk !== undefined;
    let suit = null, shield = null, bracers = null, vsMissiles = null;
    if (!monk) {
        suit = of('armor').reduce((b, x) => !b || x.info.ac < b.info.ac || (x.info.ac === b.info.ac && b.info.magic && !x.info.magic) ? x : b, null);
        of('armor').forEach(x => { if (x !== suit) skip(x.info.name, 'only the best suit of armour counts', 'DMG p.164'); });
        shield = best(of('shield'), x => -x.info.v);
        of('shield').forEach(x => { if (x !== shield) skip(x.info.name, 'only one shield counts', 'DMG p.164'); });
        bracers = best(of('bracers'), x => x.info.ac);
        of('bracers').forEach(x => { if (x !== bracers) skip(x.info.name, 'only the best bracers count', 'DMG p.139'); });
        add('No armour', 0, 'PHB p.36');
    } else {
        add('Monk armour class (no armour, no Dexterity adjustment)', ctx.monk - 10, 'PHB p.30-31');
        of('armor').concat(of('shield'), of('bracers')).forEach(x => skip(x.info.name, 'a monk uses the table armour class', 'PHB p.30-31'));
    }
    let bracersBase = false;
    if (suit) {
        add(suit.info.base + ' (armour class ' + suit.info.baseAc + ')', suit.info.baseAc - 10, 'PHB p.36');
        if (suit.info.plus) add(suit.info.name + ': ' + (suit.info.plus > 0 ? '+' : '') + suit.info.plus + ' magic', -suit.info.plus, 'DMG p.164');
        if (bracers) skip(bracers.info.name, 'not effective while armour is worn', 'DMG p.139');
    } else if (bracers) { bracersBase = true; add(bracers.info.name + ' (as armour and a shield)', bracers.info.ac - 10, 'DMG p.139'); }
    if (shield) {
        const si = shield.info;
        if (si.attractor) add(si.name + ': no better than no shield', 0, 'DMG p.165');
        else {
            if (!bracersBase) add('Shield', -1, 'PHB p.36'); else skip('Shield (the plain 1 better)', 'already counted in the bracers of defense', 'DMG p.139');
            if (si.plus) add(si.name + ': +' + si.plus + ' magic', -si.plus, 'DMG p.164');
            if (si.mis) vsMissiles = si.mis - si.plus;
        }
    }
    if (!monk) add('Dexterity defensive adjustment', ctx.dex || 0, 'PHB p.11');
    const magicSuit = !!(suit && suit.info.magic);
    const rings = of('ring');
    if (rings.length > 2) { warns.push('More than 2 magic rings worn: none of them function (DMG p.129).'); rings.forEach(x => skip(x.info.name, 'more than 2 magic rings worn, none function', 'DMG p.129')); }
    else {
        const prot = rings.filter(x => x.info.a > 0 || x.info.s > 0), top = prot.reduce((b, x) => !b || x.info.a > b.info.a || (x.info.a === b.info.a && x.info.s > b.info.s) ? x : b, null);
        prot.forEach(x => { if (x !== top) skip(x.info.name, 'only the strongest ring of protection works', 'DMG p.130'); });
        if (top) {
            if (magicSuit) skip(top.info.name + ' (armour class)', 'a ring of protection adds no armour class while magic armour is worn; it still adds to saving throws', 'DMG p.130');
            else add(top.info.name, -top.info.a, 'DMG p.130');
            if (top.info.s) saveRows.push({ label: top.info.name, n: top.info.s, p: 'DMG p.130' });
        }
    }
    const cl = best(of('cloakP'), x => -x.info.a);
    of('cloakP').forEach(x => { if (x !== cl) skip(x.info.name, 'only the best cloak of protection counts', 'DMG p.141'); });
    if (cl) {
        const why = magicSuit ? 'magic armour is worn' : suit && !suit.info.leather ? 'armour other than leather is worn' : shield ? 'a shield is worn' : '';
        if (why) skip(cl.info.name, 'does not function (armour class or saving throws): ' + why, 'DMG p.141');
        else { add(cl.info.name, -cl.info.a, 'DMG p.141'); saveRows.push({ label: cl.info.name, n: cl.info.s, p: 'DMG p.141' }); }
    }
    ['cloakD', 'bootsS', 'bootsF', 'ioun', 'staff', 'helm'].forEach(k => {
        const l = of(k), b = best(l, x => -x.info.a); l.forEach(x => { if (x !== b) skip(x.info.name, 'the same kind of item worn twice: counted once', x.info.p); });
        if (!b) return;
        add(b.info.name, -b.info.a, b.info.p);
        if (b.info.s) saveRows.push({ label: b.info.name, n: b.info.s, p: b.info.p });
    });
    const df = best(of('defender'), x => -x.held);
    if (df && df.held > 0) add(df.info.name + ': ' + df.held + ' held back for armour class', -df.held, 'DMG p.165');
    const total = rows.reduce((t, r) => t + r.d, 10);
    const armourSave = []; if (suit && suit.info.plus > 0) armourSave.push({ label: suit.info.name, n: suit.info.plus }); if (shield && shield.info.plus > 0) armourSave.push({ label: shield.info.name, n: shield.info.plus });
    return { total, rows, skipped, save: saveRows.reduce((t, r) => t + r.n, 0), saveRows, armourSave, vsMissiles: vsMissiles === null ? null : total - vsMissiles, warns };
}
// Set the worn marks that give the best armour class (then the best saving throw bonus, then the fewest items worn). Up to 14 wearable items are tried in every combination.
function bestWear(sheet) {
    let ctx; try { const d = Rules.derive(toChar(sheet)); ctx = { dex: d.abilities.dex.defense, monk: d.monk ? d.monk[1] : null }; } catch (e) { return sheet; }
    const list = wearables(sheet).slice(0, 14); if (!list.length) return sheet;
    let top = null;
    for (let mask = 0; mask < (1 << list.length); mask++) {
        const b = acBuild(list.map((w, k) => ({ info: w.info, worn: !!(mask & (1 << k)), held: 0 })), ctx);
        let cnt = 0; for (let k = 0; k < list.length; k++) if (mask & (1 << k)) cnt++;
        if (!top || b.total < top.t || (b.total === top.t && (b.save > top.s || (b.save === top.s && cnt < top.c)))) top = { t: b.total, s: b.save, c: cnt, mask };
    }
    list.forEach((w, k) => setWorn(sheet, w.i, !!(top.mask & (1 << k)), 0));
    return sheet;
}
const SAVE_NAMES = ['death', 'petrification', 'wand', 'breath', 'spell'];
// saving throw targets with the worn-item bonus (a bonus on the die is a lower number to roll, never below 1)
function saveTargets(saves, bonus) { const o = {}; SAVE_NAMES.forEach(k => { o[k] = { base: saves[k], eff: Math.max(1, saves[k] - bonus) }; }); return o; }

/* ---------- rules char and inventory ---------- */
const EQ = () => Rules.EQUIPMENT.weapons.concat(Rules.EQUIPMENT.armor, Rules.EQUIPMENT.gear, Rules.EQUIPMENT.beasts);
let EQ_INDEX = null;
function eqIndex() { if (!EQ_INDEX) { EQ_INDEX = {}; EQ().forEach(i => { if (!EQ_INDEX[i.n]) EQ_INDEX[i.n] = i; }); } return EQ_INDEX; }
function coinPieces(sheet) { return sheet.co.reduce((a, b) => a + b, 0); }
function coinGp(sheet) { return COIN_NAMES.reduce((t, c, i) => t + sheet.co[i] * COIN_GP[c], 0); }
function purseGp(coins) { return COIN_NAMES.reduce((t, c, i) => t + (coins[i] || 0) * COIN_GP[c], 0); }
// coins of a place: 0 = Carried (sheet.co), n = sheet.lp[n-1] coins
function coinsAt(sheet, loc) { return loc === 0 ? sheet.co : sheet.lp[loc - 1].slice(1); }
function setCoinsAt(sheet, loc, coins) { if (loc === 0) sheet.co = coins.slice(); else sheet.lp[loc - 1] = [sheet.lp[loc - 1][0]].concat(coins); }
function locOf(e) { return entryParts(e).loc; }
// one inventory entry as the rules_1e item shape (weight in lb, armour class)
function hydrateRow(e) {
    const p = entryParts(e), c = p.core, base = eqIndex()[c[0]];
    let r;
    if (base && c.length <= 2) r = Object.assign({}, base, { qty: c[1] });
    else r = { n: c[0], qty: c[1], w: c.length > 2 ? c[2] : (base ? base.w : 0), ac: c.length > 3 ? c[3] : (base && base.ac !== undefined ? base.ac : undefined), shield: base && base.shield, move: base && base.move };
    const info = protectiveInfo(c[0], c.length > 3 ? c[3] : undefined);
    if (info && info.magic && (info.kind === 'armor' || info.kind === 'shield')) { // recognised magic armour or shield: AC from its name (the suit's AC less the plus); weight as stored, else the base item's
        r.ac = info.kind === 'armor' ? info.ac : -1 - info.plus; r.shield = info.kind === 'shield'; r.w = c.length > 2 ? c[2] : info.w; r.move = undefined;
    }
    return r;
}
// Only what is Carried counts for load, movement and armour class; items and coins left at a place do not. Armour and shields not marked worn weigh something but give no AC and cap no movement.
function hydrate(sheet) {
    const inv = [];
    sheet.inv.forEach(e => {
        if (locOf(e)) return;
        let r = hydrateRow(e); const w = wearState(e);
        if (w && (w.info.kind === 'armor' || w.info.kind === 'shield') && !w.worn) r = Object.assign({}, r, { ac: undefined, shield: false, move: undefined });
        inv.push(r);
    });
    const pieces = coinPieces(sheet);
    if (pieces) inv.push({ n: 'Coins', qty: 1, w: pieces / 10 }); // one gp of weight per coin (rules_1e.js encumbrance convention, PHB p.101)
    return inv;
}
// Move qty (default all) of inventory row i to place loc (0 = Carried). Same-name plain items at the target merge. Returns the sheet.
function moveItem(sheet, i, loc, qty) {
    const e = sheet.inv[i]; if (!e || loc < 0 || loc > sheet.lp.length) return sheet;
    const p = entryParts(e); if (p.loc === loc) return sheet;
    const n = Math.min(p.core[1], Math.max(1, Math.floor(Number(qty)) || p.core[1]));
    const row = p.core.slice(); row[1] = n;
    if (n >= p.core[1]) sheet.inv.splice(i, 1); else e[1] = p.core[1] - n;
    const twin = row.length === 2 ? sheet.inv.filter(r => { const q = entryParts(r); return q.core.length === 2 && q.core[0] === row[0] && q.loc === loc; })[0] : null;
    if (twin) twin[1] += n; else sheet.inv.push(loc ? row.concat(String(loc)) : row);
    return sheet;
}
// Remove place n: everything there moves to Carried, later places renumber.
function removePlace(sheet, n) {
    if (n < 1 || n > sheet.lp.length) return sheet;
    const coins = sheet.lp[n - 1].slice(1);
    for (let i = sheet.inv.length - 1; i >= 0; i--) if (locOf(sheet.inv[i]) === n) moveItem(sheet, i, 0);
    sheet.co = sheet.co.map((v, k) => v + coins[k]);
    sheet.inv.forEach(e => { const l = locOf(e); if (l > n) e[e.length - 1] = String(l - 1); });
    sheet.lp.splice(n - 1, 1);
    return sheet;
}
function placeCounts(sheet, n) { return { items: sheet.inv.filter(e => locOf(e) === n).length, coins: coinPieces({ co: coinsAt(sheet, n) }) }; }
// Pay gp out of the coins at a place. Spends gold first, then silver, copper, electrum, platinum; change comes back as gp, sp, cp. Returns {ok, coins, short}.
function payFrom(coins, gp) {
    const V = { pp: 1000, gp: 200, ep: 100, sp: 10, cp: 1 }, have = coins.slice(), idx = n => COIN_NAMES.indexOf(n);
    let due = Math.round(gp * 200); const total = COIN_NAMES.reduce((t, c, i) => t + have[i] * V[c], 0);
    if (due > total) return { ok: false, coins: coins.slice(), short: (due - total) / 200 };
    ['gp', 'sp', 'cp', 'ep', 'pp'].forEach(c => { const k = Math.min(have[idx(c)], Math.floor(due / V[c])); have[idx(c)] -= k; due -= k * V[c]; });
    if (due > 0) { // break the smallest coin that covers what is left, and give change
        const c = ['cp', 'sp', 'ep', 'gp', 'pp'].filter(n => have[idx(n)] > 0 && V[n] >= due)[0];
        have[idx(c)]--; let change = V[c] - due;
        const g = Math.floor(change / 200); change -= g * 200; const sp = Math.floor(change / 10); change -= sp * 10;
        have[idx('gp')] += g; have[idx('sp')] += sp; have[idx('cp')] += change;
    }
    return { ok: true, coins: have, short: 0 };
}

/* ---------- Simple view: spells cast today, ammunition (DOM-free so node can test them) ---------- */
// Carried ammunition lines: price-list ammunition plus darts and javelins (thrown). total = pieces carried (qty times the pack size in the name, e.g. "(12)"), left = total minus spent.
function ammoLines(sheet) {
    const seen = {}, out = [];
    (sheet.inv || []).forEach(e => {
        const p = entryParts(e); if (p.loc) return;
        const base = eqIndex()[p.core[0]]; if (!base || !(base.ammo || base.kind === 'dart' || base.kind === 'javelin')) return;
        const m = /\((\d+)\)\s*$/.exec(base.n), per = m ? Number(m[1]) : 1, n = p.core[1] * per;
        if (seen[base.n]) { seen[base.n].total += n; } else { seen[base.n] = { name: base.n, total: n, spent: 0, left: n }; out.push(seen[base.n]); }
    });
    out.forEach(a => { a.spent = Math.min(a.total, Math.max(0, Math.floor(Number(sheet.am && sheet.am[a.name]) || 0))); a.left = a.total - a.spent; });
    return out;
}
// +1 = pick one up (spent goes down), -1 = fire one. Never below 0 or above what is carried.
function adjustAmmo(sheet, name, delta) {
    const a = ammoLines(sheet).filter(x => x.name === name)[0]; if (!a) return sheet;
    const spent = Math.min(a.total, Math.max(0, a.spent - delta)); sheet.am = sheet.am || {};
    if (spent) sheet.am[name] = spent; else delete sheet.am[name];
    return sheet;
}
function isCast(sheet, c, l, i) { const v = sheet.cs && sheet.cs[c] && sheet.cs[c][l] || 0; return Math.floor(v / Math.pow(2, i)) % 2 === 1; }
function toggleCast(sheet, c, l, i) {
    const list = sheet.sm[c] && sheet.sm[c][l]; if (!list || i < 0 || i >= Math.min(list.length, CAST_BITS)) return sheet;
    sheet.cs = sheet.cs || {}; const a = (sheet.cs[c] = sheet.cs[c] || []); while (a.length <= l) a.push(0);
    a[l] += isCast(sheet, c, l, i) ? -Math.pow(2, i) : Math.pow(2, i);
    while (a.length && !a[a.length - 1]) a.pop(); if (!a.length) delete sheet.cs[c];
    return sheet;
}
function restSpells(sheet) { sheet.cs = {}; return sheet; }
// Rebuild the memorised list of class c, level l keeping entries where keep(name, index) is true; the cast ticks follow the entries that stay.
function filterMem(sheet, c, l, keep) {
    const list = (sheet.sm[c] && sheet.sm[c][l]) || [], kept = [], bits = [];
    list.forEach((n, i) => { if (keep(n, i)) { kept.push(n); bits.push(isCast(sheet, c, l, i)); } });
    sheet.sm[c][l] = kept;
    if (sheet.cs && sheet.cs[c]) { sheet.cs[c][l] = bits.reduce((t, b, i) => t + (b && i < CAST_BITS ? Math.pow(2, i) : 0), 0); }
    return sheet;
}
// Which view a person opens first: players Simple, the GM Full. Their own choice (saved in their browser) wins.
function defaultSheetView(role) { return role === 'GM' ? 'full' : 'simple'; }
const VIEW_KEY = 'tk-sheet-view';
function toChar(sheet) {
    const c = { race: sheet.race, subrace: sheet.sub || undefined, sex: sheet.sex, classes: sheet.cl.slice(), levels: {}, alignment: sheet.al,
        scores: { str: sheet.sc[0], int: sheet.sc[1], wis: sheet.sc[2], dex: sheet.sc[3], con: sheet.sc[4], cha: sheet.sc[5] },
        strExc: sheet.ex || 0, inventory: hydrate(sheet), coinsCP: 0, languages: sheet.lg.slice(), proficiencies: sheet.pf.slice() };
    sheet.cl.forEach((k, i) => { c.levels[k] = sheet.lv[i]; });
    return c;
}

/* ---------- weapons: rules_1e names to the combat tables ---------- */
const norm = n => String(n).toLowerCase().replace(/[’]/g, "'").replace(/ (and|&) scabbard/g, '').replace(/ & bullets.*$/, ' (bullet)').replace(/ or throwing/, '')
    .replace(/ bullets \(20\)$/, ' (bullet)').replace(/,/g, '').replace(/\s+/g, ' ').trim();
const ALIAS = { 'sling stone': 'sling (stone)', 'staff quarter': 'staff quarter' };
function combatRows(name) {
    const W = root.WEAPONS || [], k = ALIAS[norm(name)] || norm(name);
    return W.filter(w => norm(w.name) === k || norm(w.name) === norm(name));
}
// Weapons a character may choose to be proficient in: permitted by class (PHB p.19) and present in the combat tables.
function proficiencyChoices(sheet) {
    const cl = sheet.cl;
    return Rules.EQUIPMENT.weapons.filter(w => !w.ammo && w.kind !== 'ammo' && Rules.canUseWeapon(cl, w).ok && combatRows(w.n).length).map(w => w.n);
}
function weaponLine(row, abilities) {
    const typeRange = [10, 9, 8, 7, 6, 5, 4, 3, 2];
    const hitMod = row.kind === 'missile' ? abilities.dex.reaction : abilities.str.hit; // PHB p.9 hit adj; PHB p.11 missile adj
    return { name: row.name, kind: row.kind, adj: typeRange.map(t => row.adj[t - 2]), types: typeRange, sm: row.smTxt, lg: row.lgTxt, spd: row.spdTxt || row.spd,
        len: row.len, space: row.space, rate: row.rate, range: row.range, hitMod: hitMod, dmgMod: row.kind === 'melee' ? abilities.str.dmg : 0 };
}

/* ---------- movement by encumbrance (PHB p.101, as rules_1e.encumbrance) ---------- */
function movementTable(char, d) {
    const m = d.movement, monk = d.monk, base = monk ? monk[2] : 12, lim = [350, 700, 1050, 1500];
    const cap = m.armorMove === null ? Infinity : m.armorMove;
    const bands = ['Normal', 'Heavy', 'Loaded', 'Maximum'].map((nm, i) => ({ name: nm, upTo: lim[i] + m.allowance, move: Math.max(0, Math.min(cap, base - 3 * i)) }));
    return { gp: m.gp, lb: m.lb, allowance: m.allowance, band: m.band, move: m.move, armorMove: m.armorMove, bands };
}

/* ---------- race notes: vision and resistances (PHB p.14-18) ---------- */
const RACE_TRAITS = {
    'Dwarf': ['Detect grade or slope 75%, new construction 75%, sliding or shifting walls 66 2/3%, stonework traps 50%, approximate depth 50% (actively seeking, PHB p.16)'],
    'Elf': ['90% resistant to sleep and charm (PHB p.16)', 'Secret door 1 in 6 on passing, 2 in 6 searching; concealed door 3 in 6 (PHB p.16)', '+1 to hit with any bow except a crossbow, and with a short or long sword (PHB p.16)'],
    'Gnome': ['Detect grade or slope 80%, unsafe walls 70%, approximate depth 60%, direction of travel 50% (actively seeking, PHB p.16-17)'],
    'Half-Elf': ['30% resistant to sleep and charm (PHB p.17)', 'Secret door 1 in 6 on passing, 2 in 6 searching; concealed door 3 in 6 (PHB p.17)'],
    'Halfling': ['Detect grade or slope in a passage 75%, direction of travel 50% (PHB p.17)'],
    'Half-Orc': [], 'Human': []
};

/* ---------- retainers: henchmen and hirelings (DMG p.25, 29-37; PHB p.13) ---------- */
const MERC = () => (root.QPRules && root.QPRules.MERC) || {};
// henchman field indexes
const H = { nm: 0, race: 1, cls: 2, lv: 3, hp: 4, ac: 5, sh: 6, pay: 7, tok: 8, nt: 9, m: 10 };
function blankHench() { return ['', '', '', 1, 0, 10, '', 0, '', '', []]; }
function bandOf(total) { return LOY_BANDS.filter(b => total >= b[0] && total <= b[1])[0]; }
// sit = counts for this check only: array parallel to LOY_SITUATION (tick 0/1 for per=0 lines, a count for per=1 lines)
function loyalty(sheet, h, chaLoyalty, sit) {
    const parts = [{ l: 'Normal loyalty base (DMG p.36)', v: LOY_BASE }, { l: 'Charisma loyalty base (PHB p.13)', v: chaLoyalty }], m = h[H.m] || [];
    LOY_CATS.forEach((c, i) => { if (m[i]) parts.push({ l: c.l + ': ' + c.o[m[i] - 1][0] + ' (' + c.p + ')', v: c.o[m[i] - 1][1] }); });
    if (LOY_ALIGN[sheet.al]) parts.push({ l: 'Alignment of liege (DMG p.37)', v: LOY_ALIGN[sheet.al] });
    const pen = LOY_PENALTY[(m[LOY_CATS.length] || 0) - 1], bon = LOY_BONUS[(m[LOY_CATS.length + 1] || 0) - 1];
    if (pen) parts.push({ l: 'Special consideration, penalty (DMG p.37): ' + pen[0], v: pen[1] });
    if (bon) parts.push({ l: 'Special consideration, bonus (DMG p.37): ' + bon[0], v: bon[1] });
    let sv = 0; LOY_SITUATION.forEach((x, i) => { const n = Math.max(0, Math.floor(Number(sit && sit[i]) || 0)); if (n) { const t = (x[1] ? n : 1) * x[2]; sv += t; } });
    if (sv) parts.push({ l: 'Situation this check (DMG p.37)', v: sv });
    const total = parts.reduce((t, x) => t + x.v, 0);
    return { parts, total, band: bandOf(total) };
}
// DMG p.36: "if the total is less than the number shown on the dice, the figure or figures in question are disloyal, disobedient, or have poor morale". d100, 00 = 100.
function loyaltyCheck(total, roll) { return { roll, total, held: !(total < roll) }; }
function soldierCost(r) {
    const m = MERC()[SOLDIERS[r[1]]]; if (!m) return 0;
    const sj = Math.min(r[3], r[2]);
    return (r[2] - sj) * m.pay + sj * m.pay * SERJEANT_MULT;
}
function expertCost(r) {
    const x = EXPERTS[r[1]];
    if (x.c !== undefined) return r[2] * x.c;
    if (x.lv !== undefined) return r[2] * x.lv * Math.max(1, r[3]);
    return r[2] * (r[3] || x.r[0]);
}
function hireLine(r) {
    if (r[0] === 0) return { name: SOLDIERS[r[1]], cost: soldierCost(r), monthly: true, page: SOLDIER_PAY_PAGE };
    const x = EXPERTS[r[1]];
    return { name: x.n, cost: expertCost(r), monthly: !x.once, page: x.p, star: !!x.star, range: x.r || null, perLevel: x.lv || 0, unset: !!x.r && !r[3] };
}
// TB ruling (2026-11-12), built on DMG p.30-31 (a serjeant is a 1st-level fighter and commands up to 10 soldiers): a PC of the fighter group
// (fighter, paladin, ranger, or any multi-class including one) commands up to 10 regular soldiers directly; any other PC up to 5.
const MERC_CAP_BY_CLASS = { Fighter: 10, Paladin: 10, Ranger: 10 }, MERC_CAP_OTHER = 5, MERC_CAP_NOTE = 'TB ruling from DMG p.30-31';
const directCap = sheet => Math.max.apply(null, sheet.cl.map(c => MERC_CAP_BY_CLASS[c] || MERC_CAP_OTHER).concat([MERC_CAP_OTHER]));
// Assassin hirelings (PHB p.30): none before 4th level; 4th lower-level assassins; 8th thieves too; 12th any class; only neutral or evil characters serve.
function assassinRule(sheet) {
    const i = sheet.cl.indexOf('Assassin'); if (i < 0) return null;
    const lv = sheet.lv[i], used = sheet.hr.length > 0;
    const who = lv < 4 ? 'none yet' : lv < 8 ? 'lower level assassins only' : lv < 12 ? 'lower level assassins and thieves' : 'any class';
    return { lv, block: lv < 4, used: lv < 4 && used, who }; // "only neutral or evil characters will serve" is about the retainers (any neutral or evil alignment); shown as a notice, retainer alignment is not tracked
}
// Command chain, DMG p.30-31: serjeant commands up to 10 soldiers; the PC commands up to directCap directly (ruling above), serjeants cover the rest (10 each); lieutenant (fighter 2nd or 3rd) commands as many
// decades as levels, exclusive of serjeants; captain (fighter 5th to 8th) commands as many scores as levels (4th = 80 men) and, with the lieutenants, extends control.
const lineN = (sheet, id, fn) => sheet.hr.reduce((t, r) => t + (r[0] === 1 && EXPERTS[r[1]].n.indexOf(id) === 0 ? fn(r) : 0), 0);
function command(sheet) {
    let soldiers = 0, serj = 0;
    sheet.hr.forEach(r => { if (r[0] === 0) { soldiers += r[2]; serj += Math.min(r[3], r[2]); } });
    const regular = soldiers - serj, direct = directCap(sheet);
    const lt = lineN(sheet, 'lieutenant', r => r[2] * Math.max(1, r[3])), cpt = lineN(sheet, 'captain', r => r[2] * Math.max(1, r[3]));
    const minSerj = Math.ceil(Math.max(0, regular - direct) / 10), cap = lt * 10 + cpt * 20, w = [];
    if (regular > direct && serj < minSerj) w.push(regular + ' regular soldiers is over the ' + direct + ' this character commands directly (' + MERC_CAP_NOTE + '): the rest need serjeants, ' + minSerj + ' at 10 each, and there are ' + serj + (serj < minSerj ? '. Short by ' + (minSerj - serj) + '.' : '.'));
    if (regular > direct && cap < regular) w.push(regular + ' regular soldiers but lieutenants and captains here command only ' + cap + ' (lieutenant: as many decades as levels, captain: as many scores as levels, DMG p.30-31).');
    if (regular > 20 && !cpt) w.push('More than 20 soldiers: the DMG table gives a captain with them (DMG p.30).');
    return { soldiers, serj, regular, direct, minSerj, lt, cpt, cap, warn: w, note: MERC_CAP_NOTE };
}
function retainers(sheet, d) {
    const cha = d.abilities.cha, max = cha.henchmen, own = cha.ownRaceHenchmen, pcLv = Math.max.apply(null, sheet.lv);
    const hn = sheet.hn.map((h, i) => {
        const L = loyalty(sheet, h, cha.loyalty);
        return { i, loy: L, level: h[H.lv] >= pcLv, pay: h[H.pay] };
    });
    const hires = sheet.hr.map(hireLine);
    const hnPay = sheet.hn.reduce((t, h) => t + h[H.pay], 0), hirePay = hires.reduce((t, x) => t + (x.monthly ? x.cost : 0), 0);
    const rangerBelow8 = sheet.cl.some((c, i) => c === 'Ranger' && sheet.lv[i] < 8), cmd = command(sheet), asn = assassinRule(sheet);
    return { asn, rangerBlock: rangerBelow8, rangerUsed: rangerBelow8 && (sheet.hn.length + sheet.hr.length > 0), cmd, max, own: own && own > max ? own : 0, count: sheet.hn.length, over: sheet.hn.length > max, overOwn: own && own > max ? sheet.hn.length > own : sheet.hn.length > max, chaLoyalty: cha.loyalty, hn, hires, hnPay, hirePay, monthly: hnPay + hirePay };
}

/* ---------- the view model: everything the page shows, derived ---------- */
function compute(sheet) {
    const s = sanitize(sheet), char = toChar(s), out = { sheet: s, char: char, errors: [], warns: [] };
    const ok = Rules.classOk(s.cl, s.race, char.scores);
    if (!ok.ok) out.warns = out.warns.concat(ok.reasons);
    try { out.d = Rules.derive(char); } catch (e) { out.errors.push('Could not derive this character: ' + e.message); return out; }
    const d = out.d, A = d.abilities;
    // armour class from what is worn (DMG p.124-169), replacing derive()'s figure so every page shows the same one; saving throw bonuses from worn protective items
    out.ac = acBuild(wearables(s), { dex: A.dex.defense, monk: d.monk ? d.monk[1] : null });
    d.ac = out.ac.total;
    out.saves = saveTargets(d.saves, out.ac.save);
    out.movement = movementTable(char, d);
    out.hitDice = s.cl.map((c, i) => {
        const h = d.hitDice[c], adj = d.hpAdjPerDie * h.dice;
        return { cls: c, level: s.lv[i], dice: h.dice, die: h.die, flat: h.flat, conAdj: adj, text: h.dice + 'd' + h.die + (h.flat ? '+' + h.flat : '') + (adj ? (adj > 0 ? ' +' : ' ') + adj + ' Con' : '') };
    });
    out.xpRows = s.cl.map((c, i) => {
        const lv = s.lv[i], share = s.xp / s.cl.length; // experience divided equally between classes (PHB p.14-17)
        return { cls: c, level: lv, next: Rules.xpForLevel(c, lv + 1), at: Rules.xpForLevel(c, lv), share: share, limit: d.levelLimits[c], bonus: d.xpBonus[c],
            byXp: Rules.levelForXP(c, share), title: (Rules.CLASSES[c].titles || [])[Math.min(lv, 8) - 1] || '' };
    });
    out.weapons = [];
    s.pf.forEach(n => combatRows(n).forEach(r => out.weapons.push(weaponLine(r, A))));
    out.toHitRows = { melee: {}, missile: {} };
    for (let ac = 10; ac >= -10; ac--) {
        out.toHitRows.melee[ac] = d.attack[ac] - A.str.hit;
        out.toHitRows.missile[ac] = d.attack[ac] - A.dex.reaction;
    }
    out.attacksPerRound = s.cl.map((c, i) => (root.attacksPerRound && root.CLASSES && root.CLASSES[c.toLowerCase()]) ? root.attacksPerRound(c.toLowerCase(), s.lv[i]) : '1').reduce((a, b) => (a === '2' || b === '2') ? '2' : (a === '3/2' || b === '3/2') ? '3/2' : '1', '1');
    out.traits = RACE_TRAITS[s.race] || [];
    out.spellClasses = Object.keys(d.spellsPerDay).filter(k => SPELL_KEY[k]);
    out.thief = d.thiefSkills;
    out.gearWeight = d.movement.lb;
    out.ret = retainers(s, d);
    out.size = bytes(JSON.stringify(s));
    return out;
}

/* ---------- new sheets from the Character Creator wizard and from Quick Party (TB 2026-11-12) ----------
 * Both converters return a sanitised sheet. Anything the sheet cannot hold goes into the notes (nt), never dropped.
 * Money: PHB p.35 (200 cp = 1 gp, 20 sp = 1 gp). Armour and weapon names: rules_1e EQUIPMENT. */
const QP_ALIGN = { 'Lawful Good': 'LG', 'Neutral Good': 'NG', 'Chaotic Good': 'CG', 'Lawful Neutral': 'LN', 'True Neutral': 'N', 'Chaotic Neutral': 'CN', 'Lawful Evil': 'LE', 'Neutral Evil': 'NE', 'Chaotic Evil': 'CE' };
// Quick Party equipment names to rules_1e price-list names
const QP_BASE = { 'Plate Mail': 'Plate', 'Banded Mail': 'Banded', 'Splint Mail': 'Splinted', 'Chain Mail': 'Chain', 'Scale Mail': 'Scale', 'Studded Leather': 'Studded', 'Ring Mail': 'Ring',
    'Leather Armor': 'Leather', 'Padded Armor': 'Padded', 'Shield': 'Shield, small', 'Long Sword': 'Sword, Long & scabbard', 'Dagger': 'Dagger and scabbard', 'Mace': "Mace, footman's",
    'Scimitar': 'Scimitar', 'Staff': 'Staff, Quarter', "Thieves' Picks & Tools": "Thieves' picks & tools", 'Spear': 'Spear', 'Battle Axe': 'Axe, battle', 'Long Bow': 'Bow, long', 'Javelin': 'Javelin' };
const QP_SPELL_CLASS = { 'MU': 'Magic-User', 'Ill': 'Illusionist', 'Druidic': 'Ranger (druidic)', 'Ranger MU': 'Ranger (magic-user)' };
const raceKey = r => Object.keys(Rules.RACES).filter(k => k.toLowerCase() === String(r).toLowerCase())[0] || 'Human';
function coinsFromCP(cp) {
    cp = Math.max(0, Math.floor(Number(cp) || 0));
    const gp = Math.floor(cp / 200), rem = cp - gp * 200, sp = Math.floor(rem / 10);
    return [0, gp, 0, sp, rem - sp * 10];
}
function feetInches(h) { h = Number(h) || 0; const f = Math.floor(h / 12), i = h - f * 12; return h ? f + "'" + (i % 1 ? i.toFixed(1) : i) + '"' : ''; }
// weapons the character carries, as price-list names, limited to the class's initial slots (PHB p.34), for the proficiency list
function carriedProfs(s, names) {
    const ok = proficiencyChoices(s), slots = Math.max.apply(null, s.cl.map(c => Rules.CLASSES[c].profs));
    return names.filter((n, i) => names.indexOf(n) === i && ok.indexOf(n) >= 0).slice(0, slots);
}
// Quick Party equipment strings to inventory rows. Plain kit becomes price-list rows; magic and odd items become named rows (armour keeps its weight and AC).
function qpInventory(equipment) {
    const inv = [], weapons = [], magic = [], idx = eqIndex();
    const add = (n, q) => { const e = inv.filter(r => r.length === 2 && r[0] === n)[0]; if (e) e[1] += q; else inv.push([n, q]); };
    equipment.forEach(item => {
        if (item === 'Long Bow & Arrows') { add('Bow, long', 1); add('Arrow, normal (12)', 2); weapons.push('Bow, long'); return; }
        if (QP_BASE[item] && idx[QP_BASE[item]]) { add(QP_BASE[item], 1); if (idx[QP_BASE[item]].kind) weapons.push(QP_BASE[item]); return; }
        magic.push(item);
        const m = /^(.+?) \+(\d)$/.exec(item), base = m && QP_BASE[m[1]] ? idx[QP_BASE[m[1]]] : null;
        if (protectiveInfo(item)) inv.push([item, 1, protectiveInfo(item).w || 0]);
        else if (base && base.ac !== undefined && base.ac !== null) inv.push([item, 1, base.w || 0, base.shield ? base.ac : base.ac - Number(m[2])]);
        else if (base) { inv.push([item, 1, base.w || 0]); if (base.kind) weapons.push(base.n); }
        else inv.push([item, 1, 0]);
    });
    return { inv, weapons, magic };
}
// Quick Party spell lines ("<b>MU L1 (4):</b> memorised<br><span>Book: known</span>") to sk (known) and sm (memorised), by sheet class name and level
function qpSpells(text, classes) {
    const sk = {}, sm = {}, left = [], re = /<b>([^<]*?) L(\d+) \((\d+)\):<\/b> ([^<]*)(?:<br><span[^>]*>Book: ([^<]*)<\/span>)?/g;
    let m, any = false;
    while ((m = re.exec(text || ''))) {
        any = true;
        const cls = m[1] === 'Prayers' ? ['Cleric', 'Druid', 'Paladin'].filter(c => classes.indexOf(c) >= 0)[0] : QP_SPELL_CLASS[m[1]];
        const lv = Number(m[2]) - 1, mem = m[4].split(', ').filter(Boolean), known = m[5] ? m[5].split(', ').filter(Boolean) : mem.filter((x, i) => mem.indexOf(x) === i);
        if (!cls || lv < 0 || lv > 9) { left.push(m[0].replace(/<[^>]*>/g, ' ')); continue; }
        [[sk, known], [sm, mem]].forEach(p => { if (!p[0][cls]) p[0][cls] = []; while (p[0][cls].length <= lv) p[0][cls].push([]); p[0][cls][lv] = p[1]; });
    }
    if (!any && text) left.push(String(text).replace(/<[^>]*>/g, ' '));
    return { sk, sm, left };
}
function fitNotes(lines) { const t = lines.filter(Boolean).join('\n'); return t.length <= LIM.text ? t : t.slice(0, LIM.text - 12).replace(/[;,]?[^;,\n]*$/, '') + ' [cut short]'; }

// A Quick Party record (QPRules.genPCParty(...).chars[i], or buildRecord) to a sheet. `how` = the line for the notes.
function fromQuickParty(pc, tokenName, how) {
    const s = blank(), cl = pc.classes.filter(c => Rules.CLASSES[c]);
    s.nm = str(tokenName, LIM.name); s.race = raceKey(pc.race); s.sex = /^f/i.test(pc.gender) ? 'f' : 'm';
    s.cl = cl.slice(0, 3); s.lv = cl.slice(0, 3).map((c, i) => pc.levels[i]);
    s.sc = ABIL.map(a => pc.stats[a]); s.ex = pc.stats.strX || 0;
    s.al = QP_ALIGN[pc.align] || 'N'; s.xp = pc.xp; s.hp = s.hm = pc.hp;
    const it = qpInventory(pc.equipment || []); s.inv = it.inv;
    const sp = qpSpells(pc.spells, cl); s.sk = sp.sk; s.sm = sp.sm;
    s.pf = carriedProfs(sanitize(s), it.weapons);
    s.nt = fitNotes([how || 'Made by the Random PC button (Quick Party generator, DMG Appendix P).', pc.titles ? 'Title: ' + pc.titles + '.' : '',
        'Generator armour class: ' + pc.ac + ' (this sheet works out its own from what is worn: see Combat, armour class).',
        it.magic.length ? 'Magic and other items, in full (armour, shields, rings, bracers and cloaks are worked out on the Combat page; the worn marks are set to the best armour class): ' + it.magic.join('; ') + '.' : '', sp.left.length ? 'Spells the sheet could not place: ' + sp.left.join(' ') : '']);
    const out = sanitize(s);
    return bestWear(out);
}

// Random PC (TB 2026-11-12). opts: {method 1-4 (DMG p.11), appP (true: "PC on the spot", DMG Appendix P, p.225-227), band "1" or "lo-hi", name}. Uses QPRules only (lib/quickparty_rules.js).
//  appP off: abilities by the chosen method, a level in the band, the standard kit for the class and level (QP baseKit), no magic items.
//  appP on : abilities as App. P (4d6, drop the lowest, arrange: Method I), a level in the band, standard kit, magic items from the App. P tables by level and the miscellaneous items (genPCParty).
// Returns {sheet, rec, line, magic: [names]}.
function randomPC(opts) {
    const QP = root.QPRules; if (!QP) throw new Error('Quick Party rules are not loaded.');
    opts = opts || {};
    const b = String(opts.band || '1').split('-').map(Number), lvl = b.length > 1 ? QP.rr(b[0], b[1]) : b[0], method = opts.appP ? 1 : Math.min(4, Math.max(1, Number(opts.method) || 1));
    let rec;
    if (opts.appP) rec = QP.genPCParty({ count: 1, levelRange: lvl, method: 1, alignMode: 'any' }).chars[0];
    else {
        const p = QP.genPC({ method, level: lvl });
        rec = QP.buildRecord({ race: p.cb.race, classes: p.cb.classes, levels: p.levels, stats: p.stats, male: p.male, align: p.align, xp: p.xp, hp: p.hp, magic: [] });
        rec.skills = QP.skillText(rec.classes, rec.levels, rec.race, rec.stats.dex);
    }
    const how = opts.appP ? 'Made by the Random PC button as a PC on the spot (DMG Appendix P, p.225-227: abilities 4d6 drop the lowest, level range, standard kit, magic items by level).'
        : 'Made by the Random PC button: abilities by DMG p.11 Method ' + ['I', 'II', 'III', 'IV'][method - 1] + ', level ' + lvl + ', standard kit, no magic items.';
    const sheet = fromQuickParty(rec, opts.name || '', how), magic = qpInventory(rec.equipment || []).magic;
    return { sheet, rec, magic, level: lvl, method, appP: !!opts.appP, line: previewLine(sheet) + (magic.length ? ' Magic and extras: ' + magic.join(', ') + '.' : '') };
}

// The wizard's finished character (1e_CHARACTER_CREATOR charFromState plus name, hp, levels, secondarySkill, spells) to a sheet.
function fromCreator(c, tokenName) {
    c = c || {};
    const s = blank(), cl = (c.classes || []).filter(k => Rules.CLASSES[k]).slice(0, 3);
    s.nm = str(c.name || tokenName, LIM.name); s.race = Rules.RACES[c.race] ? c.race : 'Human'; s.sub = c.subrace || ''; s.sex = c.sex === 'f' ? 'f' : 'm';
    s.cl = cl.length ? cl : ['Fighter']; s.lv = s.cl.map(k => (c.levels && c.levels[k]) || 1);
    const sc = c.scores || {}; s.sc = ABIL.map(a => sc[a] || 10); s.ex = c.strExc || 0; s.al = c.alignment;
    s.hp = s.hm = c.hp || 0; s.hl = c.hp ? [c.hp] : [];
    s.pf = (c.proficiencies || []).filter(Boolean);
    const idx = eqIndex();
    s.inv = (c.inventory || []).filter(i => i && i.n).map(i => {
        const q = Math.max(1, i.qty || 1);
        if (idx[i.n]) return [i.n, q];
        const r = [i.n, q, i.w || 0]; if (i.ac !== undefined && i.ac !== null) r.push(i.ac); return r;
    });
    s.co = coinsFromCP(c.coinsCP);
    s.lg = (c.languages || []).filter(Boolean);
    s.d.sx = c.age ? String(c.age) : ''; s.d.ht = feetInches(c.height); s.d.wt = c.weight ? c.weight + ' lb' : '';
    (c.spells || []).forEach(e => { if (!e || !e.s || !Rules.CLASSES[e.cls]) return; const k = e.cls; if (!s.sk[k]) s.sk[k] = [[]]; s.sk[k][0].push(e.s); });
    s.nt = fitNotes(['Made with the Character Creator wizard' + (c.version ? ' v' + c.version : '') + '.', c.secondarySkill ? 'Secondary skill: ' + c.secondarySkill + '.' : '',
        c.chaRolled && c.chaRolled !== sc.cha ? 'Charisma as rolled: ' + c.chaRolled + ' (final ' + sc.cha + ').' : '', (c.spells || []).length ? 'Starting spell book is under Spells, Known. Nothing is memorised yet.' : '']);
    return sanitize(s);
}
// One line for the Random PC preview: race, class, level, key scores, hp and AC.
function previewLine(sheet) {
    const s = sanitize(sheet), v = compute(s), n = ['Str', 'Int', 'Wis', 'Dex', 'Con', 'Cha'];
    const sc = s.sc.map((x, i) => n[i] + ' ' + (i === 0 && s.ex ? x + '/' + (s.ex === 100 ? '00' : String(s.ex).padStart(2, '0')) : x)).join(' ');
    return s.race + ' ' + s.cl.join('/') + ', level ' + s.lv.join('/') + ' (' + s.al + '). ' + sc + '. HP ' + s.hm + (v.d ? ', AC ' + v.d.ac : '') + '.';
}

const api = { CAST_BITS, VIEW_KEY, ammoLines, adjustAmmo, isCast, toggleCast, restSpells, filterMem, defaultSheetView, NS, KEY, OWNER_KEY, FORMAT, MAX_BYTES, WARN_BYTES, LIM, SPELL_KEY, COIN_NAMES, COIN_GP, ABIL, RACE_TRAITS,
    blank, sanitize, pack, randomPC, protectiveInfo, wearState, wearables, setWorn, bestWear, acBuild, saveTargets, SAVE_NAMES, MAGIC_AC_PICK, WEAR_TEXT, WEAR_PAGE, SOLDIERS, EXPERTS, SOLDIER_PAY_PAGE, SERJEANT_MULT, LOY_BASE, LOY_CATS, LOY_ALIGN, LOY_ALIGN_ROWS, LOY_SPECIAL, LOY_PENALTY, LOY_BONUS, LOY_SITUATION, LOY_BANDS, LOY_CHECKS, HENCH_MAINT, H, blankHench,
    command, directCap, assassinRule, MERC_CAP_BY_CLASS, MERC_CAP_OTHER, entryParts, locOf, hydrateRow, moveItem, removePlace, placeCounts, coinsAt, setCoinsAt, purseGp, payFrom, loyalty, loyaltyCheck, bandOf, soldierCost, expertCost, hireLine, retainers, bytes, sizeOf, exportText, parseImport, toChar, hydrate, combatRows, proficiencyChoices, weaponLine, movementTable, compute, coinGp, coinPieces, fromCreator, fromQuickParty, previewLine, coinsFromCP, qpSpells };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.SheetRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
