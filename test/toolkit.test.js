// 1e Toolkit checks. Run: node test/toolkit.test.js --check   (exit 0 = pass)
// Loads lib/*.js, sheet_rules.js, gm_render.js and gm_combat.js in one vm context in the order index.html loads them.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const sandbox = { console: { log() {}, warn() {}, error() { console.error.apply(console, arguments); } }, Intl, setTimeout };
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
const ORDER = ['lib/rules_1e.js', 'lib/combat_rules.js', 'lib/encounterTables.js', 'lib/dungeonTables.js', 'lib/monsters.js', 'lib/treasure_engine.js', 'lib/morale.js', 'lib/reactions.js',
    'lib/troopBuilders.js', 'lib/stronghold.js', 'lib/mounts.js', 'lib/pursuit.js', 'lib/encounter_engine.js', 'lib/quickparty_rules.js', 'js/sheet_rules.js', 'js/sheet_simple.js', 'js/gm_render.js', 'js/gm_combat.js', 'js/combat_state.js', 'js/combat_attack.js'];
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
    /^\d+\.\d+\.\d+$/.test(mf.version) && mf.background_url && fs.existsSync(path.join(root, mf.action.popover.replace(/^https:\/\/solid-state-games\.github\.io\/1e-toolkit\//, '').replace(/^\//, ''))) && fs.existsSync(path.join(root, mf.background_url.replace(/^https:\/\/solid-state-games\.github\.io\/1e-toolkit\//, '').replace(/^\//, ''))) && fs.existsSync(path.join(root, mf.icon.replace(/^https:\/\/solid-state-games\.github\.io\/1e-toolkit\//, '').replace(/^\//, '')));
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
    check('(g) Simple page: six ability scores with only the key adjustments, five saves, to-hit AC 10 to -10', /Str[\s\S]*hit [+-]?\d/.test(text) && /reaction [+-]?\d, defence [+-]?\d/.test(text) && /hp [+-]?\d/.test(text) && !/Open doors|System shock|% know spell|Max henchmen/.test(text) && /Death, poison/.test(text) && /Petrify, poly\./.test(text) && /<th>-10<\/th>/.test(page) && /<th>10<\/th>/.test(page));
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

// ---- (h) new sheets: Quick Party (Random PC) and the Character Creator wizard (TB 2026-11-12)
{
    const QPR = sandbox.QPRules, bad = [], sizes = [], notes = [];
    const nums = (o, p) => { if (o === undefined || o === null) return; if (typeof o === 'number' && isNaN(o)) bad.push(p + ' NaN'); else if (typeof o === 'object') Object.keys(o).forEach(k => nums(o[k], p + '.' + k)); };
    const derivesOk = (sh, tag) => {
        const v = SR.compute(sh);
        if (v.errors.length) { bad.push(tag + ' errors ' + v.errors[0]); return v; }
        if (v.warns.length) bad.push(tag + ' illegal: ' + v.warns[0]);
        nums(v.d, tag); nums(v.movement, tag); nums(v.toHitRows, tag);
        const sz = SR.sizeOf(sh); sizes.push(sz); if (sz >= SR.MAX_BYTES) bad.push(tag + ' size ' + sz);
        if (sh.nt.length >= SR.LIM.text - 20) bad.push(tag + ' notes at cap');
        if (/undefined|NaN|\[object/.test(SR.previewLine(sh))) bad.push(tag + ' preview');
        return v;
    };
    // Quick Party: 500 PCs in each level band, four ability methods
    const BANDS = [[1, 1], [2, 4], [5, 8], [9, 12]];
    let spellsSeen = 0, magicSeen = 0, thiefSame = 0, thiefN = 0;
    BANDS.forEach(b => {
        for (let i = 0; i < 500; i++) {
            const lvl = b[0] + Math.floor(rng() * (b[1] - b[0] + 1)), method = 1 + (i % 4);
            const rec = QPR.genPCParty({ count: 1, levelRange: lvl, method, alignMode: 'any' }).chars[0], tag = 'QP L' + b.join('-') + ' #' + i;
            const sh = SR.fromQuickParty(rec, 'Token');
            const v = derivesOk(sh, tag);
            if (sh.cl.join('/') !== rec.classes.join('/') || sh.lv.join('/') !== rec.levels.join('/') || sh.hm !== rec.hp || sh.xp !== rec.xp || sh.sc.join() !== ['str', 'int', 'wis', 'dex', 'con', 'cha'].map(a => rec.stats[a]).join()) bad.push(tag + ' fields differ');
            if (JSON.stringify(SR.sanitize(JSON.parse(SR.pack(sh)))) !== JSON.stringify(sh)) bad.push(tag + ' not stable through pack');
            // every spell the generator memorised is on the sheet, in a class the sheet shows
            const nSheet = Object.keys(sh.sm).reduce((a, c) => a + sh.sm[c].reduce((x, l) => x + l.length, 0), 0), nGen = (rec.spells || '').split('<b>').slice(1).reduce((a, l) => a + Number(/\((\d+)\):/.exec(l)[1]), 0);
            if (nSheet !== nGen) bad.push(tag + ' spells ' + nSheet + ' vs ' + nGen);
            Object.keys(sh.sm).forEach(c => { if (v.spellClasses.indexOf(c) < 0) bad.push(tag + ' spells hidden for ' + c); });
            if (nGen) spellsSeen++;
            // every item is a row or named in the notes
            const rows = sh.inv.map(r => r[0]).join('|');
            rec.equipment.forEach(e => { const plain = /^(Plate Mail|Banded Mail|Splint Mail|Chain Mail|Scale Mail|Studded Leather|Ring Mail|Leather Armor|Padded Armor|Shield|Long Sword|Dagger|Mace|Scimitar|Staff|Spear|Long Bow & Arrows|Thieves' Picks & Tools)$/.test(e); if (plain ? false : !sh.nt.includes(e) || !rows.includes(e.slice(0, 60))) bad.push(tag + ' item lost ' + e); });
            if (rec.equipment.filter(e => /^(Plate Mail|Banded Mail|Chain Mail|Studded Leather|Leather Armor|Shield|Long Sword|Dagger|Mace|Scimitar|Staff)$/.test(e)).length && !sh.inv.length) bad.push(tag + ' no rows');
            if (rec.equipment.some(e => /\+\d|Ring|Potion|Scroll|Wand/.test(e))) magicSeen++;
            if (/Thief|Assassin|Monk/.test(sh.cl.join()) && v.thief) { thiefN++; const t = v.thief['Climb Walls']; if (t && rec.skills && rec.skills.includes('Climb Walls ' + t.total + '%')) thiefSame++; }
            notes.push(sh.nt.length);
        }
    });
    check('(h) 2000 Quick Party PCs (500 per level band 1, 2-4, 5-8, 9-12) convert, derive with no NaN, stay legal, every spell and item kept, under 16 kB', bad.length === 0, bad.slice(0, 6).join(' | '));
    check('(h) Quick Party conversion exercised spells and magic items', spellsSeen > 200 && magicSeen > 200, spellsSeen + ' casters, ' + magicSeen + ' with magic');
    check('(h) sheet thief climb walls equals the generator for thieves, assassins and monks (same PHB p.28 table)', thiefN > 50 && thiefSame >= thiefN * 0.97, thiefSame + ' of ' + thiefN);
    console.log('     QP sheets: largest ' + Math.max.apply(null, sizes) + ' B, longest notes ' + Math.max.apply(null, notes) + ' chars');
    // a known cleric and magic-user
    const mu = SR.fromQuickParty({ race: 'Half-elf', classes: ['Magic-User'], levels: [1], stats: { str: 9, int: 16, wis: 10, dex: 14, con: 12, cha: 11, strX: null }, gender: 'Female', align: 'Chaotic Good', xp: 0, hp: 4, equipment: ['Dagger'], ac: 9,
        spells: "<b>MU L1 (1):</b> Sleep<br><span class=\"opacity-60\">Book: Read Magic, Sleep, Light</span>", titles: 'Prestidigitator' }, 'Wren');
    check('(h) known Quick Party magic-user: Half-Elf, CG, book and memorised spell, dagger, title in notes', mu.race === 'Half-Elf' && mu.al === 'CG' && mu.sex === 'f' && mu.sk['Magic-User'][0].join() === 'Read Magic,Sleep,Light' && mu.sm['Magic-User'][0].join() === 'Sleep' && mu.inv[0][0] === 'Dagger and scabbard' && /Prestidigitator/.test(mu.nt) && mu.nm === 'Wren');
    // Creator wizard: 200 characters built the way the wizard builds them (rules_1e helpers), posted shape = charFromState + name, hp, levels, secondarySkill, spells
    const wbad = []; let made = 0, tries = 0;
    const cr = Rules.makeRng(777);
    while (made < 200 && tries < 5000) {
        tries++;
        const method = 1 + (made % 4), ab = Rules.rollAbilities(method, cr); let raw = {};
        if (method === 3) raw = ab.scores; else if (method === 4) raw = ab.sets[Math.floor(cr() * 12)]; else { const p = ab.pool.slice(); for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(cr() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } Rules.ABILITIES.forEach((a, i) => { raw[a] = p[i]; }); }
        const sex = cr() < 0.5 ? 'm' : 'f', races = Object.keys(Rules.RACES).filter(r => Rules.applyRace(raw, r, sex).ok), race = races[Math.floor(cr() * races.length)];
        if (!race) continue;
        const ar = Rules.applyRace(raw, race, sex), opts = Rules.classesFor(race, ar.scores); if (!opts.length) continue;
        const classes = opts[Math.floor(cr() * opts.length)], al = Rules.alignmentsFor(classes); if (!al.length) continue;
        const c = { race, subrace: 'Stout', sex, classes, scores: ar.scores, chaRolled: raw.cha, alignment: al[Math.floor(cr() * al.length)], languages: [] };
        c.strExc = Rules.rollStrExc(c, cr); c.age = Rules.rollAge(c, cr); const ag = Rules.applyAging(c, cr); c.scores = ag.scores; c.strExc = ag.strExc;
        const hw = Rules.rollHeightWeight(c, cr); c.height = hw.height; c.weight = hw.weight; c.hp = Rules.rollHP(c, cr).hp;
        c.coinsCP = Math.floor(cr() * 4000); c.inventory = [];
        [].concat(Rules.EQUIPMENT.weapons, Rules.EQUIPMENT.armor, Rules.EQUIPMENT.gear).forEach(it => { if (cr() > 0.3) return; const ok = it.kind !== undefined ? Rules.canUseWeapon(classes, it, c).ok : (it.ac !== undefined ? Rules.canWearArmor(classes, it).ok : true); if (ok) c.inventory.push(Object.assign({ qty: 1 + Math.floor(cr() * 3) }, it, { _t: 'w' })); });
        c.proficiencies = Rules.EQUIPMENT.weapons.filter(w => Rules.canUseWeapon(classes, w, c).ok).slice(0, 3).map(w => w.n);
        c.name = made % 5 ? 'Hero ' + made : ''; c.levels = {}; classes.forEach(k => { c.levels[k] = 1; }); c.secondarySkill = Rules.rollSecondarySkill(cr); c.version = '1.9.0';
        const rolls = Rules.rollStartingSpells(classes, cr); c.spells = [];
        rolls.forEach(r => { r.fixed.forEach(sp => c.spells.push({ s: sp, cls: r.class })); r.picks.forEach(p => c.spells.push({ s: p.spell || 'Sleep', cls: r.class })); });
        made++;
        const posted = JSON.parse(JSON.stringify(c)), sh = SR.fromCreator(posted, 'Token'), tag = 'creator #' + made;
        derivesOk(sh, tag);
        if (sh.race !== race || sh.cl.join() !== classes.join() || sh.sc.join() !== Rules.ABILITIES.map(a => c.scores[a]).join() || sh.ex !== (c.strExc || 0) || sh.hm !== c.hp || sh.al !== c.alignment) wbad.push(tag + ' fields differ');
        if (sh.nm !== (c.name || 'Token')) wbad.push(tag + ' name');
        if (SR.coinPieces({ co: sh.co }) && Math.abs(SR.coinGp(sh) - c.coinsCP / 200) > 1e-9) wbad.push(tag + ' coins ' + SR.coinGp(sh) + ' vs ' + c.coinsCP / 200);
        if (sh.inv.length !== c.inventory.length && sh.inv.length !== Math.min(SR.LIM.gear, c.inventory.length)) wbad.push(tag + ' inventory ' + sh.inv.length + ' vs ' + c.inventory.length);
        const nSp = Object.keys(sh.sk).reduce((a, k) => a + sh.sk[k][0].length, 0); if (nSp !== c.spells.length) wbad.push(tag + ' spells ' + nSp + ' vs ' + c.spells.length);
        if (!sh.nt.includes(c.secondarySkill)) wbad.push(tag + ' secondary skill not in notes');
        if (SR.compute(sh).d.ac !== Rules.derive(Object.assign({}, c, { levels: c.levels })).ac) wbad.push(tag + ' AC differs from the creator');
    }
    check('(h) 200 wizard characters convert, derive with no NaN, stay legal, under 16 kB, AC equals the creator, spells kept, money exact', made === 200 && wbad.length === 0 && bad.length === 0, wbad.concat(bad).slice(0, 6).join(' | '));
    const e = SR.fromCreator({}, 'Empty');
    check('(h) fromCreator and fromQuickParty never throw on an empty object', e.nm === 'Empty' && SR.compute(e).errors.length === 0 && SR.fromQuickParty({ classes: [], levels: [], stats: {}, race: 'x' }).cl[0] === 'Fighter');
}

// ---- (i) Random PC methods and Appendix P, worn magic items and armour class, saving throws, old saves (TB 2026-11-12)
{
    const QPR = sandbox.QPRules, bad = [];
    // each ability method (DMG p.11): ranges and shape
    const stat = (m, n) => { let lo = 99, hi = 0, sum = 0, cnt = 0, shape = true; for (let i = 0; i < n; i++) { const r = QPR.rollAbilities(m), vals = Array.isArray(r) ? r : Object.keys(r).map(k => r[k]); if (vals.length !== 6) shape = false; if (!Array.isArray(r) && Object.keys(r).join() !== 'str,int,wis,dex,con,cha') shape = false; vals.forEach(v => { lo = Math.min(lo, v); hi = Math.max(hi, v); sum += v; cnt++; }); } return { lo, hi, mean: sum / cnt, shape }; };
    const ms = [1, 2, 3, 4].map(m => stat(m, 3000));
    check('(i) DMG p.11 Methods I-IV: six scores each, every score 3 to 18', ms.every(x => x.shape && x.lo >= 3 && x.hi <= 18), ms.map(x => x.lo + '-' + x.hi).join(' '));
    check('(i) every method beats a plain 3d6 average (10.5) and reaches 18; Method III (best of six per score) is highest', ms.every(x => x.mean > 10.8 && x.hi === 18) && ms[2].mean > ms[0].mean && ms[2].mean > ms[3].mean, ms.map(x => x.mean.toFixed(2)).join(' '));
    // Random PC: all four methods, with and without the Appendix P switch
    const BAND = ['1', '1-2', '2-4', '5-7', '5-8', '7-9', '8-10', '8-11', '9-12'];
    const prot = (nm) => /\+\d|Ring of Protection|Bracers of Defense|Cloak of/.test(nm);
    let magicPCs = 0, plain = 0, appN = 0, protSeen = 0, miscSeen = 0;
    for (const appP of [false, true]) for (const m of [1, 2, 3, 4]) for (let i = 0; i < 120; i++) {
        const band = BAND[(i + m) % BAND.length], r = SR.randomPC({ method: m, appP, band, name: 'T' }), sh = r.sheet, v = SR.compute(sh), tag = (appP ? 'AppP' : 'M' + m) + ' ' + band + ' #' + i, hi = Number(band.split('-').pop()), lo = Number(band.split('-')[0]);
        if (v.errors.length || v.warns.length) bad.push(tag + ' illegal ' + (v.errors[0] || v.warns[0]));
        if (r.method !== (appP ? 1 : m) || r.appP !== appP) bad.push(tag + ' method echo');
        const nC = sh.cl.length, cap = nC === 1 ? hi : Math.ceil((hi + nC) / nC) + 2; // DMG p.226: a multi-class PC gets (level + 1 per class) / classes, fractions counting as whole; XP is then shared, so classes with easier XP tables show a level or two higher
        if (Math.max.apply(null, sh.lv) > cap || sh.lv.some(l => l < 1)) bad.push(tag + ' level ' + sh.lv + ' outside ' + band);
        if (sh.cl.length === 1 && lo === hi && sh.lv[0] !== lo && sh.lv[0] < Math.min(lo, Rules.derive(SR.toChar(sh)).levelLimits[sh.cl[0]] || 99)) bad.push(tag + ' level ' + sh.lv);
        if (SR.sizeOf(sh) >= SR.MAX_BYTES) bad.push(tag + ' size');
        const names = r.rec.equipment, hasMagic = names.some(prot) || names.some(e => /Potion|Scroll|Wand|Ring of|Bag|Boots|Brooch|Rope|Javelin|Trident|Robe|Necklace|Folding|Cloak/.test(e));
        if (!appP && hasMagic) bad.push(tag + ' magic item without the Appendix P switch: ' + names.join(', '));
        if (appP && hasMagic) magicPCs++; if (!appP) plain++;
        if (appP) { appN++; names.filter(prot).forEach(nm => { protSeen++; const plus = +(/\+(\d)/.exec(nm) || [0, 1])[1]; if (plus > 3 && !/Bracers/.test(nm)) bad.push(tag + ' plus ' + nm); }); if (r.rec.equipment.some(e => QPR.MISC.indexOf(e) >= 0)) miscSeen++; }
        // each protective item is on the generator's App. P table for one of the character's classes
        if (appP) names.forEach(nm => { const cls = r.rec.classes; const ok = /^Shield \+/.test(nm) ? cls.some(c => QPR.PROT[c].shield) : /^(Plate|Banded|Chain) Mail \+/.test(nm) ? cls.some(c => QPR.PROT[c][nm.split(' ')[0].toLowerCase()]) : /^Leather Armor \+/.test(nm) ? cls.some(c => QPR.PROT[c].leather) : /^Ring of Protection/.test(nm) ? cls.some(c => QPR.PROT[c].ring) : /^Bracers/.test(nm) ? cls.some(c => QPR.PROT[c].bracers) : true; if (!ok) bad.push(tag + ' ' + nm + ' not on the App. P table for ' + cls); });
        if (appP && !/Made by the Random PC button as a PC on the spot/.test(sh.nt)) bad.push(tag + ' notes');
        // the worn marks give a legal, best armour class: no other combination of the worn marks is better
        if (SR.wearables(sh).length > 1 && SR.wearables(sh).length <= 8) {
            const ws = SR.wearables(sh), n = ws.length; let bestAc = 99;
            for (let mask = 0; mask < (1 << n); mask++) { const c = JSON.parse(JSON.stringify(sh)); ws.forEach((w, k) => SR.setWorn(c, w.i, !!(mask & (1 << k)), 0)); bestAc = Math.min(bestAc, SR.compute(SR.sanitize(c)).d.ac); }
            if (v.d.ac !== bestAc) bad.push(tag + ' AC ' + v.d.ac + ' but a better wear gives ' + bestAc);
        }
    }
    check('(i) Random PC, 960 sheets: Methods I-IV with and without the Appendix P switch are legal, level inside the band, under 16 kB, best worn marks', bad.length === 0, bad.slice(0, 5).join(' | '));
    check('(i) without the switch there are no magic items; with it there are (protective items on the DMG p.226 table, misc items above 5th level)', plain === 480 && magicPCs > 40 && protSeen > 10 && miscSeen > 5, magicPCs + ' of ' + appN + ' with magic, ' + protSeen + ' protective, ' + miscSeen + ' with misc');
    // AC cases. Fighter, Dex 10 (no adjustment), so the figures are the DMG's own.
    const S = (inv, o) => { const s = SR.blank(); s.sc = [14, 10, 10, 10, 10, 10]; s.inv = inv; Object.assign(s, o || {}); return SR.compute(s); };
    const W = ['w'], cases = [
        ['no armour', [], 10], ['chain mail (worn by default, as before)', [['Chain', 1]], 5], ['chain mail marked not worn', [['Chain', 1, 'x']], 10], ['plain chain and small shield', [['Chain', 1], ['Shield, small', 1]], 4],
        ['chain at an inn is never worn', null, 10],
        ['Chain Mail +1 carried, not worn (magic is off until ticked)', [['Chain Mail +1', 1, 30]], 10], ['Chain Mail +1 worn: one better than chain (DMG p.164)', [['Chain Mail +1', 1, 30, 'w']], 4],
        ['Plate Mail +5 worn', [['Plate Mail +5', 1, 45, 'w']], -2], ['Plate Mail of Etherealness is +5 plate', [['Plate Mail of Etherealness', 1, 45, 'w']], -2], ['Etherealness after 5 charges is +4 (DMG p.165)', [['Plate Mail of Etherealness +4', 1, 45, 'w']], -1],
        ['Plate Mail of Vulnerability -2 is worse than plain plate (DMG p.165)', [['Plate Mail of Vulnerability -2', 1, 45, 'w']], 5], ['... -4', [['Plate Mail of Vulnerability -4', 1, 45, 'w']], 7],
        ['Leather Armor +1 worn', [['Leather Armor +1', 1, 15, 'w']], 7], ['Studded Leather +1', [['Studded Leather +1', 1, 20, 'w']], 6], ['Splint Mail +4', [['Splint Mail +4', 1, 40, 'w']], 0],
        ['small shield worn: one better', [['Shield, small', 1]], 9], ['Shield +1 alone is armour class 8 (DMG p.164)', [['Shield +1', 1, 5, 'w']], 8], ['Shield +3', [['Shield +3', 1, 5, 'w']], 6],
        ['Shield, large, +1, +4 vs. missiles: 8 in melee', [['Shield, large, +1, +4 vs. missiles', 1, 10, 'w']], 8], ['Shield -1, missile attractor is no better than no shield (DMG p.165)', [['Shield -1, missile attractor', 1, 5, 'w']], 10],
        ['two shields: the best counts', [['Shield, small', 1], ['Shield +2', 1, 5, 'w']], 7],
        ['Chain Mail +1 and Shield +2', [['Chain Mail +1', 1, 30, 'w'], ['Shield +2', 1, 5, 'w']], 1],
        ['two suits worn: the best counts (plain chain 5, plate 3)', [['Chain', 1], ['Plate', 1]], 3],
        ['Ring of Protection +1 alone', [['Ring of Protection +1', 1, 0, 'w']], 9], ['Ring +4 on AC, +2 on saves', [['Ring of Protection +4 on AC, +2 on saving throws', 1, 0, 'w']], 6], ['Ring +6 on AC, +1 on saves', [['Ring of Protection +6 on AC, +1 on saving throws', 1, 0, 'w']], 4],
        ['Ring +2, 5 foot radius: the wearer gets +2 AC', [["Ring of Protection +2, 5' radius", 1, 0, 'w']], 8],
        ['Ring +2 with plain chain: cumulative (DMG p.130)', [['Chain', 1], ['Ring of Protection +2', 1, 0, 'w']], 3], ['Ring +2 with magic armour: no AC (DMG p.130)', [['Chain Mail +1', 1, 30, 'w'], ['Ring of Protection +2', 1, 0, 'w']], 4],
        ['Ring +2 with a magic shield (not armour): works', [['Shield +1', 1, 5, 'w'], ['Ring of Protection +2', 1, 0, 'w']], 6],
        ['two rings of protection: only the strongest', [['Ring of Protection +2', 1, 0, 'w'], ['Ring of Protection +3', 1, 0, 'w']], 7], ['a pair of +2 rings is still +2 (DMG p.130)', [['Ring of Protection +2', 2, 0, 'w']], 8],
        ['protection ring plus another ring: both worn, 2 rings is fine', [['Ring of Protection +1', 1, 0, 'w'], ['Ring of Invisibility', 1, 0, 'w']], 9], ['three rings worn: none function (DMG p.129)', [['Ring of Protection +1', 1, 0, 'w'], ['Ring of Invisibility', 1, 0, 'w'], ['Ring of Fire Resistance', 1, 0, 'w']], 10],
        ['Bracers of Defense AC 4 alone', [['Bracers of Defense AC 4', 1, 0, 'w']], 4], ['Bracers as Quick Party names them', [['Bracers of Defense, AC 6', 1, 0, 'w']], 6], ['Bracers and plain chain: not effective (DMG p.139)', [['Chain', 1], ['Bracers of Defense AC 2', 1, 0, 'w']], 5],
        ['Bracers with leather: armour is worn, not effective', [['Leather', 1], ['Bracers of Defense AC 2', 1, 0, 'w']], 8], ['Bracers with Ring +2: other protection works (DMG p.139)', [['Bracers of Defense AC 4', 1, 0, 'w'], ['Ring of Protection +2', 1, 0, 'w']], 2],
        ['Bracers with a plain shield: the shield is already in the bracers', [['Bracers of Defense AC 4', 1, 0, 'w'], ['Shield, small', 1]], 4], ['Bracers with Shield +2: the plus adds', [['Bracers of Defense AC 4', 1, 0, 'w'], ['Shield +2', 1, 5, 'w']], 2],
        ['Cloak of Protection +2 alone', [['Cloak of Protection +2', 1, 2.5, 'w']], 8], ['cloak with leather works (DMG p.141)', [['Leather', 1], ['Cloak of Protection +2', 1, 2.5, 'w']], 6], ['cloak with chain does not function', [['Chain', 1], ['Cloak of Protection +2', 1, 2.5, 'w']], 5],
        ['cloak with studded leather does not function (read as leather armour only)', [['Studded', 1], ['Cloak of Protection +2', 1, 2.5, 'w']], 7], ['cloak with magic leather does not function', [['Leather Armor +1', 1, 15, 'w'], ['Cloak of Protection +2', 1, 2.5, 'w']], 7],
        ['cloak with a plain shield does not function (any shield, DMG p.141)', [['Shield, small', 1], ['Cloak of Protection +2', 1, 2.5, 'w']], 9], ['cloak with a magic shield does not function', [['Shield +1', 1, 5, 'w'], ['Cloak of Protection +2', 1, 2.5, 'w']], 8],
        ['cloak with bracers and a ring: all combine', [['Bracers of Defense AC 4', 1, 0, 'w'], ['Ring of Protection +1', 1, 0, 'w'], ['Cloak of Protection +2', 1, 2.5, 'w']], 1], ['Cloak of Displacement +2', [['Cloak of Displacement', 1, 2.5, 'w']], 8],
        ['Boots of Striding and Springing +1', [['Boots of Striding and Springing', 1, 3, 'w']], 9], ['Boots of Speed +2', [['Boots of Speed', 1, 3, 'w']], 8], ['dusty rose prism +1', [['Ioun Stone, dusty rose prism', 1, 0, 'w']], 9],
        ['Staff of Power +2', [['Staff of Power', 1, 10, 'w']], 8], ['Helm of Brilliance +2', [['Helm of Brilliance', 1, 4.5, 'w']], 8], ['Sword +4, Defender holding 3 for AC', [['Sword +4, Defender', 1, 5, 'w3']], 7], ['Defender holding nothing', [['Sword +4, Defender', 1, 5, 'w']], 10],
        ['unworn magic items do nothing', [['Ring of Protection +3', 1, 0], ['Cloak of Protection +3', 1, 2.5], ['Bracers of Defense AC 2', 1, 0], ['Staff of Power', 1, 10]], 10],
        ['legacy custom armour row with an AC is worn as before', [['Elven Mithril Shirt', 1, 15, 3]], 3], ['Dexterity 16 adds -2', [['Chain', 1]], 3, { sc: [14, 10, 10, 16, 10, 10] }], ['Dexterity 3 adds +4', [], 14, { sc: [14, 10, 10, 3, 10, 10] }]
    ];
    const abad = [];
    cases.forEach(c => {
        let v;
        if (c[1] === null) { const s = SR.blank(); s.sc = [14, 10, 10, 10, 10, 10]; s.lp = [['Inn', 0, 0, 0, 0, 0]]; s.inv = [['Chain', 1, '1']]; v = SR.compute(s); }
        else v = S(c[1], c[3]);
        if (v.d.ac !== c[2] || v.ac.total !== c[2]) abad.push(c[0] + ': ' + v.d.ac + ' expected ' + c[2]);
        const sum = v.ac.rows.reduce((t, r) => t + r.d, 10); if (sum !== v.ac.total) abad.push(c[0] + ' build-up does not add up');
    });
    check('(i) armour class for ' + cases.length + ' worn/unworn cases and every combination rule (DMG p.124-169) equals the hand-worked figure', abad.length === 0, abad.slice(0, 6).join(' | '));
    // missiles figure, monk, saves
    check('(i) Shield, large, +1, +4 vs. missiles: AC 5 against missiles (DMG p.165)', S([['Shield, large, +1, +4 vs. missiles', 1, 10, 'w']]).ac.vsMissiles === 5 && S([['Shield +1', 1, 5, 'w']]).ac.vsMissiles === null);
    const monk = (inv) => { const s = SR.blank(); s.cl = ['Monk']; s.al = 'LN'; s.sc = [15, 10, 15, 16, 11, 10]; s.inv = inv; return SR.compute(s); };
    const m0 = monk([]), m1 = monk([['Ring of Protection +2', 1, 0, 'w']]), m2 = monk([['Chain', 1], ['Shield +2', 1, 5, 'w']]);
    check('(i) a monk keeps the table AC and no Dexterity adjustment (PHB p.30-31); a ring adds, armour and shields are ignored', m1.d.ac === m0.d.ac - 2 && m2.d.ac === m0.d.ac, m0.d.ac + ' ' + m1.d.ac + ' ' + m2.d.ac);
    const sv0 = S([]), sv1 = S([['Ring of Protection +2', 1, 0, 'w'], ['Cloak of Displacement', 1, 2.5, 'w']]), svM = S([['Chain Mail +1', 1, 30, 'w'], ['Ring of Protection +2', 1, 0, 'w']]);
    const svOk = SR.SAVE_NAMES.every(k => sv1.saves[k].base === sv0.d.saves[k] && sv1.saves[k].eff === Math.max(1, sv0.d.saves[k] - 4) && sv0.saves[k].eff === sv0.d.saves[k] && svM.saves[k].eff === Math.max(1, sv0.d.saves[k] - 2));
    check('(i) saving throws: ring +2 and cloak of displacement +2 lower every target by 4 (a bonus on the die); the ring still adds to saves with magic armour; none worn changes nothing', svOk && sv1.ac.save === 4 && svM.ac.save === 2 && svM.ac.armourSave[0].n === 1);
    check('(i) cloak of protection gives its plus to saves only when it functions; a ring over the 2-ring limit gives none', S([['Cloak of Protection +3', 1, 2.5, 'w']]).ac.save === 3 && S([['Chain', 1], ['Cloak of Protection +3', 1, 2.5, 'w']]).ac.save === 0 && S([['Ring of Protection +1', 1, 0, 'w'], ['Ring of Invisibility', 1, 0, 'w'], ['Ring of Fire Resistance', 1, 0, 'w']]).ac.save === 0);
    // worn marks: compact, stable, old saves
    const o1 = SR.blank(); o1.inv = [['Chain', 1], ['Shield, small', 1], ['Chain Mail +1', 1, 30, 4], ['Dagger and scabbard', 1], ['Ring of Protection +2', 1, 0, 10]];
    const o2 = JSON.parse(SR.pack(o1)), oc = SR.compute(o2);
    check('(i) an old save (no worn marks) loads: plain armour and shield worn, magic items carried but not worn; no mark is stored for defaults', JSON.stringify(o2.inv) === JSON.stringify([['Chain', 1], ['Shield, small', 1], ['Chain Mail +1', 1, 30, 4], ['Dagger and scabbard', 1], ['Ring of Protection +2', 1, 0, 10]]) && oc.d.ac === 4 && oc.ac.rows.length === 4);
    const t1 = SR.sanitize(o1); SR.setWorn(t1, 2, true, 0); SR.setWorn(t1, 0, false, 0); SR.setWorn(t1, 3, true, 0); SR.setWorn(t1, 4, true, 0);
    const t2 = JSON.parse(SR.pack(t1));
    check('(i) worn marks: only exceptions stored ("w" or "x"), a mark on a plain item is dropped, they survive pack and export/import, a mark never sits on an item left at a place', JSON.stringify(t2.inv) === JSON.stringify([['Chain', 1, 'x'], ['Shield, small', 1], ['Chain Mail +1', 1, 30, 4, 'w'], ['Dagger and scabbard', 1], ['Ring of Protection +2', 1, 0, 10, 'w']]) &&
        JSON.stringify(SR.parseImport(SR.exportText(t1)).inv) === JSON.stringify(t2.inv) && SR.sanitize({ cl: ['Fighter'], lp: [['Inn', 0, 0, 0, 0, 0]], inv: [['Chain', 1, 'x', '1'], ['Chain Mail +1', 1, 30, 'w', '1']] }).inv.every(r => r[r.length - 1] === '1' && r.indexOf('w') < 0));
    const mv = SR.sanitize({ cl: ['Fighter'], lp: [['Inn', 0, 0, 0, 0, 0]], inv: [['Chain Mail +1', 1, 30, 'w']] }); SR.moveItem(mv, 0, 1, 0); const atInn = JSON.stringify(mv.inv); SR.moveItem(mv, 0, 0, 0);
    check('(i) moving a worn item to a place drops the mark (never worn there); bringing it back gives the default', atInn === '[["Chain Mail +1",1,30,"1"]]' && JSON.stringify(mv.inv) === '[["Chain Mail +1",1,30]]');
    const bw = SR.sanitize({ cl: ['Fighter'], sc: [16, 10, 10, 10, 10, 10], inv: [['Chain', 1], ['Shield, small', 1], ['Chain Mail +1', 1, 30], ['Ring of Protection +2', 1, 0], ['Cloak of Protection +3', 1, 2.5], ['Bracers of Defense AC 4', 1, 0], ['Shield +1', 1, 5]] });
    SR.bestWear(bw); const bwv = SR.compute(bw);
    let bestAny = 99; { const ws = SR.wearables(bw); for (let mask = 0; mask < (1 << ws.length); mask++) { const c = SR.sanitize(JSON.parse(JSON.stringify(bw))); ws.forEach((w, k) => SR.setWorn(c, w.i, !!(mask & (1 << k)), 0)); bestAny = Math.min(bestAny, SR.compute(c).d.ac); } }
    check('(i) "Wear the best set" reaches the lowest armour class of all combinations', bwv.d.ac === bestAny, bwv.d.ac + ' vs ' + bestAny);
    // the Simple view shows the worn magic items and the saves with the bonus
    const simp = G('SheetSimple').html(S([['Chain', 1], ['Ring of Protection +2', 1, 0, 'w'], ['Cloak of Protection +2', 1, 2.5]]), true);
    check('(i) Simple view: worn chips list the worn ring and chain, the unworn cloak is carried gear; saves show the lowered figure with the table figure in brackets', /Worn: armour, shield, magic items/.test(simp) && /<li>Ring of Protection \+2<\/li>/.test(simp) && /Cloak of Protection \+2/.test(simp.split('Gear carried')[1] || '') && /<small class="muted">\(\d+\)<\/small>/.test(simp));
    // Wizard characters: starting spells go to the spell book, nothing memorised (TB confirmed 2026-11-12)
    const wz = SR.fromCreator({ race: 'Human', sex: 'm', classes: ['Magic-User'], levels: { 'Magic-User': 1 }, scores: { str: 10, int: 16, wis: 10, dex: 12, con: 10, cha: 10 }, alignment: 'N', hp: 4, spells: [{ s: 'Read Magic', cls: 'Magic-User' }, { s: 'Sleep', cls: 'Magic-User' }, { s: 'Magic Missile', cls: 'Magic-User' }, { s: 'Light', cls: 'Magic-User' }] }, 'W');
    check('(i) a wizard magic-user: all four starting spells in the spell book (known), nothing memorised', wz.sk['Magic-User'][0].length === 4 && Object.keys(wz.sm).every(k => wz.sm[k].every(l => l.length === 0)));
}
// ---- (i) the typed protective-item rules diffed against the DMG text (pages 81, 124, 129-130, 134, 139-141, 145, 147, 164-165)
if (fs.existsSync(path.join(root, '..', '..', '..', 'ADD-BOOKS-PDF', 'TEXT'))) {
    const BK = path.join(root, '..', '..', '..', 'ADD-BOOKS-PDF', 'TEXT');
    const norm = t => t.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[–−—]/g, '-').replace(/[’]/g, "'").replace(/\s+/g, ' ');
    const cache = {}, pg = n => cache[n] || (cache[n] = norm(fs.readFileSync(path.join(BK, 'DMG', 'p' + String(n).padStart(3, '0') + '.txt'), 'utf8')));
    const miss = [];
    SR.WEAR_TEXT.forEach(x => x[2].forEach(f => { if (!pg(x[1]).includes(norm(f))) miss.push('p.' + x[1] + ' ' + x[0] + ': ' + f); }));
    SR.MAGIC_AC_PICK.filter(m => /^Magic (armour|shields)/.test(m[0])).forEach(m => { const base = m[1].replace(/ -\d$/, ''); if (!pg(124).includes(norm(base))) miss.push('p.124 picker: ' + m[1]); });
    check('(f) every protective-item rule fragment and every magic armour or shield name matches the DMG page text (' + SR.WEAR_TEXT.reduce((a, x) => a + x[2].length, 0) + ' fragments)', miss.length === 0, miss.slice(0, 5).join(' | '));
    // figures: ring table, bracers table, cloak table against the data the code uses
    const ring = SR.protectiveInfo, rb = [];
    [['Ring of Protection +1', 1, 1], ['Ring of Protection +2', 2, 2], ["Ring of Protection +2, 5' radius", 2, 2], ['Ring of Protection +3', 3, 3], ['Ring of Protection +4 on AC, +2 on saving throws', 4, 2], ['Ring of Protection +6 on AC, +1 on saving throws', 6, 1]].forEach(r => { const i = ring(r[0]); if (!i || i.a !== r[1] || i.s !== r[2]) rb.push(r[0]); });
    [8, 7, 6, 5, 4, 3, 2].forEach(a => { const i = ring('Bracers of Defense AC ' + a); if (!i || i.ac !== a) rb.push('bracers ' + a); });
    [1, 2, 3, 4, 5].forEach(p => { const i = ring('Cloak of Protection +' + p); if (!i || i.a !== p || i.s !== p) rb.push('cloak ' + p); });
    check('(f) ring of protection (AC and save plusses from the DMG p.130 table), bracers AC 8 to 2 (p.139) and cloaks +1 to +5 (p.141) are read as printed', rb.length === 0, rb.join(' | '));
}


// ---- (j) combat mode, step 1: state, surprise, initiative, phases, log (COMBAT_SPEC 8.2, 8.3, 9; DMG p.61-63)
{
    const CS = G('CombatState'), uuid = i => ('00000000-0000-4000-8000-' + String(i).padStart(12, '0'));
    const ids = Array.from({ length: 40 }, (_, i) => uuid(i)), side = ids.map((_, i) => i < 6 ? 0 : 1);
    const mk = () => CS.create(ids, side, ['Party', 'Goblins'], [2, 2]);
    let c = mk();
    check('(j) combat state has the spec 8.2 shape (v, on, rd, ph, sg, op, sd[], w, ro[]) and stays under the key namespace', ['v', 'on', 'rd', 'ph', 'sg', 'op', 'sd', 'w', 'ro'].every(k => k in c) && c.sd.length === 2 && c.ro.length === 40 && c.sd[0].m.length === 6 && c.sd[1].m.length === 34 && CS.KEY === 'io.github.solid-state-games.1e-toolkit/combat' && CS.KEY === SR.NS + '/combat');
    check('(j) all restrictions at their section 9 defaults when op is 0 (declare off, the rest on); one bit per toggle; switching round-trips', !CS.isOn(c, 'cm.declare') && CS.isOn(c, 'cm.surprise') && CS.isOn(c, 'cm.phase-order') && (CS.setToggle(c, 'cm.declare', true), CS.isOn(c, 'cm.declare') && c.op === 2) && (CS.setToggle(c, 'cm.initiative', false), !CS.isOn(c, 'cm.initiative') && c.op === 66) && (CS.setToggle(c, 'cm.declare', false), CS.setToggle(c, 'cm.initiative', true), c.op === 0) && CS.TOGGLES.every(t => t.b < 31));
    // surprise cells: every roll pair against ranges 1 to 6 equals the text reading (DMG p.61-62, ruling A1), and 1 vs 2 is one segment for the higher roller
    let bad = 0;
    for (let ra = 0; ra <= 6; ra++) for (let rb = 0; rb <= 6; rb++) for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) {
        const x = CS.create(['a', 'b'], [0, 1], ['A', 'B'], [ra, rb]);
        if (ra) CS.rollSurprise(x, 0, a); if (rb) CS.rollSurprise(x, 1, b);
        if (!ra && !rb) CS.resolveSurprise(x);
        const sa = ra && a <= ra ? a : 0, sb = rb && b <= rb ? b : 0, d = sa - sb;
        if (x.sd[0].sl !== Math.max(0, d) || x.sd[1].sl !== Math.max(0, -d)) bad++;
    }
    check('(j) surprise: 2401 range and roll cells match the DMG p.61-62 text (segments lost = the surprised side\'s die, both surprised subtract, equal = none)', bad === 0, bad + ' wrong');
    let s = CS.create(['a', 'b'], [0, 1], ['Party', 'Goblins'], [2, 2]); CS.rollSurprise(s, 0, 1); CS.rollSurprise(s, 1, 2);
    check('(j) surprise 1 vs 2 (both surprised): the side that rolled 2 loses 1 segment, the side that rolled 1 loses none; banner bars the surprised side', s.sd[0].sl === 0 && s.sd[1].sl === 1 && s.sg === 1 && CS.barred(s, 1) && !CS.barred(s, 0) && /Party acts\. Goblins cannot act/.test(CS.banner(s).b));
    s = CS.create(['a', 'b'], [0, 1], ['Party', 'Goblins'], [2, 2]); CS.rollSurprise(s, 1, 2); CS.rollSurprise(s, 0, 5);
    check('(j) surprise 2 vs 5 (only the 2 is in range): the 2-side loses 2 segments, then round 1', s.sd[1].sl === 2 && s.sd[0].sl === 0 && CS.advance(s).ok && s.sg === 2 && CS.advance(s).ok && s.rd === 1 && s.sg === 0);
    // DEX reaction per individual (S03, PHB p.11 Table I): 16 +1, 17 +2, 18 +3, 6 to 15 none, 3 -3
    const dx = d => CS.indivSegs(s0, 0, d), s0 = CS.create(['a', 'b'], [0, 1], ['P', 'F'], [2, 2]);
    CS.rollSurprise(s0, 0, 4); CS.rollSurprise(s0, 1, 6); s0.sd[0].ra = 4; CS.resolveSurprise(s0);
    check('(j) surprise DEX: 3 segments lost becomes 3 (DEX 10), 2 (16), 1 (17), 0 (18), 6 (DEX 3); an unsurprised side stays 0; switch off ignores DEX', s0.sd[0].sl === 4 && s0.sd[1].sl === 0 && dx(10) === 4 && dx(16) === 3 && dx(17) === 2 && dx(18) === 1 && dx(3) === 7 && CS.indivSegs(s0, 1, 3) === 0 && (CS.setToggle(s0, 'cm.surprise-dex', false), dx(18) === 4));
    check('(j) a range of 0 (prior detection, S04) needs no roll and surprises nobody; skip goes to round 1', (() => { const k = CS.create(['a', 'b'], [0, 1], ['P', 'F'], [0, 0]); const ok = CS.resolveSurprise(k) && CS.maxSl(k) === 0 && CS.advance(k).ok && k.rd === 1; const k2 = CS.create(['a', 'b'], [0, 1], ['P', 'F'], [2, 2]); const stop = !CS.advance(k2).ok; CS.skipSurprise(k2); return ok && stop && k2.rd === 1; })());
    // phase order: round 0, then declare (if on), initiative, first side, second side, end, next round (R02, I02)
    let p = CS.create(['a', 'b'], [0, 1], ['Party', 'Goblins'], [2, 2]); CS.skipSurprise(p);
    const trail = []; CS.rollInit(p, 0, 5); CS.rollInit(p, 1, 2);
    for (let i = 0; i < 6; i++) { trail.push(p.rd + ':' + p.ph + ':' + CS.banner(p).b); CS.advance(p); }
    check('(j) phase order: initiative, winner acts, other side acts, end of round, then round 2 starts with fresh initiative', trail.slice(0, 5).join(' | ') === '1:1:Rolling initiative | 1:2:Party acts | 1:3:Goblins acts | 1:4:End of round | 2:1:Rolling initiative' && p.rd === 2 && p.sd[0].in === 0 && p.w === -1, trail.join(' | '));
    p = CS.create(['a', 'b'], [0, 1], ['Party', 'Goblins'], [2, 2]); CS.skipSurprise(p);
    check('(j) cannot leave initiative until both sides have rolled; the lower roller goes second', !CS.advance(p).ok && (CS.rollInit(p, 0, 2), !CS.advance(p).ok) && CS.rollInit(p, 1, 6) === 1 && CS.advance(p).ok && CS.banner(p).b === 'Goblins acts' && (CS.advance(p), CS.banner(p).b === 'Party acts'));
    p = CS.create(['a', 'b'], [0, 1], ['Party', 'Goblins'], [2, 2]); CS.skipSurprise(p); CS.rollInit(p, 0, 4); CS.rollInit(p, 1, 4); CS.advance(p);
    check('(j) tied initiative is simultaneous: one "both sides act" phase, then end of round; the A23 tie note is there', p.w === 2 && /together \(tie\)/.test(CS.banner(p).b) && CS.advance(p).ok && p.ph === 4 && /longer weapon/.test(CS.TIE_NOTE) && /lower speed factor/.test(CS.TIE_NOTE));
    p = CS.create(['a', 'b'], [0, 1], ['Party', 'Goblins'], [2, 2]); CS.setToggle(p, 'cm.declare', true); CS.skipSurprise(p);
    const dtr = [p.ph]; CS.advance(p); dtr.push(p.ph);
    CS.setToggle(p, 'cm.initiative', false); CS.setFirst(p, 1); CS.setToggle(p, 'cm.phase-order', false); CS.advance(p); dtr.push(p.ph); const anyB = CS.banner(p).b; CS.advance(p); dtr.push(p.ph);
    check('(j) declare step only when switched on (0 then 1); initiative off lets the GM pick; side order off skips the second-side phase', dtr.join('') === '0124' && anyB === 'Goblins has initiative. Sides act in any order');
    check('(j) round counter switch: banner says Combat, not a round number, when off', (() => { const k = mk(); CS.skipSurprise(k); const a = CS.banner(k).a; CS.setToggle(k, 'cm.rounds', false); return a === 'Round 1' && CS.banner(k).a === 'Combat'; })());
    // size with a 40-token roster, 13 rounds of 40 log entries, folded as 8.3 says
    const logs = {}, sum = []; let big = mk(); CS.skipSurprise(big);
    let maxB = 0, folded = 0;
    for (let r = 1; r <= 13; r++) {
        big.rd = r; for (let e = 0; e < 40; e++) CS.logAdd(logs, r, [e % 10, e % 2 ? 2 : 0, e % 40, (e + 7) % 40, 14, 12, 6, 30, 3]);
        folded += CS.fold(big, logs, sum).length; maxB = Math.max(maxB, CS.bytesOf(big, logs, sum));
    }
    check('(j) metadata size: combat with a 40-token roster alone is small, and 13 busy rounds with the fold stay under 14 kB', CS.bytesOf(mk(), {}, []) < 3500 && maxB <= 14000 && folded >= 7, 'combat ' + CS.bytesOf(mk(), {}, []) + ' B, peak ' + maxB + ' B, ' + folded + ' folded');
    check('(j) log fold: rounds older than the last 6 become [round, winner, 0,0,0,0] lines in log/s, oldest first; the current round is never folded', sum.length === folded && sum.every((x, i) => x.length === 6 && (i === 0 || x[0] > sum[i - 1][0])) && logs[13] && Object.keys(logs).length <= 6);
    const fl = {}, fs = [], fc = mk(); CS.skipSurprise(fc); CS.logAdd(fl, 1, CS.entry(0, 0, 0, 5, 0, 0)); CS.logAdd(fl, 1, CS.entry(0, 0, 1, 2, 0, 0)); fc.rd = 8; CS.logAdd(fl, 8, CS.entry(0, 0, 0, 1, 0, 0));
    const rem = CS.fold(fc, fl, fs);
    check('(j) a folded round keeps its initiative winner; the patch deletes the folded key (undefined) and writes the summary', rem.join() === '1' && fs[0].join() === '1,0,0,0,0,0' && (() => { const pt = CS.patch(fc, fl, fs, rem); return 'io.github.solid-state-games.1e-toolkit/log/1' in pt && pt['io.github.solid-state-games.1e-toolkit/log/1'] === undefined && Array.isArray(pt['io.github.solid-state-games.1e-toolkit/log/s']); })());
    // log entries: kind 0 initiative, 1 surprise; the source is kept; export reads as text; clear removes our keys only
    const lg = {}, lc = CS.create(['a', 'b'], [0, 1], ['Party', 'Goblins'], [2, 2]); CS.logAdd(lg, 0, CS.entry(0, 1, 0, 1, 2, 2)); CS.logAdd(lg, 1, CS.entry(0, 0, 1, 4, 0, 1));
    const txt = CS.exportText(lc, lg, [], n => 'tok' + n);
    check('(j) log entries record kind and source; the export is plain text with sides, surprise segments and rounds', /Party rolled 1 for surprise, surprised on 1 to 2 \(Owlbear Dice tray\)/.test(txt) && /Goblins rolled 4 for initiative \(physical die typed in\)/.test(txt) && /Surprise segments/.test(txt) && /Round 1/.test(txt) && /Party \(tok0\) \| Goblins \(tok1\)/.test(txt));
    const meta = { other: 1 }; meta[CS.KEY] = lc; meta[CS.LOGP + '0'] = lg[0]; const clr = CS.clearPatch(meta), rd = CS.read(meta);
    check('(j) read gives back the state and logs; clear unsets our keys and leaves other keys alone', rd.c && rd.logs[0].length === 1 && Object.keys(clr).length === 2 && !('other' in clr) && Object.values(clr).every(v => v === undefined) && CS.read({}).c === null);
    check('(j) an old scene with no combat key reads as no combat; the banner never says undefined or NaN', CS.read({ a: 1 }).c === null && (() => { const k = mk(); const all = []; for (let i = 0; i < 12; i++) { all.push(CS.banner(k).a + CS.banner(k).b); CS.rollInit(k, 0, 3); CS.rollInit(k, 1, 4); CS.advance(k); } return !BAD.test(all.join(' ')); })());
}


// ---- (k) combat mode, rework: one-button steps, undo, tray, who rolls, Not fighting, derived surprise ranges, earlier surprise
{
    const CS = G('CombatState'), mk = (sd) => CS.create(['a', 'b', 'c'], sd || [0, 1, 1], ['Party', 'Goblins'], [2, 2]);
    // the whole round on one button
    let c = mk(), lg = {}; const labels = [];
    const go = (v, src) => { labels.push(CS.primary(c)); return CS.step(c, lg, v, src || 0, []); };
    const r0 = go([]);
    go([1, 2]);   // surprise: Goblins lose 1
    go(); go([5, 2]); go(); go(); go(); go();
    check('(k) one button per step: roll surprise, the surprised side\'s segment, roll initiative, each side acts, next round', !r0.ok && r0.need.join() === '0,1' && labels.join(' | ') === 'Roll surprise | Roll surprise | Party acts: done | Roll initiative | Party acts: done | Goblins act: done | Next round | Roll initiative' && c.rd === 2 && c.ph === 1 && c.sd[0].in === 0, labels.join(' | '));
    check('(k) a step that needs dice refuses to move without them, and a rolled step moves on by itself (initiative lands on first side acts)', (() => { const k = mk(); CS.skipSurprise(k); const a = CS.step(k, {}, [], 0, []); const b = CS.step(k, {}, [4, 1], 0, []); return !a.ok && b.ok && k.ph === 2 && k.w === 0; })());
    const sl = (() => { const k = mk(); CS.rollSurprise(k, 0, 1); CS.rollSurprise(k, 1, 2); return CS.stepList(k).map(x => x.k + ':' + x.st).join(); })();
    check('(k) step list: surprise done with its result, segment current; round 1 list is initiative, first side, second side, end, current one marked', sl === 'sur:done,seg:cur,r1:todo' && (() => { const k = mk(); CS.skipSurprise(k); CS.step(k, {}, [5, 2], 0, []); const L = CS.stepList(k); return L.map(x => x.st).join() === 'done,cur,todo,todo' && L[0].res === 'Party wins (5 to 2)' && L[1].label === 'Party acts' && L[2].label === 'Goblins act'; })() && CS.stepList((() => { const k = mk(); CS.rollSurprise(k, 0, 1); CS.rollSurprise(k, 1, 2); return k; })())[0].res === 'Goblins lose 1', sl);
    // undo (persisted stack): snapshot before, pushUndo after
    c = mk(); lg = {}; let st = []; CS.skipSurprise(c); let b4 = CS.takeSnap(c, lg); CS.step(c, lg, [3, 6], 0, []); CS.pushUndo(st, b4, lg, 'Roll initiative'); const logged = (lg[1] || []).length;
    CS.undo(c, lg, st);
    check('(k) undo puts back the step fields, drops the log lines the step added and logs a kind 9 entry', c.ph === 1 && c.w === -1 && c.sd[0].in === 0 && logged === 3 && lg[1].length === 1 && lg[1][0][1] === 9 && /GM undid: Roll initiative/.test(CS.entryText(lg[1][0], c)) && CS.visible(lg[1]).length === 1 && st.length === 0);
    c = mk(); lg = {}; st = []; CS.skipSurprise(c); b4 = CS.takeSnap(c, lg); CS.step(c, lg, [3, 6], 0, []); CS.pushUndo(st, b4, lg, 'Roll initiative'); c.ph = 4; b4 = CS.takeSnap(c, lg); CS.step(c, lg, [], 0, []); CS.pushUndo(st, b4, lg, 'Next round'); b4 = CS.takeSnap(c, lg); CS.step(c, lg, [2, 1], 0, []); CS.pushUndo(st, b4, lg, 'Roll initiative');
    const reload = JSON.parse(JSON.stringify(st)), r1 = CS.undo(c, lg, reload), r2 = CS.undo(c, lg, reload);
    check('(k) undo survives a reload (the stack is plain JSON) and walks back several steps, across a round change, reporting the later round\'s key as removed', r1.label === 'Roll initiative' && r2.label === 'Next round' && r2.removed.join() === '2' && c.rd === 1 && c.ph === 4 && !lg[2] && reload.length === 1);
    // back into surprise
    c = mk(); lg = {}; st = []; b4 = CS.takeSnap(c, lg); CS.step(c, lg, [1, 2], 0, []); CS.pushUndo(st, b4, lg, 'Roll surprise'); b4 = CS.takeSnap(c, lg); CS.step(c, lg, [], 0, []); CS.pushUndo(st, b4, lg, 'Party acts: done');
    CS.undo(c, lg, st); const mid = c.rd === 0 && c.sg === 1; CS.undo(c, lg, st);
    check('(k) undo walks from round 1 back into the surprise segment and on to before the surprise roll', mid && c.rd === 0 && c.sg === 0 && c.sd[0].sr === 0 && c.sd[1].sl === 0 && !CS.surpriseReady(c) && lg[0].filter(e => e[1] !== 9).length === 0);
    // stack cap 20 and the size ceiling
    c = mk(); lg = {}; st = []; CS.skipSurprise(c);
    for (let i = 0; i < 30; i++) { b4 = CS.takeSnap(c, lg); CS.step(c, lg, c.ph === 1 ? [3, 2] : [], 0, []); CS.pushUndo(st, b4, lg, 'step ' + i); }
    check('(k) the undo stack keeps the last 20 steps', st.length === 20 && st[19].l === 'step 29' && st[0].l === 'step 10');
    const cz = mk(); CS.skipSurprise(cz); cz.rd = 12; const lz = {}, sz = [];
    for (let r = 10; r <= 12; r++) for (let e = 0; e < 40; e++) CS.logAdd(lz, r, [e % 10, 2, e % 40, (e + 7) % 40, 14, 12, 6, 30, 3, 'Aldric attacks Goblin 3: rolled 14, needs 12: hit']);
    for (let i = 0; i < 20; i++) sz.push(JSON.parse(JSON.stringify(st[19])));
    const noStack = CS.bytesOf(cz, lz, []), withStack = CS.bytesOf(cz, lz, [], sz), cap = noStack + 500, before = sz.length;
    CS.fold(cz, lz, [], cap, sz);
    check('(k) over the size ceiling the oldest undo steps are dropped first; the current round\'s log is never touched and no round is folded while undo steps can go', sz.length < before && sz.length > 0 && CS.bytesOf(cz, lz, [], sz) <= cap && withStack > cap && lz[12].length === 40 && lz[10] && lz[11]);
    const cy = mk(); CS.skipSurprise(cy); const ly = {}, sy = []; for (let e = 0; e < 40; e++) CS.logAdd(ly, 1, [0, 2, 0, 1, 14, 12, 6, 30, 3, 'x'.repeat(40)]);
    for (let i = 0; i < 20; i++) sy.push(JSON.parse(JSON.stringify(st[19])));
    CS.fold(cy, ly, [], 3000, sy);
    check('(k) with the ceiling too tight even for the current log, undo goes entirely before the current round is touched', sy.length === 0 && ly[1].length === 40);
    check('(k) patch carries the stack in its own key and clears it when empty; clearing combat removes it and `pre`', (st.length || st.push({ l: 'x', rd: 1, ph: 1, sg: 0, w: -1, s: [[0, 0, 0], [0, 0, 0]], n: 0, k: 0 })) && CS.patch(c, lg, [], [], st)[CS.UNDO].length === st.length && CS.patch(c, lg, [], [], [])[CS.UNDO] === undefined && (() => { const m = {}; m[CS.KEY] = c; m[CS.UNDO] = st; m[CS.PRE] = {}; m.other = 1; const k = CS.clearPatch(m); return k[CS.UNDO] === undefined && CS.UNDO in k && CS.PRE in k && !('other' in k); })() && CS.read((() => { const m = {}; m[CS.KEY] = c; m[CS.UNDO] = st; return m; })()).undo.length === st.length);
    // replaced rolls are hidden
    check('(k) the shown log keeps only the last roll a side made for a kind', CS.visible([CS.entry(0, 0, 0, 2, 0, 0), CS.entry(0, 0, 1, 3, 0, 0), CS.entry(0, 0, 0, 6, 0, 0)]).map(e => e[4]).join() === '3,6');
    check('(k) a step that logs into round 0 as round 1 starts (no surprise) still reaches the stored patch', (() => { const k = mk(), l = {}; CS.noSurprise(k, l); const pt = CS.patch(k, l, [], []); return k.rd === 1 && Array.isArray(pt[CS.LOGP + '0']); })());
    // tray: stale value ignored, first new value from an allowed roller taken, other-side roller ignored
    const md = (v, n) => ({ 'rodeo.owlbear.dice/rollValues': v, 'rodeo.owlbear.dice/roll': { n } });
    const P = (a, b, g) => [{ id: 'gm', name: 'GM', metadata: g || {} }, { id: 'p1', name: 'Sam', metadata: a || {} }, { id: 'p2', name: 'Kim', metadata: b || {} }];
    let base = CS.traySnap(P(md([4], 1), md([6], 1)));
    check('(k) tray: a roll already in the tray when the step asks is stale and never taken', CS.trayPick(base, P(md([4], 1), md([6], 1)), [['p1']]) === null);
    let pk = CS.trayPick(base, P(md([4], 2), md([6], 1)), [['p1']]);
    check('(k) tray: the first new single d6 is taken, even when it repeats the old number, and says who rolled it', pk && pk.value === 4 && pk.name === 'Sam' && pk.j === 0 && CS.trayPick(base, P(md([4], 2), md([6], 1)), [['p1']]) === null);
    base = CS.traySnap(P(md([1], 1), md([1], 1), md([1], 1)));
    check('(k) tray: a roll from a player who may not roll for that side is ignored (Foes: GM only; Party: its owners only)', CS.trayPick(base, P(md([5], 9), md([1], 1), md([1], 1)), [['gm']]) === null && (base = CS.traySnap(P(md([1], 1), md([1], 1), md([1], 1))), CS.trayPick(base, P(md([1], 1), md([4], 8), md([1], 1)), [['p1'], ['gm']]) === null) && (base = CS.traySnap(P(md([1], 1), md([1], 1), md([1], 1))), CS.trayPick(base, P(md([1], 1), md([1], 1), md([2], 7)), [['p1']]) === null));
    base = CS.traySnap(P(md([1], 1), md([1], 1), md([1], 1)));
    pk = CS.trayPick(base, P(md([1], 1), md([3], 5), md([2], 6)), [['p1'], ['gm']]);
        base = CS.traySnap(P({}, {}, {}));
    const t1 = CS.trayPick(base, P(md([3], 1), {}, md([6], 1)), [['p1', 'p2'], ['gm']]), w2 = [['p1', 'p2'], ['gm']]; w2[t1.j] = null; const t2 = CS.trayPick(base, P(md([3], 1), {}, md([6], 1)), w2);
    check('(k) tray: parallel needs: a Party roll fills need 0, the GM roll fills need 1; two dice or a d8 result is no d6', t1 && t2 && [t1, t2].some(x => x.j === 0 && x.value === 3) && [t1, t2].some(x => x.j === 1 && x.value === 6) && CS.dieOf(md([3, 4], 1)) === null && CS.dieOf(md([8], 1)) === null && CS.dieOf(md([{ value: 5 }], 1)) === 5);
    // rollerFor
    const own = ['p1', 'p2', ''], cc = mk();
    check('(k) rollerFor: a side with player-owned tokens is rolled by those owners, a side with none by the GM, a token by its owner else the GM', CS.rollerFor(cc, own, 'gm', { side: 0 }).join() === 'p1' && (CS.moveToken(cc, 1, 0), CS.rollerFor(cc, own, 'gm', { side: 0 }).join() === 'p1,p2') && CS.rollerFor(cc, own, 'gm', { side: 1 }).join() === 'gm' && CS.rollerFor(cc, own, 'gm', { token: 0 }).join() === 'p1' && CS.rollerFor(cc, own, 'gm', { token: 2 }).join() === 'gm');
    // Not fighting
    const nf = CS.create(['a', 'b', 'c', 'd'], [0, 1, 2, 2], ['Party', 'Goblins'], [2, 2]);
    check('(k) Not fighting: stored in the roster but in neither side, so it is left out of fighters, owners for rolls and banner; moving in and out works', nf.nf.join() === '2,3' && CS.fighters(nf).join() === '0,1' && CS.sideOf(nf, 2) === 2 && CS.rollerFor(nf, ['p1', 'p2', 'p3', 'p4'], 'gm', { side: 1 }).join() === 'p2' && (CS.moveToken(nf, 2, 1), CS.sideOf(nf, 2) === 1 && nf.nf.join() === '3') && (CS.moveToken(nf, 2, 2), nf.nf.join() === '2,3' && nf.sd[1].m.join() === '1') && !/Not fighting/.test(JSON.stringify(CS.banner(nf))));
    // derived surprise ranges
    const M = (name, cls, race, mon) => ({ name, cls: cls || [], race: race || '', mon: mon || null });
    const dr = (a, b, ta, tb) => CS.deriveRanges([{ members: a, elfTick: !!ta }, { members: b, elfTick: !!tb }]);
    let d = dr([M('Aldric', ['Fighter', 'Ranger'], 'Human')], [M('Goblin')]);
    check('(k) a ranger in the party (multi-class counts): party surprised on 1 only (PHB p.24), foes surprised on 1-3 (the party surprises on 1-3)', d[0].ra === 1 && d[1].ra === 3 && /Aldric \(ranger\)/.test(d[0].txt) && /PHB p\.24/.test(d[0].pg), JSON.stringify(d));
    const aerial = CS.monsterOf('Aerial servant');
    d = dr([M('Aldric', ['Ranger'], 'Human')], [M('Aerial servant', [], '', aerial)]); const d0 = dr([M('Bob', ['Fighter'], 'Human')], [M('Aerial servant', [], '', aerial)]);
    check('(k) a monster that surprises on 1-4 (MM p.6, by token name) makes the party surprised on 1-4, and a ranger cuts that to 1-3', d0[0].ra === 4 && d[0].ra === 3 && d[1].ra === 3 && CS.monsterOf('Aerial servant (2)').key === 'Aerial servant' && CS.monsterOf('Nobody') === null);
    d = dr([M('Elwen', ['Fighter'], 'Elf')], [M('Goblin')]); const dt = dr([M('Elwen', ['Fighter'], 'Elf')], [M('Goblin')], true);
    check('(k) elf or halfling surprise 1-4 only when the GM ticks the condition; tick off leaves 1-2 (PHB p.16, p.17)', d[1].ra === 2 && d[0].ra === 2 && dt[1].ra === 4 && dr([M('Pip', ['Thief'], 'Halfling')], [M('G')], true)[1].ra === 4 && dr([M('Pip', ['Thief'], 'Human')], [M('G')], true)[1].ra === 2);
    check('(k) ranges: no members gives the usual 1-2; a side that surprises on 1-6 or an overwhelming factor floors at 0 and caps at 6; a GM override sticks', dr([], [])[0].ra === 2 && (() => { const k = mk(); CS.applyRanges(k, [{ ra: 1 }, { ra: 3 }]); const a = k.sd[0].ra === 1 && k.sd[1].ra === 3; CS.setRange(k, 0, 5); CS.applyRanges(k, [{ ra: 1 }, { ra: 3 }]); return a && k.sd[0].ra === 5 && k.sd[0].ov === 1 && k.sd[1].ra === 3; })());
    // already rolled: same maths, source "rolled earlier"
    let badE = 0;
    for (let ra = 0; ra <= 4; ra++) for (let rb = 0; rb <= 4; rb++) for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) {
        const x = CS.create(['a', 'b'], [0, 1], ['A', 'B'], [ra, rb]), y = CS.create(['a', 'b'], [0, 1], ['A', 'B'], [ra, rb]), lx = {}, ly = {};
        CS.step(x, lx, CS.needs(x).map(i => [a, b][i]), 0, []); CS.applyEarlierSurprise(y, ly, [a, b]);
        if (JSON.stringify([x.rd, x.sg, x.sd[0].sl, x.sd[1].sl, x.sd[0].sr, x.sd[1].sr]) !== JSON.stringify([y.rd, y.sg, y.sd[0].sl, y.sd[1].sl, y.sd[0].sr, y.sd[1].sr])) badE++;
    }
    const ey = CS.create(['a', 'b'], [0, 1], ['Party', 'Goblins'], [2, 2]), el = {}; CS.applyEarlierSurprise(ey, el, [1, 2]);
    check('(k) surprise dice rolled earlier give exactly the segments of rolled ones (3 x 25 x 36 cells) and the log says "rolled earlier"; "no surprise" goes to round 1', badE === 0 && ey.sd[1].sl === 1 && /Party rolled 1 for surprise, surprised on 1 to 2 \(rolled earlier\)/.test(CS.exportText(ey, el, [], x => x)) && (() => { const k = mk(), l = {}; CS.noSurprise(k, l); return k.rd === 1 && /No surprise/.test(l[0][0][9]); })());
    check('(k) who rolled is kept in the entry and shown: "(Owlbear Dice tray by Sam)"', (() => { const k = mk(), l = {}; CS.skipSurprise(k); CS.step(k, l, [3, 4], 2, ['Sam', 'GM']); return /Party rolled 3 for initiative \(Owlbear Dice tray by Sam\)/.test(CS.entryText(l[1][0], k)) && /Goblins rolled 4 for initiative \(Owlbear Dice tray by GM\)/.test(CS.entryText(l[1][1], k)); })());
    check('(k) which sides may act now: tie both, otherwise the winner then the other; round 0 the unsurprised side; none while rolling', (() => { const k = mk(); CS.skipSurprise(k); const n0 = CS.actingSides(k).length; CS.step(k, {}, [5, 2], 0, []); const a = CS.actingSides(k).join(); CS.advance(k); const b = CS.actingSides(k).join(); const t = mk(); CS.skipSurprise(t); CS.step(t, {}, [3, 3], 0, []); const s = mk(); CS.rollSurprise(s, 0, 1); CS.rollSurprise(s, 1, 2); return n0 === 0 && a === '0' && b === '1' && CS.actingSides(t).join() === '0,1' && CS.actingSides(s).join() === '0'; })());
}


// ---- (l) combat step 2a: right-click sides, attack tool target picking, the to-hit number, more than two sides
{
    const CS = G('CombatState'), CA = G('CombatAttack'), GC = G('GMCombat');
    const meta0 = {}, p0 = CS.sidesPatch(meta0, ['x', 'y'], 1);
    const inCombat = (() => { const c = CS.create(['a', 'b'], [0, 1], ['Party', 'Goblins'], [2, 2]); const m = {}; m[CS.KEY] = c; return m; })();
    const p1 = CS.sidesPatch(inCombat, ['a', 'new1', 'new2'], 1), c1 = p1[CS.KEY], p2 = CS.sidesPatch(inCombat, ['b'], 2);
    check('(l) side menu before combat records the choice in `pre` (several tokens at once), merging with earlier choices', p0[CS.PRE].x === 1 && p0[CS.PRE].y === 1 && Object.keys(CS.sidesPatch({ [CS.PRE]: { z: 0 } }, ['x'], 2)[CS.PRE]).length === 2 && !(CS.KEY in p0));
    check('(l) side menu in combat moves tokens and adds tokens not yet in the roster; Not fighting takes the side count', c1.sd[1].m.join() === '0,1,2,3' && c1.sd[0].m.length === 0 && c1.ro.join() === 'a,b,new1,new2' && p2[CS.KEY].nf.join() === '1' && p2[CS.KEY].sd[1].m.length === 0 && inCombat[CS.KEY].sd[1].m.join() === '1');
    // more than two sides in the new code
    const c3 = CS.create(['a', 'b', 'c', 'd'], [0, 1, 2, 3], ['A', 'B', 'C'], [2, 2, 2]);
    check('(l) the new code handles any number of sides: 3 sides plus Not fighting in create, sideOf, moveToken, the side menu', c3.sd.length === 3 && c3.nf.join() === '3' && CS.sideOf(c3, 2) === 2 && CS.sideOf(c3, 3) === 3 && (CS.moveToken(c3, 3, 0), CS.sideOf(c3, 3) === 0) && (CS.moveToken(c3, 0, 3), c3.nf.join() === '0'));
    // hit test and requests
    const boxes = [{ id: 'a', min: { x: 0, y: 0 }, max: { x: 100, y: 100 } }, { id: 'b', min: { x: 80, y: 0 }, max: { x: 180, y: 100 } }];
    check('(l) hit test: the token whose bounds hold the point, nearest centre when bounds overlap, nothing off the tokens', CA.hit({ x: 20, y: 50 }, boxes) === 'a' && CA.hit({ x: 150, y: 50 }, boxes) === 'b' && CA.hit({ x: 95, y: 50 }, boxes) === 'b' && CA.hit({ x: 85, y: 50 }, boxes) === 'a' && CA.hit({ x: 500, y: 500 }, boxes) === null);
    const its = [{ id: 'a', createdUserId: 'p1', metadata: {} }, { id: 'b', createdUserId: 'gm', metadata: {} }, { id: 'c', createdUserId: 'gm', metadata: { [SR.OWNER_KEY]: 'p2' } }];
    check('(l) who may attack: a player only from tokens they own (assigned owner, else placer); the GM from any; no self-attack, no empty drop', CA.request('PLAYER', 'p1', its, 'a', 'b', 1).ok && !CA.request('PLAYER', 'p1', its, 'b', 'a', 1).ok && !CA.request('PLAYER', 'p1', its, 'c', 'a', 1).ok && CA.request('PLAYER', 'p2', its, 'c', 'a', 1).ok && CA.request('GM', 'gm', its, 'a', 'b', 1).ok && !CA.request('GM', 'gm', its, 'a', 'a', 1).ok && !CA.request('GM', 'gm', its, 'a', 'zzz', 1).ok);
    // 8.6 checks 1 to 3
    const ac = CS.create(['a', 'b', 'c', 'd'], [0, 1, 0, 2], ['Party', 'Goblins'], [2, 2]); CS.skipSurprise(ac); const nmz = { a: 'Aldric', b: 'Goblin', c: 'Brenna', d: 'Bystander' };
    const pr = (a, t) => CA.problems(ac, a, t, nmz).map(x => x.id).join();
    CS.step(ac, {}, [5, 2], 0, []);   // Party has initiative: first side acts
    check('(l) checks: both tokens in the roster and fighting; attacker\'s side must act now; same-side attacks refused; every problem has a one-line reason', pr('a', 'b') === '' && pr('b', 'a') === 'phase' && pr('a', 'zz') === 'roster' && pr('d', 'b') === 'nf' && pr('a', 'c') === 'side' && CA.problems(ac, 'b', 'a', nmz)[0].msg === 'Goblins does not act now (Party acts).' || /Goblins/.test(CA.problems(ac, 'b', 'a', nmz)[0].msg));
    CS.advance(ac);
    const sx = CS.create(['a', 'b'], [0, 1], ['Party', 'Goblins'], [2, 2]); CS.rollSurprise(sx, 0, 1); CS.rollSurprise(sx, 1, 2);
    check('(l) checks: second side acts next; during a surprise segment the surprised side is barred; switching "Side order" off lifts the phase check', pr('b', 'a') === '' && pr('a', 'b') === 'phase' && CA.problems(sx, 'b', 'a', nmz).map(x => x.id).join() === 'surprise' && CA.problems(sx, 'a', 'b', nmz).length === 0 && (CS.setToggle(ac, 'cm.phase-order', false), pr('a', 'b') === ''));
    // to-hit numbers against COMBAT_CALC
    const pcSheet = Object.assign(SR.blank(), { race: 'Human', cl: ['Fighter'], lv: [7], sc: [10, 10, 10, 10, 10, 10], pf: ['Sword, Long & scabbard', 'Bow, long'] });
    const pcItem = { name: 'Aldric', metadata: { [SR.KEY]: SR.sanitize(pcSheet) } }, pcf = CA.facts(pcItem), wl = pcf.weapons.findIndex(w => w.name === 'Sword, long'), wb = pcf.weapons.findIndex(w => w.name === 'Bow, long');
    const wi = n => G('WEAPONS').findIndex(w => w.name === n);
    let badN = 0, cells = 0;
    [['fighter', 7, 'Sword, long', wl], ['fighter', 7, 'Bow, long', wb]].forEach(([cls, lv, wn, idx]) => { for (let ac2 = -2; ac2 <= 10; ac2++) for (const am of [0, 2, 5, 6]) { const type = G('acType')(am, false), ref = GC.toHitState({ cls, lv, wi: wi(wn), ac: ac2, armorIdx: am, shield: false, bonus: 0, penalty: 0, sit: 0, range: 'S', size: 'SM' }); cells++; if (CA.need(pcf, idx, ac2, type, 0) !== ref.need) badN++; } });
    check('(l) PC to-hit number (sheet class, level, weapon adjustment against the armour type) equals COMBAT_CALC for a level 7 fighter, sword and bow, ' + cells + ' cells', badN === 0 && pcf.kind === 'pc' && wl >= 0 && wb >= 0, badN + ' wrong');
    const strong = CA.facts({ name: 'Strong', metadata: { [SR.KEY]: SR.sanitize(Object.assign(SR.blank(), pcSheet, { sc: [17, 10, 10, 10, 10, 10] })) } });
    check('(l) STR 17 (+1 to hit, PHB p.9) makes a melee attack one easier, DEX 16 helps a missile attack (PHB p.11); a bonus of 2 lowers the number by 2', CA.need(strong, wl, 5, 7, 0) === CA.need(pcf, wl, 5, 7, 0) - 1 && CA.need(pcf, wl, 5, 7, 2) === CA.need(pcf, wl, 5, 7, 0) - 2 && CA.need(pcf, wl, 5, null, 0) === CA.need(pcf, wl, 5, 7, 0) + (pcf.weapons[wl].adj[10 - 7] || 0));
    let badM = 0; const mons = ['Ogre', 'Goblin', 'Kobold', 'Aerial servant', 'Anhkheg', 'Ape, carnivorous'];
    mons.forEach(m => { const f = CA.facts({ name: m, metadata: {} }); if (f.kind !== 'mon') { badM++; return; } for (let a2 = -3; a2 <= 9; a2++) { const ref = GC.toHitState({ cls: 'monster', lv: f.col, wi: 0, ac: a2, armorIdx: 10, shield: false, bonus: 0, penalty: 0, sit: 0, range: 'S', size: 'SM' }); if (CA.need(f, 0, a2, null, 0) !== ref.need) badM++; } });
    const og = CA.facts({ name: 'Ogre', metadata: {} }), gb = CA.facts({ name: 'Goblin 3', metadata: {} });
    check('(l) monster to-hit by hit dice from the MM by exact name (a trailing number is ignored) equals the COMBAT_CALC monster matrix; the AC comes from the MM', badM === 0 && og.mm === 'Ogre' && og.col === 5 && gb.mm === 'Goblin' && gb.ac === 6 && og.ac === 5 && CA.facts({ name: 'Nobody', metadata: {} }).kind === 'none');
    check('(l) hit dice to matrix column: 1-1 and 1+1 and 4+1 and 16', CA.monsterCol({ hitDice: '1-1', hdValue: 0.9 }) === 1 && CA.monsterCol({ hitDice: '1', hdValue: 1 }) === 2 && CA.monsterCol({ hitDice: '1+1', hdValue: 1.1 }) === 3 && CA.monsterCol({ hitDice: '3', hdValue: 3 }) === 4 && CA.monsterCol({ hitDice: '4+1', hdValue: 4.1 }) === 5 && CA.monsterCol({ hitDice: '8+2', hdValue: 8 }) === 7 && CA.monsterCol({ hitDice: '16', hdValue: 16 }) === 11);
    const tgt = CA.facts({ name: 'Chainy', metadata: { [SR.KEY]: SR.sanitize(Object.assign(SR.blank(), pcSheet, { inv: [['Chain', 1], ['Shield, small', 1]] })) } });
    check('(l) target armour type for a PC is suit and shield only (chain with shield = 4), AC from the sheet; hit when the d20 is at least the number, no automatic hit or miss on 20 or 1', tgt.type === 4 && typeof tgt.ac === 'number' && /rolled 14, needs 12: hit/.test(CA.text('Aldric', 'Goblin 3', 14, 12, true)) && /needs 12: miss/.test(CA.text('A', 'B', 11, 12, false)) && /GM override/.test(CA.text('A', 'B', 11, 12, false, true)));
    // d20 from the tray
    const md = (v, n) => ({ 'rodeo.owlbear.dice/rollValues': v, 'rodeo.owlbear.dice/roll': { n } });
    const bs = CS.traySnap([{ id: 'p1', metadata: md([3], 1) }]);
    check('(l) tray d20: a new single die up to 20 is taken from the attacker\'s owner, a 17 is no d6, rolls by others are ignored', CS.trayPick(bs, [{ id: 'p1', name: 'Sam', metadata: md([3], 1) }], [['p1']], 20) === null && (CS.trayPick(bs, [{ id: 'p2', name: 'Kim', metadata: md([17], 5) }], [['p1']], 20) === null) && CS.trayPick(bs, [{ id: 'p1', name: 'Sam', metadata: md([17], 6) }], [['p1']], 20).value === 17 && CS.dieOf(md([17], 1)) === null && CS.dieOf(md([17], 1), 20) === 17);
    const ae = CS.entry(2, 2, 0, 14, 12, 4 | 1, 'Aldric attacks Goblin 3: rolled 14, needs 12: hit', 'Sam'); ae[3] = 1;
    check('(l) attack log entry is kind 2 with actor, target, roll, need and the roll source; it is visible to everyone', ae[1] === 2 && ae[2] === 0 && ae[3] === 1 && ae[4] === 14 && ae[5] === 12 && (ae[8] & 3) === 1 && CS.visible([ae]).length === 1 && CS.entryText(ae, c3) === 'Aldric attacks Goblin 3: rolled 14, needs 12: hit');
}

const html = ['index.html', 'guide.html', 'js/app.js', 'css/toolkit.css'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
check('no TSR or WotC marks, no em dashes in UI copy', !/TSR|Wizards of the Coast|ADVANCED D&D|—/.test(html.replace(credit, '')));

console.log(fails ? '\n' + fails + ' of ' + total + ' FAILED' : '\nall ' + total + ' checks passed');
process.exit(fails ? 1 : 0);
