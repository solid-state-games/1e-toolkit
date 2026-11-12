// SHARED COPY of QUICK-PARTY-1e/rules.js: edit the master there, then run TOOLS/sync_lib.py
/* QuickParty rules: AD&D 1e RAW tables and generators. DOM-free, so index.html and the node test share it.
   Sources: PHB p.9-37, DMG p.11, 29-31, 35, 100-102, 175-176, 225-227 (Appendix P). Page cites in RAW_AUDIT.md. */
(function (root) {
'use strict';
const Q = { rng: Math.random };
const roll = s => Math.floor(Q.rng() * s) + 1;
const nd = (n, s) => { let t = 0; for (let i = 0; i < n; i++) t += roll(s); return t; };
const pick = a => a[Math.floor(Q.rng() * a.length)];
const pct = () => roll(100);
const rr = (a, b) => a + Math.floor(Q.rng() * (b - a + 1));
const rollRange = str => { const [a, b] = str.split('-').map(Number); return nd(a, b / a); };  // "2-16" = 2d8
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Q.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
Object.assign(Q, { roll, nd, pick, pct, rr, rollRange, shuffle });

const AB = ['str', 'int', 'wis', 'dex', 'con', 'cha'];
const RACES = ['Human', 'Dwarf', 'Elf', 'Gnome', 'Half-elf', 'Halfling', 'Half-orc'];
const CLASSES = ['Cleric', 'Druid', 'Fighter', 'Paladin', 'Ranger', 'Magic-User', 'Illusionist', 'Thief', 'Assassin', 'Monk'];
Object.assign(Q, { AB, RACES, CLASSES });

// ---- PHB p.15 Table III (min, max per ability; strength max is [base, exceptional cap] male/female) ----
const RMIN = { Human: [3,3,3,3,3,3], Dwarf: [8,3,3,3,12,3], Elf: [3,8,3,7,6,8], Gnome: [6,7,3,3,8,3], 'Half-elf': [3,4,3,6,6,3], Halfling: [6,6,3,8,10,3], 'Half-orc': [6,3,3,3,13,3] };
const RMAX = { Human: [18,18,18,18,18,18], Dwarf: [18,18,18,17,19,16], Elf: [18,18,18,19,18,18], Gnome: [18,18,18,18,18,18], 'Half-elf': [18,18,18,18,18,18], Halfling: [17,18,17,18,19,18], 'Half-orc': [18,17,14,17,19,12] };
const STRMAX = { // [male base, male exceptional cap, female base, female cap]  (PHB p.9 Strength Table I, p.15)
  Human: [18,100,18,50], Dwarf: [18,99,17,0], Elf: [18,75,16,0], Gnome: [18,50,15,0], 'Half-elf': [18,90,17,0], Halfling: [17,0,14,0], 'Half-orc': [18,99,18,75] };
const RMOD = { Human: {}, Dwarf: { con: 1, cha: -1 }, Elf: { dex: 1, con: -1 }, Gnome: {}, 'Half-elf': {}, Halfling: { str: -1, dex: 1 }, 'Half-orc': { str: 1, con: 1, cha: -2 } };
Object.assign(Q, { RMIN, RMAX, STRMAX, RMOD });

// ---- Classes: PHB p.19-33 ----
const C = {
  Cleric:      { hd: 8,  maxHD: 9,  s: 1, post: 2, min: { wis: 9 }, prime: ['wis'], armor: 'any', shield: 1, cap: 99, xp: [0,1501,3001,6001,13001,27501,55001,110001,225001,450001,675001,900001], per: 225000,
    titles: ['Acolyte','Adept','Priest','Curate','','Canon','Lama','Patriarch','High Priest','High Priest (10th level)','High Priest (11th level)'], start: [3,6] },
  Druid:       { hd: 8,  maxHD: 14, s: 1, post: 0, min: { wis: 12, cha: 15 }, prime: ['wis','cha'], armor: 'leather', shield: 1, cap: 14, xp: [0,2001,4001,7501,12501,20001,35001,60001,90001,125001,200001,300001,750001,1500001],
    titles: ['Aspirant','Ovate','Initiate of the 1st Circle','Initiate of the 2nd Circle','Initiate of the 3rd Circle','Initiate of the 4th Circle','Initiate of the 5th Circle','Initiate of the 6th Circle','Initiate of the 7th Circle','Initiate of the 8th Circle','Initiate of the 9th Circle','Druid','Archdruid','The Great Druid'] },
  Fighter:     { hd: 10, maxHD: 9,  s: 1, post: 3, min: { str: 9, con: 7 }, prime: ['str'], armor: 'any', shield: 1, cap: 99, xp: [0,2001,4001,8001,18001,35001,70001,125001,250001,500001,750001], per: 250000,
    titles: ['Veteran','Warrior','Swordsman','Hero','Swashbuckler','Myrmidon','Champion','Superhero','Lord','Lord (10th level)','Lord (11th level)'] },
  Paladin:     { hd: 10, maxHD: 9,  s: 1, post: 3, min: { str: 12, int: 9, wis: 13, con: 9, cha: 17 }, prime: ['str','wis'], armor: 'any', shield: 1, cap: 99, xp: [0,2751,5501,12001,24001,45001,95001,175001,350001,700001,1050001], per: 350000,
    titles: ['Gallant','Keeper','Protector','Defender','Warder','Guardian','Chevalier','Justiciar','Paladin','Paladin (10th level)','Paladin (11th level)'] },
  Ranger:      { hd: 8,  maxHD: 11, s: 2, post: 2, min: { str: 13, int: 13, wis: 14, con: 14 }, prime: ['str','int','wis'], armor: 'any', shield: 1, cap: 99, xp: [0,2251,4501,10001,20001,40001,90001,150001,225001,325001,650001,975001], per: 325000,
    titles: ['Runner','Strider','Scout','Courser','Tracker','Guide','Pathfinder','Ranger','Ranger Knight','Ranger Lord','Ranger Lord (11th level)','Ranger Lord (12th level)'] },
  'Magic-User':{ hd: 4,  maxHD: 11, s: 1, post: 1, min: { int: 9, dex: 6 }, prime: ['int'], armor: 'none', shield: 0, cap: 99, xp: [0,2501,5001,10001,22501,40001,60001,90001,135001,250001,375001,750001,1125001,1500001,1875001,2250001,2625001,3000001], per: 375000,
    titles: ['Prestidigitator','Evoker','Conjurer','Theurgist','Thaumaturgist','Magician','Enchanter','Warlock','Sorcerer','Necromancer','Wizard','Wizard (12th level)','Wizard (13th level)','Wizard (14th level)','Wizard (15th level)','Wizard (16th level, or Mage)','Wizard (17th level)','Wizard (18th level, or Arch-Mage)'] },
  Illusionist: { hd: 4,  maxHD: 10, s: 1, post: 1, min: { int: 15, dex: 16 }, prime: ['int','dex'], armor: 'none', shield: 0, cap: 99, xp: [0,2251,4501,9001,18001,35001,60001,95001,145001,220001,440001,660001,880001], per: 220000,
    titles: ['Prestidigitator','Minor Trickster','Trickster','Master Trickster','Cabalist','Visionist','Phantasmist','Apparitionist','Spellbinder','Illusionist','Illusionist (11th level)','Illusionist (12th level)'] },
  Thief:       { hd: 6,  maxHD: 10, s: 1, post: 2, min: { dex: 9 }, prime: ['dex'], armor: 'leather', shield: 0, cap: 99, xp: [0,1251,2501,5001,10001,20001,42501,70001,110001,160001,220001,440001,660001], per: 220000,
    titles: ['Rogue (Apprentice)','Footpad','Cutpurse','Robber','Burglar','Filcher','Sharper','Magsman','Thief','Master Thief','Master Thief (11th level)','Master Thief (12th level)'] },
  Assassin:    { hd: 6,  maxHD: 15, s: 1, post: 0, min: { str: 12, int: 11, dex: 12 }, prime: [], armor: 'leather', shield: 1, cap: 15, xp: [0,1501,3001,6001,12001,25001,50001,100001,200001,300001,425001,575001,750001,1000001,1500001],
    titles: ['Bravo (Apprentice)','Rutterkin','Waghalter','Murderer','Thug','Killer','Cutthroat','Executioner','Assassin','Expert Assassin','Senior Assassin','Chief Assassin','Prime Assassin','Guildmaster Assassin','Grandfather of Assassins'] },
  Monk:        { hd: 4,  maxHD: 18, s: 2, post: 0, min: { str: 15, wis: 15, dex: 15, con: 11 }, prime: [], armor: 'none', shield: 0, cap: 17, xp: [0,2251,4751,10001,22501,47501,98001,200001,350001,500001,700001,950001,1250001,1750001,2250001,2750001,3250001],
    titles: ['Novice','Initiate','Brother','Disciple','Immaculate','Master','Superior Master','Master of Dragons','Master of the North Wind','Master of the West Wind','Master of the South Wind','Master of the East Wind','Master of Winter','Master of Autumn','Master of Summer','Master of Spring','Grand Master of Flowers'] },
};
C.Cleric.titles[4] = '';  // level 5 has no title in PHB p.20
const MONK_AC = [10,9,8,7,7,6,5,4,3,3,2,1,0,-1,-1,-2,-3];  // PHB p.31 Monks Table II
Object.assign(Q, { C, MONK_AC });

const reach = (cls, lv) => { const c = C[cls]; if (lv <= c.xp.length) return c.xp[lv - 1]; return c.xp[c.xp.length - 1] + (lv - c.xp.length) * c.per; };
const levelFromXP = (cls, xp) => { const c = C[cls]; let l = 1; while (l < c.cap && xp >= reach(cls, l + 1) && (l < c.xp.length || c.per)) l++; return l; };
const title = (cls, lv) => { const t = C[cls].titles; return t[Math.min(lv, t.length) - 1] || ''; };
Object.assign(Q, { reach, levelFromXP, title });

// ---- Race class availability and level limits: PHB p.14-17 ----
// value: number = PC limit, 'U' unlimited, 'n8' NPC only with limit
const LIM = {
  Human: { Cleric: 'U', Druid: 'U', Fighter: 'U', Paladin: 'U', Ranger: 'U', 'Magic-User': 'U', Illusionist: 'U', Thief: 'U', Assassin: 'U', Monk: 'U' },
  Dwarf: { Cleric: 'n8', Fighter: 9, Thief: 'U', Assassin: 9 },
  Elf: { Cleric: 'n7', Fighter: 7, 'Magic-User': 11, Thief: 'U', Assassin: 10 },
  Gnome: { Cleric: 'n7', Fighter: 6, Illusionist: 7, Thief: 'U', Assassin: 8 },
  'Half-elf': { Cleric: 5, Druid: 'U', Fighter: 8, Ranger: 8, 'Magic-User': 8, Thief: 'U', Assassin: 11 },
  Halfling: { Druid: 'n6', Fighter: 6, Thief: 'U' },
  'Half-orc': { Cleric: 4, Fighter: 10, Thief: 8, Assassin: 'U' },
};
const MULTI = { // PHB p.15-17, p.32-33
  Human: [], Dwarf: [['Fighter','Thief']], Elf: [['Fighter','Magic-User'],['Fighter','Thief'],['Magic-User','Thief'],['Fighter','Magic-User','Thief']],
  Gnome: [['Fighter','Illusionist'],['Fighter','Thief'],['Illusionist','Thief']],
  'Half-elf': [['Cleric','Fighter'],['Cleric','Ranger'],['Cleric','Magic-User'],['Fighter','Magic-User'],['Fighter','Thief'],['Magic-User','Thief'],['Cleric','Fighter','Magic-User'],['Fighter','Magic-User','Thief']],
  Halfling: [['Fighter','Thief']], 'Half-orc': [['Cleric','Fighter'],['Cleric','Thief'],['Cleric','Assassin'],['Fighter','Thief'],['Fighter','Assassin']] };
Object.assign(Q, { LIM, MULTI });

// level limit for one class given race and stats (stats.str is 3-18; exceptional strength counts as 18)
function limitFor(race, cls, st) {
  const v = LIM[race][cls]; if (v === undefined) return 0;
  const cc = C[cls].cap;
  if (v === 'U') return cc;
  if (typeof v === 'string') return Math.min(cc, +v.slice(1));
  const s = st.str, i = st.int, d = st.dex;
  const tier = (x, a, b, c) => x < 17 ? a : x === 17 ? b : c;
  if (cls === 'Fighter') {
    if (race === 'Dwarf') return tier(s, 7, 8, 9);
    if (race === 'Elf') return tier(s, 5, 6, 7);
    if (race === 'Gnome') return s < 18 ? 5 : 6;
    if (race === 'Half-elf') return tier(s, 6, 7, 8);
    if (race === 'Halfling') return s < 17 ? 4 : 5;   // Tallfellow 18 str could reach 6 (PHB p.14 note 5); Stout assumed
  }
  if (cls === 'Magic-User') { if (race === 'Elf') return tier(i, 9, 10, 11); if (race === 'Half-elf') return tier(i, 6, 7, 8); }
  if (cls === 'Illusionist' && race === 'Gnome') { const m = Math.min(i, d); return m < 17 ? 5 : m === 17 ? 6 : 7; }
  if (cls === 'Thief' && race === 'Half-orc') return d < 17 ? 6 : 7;
  return v;
}
Q.limitFor = limitFor;

// ---- Alignment: PHB p.33 ----
const ALIGNS = ['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'];
const ALLOW = {
  Cleric: ALIGNS.filter(a => a !== 'True Neutral'), Druid: ['True Neutral'], Fighter: ALIGNS, Paladin: ['Lawful Good'],
  Ranger: ['Lawful Good','Neutral Good','Chaotic Good'], 'Magic-User': ALIGNS, Illusionist: ALIGNS,
  Thief: ['Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil','Neutral Good'],
  Assassin: ['Lawful Evil','Neutral Evil','Chaotic Evil'], Monk: ['Lawful Good','Lawful Neutral','Lawful Evil'] };
const SETS = [['Lawful Good','Neutral Good','Lawful Neutral'], ['Neutral Good','Chaotic Good','True Neutral'], ['True Neutral','Neutral Good','Lawful Neutral'], ['Lawful Evil','Neutral Evil','Lawful Neutral'], ['Chaotic Evil','Neutral Evil','Chaotic Neutral']];
Object.assign(Q, { ALIGNS, ALLOW, SETS });
const alignsFor = (classes, set) => (set || ALIGNS).filter(a => classes.every(c => ALLOW[c].includes(a)));
Q.alignsFor = alignsFor;

// ---- Ability generation: DMG p.11 methods I-IV ----
function rollAbilities(method) {
  method = +method;
  if (method === 1) return Array.from({ length: 6 }, () => { const r = [roll(6), roll(6), roll(6), roll(6)].sort((a, b) => b - a); return r[0] + r[1] + r[2]; }).sort((a, b) => b - a);
  if (method === 2) return Array.from({ length: 12 }, () => nd(3, 6)).sort((a, b) => b - a).slice(0, 6);
  if (method === 3) { const o = {}; AB.forEach(k => { let m = 0; for (let i = 0; i < 6; i++) m = Math.max(m, nd(3, 6)); o[k] = m; }); return o; }
  let best = null, bs = -1; // method IV: 12 sets in order, player picks the most desirable: highest total
  for (let s = 0; s < 12; s++) { const o = {}; AB.forEach(k => o[k] = nd(3, 6)); const t = AB.reduce((a, k) => a + o[k], 0); if (t > bs) { bs = t; best = o; } }
  return best;
}
Q.rollAbilities = rollAbilities;
const PRIORITY = { Cleric: ['wis','con','str','cha','dex','int'], Druid: ['wis','cha','con','dex','str','int'], Fighter: ['str','con','dex','cha','wis','int'], Paladin: ['str','wis','cha','con','int','dex'], Ranger: ['str','int','wis','con','dex','cha'],
  'Magic-User': ['int','dex','con','wis','cha','str'], Illusionist: ['int','dex','con','cha','wis','str'], Thief: ['dex','int','con','str','cha','wis'], Assassin: ['dex','str','int','con','cha','wis'], Monk: ['str','wis','dex','con','cha','int'] };
const classNeeds = classes => { const n = {}; AB.forEach(a => n[a] = 3); classes.forEach(c => Object.entries(C[c].min).forEach(([a, v]) => n[a] = Math.max(n[a], v))); return n; };
const idx = a => AB.indexOf(a);
// needs before racial modifier so that the modified score meets race minimum and class minimum
function needs(race, classes, multi) {
  const n = classNeeds(classes);
  if (multi && classes.includes('Cleric') && race === 'Half-elf') n.wis = Math.max(n.wis, 13);   // PHB p.20 multi-class half-elf cleric
  AB.forEach(a => { n[a] = Math.max(n[a], RMIN[race][idx(a)] - (RMOD[race][a] || 0)); });
  return n;
}
// arrange pool (array) or check fixed (object). returns pre-modifier score object or null
function arrange(pool, race, classes) {
  const n = needs(race, classes, classes.length > 1);
  if (!Array.isArray(pool)) return AB.every(a => pool[a] >= n[a]) ? Object.assign({}, pool) : null;
  const prio = []; classes.forEach(c => PRIORITY[c].forEach(a => { if (!prio.includes(a)) prio.push(a); }));
  const tryOrder = order => { const p = pool.slice(), o = {}; for (const a of order) o[a] = p.shift(); return AB.every(a => o[a] >= n[a]) ? o : null; };
  const r = tryOrder(prio); if (r) return r;
  const order = AB.slice().sort((a, b) => n[b] - n[a] || prio.indexOf(a) - prio.indexOf(b));   // greedy: hardest need first
  return tryOrder(order);
}
function finalizeStats(raw, race, male, fighterType) {
  const s = {}; AB.forEach(a => { let v = raw[a] + (RMOD[race][a] || 0); v = Math.min(v, RMAX[race][idx(a)]); v = Math.max(v, RMIN[race][idx(a)]); s[a] = v; });
  const sm = STRMAX[race], base = male ? sm[0] : sm[2], xcap = male ? sm[1] : sm[3];
  if (s.str > base) s.str = base;
  s.strX = null;
  if (s.str === 18 && fighterType && xcap > 0) s.strX = Math.min(roll(100), xcap);
  return s;
}
Q.finalizeStats = finalizeStats;
const fmtStr = s => s.str === 18 && s.strX ? '18/' + (s.strX === 100 ? '00' : String(s.strX).padStart(2, '0')) : String(s.str);
Q.fmtStr = fmtStr;

// ---- Hit points: PHB p.12, 19, 33-34 ----
const conAdj = (con, fighter) => con <= 3 ? -2 : con === 4 ? -1 : con <= 6 ? -1 : con <= 14 ? 0 : con === 15 ? 1 : con === 16 ? 2 : fighter ? (con === 17 ? 3 : 4) : 2;
const isFt = c => c === 'Fighter' || c === 'Paladin' || c === 'Ranger';
function dieAt(cls, step) {         // [diceCount, fixed] gained at class level `step`
  const c = C[cls];
  if (step === 1) return [c.s, 0];
  return step + c.s - 1 <= c.maxHD ? [1, 0] : [0, c.post];
}
function rollHP(classes, levels, con) {
  const n = classes.length; let total = 0;
  const maxL = Math.max(...levels);
  for (let j = 1; j <= maxL; j++) {
    let sum = 0;
    classes.forEach((cl, i) => {
      if (levels[i] < j) return;
      const [dice, fixed] = dieAt(cl, j);
      for (let k = 0; k < dice; k++) sum += Math.max(1, roll(C[cl].hd) + conAdj(con, isFt(cl)));
      sum += fixed;
    });
    total += n === 1 ? sum : Math.floor(sum / n + 0.5);
  }
  return Math.max(total, 1);
}
function hpBounds(classes, levels, con) {
  const n = classes.length; let lo = 0, hi = 0; const maxL = Math.max(...levels);
  for (let j = 1; j <= maxL; j++) { let a = 0, b = 0;
    classes.forEach((cl, i) => { if (levels[i] < j) return; const [d, f] = dieAt(cl, j); const adj = conAdj(con, isFt(cl)); a += d * Math.max(1, 1 + adj) + f; b += d * Math.max(1, C[cl].hd + adj) + f; });
    lo += n === 1 ? a : Math.floor(a / n + 0.5); hi += n === 1 ? b : Math.floor(b / n + 0.5); }
  return [Math.max(lo, 1), Math.max(hi, 1)];
}
Object.assign(Q, { rollHP, hpBounds, conAdj });

// ---- Spell slots: PHB p.20-26 ----
const CLR = [[],[1],[2],[2,1],[3,2],[3,3,1],[3,3,2],[3,3,2,1],[3,3,3,2],[4,4,3,2,1],[4,4,3,3,2],[5,4,4,3,2,1],[6,5,5,3,2,2],[6,6,6,4,2,2],[6,6,6,5,3,2],[7,7,7,5,4,2],[7,7,7,6,5,3,1],[8,8,8,6,5,3,1],[8,8,8,7,6,4,1],[9,9,9,7,6,4,2],[9,9,9,8,7,5,2]];
const DRU = [[],[2],[2,1],[3,2,1],[4,2,2],[4,3,2],[4,3,2,1],[4,4,3,1],[4,4,3,2],[5,4,3,2,1],[5,4,3,3,2],[5,5,3,3,2,1],[5,5,4,4,3,2,1],[6,5,5,5,4,3,2],[6,6,6,6,5,4,3]];
const MU = [[],[1],[2],[2,1],[3,2],[4,2,1],[4,2,2],[4,3,2,1],[4,3,3,2],[4,3,3,2,1],[4,4,3,2,2],[4,4,4,3,3],[4,4,4,4,4,1],[5,5,5,4,4,2],[5,5,5,4,4,2,1],[5,5,5,5,5,2,1],[5,5,5,5,5,3,2,1],[5,5,5,5,5,3,3,2],[5,5,5,5,5,3,3,2,1],[5,5,5,5,5,3,3,3,1],[5,5,5,5,5,4,3,3,2]];
const ILL = [[],[1],[2],[2,1],[3,2],[4,2,1],[4,3,1],[4,3,2],[4,3,2,1],[5,3,3,2,1],[5,4,3,2,1],[5,4,3,3,2],[5,5,4,3,2,1],[5,5,4,3,2,2],[5,5,4,3,2,2,1],[5,5,4,4,2,2,2],[5,5,5,4,3,2,2],[5,5,5,5,3,2,2],[5,5,5,5,3,3,2],[5,5,5,5,4,3,2],[5,5,5,5,4,3,3]];
const PAL = { 9: [1], 10: [2], 11: [2,1], 12: [2,2], 13: [2,2,1], 14: [3,2,1], 15: [3,2,1,1], 16: [3,3,1,1], 17: [3,3,2,1], 18: [3,3,3,1], 19: [3,3,3,2], 20: [3,3,3,3] };
const RNG = { 8: [[1],[]], 9: [[1],[1]], 10: [[2],[1]], 11: [[2],[2]], 12: [[2,1],[2,1]], 13: [[2,1],[2,1]], 14: [[2,2],[2,2]], 15: [[2,2],[2,2]], 16: [[2,2,1],[2,2]], 17: [[2,2,2],[2,2]] };
Object.assign(Q, { SLOTS: { Cleric: CLR, Druid: DRU, 'Magic-User': MU, Illusionist: ILL, Paladin: PAL, Ranger: RNG } });

// ---- Spell lists: PHB p.40-42 ----
const L = s => s.split('|');
const SP = {
  Cleric: [null,
    L("Bless|Command|Create Water|Cure Light Wounds|Detect Evil|Detect Magic|Light|Protection From Evil|Purify Food & Drink|Remove Fear|Resist Cold|Sanctuary"),
    L("Augury|Chant|Detect Charm|Find Traps|Hold Person|Know Alignment|Resist Fire|Silence 15' Radius|Slow Poison|Snake Charm|Speak With Animals|Spiritual Hammer"),
    L("Animate Dead|Continual Light|Create Food & Water|Cure Blindness|Cure Disease|Dispel Magic|Feign Death|Glyph of Warding|Locate Object|Prayer|Remove Curse|Speak With Dead"),
    L("Cure Serious Wounds|Detect Lie|Divination|Exorcise|Lower Water|Neutralize Poison|Protection From Evil 10' Radius|Speak With Plants|Sticks to Snakes|Tongues"),
    L("Atonement|Commune|Cure Critical Wounds|Dispel Evil|Flame Strike|Insect Plague|Plane Shift|Quest|Raise Dead|True Seeing"),
    L("Aerial Servant|Animate Object|Blade Barrier|Conjure Animals|Find the Path|Heal|Part Water|Speak With Monsters|Stone Tell|Word of Recall"),
    L("Astral Spell|Control Weather|Earthquake|Gate|Holy (Unholy) Word|Regenerate|Restoration|Resurrection|Symbol|Wind Walk")],
  Druid: [null,
    L("Animal Friendship|Detect Magic|Detect Snares & Pits|Entangle|Faerie Fire|Invisibility to Animals|Locate Animals|Pass Without Trace|Predict Weather|Purify Water|Shillelagh|Speak With Animals"),
    L("Barkskin|Charm Person or Mammal|Create Water|Cure Light Wounds|Feign Death|Fire Trap|Heat Metal|Locate Plants|Obscurement|Produce Flame|Trip|Warp Wood"),
    L("Call Lightning|Cure Disease|Hold Animal|Neutralize Poison|Plant Growth|Protection From Fire|Pyrotechnics|Snare|Stone Shape|Summon Insects|Tree|Water Breathing"),
    L("Animal Summoning I|Call Woodland Beings|Control Temperature 10' Radius|Cure Serious Wounds|Dispel Magic|Hallucinatory Forest|Hold Plant|Plant Door|Produce Fire|Protection From Lightning|Repel Insects|Speak With Plants"),
    L("Animal Growth|Animal Summoning II|Anti-Plant Shell|Commune With Nature|Control Winds|Insect Plague|Pass Plant|Sticks to Snakes|Transmute Rock to Mud|Wall of Fire"),
    L("Animal Summoning III|Anti-Animal Shell|Conjure Fire Elemental|Cure Critical Wounds|Feeblemind|Fire Seeds|Transport Via Plants|Turn Wood|Wall of Thorns|Weather Summoning"),
    L("Animate Rock|Chariot of Sustarre|Confusion|Conjure Earth Elemental|Control Weather|Creeping Doom|Finger of Death|Fire Storm|Reincarnate|Transmute Metal to Wood")],
  'Magic-User': [null,
    L("Affect Normal Fires|Burning Hands|Charm Person|Comprehend Languages|Dancing Lights|Detect Magic|Enlarge|Erase|Feather Fall|Find Familiar|Friends|Hold Portal|Identify|Jump|Light|Magic Missile|Mending|Message|Nystul's Magic Aura|Protection From Evil|Push|Read Magic|Shield|Shocking Grasp|Sleep|Spider Climb|Tenser's Floating Disc|Unseen Servant|Ventriloquism|Write"),
    L("Audible Glamer|Continual Light|Darkness 15' Radius|Detect Evil|Detect Invisibility|ESP|Fool's Gold|Forget|Invisibility|Knock|Leomund's Trap|Levitate|Locate Object|Magic Mouth|Mirror Image|Pyrotechnics|Ray of Enfeeblement|Rope Trick|Scare|Shatter|Stinking Cloud|Strength|Web|Wizard Lock"),
    L("Blink|Clairaudience|Clairvoyance|Dispel Magic|Explosive Runes|Feign Death|Fireball|Flame Arrow|Fly|Gust of Wind|Haste|Hold Person|Infravision|Invisibility 10' Radius|Leomund's Tiny Hut|Lightning Bolt|Monster Summoning I|Phantasmal Force|Protection From Evil 10' Radius|Protection From Normal Missiles|Slow|Suggestion|Tongues|Water Breathing"),
    L("Charm Monster|Confusion|Dig|Dimension Door|Enchanted Weapon|Extension I|Fear|Fire Charm|Fire Shield|Fire Trap|Fumble|Hallucinatory Terrain|Ice Storm|Massmorph|Minor Globe of Invulnerability|Monster Summoning II|Plant Growth|Polymorph Other|Polymorph Self|Rary's Mnemonic Enhancer|Remove Curse|Wall of Fire|Wall of Ice|Wizard Eye"),
    L("Airy Water|Animal Growth|Animate Dead|Bigby's Interposing Hand|Cloudkill|Conjure Elemental|Cone of Cold|Contact Other Plane|Distance Distortion|Extension II|Feeblemind|Hold Monster|Leomund's Secret Chest|Magic Jar|Monster Summoning III|Mordenkainen's Faithful Hound|Passwall|Stone Shape|Telekinesis|Teleport|Transmute Rock to Mud|Wall of Force|Wall of Iron|Wall of Stone"),
    L("Anti-Magic Shell|Bigby's Forceful Hand|Control Weather|Death Spell|Disintegrate|Enchant an Item|Extension III|Geas|Glassee|Globe of Invulnerability|Guards and Wards|Invisible Stalker|Legend Lore|Lower Water|Monster Summoning IV|Move Earth|Otiluke's Freezing Sphere|Part Water|Project Image|Reincarnation|Repulsion|Spiritwrack|Stone to Flesh|Tenser's Transformation"),
    L("Bigby's Grasping Hand|Cacodemon|Charm Plants|Delayed Blast Fireball|Drawmij's Instant Summons|Duo-Dimension|Limited Wish|Mass Invisibility|Monster Summoning V|Mordenkainen's Sword|Phase Door|Power Word Stun|Reverse Gravity|Simulacrum|Statue|Vanish"),
    L("Antipathy/Sympathy|Bigby's Clenched Fist|Clone|Glassteel|Incendiary Cloud|Mass Charm|Maze|Mind Blank|Monster Summoning VI|Otto's Irresistible Dance|Permanency|Polymorph Any Object|Power Word Blind|Serten's Spell Immunity|Symbol|Trap the Soul"),
    L("Astral Spell|Bigby's Crushing Hand|Gate|Imprisonment|Meteor Swarm|Monster Summoning VII|Power Word Kill|Prismatic Sphere|Shape Change|Temporal Stasis|Time Stop|Wish")],
  Illusionist: [null,
    L("Audible Glamer|Change Self|Color Spray|Dancing Lights|Darkness|Detect Illusion|Detect Invisibility|Gaze Reflection|Hypnotism|Light|Phantasmal Force|Wall of Fog"),
    L("Blindness|Blur|Deafness|Detect Magic|Fog Cloud|Hypnotic Pattern|Improved Phantasmal Force|Invisibility|Magic Mouth|Mirror Image|Misdirection|Ventriloquism"),
    L("Continual Darkness|Continual Light|Dispel Illusion|Fear|Hallucinatory Terrain|Illusionary Script|Invisibility 10' Radius|Non-detection|Paralyzation|Rope Trick|Spectral Force|Suggestion"),
    L("Confusion|Dispel Exhaustion|Emotion|Improved Invisibility|Massmorph|Minor Creation|Phantasmal Killer|Shadow Monsters"),
    L("Chaos|Demi-Shadow Monsters|Major Creation|Maze|Projected Image|Shadow Door|Shadow Magic|Summon Shadow"),
    L("Conjure Animals|Demi-Shadow Magic|Mass Suggestion|Permanent Illusion|Programmed Illusion|Shades|True Sight|Veil"),
    L("Alter Reality|Astral Spell|Prismatic Spray|Prismatic Wall|Vision")],   // 7th also lists any first level magic-user spell (PHB p.42); modelled as extra picks in spellsFor
};
Q.SP = SP;

// Intelligence Table II (PHB p.10) and spell level access
function intTable(i) { return i <= 9 ? [35, 4, 6] : i <= 12 ? [45, 5, 7] : i <= 14 ? [55, 6, 9] : i <= 16 ? [65, 7, 11] : i === 17 ? [75, 8, 14] : i === 18 ? [85, 9, 18] : [95, 10, 999]; }
const maxSpellLevelInt = i => i >= 18 ? 9 : i >= 16 ? 8 : i >= 14 ? 7 : i >= 12 ? 6 : i >= 10 ? 5 : 4;
Object.assign(Q, { intTable, maxSpellLevelInt });
function knownSpells(list, int) {   // RAW "chance to know" checks, min and max per level (PHB p.10)
  const [ch, mn, mx] = intTable(int); const pool = shuffle(list); const known = []; let fails = [];
  for (const s of pool) { if (known.length >= mx) break; if (pct() <= ch) known.push(s); else fails.push(s); }
  let guard = 0;
  while (known.length < Math.min(mn, list.length) && guard++ < 50) { const again = []; for (const s of fails) { if (known.length >= mn || known.length >= mx) { again.push(s); continue; } if (pct() <= ch) known.push(s); else again.push(s); } fails = again; }
  return known;
}
const wisSlots = (base, wis) => {  // PHB p.11 Wisdom Table II bonus spells, plus access limits
  const s = base.slice(); const add = (l, n) => { if (s.length >= l) s[l - 1] += n; };
  if (wis >= 13) add(1, 1); if (wis >= 14) add(1, 1); if (wis >= 15) add(2, 1); if (wis >= 16) add(2, 1); if (wis >= 17) add(3, 1); if (wis >= 18) add(4, 1);
  if (wis < 17 && s.length >= 6) { s[5] = 0; }      // 6th level spells need wisdom 17 (p.11)
  if (wis < 18 && s.length >= 7) s[6] = 0;          // 7th level needs 18 (p.11, p.20 **)
  if (wis < 17 && base.length === 5 && base[4] === 1) s[4] = 0;   // p.20 * : the single 5th level slot at 9th level needs wisdom 17
  return s;
};
function spellSection(cls, lv, st) {
  const out = []; const mem = (title, slots, list) => slots.forEach((n, i) => { if (n > 0 && list[i + 1]) { const p = []; for (let k = 0; k < n; k++) p.push(pick(list[i + 1])); out.push(`<b>${title} L${i + 1} (${n}):</b> ${p.sort().join(', ')}`); } });
  if (cls === 'Cleric') mem('Prayers', wisSlots(CLR[Math.min(lv, 20)] || [], st.wis), SP.Cleric);
  else if (cls === 'Druid') mem('Prayers', DRU[Math.min(lv, 14)] || [], SP.Druid);
  else if (cls === 'Paladin' && lv >= 9) mem('Prayers', PAL[Math.min(lv, 20)], SP.Cleric);
  else if (cls === 'Ranger' && lv >= 8) { const r = RNG[Math.min(lv, 17)]; mem('Druidic', r[0], SP.Druid); bookSpells('Ranger MU', r[1], 'Magic-User', st, out, lv); }
  else if (cls === 'Magic-User' || cls === 'Illusionist') bookSpells(cls === 'Magic-User' ? 'MU' : 'Ill', (cls === 'Magic-User' ? MU : ILL)[Math.min(lv, 20)], cls, st, out, lv);
  return out;
}
function bookSpells(label, slots, cls, st, out, lv) {
  const maxL = maxSpellLevelInt(st.int);
  slots.forEach((n, i) => {
    const sl = i + 1; if (n <= 0 || sl > maxL || !SP[cls][sl]) return;
    let list = SP[cls][sl];
    let cap = knownSpells(list, st.int);
    if (cap.length === 0) cap = [pick(list)];
    let book;
    if (cls === 'Magic-User' && sl === 1 && lv === 1) {      // DMG p.39 apprentice spells: read magic + 1 offensive + 1 defensive + 1 misc
      book = ['Read Magic', pick(L("Burning Hands|Charm Person|Enlarge|Friends|Light|Magic Missile|Push|Shocking Grasp|Sleep")), pick(L("Affect Normal Fires|Dancing Lights|Feather Fall|Hold Portal|Jump|Protection From Evil|Shield|Spider Climb|Ventriloquism")), pick(L("Comprehend Languages|Detect Magic|Erase|Find Familiar|Identify|Mending|Message|Unseen Servant|Write"))];
    } else if (cls === 'Illusionist' && sl === 1 && lv === 1) { book = shuffle(list).slice(0, 3); }      // DMG p.39
    else {
      const size = Math.min(cap.length, Math.max(n, intTable(st.int)[1]));
      book = shuffle(cap).slice(0, size);
      if (cls === 'Magic-User' && sl === 1 && !book.includes('Read Magic')) book[0] = 'Read Magic';
    }
    const mem = []; for (let k = 0; k < n; k++) mem.push(pick(book));
    out.push(`<b>${label} L${sl} (${n}):</b> ${mem.sort().join(', ')}<br><span class="opacity-60">Book: ${book.sort().join(', ')}</span>`);
  });
}
Q.spellSection = spellSection;

// ---- Equipment and AC: PHB p.36 Armor Class Table, DMG p.28 ----
const ARMOR_AC = { 'Plate Mail': 3, 'Banded Mail': 4, 'Splint Mail': 4, 'Chain Mail': 5, 'Scale Mail': 6, 'Studded Leather': 7, 'Ring Mail': 7, 'Leather Armor': 8, 'Padded Armor': 8 };
function perms(classes, race) {
  let armor = 'none', shield = false;
  const rank = { none: 0, leather: 1, any: 2 };
  classes.forEach(c => { if (rank[C[c].armor] > rank[armor]) armor = C[c].armor; if (C[c].shield) shield = true; });
  // multi-class restrictions: PHB p.14-18, 32-33
  if (classes.length > 1) {
    if (classes.includes('Thief')) { armor = 'leather'; shield = false; }
    else if (classes.includes('Assassin')) { armor = 'leather'; }
    else if (race === 'Gnome') armor = armor === 'any' ? 'leather' : armor;   // gnomes in two classes: leather regardless (p.16)
  }
  const w = new Set();
  const W = { Cleric: ['mace','hammer'], Druid: ['dagger','spear','sword','hammer'], Fighter: ['all'], Paladin: ['all'], Ranger: ['all'], Assassin: ['all'], 'Magic-User': ['dagger'], Illusionist: ['dagger'], Thief: ['dagger','sword'], Monk: ['dagger','spear','bolt','axe','jav'] };
  classes.forEach(c => W[c].forEach(x => w.add(x)));
  if (w.has('all')) ['dagger','sword','mace','hammer','axe','spear','bow','bolt','jav'].forEach(x => w.add(x));
  if (classes.includes('Thief') && classes.length > 1 && !classes.some(c => ['Fighter','Cleric'].includes(c))) { /* thief-only weapon list applies when thieving only; keep union */ }
  return { armor, shield, weapons: w };
}
function baseKit(classes, level, race) {
  const p = perms(classes, race); const kit = [];
  if (p.armor === 'any') kit.push(level >= 2 ? 'Plate Mail' : 'Chain Mail');
  else if (p.armor === 'leather') kit.push(classes.includes('Druid') && classes.length === 1 ? 'Leather Armor' : 'Studded Leather');
  if (p.shield) kit.push('Shield');
  const w = p.weapons;
  if (w.has('sword') && classes.some(c => ['Fighter','Paladin','Ranger','Assassin','Thief'].includes(c))) kit.push('Long Sword');
  else if (classes.includes('Druid')) kit.push('Scimitar');
  else if (w.has('mace') && classes.includes('Cleric')) kit.push('Mace');
  if (w.has('bow') && classes.some(c => c === 'Ranger' || c === 'Fighter')) kit.push('Long Bow & Arrows');
  if (w.has('dagger')) kit.push('Dagger');
  if (classes.includes('Monk')) kit.push('Staff');
  if (classes.some(c => c === 'Magic-User' || c === 'Illusionist') && !kit.includes('Dagger')) kit.push('Dagger');
  if (classes.includes('Thief') || classes.includes('Assassin')) kit.push("Thieves' Picks & Tools");
  return { kit, perm: p };
}
function dexAdj(d) { return d <= 3 ? 4 : d === 4 ? 3 : d === 5 ? 2 : d === 6 ? 1 : d <= 14 ? 0 : d === 15 ? -1 : d === 16 ? -2 : d === 17 ? -3 : -4; }   // PHB p.11 defensive adjustment (19 treated as 18)
function calcAC(classes, level, items, dex) {
  if (classes.length === 1 && classes[0] === 'Monk') return MONK_AC[Math.min(level, 17) - 1];        // PHB p.30-31: monks get no dex adjustment
  let base = 10, armorFound = false, shield = 0, ring = 0, bracers = null, cloak = 0;
  items.forEach(it => {
    const m = it.match(/\+(\d+)/); const plus = m ? +m[1] : 0;
    for (const [n, ac] of Object.entries(ARMOR_AC)) if (it.includes(n) && !/Shield/.test(it.replace(n, ''))) { if (ac - plus < base) base = ac - plus; armorFound = true; }
    const sm = it.match(/Shield(?: )?\+?(\d+)?/);
    if (/Shield\b/.test(it) && !/Brooch|Spell|Shielding/.test(it)) shield = Math.max(shield, 1 + (it.match(/Shield[^,&]*?\+(\d+)|\+(\d+)\s+Shield/) ? +(RegExp.$1 || RegExp.$2) : 0));
    const rp = it.match(/Ring of Protection \+(\d+)/); if (rp) ring = Math.max(ring, +rp[1]);
    const bd = it.match(/Bracers of Defense, AC (\d+)/); if (bd) bracers = +bd[1];
    const ck = it.match(/Cloak of Protection \+(\d+)/); if (ck) cloak = Math.max(cloak, +ck[1]);
  });
  let ac = base - shield;
  if (bracers !== null && !armorFound) ac = Math.min(ac, bracers - shield);
  return ac - ring - cloak + dexAdj(dex);
}
Object.assign(Q, { baseKit, perms, calcAC, dexAdj });

// ---- Appendix P party magic: DMG p.226-227 ----
const PROT = { Cleric: { shield: 10, plate: 5, banded: 6, chain: 8, ring: 2 }, Druid: { leather: 8, ring: 5 }, Fighter: { shield: 10, plate: 6, banded: 8, chain: 10 }, Paladin: { shield: 10, plate: 6, banded: 8, chain: 10 }, Ranger: { shield: 8, plate: 5, banded: 7, chain: 15 },
  'Magic-User': { ring: 15, bracers: 4 }, Illusionist: { ring: 15, bracers: 4 }, Thief: { leather: 10, ring: 4 }, Assassin: { shield: 8, leather: 10, ring: 3 }, Monk: {} };
const SCRL = { Cleric: [8, 0, 3, 4], Druid: [7, 1, 3, 4], Fighter: [6, 1, 0, 0], Paladin: [4, 1, 0, 0], Ranger: [5, 1, 0, 0], 'Magic-User': [15, 0, 4, 6], Illusionist: [12, 0, 3, 4], Thief: [6, 1, 3, 4], Assassin: [3, 1, 3, 0], Monk: [0, 0, 0, 0] };   // chance, protection, 1-spell max level, 3-spell max level
const WEAP = { Cleric: { mace: 12 }, Druid: { dagger: 10, sword: 7, spear: 10 }, Fighter: { dagger: 10, sword: 10, axe: 7, spear: 8, bow: 1, bolts: 10 }, Paladin: { dagger: 10, sword: 10, axe: 10, spear: 10 }, Ranger: { dagger: 10, sword: 9, axe: 9, spear: 8, bow: 5, bolts: 10 },
  'Magic-User': { dagger: 15 }, Illusionist: { dagger: 15 }, Thief: { dagger: 12, sword: 11 }, Assassin: { dagger: 10, sword: 5, mace: 5, axe: 5, spear: 5, bolts: 1 }, Monk: { dagger: 5, spear: 2 } };
const POT = { Cleric: [6, 1], Druid: [11, 2], Fighter: [8, 1], Paladin: [6, 1], Ranger: [7, 1], 'Magic-User': [10, 3], Illusionist: [10, 2], Thief: [9, 2], Assassin: [5, 1], Monk: [0, 0] };
const POTT = ['Climbing','Diminution','Extra-Healing','Fire Resistance','Flying','Gaseous Form','Growth','Healing','Invisibility','Polymorph Self'];
const MISC = ['Ring of Feather Falling','Ring of Warmth','Ring of Water Walking','Wand of Negation','Wand of Wonder','Bag of Holding (500 lb. capacity)','Folding Boat (small rowboat)','Brooch of Shielding','Cloak and Boots of Elvenkind','Javelin of Lightning (pair)','Javelin of Piercing (pair)','Necklace of Adaptation','Robe of Useful Items (7-12 items)','Rope of Climbing','Trident of Warning','Wings of Flying or Boots of Levitation'];
Object.assign(Q, { PROT, SCRL, WEAP, POT, POTT, MISC });
function plusFor(chance, level) {   // "typically +1": 1% per level above average; chance above 90% is added
  const up = level + Math.max(0, chance - 90);
  if (pct() <= up) return pct() <= level ? 3 : 2;
  return 1;
}
function scrollSpells(cls, maxLvl, count) {
  const list = cls === 'Cleric' || cls === 'Druid' ? SP[cls] : cls === 'Illusionist' ? SP.Illusionist : SP['Magic-User'];
  const o = []; for (let i = 0; i < count; i++) { const l = Math.min(roll(maxLvl), list.length - 1); o.push(pick(list[l]) + ` (L${l})`); } return o;
}
function appPItems(classes, levels, perm) {
  const items = []; const have = new Set(); const add = (k, t) => { if (!have.has(k)) { have.add(k); items.push(t); } };
  let armorTried = false;
  classes.forEach((cl, ci) => {
    const lv = levels[ci];
    const P = PROT[cl] || {}; const arm = ['plate', 'banded', 'chain'].filter(k => P[k]);
    if (P.shield && perm.shield && !have.has('shield')) { const ch = P.shield * lv; if (pct() <= ch) add('shield', `Shield +${plusFor(ch, lv)}`); }
    if (arm.length && perm.armor === 'any' && !armorTried) { armorTried = true; const k = pick(arm); const ch = P[k] * lv; if (pct() <= ch) add('armor', `${{ plate: 'Plate Mail', banded: 'Banded Mail', chain: 'Chain Mail' }[k]} +${plusFor(ch, lv)}`); }
    if (P.leather && perm.armor !== 'none' && !armorTried) { armorTried = true; const ch = P.leather * lv; if (pct() <= ch) add('armor', `Leather Armor +${plusFor(ch, lv)}`); }
    if (P.ring) { const ch = P.ring * lv; if (pct() <= ch) add('ring', `Ring of Protection +${plusFor(ch, lv)}`); }
    if (P.bracers) { const ch = P.bracers * lv; if (pct() <= ch) { const p = plusFor(ch, lv); add('bracers', `Bracers of Defense, AC ${7 - p}`); } }
    const W = WEAP[cl] || {};
    if (W.dagger && pct() <= W.dagger * lv) add('dagger', `Dagger +${plusFor(W.dagger * lv, lv)}`);
    if (W.bow && pct() <= W.bow * lv) add('bow', `Long Bow +${plusFor(W.bow * lv, lv)}`);
    const ex = ['sword', 'mace', 'axe', 'spear', 'bolts'].filter(k => W[k] && (k !== 'bolts' || perm.weapons.has('bolt')));
    if (ex.length && !have.has('exw')) {
      const k = pick(ex); const ch = W[k] * lv;
      if (pct() <= ch) {
        const p = plusFor(ch, lv); have.add('exw');
        if (k === 'bolts') items.push(p === 3 ? '15 Bolts +2 and a Crossbow of Speed' : p === 2 ? '30 Bolts +2' : '15 Bolts +2');
        else items.push(`${k === 'sword' ? (cl === 'Druid' ? 'Scimitar' : 'Long Sword') : k === 'axe' ? 'Battle Axe' : k === 'mace' ? 'Mace' : 'Spear'} +${p}`);
      }
    }
    const S = SCRL[cl]; if (S && S[0] && !have.has('scroll') && pct() <= S[0] * lv) {
      have.add('scroll'); const opts = []; if (S[1]) opts.push('prot'); if (S[2]) opts.push('one'); if (S[3] && !items.length) opts.push('three');
      const o = pick(opts.length ? opts : ['prot']); const src = ['Thief', 'Assassin'].includes(cl) ? 'Magic-User' : cl;
      items.push(o === 'prot' ? 'Scroll of Protection (type per DM)' : o === 'one' ? `Scroll: ${scrollSpells(src, S[2], 1)[0]}` : `Scroll: ${scrollSpells(src, S[3], 3).join(', ')}`);
    }
    const Po = POT[cl]; if (Po && Po[0] && !have.has('pot')) {
      have.add('pot'); const ch = Po[0] * lv;
      if (ch >= 100) items.push(`Potions of choice (up to ${Po[1]}): see DMG p.227 list`);
      else if (pct() <= ch) { const n = roll(Po[1]); const t = shuffle(POTT).slice(0, n); t.forEach(x => items.push(`Potion of ${x}`)); }
    }
  });
  return items;
}
Q.appPItems = appPItems;

// ---- DMG p.175-176 character party magic item tables ----
const TI = [['2 Potions: Climbing, Flying'], ['2 Potions: Extra-Healing, Polymorph (Self)'], ['2 Potions: Fire Resistance, Speed'], ['2 Potions: Healing, Giant Strength', 'ft'], ['2 Potions: Heroism, Invulnerability', 'ft'], ['2 Potions: Human Control, Levitation'], ['2 Potions: Super-Heroism, Animal Control', 'ft'],
  ['Scroll: 1 Spell, level 1-6', 'cast'], ['Scroll: 2 Spells, level 1-4', 'cast'], ['Scroll: Protection from Magic'], ['Ring of Mammal Control'], ['Ring of Protection +1'], ['Leather Armor +1', 'arm'], ['Shield +1', 'shield'], ['Long Sword +1', 'sword'], ['10 Arrows +1', 'bow'], ['4 Bolts +2', 'bolt'], ['Dagger +1', 'dagger'], ['Javelin +2', 'jav'], ['Mace +1', 'mace']];
const TII = [['Scroll: 3 Spells, level 2-9 (2-7 for clerics)', 'cast'], ['2 Rings: Fire Resistance, Invisibility'], ['Ring of Protection +3'], ['Staff of Striking', 'staff'], ['Wand of Illusion', 'arc'], ['Wand of Negation', 'arc'], ['Bracers of Defense, AC 4', 'noarm'], ['Brooch of Shielding'], ['Cloak of Elvenkind'], ['Dust of Appearance'], ['Figurine of Wondrous Power: Serpentine Owl'], ['3 Javelins of Lightning', 'jav'], ['Chain Mail +1 and Shield +2', 'chainsh'], ['Splint Mail +4', 'plate'], ['Long Sword +3', 'sword'], ['Crossbow of Speed and Hammer +2', 'ft']];
const TIII = [['Ring of Spell Storing'], ['Rod of Cancellation'], ['Staff of the Serpent (python or adder)', 'clr'], ['Bag of Tricks'], ['Boots of Speed'], ['Boots of Striding and Leaping'], ['Cloak of Displacement'], ['Gauntlets of Ogre Power', 'ft'], ['Pipe of the Sewers'], ['Robe of Blending', 'arc'], ['2 Ropes: Climbing, Entanglement'], ['Plate Mail +3 and Shield +2', 'platesh'], ['Shield +5', 'shield'], ['Sword +4, Defender', 'sword'], ['Mace +3', 'mace'], ['Spear +3', 'spear']];
const TIV = [['Ring of Djinni Summoning'], ['Ring of Spell Turning'], ['Rod of Smiting'], ['Wand of Fire', 'arc'], ['Cube of Force'], ['Eyes of Charming'], ['Horn of Valhalla'], ['Robe of Scintillating Colors', 'arc'], ['Talisman of Ultimate Evil or Pure Good (per alignment)'], ['Plate Mail +4 and Shield +3', 'platesh'], ['Sword of Wounding', 'sword'], ['Arrow of Slaying (select character type)', 'bow']];
Q.DMGTABLES = { I: TI, II: TII, III: TIII, IV: TIV };
function usable(tag, classes, perm) {
  const has = c => classes.includes(c);
  switch (tag) {
    case undefined: return true;
    case 'ft': return ['Fighter', 'Paladin', 'Ranger'].some(has);
    case 'cast': return ['Cleric', 'Druid', 'Magic-User', 'Illusionist'].some(has);
    case 'arc': return has('Magic-User') || has('Illusionist');
    case 'clr': return has('Cleric') || has('Druid');
    case 'staff': return ['Cleric', 'Magic-User', 'Illusionist'].some(has);
    case 'arm': return perm.armor !== 'none';
    case 'shield': return perm.shield;
    case 'chainsh': return perm.armor === 'any' && perm.shield;
    case 'plate': return perm.armor === 'any';
    case 'platesh': return perm.armor === 'any' && perm.shield;
    case 'noarm': return perm.armor === 'none';
    case 'sword': return perm.weapons.has('sword');
    case 'mace': return perm.weapons.has('mace');
    case 'spear': return perm.weapons.has('spear');
    case 'bow': return perm.weapons.has('bow');
    case 'bolt': return perm.weapons.has('bolt');
    case 'dagger': return perm.weapons.has('dagger');
    case 'jav': return perm.weapons.has('jav');
  }
  return true;
}
function tableItems(tbl, n, classes, perm, align) {
  const out = [];
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < 20; t++) {   // DMG p.176: select items appropriate to the individual; reroll unsuitable results
      const e = pick(tbl); if (!usable(e[1], classes, perm)) continue;
      let s = e[0];
      if (/Talisman/.test(s)) s = /Evil/.test(align || '') ? 'Talisman of Ultimate Evil' : 'Talisman of Pure Good';
      if (/Scroll: 3 Spells, level 2-9/.test(s)) s = classes.includes('Magic-User') || classes.includes('Illusionist') ? 'Scroll: 3 Spells, level 2-9' : 'Scroll: 3 Spells, level 2-7';
      out.push(s); break;
    }
  }
  return out;
}
function partyItems(level, classes, perm, align) {   // DMG p.175-176
  const lv = Math.min(level, 13); const o = [];
  const pc = p => pct() <= p;
  const T = (tbl, n) => tableItems(tbl, n, classes, perm, align).forEach(x => o.push(x));
  if (lv === 1) { if (pc(10)) T(TI, 1); }
  else if (lv === 2) { if (pc(20)) T(TI, 2); }
  else if (lv === 3) { if (pc(30)) T(TI, 2); if (pc(10)) T(TII, 1); }
  else if (lv === 4) { if (pc(40)) T(TI, 2); if (pc(20)) T(TII, 1); }
  else if (lv === 5) { if (pc(50)) T(TI, 2); if (pc(30)) T(TII, 1); }
  else if (lv === 6) { if (pc(60)) T(TI, 3); if (pc(40)) T(TII, 2); }
  else if (lv === 7) { if (pc(70)) T(TI, 3); if (pc(50)) T(TII, 2); if (pc(10)) T(TIII, 1); }
  else if (lv === 8) { if (pc(80)) T(TI, 3); if (pc(60)) T(TII, 2); if (pc(20)) T(TIII, 1); }
  else if (lv === 9) { if (pc(90)) T(TI, 3); if (pc(70)) T(TII, 2); if (pc(30)) T(TIII, 1); }
  else if (lv === 10) { T(TI, 3); if (pc(80)) T(TII, 2); if (pc(40)) T(TIII, 1); }
  else if (lv === 11) { T(TI, 3); if (pc(90)) T(TII, 2); if (pc(50)) T(TIII, 1); if (pc(10)) T(TIV, 1); }
  else if (lv === 12) { T(TI, 3); T(TII, 2); if (pc(60)) T(TIII, 1); if (pc(20)) T(TIV, 1); }
  else { T(TI, 3); T(TII, 2); T(TIII, 1); if (pc(60)) T(TIV, 1); }
  return o;
}
Q.partyItems = partyItems;

