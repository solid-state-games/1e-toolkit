// 1e Toolkit checks. Run: node test/toolkit.test.js --check   (exit 0 = pass)
// Loads lib/*.js, sheet_rules.js, gm_render.js and gm_combat.js in one vm context in the order index.html loads them.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const sandbox = { console: { log() {}, warn() {}, error() { console.error.apply(console, arguments); } }, Intl, setTimeout };
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
const ORDER = ['lib/rules_1e.js', 'lib/combat_rules.js', 'lib/encounterTables.js', 'lib/dungeonTables.js', 'lib/monsters.js', 'lib/treasure_engine.js', 'lib/morale.js', 'lib/reactions.js',
    'lib/troopBuilders.js', 'lib/stronghold.js', 'lib/mounts.js', 'lib/pursuit.js', 'lib/encounter_engine.js', 'lib/quickparty_rules.js', 'js/sheet_rules.js', 'js/sheet_simple.js', 'js/gm_render.js', 'js/gm_combat.js'];
ORDER.forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }));
const G = expr => vm.runInContext(expr, ctx);
const Rules = sandbox.Rules, SR = sandbox.SheetRules;

let fails = 0, total = 0;
function check(name, ok, detail) { total++; if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  (' + detail + ')' : '')); }
const rng = Rules.makeRng(20261112);
const pick = a => a[Math.floor(rng() * a.length)];
const BAD = /undefined|NaN|\[object|null/;

// ---- random legal characters from the rules_1e helpers
function randomSheet(maxed) {
    const race = pick(Object.keys(Rules.RACES).filter(r => Rules.RACES[r].multi !== undefined));
    for (let tries = 0; tries < 200; tries++) {
        const raw = {}; Rules.ABILITIES.forEach(a => { raw[a] = Rules.dice(3, 6, rng) + (maxed ? 3 : 0); });
        const sex = rng() < 0.5 ? 'm' : 'f', ar = Rules.applyRace(raw, race, sex);
        const opts = Rules.classesFor(race, ar.scores);
        if (!opts.length) continue;
        const classes = maxed ? opts.reduce((a, b) => b.length > a.length ? b : a) : pick(opts);
        const s = SR.blank();
        s.race = race; s.sex = sex; s.cl = classes.slice();
        s.lv = classes.map(c => { const lim = Rules.levelLimit({ race, scores: ar.scores, classes }, c); const cap = Math.min(isFinite(lim) && lim > 0 ? lim : 14, 14); return maxed ? cap : 1 + Math.floor(rng() * cap); });
        s.sc = Rules.ABILITIES.map(a => ar.scores[a]);
        if (ar.scores.str === 18) s.ex = 1 + Math.floor(rng() * 100);
        const al = Rules.alignmentsFor(classes); s.al = al.length ? pick(al) : 'N';
        s.nm = 'Test ' + Math.floor(rng() * 1e6); s.hp = 30 + Math.floor(rng() * 40); s.hm = s.hp + 5; s.xp = Math.floor(rng() * 500000);
        const gear = Rules.EQUIPMENT.weapons.concat(Rules.EQUIPMENT.armor, Rules.EQUIPMENT.gear);
        const n = maxed ? SR.LIM.gear : 5 + Math.floor(rng() * 25);
        for (let i = 0; i < n; i++) { const g = maxed ? gear[i % gear.length] : pick(gear); s.inv.push(maxed && i >= gear.length ? ['Magic item number ' + i + ' with a long name', 1 + (i % 3), 2.5, 9] : [g.n, 1 + Math.floor(rng() * 3)]); }
        s.co = [Math.floor(rng() * 50), Math.floor(rng() * 5000), 0, Math.floor(rng() * 500), Math.floor(rng() * 500)];
        s.pf = SR.proficiencyChoices(s).slice(0, maxed ? SR.LIM.profs : 4);
        if (maxed) { s.nt = 'n'.repeat(SR.LIM.text); s.hl = Array(14).fill(10); s.lg = Array(SR.LIM.langs).fill('Ogrish and more'); s.ij = Array(SR.LIM.injuries).fill(['Left arm', '12 Brewmonth', 'Axe blow 40 characters long x'.padEnd(80, 'x')]);
            s.d = { bd: 'b'.repeat(40), ht: 'h'.repeat(40), wt: 'w'.repeat(40), hr: 'h'.repeat(40), ey: 'e'.repeat(40), sx: 's'.repeat(40), st: 's'.repeat(40), mk: 'm'.repeat(160), mn: 'n'.repeat(160), ap: 'a'.repeat(160) };
            s.dt = 'd'.repeat(80); s.og = 'o'.repeat(80); s.rg = 'r'.repeat(80); s.cmp = 'c'.repeat(60); s.pl = 'p'.repeat(60); s.nm = 'N'.repeat(60);
            s.sj = Array(6).fill(['+1', 'c'.repeat(50)]); s.cj = Array(6).fill(['+1', 'c'.repeat(50)]); s.psi = { a: 'x'.repeat(80), m: 'x'.repeat(80), d: 'x'.repeat(80), mj: 'x'.repeat(80), mi: 'x'.repeat(80) };
            s.sk = {}; s.sm = {}; let left = SR.LIM.known;
            classes.forEach(c => { const k = SR.SPELL_KEY[c]; if (!k) return; s.sk[c] = []; s.sm[c] = []; for (let l = 0; l < 9 && left > 0; l++) { const list = Array(Math.min(15, left)).fill('Magic Missile of Sevenfold Doom'.slice(0, 40)); left -= list.length; s.sk[c].push(list); s.sm[c].push(list.slice(0, 5)); } });
            s.ta = [99, 99, 99, 99, 99, 99, 99, 99];
        }
        return s;
    }
    throw new Error('no legal character for ' + race);
}

// ---- (a) round trip and size
let maxSize = 0, rt = 0;
for (let i = 0; i < 500; i++) {
    const s = SR.sanitize(randomSheet(false)), text = SR.pack(s), back = JSON.parse(text);
    const same = JSON.stringify(SR.sanitize(back)) === JSON.stringify(s);
    const imp = SR.parseImport(SR.exportText(s));
    if (!same || JSON.stringify(imp) !== JSON.stringify(s)) { rt++; }
    maxSize = Math.max(maxSize, SR.bytes(text));
}
check('(a) 500 random legal characters round-trip (store and export/import)', rt === 0, rt + ' failures');
check('(a) 500 random characters under 16 kB', maxSize < SR.MAX_BYTES, 'largest ' + maxSize + ' B');
let maxChar = SR.sanitize(randomSheet(true)), mb = SR.bytes(SR.pack(maxChar));
check('(a) maximal character (every field at its cap, 120 gear lines, spells, 3000 char notes) under 16 kB', mb < SR.MAX_BYTES, mb + ' B');
check('(a) maximal character round-trips', JSON.stringify(SR.sanitize(JSON.parse(SR.pack(maxChar)))) === JSON.stringify(maxChar));
const msg = []; try { SR.parseImport('{"x":1}'); } catch (e) { msg.push(e.message); } try { SR.parseImport('nope'); } catch (e) { msg.push(e.message); }
check('(a) bad import is refused with a message', msg.length === 2 && msg.every(Boolean));
check('(a) hostile input sanitises (no throw, bounded)', (function () { try { const s = SR.sanitize({ cl: ['Wizard', 'Fighter'], sc: ['x', 99, -4], lv: [999], race: 'Orc', inv: [['x'.repeat(500), 1e9]], nt: 'z'.repeat(1e5) }); return SR.bytes(SR.pack(s)) < SR.MAX_BYTES && s.race === 'Human' && s.cl.length === 1; } catch (e) { return false; } })());

// ---- (b) derived figures equal derive()
let bad = [];
for (let i = 0; i < 20; i++) {
    const s = SR.sanitize(randomSheet(i % 5 === 0)), v = SR.compute(s), d = Rules.derive(SR.toChar(s));
    const same = JSON.stringify(v.d) === JSON.stringify(d) && v.d.abilities.str.hit === d.abilities.str.hit;
    const atkOk = [10, 5, 0, -5, -10].every(ac => v.toHitRows.melee[ac] === d.attack[ac] - d.abilities.str.hit && v.toHitRows.missile[ac] === d.attack[ac] - d.abilities.dex.reaction);
    const mvOk = v.movement.move === d.movement.move && v.movement.gp === d.movement.gp;
    const spOk = JSON.stringify(Object.keys(d.spellsPerDay)) === JSON.stringify(Object.keys(v.d.spellsPerDay));
    if (!same || !atkOk || !mvOk || !spOk || v.errors.length) bad.push(i);
}
check('(b) sheet figures equal derive() for 20 spot characters', bad.length === 0, bad.join(','));
const fighter = SR.sanitize(Object.assign(SR.blank(), { cl: ['Fighter'], lv: [7], sc: [18, 10, 10, 16, 15, 10], ex: 60, pf: ['Sword, Long & scabbard'] }));
const fv = SR.compute(fighter);
check('(b) known fighter: Str 18/60 hit +2 dam +3, 3/2 attacks, weapon row found', fv.d.abilities.str.hit === 2 && fv.d.abilities.str.dmg === 3 && fv.attacksPerRound === '3/2' && fv.weapons.length === 1 && fv.weapons[0].adj.length === 9,
    JSON.stringify([fv.d.abilities.str.hit, fv.d.abilities.str.dmg, fv.attacksPerRound, fv.weapons.length]));
const allMatched = Rules.EQUIPMENT.weapons.filter(w => !w.ammo && w.kind !== 'ammo').filter(w => SR.combatRows(w.n).length === 0).map(w => w.n);
check('(b) every non-ammunition weapon in rules_1e maps to a combat table row', allMatched.length === 0, allMatched.join('; '));

// ---- (c) GM helpers 1000 times, no NaN/undefined in rendered text
const rollDay = G('rollDay'), dayCardsHtml = G('dayCardsHtml'), encounterToText = G('encounterToText'), setRng = G('setRng'), LAND = G('LAND_TERRAINS'), TE = sandbox.TreasureEngine;
setRng(Rules.makeRng(77));
let encBad = [], encN = 0, modes = [[], ['sylvan'], ['arctic'], ['tropical'], ['freshWater'], ['cityDay'], ['airborne']];
for (let i = 0; i < 1000; i++) {
    const modeSet = modes[i % modes.length], settings = { modes: modeSet, density: ['high', 'medium', 'low'][i % 3], bellCurve: i % 2 === 0 };
    const terrains = modeSet.length ? G('modeTerrains')(modeSet[0]) : LAND;
    if (!terrains.length) continue;
    const terrain = terrains[i % terrains.length];
    let day; try { day = rollDay(G('mergeSettings')(settings), terrain); } catch (e) { encBad.push('throw ' + e.message); continue; }
    const html = dayCardsHtml(day, terrain, settings);
    day.periods.forEach(p => { if (p.encounter) { encN++; const t = encounterToText(p.encounter); if (/NaN|undefined|\[object/.test(t)) encBad.push(t.slice(0, 120)); } });
    if (/NaN|undefined|\[object/.test(html)) encBad.push(html.replace(/<[^>]+>/g, ' ').match(/.{0,40}(NaN|undefined|\[object).{0,40}/)[0]);
}
check('(c) 1000 encounter days render without NaN/undefined', encBad.length === 0, encN + ' encounters; ' + encBad.slice(0, 2).join(' | '));
const treasureHtml = G('treasureViewHtml'), caps = G('treasureCaption'); let trBad = [];
const letters = Object.keys(TE.TYPES);
for (let i = 0; i < 1000; i++) {
    let res;
    if (i % 4 === 3) res = TE.generateHoard(['A', 'B', 'C'][i % 3]);
    else res = TE.generate({ types: [letters[i % letters.length]], individuals: 1 + (i % 4), multiplier: 1 + (i % 3), log: false });
    [true, false].forEach(dm => { const h = treasureHtml(res, dm) + caps(res); if (/NaN|undefined|\[object/.test(h)) trBad.push(h.replace(/<[^>]+>/g, ' ').match(/.{0,40}(NaN|undefined|\[object).{0,40}/)[0]); });
}
check('(c) 1000 treasure rolls (types A-Z, hoards) render in DM and player view', trBad.length === 0, trBad.slice(0, 2).join(' | '));
const C = G('GMCombat'); let cBad = [];
const CL = G('CLASSES'), WP = G('WEAPONS');
for (let i = 0; i < 1000; i++) {
    const cls = Object.keys(CL)[i % Object.keys(CL).length], lvs = C.levelChoices(cls), lv = lvs[i % lvs.length].v;
    const t = C.toHitText({ cls, lv: Number(lv), wi: i % WP.length, ac: 10 - (i % 21), armorIdx: i % 11, shield: i % 2 === 0, bonus: i % 3, penalty: -(i % 2), sit: i % 7, range: 'SML'[i % 3], size: i % 2 ? 'L' : 'SM', dmgBonus: i % 4 });
    if (BAD.test(t.replace(/n\/a|null/g, ''))) cBad.push(t);
    const row = C.toHitRow(cls, Number(lv)); if (row.some(r => typeof r.need !== 'number' || isNaN(r.need))) cBad.push('row ' + cls + lv);
    const mode = 'PGO'[i % 3], p = Object.assign(C.defaultP(), { atkSTR: 8 + (i % 11), atkPct: i % 101, atkDEX: 9 + (i % 9), oppAC: i % 11 - 2, atkAC: i % 11 });
    const w = C.weaponless(mode, p, Rules.makeRng(i)); if (BAD.test(w.text)) cBad.push(w.text);
}
check('(c) 1000 combat lookups and weaponless rolls (pummel, grapple, overbear) clean', cBad.length === 0, cBad.slice(0, 2).join(' | '));

// ---- (d) manifest
const mf = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const need = ['name', 'version', 'manifest_version', 'action'];
const mfOk = need.every(k => mf[k] !== undefined) && mf.manifest_version === 1 && mf.action.title && mf.action.icon && mf.action.popover &&
    /^\d+\.\d+\.\d+$/.test(mf.version) && mf.background_url && fs.existsSync(path.join(root, mf.action.popover.replace(/^\//, ''))) && fs.existsSync(path.join(root, mf.background_url.replace(/^\//, ''))) && fs.existsSync(path.join(root, mf.icon.replace(/^\//, '')));
check('(d) manifest.json has the fields the OBR docs require and its files exist', !!mfOk);
check('(d) background.js uses the same metadata namespace as SheetRules', fs.readFileSync(path.join(root, 'js/background.js'), 'utf8').includes('"' + SR.NS + '"'));
check('(d) vendored SDK and its licence are present', fs.existsSync(path.join(root, 'vendor/obr-sdk.js')) && /MIT/.test(fs.readFileSync(path.join(root, 'vendor/OBR-SDK-LICENSE.txt'), 'utf8')) && /3\.1\.0/.test(fs.readFileSync(path.join(root, 'vendor/README.md'), 'utf8')));
const credit = 'Unofficial fan work, built from the AD&D 1st Edition Dungeon Masters Guide, Players Handbook and Monster Manual. Not affiliated with or endorsed by the rights holders.';
const creditOk = ['index.html', 'guide.html', 'SETUP.md', 'README.md'].every(f => fs.readFileSync(path.join(root, f), 'utf8').includes(credit)) && fs.readFileSync(path.join(root, 'js/app.js'), 'utf8').includes(credit);
check('(d) credit line present in sheet footer, guide, SETUP and README', creditOk);
check('(d) LICENSE is MIT, Solid State Games 2026', /MIT License/.test(fs.readFileSync(path.join(root, 'LICENSE'), 'utf8')) && /2026 Solid State Games/.test(fs.readFileSync(path.join(root, 'LICENSE'), 'utf8')));

// ---- (e) items left elsewhere, places, retainers (DMG p.25, 29-37; PHB p.13)
const QP = sandbox.QPRules;
function fgt(extra) { const s = SR.blank(); s.race = 'Human'; s.cl = ['Fighter']; s.lv = [5]; s.sc = [16, 10, 10, 14, 12, 14]; return Object.assign(s, extra || {}); }
const dv = s => SR.compute(s).d;
{
    const base = fgt({ inv: [['Plate mail', 1], ['Shield, large', 1], ['Rope, 50\'', 2], ['Torch', 6]], co: [0, 300, 0, 0, 0] });
    const wornAll = dv(base);
    const left = SR.sanitize(Object.assign(JSON.parse(JSON.stringify(base)), { lp: [['Room at the Green Dragon inn', 0, 0, 0, 0, 0]] }));
    SR.moveItem(left, 0, 1); SR.moveItem(left, 0, 1); // plate mail, then what is now row 0 (the shield)
    const dl = dv(left);
    check('(e) armour left at the inn does not protect you: AC and movement change', wornAll.ac < dl.ac && dl.ac === dv(fgt({ co: [0, 300, 0, 0, 0] })).ac && dl.movement.move >= wornAll.movement.move, 'AC ' + wornAll.ac + ' -> ' + dl.ac + ', move ' + wornAll.movement.move + ' -> ' + dl.movement.move);
    check('(e) items at the inn do not count toward load', dl.movement.lb < wornAll.movement.lb, wornAll.movement.lb + ' -> ' + dl.movement.lb + ' lb');
    const coinsInn = SR.sanitize(Object.assign(JSON.parse(JSON.stringify(left)), { lp: [['Bank', 0, 5000, 0, 0, 0]] }));
    check('(e) coins left at a place do not count toward load', dv(coinsInn).movement.gp === dv(Object.assign(JSON.parse(JSON.stringify(coinsInn)), { lp: [['Bank', 0, 0, 0, 0, 0]] })).movement.gp);
    check('(e) value of coins per place', SR.purseGp([1, 10, 2, 20, 200]) === 5 + 10 + 1 + 1 + 1);
    // move, split, merge, remove
    const m = SR.sanitize({ cl: ['Fighter'], inv: [['Torch', 6], ['Torch', 2, '1']], lp: [['A', 1, 2, 3, 4, 5], ['B', 0, 0, 0, 0, 0]] });
    SR.moveItem(m, 0, 1, 4);
    check('(e) move part of a stack merges with the same item at the place', m.inv.length === 2 && m.inv[0][1] === 2 && m.inv[1][1] === 6 && SR.locOf(m.inv[1]) === 1, JSON.stringify(m.inv));
    SR.moveItem(m, 0, 2); SR.removePlace(m, 1);
    check('(e) removing a place moves its items and coins to Carried and renumbers later places', m.lp.length === 1 && m.lp[0][0] === 'B' && m.inv.every(e => SR.locOf(e) <= 1) && m.inv.filter(e => !SR.locOf(e))[0][1] === 6 && m.co.join() === '1,2,3,4,5' && m.inv.filter(e => SR.locOf(e) === 1).length === 1, JSON.stringify(m));
    const bad = SR.sanitize({ cl: ['Fighter'], inv: [['Torch', 1, '7'], ['Rope', 1, '1']], lp: [['A', 0, 0, 0, 0, 0]] });
    check('(e) a location that does not exist falls back to Carried', SR.locOf(bad.inv[0]) === 0 && SR.locOf(bad.inv[1]) === 1);
    // pay a month
    const pay = SR.payFrom([0, 10, 0, 0, 0], 7), big = SR.payFrom([1, 0, 0, 0, 0], 7), shortp = SR.payFrom([0, 3, 0, 0, 0], 7);
    check('(e) paying coins: gold first, refuses when short (and says by how much)', pay.ok && pay.coins[1] === 3 && big.ok === false && big.short === 2 && shortp.ok === false && shortp.short === 4, JSON.stringify([pay, big, shortp]));
    const p2 = SR.payFrom([2, 3, 0, 5, 0], 12);
    check('(e) paying keeps the total exact', p2.ok && Math.abs(SR.purseGp(p2.coins) - (SR.purseGp([2, 3, 0, 5, 0]) - 12)) < 1e-9, JSON.stringify(p2));
    // old save loads
    const old = SR.sanitize({ v: 1, nm: 'Old', cl: ['Fighter'], lv: [3], sc: [15, 10, 10, 10, 10, 10], inv: [['Chain', 1], ['Ring', 1, 0, 2]], co: [0, 10, 0, 0, 0] });
    check('(e) an old save (no places, no retainers) loads: all Carried, empty retainers', old.lp.length === 0 && old.hn.length === 0 && old.hr.length === 0 && old.inv.length === 2 && old.inv.every(e => !SR.locOf(e)) && dv(old).ac <= 5);
}
{
    // loyalty: PHB p.13 base + DMG p.36-37 modifiers
    const s = fgt({ sc: [16, 10, 10, 14, 12, 16], al: 'LG' });   // Cha 16: loyalty base +20
    const h = SR.blankHench(); h[SR.H.lv] = 2;
    check('(e) loyalty base is 50 plus the Charisma adjustment (Cha 16 = +20) plus liege alignment (lawful good +15)', SR.loyalty(s, h, 20).total === 50 + 20 + 15, SR.loyalty(s, h, 20).total);
    const ix = id => SR.LOY_CATS.findIndex(c => c.id === id);
    h[SR.H.m][ix('enl')] = 3; h[SR.H.m][ix('len')] = 3; h[SR.H.m][ix('trn')] = 6; h[SR.H.m][ix('pay')] = 4; h[SR.H.m][ix('trt')] = 5; // henchman +5, 1-5 years +10, henchmen +30, above avg +5, kind +15
    h[SR.H.m][SR.LOY_CATS.length] = 1; h[SR.H.m][SR.LOY_CATS.length + 1] = 4;   // special penalty: killed faithful henchman -40; bonus: saved life +25
    const L = SR.loyalty(s, SR.sanitize({ cl: ['Fighter'], hn: [h] }).hn[0], 20);
    check('(e) loyalty total adds the ticked modifiers, one special penalty and one special bonus', L.total === 50 + 20 + 15 + 5 + 10 + 30 + 5 + 15 - 40 + 25, L.total);
    const L2 = SR.loyalty(s, h, 20, [0, 0, 1, 3, 0, 0, 0, 2, 1]);   // 1 henchman down -5, 3 friendly HD dead -9, 2 henchmen present +10, liege present +15
    check('(e) situation counts apply to one check only', L2.total === L.total - 5 - 9 + 10 + 15, L2.total + ' vs ' + L.total);
    check('(e) loyalty bands: <1 none, 1-25 disloyal, 26-50 little, 51-75 fair, 76-100 loyal, >100 fanatical', [0, 1, 25, 26, 50, 51, 75, 76, 100, 101].map(t => SR.bandOf(t)[2]).join() === 'None,Disloyal,Disloyal,Little,Little,Fair,Fair,Loyal,Loyal,Fanatical');
    check('(e) loyalty check: fails only if the total is less than the d100', SR.loyaltyCheck(60, 60).held && !SR.loyaltyCheck(60, 61).held && SR.loyaltyCheck(101, 100).held);
    const cv = SR.compute(fgt({ sc: [10, 10, 10, 10, 10, 18], hn: [SR.blankHench(), SR.blankHench()] }));
    check('(e) max henchmen from Charisma 18 is 15; two listed is not over', cv.ret.max === 15 && !cv.ret.over && cv.ret.chaLoyalty === 40);
    const ov = SR.compute(fgt({ sc: [10, 10, 10, 10, 10, 9], hn: Array.from({ length: 5 }, SR.blankHench) }));
    check('(e) five henchmen on Charisma 9 (max 4) is over', ov.ret.max === 4 && ov.ret.over);
    const lvlNote = SR.compute(fgt({ hn: [SR.blankHench()].map(x => { x[3] = 5; return x; }) }));
    check('(e) a henchman level equal to the PC is flagged; a lower one is not', lvlNote.ret.hn[0].level === true && SR.compute(fgt({ hn: [(() => { const x = SR.blankHench(); x[3] = 2; return x; })()] })).ret.hn[0].level === false);
    // hirelings
    const sol = id => SR.SOLDIERS.indexOf(id), ex = n => SR.EXPERTS.findIndex(x => x.n.indexOf(n) === 0);
    const hs = SR.sanitize({ cl: ['Fighter'], hr: [[0, sol('footman, heavy'), 20, 0, ''], [0, sol('archer (longbow)'), 10, 2, ''], [1, ex('alchemist'), 1, 0, ''], [1, ex('captain'), 1, 6, ''], [1, ex('sage, support'), 1, 0, ''], [1, ex('sage, research'), 1, 700, ''], [1, ex('spy'), 1, 500, '']] });
    const rv = SR.compute(Object.assign(fgt(), { hr: hs.hr, hn: (() => { const x = SR.blankHench(); x[SR.H.pay] = 500; return [x]; })() }));
    // heavy foot 20 x 2 = 40; longbow 8 x 4 + 2 serjeants x 40 = 112; alchemist 300; captain level 6 x 100 = 600; sage 200 (low end) + 700; spy not monthly; henchman 500
    check('(e) hireling monthly total: soldiers, serjeants at 10x, experts, per level, agreed range, spy excluded, henchman pay', rv.ret.hirePay === 40 + 112 + 300 + 600 + 200 + 700 && rv.ret.monthly === 40 + 112 + 300 + 600 + 200 + 700 + 500, rv.ret.hirePay + ' / ' + rv.ret.monthly);
    const cm = SR.command(SR.sanitize({ cl: ['Fighter'], hr: [[0, sol('footman, heavy'), 30, 1, ''], [1, ex('lieutenant'), 1, 2, '']] }));
    check('(e) command check: 29 regular soldiers over the fighter limit of 10 need 2 serjeants, a lieutenant of 2 levels commands only 20, and over 20 wants a captain', cm.regular === 29 && cm.direct === 10 && cm.minSerj === 2 && cm.cap === 20 && cm.warn.length === 3 && /TB ruling from DMG p\.30-31/.test(cm.warn[0]), JSON.stringify(cm.warn));
    const ok = SR.command(SR.sanitize({ cl: ['Fighter'], hr: [[0, sol('footman, heavy'), 30, 3, ''], [1, ex('captain'), 1, 5, '']] }));
    check('(e) command check: 27 soldiers, 3 serjeants and a 5th level captain (100) is clean', ok.warn.length === 0 && ok.cap === 100);
    check('(e) ranger below 8th may not hire (PHB p.24); at 8th may', SR.compute(Object.assign(fgt(), { cl: ['Ranger'], lv: [7], hn: [SR.blankHench()] })).ret.rangerUsed === true && SR.compute(Object.assign(fgt(), { cl: ['Ranger'], lv: [8] })).ret.rangerBlock === false);
    // command cap by class (TB ruling built on DMG p.30-31) and assassin hirelings (PHB p.30)
    const capOf = cl => SR.directCap({ cl });
    check('(e) direct command: fighter, paladin, ranger 10; cleric, magic-user, thief, assassin, monk 5; any multi-class with a fighter 10', ['Fighter', 'Paladin', 'Ranger'].every(c => capOf([c]) === 10) && ['Cleric', 'Magic-User', 'Thief', 'Assassin', 'Monk', 'Druid', 'Illusionist'].every(c => capOf([c]) === 5) && capOf(['Fighter', 'Magic-User']) === 10 && capOf(['Cleric', 'Thief']) === 5 && capOf(['Fighter', 'Magic-User', 'Thief']) === 10);
    const sj = (cl, n, sr) => SR.command(SR.sanitize({ cl, hr: [[0, sol('footman, heavy'), n, sr || 0, '']] }));
    check('(e) command: 10 soldiers clean for a fighter, 11 warns; 5 clean for a magic-user, 6 warns (warn, not block)', sj(['Fighter'], 10).warn.length === 0 && sj(['Fighter'], 11).warn.length > 0 && sj(['Magic-User'], 5).warn.length === 0 && sj(['Magic-User'], 6).warn.length > 0 && sj(['Fighter', 'Magic-User'], 10).warn.length === 0);
    check('(e) command: serjeants cover the excess at 10 each (fighter, 20 regular + 1 serjeant clean of the serjeant warning)', sj(['Fighter'], 21, 1).minSerj === 1 && sj(['Fighter'], 21, 1).regular === 20 && sj(['Magic-User'], 25, 2).minSerj === 2);
    const asn = (lv, al, hr) => SR.compute(Object.assign(fgt(), { cl: ['Assassin'], lv: [lv], al, hr: hr || [] })).ret.asn;
    const oneHire = [[0, sol('footman, heavy'), 2, 0, '']];
    check('(e) assassin: hirelings blocked below 4th (flagged when listed), lower-level assassins at 4th, thieves from 8th, any class from 12th', asn(3, 'NE', oneHire).used === true && asn(3, 'NE').used === false && asn(4, 'NE', oneHire).block === false && asn(4, 'NE').who === 'lower level assassins only' && asn(8, 'NE').who === 'lower level assassins and thieves' && asn(12, 'NE').who === 'any class');
    check('(e) assassin: the neutral-or-evil rule is a notice about retainers, not a check on the PC; non-assassins get no rule', asn(5, 'NE').evil === undefined && SR.compute(fgt()).ret.asn === null);
    // loyalty is GM only in the player view: the player's render holds no loyalty wording (checked in test/browser_run.js against the DOM); here, the player export carries no loyalty choices
    const uiSrc = fs.readFileSync(path.join(root, 'js/sheet_ui.js'), 'utf8');
    check('(e) UI source: loyalty markup only built behind the GM test (drawer, abilities cell, base line, check, export)', /function subLoy\(s, r\) \{\s*if \(!isGM\(\)\) return "";/.test(uiSrc) && /isGM\(\) \? GM_RSUBS : RSUBS/.test(uiSrc) && /if \(gm\) c \+= '<p class="note">Loyalty: '/.test(uiSrc) && /isGM\(\) \? cell\("Loyalty base"/.test(uiSrc) && /\(gm \? " &nbsp; Charisma loyalty base/.test(uiSrc) && /if \(!isGM\(\)\) return;/.test(uiSrc) && /h\[SR\.H\.m\] = \[\]/.test(uiSrc));
    check('(e) soldier ids cover every MERC type and each pay matches the lib', QP && Object.keys(QP.MERC).every(k => SR.SOLDIERS.indexOf(k) >= 0) && SR.SOLDIERS.every(k => QP.MERC[k]));
}
{
    // maximal sheet: every inventory line, 10 places with coins, 15 henchmen, 20 hirelings, long notes, plus every old cap
    const mx = SR.sanitize(JSON.parse(JSON.stringify(maxChar)));
    mx.lp = Array.from({ length: SR.LIM.places }, (_, k) => ['P'.repeat(SR.LIM.place - 2) + k, 99999, 99999, 99999, 99999, 99999]);
    mx.inv = mx.inv.map((e, i) => { const r = e.slice(); r.push(String(1 + (i % SR.LIM.places))); return r; });
    mx.hn = Array.from({ length: SR.LIM.hench }, (_, k) => ['N'.repeat(SR.LIM.hname), 'Half-Elf', 'Fighter/Magic-User'.slice(0, SR.LIM.hclass), 30, 999, -10, 's'.repeat(SR.LIM.hshare), 99999, '12345678-1234-1234-1234-123456789abc', 'x'.repeat(SR.LIM.hnote),
        SR.LOY_CATS.map(c => c.o.length).concat([SR.LOY_PENALTY.length, SR.LOY_BONUS.length])]);
    mx.hr = Array.from({ length: SR.LIM.hire }, (_, k) => [k % 2, k % 2 ? SR.EXPERTS.length - 1 : SR.SOLDIERS.length - 1, 9999, k % 2 ? 99999 : 9999, 'n'.repeat(SR.LIM.hirenote)]);
    const t = SR.sanitize(mx), size = SR.bytes(SR.pack(t));
    check('(e) maximal sheet (all inventory in 10 places, 15 henchmen, 20 hirelings, 3000-char notes, every spell cap) under 16 kB', size < SR.MAX_BYTES && t.lp.length === 10 && t.hn.length === 15 && t.hr.length === 20 && t.inv.length === SR.LIM.gear, size + ' B');
    const comp = SR.compute(t);
    check('(e) maximal sheet still computes and round-trips', !comp.errors.length && JSON.stringify(SR.sanitize(JSON.parse(SR.pack(t)))) === JSON.stringify(t));
    console.log('      (maximal retainer sheet: ' + size + ' bytes; places ' + JSON.stringify(t.lp).length + ', henchmen ' + JSON.stringify(t.hn).length + ', hirelings ' + JSON.stringify(t.hr).length + ', inventory ' + JSON.stringify(t.inv).length + ')');
}

// ---- (g) Simple view (TB 2026-11-12): one page, no thief skills, no loyalty; casting ticks and ammunition
{
    const SS = sandbox.SheetSimple;
    const th = SR.sanitize(Object.assign(SR.blank(), { nm: 'Sneak', race: 'Halfling', sub: 'Stout', cl: ['Thief'], lv: [6], sc: [9, 12, 9, 17, 12, 10], al: 'N', hp: 20, hm: 24, pf: ['Dagger and scabbard', 'Sling'],
        inv: [['Leather', 1], ['Shield, small', 1], ['Dagger and scabbard', 2], ['Rope, 50\'', 1], ['Sling stone', 20], ['Dart', 6]], co: [1, 22, 0, 3, 0],
        hn: [['Henchy', 'Human', 'Fighter', 1, 5, 10, '', 0, '', '', [3, 3]]] }));
    const tv = SR.compute(th), page = SS.html(tv, true);
    const text = page.replace(/<[^>]*>/g, ' ');
    check('(g) Simple page has no thief skills (DMG p.19: the DM rolls them) and no loyalty or henchmen', !/pick pockets|hide in shadows|move silently|climb walls|find traps|loyalty|henchm|retainer/i.test(text) && tv.thief && !!Object.keys(tv.thief).length);
    check('(g) Simple page shows name, race, class and level, alignment, AC, HP now and full, movement', /Sneak/.test(text) && /Halfling \(Stout\)/.test(text) && /Thief 6/.test(text) && /True Neutral/.test(text) && /Armour class/.test(text) && /data-f="hp"[^>]*value="20"/.test(page) && /data-f="hm"[^>]*value="24"/.test(page) && /Movement/.test(text));
    check('(g) Simple page: six ability scores with only the key adjustments, five saves, to-hit AC 10 to -10', /Str[\s\S]*hit [+-]?\d/.test(text) && /reaction [+-]?\d, defence [+-]?\d/.test(text) && /hp [+-]?\d/.test(text) && !/Open doors|System shock|% know spell|Max henchmen/.test(text) && /Para \/ poison/.test(text) && /<th>-10<\/th>/.test(page) && /<th>10<\/th>/.test(page));
    check('(g) Simple page: weapons with damage S-M/L and speed, ammunition, coins, worn armour and shield, carried gear', /Dagger/.test(text) && /Damage S-M/.test(text) && /Sling stone/.test(text) && /Dart/.test(text) && /Leather/.test(text) && /Shield, small/.test(text) && /Rope/.test(text) && />22</.test(page));
    check('(g) read only render has no editable inputs or enabled buttons except Full sheet and switch', !/data-f="hp"[^>]*>/.test(SS.html(tv, false).replace(/data-f="hp"[^>]*disabled/g, '')) && !/<button[^>]*data-act="(cast|ammo|rest)"(?![^>]*disabled)[^>]*>/.test(SS.html(tv, false)) && /data-act="vw" data-v="full"/.test(SS.html(tv, false)));
    check('(g) default view by role: player Simple, GM Full', SR.defaultSheetView('PLAYER') === 'simple' && SR.defaultSheetView('GM') === 'full');
    // spells: tick, untick, rest
    const mu = SR.sanitize(Object.assign(SR.blank(), { cl: ['Magic-User'], lv: [5], sc: [10, 16, 10, 10, 10, 10], sk: { 'Magic-User': [['Magic Missile', 'Sleep', 'Shield']] }, sm: { 'Magic-User': [['Magic Missile', 'Magic Missile', 'Sleep']] } }));
    SR.toggleCast(mu, 'Magic-User', 0, 1);
    check('(g) spell tick: one of two Magic Missiles cast, the other still memorised', SR.isCast(mu, 'Magic-User', 0, 1) && !SR.isCast(mu, 'Magic-User', 0, 0) && JSON.stringify(mu.cs) === '{"Magic-User":[2]}');
    check('(g) ticks persist through store and export/import', JSON.stringify(SR.parseImport(SR.exportText(mu)).cs) === JSON.stringify(mu.cs) && JSON.stringify(SR.sanitize(JSON.parse(SR.pack(mu))).cs) === JSON.stringify(mu.cs));
    const mp = SS.html(SR.compute(mu), true);
    check('(g) cast spell chip is marked and the left count drops', /spchip cast"[^>]*data-i="1"/.test(mp) && /2 of 3 left/.test(mp));
    SR.toggleCast(mu, 'Magic-User', 0, 1);
    check('(g) untick clears it and the empty record is dropped (compact)', !SR.isCast(mu, 'Magic-User', 0, 1) && JSON.stringify(mu.cs) === '{}');
    SR.toggleCast(mu, 'Magic-User', 0, 0); SR.toggleCast(mu, 'Magic-User', 0, 2); SR.toggleCast(mu, 'Magic-User', 0, 9);
    check('(g) ticking past the memorised list does nothing', JSON.stringify(mu.cs) === '{"Magic-User":[5]}');
    SR.filterMem(mu, 'Magic-User', 0, (n, i) => i !== 0);
    check('(g) removing a memorised spell keeps the other ticks on the right spells', JSON.stringify(mu.sm['Magic-User'][0]) === '["Magic Missile","Sleep"]' && SR.isCast(mu, 'Magic-User', 0, 1) && !SR.isCast(mu, 'Magic-User', 0, 0));
    SR.restSpells(mu);
    check('(g) Rest: reset clears every tick', JSON.stringify(mu.cs) === '{}' && JSON.stringify(SR.sanitize(mu).cs) === '{}');
    check('(g) hostile cs (bad class, huge numbers, text) is cleaned', JSON.stringify(SR.sanitize(Object.assign(JSON.parse(JSON.stringify(mu)), { cs: { 'Magic-User': [1e12, 'x'], Cleric: [3] } })).cs) === '{"Magic-User":[3]}');
    // ammunition
    const ammo = n => SR.ammoLines(n).map(a => a.name + ':' + a.left + '/' + a.total).join(',');
    check('(g) ammunition lines: carried sling stones, darts; pack sizes in the name count', ammo(th) === 'Sling stone:20/20,Dart:6/6' && ammo(SR.sanitize(Object.assign(SR.blank(), { inv: [['Arrow, normal (12)', 2], ['Quarrel/Bolt, heavy (20)', 1], ['Arrow, normal (single)', 3]] }))) === 'Arrow, normal (12):24/24,Quarrel/Bolt, heavy (20):20/20,Arrow, normal (single):3/3');
    SR.adjustAmmo(th, 'Sling stone', -1); SR.adjustAmmo(th, 'Sling stone', -1); SR.adjustAmmo(th, 'Dart', 1);
    check('(g) ammo minus fires one, plus cannot pass what is carried', ammo(th) === 'Sling stone:18/20,Dart:6/6' && JSON.stringify(th.am) === '{"Sling stone":2}');
    for (let i = 0; i < 30; i++) SR.adjustAmmo(th, 'Dart', -1);
    check('(g) ammo never goes below 0', ammo(th) === 'Sling stone:18/20,Dart:0/6');
    check('(g) ammo spent survives store and import; a line moved to a place or removed drops its record', ammo(SR.sanitize(JSON.parse(SR.pack(th)))) === 'Sling stone:18/20,Dart:0/6' && !SR.sanitize(Object.assign(JSON.parse(JSON.stringify(th)), { inv: [['Dart', 6, '1']], lp: [['Inn', 0, 0, 0, 0, 0]] })).am.Dart);
    const more = SR.sanitize(Object.assign(JSON.parse(JSON.stringify(th)), { inv: th.inv.map(e => e[0] === 'Dart' ? ['Dart', 10] : e) }));
    check('(g) picking up more darts in the Full sheet adds to the count, spent stays spent', ammo(more) === 'Sling stone:18/20,Dart:4/10');
    check('(g) an old save (no cs or am) loads', (o => Object.keys(o.cs).length === 0 && Object.keys(o.am).length === 0)(SR.sanitize({ v: 1, cl: ['Cleric'], lv: [3], sc: [10, 10, 14, 10, 10, 10], inv: [['Dart', 3]] })));
    // size: the maximal sheet of test (e) plus every cast tick and the carried ammunition lines
    const mx = SR.sanitize(JSON.parse(JSON.stringify(maxChar)));
    mx.lp = Array.from({ length: SR.LIM.places }, (_, k) => ['P'.repeat(SR.LIM.place - 2) + k, 99999, 99999, 99999, 99999, 99999]);
    const ammoNames = Rules.EQUIPMENT.weapons.filter(w => w.ammo || w.kind === 'dart' || w.kind === 'javelin').map(w => w.n);
    mx.inv = mx.inv.map((e, i) => { const r = e.slice(); if (i >= ammoNames.length) r.push(String(1 + (i % SR.LIM.places))); return r; });
    ammoNames.forEach((n, i) => { mx.inv[i] = [n, 9999]; });
    mx.hn = Array.from({ length: SR.LIM.hench }, () => ['N'.repeat(SR.LIM.hname), 'Half-Elf', 'Fighter/Magic-User'.slice(0, SR.LIM.hclass), 30, 999, -10, 's'.repeat(SR.LIM.hshare), 99999, '12345678-1234-1234-1234-123456789abc', 'x'.repeat(SR.LIM.hnote), SR.LOY_CATS.map(c => c.o.length).concat([SR.LOY_PENALTY.length, SR.LOY_BONUS.length])]);
    mx.hr = Array.from({ length: SR.LIM.hire }, (_, k) => [k % 2, k % 2 ? SR.EXPERTS.length - 1 : SR.SOLDIERS.length - 1, 9999, k % 2 ? 99999 : 9999, 'n'.repeat(SR.LIM.hirenote)]);
    // (1) the (e) maximal sheet with every ammunition kind carried and fully spent
    const spent = SR.sanitize(mx); SR.ammoLines(spent).forEach(a => SR.adjustAmmo(spent, a.name, -a.total));
    const asize = SR.bytes(SR.pack(spent));
    check('(g) the maximal sheet of (e) with all ' + ammoNames.length + ' ammunition kinds carried and fully spent is still under 16 kB', asize < SR.MAX_BYTES && SR.ammoLines(spent).length === ammoNames.length && Object.keys(SR.sanitize(spent).am).length === ammoNames.length, asize + ' B (am ' + JSON.stringify(spent.am).length + ' B)');
    // (2) casting ticks on a heavy caster: cost of the ticks alone (the 160 known + 160 memorised caster already passes 16 kB without them, see NOTES, so the cost is measured as a difference)
    const cast = SR.sanitize(Object.assign(JSON.parse(JSON.stringify(mx)), { inv: [] }));
    cast.sk = {}; cast.sm = {}; { let left = SR.LIM.known; ['Magic-User', 'Cleric'].forEach(c => { cast.sk[c] = []; cast.sm[c] = []; for (let l = 0; l < 9 && left > 0; l++) { const list = Array(Math.min(15, left)).fill('Magic Missile'); left -= list.length; cast.sk[c].push(list); cast.sm[c].push(list.slice()); } }); }
    const c0 = SR.bytes(SR.pack(cast)), c1x = SR.sanitize(cast);
    Object.keys(c1x.sm).forEach(c => c1x.sm[c].forEach((l, li) => l.forEach((n, i) => { if (i < SR.CAST_BITS) SR.toggleCast(c1x, c, li, i); })));
    const cdelta = SR.bytes(SR.pack(c1x)) - c0;
    check('(g) every memorised spell of two casting classes ticked as cast costs under 150 bytes', cdelta > 0 && cdelta < 150, cdelta + ' B');
    check('(g) a full-ticked caster under the old caster size cap still round-trips', JSON.stringify(SR.sanitize(JSON.parse(SR.pack(c1x))).cs) === JSON.stringify(c1x.cs));
    check('(g) the UI source only builds thief skills and loyalty in the Full view', !/thief|loyalty/i.test(fs.readFileSync(path.join(root, 'js/sheet_simple.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//, '').replace(/\/\/.*$/gm, '')));
}

// ---- (f) typed rules data diffed against the book text (DMG p.29-37, PHB p.13)
const BOOKS = path.join(root, '..', '..', '..', 'ADD-BOOKS-PDF', 'TEXT');
if (!fs.existsSync(BOOKS)) check('(f) book text folder found (skipped: ' + BOOKS + ' missing)', true);
else {
    const page = (b, n) => fs.readFileSync(path.join(BOOKS, b, 'p' + String(n).padStart(3, '0') + '.txt'), 'utf8');
    const norm = t => t.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[–−—]/g, '-').replace(/[’]/g, "'").replace(/\s+/g, ' ');
    const P = {}; [25, 29, 30, 31, 33, 34, 36, 37].forEach(n => { P[n] = norm(page('DMG', n)); if (n >= 36) P[n] = P[n].replace(/\*/g, ''); });
    const has = (n, frag) => P[n].includes(norm(frag));
    const pn = pg => Number(/p\.(\d+)/.exec(pg)[1]);
    const miss = [];
    SR.EXPERTS.forEach(x => x.t.forEach(f => { if (!has(pn(x.p), f)) miss.push(x.n + ': ' + f); }));
    ['sage, support and salary', 'sage, research grants'].forEach(() => 0);
    check('(f) expert hireling costs match DMG p.29-34', miss.length === 0, miss.join(' | '));
    const sm = []; Object.keys(QP.MERC).forEach(k => { if (!has(29, k + ' ' + QP.MERC[k].pay)) sm.push(k + ' ' + QP.MERC[k].pay); });
    check('(f) mercenary monthly pay in lib/quickparty_rules.js matches the DMG p.29 table', sm.length === 0, sm.join(' | '));
    check('(f) serjeant is 10 times the troop rate (DMG p.31); maintenance of henchmen 100 gp per level (DMG p.25)', norm(page('DMG', 31)).includes('10 times the rate of the troops') && P[25].includes('maintenance of henchmen 100 g.p. per level per month'));
    const lm = [];
    if (!has(36, 'normal loyalty base: 50%')) lm.push('base 50%');
    const sg = v => (v > 0 ? '+' : '') + v + '%';
    SR.LOY_CATS.forEach(c => c.o.forEach((o, j) => {
        let frag;
        if (c.id === 'rpl' || c.id === 'rpg') { const other = SR.LOY_CATS[SR.LOY_CATS.findIndex(x => x.id === (c.id === 'rpl' ? 'rpg' : 'rpl'))].o[j][1]; frag = o[0] + ' ' + (c.id === 'rpl' ? sg(o[1]) + ' ' + sg(other) : sg(other) + ' ' + sg(o[1])); }
        else if (c.id === 'all' || c.id === 'alg') { const other = SR.LOY_CATS[SR.LOY_CATS.findIndex(x => x.id === (c.id === 'all' ? 'alg' : 'all'))].o[j][1]; frag = o[0] + ' ' + (c.id === 'all' ? sg(o[1]) + ' ' + sg(other) : sg(other) + ' ' + sg(o[1])); }
        else frag = o[0] + ' ' + sg(o[1]);
        if (!has(c.p === 'DMG p.36' ? 36 : 37, frag)) lm.push(c.id + ': ' + frag);
    }));
    SR.LOY_ALIGN_ROWS.forEach(r => { if (!has(37, r[1] + ' ' + sg(r[2])) && !(r[0] === 'N' && has(37, 'neutral ' + sg(0)))) lm.push('align ' + r[1]); if (SR.LOY_ALIGN[r[0]] !== r[2]) lm.push('align map ' + r[0]); });
    SR.LOY_SPECIAL.forEach(x => { if (!has(37, x[2])) lm.push('special: ' + x[2]); });
    SR.LOY_SITUATION.forEach(x => { if (!has(37, x[3])) lm.push('situation: ' + x[3]); });
    SR.LOY_BANDS.forEach(b => { if (!has(36, b[4])) lm.push('band: ' + b[4]); });
    SR.LOY_CHECKS.forEach(c => { if (!has(36, c[0] + ' ' + c[1])) lm.push('check: ' + c[0] + ' ' + c[1]); });
    check('(f) every loyalty modifier, band, situation and check result matches DMG p.36-37', lm.length === 0, lm.join(' | '));
    const phb30L = norm(page('PHB', 30).split('\n').map(l => l.slice(0, 92)).join(' ')); // left column only (two-column page)
    check('(f) command chain wording and ranger rule match DMG p.30-31, PHB p.24 and PHB p.30 (assassin hirelings)', phb30L.includes('cannot have any hirelings until he or she attains 4th level') && phb30L.includes('lower level assassins may be taken into service') && phb30L.includes('may also include thieves amongst his or her hirelings') && phb30L.includes('attaining 12th level, the character may hire any class desired') && phb30L.includes('only neutral or evil characters will serve an assassin') && phb30L.includes('total number of henchmen is that dictated by the character') && has(31, 'monthly cost of a lieutenant is') && has(30, 'as many scores of troops as he or she has levels') && has(31, 'as many decades of troops as he or she has levels') && has(31, 'there must be 1 serjeant minimum for every 10 regular soldiers') && norm(page('PHB', 24)).includes('rangers may not hire men-at-arms, servants, aides, or henchmen until'));
    check('(f) special considerations: one penalty and one bonus only (DMG p.37)', has(37, 'apply only one penalty and one bonus maximum'));
    const ph = norm(page('PHB', 13)), chaBad = [];
    for (let c = 3; c <= 18; c++) { const r = Rules.derive({ race: 'Human', classes: ['Fighter'], levels: { Fighter: 1 }, scores: { str: 10, int: 10, wis: 10, dex: 10, con: 10, cha: c }, inventory: [] }).abilities.cha; const lo = r.loyalty === 0 ? 'normal' : (r.loyalty > 0 ? '+' : '-') + String(Math.abs(r.loyalty)).padStart(2, '0') + '%'; if (!new RegExp('(^| )' + c + ' (.* )?' + r.henchmen + ' ' + lo.replace('+', '\\+')).test(ph)) chaBad.push(c + ':' + r.henchmen + '/' + lo); }
    check('(f) Charisma henchmen and loyalty base (lib) match PHB p.13', chaBad.length === 0, chaBad.join(' | '));
}

const html = ['index.html', 'guide.html', 'js/app.js', 'css/toolkit.css'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
check('no TSR or WotC marks, no em dashes in UI copy', !/TSR|Wizards of the Coast|ADVANCED D&D|—/.test(html.replace(credit, '')));

console.log(fails ? '\n' + fails + ' of ' + total + ' FAILED' : '\nall ' + total + ' checks passed');
process.exit(fails ? 1 : 0);
