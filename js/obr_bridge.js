// obr_bridge.js - picks the real Owlbear SDK or the dev mock, then starts the app (js/app.js defines window.startToolkit).
const q = new URLSearchParams(location.search), dev = q.get('dev');
let OBR;
if (dev === 'gm' || dev === 'player') OBR = (await import('./dev_mock.js')).default(dev);
else OBR = (await import('../vendor/obr-sdk.js')).default;
window.OBRX = OBR;
window.TOOLKIT_DEV = dev === 'gm' || dev === 'player' ? dev : null;
window.startToolkit();
