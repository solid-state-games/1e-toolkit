// obr_bridge.js - picks the real Owlbear SDK or the dev mock, then starts the app (js/app.js defines window.startToolkit).
const q = new URLSearchParams(location.search), dev = q.get('dev');
let OBR;
if (dev === 'gm' || dev === 'player') OBR = (await import('./dev_mock.js')).default(dev);
else OBR = (await import('../vendor/obr-sdk.js')).default;
window.OBRX = OBR;
window.TOOLKIT_DEV = dev === 'gm' || dev === 'player' ? dev : null;
window.startToolkit();
if (window.TOOLKIT_DEV && new URLSearchParams(location.search).get('view') !== 'banner' && new URLSearchParams(location.search).get('view') !== 'sheet') (await import('./banner_sync.js')).watchBanner(OBR, 'io.github.solid-state-games.1e-toolkit', new URL('index.html?view=banner&dev=' + dev, location.href).href); // dev: stands in for background.js
if (window.TOOLKIT_DEV && !['banner', 'sheet'].includes(new URLSearchParams(location.search).get('view'))) (await import('./combat_menus.js')).installCombatMenus(OBR, 'io.github.solid-state-games.1e-toolkit', p => new URL(p, location.href).href); // dev: stands in for background.js