// ---- Character record builder ----
function buildRecord(o) { // o: {race, classes, levels, stats, male, align, xp, hp, kind}
  const classes = o.classes, levels = o.levels;
  const { kit, perm } = baseKit(classes, Math.max(...levels), o.race);
  const magic = o.magic || [];
  const has = re => magic.some(m => re.test(m));
  const drop = [];
  const bestMagic = Math.min(99, ...magic.map(m => { const pl = (m.match(/\+(\d+)/) || [0, 0])[1]; for (const [n, ac] of Object.entries(ARMOR_AC)) if (m.startsWith(n)) return ac - pl; return 99; }));
  const baseArm = Math.min(99, ...kit.map(k => ARMOR_AC[k] || 99));
  if (bestMagic < 99 && bestMagic <= baseArm) drop.push(/Mail$|^Studded Leather$|^Leather Armor$/);
  else if (bestMagic < 99) magic.splice(0, magic.length, ...magic.filter(m => !Object.keys(ARMOR_AC).some(n => m.startsWith(n))));
  if (has(/Shield \+\d/)) drop.push(/^Shield$/);
  if (has(/(Long Sword|Sword|Scimitar) \+|Sword, Defender|Sword of/)) drop.push(/^Long Sword$|^Scimitar$/);
  if (has(/^Dagger \+/)) drop.push(/^Dagger$/);
  if (has(/^(Mace|Mace \+)/) && has(/Mace \+/)) drop.push(/^Mace$/);
  const equipment = kit.filter(k => !drop.some(r => r.test(k))).concat(magic);
  const ac = calcAC(classes, Math.max(...levels), equipment, o.stats.dex);
  const spells = [];
  classes.forEach((c, i) => spellSection(c, levels[i], o.stats).forEach(s => spells.push(s)));
  const rec = {
    race: o.race, classes, levels, charClass: classes.join('/'), level: Math.max(...levels), levelText: levels.join('/'),
    stats: o.stats, statsText: Object.fromEntries(AB.map(a => [a, a === 'str' ? fmtStr(o.stats) : o.stats[a]])),
    gender: o.male ? 'Male' : 'Female', align: o.align, xp: o.xp, hp: o.hp, equipment, ac,
    spells: spells.length ? spells.join('<br>') : null, titles: classes.map((c, i) => title(c, levels[i])).join(' / '), perm,
  };
  return rec;
}
Q.buildRecord = buildRecord;
const thiefSkill = (lvl, race, dex) => { // PHB p.28 and dex adjustments p.12
  const T = [[30,25,20,15,10,10,85,0],[35,29,25,21,15,10,86,0],[40,33,30,27,20,15,87,0],[45,37,35,33,25,15,88,20],[50,42,40,40,31,20,90,25],[55,47,45,47,37,20,92,30],[60,52,50,55,43,25,94,35],[65,57,55,62,49,25,96,40],[70,62,60,70,56,30,98,45],[80,67,65,78,63,30,99,50],[90,72,70,86,70,35,99.1,55],[100,77,75,94,77,35,99.2,60],[105,82,80,99,85,40,99.3,65],[110,87,85,99,93,40,99.4,70],[115,92,90,99,99,50,99.5,75],[125,97,95,99,99,50,99.6,80],[125,99,99,99,99,55,99.7,80]];
  const R = { Dwarf: [0,10,15,0,0,0,-10,-5], Elf: [5,-5,0,5,10,5,0,0], Gnome: [0,5,10,5,5,10,-15,0], 'Half-elf': [10,0,0,0,5,0,0,0], Halfling: [5,5,5,10,15,5,-15,-5], 'Half-orc': [-5,5,5,0,0,5,5,-10], Human: [0,0,0,0,0,0,0,0] };
  const D = { 9: [-15,-10,-10,-20,-10], 10: [-10,-5,-10,-15,-5], 11: [-5,0,-5,-10,0], 12: [0,0,0,-5,0], 16: [0,5,0,0,0], 17: [5,10,0,5,5], 18: [10,15,5,10,10] };
  const row = T[Math.min(Math.max(lvl, 1), 17) - 1], r = R[race] || R.Human; const d = D[Math.min(dex, 18)] || [0,0,0,0,0];
  const v = row.map((x, i) => x + r[i] + (i < 5 ? d[i] : 0));
  return { 'Pick Pockets': v[0], 'Open Locks': v[1], 'Find/Remove Traps': v[2], 'Move Silently': v[3], 'Hide in Shadows': v[4], 'Hear Noise': v[5], 'Climb Walls': v[6], 'Read Languages': row[7] ? v[7] : 0 };
};
Q.thiefSkill = thiefSkill;
const skillText = (classes, levels, race, dex) => {
  let lvl = 0;
  classes.forEach((c, i) => { if (c === 'Thief') lvl = Math.max(lvl, levels[i]); else if (c === 'Assassin') lvl = Math.max(lvl, levels[i] - 2); else if (c === 'Monk') lvl = Math.max(lvl, levels[i]); });
  if (lvl < 1) return null;
  const s = thiefSkill(lvl, race, dex);
  return Object.entries(s).filter(([k, v]) => k !== 'Read Languages' || v > 0).map(([k, v]) => `${k} ${v}%`).join(', ');
};
Q.skillText = skillText;

