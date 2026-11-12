// cdp.js - a tiny Chrome DevTools Protocol client (no dependencies, Node 22+). Used by test/browser_run.js.
const http = require('http');
function getJson(url, method) { return new Promise((res, rej) => { const r = http.request(url, { method: method || 'GET' }, m => { let b = ''; m.on('data', d => b += d); m.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(new Error(b)); } }); }); r.on('error', rej); r.end(); }); }
async function connect(port, url) {
    const t = await getJson('http://127.0.0.1:' + port + '/json/new?' + encodeURI(url), 'PUT');
    const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pend = {}, errors = [], logs = [];
    ws.onmessage = ev => {
        const m = JSON.parse(ev.data);
        if (m.id && pend[m.id]) { m.error ? pend[m.id].rej(new Error(m.error.message)) : pend[m.id].res(m.result); delete pend[m.id]; }
        else if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text));
        else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map(a => a.value || a.description).join(' '));
        else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push('log: ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
    };
    const send = (method, params) => new Promise((res, rej) => { const i = ++id; pend[i] = { res, rej }; ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
    const api = {
        errors, send, targetId: t.id,
        async nav(u) { await send('Page.navigate', { url: u }); await api.wait(() => document.readyState === 'complete', 8000); },
        async ev(expr) { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text); return r.result.value; },
        async wait(fn, ms) { const end = Date.now() + (ms || 5000); const src = '(' + fn.toString() + ')()'; while (Date.now() < end) { try { if (await api.ev(src)) return true; } catch (e) { /* page not ready */ } await new Promise(r => setTimeout(r, 80)); } throw new Error('timeout waiting for ' + fn.toString().slice(0, 80)); },
        async shot(file, opts) { opts = opts || {}; await api.sleep(700); const r = await send('Page.captureScreenshot', Object.assign({ format: 'png', captureBeyondViewport: !!opts.full }, opts.clip ? { clip: opts.clip } : {})); require('fs').writeFileSync(file, Buffer.from(r.data, 'base64')); },
        async size(w, h) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); },
        async click(sel) { await api.ev('document.querySelector(' + JSON.stringify(sel) + ').click()'); },
        async set(sel, v) { await api.ev('(function(){var e=document.querySelector(' + JSON.stringify(sel) + ');e.value=' + JSON.stringify(v) + ';e.dispatchEvent(new Event("change",{bubbles:true}));})()'); },
        async close() { try { await getJson('http://127.0.0.1:' + port + '/json/close/' + t.id); } catch (e) { /* ignore */ } ws.close(); },
        sleep: ms => new Promise(r => setTimeout(r, ms))
    };
    return api;
}
module.exports = { connect };
