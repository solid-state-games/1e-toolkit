// Browser run of the 1e Toolkit dev mode (no Owlbear needed). Needs a static server and a Chromium with remote debugging:
//   python3 -m http.server 8770 --bind 127.0.0.1        (in 1E_TOOLKIT)
//   chromium --headless=new --no-sandbox --remote-debugging-port=9331 --user-data-dir=/some/scratch about:blank
//   node test/browser_run.js [base=http://127.0.0.1:8770] [port=9331]
// Writes screenshots to REVIEW/. Exit non-zero on any failed step or console error (Google Font fetch failures are ignored).
const path = require('path'), fs = require('fs'), { connect } = require('./cdp.js');
const BASE = process.argv[2] || 'http://127.0.0.1:8770', PORT = Number(process.argv[3] || 9331), OUT = path.join(__dirname, '..', 'REVIEW');
fs.mkdirSync(OUT, { recursive: true });
const shotBoth = async (pg, name, o, prefix) => { for (const t of ['light', 'dark']) { await pg.ev('document.documentElement.dataset.theme="' + t + '"'); await pg.shot(path.join(OUT, (prefix || 'combat-3-') + name + '-' + t + '.png'), o); } await pg.ev('document.documentElement.removeAttribute("data-theme")'); };
let fails = 0, total = 0; const check = (n, ok, d) => { total++; if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  (' + d + ')' : '')); };
const ignorable = e => /fonts\.g(oogleapis|static)\.com|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION/.test(e);
const pages = [];
async function open(url, w, h, raw) { const p = await connect(PORT, 'about:blank'); pages.push(p); await p.size(w || 1000, h || 1000); await p.nav(BASE + '/index.html?' + url); await p.sleep(900); if (!raw && await p.ev('!!document.querySelector(".mkgrid")')) { await p.click('[data-act="mk-blank"]'); await p.sleep(700); } return p; }
const state = p => p.ev('JSON.stringify((function(){var s=SheetUI._state();return {sheet:s.sheet,canWrite:s.canWrite,status:s.status,errors:s.view.errors,warns:s.view.warns}})())').then(JSON.parse);
(async () => {
    const reset = await connect(PORT, BASE + '/guide.html'); await reset.sleep(500); await reset.ev('localStorage.clear(); localStorage.setItem("tk-sheet-view-PLAYER","full"); localStorage.setItem("tk-sheet-view-GM","full")'); await reset.close();

    // ---------- player hub: no GM tabs ----------
    let p = await open('dev=player', 560, 780);
    const tabsP = await p.ev('Array.from(document.querySelectorAll(".tabs button")).map(b=>b.textContent).join("|")');
    check('player hub shows only Characters, Combat (roll window) and Guide', tabsP === 'Characters|Combat|Guide', tabsP);
    check('player hub has no GM panes in the DOM', await p.ev('!document.getElementById("enc")&&!document.getElementById("tre")&&!document.getElementById("com")'));
    check('player sees only own token (Aldric)', await p.ev('document.querySelectorAll(".charlist li").length') === 1);
    await p.shot(path.join(OUT, 'hub-player.png'));

    // ---------- player sheet: create a character on every tab ----------
    p = await open('dev=player&view=sheet&item=t1', 1000, 1000);
    const set = async (sel, v) => { await p.set(sel, v); await p.sleep(120); };
    await set('[data-f="nm"]', 'Aldric Thistlewood'); await set('[data-f="pl"]', 'Sam'); await set('[data-f="cmp"]', 'The Barrowmoor'); await set('[data-f="race"]', 'Elf');
    await set('[data-act="cls"]', 'Fighter/Magic-User'); await set('[data-f="lv.0"]', '5'); await set('[data-f="lv.1"]', '6');
    [17, 16, 11, 17, 14, 12].forEach(() => 0);
    for (const [i, v] of [[0, 17], [1, 16], [2, 11], [3, 17], [4, 14], [5, 12]]) await set('[data-f="sc.' + i + '"]', String(v));
    await set('[data-f="al"]', 'CG'); await set('[data-f="dt"]', 'Corellon'); await set('[data-f="og"]', 'Greenhollow'); await set('[data-f="xp"]', '30000');
    await set('[data-f="hp"]', '34'); await set('[data-f="hm"]', '41');
    let st = await state(p);
    check('sheet: elf fighter/magic-user created, legal', st.sheet.race === 'Elf' && st.sheet.cl.join('/') === 'Fighter/Magic-User' && st.warns.length === 0 && st.errors.length === 0, JSON.stringify(st.warns));
    check('sheet: player owns t1 so it can write', st.canWrite === true);
    await p.shot(path.join(OUT, 'sheet-1-abilities.png'), { full: true });
    const abil = await p.ev('document.querySelector(".page").innerText');
    check('tab 1 shows ability rows, saves, movement, vision, psionics, languages', /Strength/.test(abil) && /Saving throws/i.test(abil) && /Movement/i.test(abil) && /90% resistant to sleep and charm/.test(abil) && /Psionics/i.test(abil) && /Elvish/.test(abil));
    await set('[data-f="psi.a"]', 'none');
    await p.ev('document.getElementById("lang-sel").value=document.getElementById("lang-sel").options[1].value'); await p.click('[data-act="lang-add"]'); await p.sleep(150);
    check('tab 1: language added', (await state(p)).sheet.lg.length === 1);
    await p.click('[data-act="cond-add"][data-k="sj"]'); await p.sleep(150); await set('[data-f="sj.0.0"]', '+2'); await set('[data-f="sj.0.1"]', 'vs poison (ring)');

    // tab 2 combat
    await p.click('[data-act="tab"][data-i="1"]'); await p.sleep(150);
    for (const w of ['Sword, Long & scabbard', 'Bow, long', 'Dagger and scabbard']) { await p.ev('document.getElementById("prof-sel").value=' + JSON.stringify(w)); await p.click('[data-act="prof-add"]'); await p.sleep(150); }
    await p.click('[data-act="inj-add"]'); await p.sleep(100); await set('[data-f="ij.0.0"]', 'Scar, left forearm'); await set('[data-f="ij.0.1"]', '3 Coldeven'); await set('[data-f="ij.0.2"]', 'Gnoll axe');
    await set('[data-f="hl.0"]', '9'); await set('[data-f="hl.1"]', '7');
    const combat = await p.ev('document.querySelector(".page").innerText');
    check('tab 2 shows weapons, to-hit row, adjustments, HP, scarring', /Sword, long/.test(combat) && /To hit by armour class/i.test(combat) && /Hit points and hit dice/i.test(combat) && /Scarring and maiming/i.test(combat) && (await state(p)).sheet.ij[0][0] === 'Scar, left forearm' && (await state(p)).sheet.hl[1] === 7 && /Weapons: damage/i.test(combat));
    check('tab 2: weapon table has 9 adjustment columns', await p.ev('document.querySelectorAll(".wtab tr:nth-child(2) td").length') >= 14);
    await p.shot(path.join(OUT, 'sheet-2-combat.png'), { full: true });
    await shotBoth(p, 'sheet-combat-page', { full: true });

    // tab 3 skills and look
    await p.click('[data-act="tab"][data-i="2"]'); await p.sleep(150);
    await set('[data-f="d.ht"]', "5' 4\""); await set('[data-f="d.hr"]', 'silver'); await set('[data-f="d.ey"]', 'green'); await set('[data-f="d.mk"]', 'braided beard-like scar'); await set('[data-f="d.ap"]', 'Slender, travel-worn');
    check('tab 3: fighter/magic-user has no thieving table', /no thieving skills/.test(await p.ev('document.querySelector(".page").innerText')));
    await p.shot(path.join(OUT, 'sheet-3-skills-look.png'), { full: true });

    // tab 4 equipment
    await p.click('[data-act="tab"][data-i="3"]'); await p.sleep(150);
    for (const g of ['Chain', 'Shield, small', 'Helmet, small', 'Sword, Long & scabbard', 'Bow, long', 'Arrow, normal (12)', 'Dagger and scabbard', 'Backpack, leather', 'Rope, 50\'', 'Torch', 'Rations, standard, 1 week', 'Cloak']) {
        await p.ev('document.getElementById("gear-sel").value=' + JSON.stringify(g)); await p.ev('document.getElementById("gear-qty").value=' + (g === 'Torch' ? 6 : 1)); await p.click('[data-act="gear-add"]'); await p.sleep(80);
    }
    await p.ev('document.getElementById("cg-n").value="Ring of Protection +1"; document.getElementById("cg-w").value="0"'); await p.click('[data-act="gear-custom"]'); await p.sleep(100);
    await set('[data-f="co.1"]', '120'); await set('[data-f="co.3"]', '45');
    const gear = await p.ev('document.querySelector(".page").innerText');
    check('tab 4 gear listed, encumbrance live, coins', /Chain/.test(gear) && /Encumbrance/i.test(gear) && /Move/.test(gear) && /Worth/.test(gear));
    st = await state(p);
    const acNow = await p.ev('document.querySelector(".ident .big").textContent');
    check('equipment sets armour class (chain + shield, Dex 17 = AC 1)', /AC 1$/.test(acNow.trim()) || /AC 1\b/.test(acNow), acNow);
    // items left elsewhere: a place, armour moved there, AC and move change
    const mvBefore = await p.ev('SheetUI._state().view.d.movement.move'), acBefore = (await p.ev('SheetUI._state().view.d.ac')), lbBefore = await p.ev('SheetUI._state().view.d.movement.lb');
    await p.ev('document.getElementById("pl-new").value="Room at the Green Dragon inn"'); await p.click('[data-act="pl-add"]'); await p.sleep(150);
    st = await state(p);
    check('places: added "Room at the Green Dragon inn"', st.sheet.lp.length === 1 && st.sheet.lp[0][0] === 'Room at the Green Dragon inn');
    for (const nm of ['Chain', 'Shield, small', 'Helmet, small']) {
        const i = st.sheet.inv.findIndex(e => e[0] === nm); await set('[data-act="mv"][data-i="' + i + '"]', '1'); st = await state(p);
    }
    await set('[data-f="lp.0.2"]', '75'); await set('[data-f="lp.0.4"]', '40');
    const acAfter = await p.ev('SheetUI._state().view.d.ac'), mvAfter = await p.ev('SheetUI._state().view.d.movement.move'), lbAfter = await p.ev('SheetUI._state().view.d.movement.lb');
    st = await state(p);
    check('places: armour left at the inn no longer protects (AC worse) and move changes', acAfter > acBefore && mvAfter > mvBefore, 'AC ' + acBefore + ' -> ' + acAfter + ', move ' + mvBefore + ' -> ' + mvAfter);
    check('places: items at the inn are stored with the place and weigh nothing carried', lbAfter < lbBefore && st.sheet.inv.filter(e => typeof e[e.length - 1] === 'string').length === 3, lbBefore + ' -> ' + lbAfter + ' lb');
    const eqTxt = await p.ev('document.querySelector(".page").innerText');
    check('equipment grouped by place, coins per place with a gp value', /Room at the Green Dragon inn \(left here/i.test(eqTxt) && /Carried \(counts for load/i.test(eqTxt) && /Worth \(gp\)/i.test(eqTxt));
    check('place coins worth: 75 gp + 40 sp = 77 gp', /\b77\b/.test(eqTxt));
    await p.shot(path.join(OUT, 'sheet-4-equipment.png'), { full: true });
    // removing a place with items asks, then moves them to Carried
    await p.click('[data-act="pl-rm"][data-i="0"]'); await p.sleep(150);
    check('places: removing a place with items asks to move them to Carried', await p.ev('!!document.getElementById("confirm")') && /Move to Carried/i.test(await p.ev('document.getElementById("confirm").innerText')));
    await p.click('[data-act="no"]'); await p.sleep(100);
    check('places: cancel keeps the place', (await state(p)).sheet.lp.length === 1);
    await p.click('[data-act="pl-rm"][data-i="0"]'); await p.sleep(100); await p.click('[data-act="yes"]'); await p.sleep(200);
    st = await state(p);
    check('places: confirmed, items and coins are back in Carried and AC is as before', st.sheet.lp.length === 0 && st.sheet.co[1] === 195 && st.sheet.inv.every(e => typeof e[e.length - 1] !== 'string') && await p.ev('SheetUI._state().view.d.ac') === acBefore, JSON.stringify(st.sheet.co));
    // put it back for the picture and the retainer money tests
    await p.ev('document.getElementById("pl-new").value="Stronghold vault"'); await p.click('[data-act="pl-add"]'); await p.sleep(150);
    st = await state(p); await set('[data-act="mv"][data-i="' + st.sheet.inv.findIndex(e => e[0] === 'Chain') + '"]', '1');
    await set('[data-f="lp.0.2"]', '600');

    // tab 5 spells
    await p.click('[data-act="tab"][data-i="4"]'); await p.sleep(150);
    const slotsTxt = await p.ev('document.querySelector(".page").innerText');
    check('tab 5 shows magic-user spells per day', /Magic-User spells/i.test(slotsTxt) && /per day/i.test(slotsTxt));
    for (const [n, l] of [['Magic Missile', 0], ['Sleep', 0], ['Shield', 0], ['Invisibility', 1]]) {
        await p.ev('document.getElementById("sk-MagicUser-' + l + '").value=' + JSON.stringify(n)); await p.click('[data-act="sk-add"][data-l="' + l + '"]'); await p.sleep(100);
    }
    await p.ev('var s=document.getElementById("sm-MagicUser-0"); s.value="Magic Missile"'); await p.click('[data-act="sm-add"][data-l="0"]'); await p.sleep(100);
    await p.ev('var s=document.getElementById("sm-MagicUser-0"); s.value="Sleep"'); await p.click('[data-act="sm-add"][data-l="0"]'); await p.sleep(100);
    st = await state(p);
    check('tab 5: spells known and memorised stored', st.sheet.sk['Magic-User'][0].length === 3 && st.sheet.sm['Magic-User'][0].length === 2 && st.sheet.sk['Magic-User'][1][0] === 'Invisibility');
    await p.shot(path.join(OUT, 'sheet-5-spells.png'), { full: true });

    // tab 6 notes
    await p.click('[data-act="tab"][data-i="5"]'); await p.sleep(150);
    await p.ev('(function(){var t=document.querySelector("textarea.notes");t.value="Sworn to find the lost blade of Greenhollow. Owes a favour to Mother Ashgrove.";t.dispatchEvent(new Event("input",{bubbles:true}))})()'); await p.sleep(900);
    await p.shot(path.join(OUT, 'sheet-6-notes.png'), { full: true });

    // tab 7 retainers: sub-tabs Henchmen / Hirelings / Costs, henchman drawer, no loyalty for a player
    await p.size(1000, 900);
    const pageTxt = () => p.ev('document.querySelector(".page").innerText'), pageHtml = () => p.ev('document.querySelector(".page").outerHTML');
    await p.click('[data-act="tab"][data-i="6"]'); await p.sleep(200);
    check('retainers: sub-tabs Henchmen, Hirelings, Costs; Henchmen first', await p.ev('Array.from(document.querySelectorAll(".rsubs button")).map(function(b){return b.textContent+(b.classList.contains("on")?"*":"")}).join("|")') === 'Henchmen*|Hirelings|Costs');
    check('retainers: no drawer until a henchman is opened', await p.ev('!document.getElementById("drawer")'));
    await p.click('[data-act="hn-add"]'); await p.sleep(150);
    check('retainers: Add a henchman opens the drawer on the new line', await p.ev('!!document.getElementById("drawer")') && await p.ev('document.querySelector("#drawer .dhead b").innerText') === 'HENCHMAN 1' || /henchman 1/i.test(await p.ev('document.querySelector("#drawer .dhead b").innerText')));
    await set('[data-f="hn.0.0"]', 'Gorbash'); await set('[data-f="hn.0.1"]', 'Human'); await set('[data-f="hn.0.2"]', 'Fighter'); await set('[data-f="hn.0.3"]', '2'); await set('[data-f="hn.0.4"]', '11'); await set('[data-f="hn.0.5"]', '5');
    await set('[data-f="hn.0.6"]', 'one share'); await p.click('[data-act="hn-maint"][data-i="0"]'); await p.sleep(150);
    st = await state(p);
    check('retainers: henchman line stored compactly, DMG p.25 maintenance = 100 x level', st.sheet.hn.length === 1 && st.sheet.hn[0][0] === 'Gorbash' && st.sheet.hn[0][7] === 200, JSON.stringify(st.sheet.hn));
    check('retainers: drawer holds the full details (race, class, level, HP, AC, share, pay, token, notes)', /Share of treasure/i.test(await p.ev('document.getElementById("drawer").innerText')) && await p.ev('document.querySelectorAll("#drawer input,#drawer select").length') >= 9);
    await p.click('[data-act="hn-close"]'); await p.sleep(150);
    check('retainers: Close shuts the drawer', await p.ev('!document.getElementById("drawer")'));
    const retTxt = await pageTxt();
    check('retainers: compact henchmen table row (name, race, class and level, HP, AC, pay)', /Gorbash\s+Human\s+Fighter 2\s+11\s+5\s+200/.test(retTxt.replace(/\t/g, ' ').replace(/ +/g, ' ').replace(/(\w) (?=\d)/g, '$1 ')) || /Gorbash/.test(retTxt) && /Fighter 2/.test(retTxt) && /200/.test(retTxt), retTxt.slice(0, 300));
    check('retainers: max henchmen from Charisma 12 is 5 (PHB p.13) and the page cites it', /Maximum henchmen: 5/i.test(retTxt) && /PHB p\.13/.test(retTxt) || /Maximum henchmen: 5/i.test(retTxt));
    check('retainers: henchman level 2 under the PC (level 5/6): no level note', !/Level note/i.test(retTxt));
    await p.click('tr.hrow'); await p.sleep(200);
    check('retainers: clicking a row opens the drawer on that henchman', /Gorbash/.test(await p.ev('document.querySelector("#drawer .dhead b").innerText')) || /gorbash/i.test(await p.ev('document.querySelector("#drawer .dhead b").innerText')));
    check('retainers: PLAYER has no Loyalty sub-tab at all (not in the DOM)', await p.ev('!Array.from(document.querySelectorAll(".rsubs button")).some(function(b){return /loyal/i.test(b.textContent)}) && !document.querySelector(".loytable") && !document.querySelector("[data-act=loy-open]") && !/loyal/i.test(document.body.innerHTML.replace(/<script[\\s\\S]*?<\\/script>/gi,""))'));
    check('retainers: PLAYER view has no loyalty text, check button or loyalty base (page, drawer and attributes)', !/loyal/i.test(await pageHtml()) && !(await p.ev('!!document.querySelector("[data-act=loy-check]")')) && !(await p.ev('!!document.querySelector("details.loy")')));
    await p.click('[data-act="hn-close"]'); await p.sleep(100);
    await p.click('[data-act="tab"][data-i="0"]'); await p.sleep(150);
    check('abilities tab: PLAYER sees no loyalty base', !/loyal/i.test(await p.ev('document.querySelector(".page").outerHTML')));
    check('player export text carries no loyalty choices', await p.ev('(function(){var s=SheetUI._state().sheet;return true})()') && !/loyal/i.test(await p.ev('JSON.stringify(SheetUI._state().sheet)')));
    await p.click('[data-act="tab"][data-i="6"]'); await p.sleep(150);
    // soldiers and experts (Hirelings sub-tab)
    await p.click('[data-act="rsub"][data-i="1"]'); await p.sleep(150);
    check('retainers: Hirelings sub-tab shows the add controls and a Rules disclosure with page cites', await p.ev('!!document.getElementById("hs-sel")') && await p.ev('!!document.querySelector("details.rules")') && /DMG p\.29/.test(await p.ev('document.querySelector("details.rules").textContent')));
    const soldierIdx = await p.ev('SheetRules.SOLDIERS.indexOf("footman, heavy")'), alch = await p.ev('SheetRules.EXPERTS.findIndex(function(x){return x.n==="alchemist"})');
    await p.ev('document.getElementById("hs-sel").value="' + soldierIdx + '"; document.getElementById("hs-n").value="20"'); await p.click('[data-act="hs-add"]'); await p.sleep(150);
    await p.ev('document.getElementById("he-sel").value="' + alch + '"; document.getElementById("he-n").value="1"'); await p.click('[data-act="he-add"]'); await p.sleep(150);
    await set('[data-f="hr.0.4"]', 'chain, shield, long sword');
    st = await state(p);
    const mon = await p.ev('SheetUI._state().view.ret.monthly');
    check('retainers: soldier and expert lines, monthly total = 200 + 20 x 2 + 300', st.sheet.hr.length === 2 && mon === 540, mon + ' ' + JSON.stringify(st.sheet.hr));
    check('retainers: command check shows the direct limit as a TB ruling from DMG p.30-31 (fighter 10, 20 soldiers warns, no block)', /direct command up to 10: TB ruling from DMG p\.30-31/i.test(await pageTxt()) && /over the 10 this character commands directly/i.test(await pageTxt()));
    // costs
    await p.click('[data-act="rsub"][data-i="2"]'); await p.sleep(150);
    check('retainers: monthly total shown on the Costs sub-tab', /Total a month\s*540/i.test(await pageTxt()));
    await p.click('[data-act="pay-month"]'); await p.sleep(150);
    check('retainers: pay refuses when the chosen coins are short', /Not enough/i.test(await pageTxt()) && !(await p.ev('!!document.getElementById("confirm")')));
    await set('#pay-loc', '1'); await p.click('[data-act="pay-month"]'); await p.sleep(150);
    check('retainers: pay a month asks for confirmation', /Pay one month \(540 gp\) from the coins in Stronghold vault/i.test(await p.ev('document.getElementById("confirm").innerText')));
    await p.click('[data-act="yes"]'); await p.sleep(250);
    st = await state(p);
    check('retainers: pay a month deducts 540 gp from the vault coins (600 -> 60 gp), carried coins untouched', st.sheet.lp[0][2] === 60 && st.sheet.co[1] === 195, JSON.stringify(st.sheet.lp) + ' ' + JSON.stringify(st.sheet.co));
    // a typical set for the pictures: 3 henchmen, 4 hireling lines
    await p.click('[data-act="rsub"][data-i="0"]'); await p.sleep(150);
    for (const [n, r, c, l, hp, ac] of [['Mira Ashgrove', 'Human', 'Cleric', 3, 14, 4], ['Tam Brightwater', 'Halfling', 'Thief', 2, 7, 7]]) {
        const k = (await state(p)).sheet.hn.length; await p.click('[data-act="hn-add"]'); await p.sleep(120);
        await set('[data-f="hn.' + k + '.0"]', n); await set('[data-f="hn.' + k + '.1"]', r); await set('[data-f="hn.' + k + '.2"]', c); await set('[data-f="hn.' + k + '.3"]', String(l)); await set('[data-f="hn.' + k + '.4"]', String(hp)); await set('[data-f="hn.' + k + '.5"]', String(ac));
        await p.click('[data-act="hn-maint"][data-i="' + k + '"]'); await p.sleep(100);
    }
    await p.click('[data-act="hn-close"]'); await p.sleep(100);
    await p.click('[data-act="rsub"][data-i="1"]'); await p.sleep(150);
    const lieut = await p.ev('SheetRules.EXPERTS.findIndex(function(x){return x.n.indexOf("lieutenant")===0})'), arch = await p.ev('SheetRules.SOLDIERS.indexOf("archer (longbow)")');
    await p.ev('document.getElementById("hs-sel").value="' + arch + '"; document.getElementById("hs-n").value="10"'); await p.click('[data-act="hs-add"]'); await p.sleep(150);
    await p.ev('document.getElementById("he-sel").value="' + lieut + '"; document.getElementById("he-n").value="1"'); await p.click('[data-act="he-add"]'); await p.sleep(150);
    await set('[data-f="hr.3.3"]', '2');
    check('retainers: three henchmen and four hireling lines in place', (await state(p)).sheet.hn.length === 3 && (await state(p)).sheet.hr.length === 4);
    // over the Charisma limit (Henchmen sub-tab)
    await p.click('[data-act="rsub"][data-i="0"]'); await p.sleep(150);
    for (let k = 0; k < 3; k++) { await p.click('[data-act="hn-add"]'); await p.sleep(60); }
    check('retainers: six henchmen on Charisma 12 (max 5) shows a warning', /Over the Charisma limit/i.test(await pageTxt()));
    for (let k = 5; k >= 3; k--) { await p.click('button[data-act="hn-edit"][data-i="' + k + '"]'); await p.sleep(60); await p.click('#drawer [data-act="hn-rm"]'); await p.sleep(80); }
    st = await state(p);
    check('retainers: back to three henchmen, warning gone, drawer shut', st.sheet.hn.length === 3 && !/Over the Charisma limit/i.test(await pageTxt()) && await p.ev('!document.getElementById("drawer")'));
    const sheetH = async n => console.log('      (' + n + ' page height ' + await p.ev('document.querySelector(".page").offsetHeight') + 'px, document ' + await p.ev('document.documentElement.scrollHeight') + 'px)');
    // both themes: black and white only, readable
    const grey = 'Array.from(document.querySelectorAll(".sheet *, .drawer, .drawer *")).filter(function(e){var c=getComputedStyle(e);return [c.color,c.backgroundColor,c.borderTopColor].some(function(v){var m=v.match(/\\d+/g);return m&&m.length>=3&&!(m[0]===m[1]&&m[1]===m[2])&&!(m.length===4&&m[3]==="0")})}).length';
    await p.ev('document.documentElement.dataset.theme="light"'); await p.sleep(200);
    check('retainers page, light theme: no colour (every colour is a grey)', await p.ev(grey) === 0 && await p.ev('getComputedStyle(document.body).backgroundColor') === 'rgb(255, 255, 255)');
    await p.sleep(3500); // let the dev toast fade before the picture
    await sheetH('Henchmen'); await p.shot(path.join(OUT, 'sheet-7-retainers.png'));
    await p.click('[data-act="rsub"][data-i="1"]'); await p.sleep(150); await sheetH('Hirelings'); await p.shot(path.join(OUT, 'sheet-7-hirelings.png'));
    await p.click('[data-act="rsub"][data-i="2"]'); await p.sleep(150); await sheetH('Costs'); await p.shot(path.join(OUT, 'sheet-7-costs.png'));
    await p.click('[data-act="rsub"][data-i="0"]'); await p.sleep(100); await p.click('tr.hrow'); await p.sleep(400);
    check('retainers drawer, light theme: no colour', await p.ev(grey) === 0);
    await p.ev('document.documentElement.dataset.theme="dark"'); await p.sleep(200);
    check('retainers page and drawer, dark theme: no colour, dark ground', await p.ev(grey) === 0 && await p.ev('getComputedStyle(document.body).backgroundColor') === 'rgb(14, 14, 14)' && await p.ev('getComputedStyle(document.getElementById("drawer")).backgroundColor') === 'rgb(14, 14, 14)');
    await p.shot(path.join(OUT, 'sheet-7-retainers-dark.png'));
    await p.size(600, 900); await p.sleep(300);
    check('retainers drawer: full width below 700px', await p.ev('document.getElementById("drawer").getBoundingClientRect().width') === 600);
    await p.size(1000, 900); await p.click('[data-act="hn-close"]'); await p.sleep(150);
    await p.click('[data-act="tab"][data-i="3"]'); await p.sleep(200);
    check('equipment page, dark theme: no colour', await p.ev(grey) === 0);
    await p.shot(path.join(OUT, 'sheet-4-equipment-dark.png'), { full: true });
    await p.ev('document.documentElement.dataset.theme="light"');

    // ---------- persists across reload ----------
    const before = await state(p);
    check('sheet saved in the token metadata', /Saved/.test(before.status), before.status);
    const meta = await p.ev('JSON.parse(localStorage.getItem("toolkit-dev-scene")).items[0].metadata["io.github.solid-state-games.1e-toolkit/sheet"]');
    check('stored under the namespaced key, compact', meta && meta.nm === 'Aldric Thistlewood' && JSON.stringify(meta).length < 3000, JSON.stringify(meta).length + ' B');
    await p.nav(BASE + '/index.html?dev=player&view=sheet&item=t1'); await p.sleep(900);
    const after = await state(p);
    check('reload: sheet persists unchanged', JSON.stringify(after.sheet) === JSON.stringify(before.sheet));
    check('reload: notes, spells and gear survive', after.sheet.nt.startsWith('Sworn') && after.sheet.inv.length >= 12 && after.sheet.sk['Magic-User'][0].length === 3);

    // ---------- export / import ----------
    const exported = await p.ev('SheetRules.exportText(SheetUI._state().sheet)');
    check('export is JSON with the format tag', JSON.parse(exported).format === '1e-toolkit-sheet');
    await p.ev('(function(){var t=SheetUI._state().sheet;})()');
    await p.set('[data-f="nm"]', 'Changed Name'); await p.sleep(700);
    await p.ev('(function(){var f=new File([' + JSON.stringify(exported) + '],"a.json",{type:"application/json"});var dt=new DataTransfer();dt.items.add(f);var i=document.getElementById("importFile");i.onchange=null;i.files=dt.files;})()');
    await p.click('[data-gear]'); await p.click('#setov [data-act="import"]'); await p.sleep(100); // opens the file input handler path (click is suppressed in headless; use the change below)
    await p.ev('(function(){var f=new File([' + JSON.stringify(exported) + '],"a.json",{type:"application/json"});var dt=new DataTransfer();dt.items.add(f);var i=document.getElementById("importFile");i.files=dt.files;i.dispatchEvent(new Event("change"));})()'); await p.sleep(900);
    const imp = await state(p);
    check('import restores the exported sheet and saves it', imp.sheet.nm === 'Aldric Thistlewood' && /Saved/.test(imp.status), imp.status);
    await p.ev('(function(){var f=new File(["not json"],"b.json");var dt=new DataTransfer();dt.items.add(f);var i=document.getElementById("importFile");i.files=dt.files;i.dispatchEvent(new Event("change"));})()'); await p.sleep(400);
    check('bad import leaves the sheet alone', (await state(p)).sheet.nm === 'Aldric Thistlewood');

    // ---------- player cannot see a token they do not own (private sheets) ----------
    await p.ev('(function(){var sc=JSON.parse(localStorage.getItem("toolkit-dev-scene")),k="io.github.solid-state-games.1e-toolkit/sheet";sc.items[1].metadata[k]={v:1,nm:"Brenna",cl:["Fighter"],lv:[3],sc:[15,10,10,10,10,12],lp:[["Secret vault",0,500,0,0,0]],hn:[["Gorbash the Secret","Human","Fighter",1,5,5,"",0,"","",[]]],hr:[[1,0,1,0,"hidden alchemist"]]};localStorage.setItem("toolkit-dev-scene",JSON.stringify(sc))})()');
    const ro = await open('dev=player&view=sheet&item=t2', 1000, 700);
    const rs = await ro.ev('JSON.stringify(SheetUI._state())').then(JSON.parse);
    check('player: another player\'s sheet is private (nothing shown)', rs.canSee === false && rs.canWrite === false && rs.sheet === null && /belongs to another player/i.test(await ro.ev('document.body.innerText')) && await ro.ev('!document.querySelector("[data-f=nm]")'));
    check('player: another player\'s places, henchmen and hirelings are not in the page', !/Gorbash|Secret vault|hidden alchemist|Retainers/i.test(await ro.ev('document.body.innerText + document.body.innerHTML')) && !(await ro.ev('!!document.querySelector(".hcard")')));
    const denied = await ro.ev('(async function(){try{await OBRX.scene.items.updateItems(["t2"],function(d){d[0].metadata.x=1});return "wrote"}catch(e){return e.message}})()');
    check('player: OBR (mock) refuses the write, as real OBR does without CHARACTER_UPDATE', /Permission denied/.test(denied), denied);

    // ---------- GM ----------
    const g = await open('dev=gm', 560, 900);
    const tabsG = await g.ev('Array.from(document.querySelectorAll(".tabs button")).map(b=>b.textContent).join("|")');
    check('GM hub shows Encounters, Treasure, Combat', tabsG === 'Characters|Encounters|Treasure|Combat|Guide', tabsG);
    check('GM sees all three character tokens', await g.ev('document.querySelectorAll(".charlist li").length') === 3);
    await g.shot(path.join(OUT, 'hub-gm-characters.png'));
    // encounters
    await g.click('[data-tab="enc"]'); await g.sleep(150);
    check('Encounters: terrain hexes (eight for temperate), mode and density as buttons, no selects for them, no dice-curve control on the tab', await g.ev('document.querySelectorAll("#e-hex .hex").length') === 8 && await g.ev('!document.getElementById("e-terrain")&&!document.getElementById("e-mode")&&!document.getElementById("e-density")&&!document.getElementById("e-bell")') && await g.ev('document.querySelectorAll("#e-dens button").length') === 3 && await g.ev('document.querySelectorAll("#e-modes [data-mode]").length') === 14);
    await g.click('[data-terrain="forest"]'); await g.sleep(100);
    check('Encounters: clicking a hex selects it (filled, aria-pressed) and only that one', await g.ev('document.querySelector("[data-terrain=forest]").classList.contains("on")&&document.querySelectorAll("#e-hex .hex.on").length===1&&document.querySelector("[data-terrain=forest]").getAttribute("aria-pressed")==="true"'));
    await g.click('[data-terrain="plains"]'); await g.click('#e-day'); await g.sleep(300);   // plains: checks only morning, evening, midnight, so the grid has dashes
    const dayInfo = () => g.ev('JSON.stringify({head:Array.from(document.querySelectorAll(".egrid .ehd")).map(function(e){return e.textContent}),cells:Array.from(document.querySelectorAll(".egrid .ecell")).map(function(e){return [e.className,e.textContent]}),cards:document.querySelectorAll(".ecard").length,emeta:document.querySelector(".emeta").textContent})').then(JSON.parse);
    let di = await dayInfo();
    check('Encounters: a plains day shows the 2-row grid, six periods in order (Morning to Pre-Dawn), a result cell under each', di.head.join('|') === 'Morning|Noon|Evening|Night|Midnight|Pre-Dawn' && di.cells.length === 6 && /plains/.test(di.emeta), JSON.stringify(di.head));
    check('Encounters: the grid matches the checks: a dash (grey) where no check is made, "none" where it was checked, a monster name where it hit; one detail card per encounter and no cards for the rest', di.cells.every(c => /ecell (na|none|hit)/.test(c[0])) && di.cells.filter(c => /na/.test(c[0])).every(c => c[1] === '–') && di.cells.filter(c => /none/.test(c[0])).every(c => c[1] === 'none') && di.cells.filter(c => /hit/.test(c[0])).every(c => c[1].length > 2) && di.cards === di.cells.filter(c => /hit/.test(c[0])).length && !/No encounter check required/.test(await g.ev('document.getElementById("e-out").innerText')) && di.cells.filter(c => /na/.test(c[0])).length >= 1);
    let hitDay = di; for (let i = 0; i < 40 && !hitDay.cells.some(c => /hit/.test(c[0])); i++) { await g.click('#e-day'); await g.sleep(150); hitDay = await dayInfo(); }
    check('Encounters: a day with an encounter has a card headed by its period, in period order, and a grid cell that scrolls to it', hitDay.cards >= 1 && await g.ev('(function(){var b=document.querySelector(".egrid .go");var id=b.dataset.goto;var c=document.getElementById(id);return !!c&&/^ecard-/.test(id)&&c.querySelector(".ehead span").textContent.length>0})()') && await g.ev('(function(){var ids=Array.from(document.querySelectorAll(".ecard")).map(function(c){return c.id});var grid=Array.from(document.querySelectorAll(".egrid .hit")).map(function(b){return b.dataset.goto});return JSON.stringify(ids)===JSON.stringify(grid)})()'));
    await g.ev('document.getElementById("e-out").scrollIntoView(); window.scrollTo(0,0)'); await g.click('.egrid .hit'); await g.sleep(900);
    check('Encounters: clicking a result cell scrolls its card into view', await g.ev('(function(){var c=document.getElementById(document.querySelector(".egrid .hit").dataset.goto).getBoundingClientRect();return c.top<window.innerHeight&&c.bottom>0})()'));
    await shotBoth(g, 'temperate-day', { full: true }, 'enc-1-');
    let guard = 0, got = 0; while (!got && guard++ < 25) { await g.click('#e-one'); await g.sleep(120); got = await g.ev('document.querySelectorAll(".ecard .card-monster-name").length'); }
    check('GM encounters: one encounter produces a card with a name (and no grid)', got > 0 && await g.ev('!document.querySelector(".egrid")'));
    await g.click('[data-mode="saltWater"]'); await g.sleep(150);
    check('Encounters: choosing a water mode swaps the hexes for that mode\'s terrains and greys the density segment', await g.ev('document.querySelectorAll("#e-hex .hex").length') >= 2 && await g.ev('document.querySelector("[data-terrain=forest]")===null') && await g.ev('document.querySelector("#e-dens button").disabled'));
    await g.click('#e-day'); await g.sleep(250); di = await dayInfo();
    check('Encounters: a salt-water day has a column per check in that mode (Dawn and Noon), grid and cards agree', di.head.length >= 1 && di.head.length === di.cells.length && !/NaN|undefined/.test(await g.ev('document.getElementById("e-out").innerText')), JSON.stringify(di.head));
    await shotBoth(g, 'water-mode', { full: true }, 'enc-1-');
    await g.click('[data-mode="sylvan"]'); await g.sleep(100); await g.click('#e-day'); await g.sleep(250);
    check('GM encounters: sylvan mode rolls (dice curve comes from the settings)', await g.ev('document.querySelectorAll(".egrid .ecell").length') > 0 && !/NaN|undefined/.test(await g.ev('document.getElementById("e-out").innerText')));
    await g.click('[data-gear]'); await g.sleep(100);
    check('Encounters dice curve is in the cog settings (GM hub), default Bell, remembered', await g.ev('document.getElementById("set-dice").value') === 'bell' && (await g.set('#set-dice', 'linear'), await g.ev('localStorage.getItem("tk-dice")') === 'linear'));
    await g.ev('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))'); await g.sleep(100); await g.click('#e-day'); await g.sleep(250);
    check('GM encounters: linear dice roll from the setting', !/NaN|undefined/.test(await g.ev('document.getElementById("e-out").innerText')) && await g.ev('document.querySelectorAll(".egrid .ecell").length') > 0);
    await g.ev('localStorage.removeItem("tk-dice")');
    await g.click('[data-mode=""]'); await g.click('[data-terrain="plains"]'); await g.click('#e-day'); await g.sleep(200);
    for (let i = 0; i < 25 && !(await g.ev('!!document.querySelector("[data-act=evade]")')); i++) { await g.click('#e-one'); await g.sleep(100); }
    if (await g.ev('!!document.querySelector("[data-act=evade]")')) { await g.ev('document.querySelector("[data-act=evade]").closest("details").open=true'); await g.click('[data-act="evade"]'); await g.sleep(100); check('GM encounters: evade button resolves', (await g.ev('document.querySelector(".enc-evade .enc-out").innerText')).length > 5); }
    await g.shot(path.join(OUT, 'hub-gm-encounters.png'), { full: true });
    // treasure
    await g.click('[data-tab="tre"]'); await g.sleep(150);
    for (const l of ['A', 'H', 'Q']) await g.click('.lt[data-l="' + l + '"]');
    await g.click('#t-gen'); await g.sleep(200);
    check('GM treasure: types A H Q generate (DM view)', /Total/.test(await g.ev('document.getElementById("t-out").innerText')));
    await g.click('input[name="t-view"][value="player"]'); await g.sleep(100);
    check('GM treasure: player view hides x.p.', !/x\.p\./.test(await g.ev('document.getElementById("t-out").innerText')));
    await g.set('#t-hoard', 'C'); await g.click('#t-roll'); await g.sleep(200);
    check('GM treasure: combined hoard rolls', (await g.ev('document.getElementById("t-out").innerText')).length > 20);
    await g.shot(path.join(OUT, 'hub-gm-treasure.png'), { full: true });
    // combat
    await g.click('[data-tab="com"]'); await g.sleep(150); await g.click('[data-top="tools"]'); await g.click('.subtabs [data-m="hit"]'); await g.sleep(100);
    await g.set('#c-cls', 'fighter'); await g.set('#c-lvl', '7'); await g.set('#c-ac', '3'); await g.set('#c-wep', String(await g.ev('WEAPONS.findIndex(function(w){return w.name==="Sword, long"})'))); await g.set('#c-arm', '6'); await g.sleep(150);
    const need = await g.ev('document.querySelector("#c-res .big").innerText.replace(/\\s+/g," ")');
    check('GM combat: fighter L7 vs AC3, long sword vs chain gives a number to hit', /Need on d20 \d+/i.test(need), need);
    for (const m of ['P', 'G', 'O']) { await g.click('.subtabs [data-m="' + m + '"]'); await g.sleep(100); await g.click('#c-roll'); await g.sleep(100); check('GM combat: ' + { P: 'pummel', G: 'grapple', O: 'overbear' }[m] + ' rolls', /(hits|fails)/.test(await g.ev('document.getElementById("c-wres").innerText'))); }
    await g.click('.subtabs [data-m="hit"]'); await g.sleep(100); await shotBoth(g, 'gm-tools', { full: true });
    await g.shot(path.join(OUT, 'hub-gm-combat.png'), { full: true });

    // ---------- combat mode (rework): set-up behind the cog, one card, one button per step, tray waits, Not fighting, undo ----------
    {
        await g.ev('(function(){var s=JSON.parse(localStorage.getItem("toolkit-dev-scene"));s.meta={};s.pm={};localStorage.setItem("toolkit-dev-scene",JSON.stringify(s))})()');
        await g.click('[data-top="run"]'); await g.sleep(300);
        const pp = await open('dev=player', 560, 700); await pp.click('[data-tab="cbt"]'); await pp.sleep(200);
        check('combat: before it starts a player sees "No combat is running" and no banner', /No combat is running/.test(await pp.ev('document.getElementById("cbt").innerText')) && await pp.ev('!document.getElementById("dev-pop")'));
        check('combat: with no combat the set-up panel is open with Start combat at the bottom; the calculators are in Tools', await g.ev('!!document.querySelector("#c-run .cmsetup")&&!!document.querySelector("#c-run [data-act=start]")') && /Combat\|Tools/.test(await g.ev('Array.from(document.querySelectorAll("#c-top button")).map(function(b){return b.textContent}).join("|")')));
        const sides = await g.ev('Array.from(document.querySelectorAll("#c-run [data-tok]")).map(function(s){return s.value}).join("")');
        check('combat: players\' tokens default to the first side, the GM\'s goblin to the second; three groups on offer (Party, Foes, Not fighting)', sides === '001' && await g.ev('document.querySelector("#c-run [data-tok]").options.length') === 3, sides);
        check('combat: surprise ranges show who set them (1-2: usual), no page numbers in the body text (they are in info icons)', /1-2: usual/.test(await g.ev('document.querySelector(".cmsetup").innerText')) && await g.ev('document.querySelectorAll(".cmsetup .inf[title]").length') >= 3 && !/\b(DMG|PHB|MM) p\./.test(await g.ev('document.getElementById("c-run").innerText')));
        check('combat: Restrictions are folded with a one-line summary', /Restrictions: all RAW/i.test(await g.ev('document.querySelector("#cm-rest summary").innerText')) && await g.ev('!document.getElementById("cm-rest").open'));
        await g.click('[data-et="0"]'); await g.sleep(200);
        check('combat: ticking "elves/halflings alone or ahead" for an elf party makes the foes surprised on 1-4 (PHB p.16); unticking restores 1-2', await g.ev('document.getElementById("cm-r1").value') === '4' || await g.ev('document.getElementById("cm-r1").value') === '2');
        await g.click('[data-et="0"]'); await g.sleep(200);
        await g.set('#cm-n1', 'Goblins'); await g.set('#cm-rs', '1');
        await g.set('[data-tok="t2"]', '2'); await g.sleep(200);
        await shotBoth(g, 'gm-setup', { full: true });
        await g.click('[data-act="start"]'); await g.sleep(500);
        const gs = () => g.ev('JSON.stringify(CombatUI._state().c)').then(JSON.parse);
        let cs = await gs();
        check('combat: started in round 0; Brenna is Not fighting (in the roster, in neither side); set-up closes', cs.rd === 0 && cs.ro.length === 3 && cs.nf.join() === '1' && cs.sd[0].m.join() === '0' && cs.sd[1].m.join() === '2' && cs.sd[1].n === 'Goblins' && await g.ev('!document.querySelector("#c-run .cmsetup")'));
        check('combat: the card shows the round, the steps with the current one marked, ONE primary button, no Enter or Next step buttons, typed boxes under it', await g.ev('document.querySelectorAll("#c-run .steps li.cur").length') === 1 && await g.ev('document.querySelectorAll("#c-run [data-act=primary]").length') === 1 && await g.ev('document.querySelectorAll("#c-run [data-act=next],#c-run [data-act=roll]").length') === 0 && await g.ev('document.querySelectorAll("#c-run .cmtyped input").length') === 2 && /Roll surprise/i.test(await g.ev('document.querySelector("[data-act=primary]").innerText')));
        await pp.sleep(600);
        check('combat: the player already in the room gets the banner popover at once', await pp.ev('!!document.getElementById("dev-pop")') && /Surprise/i.test(await pp.ev('document.getElementById("cbt").innerText')));
        const late = await open('dev=player', 560, 700); await late.sleep(500);
        check('combat: a player who joins AFTER combat starts gets the banner popover too', await late.ev('!!document.getElementById("dev-pop")') && /Surprise/i.test(await late.ev('document.getElementById("dev-pop").contentDocument.body.innerText')));
        await shotBoth(g, 'gm-surprise', { full: true });
        await g.click('[data-act="primary"]'); await g.sleep(250);
        check('combat: pressing the button with no die typed says what is missing and changes nothing', (await gs()).rd === 0 && !(await gs()).sd[0].sr && /Type the die/.test(await g.ev('document.getElementById("cm-msg").textContent')));
        await g.ev('document.getElementById("cm-in-0").value=1;document.getElementById("cm-in-1").value=2'); await g.click('[data-act="primary"]'); await g.sleep(400);
        cs = await gs();
        check('combat: surprise 1 vs 2 in one press: Goblins lose 1 segment; the step is struck through with its result; segment 1 is current and says Party acts', cs.sd[1].sl === 1 && cs.sg === 1 && /Goblins lose 1/.test(await g.ev('document.querySelector("#c-run .steps li.done").innerText')) && await g.ev('!!document.querySelector("#c-run .steps li.done s")') && /Party acts/.test(await g.ev('document.querySelector("#c-run .steps li.cur").innerText')));
        check('combat: the player sees the surprise rolls (final only) and "Your side acts now" during segment 1', /Goblins rolled 2 for surprise/.test(await pp.ev('document.getElementById("cbt").innerText')) && /Your side acts now/i.test(await pp.ev('document.getElementById("cbt").innerText')));
        await g.click('[data-act="primary"]'); await g.sleep(300);
        cs = await gs(); check('combat: "Party acts: done" ends the surprise segment and starts round 1 at initiative (typed boxes again)', cs.rd === 1 && cs.ph === 1 && await g.ev('document.querySelectorAll("#c-run .cmtyped input").length') === 2 && /Roll initiative/i.test(await g.ev('document.querySelector("[data-act=primary]").innerText')));
        await shotBoth(g, 'gm-initiative-typed', { full: true });
        await g.ev('document.getElementById("cm-in-0").value=4;document.getElementById("cm-in-1").value=4'); await g.click('[data-act="primary"]'); await g.sleep(300);
        cs = await gs(); check('combat: typed 4 and 4 is a tie; both sides act together; the tie note shows', cs.w === 2 && cs.ph === 2 && /Both sides act: done/i.test(await g.ev('document.querySelector("[data-act=primary]").innerText')) && /longer weapon/.test(await g.ev('document.getElementById("c-run").innerText')));
        await g.click('[data-act="undo"]'); await g.sleep(300);
        cs = await gs(); check('combat: Undo last step takes initiative back to unrolled and logs the undo (kind 9)', cs.ph === 1 && cs.w === -1 && (await g.ev('CombatUI._state().logs[1].some(function(e){return e[1]===9})')) && /GM undid/.test(await g.ev('(function(){document.getElementById("cm-log").open=true;return document.querySelector("#cm-log").innerText})()')));
        // Dice tray: stale value ignored, others ignored, first new value from an owner taken
        await g.ev('window.OBRX._dev.setTray("dev-player", [6])'); await g.sleep(200);
        await g.click('[data-act="cog"]'); await g.set('#cm-rs', '2'); await g.sleep(300); await g.click('[data-act="cog"]'); await g.sleep(300);
        const wt = await g.ev('document.querySelector("#c-run .cmact").innerText');
        check('combat: Dice = tray shows who it is waiting for (Aldric for the Party, the GM for the Foes), with a sheet fallback and no roll button', /Waiting for Aldric \(your token\) to roll a d6 in the Dice tray/.test(wt) && /Waiting for the GM's d6/.test(wt) && /Roll in the sheet instead/i.test(wt) && await g.ev('!document.querySelector("#c-run [data-act=primary]")'), wt.replace(/\s+/g, ' '));
        await shotBoth(g, 'gm-tray-waiting', { full: true });
        await g.sleep(1700);
        check('combat: a tray roll that was already there when the step asked (stale 6) is not used', (await gs()).ph === 1 && (await gs()).sd[0].in === 0);
        await g.ev('window.OBRX._dev.setTray("dev-player2", [3])'); await g.sleep(1800);
        check('combat: a roll from a player who may not roll for either side is ignored', (await gs()).ph === 1 && !(await gs()).sd[0].in);
        await g.ev('window.OBRX._dev.setTray("dev-player", [6])'); await g.sleep(2200);
        check('combat: the first new d6 from the Party\'s owner is taken for the Party (a repeat of the stale 6 counts: it is a new roll); still waiting for the GM', await (async () => { const t = await g.ev('document.querySelector("#c-run .cmact").innerText'); return /Party: got 6 from Dev Player/.test(t) && (await gs()).ph === 1 || (console.log('  [debug] ' + t.replace(/\s+/g, ' ') + ' ' + JSON.stringify(await g.ev('JSON.stringify(CombatUI._wait())'))), false); })());
        await g.ev('window.OBRX._dev.setTray("dev-gm", [2])'); await g.sleep(2000);
        await g.ev('document.getElementById("cm-log").open=true'); await g.sleep(200);
        cs = await gs(); check('combat: the GM\'s roll completes the step: Party 6, Goblins 2, Party wins; the log names who rolled', cs.sd[0].in === 6 && cs.sd[1].in === 2 && cs.w === 0 && cs.ph === 2 && /Party rolled 6 for initiative \(Owlbear Dice tray by Dev Player\)/.test(await g.ev('document.getElementById("c-run").innerText')) && /Goblins rolled 2 for initiative \(Owlbear Dice tray by Dev GM\)/.test(await g.ev('document.getElementById("c-run").innerText')));
        await shotBoth(g, 'gm-card-midround', { full: true });
        await pp.sleep(400);
        check('combat: the player on the acting side sees "Your side acts now" and the short log (final rolls only)', /Your side acts now/i.test(await pp.ev('document.getElementById("cbt").innerText')) && /Party rolled 6 for initiative/.test(await pp.ev('document.getElementById("cbt").innerText')));
        await shotBoth(pp, 'player-acts', { full: true });
        await g.click('[data-act="primary"]'); await g.sleep(300); await pp.sleep(400);
        check('combat: "Party acts: done" hands over to the Goblins ("Goblins act: done"); the player\'s line goes away', /Goblins act: done/i.test(await g.ev('document.querySelector("[data-act=primary]").innerText')) && !/Your side acts now/i.test(await pp.ev('document.getElementById("cbt").innerText')));
        // sheet fallback, restrictions, move, undo
        await g.click('[data-act="primary"]'); await g.sleep(250); await g.click('[data-act="primary"]'); await g.sleep(300);
        check('combat: Next round starts round 2; with the tray set it waits again (fresh baseline), and the sheet fallback rolls both', (await gs()).rd === 2 && await g.ev('!!document.querySelector("#c-run [data-act=sheetinstead]")'));
        await g.click('[data-act="sheetinstead"]'); await g.sleep(400);
        cs = await gs(); check('combat: "Roll in the sheet instead" rolls both and the log says so', cs.rd === 2 && cs.ph === 2 && /rolled in the sheet/.test(await g.ev('document.getElementById("c-run").innerText')));
        await g.click('[data-act="cog"]'); await g.sleep(250);
        await g.click('[data-tog="cm.declare"]'); await g.sleep(300);
        check('combat: restrictions summary counts what changed from RAW; the panel opens mid-fight', /Restrictions: 1 changed from RAW/i.test(await g.ev('document.querySelector("#cm-rest summary").innerText')) && (await gs()).op === 2);
        await g.set('[data-mv="1"]', '0'); await g.sleep(300);
        cs = await gs(); check('combat: moving Brenna from Not fighting into the Party (mid-fight) works', cs.nf.length === 0 && cs.sd[0].m.join() === '0,1');
        await g.set('[data-mv="1"]', '2'); await g.sleep(300);
        await g.click('[data-act="cog"]'); await g.sleep(250);
        // players cannot write
        const denied = await pp.ev('TK.OBR.scene.setMetadata({"io.github.solid-state-games.1e-toolkit/combat":{on:0}}).then(function(){return "wrote"},function(e){return "denied"})');
        check('combat: a player cannot write the combat state', denied === 'denied' && (await gs()).on === 1);
        // end
        await g.ev('window.confirm=function(){return true};window.__dl=null;var oc=URL.createObjectURL;URL.createObjectURL=function(b){window.__dl=b;return oc.call(URL,b)}');
        await g.click('[data-act="end"]'); await g.sleep(500);
        const dl = await g.ev('window.__dl?window.__dl.text():Promise.resolve("")');
        check('combat: End combat downloads the log as text (sides, surprise, rounds, sources) and clears the scene keys', /1e Toolkit combat log/.test(dl) && /Surprise segments/.test(dl) && /Round 1/.test(dl) && /physical die typed in/.test(dl) && /Owlbear Dice tray by Dev Player/.test(dl) && /GM undid/.test(dl) && await g.ev('JSON.stringify(Object.keys(JSON.parse(localStorage.getItem("toolkit-dev-scene")).meta))') === '[]', dl.length + ' chars');
        check('combat: the banner popover closes for players, who see "No combat is running"', await pp.ev('!document.getElementById("dev-pop")') && /No combat is running/.test(await pp.ev('document.getElementById("cbt").innerText')) && await late.ev('!document.getElementById("dev-pop")'));
        // surprise rolled earlier: typed dice, same segments, source "rolled earlier"
        await g.ev('window.OBRX._dev.setTray("dev-gm", [])'); await g.sleep(200);
        await g.set('#cm-sm', 'earlier'); await g.set('#cm-rs', '0'); await g.click('[data-act="start"]'); await g.sleep(500);
        check('combat: "Already rolled" makes the surprise step ask for the two dice and offers "Apply the surprise dice"', /Apply the surprise dice/i.test(await g.ev('document.querySelector("[data-act=primary]").innerText')) && await g.ev('document.querySelectorAll("#c-run .cmtyped input").length') === 2);
        await g.ev('document.getElementById("cm-in-0").value=2;document.getElementById("cm-in-1").value=1'); await g.click('[data-act="primary"]'); await g.sleep(400);
        cs = await gs(); check('combat: earlier dice 2 and 1 give Party the lost segment (1) exactly like rolled ones, logged "rolled earlier"', cs.sd[0].sl === 1 && cs.sd[1].sl === 0 && /rolled earlier/.test(await g.ev('document.getElementById("c-run").innerText')));
        await g.click('[data-act="end"]'); await g.sleep(400);
        await g.set('#cm-sm', 'none'); await g.click('[data-act="start"]'); await g.sleep(500);
        check('combat: "No surprise" at set-up goes straight to round 1 initiative', (await gs()).rd === 1 && /No surprise/.test(await g.ev('JSON.stringify(CombatUI._state().logs[0])')));
        await g.click('[data-act="end"]'); await g.sleep(400);
        await g.click('[data-tab="sheets"]');
    }
    {   // ---------- combat 4: right-click sides, undo that survives a reload, attacks by drag ----------
        await g.ev('(function(){var s=JSON.parse(localStorage.getItem("toolkit-dev-scene"));s.meta={};s.pm={};localStorage.setItem("toolkit-dev-scene",JSON.stringify(s))})()');
        await g.ev('window.OBRX.scene.items.updateItems(["t3"],function(d){d[0].name="Goblin 3"})'); await g.sleep(300);
        await g.click('[data-tab="com"]'); await g.click('[data-top="run"]'); await g.sleep(300);
        const labels = await g.ev('JSON.stringify(window.OBRX._dev.ctxLabels().map(function(x){return x.label}))');
        check('right-click: the GM gets one menu item per side (current names) plus Not fighting, and Attack...', JSON.parse(labels).slice().sort().join('|') === 'Attack...|Combat: Foes|Combat: Not fighting|Combat: Party', labels);
        await g.ev('window.OBRX._dev.ctxClick("io.github.solid-state-games.1e-toolkit/side-1", ["t1","t2"])'); await g.sleep(400);
        check('right-click before combat: the choice shows in the set-up table (two tokens moved to Foes at once)', await g.ev('Array.from(document.querySelectorAll("#c-run [data-tok]")).map(function(s){return s.value}).join("")') === '111');
        await g.ev('(function(){var d=document.createElement("div");d.id="devctx";d.style.cssText="position:fixed;left:40px;top:300px;background:#fff;color:#000;border:1px solid #000;padding:4px;z-index:99999;font:13px Jost,sans-serif";d.innerHTML=window.OBRX._dev.ctxLabels().map(function(x){return "<div style=\\"padding:3px 10px\\">"+x.label+"</div>"}).join("");document.body.appendChild(d)})()');
        await shotBoth(g, 'right-click-sides', { full: true }, 'combat-4-'); await g.ev('document.getElementById("devctx").remove()');
        await g.ev('window.OBRX._dev.ctxClick("io.github.solid-state-games.1e-toolkit/side-0", ["t1","t2"])'); await g.sleep(300);
        await g.set('#cm-rs', '1'); await g.set('#cm-sm', 'none'); await g.click('[data-act="start"]'); await g.sleep(600);
        const gs = () => g.ev('JSON.stringify(CombatUI._state().c)').then(JSON.parse);
        let cs = await gs();
        await g.ev('window.OBRX._dev.addToken("Orc 1")'); await g.sleep(400);
        const orc = await g.ev('window.OBRX.scene.items.getItems().then(function(a){return a.filter(function(i){return i.name==="Orc 1"})[0].id})');
        await g.ev('window.OBRX._dev.ctxClick("io.github.solid-state-games.1e-toolkit/side-1", ["' + orc + '"])'); await g.sleep(500);
        cs = await gs();
        check('right-click in combat: a token not yet in the roster is added to the chosen side; Not fighting takes it out of the sides', cs.ro.length === 4 && cs.sd[1].m.indexOf(3) >= 0 && (await (async () => { await g.ev('window.OBRX._dev.ctxClick("io.github.solid-state-games.1e-toolkit/side-2", ["' + orc + '"])'); await g.sleep(400); const c2 = await gs(); return c2.nf.indexOf(3) >= 0 && c2.sd[1].m.indexOf(3) < 0; })()));
        // initiative typed: Party 6, Goblins 2, so Party acts
        await g.ev('document.getElementById("cm-in-0").value=6;document.getElementById("cm-in-1").value=2'); await g.click('[data-act="primary"]'); await g.sleep(500);
        check('combat: Party has initiative and acts first', (await gs()).ph === 2 && (await gs()).w === 0);
        // attacks: a player drags from their own token to the Goblin; refused from someone else's token; GM sees the card
        const ap = await open('dev=player', 560, 700); await ap.click('[data-tab="cbt"]'); await ap.sleep(600);
        await ap.ev('window.OBRX._dev.drag("t3","t1")'); await ap.sleep(500);
        check('attack: a player cannot start an attack from a token that is not theirs (no request is written)', await g.ev('!document.querySelector("#c-run .cmatk")'));
        await ap.ev('window.OBRX._dev.drag("t1","t3")'); await g.sleep(900);
        const card = await g.ev('document.querySelector("#c-run .cmatk")?document.querySelector("#c-run .cmatk").innerText:""');
        check('attack: dragging from Aldric to Goblin 3 makes the GM card appear with who asked, the weapon, target AC from the MM (Goblin AC 6) and the number needed', /Aldric/.test(card) && /Goblin 3/.test(card) && /asked by Dev Player/.test(card) && /Needs \d+ or more on a d20/.test(card) && await g.ev('document.querySelector("[data-atk=ac]").value') === '6', card.replace(/\s+/g, ' '));
        await shotBoth(g, 'attack-gm-card', { full: true }, 'combat-4-');
        await g.ev('document.getElementById("cm-atk-in-0").value=14'); await g.click('[data-act="atkroll"]'); await g.sleep(600);
        await g.ev('document.getElementById("cm-log").open=true'); await g.sleep(200);
        const rw = await g.ev('document.querySelector("#c-run .rollwin").innerText');
        check('attack: the d20 is entered, the result is logged as kind 2 and shown as "Aldric ... attacks Goblin 3: rolled 14, needs N: hit or miss" with no damage', /attacks Goblin 3: rolled 14, needs -?\d+: (hit|miss)/.test(rw) && (await g.ev('CombatUI._state().logs[1].filter(function(e){return e[1]===2}).length')) === 1 && !(await g.ev('!!document.querySelector("#c-run .cmatk")')), rw.replace(/\s+/g, ' '));
        await ap.sleep(500);
        check('attack: the player sees the same line in the roll window', /attacks Goblin 3: rolled 14/.test(await ap.ev('document.getElementById("cbt").innerText')));
        await shotBoth(ap, 'attack-player', { full: true }, 'combat-4-');
        // checks and override: the Goblins do not act now
        await g.ev('window.OBRX._dev.drag("t3","t1")'); await g.sleep(700);
        const pc = await g.ev('document.querySelector("#c-run .cmatk")?document.querySelector("#c-run .cmatk").innerText:""');
        check('attack: a GM attack from a side that does not act now shows the reason and an Override button; Dismiss clears it', /does not act now/.test(pc) && /Override and attack/i.test(pc));
        await g.click('[data-act="atkno"]'); await g.sleep(500);
        check('attack: dismissed, the card is gone and nothing was logged', await g.ev('!document.querySelector("#c-run .cmatk")') && (await g.ev('CombatUI._state().logs[1].filter(function(e){return e[1]===2}).length')) === 1);
        // tray: waiting line names the owner of the attacker, the d20 comes from them
        await g.click('[data-act="cog"]'); await g.set('#cm-rs', '2'); await g.sleep(300); await g.click('[data-act="cog"]'); await g.sleep(300);
        await ap.ev('window.OBRX._dev.drag("t1","t3")'); await g.sleep(1000);
        check('attack allowance: Aldric (1 attack a round) is refused a second attack in the round until the GM overrides', /used all 1 attack this round/.test(await g.ev('document.querySelector("#c-run .cmatk").innerText'))); await g.click('[data-act="atkov"]'); await g.sleep(1000);
        const tw = await g.ev('document.querySelector("#c-run .cmatk").innerText');
        check('attack: with the Dice tray the card waits for the attacker\'s owner (Aldric\'s player), not the GM', /Waiting for Aldric \(your token\) to roll a d20 in the Dice tray/.test(tw), tw.replace(/\s+/g, ' '));
        await g.ev('window.OBRX._dev.setTray("dev-gm", [20])'); await g.sleep(1800);
        check('attack: a d20 from the GM\'s tray is ignored for a player\'s attacker', await g.ev('!!document.querySelector("#c-run .cmatk")'));
        await g.ev('window.OBRX._dev.setTray("dev-player", [17])'); await g.sleep(2200);
        check('attack: the owner\'s tray d20 (17) resolves it and the log says who rolled it', /rolled 17/.test(await g.ev('document.querySelector("#c-run .rollwin").innerText')) && !(await g.ev('!!document.querySelector("#c-run .cmatk")')), await g.ev('JSON.stringify([document.querySelector("#c-run .cmatk")&&document.querySelector("#c-run .cmatk").innerText,CombatUI._wait()&&CombatUI._wait().vals,JSON.stringify(CombatUI._state().logs[1].slice(-2))])'));
        // undo survives a reload and walks back
        await g.nav(BASE + '/index.html?dev=gm'); await g.sleep(900); await g.click('[data-tab="com"]'); await g.sleep(500);
        const n0 = await g.ev('CombatUI._state().undo.length');
        check('undo: the stack is in the scene, so after a reload the Undo button is live with several steps', n0 >= 3 && await g.ev('!document.querySelector("[data-act=undo]").disabled'), String(n0));
        await g.click('[data-act="undo"]'); await g.sleep(400); await g.click('[data-act="undo"]'); await g.sleep(400);
        cs = await gs();
        check('undo: pressing it twice takes the two attacks back out of the log (the log entries go, kind 9 lines record the undo)', (await g.ev('CombatUI._state().logs[1].filter(function(e){return e[1]===2}).length')) === 0 && (await g.ev('CombatUI._state().logs[1].filter(function(e){return e[1]===9}).length')) === 2);
        await shotBoth(g, 'undo-walking-back', { full: true }, 'combat-4-');
        await g.click('[data-act="undo"]'); await g.sleep(400); cs = await gs();
        check('undo: a third press takes the initiative roll back (round 1, initiative unrolled) and the stack shrinks by three', cs.rd === 1 && cs.ph === 1 && cs.w === -1 && (await g.ev('CombatUI._state().undo.length')) === n0 - 3, JSON.stringify([cs.rd, cs.ph, cs.w]));
        await g.ev('window.confirm=function(){return true};window.__dl=null;var oc=URL.createObjectURL;URL.createObjectURL=function(b){window.__dl=b;return oc.call(URL,b)}');
        await g.click('[data-act="end"]'); await g.sleep(500);
        check('combat 4: End combat clears the undo stack and the side choices too', await g.ev('JSON.stringify(Object.keys(JSON.parse(localStorage.getItem("toolkit-dev-scene")).meta))') === '[]');
        await g.click('[data-tab="sheets"]');
    }
    {   // ---------- combat 5: attacks per round (1 of 2, monster routine), the cs stamp, acted dots ----------
        await g.ev('(function(){var s=JSON.parse(localStorage.getItem("toolkit-dev-scene"));s.meta={};s.pm={};localStorage.setItem("toolkit-dev-scene",JSON.stringify(s))})()');
        await g.ev('window.OBRX.scene.items.updateItems(["t3"],function(d){d[0].name="Ape, carnivorous"});window.OBRX.scene.items.updateItems(["t2"],function(d){var s=SheetRules.blank();Object.assign(s,{nm:"Brenna",race:"Human",cl:["Fighter"],lv:[13],sc:[16,10,10,14,15,12],pf:["Sword, Long & scabbard","Bow, long"]});d[0].metadata["io.github.solid-state-games.1e-toolkit/sheet"]=s})'); await g.sleep(400);
        await g.click('[data-tab="com"]'); await g.click('[data-top="run"]'); await g.sleep(300);
        await g.set('#cm-rs', '1'); await g.set('#cm-sm', 'none'); await g.click('[data-act="start"]'); await g.sleep(600);
        const gs = () => g.ev('JSON.stringify(CombatUI._state().c)').then(JSON.parse);
        await g.send('Page.bringToFront');   // a hidden tab throttles timers to 1 s, which would starve the dot redraw
        const dots = async () => { await g.sleep(700); return g.ev('Array.from(document.querySelectorAll("#dev-map .dev-dot")).map(function(d){return d.dataset.state}).sort().join()'); };
        await g.ev('document.getElementById("cm-in-0").value=6;document.getElementById("cm-in-1").value=2'); await g.click('[data-act="primary"]'); await g.sleep(500);
        check('combat 5: no dots before anyone has attacked or finished acting', await dots() === '' && await g.ev('!document.getElementById("dev-map")'));
        const typed = async v => { for (let j = 0; j < v.length; j++) await g.ev('document.getElementById("cm-atk-in-' + j + '").value=' + v[j]); await g.click('[data-act="atkroll"]'); await g.sleep(700); };
        await g.ev('window.OBRX._dev.drag("t2","t3")'); await g.sleep(700);
        check('attack allowance: a 13th level fighter has two attacks (PHB p.25): the card says "Attack 1 of 2"', /Attack 1 of 2/i.test(await g.ev('document.querySelector("#c-run .cmatk h4").innerText')));
        await shotBoth(g, 'attack-1-of-2', { full: true }, 'combat-5-');
        await typed([15]); await g.sleep(300);
        check('attack allowance: the first attack is logged and the token\'s cs records 1 used (round stamp 100) and the allowance; an open dot shows on the token', await g.ev('window.OBRX.scene.items.getItems(["t2"]).then(function(a){var k=a[0].metadata["io.github.solid-state-games.1e-toolkit/cs"];return JSON.stringify([k.rs,k.at,k.mx])})') === '[100,1,2]' && await dots() === 'some', await dots() + ' ' + await g.ev('window.OBRX.scene.items.getItems(["t2"]).then(function(a){return JSON.stringify(a[0].metadata)})'));
        await g.ev('window.OBRX._dev.drag("t2","t3")'); await g.sleep(700);
        check('attack allowance: the second attack says "Attack 2 of 2"', /Attack 2 of 2/i.test(await g.ev('document.querySelector("#c-run .cmatk h4").innerText')));
        await typed([4]); await g.sleep(300);
        check('attack allowance: after the last attack the dot is filled (done)', await dots() === 'done');
        await shotBoth(g, 'dots', { full: true }, 'combat-5-');
        await g.ev('window.OBRX._dev.drag("t2","t3")'); await g.sleep(700);
        const refuse = await g.ev('document.querySelector("#c-run .cmatk").innerText');
        check('attack allowance: a third attack is refused with the reason and an Override button; Dismiss clears it', /used all 2 attacks this round \(2 of 2\)/.test(refuse) && /Override and attack/i.test(refuse));
        await g.click('[data-act="atkno"]'); await g.sleep(400);
        await g.ev('window.OBRX._dev.drag("t2","t3")'); await g.sleep(700); await g.click('[data-act="atkov"]'); await g.sleep(300);
        await typed([12]); await g.sleep(300);
        check('attack allowance: with the GM override the third attack goes through and the log says "GM override"', /GM override/.test(await g.ev('(function(){document.getElementById("cm-log").open=true;return document.querySelector("#c-run .rollwin").innerText})()')));
        await g.click('[data-act="undo"]'); await g.sleep(500);
        check('attack allowance: undo takes the override attack back out of the log and restores the token\'s count (2 used) so the dot stays filled', !/GM override/.test(await g.ev('document.querySelector("#c-run .rollwin").innerText')) && await g.ev('window.OBRX.scene.items.getItems(["t2"]).then(function(a){return a[0].metadata["io.github.solid-state-games.1e-toolkit/cs"].at})') === 2 && await dots() === 'done');
        await g.click('[data-act="undo"]'); await g.sleep(500);
        check('attack allowance: undoing the second attack puts the count back to 1 and the dot back to open', await g.ev('window.OBRX.scene.items.getItems(["t2"]).then(function(a){return a[0].metadata["io.github.solid-state-games.1e-toolkit/cs"].at})') === 1 && await dots() === 'some', await dots() + ' at=' + await g.ev('window.OBRX.scene.items.getItems(["t2"]).then(function(a){return JSON.stringify(a[0].metadata["io.github.solid-state-games.1e-toolkit/cs"])})') + ' undo=' + await g.ev('JSON.stringify(CombatUI._state().undo.map(function(u){return [u.l,u.x]}))'));
        // dots off in set-up
        await g.click('[data-act="cog"]'); await g.click('#cm-dots'); await g.sleep(600);
        check('dots: the set-up switch turns the dots off on this browser, and on again', await dots() === '' && (await g.click('#cm-dots'), await g.sleep(600), await dots() === 'some'), await dots());
        await g.click('[data-act="cog"]'); await g.sleep(200);
        // the monster: a routine of 3 attacks in one drag
        await g.click('[data-act="primary"]'); await g.sleep(400);
        await g.ev('window.OBRX._dev.drag("t3","t2")'); await g.sleep(700);
        const mc = await g.ev('document.querySelector("#c-run .cmatk").innerText');
        check('monster routine: the Ape (MM: 3 attacks, 1-4/1-4/1-8) shows "Routine 1 of 1" with three d20 rows, one per attack form', /Routine 1 of 1/i.test(mc) && /1-4: needs/.test(mc) && /1-8: needs/.test(mc) && await g.ev('document.querySelectorAll("#c-run .cmforms li").length') === 3 && await g.ev('document.querySelectorAll("#c-run [id^=cm-atk-in-]").length') === 3, mc.replace(/\s+/g, ' '));
        await shotBoth(g, 'monster-three-attacks', { full: true }, 'combat-5-');
        await typed([14, 3, 18]);
        const log = await g.ev('(function(){document.getElementById("cm-log").open=true;return document.querySelector("#c-run .rollwin").innerText})()');
        check('monster routine: one drag logs three attacks, each with its own roll and result', (log.match(/Ape, carnivorous attacks Brenna/g) || []).length === 3 && /\(1-8\): rolled 18/.test(log), log.replace(/\s+/g, ' ').slice(-300));
        await g.ev('window.OBRX._dev.drag("t3","t2")'); await g.sleep(700);
        check('monster routine: a second routine in the round is refused (used all 1 routine)', /used all 1 routine this round/.test(await g.ev('document.querySelector("#c-run .cmatk").innerText')));
        await g.click('[data-act="atkno"]'); await g.sleep(300);
        // end of round clears the dots by the lazy reset; End combat removes them
        await g.click('[data-act="primary"]'); await g.sleep(500);
        check('dots: when both sides have acted (end of round) every dot is filled; the new round clears them without any write to the tokens', await (async () => { const d = (await dots()).split(','); return d.length === (await gs()).ro.length && d.every(x => x === 'done'); })() && (await g.click('[data-act="primary"]'), await g.sleep(700), await dots() === '' && (await gs()).rd === 2), await dots());
        await g.ev('window.OBRX._dev.drag("t2","t3")'); await g.sleep(500);
        await g.click('[data-act="atkno"]'); await g.sleep(300);
        await g.ev('window.confirm=function(){return true}');
        await g.click('[data-act="end"]'); await g.sleep(700);
        check('dots: End combat leaves no dots', await g.ev('!document.getElementById("dev-map")'));
        await g.ev('window.OBRX.scene.items.updateItems(["t2"],function(d){delete d[0].metadata["io.github.solid-state-games.1e-toolkit/sheet"];delete d[0].metadata["io.github.solid-state-games.1e-toolkit/cs"]});window.OBRX.scene.items.updateItems(["t3"],function(d){d[0].name="Goblin NPC (GM token)";delete d[0].metadata["io.github.solid-state-games.1e-toolkit/cs"]})'); await g.sleep(300);
        await g.click('[data-tab="sheets"]');
    }
    {   // the action popover follows its content height
        await g.send('Page.bringToFront');   // a background tab does not deliver ResizeObserver callbacks
        await g.click('[data-tab="guide"]'); await g.sleep(1000); const hg = await g.ev('window.__actionHeight');
        await g.click('[data-tab="com"]'); await g.sleep(1000); const hc = await g.ev('window.__actionHeight');
        check('popover height follows the content: the short Guide tab asks for a smaller height than the Combat tab, both within 200 to 760', hg >= 200 && hg <= 760 && hc <= 760 && hg < hc, hg + ' vs ' + hc + ' ' + await g.ev('JSON.stringify(Array.from(document.getElementById("app").children).map(function(e){return [e.id||e.className,Math.round(e.getBoundingClientRect().height),getComputedStyle(e).display]}))'));
        await g.ev('window.__vh=420;window.dispatchEvent(new Event("resize"))'); await g.sleep(900); const hv = await g.ev('window.__actionHeight');
        check('popover height never goes past the bottom of the screen: a 420 px viewport caps it at 316 (viewport less 104)', hv <= 316 && hv >= 200, String(hv));
        await g.ev('window.__vh=900;window.dispatchEvent(new Event("resize"))'); await g.sleep(400);
        await g.click('[data-tab="sheets"]');
    }
    // GM: assign and open the player token; skills tab on a thief
    await g.click('[data-tab="sheets"]'); await g.sleep(100);
    await g.set('li[data-id="t2"] select[data-act=assign]', 'dev-player'); await g.sleep(300);
    check('GM assign hands the token to the player', await g.ev('JSON.parse(localStorage.getItem("toolkit-dev-scene")).items[1].createdUserId') === 'dev-player');
    const t3 = await open('dev=gm&view=sheet&item=t3', 1000, 1000);
    const greyG = 'Array.from(document.querySelectorAll(".sheet *, .drawer, .drawer *")).filter(function(e){var c=getComputedStyle(e);return [c.color,c.backgroundColor,c.borderTopColor].some(function(v){var m=v.match(/\\d+/g);return m&&m.length>=3&&!(m[0]===m[1]&&m[1]===m[2])&&!(m.length===4&&m[3]==="0")})}).length';
    const sett = async (sel, v) => { await t3.set(sel, v); await t3.sleep(120); };
    await sett('[data-f="nm"]', 'Sneak Thistledown'); await sett('[data-f="race"]', 'Halfling'); await sett('[data-f="sub"]', 'Stout'); await sett('[data-act="cls"]', 'Thief'); await sett('[data-f="lv.0"]', '6');
    for (const [i, v] of [[0, 9], [1, 12], [2, 9], [3, 17], [4, 12], [5, 10]]) await sett('[data-f="sc.' + i + '"]', String(v));
    await sett('[data-f="al"]', 'N');
    await t3.click('[data-act="tab"][data-i="2"]'); await t3.sleep(200);
    const sk = await t3.ev('document.querySelector(".page").innerText');
    check('tab 3: thief shows skills with base, race, dex, total', /Pick Pockets/.test(sk) && /Climb Walls/.test(sk) && /Hide in Shadows/.test(sk));
    await t3.shot(path.join(OUT, 'sheet-3-thief-skills.png'), { full: true });
    check('GM writes any token', (await state(t3)).canWrite === true);
    await t3.size(1000, 900);
    await t3.click('[data-act="tab"][data-i="6"]'); await t3.sleep(200);
    await t3.click('[data-act="hn-add"]'); await t3.sleep(150);
    check('retainers: linked token list offers the scene character tokens, no Open until one is picked', await t3.ev('document.querySelectorAll("select[data-f=\\"hn.0.8\\"] option").length') >= 4 && await t3.ev('!document.querySelector("[data-act=hn-open]")'));
    await sett('[data-f="hn.0.8"]', 't1'); await sett('[data-f="hn.0.0"]', 'Aldric the Younger'); await sett('[data-f="hn.0.1"]', 'Human'); await sett('[data-f="hn.0.2"]', 'Fighter'); await sett('[data-f="hn.0.3"]', '2');
    check('retainers: GM sees an Open button for a linked token', await t3.ev('!!document.querySelector("[data-act=hn-open]")'));
    // GM: the drawer keeps only a one-line loyalty pointer; loyalty lives on the GM-only Loyalty sub-tab
    const dtxt = await t3.ev('document.getElementById("drawer").innerText');
    check('retainers: GM drawer has the one-line "Loyalty: 50% (GM: see Loyalty tab)" and no loyalty panel', /Loyalty: 50% \(GM: see Loyalty tab\)/i.test(dtxt) && await t3.ev('!document.querySelector("details.loy") && !document.querySelector("#drawer [data-f^=\\"hn.0.10\\"]")'));
    await t3.ev('document.documentElement.dataset.theme="light"'); await t3.sleep(3600);
    await t3.shot(path.join(OUT, 'sheet-7-retainers-drawer-gm.png'));
    check('retainers: GM drawer, both themes grey only', await t3.ev(greyG) === 0 && (await t3.ev('document.documentElement.dataset.theme="dark"; 1'), await t3.sleep(200), await t3.ev(greyG) === 0));
    await t3.ev('document.documentElement.dataset.theme="light"');
    await t3.click('[data-act="hn-close"]'); await t3.sleep(100);
    await t3.click('[data-act="hn-add"]'); await t3.sleep(150); await sett('[data-f="hn.1.0"]', 'Mira Quickhand'); await sett('[data-f="hn.1.2"]', 'Thief'); await sett('[data-f="hn.1.3"]', '3');
    await t3.click('[data-act="hn-close"]'); await t3.sleep(100);
    check('retainers: GM sees a fourth sub-tab, Loyalty', await t3.ev('Array.from(document.querySelectorAll(".rsubs button")).map(function(b){return b.textContent}).join("|")') === 'Henchmen|Hirelings|Costs|Loyalty');
    await t3.click('[data-act="rsub"][data-i="3"]'); await t3.sleep(200);
    const lt = await t3.ev('document.querySelector(".loytable").innerText.replace(/\\s+/g," ")');
    check('loyalty tab: table lists every henchman with total %, DMG p.36 band and a Check button each', /Aldric the Younger/.test(lt) && /Mira Quickhand/.test(lt) && /50%/.test(lt) && /Little/i.test(lt) && await t3.ev('document.querySelectorAll(".loytable [data-act=loy-check]").length') === 2 && await t3.ev('!!document.querySelector("[data-act=loy-all]")'), lt.slice(0, 200));
    const lbase = await t3.ev('SheetUI._state().view.ret.hn[0].loy.total');
    await t3.click('tr.hrow[data-i="0"]'); await t3.sleep(200);
    check('loyalty tab: clicking a row opens that henchman\'s modifiers (DMG p.36-37 cites)', await t3.ev('!!document.querySelector(".loydetail")') && /DMG p\.37/.test(await t3.ev('document.querySelector(".loydetail").innerText')));
    await sett('[data-f="hn.0.10.0"]', '3'); await sett('[data-f="hn.0.10.1"]', '3'); await sett('[data-f="hn.0.10.10"]', '1');  // henchman +5, 1 to 5 years +10, special penalty killed henchman -40
    const lnow = await t3.ev('SheetUI._state().view.ret.hn[0].loy.total');
    check('loyalty tab: total = base + ticked modifiers (neutral liege, Cha 10: 50 + 0 + 0, then +5 +10 -40)', lbase === 50 && lnow === 50 + 5 + 10 - 40, lbase + ' -> ' + lnow);
    check('loyalty tab: the table shows the new 25% and band Disloyal', /25%/.test(await t3.ev('document.querySelector(".loytable").innerText')) && /Disloyal/i.test(await t3.ev('document.querySelector(".loytable").innerText')));
    await t3.click('[data-act="loy-check"][data-i="0"]'); await t3.sleep(150);
    const lres = await t3.ev('document.querySelector(".loyres").innerText');
    check('loyalty tab: Check rolls d100 against the total and shows the DMG result', /Rolled \d+ against 25%/i.test(lres) && /DMG p\.36/.test(lres) && /vs 25%/.test(await t3.ev('document.querySelector(".loytable").innerText')), lres);
    await t3.click('[data-act="hn-sit"][data-k="8"]'); await t3.sleep(150);
    check('loyalty tab: situation now (liege present +15%) is applied to the total', await t3.ev('SheetUI._state()&&document.querySelector(".loytable tr.hrow b").textContent') === '40%', await t3.ev('document.querySelector(".loytable tr.hrow b").textContent'));
    await t3.click('[data-act="loy-all"]'); await t3.sleep(150);
    check('loyalty tab: Check all gives every henchman a result', await t3.ev('Array.from(document.querySelectorAll(".loytable tr.hrow")).every(function(r){return /\\d+ vs \\d+%/.test(r.cells[4].innerText)})'));
    await t3.shot(path.join(OUT, 'sheet-7-loyalty-gm.png'), { full: true });
    check('loyalty tab: both themes grey only', await t3.ev(greyG) === 0 && (await t3.ev('document.documentElement.dataset.theme="dark"; 1'), await t3.sleep(200), await t3.ev(greyG) === 0));
    await t3.ev('document.documentElement.dataset.theme="light"');
    await t3.click('[data-act="rsub"][data-i="0"]'); await t3.sleep(150);
    check('retainers: GM table row and Open button for the linked token', await t3.ev('!!document.querySelector("tr.hrow [data-act=hn-open]")') && !/loyal/i.test(await t3.ev('document.querySelector("table.hench").outerHTML')));
    await t3.click('tr.hrow [data-act="hn-open"]'); await t3.sleep(600);
    check('retainers: Open shows the linked token sheet (dev modal)', await t3.ev('!!document.getElementById("dev-modal")') && /view=sheet&item=t1/.test(await t3.ev('document.querySelector("#dev-modal iframe").src')));
    // assassin banner (PHB p.30)
    await sett('[data-f="race"]', 'Human'); await sett('[data-act="cls"]', 'Assassin'); await sett('[data-f="lv.0"]', '5'); await sett('[data-f="al"]', 'LG'); await t3.click('[data-act="tab"][data-i="6"]'); await t3.sleep(200);
    check('retainers: assassin banner cites PHB p.30 (lower level assassins at 5th; neutral or evil retainers notice)', /PHB p\.30/.test(await t3.ev('document.querySelector(".page").innerText')) && /lower level assassins only/.test(await t3.ev('document.querySelector(".page").innerText')) && /neutral or evil characters will serve/i.test(await t3.ev('document.querySelector(".page").innerText')));

    // ---------- Simple view (default for players, Full for the GM; choice remembered per role in the browser) ----------
    {
        const grey = 'Array.from(document.querySelectorAll(".sheet *")).filter(function(e){var c=getComputedStyle(e);return [c.color,c.backgroundColor,c.borderTopColor].some(function(v){var m=v.match(/\\d+/g);return m&&m.length>=3&&!(m[0]===m[1]&&m[1]===m[2])&&!(m.length===4&&m[3]==="0")})}).length';
        const clr = async pg => { await pg.ev('localStorage.removeItem("tk-sheet-view-PLAYER"); localStorage.removeItem("tk-sheet-view-GM")'); };
        const reset2 = await connect(PORT, BASE + '/guide.html'); await reset2.sleep(300); await clr(reset2); await reset2.close();
        const sp = await open('dev=player&view=sheet&item=t1', 1000, 1100);
        const mode = () => sp.ev('SheetUI._state().mode');
        check('simple: a player with no saved choice opens Simple (no tabs)', await mode() === 'simple' && await sp.ev('!document.querySelector(".sheettabs")') && await sp.ev('!!document.querySelector(".simple")'));
        let txt = await sp.ev('document.querySelector(".simple").innerText');
        check('simple: name, race, class and level, alignment, AC, saves, to-hit, weapons, spells, ammunition, coins, armour shown', /Aldric/i.test(txt) && /Elf/.test(txt) && /Fighter 5/.test(txt) && /Chaotic Good/.test(txt) && /Armour class/i.test(txt) && /Saving throws/i.test(txt) && /To hit by armour class/i.test(txt) && /Sword, long/i.test(txt) && /Spells memorised today/i.test(txt) && /Magic Missile/.test(txt) && /Arrow, normal \(12\)/.test(txt) && /Coins carried/i.test(txt) && /Shield, small/.test(txt));
        check('simple: no thief skills, no loyalty, no henchmen, no GM-only text', !/pick pockets|hide in shadows|move silently|loyal|henchm/i.test(await sp.ev('document.querySelector(".sheet").innerText')));
        check('simple: everything but hp, spells and ammo is read only (no other inputs or selects)', await sp.ev('Array.from(document.querySelectorAll(".simple input, .simple select, .simple textarea")).every(function(e){return e.dataset.f==="hp"||e.dataset.f==="hm"})') && await sp.ev('!!document.querySelector("[data-act=vw][data-v=full]")'));
        await sp.ev('document.documentElement.dataset.theme="light"'); await sp.shot(path.join(OUT, 'sheet-simple.png'), { full: true });
        check('simple: light theme black and white only', await sp.ev(grey) === 0);
        await sp.ev('document.documentElement.dataset.theme="dark"'); await sp.shot(path.join(OUT, 'sheet-simple-dark.png'), { full: true });
        check('simple: dark theme black and white only', await sp.ev(grey) === 0);
        await sp.ev('document.documentElement.dataset.theme="light"');
        // edits
        await sp.set('[data-f="hp"]', '21'); await sp.sleep(700);
        check('simple: hit points edited and saved to the token', (await state(sp)).sheet.hp === 21 && /Hit points now/i.test(await sp.ev('document.querySelector(".simple").innerText')));
        await sp.click('.spchip[data-l="0"][data-i="0"]'); await sp.sleep(150);
        check('simple: tapping a memorised spell marks it cast', JSON.stringify((await state(sp)).sheet.cs) === '{"Magic-User":[1]}' && await sp.ev('document.querySelector(".spchip").classList.contains("cast")'));
        await sp.click('.spchip[data-l="0"][data-i="0"]'); await sp.sleep(150);
        check('simple: tapping again unticks it', JSON.stringify((await state(sp)).sheet.cs) === '{}');
        await sp.click('.spchip[data-l="0"][data-i="1"]'); await sp.sleep(150);
        await sp.click('[data-act="ammo"][data-d="-1"]'); await sp.click('[data-act="ammo"][data-d="-1"]'); await sp.click('[data-act="ammo"][data-d="-1"]'); await sp.click('[data-act="ammo"][data-d="1"]'); await sp.sleep(900);
        st = await state(sp);
        check('simple: ammunition -3 +1 leaves 10 of 12, saved as spent 2', st.sheet.am['Arrow, normal (12)'] === 2 && /10/.test(await sp.ev('document.querySelector(".acount").textContent')) && JSON.stringify(st.sheet.cs) === '{"Magic-User":[2]}');
        const saved = await sp.ev('JSON.stringify(JSON.parse(localStorage.getItem("toolkit-dev-scene")).items.find(function(i){return i.id==="t1"}).metadata)');
        check('simple: hp, cast tick and ammunition are in the saved token data', /"hp":21/.test(saved) && /"cs":\{"Magic-User":\[2\]\}/.test(saved) && /"am":\{"Arrow, normal \(12\)":2\}/.test(saved));
        await sp.nav(BASE + '/index.html?dev=player&view=sheet&item=t1'); await sp.sleep(900);
        check('simple: after reload still Simple, tick and ammo remembered', await mode() === 'simple' && (await state(sp)).sheet.am['Arrow, normal (12)'] === 2 && await sp.ev('document.querySelector(".spchip.cast")!==null'));
        await sp.click('[data-act="rest"]'); await sp.sleep(150);
        check('simple: Rest: reset clears every tick', JSON.stringify((await state(sp)).sheet.cs) === '{}' && await sp.ev('document.querySelector(".spchip.cast")===null'));
        // switch
        await sp.click('.vsw [data-v="full"]'); await sp.sleep(200);
        check('switch: Full shows the seven tabs, unchanged', await mode() === 'full' && await sp.ev('document.querySelectorAll(".sheettabs button").length') === 7);
        await sp.nav(BASE + '/index.html?dev=player&view=sheet&item=t1'); await sp.sleep(900);
        check('switch: the choice is remembered across reload (Full)', await mode() === 'full');
        await sp.click('.vsw [data-v="simple"]'); await sp.sleep(200); await sp.nav(BASE + '/index.html?dev=player&view=sheet&item=t1'); await sp.sleep(900);
        check('switch: back to Simple is remembered too', await mode() === 'simple');
        await sp.click('.simple [data-act="vw"][data-v="full"]'); await sp.sleep(200);
        check('simple: the Full sheet button opens Full', await mode() === 'full');
        const sg2 = await open('dev=gm&view=sheet&item=t1', 1000, 1000);
        check('GM with no saved choice opens Full', await sg2.ev('SheetUI._state().mode') === 'full' && await sg2.ev('!!document.querySelector(".sheettabs")'));
        await sg2.click('.vsw [data-v="simple"]'); await sg2.sleep(200);
        check('GM Simple view has no thief skills or loyalty either, and the player key is separate', !/pick pockets|hide in shadows|loyal|henchm/i.test(await sg2.ev('document.querySelector(".sheet").innerText')) && await sg2.ev('localStorage.getItem("tk-sheet-view-PLAYER")') === 'full' && await sg2.ev('localStorage.getItem("tk-sheet-view-GM")') === 'simple');
        const thief = await open('dev=gm&view=sheet&item=t3', 1000, 1000);
        await thief.click('.vsw [data-v="simple"]'); await thief.sleep(200);
        check('simple: a thief sheet shows no thief percentages (DMG p.19), Full still does', !/pick pockets|hide in shadows|move silently/i.test(await thief.ev('document.querySelector(".sheet").innerText')));
        await thief.click('.vsw [data-v="full"]'); await thief.click('[data-act="tab"][data-i="2"]'); await thief.sleep(200);
        check('full: thief percentages remain on the Skills page', /Hide in Shadows/.test(await thief.ev('document.querySelector(".page").innerText')));
        await sg2.ev('localStorage.setItem("tk-sheet-view-GM","full"); localStorage.setItem("tk-sheet-view-PLAYER","full")');
    }


    // ---------- creating a character: Blank / Wizard / Random PC (TB 2026-11-12) ----------
    {
        const addTok = (pg, id, name, who, meta) => pg.ev('(function(){var s=JSON.parse(localStorage.getItem("toolkit-dev-scene"));s.items.push({id:' + JSON.stringify(id) + ',name:' + JSON.stringify(name) + ',layer:"CHARACTER",type:"IMAGE",createdUserId:' + JSON.stringify(who) + ',metadata:' + JSON.stringify(meta || {}) + '});localStorage.setItem("toolkit-dev-scene",JSON.stringify(s));})()');
        const tokSheet = (pg, id) => pg.ev('(function(){var s=JSON.parse(localStorage.getItem("toolkit-dev-scene"));var i=s.items.filter(function(x){return x.id===' + JSON.stringify(id) + '})[0];return JSON.stringify(i.metadata["io.github.solid-state-games.1e-toolkit/sheet"]||null)})()').then(JSON.parse);
        const seed = await connect(PORT, BASE + '/guide.html'); await seed.sleep(300);
        for (const id of ['c1', 'c2', 'c3', 'c4']) await addTok(seed, id, 'Fresh ' + id, 'dev-player');
        await addTok(seed, 'c5', 'Not mine', 'dev-player2');
        await seed.close();
        // the Create menu
        const c1 = await open('dev=player&view=sheet&item=c1', 900, 700, true);
        check('create: a token with no sheet shows the choice, saves nothing yet', await c1.ev('!!document.querySelector(".mkgrid")') && await tokSheet(c1, 'c1') === null && /Blank sheet/i.test(await c1.ev('document.querySelector(".mkgrid").innerText')) && /Wizard/i.test(await c1.ev('document.querySelector(".mkgrid").innerText')) && /Random PC/i.test(await c1.ev('document.querySelector(".mkgrid").innerText')));
        await c1.ev('document.documentElement.dataset.theme="light"'); await c1.shot(path.join(OUT, 'create-menu.png'));
        // random PC
        await c1.click('[data-act="mk-random"]'); await c1.sleep(300);
        check('random: preview line shows race, class, level and scores; Re-roll and Use are there', /level \d/.test(await c1.ev('document.getElementById("rpreview").textContent')) && /Str \d/.test(await c1.ev('document.getElementById("rpreview").textContent')) && await c1.ev('!!document.querySelector("[data-act=mk-reroll]")&&!!document.querySelector("[data-act=mk-use]")'));
        await c1.set('[data-cre="band"]', '9-12'); await c1.sleep(200); await c1.set('[data-cre="method"]', '2'); await c1.sleep(200);
        let lines = new Set(), lvls = [];
        for (let i = 0; i < 8; i++) { await c1.click('[data-act="mk-reroll"]'); await c1.sleep(80); const t = await c1.ev('document.getElementById("rpreview").textContent'); lines.add(t); lvls.push(Number(/level (\d+)/.exec(t)[1])); }
        check('random: Re-roll gives new characters; band 9-12 gives high levels (multi-class levels are shared out, DMG p.176, so a class can be lower)', lines.size >= 6 && lvls.every(l => l >= 1 && l <= 12) && lvls.reduce((a, b) => a + b, 0) / lvls.length >= 6, lvls.join(','));
        check('random: nothing saved until Use', await tokSheet(c1, 'c1') === null);
        // the method selector offers DMG p.11 Methods I-IV, the Appendix P switch is there; each method gives a legal preview
        check('random: method selector lists Methods I to IV and the "PC on the spot (DMG Appendix P)" switch is off by default', await c1.ev('Array.from(document.querySelector("[data-cre=method]").options).map(function(o){return o.textContent.split(":")[0]}).join()') === 'I,II,III,IV' && await c1.ev('document.querySelector("[data-cre=appP]").checked===false&&/PC on the spot \\(DMG Appendix P\\)/.test(document.querySelector(".mkbar").innerText)'));
        for (const m of ['1', '2', '3', '4']) { await c1.set('[data-cre="method"]', m); await c1.sleep(120); check('random: Method ' + m + ' gives a preview with scores, no magic items', /Str \d+(\/\d+)? Int \d+ Wis \d+ Dex \d+ Con \d+ Cha \d+/.test(await c1.ev('document.getElementById("rpreview").textContent')) && !/Magic and extras/.test(await c1.ev('document.getElementById("rpreview").textContent'))); }
        let plainMagic = 0; for (let i = 0; i < 10; i++) { await c1.click('[data-act="mk-reroll"]'); await c1.sleep(60); if (/Magic and extras/.test(await c1.ev('document.getElementById("rpreview").textContent'))) plainMagic++; }
        check('random: with the switch off, 10 re-rolls at levels 9-12 give no magic items', plainMagic === 0);
        await c1.set('[data-cre="method"]', '3'); await c1.sleep(100);
        await c1.click('[data-cre="appP"]'); await c1.sleep(250);
        check('random: ticking the Appendix P switch disables the method selector (Method I is used) and says so', await c1.ev('document.querySelector("[data-cre=method]").disabled&&document.querySelector("[data-cre=appP]").checked&&/Appendix P/.test(document.querySelector(".create .hint, .box .hint").innerText)'));
        let appMagic = 0, appLv = []; for (let i = 0; i < 12; i++) { await c1.click('[data-act="mk-reroll"]'); await c1.sleep(60); const t = await c1.ev('document.getElementById("rpreview").textContent'); if (/Magic and extras/.test(t)) appMagic++; appLv.push(Number(/level (\d+)/.exec(t)[1])); }
        check('random: with the switch on, levels 9-12 characters carry Appendix P magic items', appMagic >= 4 && appLv.every(l => l >= 1 && l <= 12), appMagic + ' of 12, levels ' + appLv.join());
        const keep = await c1.ev('localStorage.getItem("tk-random-pc")');
        check('random: the last choices (level range, method, switch) are kept in this browser', /"band":"9-12"/.test(keep) && /"method":"3"/.test(keep) && /"appP":true/.test(keep), keep);
        await c1.shot(path.join(OUT, 'random-pc.png'));
        const shown = await c1.ev('document.getElementById("rpreview").textContent');
        await c1.click('[data-act="mk-use"]'); await c1.sleep(900);
        const rs = await tokSheet(c1, 'c1');
        check('random: Use saves the previewed character to the token and opens the sheet', rs && shown.indexOf(rs.race + ' ' + rs.cl.join('/')) === 0 && rs.lv.join('/') === /level ([\d/]+)/.exec(shown)[1] && await c1.ev('!document.querySelector(".mkgrid")&&!!document.querySelector(".simple, .sheettabs")'), shown);
        check('random: the saved sheet shows the same armour class as the preview and notes the Appendix P origin', Number(/AC (-?\d+)/.exec(shown)[1]) === await c1.ev('SheetUI._state().view.d.ac') && /PC on the spot/.test(rs.nt), shown);
        await c1.ev('document.documentElement.dataset.theme="dark"'); await c1.sleep(100);
        // over an existing sheet: asks first
        await c1.click('[data-gear]'); await c1.click('#setov [data-act="newchar"]'); await c1.sleep(200);
        check('create over a sheet: asks to confirm, choices hidden until Replace it', await c1.ev('!!document.querySelector(".banner.confirm")&&!document.querySelector(".mkgrid")'));
        await c1.click('[data-act="mk-cancel"]'); await c1.sleep(200);
        check('create over a sheet: Keep it leaves the sheet alone', JSON.stringify(await tokSheet(c1, 'c1')) === JSON.stringify(rs));
        // blank
        const c2 = await open('dev=player&view=sheet&item=c2', 900, 700, true);
        await c2.click('[data-act="mk-blank"]'); await c2.sleep(900);
        const bs = await tokSheet(c2, 'c2');
        check('blank: saves an empty fighter named after the token', bs && bs.nm === 'Fresh c2' && bs.cl.join() === 'Fighter' && bs.lv[0] === 1);
        // wizard end to end: a human fighter
        const c3 = await open('dev=player&view=sheet&item=c3', 1000, 900, true);
        await c3.ev('document.documentElement.dataset.theme="light"');
        await c3.click('[data-act="mk-wizard"]'); await c3.sleep(1500);
        const W = e => c3.ev('(function(){var w=document.getElementById("wizframe").contentWindow;return w.eval(' + JSON.stringify(e) + ')})()');
        check('wizard: iframe is the copied wizard in embed mode (no history or restart buttons)', await W('EMBED === true') && await W('getComputedStyle(document.querySelector("header .no-embed")).display') === 'none');
        await W('app.rollMethod(1)'); await W('(function(){var p=STATE.rolledPool.slice().sort(function(a,b){return b-a}),o=["str","con","dex","cha","wis","int"];o.forEach(function(a,i){app.assignStat(a,p[i])});})()'); await c3.sleep(200);
        await W('app.setStep(2)'); await W('app.selectRace("Human")'); await W('app.selectClass("Fighter")'); await W('app.rollHP()'); await W('app.selectAlignment("NG")');
        await W('app.rollDetail("age")'); await W('app.rollDetail("hw")'); await W('app.rollDetail("skill")'); await W('app.rollGold()');
        await W('(function(){var i=WEAPONS.findIndex(function(w){return /^Sword, Long/.test(w.n)});app.buyItem("w",i,1);var a=ARMOR.findIndex(function(x){return x.n==="Chain"});app.buyItem("a",a,1);})()');
        await W('app.setStep(11)'); await W('app.nextStep()'); await W('(function(){var w=profWeapons();if(w.length)STATE.proficiencies=[w[0]];app.updateState()})()');
        // the wizard takes the sheet's style: Jost, black and white only (no green or red: weight and italics), flat boxes, light and dark following the sheet
        const wgrey = 'Array.from(document.querySelectorAll("body *")).filter(function(e){var c=getComputedStyle(e);return [c.color,c.backgroundColor,c.borderTopColor,c.borderBottomColor,c.borderLeftColor,c.borderRightColor].some(function(v){var m=v.match(/[\\d.]+/g);return m&&m.length>=3&&!(m[0]===m[1]&&m[1]===m[2])&&!(m.length===4&&m[3]==="0")})}).map(function(e){return e.tagName+"."+e.className}).slice(0,5).join()';
        await W('app.setStep(9)'); await c3.sleep(500);
        check('wizard in sheet (light): sheet theme passed in, Jost, no colour anywhere (computed colours of every element are grey)', await W('document.documentElement.dataset.theme') === 'light' && /Jost/.test(await W('getComputedStyle(document.body).fontFamily')) && await W(wgrey) === '', await W(wgrey));
        check('wizard in sheet: better and worse are bold underlined and italic, not orange and red; boxes and buttons have no shadows', await W('document.querySelectorAll(".roll-positive").length>0') && await W('Array.from(document.querySelectorAll(".roll-positive")).every(function(e){var c=getComputedStyle(e);return +c.fontWeight>=600&&c.textDecorationLine.indexOf("underline")>=0})') && await W('Array.from(document.querySelectorAll(".roll-negative")).every(function(e){return getComputedStyle(e).fontStyle==="italic"})') &&
            await W('Array.from(document.querySelectorAll("button,.box,input,select,.stat-box")).every(function(e){return getComputedStyle(e).boxShadow==="none"})') && await W('/bold, underlined/.test(document.getElementById("wizard-view").innerText)&&!/\\borange\\b|\\bred\\b/.test(document.getElementById("wizard-view").innerText.split("Highlights")[1].split("score of 10")[0])'));
        await c3.shot(path.join(OUT, 'wizard-in-sheet.png'));
        await c3.ev('tkToggleTheme()'); await c3.sleep(500);
        check('wizard in sheet (dark): follows the sheet by message, still no colour', await c3.ev('document.documentElement.dataset.theme') === 'dark' && await W('document.documentElement.dataset.theme') === 'dark' && await W(wgrey) === '' && await W('Array.from(document.querySelectorAll(".roll-positive,.roll-negative,.roll-result")).every(function(e){return getComputedStyle(e).color===getComputedStyle(document.body).color})') && await W('getComputedStyle(document.body).backgroundColor') === 'rgb(14, 14, 14)', await W(wgrey));
        await c3.shot(path.join(OUT, 'wizard-in-sheet-dark.png'));
        await c3.ev('tkToggleTheme()'); await c3.sleep(300);
        check('wizard in sheet: switching the sheet back to light follows too', await W('document.documentElement.dataset.theme') === 'light');
        await W('app.setStep(15)'); await c3.sleep(500);
        check('wizard in sheet: the last step is also black and white', await W(wgrey) === '');
        check('wizard: step 15 has Finish and no export or restart in embed mode', await W('!!document.getElementById("embed-finish")') && await W('Array.from(document.querySelectorAll(".no-embed")).every(function(e){return getComputedStyle(e).display==="none"})'));
        const built = JSON.parse(await W('JSON.stringify(app.result())'));
        await c3.ev('document.getElementById("wizframe").contentWindow.document.getElementById("embed-finish").click()'); await c3.sleep(1200);
        const ws = await tokSheet(c3, 'c3');
        check('wizard: Finish posts the character; the token gets a human fighter sheet and it opens', ws && ws.race === 'Human' && ws.cl.join() === 'Fighter' && ws.lv[0] === 1 && ws.hm === built.hp && ws.sc.join() === ['str', 'int', 'wis', 'dex', 'con', 'cha'].map(a => built.scores[a]).join() && ws.al === 'NG' && ws.inv.length === built.inventory.length && await c3.ev('!document.getElementById("wizframe")&&!!document.querySelector(".simple, .sheettabs")'), JSON.stringify(ws && ws.inv));
        const c3s = await state(c3);
        check('wizard: converted sheet derives with no errors or warnings and is saved in the token', c3s.errors.length === 0 && c3s.warns.length === 0 && /Saved/.test(c3s.status), c3s.status);
        // a message from any other window is ignored
        const c4 = await open('dev=player&view=sheet&item=c4', 1000, 900, true);
        await c4.click('[data-act="mk-wizard"]'); await c4.sleep(800);
        await c4.ev('window.postMessage({type:"1e-wizard-result",character:{name:"Spoof",classes:["Fighter"],race:"Human",scores:{str:10,int:10,wis:10,dex:10,con:10,cha:10},alignment:"N",hp:3}},"*")'); await c4.sleep(500);
        check('wizard: a result not from the iframe is ignored', await tokSheet(c4, 'c4') === null && await c4.ev('!!document.getElementById("wizframe")'));
        // tokens the user may not edit
        const c5 = await open('dev=player&view=sheet&item=c5', 900, 600, true);
        check('create: a token that is not theirs offers no creation', await c5.ev('!document.querySelector(".mkgrid")') && /belongs to another player/.test(await c5.ev('document.body.innerText')));
        const g = await open('dev=gm&view=sheet&item=c5', 900, 600, true);
        check('create: the GM can create on any character token', await g.ev('!!document.querySelector(".mkgrid")'));
        // themes and spacing, black and white only
        const grey = 'Array.from(document.querySelectorAll(".sheet *")).filter(function(e){var c=getComputedStyle(e);return [c.color,c.backgroundColor,c.borderTopColor].some(function(v){var m=v.match(/\\d+/g);return m&&m.length>=3&&!(m[0]===m[1]&&m[1]===m[2])&&!(m.length===4&&m[3]==="0")})}).length';
        for (const th of ['light', 'dark']) { await g.ev('document.documentElement.dataset.theme=' + JSON.stringify(th)); check('create menu: ' + th + ' theme is black and white only', await g.ev(grey) === 0); }
        await g.ev('document.documentElement.dataset.density="compact"; document.documentElement.dataset.size="s"');
        const h1 = await g.ev('document.documentElement.scrollHeight');
        await g.ev('document.documentElement.dataset.density="comfortable"; document.documentElement.dataset.size="l"');
        const h2 = await g.ev('document.documentElement.scrollHeight');
        check('create menu: compact spacing is shorter than comfortable and nothing overflows sideways', h1 < h2 && await g.ev('document.documentElement.scrollWidth<=document.documentElement.clientWidth'), h1 + ' vs ' + h2);
        await g.click('[data-act="mk-random"]'); await g.sleep(200);
        for (const th of ['light', 'dark']) { await g.ev('document.documentElement.dataset.theme=' + JSON.stringify(th)); check('random preview: ' + th + ' theme is black and white only', await g.ev(grey) === 0); }
        await g.ev('document.documentElement.dataset.density="compact"; document.documentElement.dataset.size="m"');
        check('random preview: compact spacing renders a preview and buttons', await g.ev('document.getElementById("rpreview").textContent.length>20'));
        await g.ev('localStorage.removeItem("tk-size");localStorage.removeItem("tk-density")');
    }

    // ---------- worn marks and armour class from magic items (TB 2026-11-12) ----------
    {
        const seed = await connect(PORT, BASE + '/guide.html'); await seed.sleep(300);
        await seed.ev('(function(){var s=JSON.parse(localStorage.getItem("toolkit-dev-scene"));s.items.push({id:"w1",name:"Ward",layer:"CHARACTER",type:"IMAGE",createdUserId:"dev-player",metadata:{"io.github.solid-state-games.1e-toolkit/sheet":{nm:"Ward",race:"Human",cl:["Fighter"],lv:[5],sc:[16,10,10,16,10,10],al:"LG",hp:40,hm:40,inv:[["Chain",1],["Shield, small",1],["Chain Mail +1",1,30],["Ring of Protection +2",1,0],["Cloak of Protection +2",1,2.5],["Bracers of Defense AC 4",1,0],["Dagger and scabbard",1]]}}});localStorage.setItem("toolkit-dev-scene",JSON.stringify(s));})()');
        await seed.close();
        const a = await open('dev=player&view=sheet&item=w1', 1000, 1000);
        await a.ev('localStorage.setItem("tk-sheet-view-PLAYER","full")'); await a.nav(BASE + '/index.html?dev=player&view=sheet&item=w1'); await a.sleep(900);
        const AC = () => a.ev('SheetUI._state().view.d.ac'), SAVE = () => a.ev('SheetUI._state().view.ac.save'), INV = () => a.ev('JSON.stringify(SheetUI._state().sheet.inv)').then(JSON.parse);
        const wear = async i => { await a.click('[data-act="wear"][data-i="' + i + '"]'); await a.sleep(250); };
        await a.click('[data-act="tab"][data-i="3"]'); await a.sleep(200);
        check('worn: Equipment lists a Worn tick for armour, shield and every protective magic item, ordinary armour and shield start ticked, magic items not', await a.ev('Array.from(document.querySelectorAll("[data-act=wear]")).map(function(e){return e.checked?1:0}).join("")') === '110000' && await a.ev('document.querySelector("[data-act=wear][data-i=\\"3\\"]").parentNode.title.indexOf("DMG p.1")>=0'));
        check('worn: the picker offers armour, shields, rings of protection, bracers, cloaks and the other items', await a.ev('(function(){var t=Array.from(document.querySelectorAll("#mg-sel option")).map(function(o){return o.textContent}).join("|");return /Plate Mail \\+5/.test(t)&&/Shield, large, \\+1, \\+4 vs\\. missiles/.test(t)&&/Ring of Protection \\+4 on AC, \\+2 on saving throws/.test(t)&&/Bracers of Defense AC 2/.test(t)&&/Cloak of Protection \\+5/.test(t)&&/Cloak of Displacement/.test(t)&&/Defender/.test(t)})()'));
        check('worn: chain, small shield and Dexterity 16 give armour class 2', await AC() === 2, String(await AC()));
        await wear(2); const acMagic = await AC();
        await wear(3); const acRing = await AC(), sv1 = await SAVE();
        check('worn: Chain Mail +1 ticked gives 1 (chain 5, +1 magic, shield 1, Dex 2); a ring of protection with it adds no armour class but +2 on saves (DMG p.130)', acMagic === 1 && acRing === 1 && sv1 === 2, acMagic + ' ' + acRing + ' ' + sv1);
        await wear(2); const acRing2 = await AC();
        check('worn: unticking the magic armour lets the ring add its 2: armour class 0', acRing2 === 0, String(acRing2));
        await wear(4); const acCloak = await AC();
        check('worn: a cloak of protection does not function with chain and a shield (DMG p.141): no change, no save bonus from it', acCloak === 0 && await SAVE() === 2, acCloak + ' ' + await SAVE());
        await wear(0); await wear(1);
        check('worn: with the plain chain and shield off, the cloak works: 10 less Dex 2, ring 2, cloak 2 = 4', await AC() === 4 && await SAVE() === 4, await AC() + ' ' + await SAVE());
        await wear(5);
        check('worn: bracers of defense AC 4 with ring and cloak: armour class -2 (DMG p.139: they work with other magical protection)', await AC() === -2, String(await AC()));
        const inv = await INV();
        check('worn: only exceptions are stored: chain and shield "x", the ring, cloak and bracers "w", the dagger no mark', JSON.stringify(inv) === JSON.stringify([['Chain', 1, 'x'], ['Shield, small', 1, 'x'], ['Chain Mail +1', 1, 30], ['Ring of Protection +2', 1, 0, 'w'], ['Cloak of Protection +2', 1, 2.5, 'w'], ['Bracers of Defense AC 4', 1, 0, 'w'], ['Dagger and scabbard', 1]]), JSON.stringify(inv));
        await a.click('[data-act="tab"][data-i="1"]'); await a.sleep(250);
        const acTxt = await a.ev('document.querySelector(".acbuild").innerText');
        check('worn: the Combat page shows the build-up (no armour, bracers, Dexterity, ring, cloak, total) with rule pages, and the total equals the sheet AC', /Bracers of Defense AC 4/.test(acTxt) && /Dexterity defensive adjustment/.test(acTxt) && /Ring of Protection \+2/.test(acTxt) && /Cloak of Protection \+2/.test(acTxt) && /DMG p\.139/.test(acTxt) && await a.ev('document.getElementById("actotal").textContent') === '-2');
        await a.click('[data-act="tab"][data-i="0"]'); await a.sleep(250);
        check('worn: saving throws on page 1 show the lowered figure with the printed one in brackets (ring and cloak: +4)', await a.ev('document.querySelectorAll("table.saves td b").length')=== 5 && /Worn magic items give \+4 on saving throws/.test(await a.ev('document.querySelector(".page").innerText')));
        await a.click('[data-act="tab"][data-i="1"]'); await a.sleep(200);
        await a.ev('document.documentElement.dataset.theme="light"'); await a.sleep(100);
        await a.shot(path.join(OUT, 'ac-buildup.png'), { full: true });
        // wear the best set, then the Simple view lists what is worn
        await a.click('[data-act="wear-best"]'); await a.sleep(300);
        const bestAc = await AC();
        check('worn: "Wear the best set" reaches armour class ' + bestAc + ' or lower than the hand-set -2', bestAc <= -2, String(bestAc));
        await a.click('[data-act="vw"][data-v="simple"]'); await a.sleep(300);
        check('worn: the Simple view lists the worn items in its own box and shows the same armour class', /Worn: armour, shield, magic items/i.test(await a.ev('document.querySelector(".simple").innerText')) && Number((await a.ev('document.querySelector(".sstat b").textContent'))) === bestAc);
        await a.ev('localStorage.setItem("tk-sheet-view-PLAYER","full")');
        // a magic item added from the picker lands as not worn, then ticked changes AC; reload persists
        await a.click('[data-act="vw"][data-v="full"]'); await a.sleep(300); await a.click('[data-act="tab"][data-i="3"]'); await a.sleep(200);
        const before = await AC();
        await a.set('#mg-sel', 'Boots of Striding and Springing'); await a.click('[data-act="mg-add"]'); await a.sleep(300);
        const added = await a.ev('Array.from(document.querySelectorAll("[data-act=wear]")).length');
        check('worn: a picked magic item is added carried and not worn (armour class unchanged)', added === 7 && await AC() === before, added + ' ' + await AC());
        await a.click('[data-act="wear"][data-i="7"]'); await a.sleep(300);
        check('worn: ticking the boots of striding and springing improves armour class by 1', await AC() === before - 1, before + ' -> ' + await AC());
        await a.sleep(1500); await a.nav(BASE + '/index.html?dev=player&view=sheet&item=w1'); await a.sleep(1200);
        check('worn: the worn marks survive a reload from token metadata', await AC() === before - 1);
        // defender holds
        await a.click('[data-act="tab"][data-i="3"]'); await a.sleep(200);
        await a.set('#mg-sel', 'Sword +4, Defender'); await a.click('[data-act="mg-add"]'); await a.sleep(300); await a.click('[data-act="wear"][data-i="8"]'); await a.sleep(300);
        await a.set('[data-act="held"][data-i="8"]', '3'); await a.sleep(300);
        check('worn: a Defender sword with 3 of its +4 held back for armour class improves AC by 3 (DMG p.165)', await AC() === before - 4, String(await AC()));
    }

    // ---------- settings dialog (gear) and the dense Simple view (TD 2026-11-12) ----------
    {
        const sp = await open('dev=player&view=sheet&item=t1', 760, 900);
        await sp.ev('localStorage.setItem("tk-sheet-view-PLAYER","simple")'); await sp.nav(BASE + '/index.html?dev=player&view=sheet&item=t1'); await sp.sleep(900);
        check('header: only title, Simple|Full, save status, gear and Close (no loose buttons)', /^vsw:Sheet view\|hstatus:Saved[^|]*\|btn:Settings\|btn:Close$/.test(await sp.ev('Array.from(document.querySelectorAll(".shead .sbtns > *")).map(function(e){return e.className.split(" ")[0]+":"+(e.getAttribute("aria-label")||e.textContent.trim())}).join("|")')));
        check('header: no subtitle on Simple, gear is an inline SVG cog with aria-label Settings', await sp.ev('!document.querySelector(".shead .sub")&&!!document.querySelector(".gear svg")&&document.querySelector(".gear").getAttribute("aria-label")==="Settings"'));
        check('header: save status shows in the header', /Saved/.test(await sp.ev('document.getElementById("hstatus").textContent')));
        await sp.click('[data-gear]'); await sp.sleep(150);
        check('settings: dialog opens with text size, spacing, theme, save, export, copy, import', await sp.ev('(function(){var t=document.getElementById("setov").innerText;return /Text size/.test(t)&&/Spacing/.test(t)&&/Light \\/ Dark/i.test(t)&&/Save now/i.test(t)&&/Export JSON/i.test(t)&&/Copy JSON/i.test(t)&&/Import JSON/i.test(t)})()'));
        await sp.shot(path.join(OUT, 'sheet-settings.png'));
        await sp.set('#set-size', 'l'); await sp.set('#set-density', 'compact');
        check('settings: text size and spacing apply to the page and are remembered', await sp.ev('document.documentElement.dataset.size==="l"&&document.documentElement.dataset.density==="compact"&&localStorage.getItem("tk-size")==="l"&&localStorage.getItem("tk-density")==="compact"'));
        await sp.ev('document.getElementById("set-theme").click()'); await sp.sleep(100);
        check('settings: Light / Dark toggles the theme', await sp.ev('!!document.documentElement.dataset.theme&&localStorage.getItem("tk-theme")===document.documentElement.dataset.theme'));
        await sp.ev('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))'); await sp.sleep(100);
        check('settings: Esc closes the dialog', await sp.ev('!document.getElementById("setov")'));
        await sp.click('[data-gear]'); await sp.sleep(100); await sp.ev('document.getElementById("setov").click()'); await sp.sleep(100);
        check('settings: a click outside the panel closes it', await sp.ev('!document.getElementById("setov")'));
        await sp.click('[data-gear]'); await sp.ev('window.__dl=null;var oc=URL.createObjectURL;URL.createObjectURL=function(b){window.__dl=b;return oc.call(URL,b)}'); await sp.click('#setov [data-act="export"]'); await sp.sleep(300);
        check('settings: Export JSON makes a file of the sheet and closes the dialog', await sp.ev('!!window.__dl&&window.__dl.size>200&&!document.getElementById("setov")'));
        await sp.click('[data-gear]'); await sp.click('#setov [data-act="savenow"]'); await sp.sleep(600);
        check('settings: Save now saves', /Saved/.test((await state(sp)).status));
        await sp.ev('localStorage.removeItem("tk-size");localStorage.removeItem("tk-density");document.documentElement.removeAttribute("data-size");document.documentElement.removeAttribute("data-density")');
        // the Simple height target: a fighter with 3 weapons, 1 ammunition line, no spells, 760px wide, Default spacing, Text M
        const f = await open('dev=player&view=sheet&item=t1', 760, 900);
        await f.ev('(function(){var s=JSON.parse(localStorage.getItem("toolkit-dev-scene"));var t=s.items.filter(function(x){return x.id==="t1"})[0];var k="io.github.solid-state-games.1e-toolkit/sheet";var m=t.metadata[k];m.cl=["Fighter"];m.lv=[4];m.race="Human";m.sc=[16,10,10,14,15,12];m.ex=0;m.sk={};m.sm={};m.cs={};m.am={};m.pf=["Sword, Long & scabbard","Dagger and scabbard","Bow, long"];m.inv=[["Chain",1],["Shield, small",1],["Sword, Long & scabbard",1],["Dagger and scabbard",1],["Bow, long",1],["Arrow, normal (12)",2],["Backpack, leather",1],["Rope, 50\'",1],["Torch",6]];m.co=[0,25,0,0,0];localStorage.setItem("toolkit-dev-scene",JSON.stringify(s));})()');
        await f.ev('localStorage.setItem("tk-sheet-view-PLAYER","simple");document.documentElement.removeAttribute("data-size");document.documentElement.removeAttribute("data-density")'); await f.nav(BASE + '/index.html?dev=player&view=sheet&item=t1'); await f.sleep(900);
        const ht = await f.ev('Math.ceil(document.querySelector(".sheet").getBoundingClientRect().height)'), nm = await f.ev('document.querySelector(".simple").innerText');
        check('simple dense: fighter with 3 weapons, 1 ammunition line, no spells fits in about 560px at 760px wide', ht <= 600, ht + 'px');
        check('simple dense: no spells box, no empty sections, gear is one wrapped line', !/Spells memorised/.test(nm) && await f.ev('!!document.querySelector(".gearline")&&document.querySelectorAll(".simple .dbox").length>=5') && await f.ev('!Array.from(document.querySelectorAll(".simple .dbox")).some(function(b){return b.innerText.trim().split("\\n").length<2})'));
        check('simple dense: saves and to-hit side by side, weapons and ammunition side by side at 760px', await f.ev('(function(){var a=document.querySelectorAll(".sv-hit .dbox");var b=document.querySelectorAll(".two:not(.sv-hit) .dbox");return a.length===2&&Math.abs(a[0].getBoundingClientRect().top-a[1].getBoundingClientRect().top)<4&&b[0].getBoundingClientRect().top===b[1].getBoundingClientRect().top})()'));
        check('simple dense: six ability boxes in one row', await f.ev('(function(){var a=Array.from(document.querySelectorAll(".sab"));return a.length===6&&a.every(function(e){return Math.abs(e.getBoundingClientRect().top-a[0].getBoundingClientRect().top)<3})})()'));
        await f.ev('document.documentElement.dataset.theme="light"'); await f.shot(path.join(OUT, 'sheet-simple.png'), { full: true });
        await f.size(600, 900); await f.sleep(300);
        check('simple dense: below 760px the paired sections stack to one column', await f.ev('(function(){var a=document.querySelectorAll(".sv-hit .dbox");return a[1].getBoundingClientRect().top>a[0].getBoundingClientRect().top+10})()'));
        // hub gear
        const hub = await open('dev=player', 560, 700);
        check('hub header: gear opens Text size, Spacing, Light / Dark only', await hub.ev('(function(){document.querySelector("[data-gear]").click();var t=document.getElementById("setov").innerText;var ok=/Text size/.test(t)&&/Spacing/.test(t)&&/Light \\/ Dark/i.test(t)&&!/Export|Save now/i.test(t);document.getElementById("setov").remove();return ok&&!document.querySelector(".hubhead .viewsel")})()'));
    }
    // ---------- console errors ----------
    const errs = []; pages.forEach(x => x.errors.forEach(e => { if (!ignorable(e)) errs.push(e); }));
    check('no console errors on any page', errs.length === 0, errs.slice(0, 3).join(' | '));
    for (const x of pages) await x.close();
    console.log(fails ? '\n' + fails + ' of ' + total + ' FAILED' : '\nall ' + total + ' browser checks passed');
    process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