// ---- Player character factory: DMG App. P ----
function combosFor(npc) {
  const out = [];
  RACES.forEach(r => {
    Object.keys(LIM[r]).forEach(c => { const v = LIM[r][c]; if (typeof v === 'string' && v[0] === 'n' && !npc) return; out.push({ race: r, classes: [c] }); });
    MULTI[r].forEach(m => out.push({ race: r, classes: m }));
  });
  return out;
}
Q.combosFor = combosFor;
function genPC(opts) {
  const method = opts.method || 1, alignSet = opts.alignSet;
  for (let attempt = 0; attempt < 300; attempt++) {
    const pool = rollAbilities(method); const male = roll(2) === 1;
    const cands = shuffle(combosFor(false));
    for (const cb of cands) {
      const al = alignsFor(cb.classes, alignSet); if (!al.length) continue;
      const raw = arrange(pool, cb.race, cb.classes); if (!raw) continue;
      const stats = finalizeStats(raw, cb.race, male, cb.classes.some(isFt));
      // PHB p.15: minimums are met after racial modifiers by construction; verify
      if (!AB.every(a => stats[a] >= RMIN[cb.race][idx(a)])) continue;
      if (!cb.classes.every(c => Object.entries(C[c].min).every(([a, v]) => stats[a] >= v))) continue;
      return finish(cb, stats, male, al, opts);
    }
  }
  throw new Error('could not build a legal character');
}
function finish(cb, stats, male, al, opts) {
  const n = cb.classes.length, L = opts.level;
  let share;
  if (n === 1) share = reach(cb.classes[0], L);
  else { const tgt = Math.ceil((L + n) / n); share = Math.max(...cb.classes.map(c => reach(c, Math.min(tgt, C[c].cap)))); }   // App. P: add 1 level per profession, divide, fractions count as whole
  const levels = cb.classes.map(c => Math.min(levelFromXP(c, share), limitFor(cb.race, c, stats), C[c].cap));
  const hp = rollHP(cb.classes, levels, stats.con);
  return { cb, stats, male, align: pick(al), levels, xp: share * n, hp };
}
function npcToRecord(p, magic) { return buildRecord({ race: p.cb.race, classes: p.cb.classes, levels: p.levels, stats: p.stats, male: p.male, align: p.align, xp: p.xp, hp: p.hp, magic }); }
function genPCParty(opts) {   // opts: count, levelRange [a,b] or number, method, alignMode 'compat'|'any'
  const set = opts.alignMode === 'any' ? null : pick(SETS);
  const members = [];
  for (let i = 0; i < opts.count; i++) {
    const level = Array.isArray(opts.levelRange) ? rr(opts.levelRange[0], opts.levelRange[1]) : opts.levelRange;
    const p = genPC({ method: opts.method, level, alignSet: set });
    members.push({ p, targetLevel: level });
  }
  const avg = members.reduce((a, m) => a + m.targetLevel, 0) / members.length;
  const recs = members.map(m => {
    const lv = m.p.levels; const perm = perms(m.p.cb.classes, m.p.cb.race);
    const magic = m.targetLevel >= 2 ? appPItems(m.p.cb.classes, lv, perm) : [];
    return { rec: npcToRecord(m.p, magic), targetLevel: m.targetLevel };
  });
  // misc items: party above 5th level (or 8th), 1-4 items, spread at random (App. P)
  const miscCount = avg > 5 ? roll(4) : 0; const misc = [];
  for (let i = 0; i < miscCount; i++) { const r = pick(recs).rec; const it = pick(MISC); r.equipment.push(it); misc.push(it); }
  recs.forEach(r => { r.rec.ac = calcAC(r.rec.classes, r.rec.level, r.rec.equipment, r.rec.stats.dex); r.rec.skills = skillText(r.rec.classes, r.rec.levels, r.rec.race, r.rec.stats.dex); });
  return { chars: recs.map(r => r.rec), alignSet: set, misc };
}
Object.assign(Q, { genPC, genPCParty });

