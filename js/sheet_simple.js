/*  sheet_simple.js - the Simple view of the character sheet: one page, no tabs, DOM-free (returns an HTML string) so node can test it.
 *  Editable here: hit points, spells cast today, ammunition. Everything else is read only (the Full sheet button edits it).
 *  Deliberately NOT here: thief skills (DMG p.19: the DM rolls move silently and hide in shadows secretly) and anything GM only (loyalty).
 *  Figures all come from view = SheetRules.compute(sheet); pages cited as in the Full view.
 */
(function (root) {
'use strict';
const SR = root.SheetRules, R = root.Rules;
const esc = s => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sg = n => n > 0 ? '+' + n : String(n);
const MORE = 14; // carried-gear names shown before "and N more"

function box(title, body, cls) { return '<section class="box ' + (cls || '') + '"><h3>' + title + '</h3>' + body + '</section>'; }
function stat(l, v, t) { return '<div class="sstat"' + (t ? ' title="' + esc(t) + '"' : '') + '><span>' + l + '</span><b>' + v + '</b></div>'; }

// worn armour and shield, other carried gear (carried only, names x qty), coins carried
function carried(sheet) {
    const worn = [], gear = [], ammo = {};
    SR.ammoLines(sheet).forEach(a => { ammo[a.name] = 1; });
    sheet.inv.forEach(e => {
        if (SR.locOf(e)) return;
        const r = SR.hydrateRow(e), nm = r.n + (r.qty > 1 ? ' x' + r.qty : '');
        if (ammo[r.n]) return;
        if (r.shield || (r.ac !== undefined && r.ac !== null)) worn.push(nm); else gear.push(nm);
    });
    return { worn, gear };
}

function html(view, canWrite) {
    const s = view.sheet, d = view.d, A = d.abilities, dis = canWrite ? '' : ' disabled';
    let h = '<div class="simple">';
    // who
    const lv = s.cl.map((c, i) => c + ' ' + s.lv[i]).join(' / ');
    h += '<section class="sident"><div class="sname"><h2>' + esc(s.nm || '(unnamed)') + '</h2><span>' + esc(s.race + (s.sub ? ' (' + s.sub + ')' : '')) + ', ' + esc(lv) + ', ' + esc(R.ALIGN_NAMES[s.al] || s.al) + '</span></div>' +
        '<div class="sstats">' + stat('Armour class', d.ac, 'From armour worn and Dexterity (PHB p.36, 12)') +
        stat('Hit points now', '<input class="v tiny" data-f="hp" data-t="n" type="number" value="' + esc(s.hp) + '"' + dis + '>') +
        stat('Hit points full', '<input class="v tiny" data-f="hm" data-t="n" type="number" min="0" value="' + esc(s.hm) + '"' + dis + '>') +
        stat('Movement', d.movement.move + '"', 'Movement from encumbrance and armour (PHB p.101)') + '</div></section>';
    // abilities
    const ab = (n, sc, extra) => '<div class="sab"><span>' + n + '</span><b>' + sc + '</b>' + (extra ? '<i>' + extra + '</i>' : '') + '</div>';
    const exc = A.str.score >= 18 && s.ex && R.isFighterType(s.cl) ? '/' + (s.ex === 100 ? '00' : String(s.ex).padStart(2, '0')) : '';
    const conAdj = sg(A.con.hp) + (A.con.hpOther !== A.con.hpFighter ? ' (' + sg(A.con.hpOther) + ' non-fighters)' : '');
    h += box('Abilities', '<div class="sabs">' + ab('Str', A.str.score + exc, 'hit ' + sg(A.str.hit) + ', dmg ' + sg(A.str.dmg)) + ab('Int', A.int.score) + ab('Wis', A.wis.score) +
        ab('Dex', A.dex.score, 'reaction ' + sg(A.dex.reaction) + ', defence ' + sg(A.dex.defense)) + ab('Con', A.con.score, 'hp ' + conAdj) + ab('Cha', A.cha.score) + '</div>');
    // saves
    const sv = d.saves, names = [['death', 'Para / poison / death'], ['petrification', 'Petrify / polymorph'], ['wand', 'Rod, staff, wand'], ['breath', 'Breath'], ['spell', 'Spell']];
    h += box('Saving throws', '<table class="grid saves"><tr>' + names.map(n => '<th>' + n[1] + '</th>').join('') + '</tr><tr>' + names.map(n => '<td>' + sv[n[0]] + '</td>').join('') + '</tr></table>');
    // to hit
    const acs = []; for (let a = 10; a >= -10; a--) acs.push(a);
    h += box('To hit by armour class', '<div class="scroll"><table class="grid tohit simplehit"><tr><th>AC</th>' + acs.map(a => '<th>' + a + '</th>').join('') + '</tr>' +
        '<tr><th>Melee</th>' + acs.map(a => '<td>' + view.toHitRows.melee[a] + '</td>').join('') + '</tr><tr><th>Missile</th>' + acs.map(a => '<td>' + view.toHitRows.missile[a] + '</td>').join('') + '</tr></table></div>');
    // weapons
    let w = '<p class="muted">No weapons chosen. Add weapons of proficiency on the Full sheet.</p>';
    if (view.weapons.length) w = '<div class="scroll"><table class="grid"><tr><th>Weapon</th><th>To hit adj</th><th>Damage S-M</th><th>Damage L</th><th>Speed</th></tr>' + view.weapons.map(x =>
        '<tr><td>' + esc(x.name) + (x.kind === 'missile' ? ' (missile)' : '') + '</td><td>' + sg(x.hitMod) + '</td><td>' + esc(x.sm || '-') + (x.dmgMod ? ' ' + sg(x.dmgMod) : '') + '</td><td>' + esc(x.lg || '-') + (x.dmgMod ? ' ' + sg(x.dmgMod) : '') + '</td><td>' + esc(x.spd === undefined || x.spd === '' || x.spd === null ? '-' : x.spd) + '</td></tr>').join('') + '</table></div>';
    h += box('Weapons', w);
    // ammunition
    const am = SR.ammoLines(s);
    if (am.length) h += box('Ammunition', '<ul class="ammo">' + am.map((a, i) => '<li><span class="an">' + esc(a.name) + '</span>' +
        '<button type="button" class="btn ghost small" data-act="ammo" data-i="' + i + '" data-d="-1" title="Fire one"' + (canWrite && a.left > 0 ? '' : ' disabled') + '>-</button>' +
        '<b class="acount" data-ammo="' + esc(a.name) + '">' + a.left + '</b>' +
        '<button type="button" class="btn ghost small" data-act="ammo" data-i="' + i + '" data-d="1" title="Pick one up (up to what you carry)"' + (canWrite && a.spent > 0 ? '' : ' disabled') + '>+</button>' +
        '<span class="muted small">of ' + a.total + ' carried</span></li>').join('') + '</ul>');
    // spells memorised
    if (view.spellClasses.length) {
        let sp = '', any = false;
        view.spellClasses.forEach(c => {
            const mem = s.sm[c] || [], slots = d.spellsPerDay[c] || []; let rows = '';
            mem.forEach((list, l) => {
                if (!list.length) return; any = true;
                const cast = list.filter((n, i) => SR.isCast(s, c, l, i)).length;
                rows += '<div class="sprow"><span class="splv">Level ' + (l + 1) + '<i>' + (list.length - cast) + ' of ' + list.length + ' left' + (slots[l] ? ' (' + slots[l] + ' per day)' : '') + '</i></span><ul class="spchips">' + list.map((n, i) => {
                    const on = SR.isCast(s, c, l, i), ok = canWrite && i < SR.CAST_BITS;
                    return '<li><button type="button" class="spchip' + (on ? ' cast' : '') + '" data-act="cast" data-c="' + esc(c) + '" data-l="' + l + '" data-i="' + i + '" aria-pressed="' + on + '"' + (ok ? '' : ' disabled') + ' title="' + (on ? 'Cast: tap to untick' : 'Tap when cast') + '">' + esc(n) + (on ? ' (cast)' : '') + '</button></li>';
                }).join('') + '</ul></div>';
            });
            if (rows) sp += '<h4>' + esc(c) + '</h4>' + rows;
        });
        h += box('Spells memorised today', (any ? sp : '<p class="muted">Nothing memorised. Memorise spells on the Full sheet (Spells page).</p>') +
            '<div class="addrow">' + (canWrite && any ? '<button type="button" class="btn ghost small" data-act="rest">Rest: reset</button> ' : '') + '<span class="muted small">Rest puts every spell back (all ticks cleared).</span></div>');
    }
    // coins, armour, gear
    const cg = carried(s), co = s.co, cn = ['pp', 'gp', 'ep', 'sp', 'cp'];
    h += '<div class="two">' + box('Coins carried', '<div class="scoins">' + cn.map((n, i) => '<div><span>' + n + '</span><b>' + co[i] + '</b></div>').join('') + '</div>') +
        box('Armour and shield worn', cg.worn.length ? '<ul class="chips">' + cg.worn.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>' : '<p class="muted">None worn.</p>') + '</div>';
    h += box('Gear carried', cg.gear.length ? '<ul class="chips">' + cg.gear.slice(0, MORE).map(n => '<li>' + esc(n) + '</li>').join('') + (cg.gear.length > MORE ? '<li class="muted">and ' + (cg.gear.length - MORE) + ' more (Full sheet)</li>' : '') + '</ul>' : '<p class="muted">Nothing else carried.</p>');
    h += '<p class="hint">' + (canWrite ? 'You can change hit points, spells cast and ammunition here. ' : 'Read only. ') + '<button type="button" class="btn small" data-act="vw" data-v="full">Full sheet</button> to edit anything else.</p>';
    return h + '</div>';
}
root.SheetSimple = { html, carried };
})(typeof globalThis !== 'undefined' ? globalThis : this);
