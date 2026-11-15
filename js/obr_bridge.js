// obr_bridge.js - picks the real Owlbear SDK or the dev mock, then starts the app (js/app.js defines window.startToolkit).
const q = new URLSearchParams(location.search), dev = q.get('dev');
let OBR;
if (dev === 'gm' || dev === 'player') OBR = (await import('./dev_mock.js')).default(dev);
else OBR = (await import('../vendor/obr-sdk.js')).default;
window.OBRX = OBR;
window.TOOLKIT_DEV = dev === 'gm' || dev === 'player' ? dev : null;
window.startToolkit();
// dev: stands in for background.js (GM page only; the sheet modal does not need it). A stub builder makes plain items.
if (window.TOOLKIT_DEV === 'gm' && q.get('view') !== 'sheet') {
    const NS = 'io.github.solid-state-games.1e-toolkit', stub = () => { const it = { type: 'LABEL' }; const p = new Proxy({}, { get: (_, k) => k === 'build' ? () => it : v => { it[k] = v; return p; } }); return p; };
    (await import('./combat_menus.js')).installCombatMenus(OBR, NS, p => new URL(p, location.href).href);
    (await import('./combat_hp.js')).installCombatHp(OBR, NS, stub);
}