// ---- NPCs: DMG p.11, 35, 100-102, 175 ----
const NPC_ADJ = { Cleric: { wis: 2 }, Fighter: { str: 2, con: 1 }, Ranger: { str: 2, con: 1 }, Paladin: { str: 2, con: 1 }, 'Magic-User': { int: 2, dex: 1 }, Thief: { dex: 2, int: 1 }, Assassin: { dex: 2, int: 1, str: 1 }, Druid: {}, Illusionist: {}, Monk: {} };
const NPC_RACE_ADJ = { Dwarf: { str: 1, con: 1, cha: -1 }, Elf: { int: 1, dex: 1 }, Gnome: { wis: 1, con: 1, cha: -1 }, Halfling: { dex: 1, con: 1 } };
function generalStats() { const s = {}; AB.forEach(a => { let t = 0; for (let i = 0; i < 3; i++) { let r = roll(6); if (r === 1) r = 3; if (r === 6) r = 4; t += r; } s[a] = t; }); return s; }   // DMG p.11 general characters
function specialStats(classes, race) {
  const germane = new Set(); classes.forEach(c => { Object.keys(C[c].min).forEach(a => germane.add(a)); C[c].prime.forEach(a => germane.add(a)); });
  const s = {}; AB.forEach(a => { let t = 0; for (let i = 0; i < 3; i++) { let r = roll(6); if (germane.has(a) && r < 6) r++; t += r; } s[a] = t; });   // DMG p.11 special characters: +1 to each die under 6 in germane abilities
  classes.forEach(c => Object.entries(NPC_ADJ[c] || {}).forEach(([a, v]) => s[a] += v));      // DMG p.100
  Object.entries(NPC_RACE_ADJ[race] || {}).forEach(([a, v]) => s[a] += v);
  classes.forEach(c => Object.entries(C[c].min).forEach(([a, v]) => { s[a] = Math.max(s[a], v); }));   // DMG p.100: minimum scores
  if (classes.length > 1 && race === 'Half-elf' && classes.includes('Cleric')) s.wis = Math.max(s.wis, 13);
  return s;
}
function npcCombo(rule) {  // class by DMG p.35 distribution; race by DMG p.175 (20% non-human)
  const r = pct(); let cls;
  if (r <= 20) cls = roll(6) === 1 ? 'Druid' : 'Cleric'; else if (r <= 64) { const d = roll(10); cls = d === 1 ? 'Ranger' : d === 2 ? 'Paladin' : 'Fighter'; } else if (r <= 84) cls = roll(6) === 1 ? 'Illusionist' : 'Magic-User'; else if (r <= 99) cls = roll(6) === 1 ? 'Assassin' : 'Thief'; else cls = 'Monk';
  return raceFor(cls, true);
}
function raceFor(cls, npc) {
  if (pct() > 20) { return { race: 'Human', classes: [cls] }; }
  const x = pct(); const race = x <= 25 ? 'Dwarf' : x <= 50 ? 'Elf' : x <= 60 ? 'Gnome' : x <= 85 ? 'Half-elf' : x <= 95 ? 'Halfling' : 'Half-orc';
  const mc = { Dwarf: 15, Elf: 85, Gnome: 25, 'Half-elf': 85, Halfling: 10, 'Half-orc': 50 }[race];
  const legalSingles = Object.keys(LIM[race]).filter(c => npc || typeof LIM[race][c] !== 'string' || LIM[race][c][0] !== 'n');
  const closest = { Paladin: 'Fighter', Ranger: 'Fighter', Monk: 'Fighter', Assassin: 'Thief', Illusionist: 'Magic-User', Druid: 'Cleric' };
  if (pct() <= mc && MULTI[race].length) {
    let cs = MULTI[race].filter(m => m.includes(cls)); if (!cs.length) cs = MULTI[race].filter(m => m.includes(closest[cls])); if (!cs.length) cs = MULTI[race];
    return { race, classes: pick(cs) };
  }
  let c = cls; if (!legalSingles.includes(c)) c = legalSingles.includes(closest[c]) ? closest[c] : 'Fighter';
  return { race, classes: [c] };
}
function multiLevels(L, classes, race, stats) {   // DMG p.176: add n (2 or 3), divide, drop fractions below one-half; excess over a limit goes half to the others
  const n = classes.length; if (n === 1) return [Math.min(L, limitFor(race, classes[0], stats), C[classes[0]].cap)];
  const base = Math.floor((L + n) / n + 0.5); let lv = classes.map(() => base);
  const cap = classes.map(c => Math.min(limitFor(race, c, stats), C[c].cap));
  for (let pass = 0; pass < 3; pass++) {
    let excess = 0; lv = lv.map((l, i) => { if (l > cap[i]) { excess += l - cap[i]; return cap[i]; } return l; });
    const free = lv.map((l, i) => l < cap[i] ? i : -1).filter(i => i >= 0); if (!excess || !free.length) break;
    let give = Math.ceil(excess / 2); let k = 0; while (give > 0) { const i = free[k++ % free.length]; if (lv[i] < cap[i]) lv[i]++; give--; if (k > 50) break; }
  }
  return lv.map(l => Math.max(1, l));
}
Q.multiLevels = multiLevels;
const rollAlign = () => ALIGNS[[0, 3, 6, 7, 8, 5, 2, 1, 4, 4][roll(10) - 1]];   // DMG p.100 d10: LG LN LE NE CE CN CG NG N N
function npcAlign(classes, set) { const al = alignsFor(classes, set); for (let i = 0; i < 40; i++) { const a = rollAlign(); if (al.includes(a)) return a; } return pick(al); }
function pickAlignSet(classes, set) { return alignsFor(classes, set).length ? set : null; }
function genSpecialNPC(level, opts) {
  opts = opts || {};
  for (let attempt = 0; attempt < 200; attempt++) {
    const cb = npcCombo(); const male = roll(2) === 1;
    if (!alignsFor(cb.classes, opts.alignSet).length) continue;
    const raw = specialStats(cb.classes, cb.race);
    const st = finalizeStats(raw, cb.race, male, cb.classes.some(isFt));
    if (!cb.classes.every(c => Object.entries(C[c].min).every(([a, v]) => st[a] >= v))) continue;   // a race clamp pushed below a class minimum: try again
    const levels = multiLevels(level, cb.classes, cb.race, st);
    const hp = rollHP(cb.classes, levels, st.con);
    const xp = cb.classes.length * Math.max(...cb.classes.map((c, i) => reach(c, levels[i])));
    return { cb, stats: st, male, align: npcAlign(cb.classes, opts.alignSet), levels, xp, hp };
  }
  throw new Error('npc failed');
}
Object.assign(Q, { genSpecialNPC, npcToRecord, specialStats, generalStats, rollAlign });

