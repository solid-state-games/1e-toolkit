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
const fighter = SR.sanitize(Object.assign(SR.blank(), { cl: ['Fighter'], lv: [7], sc: [18, 10, 10, 16, 15, 10], ex: 60, pf: ['Sword, Long & scabbard'], inv: [['Sword, Long & scabbard', 1, 'h']] }));
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
        inv: [['Leather', 1], ['Shield, small', 1], ['Dagger and scabbard', 2, 'h'], ['Rope, 50\'', 1], ['Sling stone', 20], ['Dart', 6, 'r']], co: [1, 22, 0, 3, 0],
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
            rec.equipment.forEach(e => { const plain = /^(Plate Mail|Banded Mail|Splint Mail|Chain Mail|Scale Mail|Studded Leather|Ring Mail|Leather Armor|Padded Armor|Shield|Long Sword|Dagger|Mace|Scimitar|Staff|Spear|Long Bow & Arrows|Thieves' Picks & Tools)$/.test(e); const mw = /^(Long Sword|Dagger|Mace|Scimitar|Staff|Spear|Battle Axe|Long Bow|Javelin) \+(\d)$/.exec(e); if (mw ? !sh.inv.some(r => SR.entryParts(r).bonus === Number(mw[2])) : plain ? false : !sh.nt.includes(e) || !rows.includes(e.slice(0, 60))) bad.push(tag + ' item lost ' + e); });
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


// ---- (n) simple combat (TB 2026-11-16): state, surprise words, initiative, rounds and turns, pairs, to-hit both ways, hits and morale flag, hit points, casualties, spells
{
    const CS = G('CombatState'), CA = G('CombatAttack'), GC = G('GMCombat'), W = n => G('WEAPONS').filter(w => w.name === n)[0], uuid = i => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
    const mk = (sd) => CS.create(['a', 'b', 'c'], sd || [0, 1, 1], ['Party', 'Goblins'], [2, 2]);
    const ids = Array.from({ length: 40 }, (_, i) => uuid(i)), big = CS.create(ids, ids.map((_, i) => i < 6 ? 0 : i < 38 ? 1 : 2), ['Party', 'Goblins'], [2, 2]);
    for (let i = 0; i < 4; i++) CS.addSpell(big, i, 'Hold Person', 6); for (let i = 0; i < 12; i++) big.rr[i] = { ls: ['17 vs 14: hit, 6 damage'], dm: 6, hits: 1, tk: 20 + i, ap: 0 };
    check('(n) combat state: v2 shape, the roster stored once, a 40-token roster with 12 roll results and 4 spells stays well under 14 kB (about ' + JSON.stringify(big).length + ' B)', ['v', 'on', 'rd', 'tn', 'w', 'ro', 'nf', 'sd', 'ht', 'lh', 'sp', 'rr'].every(k => k in big) && !('pr' in big) && big.v === 2 && JSON.stringify(big).length < 4500 && CS.KEY === SR.NS + '/combat' && CS.CS === SR.NS + '/cs');
    let c = mk(); c.rr[1] = { ls: ['x'], dm: 1, hits: 0, tk: 0, ap: 0 }; CS.moveToken(c, 1, 2);
    check('(n) sides: Not fighting is in the roster but in no side; moving a token to it drops its roll result; any number of sides works', c.nf.join() === '1' && !(1 in c.rr) && CS.fighters(c).join() === '0,2' && CS.sideOf(c, 1) === 2 && (() => { const t = CS.create(['a', 'b', 'c', 'd'], [0, 1, 2, 3], ['A', 'B', 'C'], [2, 2, 2]); return t.sd.length === 3 && t.nf.join() === '3' && (CS.moveToken(t, 3, 0), CS.sideOf(t, 3) === 0); })());
    const meta0 = {}, p0 = CS.sidesPatch(meta0, ['x', 'y'], 1), inC = {}; inC[CS.KEY] = mk(); const p1 = CS.sidesPatch(inC, ['a', 'new1'], 1);
    check('(n) right-click sides: before combat the choice goes in `pre`; in combat tokens move and tokens not in the roster are added (original untouched)', p0[CS.PRE].x === 1 && !(CS.KEY in p0) && p1[CS.KEY].sd[1].m.join() === '0,1,2,3' && p1[CS.KEY].ro.length === 4 && inC[CS.KEY].ro.length === 3);
    // surprise words
    let bad = 0;
    for (let ra = 0; ra <= 6; ra++) for (let rb = 0; rb <= 6; rb++) for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) {
        const x = CS.create(['a', 'b'], [0, 1], ['A', 'B'], [ra, rb]); if (ra) CS.setSurprise(x, 0, a); if (rb) CS.setSurprise(x, 1, b);
        const sa = ra && a <= ra ? a : 0, sb = rb && b <= rb ? b : 0, d = sa - sb, got = CS.surpriseSegs(x);
        if (got[0] !== Math.max(0, d) || got[1] !== Math.max(0, -d)) bad++;
    }
    check('(n) surprise: 2401 range and die cells equal the DMG p.61-62 text (segments lost = the surprised side\'s die, both surprised subtract, equal = none)', bad === 0, bad + ' wrong');
    let s = CS.create(['a', 'b'], [0, 1], ['Party', 'Goblins'], [2, 2]); const w0 = CS.surpriseWords(s, () => null, k => 'k' + k);
    CS.setSurprise(s, 0, 4); CS.setSurprise(s, 1, 2); const w1 = CS.surpriseWords(s, () => null, k => 'k' + k);
    const s2 = CS.create(['a', 'b', 'c'], [0, 1, 1], ['Party', 'Goblins'], [2, 2]); CS.setSurprise(s2, 0, 5); CS.setSurprise(s2, 1, 2); const w2 = CS.surpriseWords(s2, () => null, k => 'k' + k);
    const s3 = CS.create(['a', 'b'], [0, 1], ['Party', 'Goblins'], [2, 2]); CS.setSurprise(s3, 0, 1); CS.setSurprise(s3, 1, 1); const s4 = CS.create(['a', 'b'], [0, 1], ['Party', 'Goblins'], [0, 0]);
    check('(n) surprise in words: "Goblins surprised: lose 2 segments; Party may act in segments 1-2", one segment singular, equal = no effect, none = nobody, a range of 0 needs no die, not rolled yet asks', /^Roll or type both dice/.test(w0.text) && w1.text === 'Goblins surprised: lose 2 segments; Party may act in segments 1-2.' && w2.text === w1.text && CS.surpriseWords(s3, () => null, k => k).text === 'Both sides surprised equally: no effect.' && CS.surpriseWords(s4, () => null, k => k).text === 'Nobody is surprised.' && (() => { const t = CS.create(['a', 'b'], [0, 1], ['Party', 'Goblins'], [2, 2]); CS.setSurprise(t, 0, 6); CS.setSurprise(t, 1, 1); const u = CS.create(['a', 'b'], [0, 1], ['Party', 'Goblins'], [2, 2]); CS.setSurprise(u, 0, 5); CS.setSurprise(u, 1, 6); return CS.surpriseWords(t, () => null, k => k).text === 'Goblins surprised: lose 1 segment; Party may act in segment 1.' && CS.surpriseWords(u, () => null, k => k).text === 'Nobody is surprised.'; })());
    const sd = CS.create(['a', 'b', 'c'], [0, 1, 1], ['Party', 'Goblins'], [2, 2]); CS.setSurprise(sd, 0, 4); CS.setSurprise(sd, 1, 6); sd.sd[0].ra = 4; const dxs = { 0: 17, 1: 3, 2: null }, wd = CS.surpriseWords(sd, k => dxs[k], k => ['Aldric', 'Brenna', 'x'][k]);
    check('(n) surprise: the DEX adjustment is listed per PC of the surprised side (PHB p.11: DEX 17 takes 2 off, 3 adds 3), nobody without a sheet; ranges as derived are used', /^Party surprised: lose 4 segments; Goblins may act in segments 1-4\.$/.test(wd.text) && wd.dex.join('|') === 'Aldric (DEX 17): loses 2 segments' && (() => { const t = CS.create(['a'], [0], ['Party', 'Goblins'], [4, 2]); CS.setSurprise(t, 0, 4); CS.setSurprise(t, 1, 6); return CS.surpriseWords(t, () => 3, () => 'Brenna').dex.join() === 'Brenna (DEX 3): loses 7 segments'; })());
    // initiative and rounds
    c = mk(); CS.rollInit(c, 0, 5); CS.rollInit(c, 1, 2); const t1 = CS.initText(c); CS.rollInit(c, 1, 5);
    check('(n) initiative: d6 per side, "Party 5, Goblins 2: Party goes first", a tie is simultaneous and the A23 note (longer weapon first, else lower speed factor, DMG p.66) is there', t1 === 'Party 5, Goblins 2: Party goes first' && c.w === 2 && /tie, both sides act together/.test(CS.initText(c)) && /longer weapon/.test(CS.TIE_NOTE) && /lower speed factor/.test(CS.TIE_NOTE) && CS.initText(mk()) === '');
    c = mk(); CS.addSpell(c, 0, 'Hold Person', 2); CS.addSpell(c, 1, 'Bless', 6); CS.rollInit(c, 0, 3); CS.rollInit(c, 1, 4); CS.hit(c, 0, 1); CS.hit(c, 0, 1); CS.hit(c, 1, 1);
    const ex1 = CS.nextRound(c), ex2 = CS.nextRound(c);
    check('(n) Next round: this round\'s hits become "last round", hits and initiative clear, the round counts up, spells count down and report when they run out', c.rd === 3 && c.lh.join() === '0,0' && c.ht.join() === '0,0' && c.w === -1 && c.sd[0].in === 0 && ex1.length === 0 && ex2.length === 1 && ex2[0][1] === 'Hold Person' && c.sp.length === 1 && c.sp[0][2] === 4 && (() => { const k = mk(); CS.hit(k, 0, 1); CS.nextRound(k); return k.lh.join() === '1,0'; })());
    c = mk(); const turns = []; for (let i = 0; i < 21; i++) { turns.push(c.tn + ':' + CS.roundInTurn(c)); CS.nextRound(c); }
    check('(n) turns: 1 turn = 10 rounds (PHB p.39): round 1 to 10 is turn 1, round 11 starts turn 2 at round 1 of 10, round 21 is turn 3', turns[0] === '1:1' && turns[9] === '1:10' && turns[10] === '2:1' && turns[19] === '2:10' && turns[20] === '3:1' && c.rd === 22);
    // hits and morale
    const mf = (a, b) => { const k = mk(); k.ht = [a, b]; return CS.moraleFlags(k); };
    check('(n) hits: + and - per side (never below 0); one side hitting at least twice as often as the other, and at least twice, tells the other to check morale (DMG p.67)', mf(2, 1).length === 1 && /^Goblins check morale: Party hit twice as often \(DMG p\.67\)\.$/.test(mf(2, 1)[0]) && mf(1, 0).length === 0 && mf(3, 2).length === 0 && mf(2, 2).length === 0 && mf(4, 2).length === 1 && /^Party check morale: Goblins hit/.test(mf(0, 3)[0]) && (() => { const k = mk(); CS.hit(k, 0, -1); CS.hit(k, 0, 1); CS.hit(k, 0, 1); CS.hit(k, 0, -1); return k.ht[0] === 1; })());
    // hit points
    check('(n) hit points: "-6" and "+3" change them, a number sets them (and lifts the maximum), the first number on a token with none is its maximum, nonsense is refused; 0 or less is dead (PHB p.105)', CS.hpEdit([10, 12], '-6').join() === '4,12' && CS.hpEdit([4, 12], '+3').join() === '7,12' && CS.hpEdit([4, 12], '9').join() === '9,12' && CS.hpEdit([4, 12], '15').join() === '15,15' && CS.hpEdit(null, '11').join() === '11,11' && CS.hpEdit(null, '-3') === null && CS.hpEdit([4, 12], 'abc') === null && CS.hpEdit([4, 12], '-4')[0] === 0 && CS.isDead([0, 12]) && CS.isDead([-2, 12]) && !CS.isDead([1, 12]) && !CS.isDead(null));
    let k = 0; const fixed = () => [0, 0.999, 0.5, 0.25][k++ % 4], hd1 = CS.rollHd('3+3', fixed); k = 0; const hd2 = CS.rollHd('1-1', () => 0), hd3 = CS.rollHd('4', () => 0.999);
    check('(n) hit points rolled from the MM hit dice: n d8 plus the modifier, at least 1 ("3+3" with dice 1, 8, 5 = 17; "1-1" on a 1 = 1; "4" on all 8s = 32; "1-7 hit points" a number from 1 to 7; fixed hit points as printed)', hd1.join() === '17,17' && hd2.join() === '1,1' && hd3.join() === '32,32' && CS.rollHd('nonsense') === null && CS.rollHd('100 hit points').join() === '100,100' && CS.rollHd('16 (128 hit points)').join() === '128,128' && CS.rollHd('1 hit point').join() === '1,1' && CS.rollHd('1-7 hit points', () => 0).join() === '1,1' && CS.rollHd('1-7 hit points', () => 0.999).join() === '7,7' && CS.rollHd('2-5 hit points', () => 0.5)[0] === 4 && CS.rollHd('\u00bd', () => 0.999).join() === '4,4' && CS.rollHd('8, 12 or 16', () => 0).join() === '8,8' && CS.rollHd('n/a') === null && CS.rollHd('\u2014') === null && (() => { let lo = 99, hi = 0; for (let i = 0; i < 2000; i++) { const h = CS.rollHd('2+1')[0]; lo = Math.min(lo, h); hi = Math.max(hi, h); } return lo >= 3 && hi <= 17 && lo <= 4 && hi >= 16; })());
    const cz = CS.create(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], [0, 1, 1, 1, 1, 1, 1, 0], ['Party', 'Goblins'], [2, 2]), dn = new Set([1, 2, 3]), cas = CS.casualties(cz, i => dn.has(i));
    check('(n) casualties: "Goblins down: 3 of 6 (50%)" with the DMG p.67 reminder (25% lost: morale +5; 50% lost: +15), nothing below 25%', cas[1].text === 'Goblins down: 3 of 6 (50%)' && /^50% lost: morale \+15/.test(cas[1].morale) && cas[0].morale === '' && (() => { const x = CS.casualties(cz, i => i === 1 || i === 2)[1]; return x.text === 'Goblins down: 2 of 6 (33%)' && /^25% lost: morale \+5/.test(x.morale); })() && CS.casualties(cz, i => i === 1)[1].morale === '' && CS.casualties(cz, () => false)[1].pct === 0);
    // spells
    c = mk();
    check('(n) spell rounds: a name and at least 1 round, kept per PC, counted down by Next round', CS.addSpell(c, 0, 'Web', 3) && !CS.addSpell(c, 0, '', 3) && !CS.addSpell(c, 0, 'x', 0) && c.sp.length === 1);
    // to-hit both ways against COMBAT_CALC
    const pcSheet = Object.assign(SR.blank(), { race: 'Human', cl: ['Fighter'], lv: [7], sc: [10, 10, 10, 10, 10, 10], pf: ['Sword, Long & scabbard', 'Bow, long', 'Crossbow, light', 'Crossbow, heavy', 'Dart'], inv: [['Chain', 1], ['Shield, small', 1], ['Sword, Long & scabbard', 1, 'h'], ['Bow, long', 1, 'r'], ['Crossbow, light', 1, 'r'], ['Crossbow, heavy', 1, 'r'], ['Dart', 3, 'r']] });
    const pcItem = { name: 'Aldric', metadata: { [SR.KEY]: SR.sanitize(pcSheet) } }, pcf = CA.facts(pcItem), wi = n => pcf.weapons.findIndex(w => w.name === n), wref = n => G('WEAPONS').findIndex(w => w.name === n);
    let badN = 0, cells = 0;
    [['Sword, long'], ['Bow, long']].forEach(([wn]) => { for (let ac2 = -2; ac2 <= 10; ac2++) for (const am of [0, 2, 5, 6]) { const ref = GC.toHitState({ cls: 'fighter', lv: 7, wi: wref(wn), ac: ac2, armorIdx: am, shield: false, bonus: 0, penalty: 0, sit: 0, range: 'S', size: 'SM' }); cells++; if (CA.need(pcf, wi(wn), ac2, G('acType')(am, false), 0) !== ref.need) badN++; } });
    const ogre = CA.facts({ name: 'Ogre', metadata: {} }), ape = CA.facts({ name: 'Ape, carnivorous', metadata: {} }), gob = CA.facts({ name: 'Goblin 3', metadata: {} });
    let badM = 0; [ogre, ape, gob, CA.facts({ name: 'Anhkheg', metadata: {} })].forEach(f => { for (let a2 = -3; a2 <= 9; a2++) { const ref = GC.toHitState({ cls: 'monster', lv: f.col, wi: 0, ac: a2, armorIdx: 10, shield: false, bonus: 0, penalty: 0, sit: 0, range: 'S', size: 'SM' }); if (CA.need(f, 0, a2, null, 0) !== ref.need) badM++; } });
    check('(n) to-hit, PC attacker (level 7 fighter, sword and bow against armour types, ' + cells + ' cells) and monster attacker (four monsters, AC -3 to 9) equal COMBAT_CALC', badN === 0 && badM === 0 && wi('Sword, long') >= 0, badN + ' PC wrong, ' + badM + ' monster wrong');
    const chainy = CA.facts({ name: 'Chainy', metadata: { [SR.KEY]: pcItem.metadata[SR.KEY] } });
    const pcVsOgre = CA.need(pcf, wi('Sword, long'), ogre.ac, ogre.type, 0), ogreVsPc = CA.need(ogre, 0, pcf.ac, pcf.type, 0);
    check('(n) a pair shows both directions: the fighter needs ' + pcVsOgre + ' against the Ogre (AC 5), the Ogre needs ' + ogreVsPc + ' against the chain-and-shield fighter; the target AC comes from the MM or the sheet and a typed AC changes the number', ogre.ac === 5 && pcf.type === 4 && typeof pcf.ac === 'number' && pcVsOgre === GC.toHitState({ cls: 'fighter', lv: 7, wi: wref('Sword, long'), ac: 5, armorIdx: 10, shield: false, bonus: 0, penalty: 0, sit: 0, range: 'S', size: 'L' }).need && ogreVsPc === GC.toHitState({ cls: 'monster', lv: ogre.col, wi: 0, ac: pcf.ac, armorIdx: 10, shield: false, bonus: 0, penalty: 0, sit: 0, range: 'S', size: 'SM' }).need && CA.need(pcf, wi('Sword, long'), 3, null, 0) === CA.need(pcf, wi('Sword, long'), 5, null, 0) + 2 && chainy.type === 4);
    // text
    const f13 = CA.facts({ name: 'F13', metadata: { [SR.KEY]: SR.sanitize(Object.assign(SR.blank(), pcSheet, { lv: [13] })) } }), f6 = CA.facts({ name: 'F6', metadata: { [SR.KEY]: SR.sanitize(Object.assign(SR.blank(), pcSheet, { lv: [6] })) } });
    check('(n) attacks per round as text: fighter 1, 3/2 (7th) and 2/1 (13th) (PHB p.25); bow "2 shots", light crossbow "1 shot", heavy "1 shot every other round", dart "3 shots" (PHB p.38); the Ape "3 attacks (1-4, 1-4, 1-8)", the Ogre "1 attack (1-10 or by weapon)"',
        CA.attacksText(f6, 0) === '1' && CA.attacksText(pcf, wi('Sword, long')) === '3/2' && CA.attacksText(f13, 0) === '2/1' && CA.attacksText(pcf, wi('Bow, long')) === '2 shots' && CA.attacksText(pcf, wi('Crossbow, light')) === '1 shot' && CA.attacksText(pcf, wi('Crossbow, heavy')) === '1 shot every other round' && CA.attacksText(pcf, wi('Dart')) === '3 shots' && CA.attacksText(ape, 0) === '3 attacks (1-4, 1-4, 1-8)' && CA.attacksText(ogre, 0) === '1 attack (1-10 or by weapon)');
    const swl = W('Sword, long'), strong = CA.facts({ name: 'S', metadata: { [SR.KEY]: SR.sanitize(Object.assign(SR.blank(), pcSheet, { sc: [17, 10, 10, 10, 10, 10] })) } });
    check('(n) damage die against S-M and against L (PHB p.37; long sword 1-8 and 1-12), with the STR bonus noted; a monster shows the MM damage; weapon speed factor (PHB p.38)', CA.damageText(pcf, wi('Sword, long')) === 'damage ' + swl.smTxt + ' vs S-M, ' + swl.lgTxt + ' vs L' && /vs S-M, .* vs L \+1 STR$/.test(CA.damageText(strong, wi('Sword, long'))) && CA.damageText(ape, 0) === 'damage 1-4/1-4/1-8' && CA.damageText(gob, 0).indexOf('damage') === 0 && CA.speedText(pcf, wi('Sword, long')) === 'speed ' + (swl.spd !== undefined ? '5' : '5') && CA.speedText(ogre, 0) === '');
    check('(n) missile weapons carry the firing-into-melee note (DMG p.63: chances by numbers, small half, large one and a half, picked at random); melee weapons do not', CA.isMissile(pcf, wi('Bow, long')) && !CA.isMissile(pcf, wi('Sword, long')) && !CA.isMissile(ogre, 0) && /DMG p\.63/.test(CA.MISSILE_NOTE) && /at random/.test(CA.MISSILE_NOTE) && /half/.test(CA.MISSILE_NOTE) && /one and a half/.test(CA.MISSILE_NOTE));
    check('(n) monster matrix column from hit dice, MM attack counts and AC, ', CA.monsterCol({ hitDice: '1-1', hdValue: 0.9 }) === 1 && CA.monsterCol({ hitDice: '4+1', hdValue: 4.1 }) === 5 && CA.monsterCol({ hitDice: '16', hdValue: 16 }) === 11 && CA.mmAttacks({ attacks: '1 or 2' }) === 1 && CA.mmAttacks({ attacks: 'See below' }) === 1 && ape.n === 3 && gob.ac === 6);
    // legacy clean-up
    const old = { v: 1, on: 1, rd: 4, ph: 2, sg: 0, op: 66, rs: 1, w: 0, ro: ['a', 'b', 'c'], nf: [2], sd: [{ n: 'Heroes', ra: 1, sr: 3, sl: 0, in: 5, ov: 1, m: [0] }, { n: 'Orcs', ra: 2, sr: 0, sl: 0, in: 2, m: [1] }], un: [], k: [], ak: {} };
    const lm = { [SR.NS + '/combat']: old, [SR.NS + '/undo']: [{ l: 'x' }], [SR.NS + '/log/1']: [[0]], [SR.NS + '/log/s']: [[1]], [SR.NS + '/pre']: { a: 1 }, other: 1 }, cp = CS.cleanPatch(lm), mig = cp[SR.NS + '/combat'];
    check('(n) clean-up on load: undo and every log/<round> key are deleted, an old-shape combat keeps its sides, names, ranges, roster and round and drops the rest; a v2 combat, `pre` and other keys are left alone', cp[SR.NS + '/undo'] === undefined && (SR.NS + '/undo') in cp && (SR.NS + '/log/1') in cp && (SR.NS + '/log/s') in cp && !(SR.NS + '/pre' in cp) && !('other' in cp) && mig.v === 2 && mig.rd === 4 && mig.tn === 1 && mig.sd[0].n === 'Heroes' && mig.sd[0].ra === 1 && mig.sd[0].ov === 1 && mig.nf.join() === '2' && mig.ro.length === 3 && !('ph' in mig) && Object.keys(CS.cleanPatch({ [SR.NS + '/combat']: mk(), x: 1 })).length === 0);
    check('(n) old per-token attack counts in `cs` are recognised and the new {h:[hp,max]} is not', CS.oldCs({ rs: 100, at: 1, mx: 2 }) && !CS.oldCs({ h: [5, 8] }) && !CS.oldCs(undefined));
    const cm = {}; cm[CS.KEY] = mk(); cm[CS.PRE] = { a: 1 }; cm[SR.NS + '/undo'] = []; const clr = CS.clearPatch(cm);
    check('(n) End combat clears the combat key, `pre` and any leftover undo and log keys, and nothing else', clr[CS.KEY] === undefined && CS.PRE in clr && (SR.NS + '/undo') in clr && Object.keys(clr).length === 3 && CS.read({}).c === null && CS.read(cm).c.v === 2);
}


// ---- (o) combat v2b: the Party | Foes row (target, to hit, damage, roll, apply), hits tally, sheet weapon roll
{
    const CS = G('CombatState'), CA = G('CombatAttack'), GC = G('GMCombat'), seq = a => { let k = 0; return () => a[k++ % a.length]; };
    const mkSheet = (o) => SR.sanitize(Object.assign(SR.blank(), { race: 'Human', cl: ['Fighter'], lv: [7], sc: [10, 10, 10, 10, 10, 10], pf: ['Sword, Long & scabbard', 'Bow, long', 'Dagger and scabbard'], inv: [['Chain', 1], ['Shield, small', 1], ['Sword, Long & scabbard', 1, 'h'], ['Bow, long', 1, 'r']] }, o || {}));
    const pc = CA.facts({ name: 'Aldric', metadata: { [SR.KEY]: mkSheet() } }), pc2 = CA.facts({ name: 'Brenna', metadata: { [SR.KEY]: mkSheet({ sc: [17, 10, 10, 10, 10, 10] }) } });
    const ogre = CA.facts({ name: 'Ogre', metadata: {} }), ape = CA.facts({ name: 'Ape, carnivorous', metadata: {} }), gob = CA.facts({ name: 'Goblin 2', metadata: {} }), npc = CA.facts({ name: 'Old Bob', metadata: {} });
    const wl = pc.weapons.findIndex(w => w.name === 'Sword, long'), wb = pc.weapons.findIndex(w => w.name === 'Bow, long');
    const r1 = CA.rowModel(pc, wl, ogre, null), r2 = CA.rowModel(pc, wl, gob, null), r3 = CA.rowModel(ogre, 0, pc, null), r4 = CA.rowModel(pc, wl, npc, null), r5 = CA.rowModel(pc, wl, npc, 4);
    check('(o) row to hit: a PC needs the sheet number less the weapon adjustment against the target (MM AC for monsters, sheet AC for PCs); the Ogre needs its HD number against the fighter; an unknown AC gives no number until the GM types one (and then it does)', r1.need === CA.need(pc, wl, 5, null, 0) && r1.ac === 5 && r2.ac === 6 && r3.need === GC.toHitState({ cls: 'monster', lv: ogre.col, wi: 0, ac: pc.ac, armorIdx: 10, shield: false, bonus: 0, penalty: 0, sit: 0, range: 'S', size: 'SM' }).need && r3.ac === pc.ac && r4.need === null && r5.need === CA.need(pc, wl, 4, null, 0) && r5.ac === 4);
    const swl = G('WEAPONS').filter(w => w.name === 'Sword, long')[0], pcStr = CA.rowModel(pc2, wl, ogre, null), vsPc = CA.rowModel(pc, wl, pc2, null);
    check('(o) row damage: a PC\'s weapon die against the target\'s size (long sword d8 vs S-M, d12 vs L: the Ogre is L, a goblin or a PC is S-M or M), the STR bonus added for melee; a monster shows each MM attack form', r1.size === 'L' && CA.diceText(r1.dice[0]) === '1d12' && r2.size === 'S' && CA.diceText(r2.dice[0]) === '1d8' && vsPc.size === 'M' && CA.diceText(vsPc.dice[0]) === '1d8' && CA.diceText(pcStr.dice[0]) === '1d12+1' && CA.rowModel(ape, 0, pc, null).dice.map(CA.diceText).join('/') === '1-4/1-4/1-8' && CA.rowModel(ape, 0, pc, null).count === 3 && r3.count === 1);
    check('(o) attacks in one roll: a bow\'s two shots (PHB p.38) each on their own line, a monster\'s attack forms in turn, one swing for a PC in melee', CA.rowModel(pc, wb, ogre, null).count === 2 && CA.rowModel(pc, wl, ogre, null).count === 1 && /2 shots/.test(CA.rowModel(pc, wb, ogre, null).attacks) && CA.rowModel(pc, wb, ogre, null).dice.length === 1);
    const base = { need: 14, count: 1, dice: [{ n: 1, die: 8, plus: 0 }] };
    const hit = CA.rollRow(base, seq([0.8, 0.625])), miss = CA.rollRow(base, seq([0.35, 0.5])), onNeed = CA.rollRow(base, seq([0.65, 0.0]));
    check('(o) roll: d20 against the need, hit when at least the number, then damage: "17 vs 14: hit, 6 damage" and "8 vs 14: miss" (no damage rolled on a miss); exactly the number is a hit; no automatic hit on 20 or miss on 1', hit.lines.join() === '17 vs 14: hit, 6 damage' && hit.hits === 1 && hit.dm === 6 && miss.lines.join() === '8 vs 14: miss' && miss.dm === 0 && onNeed.lines[0] === '14 vs 14: hit, 1 damage' && CA.rollRow({ need: 21, count: 1, dice: base.dice }, seq([0.99])).hits === 0 && CA.rollRow({ need: 0, count: 1, dice: base.dice }, seq([0.0, 0.0])).hits === 1);
    const ar = CA.rollRow({ need: 10, count: 3, dice: [{ label: '1-4', lo: 1, hi: 4 }, { label: '1-4', lo: 1, hi: 4 }, { label: '1-8', lo: 1, hi: 8 }] }, seq([0.9, 0.5, 0.1, 0.9, 0.99, 0.95, 0.75]));
    const bw = CA.rollRow({ need: 10, count: 2, dice: [{ n: 1, die: 6, plus: 0 }] }, seq([0.9, 0.5, 0.2, 0.5]));
    check('(o) a monster rolls each attack form in turn with its own damage (claw 1-4 and bite 1-8), a bow shoots twice as two lines, a miss costs no damage roll', ar.lines.length === 3 && /^19 vs 10 \(1-4\): hit, 3 damage$/.test(ar.lines[0]) && /^3 vs 10 \(1-4\): miss$/.test(ar.lines[1]) && /\(1-8\): hit, /.test(ar.lines[2]) && ar.hits === 2 && bw.lines.length === 2 && /^19 vs 10 \(shot 1\): hit, 4 damage$/.test(bw.lines[0]) && /\(shot 2\): miss$/.test(bw.lines[1]));
    let allOk = true; for (const [lo, hi, rn] of [[1, 4, 4], [2, 8, 4], [1, 6, 6], [3, 18, 6], [1, 10, 10], [5, 30, 6], [2, 5, 0]]) for (let i = 0; i < 200; i++) { const d = CA.rollDmg({ lo, hi }, Math.random); if (d < lo || d > hi) allOk = false; }
    check('(o) a monster damage form "n-m" is n dice (1-4 = d4, 2-8 = 2d4, 3-18 = 3d6, 1-10 = d10) and stays within its range', allOk && CA.rollDmg({ lo: 2, hi: 8 }, () => 0.999) === 8 && CA.rollDmg({ lo: 2, hi: 8 }, () => 0) === 2 && CA.rollDmg({ n: 1, die: 8, plus: 1 }, () => 0.999) === 9 && CA.rollDmg({ lo: 1, hi: 4 }, () => 0.5) === 3);
    check('(o) apply: damage comes off the hit points (a goblin 7/7 hit for 6 is 1/7, hit for 7 is 0 and dead, past 0 is dead), the maximum stays; a PC\'s sheet hp the same sum', CA.applyDamage([7, 7], 6).join() === '1,7' && CS.isDead(CA.applyDamage([7, 7], 7)) && CS.isDead(CA.applyDamage([7, 7], 12)) && CA.applyDamage([7, 7], 12)[1] === 7 && CA.applyDamage([30, 41], 8).join() === '22,41' && !CS.isDead(CA.applyDamage([30, 41], 8)));
    const c = CS.create(['a', 'b', 'c'], [0, 1, 1], ['Party', 'Goblins'], [2, 2]); CS.hit(c, 0, hit.hits); CS.hit(c, 0, miss.hits); CS.hit(c, 1, ar.hits); c.rr[0] = { ls: hit.lines, dm: 6, hits: 1, tk: 1, ap: 0 };
    check('(o) each hit ticks that side\'s Hits tally by one (a monster with two hits ticks two, a miss none); the GM can still adjust with + and -; the latest result per row is kept until Next round', c.ht.join() === '1,2' && (CS.hit(c, 1, -1), c.ht[1] === 1) && c.rr[0].dm === 6 && (CS.nextRound(c), c.rr && Object.keys(c.rr).length === 0 && c.lh.join() === '1,1'));
    check('(o) a PC target\'s hit points are the sheet\'s (hp, hm) and a PC with no maximum is not counted down; typed edits work on them: -6, +3, a number', CS.hpEdit([30, 41], '-6').join() === '24,41' && CS.hpEdit([30, 41], '+3').join() === '33,41' && CS.hpEdit([30, 41], '12')[0] === 12);
    // the sheet's weapon roll
    const sh7 = mkSheet({ sc: [17, 10, 10, 16, 10, 10], ex: 0 }), v7 = SR.compute(sh7), W7 = v7.weapons.filter(w => w.name === 'Sword, long')[0], B7 = v7.weapons.filter(w => w.name === 'Bow, long')[0];
    const rw = SR.rollWeapon(v7, W7, seq([0.5, 0.5, 0.5])), rb = SR.rollWeapon(v7, B7, seq([0.95, 0.5, 0.5]));
    let lowest = null; for (let a = -10; a <= 10; a++) if (11 >= v7.toHitRows.melee[a]) { lowest = a; break; }
    check('(o) sheet weapon roll: d20 plus the sheet\'s to-hit bonus (STR 17 +1 melee), "rolled 11 (+1) = 12", which armour class it hits from the class matrix, and damage against S-M (d8 +1 STR) and L (d12 +1)', rw.d20 === 11 && rw.bonus === 1 && rw.total === 12 && rw.ac === lowest && rw.sm === 5 + 1 && rw.lg === 7 + 1 && /rolled 11 \(\+1\) = 12/.test(rw.text) && /Damage 6 vs S-M, 8 vs L/.test(rw.text) && /armour class/.test(rw.text), rw.text);
    check('(o) sheet weapon roll for a missile weapon uses the DEX missile bonus (DEX 16 +1) and no STR damage; a natural 20 hits more, an unreachable roll says so', rb.bonus === v7.weapons.filter(w => w.name === 'Bow, long')[0].hitMod && rb.d20 === 20 && rb.sm === 4 && rb.lg === 4 && rb.ac !== null && SR.rollWeapon(v7, W7, seq([0.0, 0.0, 0.0])).d20 === 1 && /^Sword, long: rolled 1 \(\+1\) = 2;/.test(SR.rollWeapon(v7, W7, seq([0.0, 0.0, 0.0])).text));
    const old2 = { v: 2, on: 1, rd: 2, tn: 1, w: -1, ro: ['a'], nf: [], sd: [{ n: 'Party', ra: 2, sr: 0, in: 0, m: [0] }, { n: 'Foes', ra: 2, sr: 0, in: 0, m: [] }], pr: [[0, 1, 0, 0, null, null]], ht: [0, 0], lh: null, sp: [] }, cp = CS.cleanPatch({ [SR.NS + '/combat']: old2 });
    check('(o) clean-up on load drops the old pairs from a v0.6 combat and gives it an empty result map; combat state keeps working without them', !('pr' in cp[SR.NS + '/combat']) && cp[SR.NS + '/combat'].rd === 2 && (() => { const m = { [SR.NS + '/combat']: old2 }; return CS.read(m).c.rr !== undefined; })());
}

{
    // ---- (p) v0.9.0: weapons in hand, magic bonus, proficiency, two weapons (DMG p.70), token name
    const SWD = 'Sword, Long & scabbard', DAG = 'Dagger and scabbard', SPR = 'Spear', BOW = 'Bow, long', HAX = 'Axe, hand or throwing', ARR = 'Arrow, normal (12)';
    const mk = (o) => SR.sanitize(Object.assign(SR.blank(), { nm: 'Aldric Thistlewood', race: 'Human', cl: ['Fighter'], lv: [5], sc: [10, 10, 10, 10, 10, 10], pf: [SWD, DAG, HAX] }, o || {}));
    const names = v => v.weapons.map(w => w.name + (w.kind === 'missile' ? '*' : '')).join(',');
    const a = SR.compute(mk({ inv: [[SWD, 1, 'h'], [DAG, 1], [SPR, 1, '1'], [BOW, 1, 'r'], [ARR, 2, 'r'], [HAX, 1, 'x']], lp: [['Inn', 0, 0, 0, 0, 0]], pf: [DAG, SPR] }));
    check('(p) weapons table = carried In hand or Ready only (not proficient-only, not carried-unmarked, not left at a place)', names(a) === 'Sword, long,Bow, long*', names(a));
    const b = mk({ inv: [[SWD, 1, 'h']], lp: [['Inn', 0, 0, 0, 0, 0]] }), b2 = SR.moveItem(JSON.parse(JSON.stringify(b)), 0, 1, 0);
    check('(p) an item moved to a place loses its hand mark and never shows in the table; moving back leaves it unmarked', SR.locOf(b2.inv[0]) === 1 && SR.compute(b2).weapons.length === 0 && SR.setHand(b2, 0, 'h').inv[0].length === 3 && SR.compute(b2).weapons.length === 0 && SR.compute(SR.moveItem(b2, 0, 0, 0)).weapons.length === 0);
    check('(p) a hand mark written on a place row (hostile save) is dropped by sanitize', SR.sanitize({ lp: [['Inn', 0, 0, 0, 0, 0]], inv: [[SWD, 1, 'h', '1']] }).inv.every(e => !/h/.test(e.slice(2).join(''))) && SR.compute(SR.sanitize({ inv: [[SWD, 1, '1h']], lp: [['Inn', 0, 0, 0, 0, 0]] })).weapons.length === 0);
    const base = SR.compute(mk({ inv: [[SWD, 1, 'h']] })).weapons[0], plus = SR.compute(mk({ inv: [[SWD, 1, 'h+2']] })).weapons[0], minus = SR.compute(mk({ inv: [[SWD, 1, 'h-1']] })).weapons[0];
    check('(p) Bonus +2 adds to hit and to damage; -1 subtracts (DMG p.168); both shown in the roll line', plus.hitMod === base.hitMod + 2 && plus.dmgMod === base.dmgMod + 2 && minus.hitMod === base.hitMod - 1 && minus.dmgMod === base.dmgMod - 1 && /rolled/.test(SR.rollWeapon(SR.compute(mk({ inv: [[SWD, 1, 'h+2']] })), plus, () => 0.5).text));
    check('(p) Bonus is clamped to -5..+5 and set through setBonus; the name is not parsed ("Sword +3" in the name adds nothing)', SR.entryParts(SR.setBonus(mk({ inv: [[SWD, 1, 'h']] }), 0, 9).inv[0]).bonus === 5 && SR.entryParts(SR.setBonus(mk({ inv: [[SWD, 1, 'h']] }), 0, -9).inv[0]).bonus === -5 && SR.entryParts(SR.setBonus(mk({ inv: [[SWD, 1, 'h+3']] }), 0, 0).inv[0]).bonus === 0 && SR.sanitize({ inv: [[SWD, 1, 'h+9']] }).inv[0].length === 3 && SR.compute(mk({ inv: [['Sword +3', 1, 'h']] })).weapons.length === 0);
    const arrB = SR.compute(mk({ inv: [[BOW, 1, 'r'], [ARR, 1, 'r+1']] })).weapons[0], arr0 = SR.compute(mk({ inv: [[BOW, 1, 'r'], [ARR, 1, 'r']] })).weapons[0];
    check('(p) Ready ammunition Bonus +1 adds to hit and damage of the matching missile weapon', arrB.hitMod === arr0.hitMod + 1 && arrB.dmgMod === arr0.dmgMod + 1);
    const np = SR.compute(mk({ inv: [[SWD, 1, 'h']], pf: [] })), pr = SR.compute(mk({ inv: [[SWD, 1, 'h']] })), mu = SR.compute(mk({ cl: ['Magic-User'], inv: [[DAG, 1, 'h']], pf: [] }));
    check('(p) not proficient: the class penalty (fighter -2, magic-user -5, PHB p.37) is added to hit adj; proficient has none and a P flag', np.d.weaponProf.nonProficiencyPenalty === -2 && np.weapons[0].hitMod === pr.weapons[0].hitMod - 2 && !np.weapons[0].prof && pr.weapons[0].prof && mu.weapons.filter(w => w.kind === 'melee')[0].npen === -5);
    // DMG p.70 table
    const pen = (dex) => SR.offHandPenalty(dex, SR.compute(mk({ sc: [10, 10, 10, dex, 10, 10] })).d.abilities.dex.reaction);
    const tbl = [5, 10, 16, 17, 18].map(d => { const q = pen(d); return d + ':' + q.primary + '/' + q.secondary; }).join(' ');
    check('(p) DMG p.70 two-weapon penalties primary/secondary: Dex 5 -3/-5 (PHB reaction -1 on EACH), 10 -2/-4, 16 -1/-3, 17 0/-2, 18 0/-1', tbl === '5:-3/-5 10:-2/-4 16:-1/-3 17:0/-2 18:0/-1', tbl);
    const two = SR.compute(mk({ sc: [10, 10, 10, 17, 10, 10], inv: [[SWD, 1, 'h'], [DAG, 1, 'o'], ['Shield, small', 1]] })), one = SR.compute(mk({ sc: [10, 10, 10, 17, 10, 10], inv: [[SWD, 1, 'h'], [DAG, 1]] }));
    const sw1 = one.weapons.filter(w => w.name === 'Sword, long')[0], sw2 = two.weapons.filter(w => w.name === 'Sword, long')[0], dg2 = two.weapons.filter(w => w.name === 'Dagger' && w.kind === 'melee')[0];
    check('(p) with a dagger off hand the table shows primary and secondary penalties (Dex 17: 0 and -2), the two-weapon note and the shield warning (DMG p.70)', sw2.hitMod === sw1.hitMod && dg2.hitMod === sw1.hitMod - 2 && dg2.hand === 'o' && two.twoWeapons && two.twoWeapons.secondary === -2 && two.twoWeapons.shield === true && one.twoWeapons === null && /discarding the option of using a shield/.test(SheetSimpleHtml(two)));
    function SheetSimpleHtml(v) { return sandbox.SheetSimple.html(v, true); }
    const dex10 = SR.compute(mk({ inv: [[SWD, 1, 'h'], [DAG, 1, 'o']] }));
    check('(p) Dex 10 off hand: sword -2, dagger -4 on top of Strength', dex10.weapons.filter(w => w.name === 'Sword, long')[0].hitMod === -2 && dex10.weapons.filter(w => w.name === 'Dagger' && w.kind === 'melee')[0].hitMod === -4);
    const oh1 = SR.setHand(mk({ inv: [[SWD, 1, 'h'], [SPR, 1], [DAG, 1], [HAX, 1]] }), 1, 'o'), oh2 = SR.setHand(JSON.parse(JSON.stringify(oh1)), 2, 'o'), oh3 = SR.setHand(JSON.parse(JSON.stringify(oh2)), 3, 'o'), oh4 = SR.setHand(mk({ inv: [[DAG, 1]] }), 0, 'o');
    check('(p) Off hand only for a dagger or hand axe while another melee weapon is in hand; one off hand at a time; with nothing else in hand it is just in hand', SR.entryParts(oh1.inv[1]).flag === '' && SR.entryParts(oh2.inv[2]).flag === 'o' && SR.entryParts(oh3.inv[3]).flag === 'o' && SR.entryParts(oh3.inv[2]).flag === 'h' && SR.entryParts(oh4.inv[0]).flag === 'h' &&
        SR.entryParts(SR.setHand(SR.setHand(mk({ inv: [[SWD, 1, 'h'], [DAG, 1]] }), 1, 'o'), 0, '').inv[1]).flag === 'h' && SR.sanitize({ inv: [[SWD, 1, 'o'], [SPR, 1, 'o']] }).inv.every(e => e.length === 2));
    const old = { v: 1, nm: 'Old Hand', cl: ['Fighter'], lv: [3], sc: [16, 10, 10, 12, 14, 10], pf: [SWD], lp: [['Inn', 0, 5, 0, 0, 0]], inv: [['Chain', 1, 'x'], ['Shield, small', 1], [SWD, 1], [DAG, 2, '1'], ['Ring of Protection +1', 1, 0, 'w'], ["Rope, 50'", 1, 7.5]] };
    const olds = SR.sanitize(old);
    const wOld = SR.compute(olds).weapons.map(w => w.name).join();
    check('(p) an old v1 sheet migrates once: the proficient sword goes In hand, other rows (worn marks, place, ring, rope) unchanged, same AC; the next save is v2 and unticking sticks', olds.v === 2 && JSON.stringify(olds.inv.filter((e, i) => i !== 2)) === JSON.stringify(old.inv.filter((e, i) => i !== 2)) && JSON.stringify(olds.inv[2]) === JSON.stringify([SWD, 1, 'h']) && wOld === 'Sword, long' && SR.compute(old).d.ac === SR.compute(SR.setHand(JSON.parse(JSON.stringify(olds)), 2, '')).d.ac && SR.compute(SR.setHand(JSON.parse(JSON.stringify(olds)), 2, '')).weapons.length === 0 && SR.pack(olds) === SR.pack(SR.sanitize(JSON.parse(SR.pack(olds)))));
    // migration: Ready bow + its ammunition, creators, Quick Party magic weapon, unsaved sheets
    const mig = SR.sanitize({ v: 1, pf: [BOW, DAG], inv: [[BOW, 1], [ARR, 2], ['Quarrel/Bolt, light (single)', 5], [DAG, 1], [SPR, 1], ['Long Sword +1', 1, 6], ['Dagger +2', 1, 1], [SWD, 1, '1'], ['Mace +1', 1, 10]], lp: [['Inn', 0, 0, 0, 0, 0]], pf2: 1 });
    const migF = r => r.map(e => JSON.stringify(e)).join('');
    check('(p) migration: proficient bow and dagger go Ready/In hand, matching arrows go Ready, bolts (no crossbow) and the unproficient spear stay unmarked', JSON.stringify(mig.inv.slice(0, 5)) === JSON.stringify([[BOW, 1, 'r'], [ARR, 2, 'r'], ['Quarrel/Bolt, light (single)', 5], [DAG, 1, 'h'], [SPR, 1]]), migF(mig.inv.slice(0, 5)));
    check('(p) Quick Party magic weapon rows ("Dagger +2", "Mace +1") become the price-list weapon with a Bonus; a custom armour-like or odd item is left', mig.inv.some(e => e[0] === DAG && SR.entryParts(e).bonus === 2) && mig.inv.some(e => e[0] === "Mace, footman's" && SR.entryParts(e).bonus === 1) && !mig.inv.some(e => /\+\d$/.test(e[0])));
    const qp = SR.fromQuickParty({ race: 'Human', classes: ['Fighter'], levels: [3], stats: { str: 16, int: 10, wis: 10, dex: 10, con: 10, cha: 10 }, align: 'True Neutral', xp: 0, hp: 20, ac: 5, equipment: ['Chain Mail', 'Long Sword', 'Long Sword +1', 'Long Bow & Arrows', 'Dagger'], spells: '' }, 'Q', '');
    check('(p) a new Quick Party PC opens with its sword In hand, bow and arrows Ready, and the +1 sword is a Bonus row (not custom)', qp.v === 2 && qp.inv.some(e => e[0] === SWD && SR.entryParts(e).flag === 'h') && qp.inv.some(e => e[0] === BOW && SR.entryParts(e).flag === 'r') && qp.inv.some(e => e[0] === ARR && SR.entryParts(e).flag === 'r') && qp.inv.some(e => SR.entryParts(e).bonus === 1) && SR.compute(qp).weapons.length >= 3, JSON.stringify(qp.inv));
    const rp = SR.randomPC({ band: '1', method: 1, appP: false, name: 'T' });
    check('(p) a Random PC fighter-type with proficiencies opens with weapons In hand', !rp.sheet.pf.length || SR.compute(rp.sheet).weapons.length > 0 || rp.sheet.inv.every(e => !SR.weaponInfo(SR.entryParts(e).core)));
    check('(p) migration also applies in memory to an unsaved v1 sheet through compute (GM combat card), without touching the stored sheet', (() => { const raw = { v: 1, cl: ['Fighter'], pf: [SWD], inv: [[SWD, 1]] }, before = JSON.stringify(raw); return SR.compute(raw).weapons.length === 1 && JSON.stringify(raw) === before; })());
    const mxw = SR.sanitize(JSON.parse(JSON.stringify(maxChar)));
    mxw.lp = Array.from({ length: SR.LIM.places }, (_, k) => ['P'.repeat(SR.LIM.place - 2) + k, 99999, 99999, 99999, 99999, 99999]);
    mxw.inv = mxw.inv.map((e, i) => { const r = e.slice(); r.push((i % 2 ? String(1 + (i % SR.LIM.places)) : 'h') + '+5'); return r; });
    mxw.hn = Array.from({ length: SR.LIM.hench }, () => ['N'.repeat(SR.LIM.hname), 'Half-Elf', 'Fighter/Magic-User'.slice(0, SR.LIM.hclass), 30, 999, -10, 's'.repeat(SR.LIM.hshare), 99999, '12345678-1234-1234-1234-123456789abc', 'x'.repeat(SR.LIM.hnote), SR.LOY_CATS.map(c => c.o.length).concat([SR.LOY_PENALTY.length, SR.LOY_BONUS.length])]);
    mxw.hr = Array.from({ length: SR.LIM.hire }, (_, k) => [k % 2, k % 2 ? SR.EXPERTS.length - 1 : SR.SOLDIERS.length - 1, 9999, k % 2 ? 99999 : 9999, 'n'.repeat(SR.LIM.hirenote)]);
    const mxs = SR.sanitize(mxw), mxb = SR.bytes(SR.pack(mxs)), bonusRows = mxs.inv.filter(e => SR.entryParts(e).bonus === 5).length;
    check('(p) maximal sheet with a +5 Bonus on every weapon and ammunition row (places and hand marks) is still under 16,000 bytes and round-trips', mxb < SR.MAX_BYTES && bonusRows > 10 && JSON.stringify(SR.sanitize(JSON.parse(SR.pack(mxs)))) === JSON.stringify(mxs) && !SR.compute(mxs).errors.length, mxb + ' B, ' + bonusRows + ' bonus rows');
    const tn = SR.tokenName(mk({ inv: [['Chain', 1], ['Shield, small', 1]], sc: [10, 10, 10, 10, 10, 10] })), acNow = SR.compute(mk({ inv: [['Chain', 1], ['Shield, small', 1]] })).d.ac;
    check('(p) token name = first name + (AC n) from the derived AC, e.g. "Aldric (AC ' + acNow + ')"; a blank character name returns "" (token left alone); plainName strips it', tn === 'Aldric (AC ' + acNow + ')' && SR.tokenName(mk({ nm: '   ' })) === '' && SR.tokenName(mk({ nm: '' })) === '' && SR.plainName(tn) === 'Aldric' && SR.tokenName(mk({ nm: 'Mira', inv: [['Chain', 1]] })) !== SR.tokenName(mk({ nm: 'Mira', inv: [] })));
    const CSt = G('CombatState');
    check('(p) CombatState.monsterOf: "Orc" and a GM token "Orc (AC 6)" are still monsters (no guard on names); a PC named "Aldric (AC 4)" is no monster; combat facts for a sheet token are a PC either way', !!CSt.monsterOf('Orc') && !!CSt.monsterOf('Orc (AC 6)') && CSt.monsterOf('Aldric (AC 4)') === null && G('CombatAttack').facts({ name: 'Orc (AC 4)', metadata: { [SR.KEY]: mk({ nm: 'Orc' }) } }).kind === 'pc');
    {
        const rr = SR.compute(mk({ inv: [[SWD, 1, 'h']] })), r5 = SR.compute(mk({ inv: [[SWD, 1, 'h+5']] })), rn = SR.compute(mk({ inv: [[SPR, 1, 'h']] })), rpf = SR.compute(mk({ inv: [[SPR, 1, 'h']], pf: [SPR] }));
        const hitAc = (v, nm) => SR.rollWeapon(v, v.weapons.filter(w => w.name.indexOf(nm) === 0 && w.kind === 'melee')[0], () => 0.5).ac;   // d20 = 11 every time
        check('(p) sheet roll AC verdict adds hitExtra: the same d20 with +5 hits a better armour than +0 (by 5), a non-proficient spear a worse one (by 2)', hitAc(r5, 'Sword') === hitAc(rr, 'Sword') - 5 && hitAc(rn, 'Spear') === hitAc(rpf, 'Spear') + 2, [hitAc(r5, 'Sword'), hitAc(rr, 'Sword'), hitAc(rn, 'Spear'), hitAc(rpf, 'Spear')].join());
        const two2 = SR.compute(mk({ inv: [[BOW, 1, 'r'], [ARR, 2, 'r'], [ARR.replace('normal', 'silver').replace('(12)', '(single)'), 1, 'r+1']] })), bl = two2.weapons.filter(w => w.kind === 'missile');
        check('(p) two Ready arrow stacks: one bow line per stack, each with its own Bonus in the label and its own key (DMG p.168 totals the bow and arrow plus)', bl.length === 2 && new Set(bl.map(w => w.key)).size === 2 && bl.filter(w => w.bonus === 1).length === 1 && bl.filter(w => w.bonus === 0).length === 1 && bl.every(w => /\(arrow/.test(w.name)), bl.map(w => w.name + ' ' + w.bonus).join('; '));
        const tw = SR.compute(mk({ inv: [[SWD, 1, 'h'], [SWD, 1, 'h+2']] })), sw = tw.weapons;
        check('(p) two copies of one weapon get distinct dice keys and show their own bonus in the name; each key rolls its own line', sw.length === 2 && sw[0].key !== sw[1].key && sw[1].name === 'Sword, long +2' && sw[0].name === 'Sword, long');
        const ax = SR.compute(mk({ inv: [[HAX, 1, 'h+2']] })).weapons, axm = ax.filter(w => w.kind === 'missile')[0], axl = ax.filter(w => w.kind === 'melee')[0];
        check('(p) thrown magic hand axe: hit bonus but no damage bonus (DMG p.168); swung it gets both', axm.hitMod === axm.abil + 2 && axm.dmgMod === 0 && axl.dmgMod === axl.strDmg + 2);
    }
    const sim = sandbox.SheetSimple.html(a, true);
    check('(p) Simple view lists only the In hand and Ready weapons, has the "Change on the Equipment page" link and the roll button', /Sword, long/.test(sim) && /Bow, long/.test(sim) && !/>Spear</.test(sim) && !/>Dagger</.test(sim) && /Change on the Equipment page/.test(sim) && /data-act="wroll"/.test(sim) && /data-act="to-gear"/.test(sim));
    check('(p) the strip lists In hand, Off hand, Ready, Armour, Shield, Rings, Other worn', a.onYou.map(x => x.label).join('|') === 'In hand|Off hand|Ready (missile)|Armour|Shield|Rings|Other worn' && a.onYou[0].items.length === 1 && a.onYou[2].items.length === 2);
    check('(p) filter tags: weapon, armour, magic and gear rows are tagged', SR.gearTags([SWD, 1]).join() === 'weapons' && SR.gearTags(['Chain', 1]).join() === 'armour' && SR.gearTags(['Ring of Protection +1', 1, 0]).join() === 'magic' && SR.gearTags(["Rope, 50'", 1]).join() === 'gear' && SR.gearTags([SWD, 1, 'h+1']).join() === 'weapons,magic');
}

const html = ['index.html', 'guide.html', 'js/app.js', 'css/toolkit.css'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
check('no TSR or WotC marks, no em dashes in UI copy', !/TSR|Wizards of the Coast|ADVANCED D&D|—/.test(html.replace(credit, '')));

console.log(fails ? '\n' + fails + ' of ' + total + ' FAILED' : '\nall ' + total + ' checks passed');
process.exit(fails ? 1 : 0);
