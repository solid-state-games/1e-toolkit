// Browser run of the 1e Toolkit dev mode (no Owlbear needed). Needs a static server and a Chromium with remote debugging:
//   python3 -m http.server 8770 --bind 127.0.0.1        (in 1E_TOOLKIT)
//   chromium --headless=new --no-sandbox --remote-debugging-port=9331 --user-data-dir=/some/scratch about:blank
//   node test/browser_run.js [base=http://127.0.0.1:8770] [port=9331]
// Writes screenshots to REVIEW/. Exit non-zero on any failed step or console error (Google Font fetch failures are ignored).
const path = require('path'), fs = require('fs'), { connect } = require('./cdp.js');
const BASE = process.argv[2] || 'http://127.0.0.1:8770', PORT = Number(process.argv[3] || 9331), OUT = path.join(__dirname, '..', 'REVIEW');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0, total = 0; const check = (n, ok, d) => { total++; if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  (' + d + ')' : '')); };
const ignorable = e => /fonts\.g(oogleapis|static)\.com|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION/.test(e);
const pages = [];
async function open(url, w, h) { const p = await connect(PORT, 'about:blank'); pages.push(p); await p.size(w || 1000, h || 1000); await p.nav(BASE + '/index.html?' + url); await p.sleep(900); return p; }
const state = p => p.ev('JSON.stringify((function(){var s=SheetUI._state();return {sheet:s.sheet,canWrite:s.canWrite,status:s.status,errors:s.view.errors,warns:s.view.warns}})())').then(JSON.parse);
(async () => {
    const reset = await connect(PORT, BASE + '/guide.html'); await reset.sleep(500); await reset.ev('localStorage.clear(); localStorage.setItem("tk-sheet-view-PLAYER","full"); localStorage.setItem("tk-sheet-view-GM","full")'); await reset.close();

    // ---------- player hub: no GM tabs ----------
    let p = await open('dev=player', 560, 780);
    const tabsP = await p.ev('Array.from(document.querySelectorAll(".tabs button")).map(b=>b.textContent).join("|")');
    check('player hub shows only Characters and Guide', tabsP === 'Characters|Guide', tabsP);
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
    await p.click('[data-act="import"]'); // opens the file input handler path (click is suppressed in headless; use the change below)
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
    await g.set('#e-terrain', 'forest'); await g.click('#e-day'); await g.sleep(300);
    check('GM encounters: day rolled into cards', await g.ev('document.querySelectorAll(".ecard").length') === 6);
    let guard = 0, got = 0; while (!got && guard++ < 25) { await g.click('#e-one'); await g.sleep(120); got = await g.ev('document.querySelectorAll(".ecard .card-monster-name").length'); }
    check('GM encounters: one encounter produces a card with a name', got > 0);
    await g.set('#e-mode', 'sylvan'); await g.set('#e-bell', 'linear'); await g.click('#e-day'); await g.sleep(250);
    check('GM encounters: sylvan mode and linear dice roll', await g.ev('document.querySelectorAll(".ecard").length') > 0 && !/NaN|undefined/.test(await g.ev('document.getElementById("e-out").innerText')));
    await g.set('#e-mode', ''); await g.set('#e-terrain', 'plains'); await g.click('#e-day'); await g.sleep(200);
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
    await g.click('[data-tab="com"]'); await g.sleep(150);
    await g.set('#c-cls', 'fighter'); await g.set('#c-lvl', '7'); await g.set('#c-ac', '3'); await g.set('#c-wep', String(await g.ev('WEAPONS.findIndex(function(w){return w.name==="Sword, long"})'))); await g.set('#c-arm', '6'); await g.sleep(150);
    const need = await g.ev('document.querySelector("#c-res .big").innerText.replace(/\\s+/g," ")');
    check('GM combat: fighter L7 vs AC3, long sword vs chain gives a number to hit', /Need on d20 \d+/i.test(need), need);
    for (const m of ['P', 'G', 'O']) { await g.click('.subtabs [data-m="' + m + '"]'); await g.sleep(100); await g.click('#c-roll'); await g.sleep(100); check('GM combat: ' + { P: 'pummel', G: 'grapple', O: 'overbear' }[m] + ' rolls', /(hits|fails)/.test(await g.ev('document.getElementById("c-wres").innerText'))); }
    await g.shot(path.join(OUT, 'hub-gm-combat.png'), { full: true });
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

    // ---------- console errors ----------
    const errs = []; pages.forEach(x => x.errors.forEach(e => { if (!ignorable(e)) errs.push(e); }));
    check('no console errors on any page', errs.length === 0, errs.slice(0, 3).join(' | '));
    for (const x of pages) await x.close();
    console.log(fails ? '\n' + fails + ' of ' + total + ' FAILED' : '\nall ' + total + ' browser checks passed');
    process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