const T10 = { age: ['young','youthful','youthful','mature','mature','mature','mature','middle-aged','old','ancient'], app: ['dirty','clean','unkempt','immaculate','rough','ragged','dandyish','foppish','non-descript','imposing'],
  poss: ['none','scant','scant','average','average','average','average','above average','exceptional','superabundant'],
  gt: ['optimist','pessimist','hedonist','altruist','helpful/kindly','careless','capricious/mischievous','sober','curious/inquisitive','moody','trusting','suspicious/cautious','precise/exacting','perceptive','opinionated/contrary','violent/warlike','studious','foul/barbaric','cruel/callous','practical joker/prankster','servile/obsequious','fanatical/obsessive','malevolent','loquacious'],
  disp: ['cheerful','morose','compassionate/sensitive','unfeeling/insensitive','humble','proud/haughty','even tempered','hot tempered','easy going','harsh'], intel: ['dull','average','average','active','active','dreaming','ponderous','anti-intellectual','scheming','brilliant'],
  nature: ['soft-hearted','forgiving','hard-hearted','unforgiving','jealous','vengeful'], mat: ['aesthetic','intellectualist','average','covetous','greedy','avaricious'],
  hon: ['scrupulous','very honorable','truthful','average','average','average','liar','deceitful'], brav: ['normal','normal','normal','foolhardy','brave','fearless','cowardly','craven'], en: ['slothful','lazy','normal','normal','normal','energetic','energetic','driven'], thr: ['miserly','mean','thrifty','average','average','spendthrift','spendthrift','wastrel'],
  mor: ['ascetic','virtuous','normal','normal','lusty','lusty','lustful','immoral','amoral','perverted','sadistic','depraved'], pie: ['saintly','martyr/zealot','pious','reverent','average','average','average','average','impious','irreverent','iconoclastic','irreligious'],
  int: ['religion','legends','history','nature','horticulture','husbandry','exotic animals','hunting','fishing','handicrafts','athletics','politics','wines & spirits','foods & preparation','gambling','drugs','collector','collector','collector','collector','community service','altruism','none','none'],
  col: ['knives & daggers','swords','weapons','shields & weapons','armor','books & scrolls','minerals & gems','ornaments & jewelry','coins & tokens','trophies & skins','porcelain, china & crystal','artwork'],
  pers: [['modest','forceful','retiring'],['egoist/arrogant','overbearing','taciturn'],['friendly','friendly','friendly'],['aloof','blustering','aloof'],['hostile','antagonistic','hostile'],['well-spoken','rude','rude'],['diplomatic','rash','courteous'],['abrasive','diplomatic','solitary/secretive']] };
Q.T10 = T10;
function npcTraits() {   // DMG p.100-101
  let san = roll(10); const sanOf = n => n === 1 ? 'very stable' : n <= 6 ? 'normal' : n === 7 ? 'neurotic' : n === 8 ? 'unstable' : n === 9 ? 'insane' : 'maniacal';
  let sanity = sanOf(san); if (san >= 9) sanity = sanOf(roll(10));   // DMG p.100: roll again, the second roll stands
  const twice = (arr, bad) => { const x = pick(arr); return bad.includes(x) ? pick(arr) : x; };   // DMG p.101: roll again, the second roll stands
  const tend = new Set(); while (tend.size < 3) tend.add(pick(T10.gt));
  const pr = roll(8), col = pr <= 5 ? 0 : pr <= 7 ? 1 : 2;
  let interest = pick(T10.int); if (interest === 'collector') interest += ' (' + pick(T10.col) + ')';
  return { age: pick(T10.age), appearance: pick(T10.app), possessions: pick(T10.poss), sanity, tendencies: [...tend].join(', '), personality: T10.pers[roll(8) - 1][col], disposition: pick(T10.disp), intellect: pick(T10.intel), nature: pick(T10.nature), materialism: pick(T10.mat),
    honesty: pick(T10.hon), bravery: pick(T10.brav), energy: pick(T10.en), thrift: pick(T10.thr), morals: twice(T10.mor, ['perverted', 'sadistic', 'depraved']), piety: pick(T10.pie), interest };
}
Q.npcTraits = npcTraits;
function reaction() { const r = pct(); return r <= 5 ? 'Violently hostile, immediate attack' : r <= 25 ? 'Hostile, immediate action' : r <= 45 ? 'Uncertain but 55% prone toward negative' : r <= 55 ? 'Neutral, uninterested, uncertain' : r <= 75 ? 'Uncertain but 55% prone toward positive' : r <= 95 ? 'Friendly, immediate action' : 'Enthusiastically friendly, immediate acceptance'; }
Q.reaction = reaction;
const HW = { // base, then [minus, plus] ranges: male height, male weight, female height, female weight
  Dwarf: { M: [48, '1-4', '1-6', 150, '2-16', '2-24'], F: [46, '1-4', '1-4', 120, '2-16', '2-20'] }, Elf: { M: [60, '1-4', '1-6', 100, '1-10', '1-20'], F: [54, '1-4', '1-6', 80, '1-10', '2-12'] },
  Gnome: { M: [42, '1-3', '1-3', 80, '2-8', '2-12'], F: [39, '1-3', '1-3', 75, '1-8', '1-8'] }, 'Half-elf': { M: [66, '1-6', '1-6', 130, '1-20', '1-20'], F: [62, '1-6', '1-6', 100, '1-12', '2-16'] },
  Halfling: { M: [36, '1-3', '1-6', 60, '2-8', '2-12'], F: [33, '1-3', '1-3', 50, '2-8', '2-8'] }, 'Half-orc': { M: [66, '1-4', '1-4', 150, '2-16', '4-40'], F: [62, '1-3', '1-3', 120, '3-18', '4-32'] },
  Human: { M: [72, '1-12', '1-12', 175, '3-36', '5-60'], F: [66, '1-6', '1-8', 130, '3-30', '4-48'] } };
const HWP = { Dwarf: [15, 80, 20, 65], Elf: [10, 80, 15, 90], Gnome: [20, 85, 20, 75], 'Half-elf': [35, 90, 20, 85], Halfling: [10, 90, 10, 50], 'Half-orc': [45, 75, 30, 55], Human: [20, 80, 25, 75] };
function heightWeight(race, male) {   // DMG p.102
  const [hb, hm, hp2, wb, wm, wp] = HW[race][male ? 'M' : 'F']; const [hu, ha, wu, wa] = HWP[race];
  let r = pct(), h = hb;
  if (r <= hu) h = hb - rollRange(hm); else if (r > ha) h = hb + rollRange(hp2);
  else { const p = pct(); const half = hb < 60 ? roll(7) : roll(9); if (p <= 30) h = hb - half / 2; else if (p >= 71) h = hb + half / 2; }
  r = pct(); let w = wb;
  if (r <= wu) w = wb - rollRange(wm); else if (r > wa) w = wb + rollRange(wp);
  else { const p = pct(); const d = wb <= 100 ? roll(4) : roll(8); if (p <= 30) w = wb - d; else if (p >= 71) w = wb + d; }
  const ft = Math.floor(h / 12), inch = h - ft * 12;
  return `${ft}'${inch}" / ${Math.max(w, 10)} lbs`;
}
Q.heightWeight = heightWeight;

// ---- Rival party: DMG p.175-176 ----
const SUB = [[17,'Cleric'],[20,'Druid'],[60,'Fighter'],[62,'Paladin'],[65,'Ranger'],[86,'Magic-User'],[88,'Illusionist'],[98,'Thief'],[99,'Assassin'],[100,'Monk']];
const MAXPER = { Cleric: 3, Druid: 2, Fighter: 5, Paladin: 2, Ranger: 2, 'Magic-User': 3, Illusionist: 1, Thief: 4, Assassin: 2, Monk: 1 };
Q.SUB = SUB; Q.MAXPER = MAXPER;
function rivalLevel(D) {   // DMG p.175
  if (D <= 4) return D;
  let l = nd(1, 6) + 6; if (l > D) l -= 1; else if (l < D) l += 1;
  return Math.min(l, D >= 16 ? 13 : 12);
}
function henchLevel(m) { const base = Math.floor(m / 3 + 0.5); const bonus = m > 8 ? Math.floor(m / 3) : 0; return Math.max(1, base + bonus); }
Object.assign(Q, { rivalLevel, henchLevel });
function genRival(D) {
  const set = pick(SETS); const n = roll(4) + 1; const counts = {}; const core = [];
  let guard = 0;
  while (core.length < n && guard++ < 500) {
    const r = pct(); const cls = SUB[SUB.findIndex(x => r <= x[0])][1];
    if ((counts[cls] || 0) >= MAXPER[cls]) continue;
    if (!ALLOW[cls].some(a => set.includes(a))) continue;      // contradictory with the party alignment (e.g. paladin with assassin): ignore
    const cb = raceFor(cls, true);
    if (!alignsFor(cb.classes, set).length) continue;
    counts[cls] = (counts[cls] || 0) + 1;
    core.push({ cb, level: rivalLevel(D) });
  }
  const mk = (cb, level, kind) => {
    for (let t = 0; t < 100; t++) {
      const male = roll(2) === 1; const raw = specialStats(cb.classes, cb.race); const st = finalizeStats(raw, cb.race, male, cb.classes.some(isFt));
      if (!cb.classes.every(c => Object.entries(C[c].min).every(([a, v]) => st[a] >= v))) continue;
      const levels = multiLevels(level, cb.classes, cb.race, st); const hp = rollHP(cb.classes, levels, st.con);
      const al = alignsFor(cb.classes, set); const align = pick(al);
      const perm = perms(cb.classes, cb.race); const magic = partyItems(Math.max(...levels), cb.classes, perm, align);
      const rec = buildRecord({ race: cb.race, classes: cb.classes, levels, stats: st, male, align, xp: cb.classes.length * Math.max(...cb.classes.map((c, i) => reach(c, levels[i]))), hp, magic });
      rec.kind = kind; rec.skills = skillText(rec.classes, rec.levels, rec.race, rec.stats.dex); return rec;
    }
    return null;
  };
  const chars = core.map(c => mk(c.cb, c.level, 'core')).filter(Boolean);
  const followers = []; const nf = 9 - chars.length;
  const eligible = chars.filter(c => !(c.classes.includes('Ranger') && c.levels[c.classes.indexOf('Ranger')] < 8));   // rangers under 8th level cannot have henchmen (PHB p.24)
  for (let i = 0; i < nf; i++) {
    if (D <= 3) {
      const full = roll(2) === 1;
      const equip = full ? ['Scale Mail', 'Shield', 'Spear', 'Long Sword', 'Backpack'] : ['Studded Leather', 'Light Crossbow', 'Dagger'];
      followers.push({ kind: 'man-at-arms', master: chars[i % chars.length], hp: rr(4, 7), equipment: equip, ac: full ? 5 : 7, race: 'Human', gender: roll(2) === 1 ? 'Male' : 'Female', align: pick(set) });
    } else {
      let made = null;
      for (let t = 0; t < 60 && !made; t++) {
        const master = eligible[i % eligible.length]; if (!master) break;
        const r = pct(); const cls = SUB[SUB.findIndex(x => r <= x[0])][1];
        if (cls === 'Paladin' && !master.classes.includes('Fighter') && !master.classes.includes('Paladin') && !master.classes.includes('Cleric')) continue;
        if (!ALLOW[cls].some(a => set.includes(a))) continue;
        const cb = raceFor(cls, true); if (!alignsFor(cb.classes, set).length) continue;
        if (cb.classes.includes('Ranger')) continue;      // a henchman ranger would be under 8th level of a master of 8-12: skip (DMG p.175 "ranger of less than 8th level")
        made = mk(cb, henchLevel(Math.max(...master.levels)), 'henchman'); if (made) made.master = master;
      }
      if (made) followers.push(made);
    }
  }
  return { align: set, chars, followers, D };
}
Q.genRival = genRival;

// ---- Mercenaries: DMG p.29-31 ----
const MERC = {
  'archer (longbow)':      { pay: 4, q: [[1,4],[2,5],[3,12],[5,20]] }, 'archer (shortbow)': { pay: 2, q: [[1,6],[2,8],[4,16],[5,30]] }, artillerist: { pay: 5, q: [[1,1],[2,2],[3,3],[4,4]] },
  crossbowman: { pay: 2, q: [[1,6],[2,8],[5,20],[8,48]] }, 'footman, heavy': { pay: 2, q: [[1,6],[2,12],[5,30],[10,60]] }, 'footman, light': { pay: 1, q: [[1,4],[2,8],[3,12],[5,20]] }, 'footman, pikeman': { pay: 3, q: [[2,5],[3,12],[5,20],[10,40]] },
  'hobilar, heavy': { pay: 3, q: [[1,3],[2,5],[3,12],[4,16]] }, 'hobilar, light': { pay: 2, q: [[1,4],[2,8],[3,12],[5,20]] }, 'horseman, archer': { pay: 6, q: [[1,2],[1,6],[2,8],[3,12]] }, 'horseman, crossbowman': { pay: 4, q: [[1,4],[2,8],[3,12],[5,20]] },
  'horseman, heavy': { pay: 6, q: [[1,3],[2,5],[3,12],[4,16]] }, 'horseman, light': { pay: 3, q: [[1,4],[2,8],[4,16],[5,30]] }, 'horseman, medium': { pay: 4, q: [[1,3],[2,5],[3,12],[4,16]] },
  'sapper/miner': { pay: 4, q: [[1,2],[1,4],[2,5],[2,8]] }, slinger: { pay: 3, q: [[1,3],[1,6],[2,8],[3,12]] } };
const MERC_D = [[4,'archer (longbow)'],[10,'archer (shortbow)'],[12,'artillerist'],[13,'_captain'],[20,'crossbowman'],[30,'footman, heavy'],[37,'footman, light'],[40,'footman, pikeman'],[41,'_lieutenant'],[44,'hobilar, heavy'],[48,'hobilar, light'],[49,'horseman, archer'],[53,'horseman, crossbowman'],[58,'horseman, heavy'],[70,'horseman, light'],[78,'horseman, medium'],[80,'sapper/miner'],[85,'_serjeant'],[88,'slinger'],[90,'_anymissile'],[96,'_anyfoot'],[99,'_anyhorse'],[100,'_anyspecial']];
const MERC_ANY = { _anymissile: ['archer (longbow)','archer (shortbow)','crossbowman','slinger'], _anyfoot: ['footman, heavy','footman, light','footman, pikeman'], _anyhorse: ['horseman, archer','horseman, crossbowman','horseman, heavy','horseman, light','horseman, medium'] };
Object.assign(Q, { MERC, MERC_D });
function mercType(r) {
  let t = MERC_D[MERC_D.findIndex(x => r <= x[0])][1];
  if (MERC_ANY[t]) t = pick(MERC_ANY[t]);
  else if (t === '_anyspecial') t = pick(['artillerist','sapper/miner','_captain','_lieutenant','_serjeant']);
  return t;
}
const captainLevel = () => { const d = roll(10); return d <= 4 ? 5 : d <= 7 ? 6 : d <= 9 ? 7 : 8; };
const lieutLevel = () => roll(10) <= 7 ? 2 : 3;
function mercTier(d) { return d <= 4 ? 0 : d <= 7 ? 1 : d <= 9 ? 2 : 3; }
function mercUnit(type, tier) {
  const m = MERC[type]; const [a, b] = m.q[tier]; const count = rr(a, b);
  let sgts = 0; if (count > 5) { const mn = Math.max(1, Math.floor(count / 10)), mx = Math.max(mn, Math.floor(count / 5)); sgts = rr(mn, mx); }   // DMG p.30-31: 1 per 10 minimum, 1 per 5 maximum; serjeants are among those encountered
  const troops = count - sgts; const sgtPay = m.pay * 10;
  const lt = (tier === 2 && count > 10) || (tier === 3 && count > 10) ? lieutLevel() : 0;
  const cpt = tier === 3 && count > 20 ? captainLevel() : 0;
  const cost = troops * m.pay + sgts * sgtPay + lt * 100 + cpt * 100;
  return { type, tier, count, troops, sgts, sgtPay, lt, cpt, pay: m.pay, cost, hpMin: count * 4, hpMax: count * 7 };
}
Object.assign(Q, { mercType, mercTier, mercUnit, captainLevel, lieutLevel });

root.QPRules = Q;
if (typeof module !== 'undefined') module.exports = Q;
})(typeof globalThis !== 'undefined' ? globalThis : this);
