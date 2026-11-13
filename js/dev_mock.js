// dev_mock.js - a small stand-in for the OBR calls the toolkit uses, so the sheet and GM tabs run in a normal browser.
// Used only when the page is opened with ?dev=gm or ?dev=player. Scene items live in localStorage (key below), shared by every dev tab.
// It copies the parts of the real behaviour the toolkit relies on: role, item update permissions (a player may only write items they
// created, unless the dev room grants CHARACTER_UPDATE), the 16 kB metadata cap, items.onChange, modal open and close.
const STORE = 'toolkit-dev-scene';
const PLAYERS = [{ id: 'dev-gm', name: 'Dev GM', role: 'GM', color: '#a33' }, { id: 'dev-player', name: 'Dev Player', role: 'PLAYER', color: '#36a' }, { id: 'dev-player2', name: 'Other Player', role: 'PLAYER', color: '#693' }];
const seed = () => ({ grant: false, meta: {}, pm: {}, items: [
    { id: 't1', name: 'Aldric (your token)', layer: 'CHARACTER', type: 'IMAGE', createdUserId: 'dev-player', position: { x: 100, y: 100 }, metadata: {} },
    { id: 't2', name: 'Brenna (other player)', layer: 'CHARACTER', type: 'IMAGE', createdUserId: 'dev-player2', position: { x: 300, y: 100 }, metadata: {} },
    { id: 't3', name: 'Goblin NPC (GM token)', layer: 'CHARACTER', type: 'IMAGE', createdUserId: 'dev-gm', position: { x: 500, y: 100 }, metadata: {} },
    { id: 't4', name: 'Map', layer: 'MAP', type: 'IMAGE', createdUserId: 'dev-gm', metadata: {} }] });
const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || seed(); } catch (e) { return seed(); } };
const save = s => localStorage.setItem(STORE, JSON.stringify(s));
const bytes = o => new Blob([JSON.stringify(o)]).size;

export default function makeMock(role) {
    const me = role === 'gm' ? PLAYERS[0] : PLAYERS[1];
    const listeners = new Set();
    const localItems = []; let lid = 0;
    // dev map: a small overlay of the tokens and the local (per client) items, so a screenshot shows the dots
    const drawMap = () => {
        let m = document.getElementById('dev-map'); if (m) m.remove();
        if (!localItems.length) return;
        m = document.createElement('div'); m.id = 'dev-map'; m.style.cssText = 'position:fixed;left:8px;bottom:8px;width:340px;height:140px;background:#ddd;border:1px solid #000;z-index:9990;overflow:hidden';
        load().items.filter(i => i.position && i.layer === 'CHARACTER').forEach(i => { const t = document.createElement('div'); t.style.cssText = 'position:absolute;left:' + (i.position.x / 2 - 25 + 20) + 'px;top:' + (i.position.y / 2 - 25 + 30) + 'px;width:50px;height:50px;background:#777;border:1px solid #333;font:9px sans-serif;color:#fff'; t.textContent = i.name.split(' ')[0]; m.appendChild(t); });
        localItems.forEach(i => { const d = document.createElement('div'), w = (i.width || 10) / 2, h = (i.height || i.width || 10) / 2; d.className = 'dev-dot'; d.dataset.state = (i.metadata[Object.keys(i.metadata)[0]] || {}).s;
            d.style.cssText = 'position:absolute;box-sizing:border-box;left:' + (i.position.x / 2 + 20 - w / 2) + 'px;top:' + (i.position.y / 2 + 30 - h / 2) + 'px;width:' + w + 'px;height:' + h + 'px;background:' + i.fillColor + ';border:' + Math.max(1, (i.strokeWidth || 1) / 2) + 'px solid ' + i.strokeColor + ';border-radius:' + (i.shapeType === 'CIRCLE' ? '50%' : '0') + ';transform:rotate(' + (i.rotation || 0) + 'deg)'; m.appendChild(d); });
        document.body.appendChild(m);
    };
    const ctxMenus = {}, tools = {}, modes = {}, metaListeners = new Set(), partyL = new Set(), playerL = new Set(), pops = {};
    const fireMeta = () => { const m = clone(load().meta || {}); metaListeners.forEach(f => f(m)); };
    const others = () => PLAYERS.filter(p => p.id !== me.id).map(p => Object.assign(clone(p), { metadata: clone((load().pm || {})[p.id] || {}) }));
    const fire = () => { const items = load().items; listeners.forEach(f => f(items)); fireMeta(); partyL.forEach(f => f(others())); playerL.forEach(f => f(Object.assign(clone(me), { metadata: clone((load().pm || {})[me.id] || {}) }))); };
    window.addEventListener('storage', e => { if (e.key === STORE) fire(); });
    if (!localStorage.getItem(STORE)) save(seed());
    const clone = o => JSON.parse(JSON.stringify(o));
    const canWrite = it => me.role === 'GM' || it.createdUserId === me.id || load().grant;
    const toast = (msg, kind) => {
        const d = document.createElement('div'); d.className = 'dev-toast ' + (kind || ''); d.textContent = msg;
        document.body.appendChild(d); setTimeout(() => d.remove(), 3500);
    };
    return {
        isAvailable: true, isReady: true,
        onReady: cb => setTimeout(cb, 0),
        player: {
            id: me.id,
            getId: async () => me.id, getRole: async () => me.role, getName: async () => me.name, getColor: async () => me.color,
            hasPermission: async p => me.role === 'GM' || (p === 'CHARACTER_UPDATE' && !!load().grant),
            getSelection: async () => [], getMetadata: async () => clone((load().pm || {})[me.id] || {}), setMetadata: async patch => { const st = load(); st.pm = st.pm || {}; st.pm[me.id] = Object.assign(st.pm[me.id] || {}, clone(patch)); save(st); fire(); }, onChange: cb => { playerL.add(cb); return () => playerL.delete(cb); }
        },
        party: { getPlayers: async () => others(), onChange: cb => { partyL.add(cb); return () => partyL.delete(cb); } },
        scene: {
            isReady: async () => true, onReadyChange: () => () => {},
            local: {
                getItems: async f => clone(localItems.filter(f || (() => true))),
                addItems: async its => { its.forEach(i => { i.id = 'l' + (++lid); localItems.push(clone(i)); }); drawMap(); },
                deleteItems: async ids => { for (let k = localItems.length - 1; k >= 0; k--) if (ids.indexOf(localItems[k].id) >= 0) localItems.splice(k, 1); drawMap(); }
            },
            getMetadata: async () => clone(load().meta || {}),
            // like OBR: a patch; a key set to undefined is removed. Only the GM may write.
            setMetadata: async patch => {
                if (me.role !== 'GM') throw new Error('Permission denied: only the GM can change scene metadata');
                const st = load(), meta = st.meta || {};
                Object.keys(patch).forEach(k => { if (patch[k] === undefined) delete meta[k]; else meta[k] = clone(patch[k]); });
                if (bytes(meta) > 16000) throw new Error('Metadata too large (16 kB limit)');
                st.meta = meta; save(st); fire();
            },
            onMetadataChange: cb => { metaListeners.add(cb); return () => metaListeners.delete(cb); },
            items: {
                getItemBounds: async ids => { const its = load().items; return ids.map(id => { const it = its.filter(x => x.id === id)[0], p = (it && it.position) || { x: 0, y: 0 }; return { min: { x: p.x - 50, y: p.y - 50 }, max: { x: p.x + 50, y: p.y + 50 } }; }); },
                getItems: async f => { const items = clone(load().items); if (Array.isArray(f)) return items.filter(i => f.indexOf(i.id) >= 0); return typeof f === 'function' ? items.filter(f) : items; },
                updateItems: async (f, fn) => {
                    const st = load(), targets = st.items.filter(i => Array.isArray(f) ? (typeof f[0] === 'string' ? f.indexOf(i.id) >= 0 : f.some(x => x.id === i.id)) : f(i));
                    const drafts = clone(targets);
                    fn(drafts);
                    drafts.forEach((d, n) => {
                        if (!canWrite(targets[n])) throw new Error('Permission denied: you cannot update this item');
                        if (me.role !== 'GM' && d.createdUserId !== targets[n].createdUserId) throw new Error('Permission denied: only the GM can change the owner');
                        if (bytes(d.metadata) > 16000) throw new Error('Metadata too large (16 kB limit)');
                        Object.assign(targets[n], d);
                    });
                    save(st); fire();
                },
                onChange: cb => { listeners.add(cb); return () => listeners.delete(cb); }
            }
        },
        notification: { show: async (m, k) => { toast(m, k); return 'n'; } },
        modal: {
            open: async m => {
                let box = document.getElementById('dev-modal');
                if (box) box.remove();
                box = document.createElement('div'); box.id = 'dev-modal';
                box.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center';
                const f = document.createElement('iframe'); f.src = m.url;
                f.style.cssText = 'border:0;background:#fff;width:min(' + (m.width || 900) + 'px,96vw);height:min(' + (m.height || 800) + 'px,94vh)';
                box.appendChild(f); document.body.appendChild(box);
            },
            close: async () => { const t = window.top.document.getElementById('dev-modal'); if (t) t.remove(); }
        },
        popover: {
            // a small fixed iframe, so a screenshot shows the banner; one per id
            open: async o => {
                if (pops[o.id]) pops[o.id].remove();
                const f = document.createElement('iframe'); f.src = o.url; f.id = 'dev-pop'; f.style.cssText = 'position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:9998;border:1px solid #888;background:#fff;width:' + (o.width || 300) + 'px;height:' + (o.height || 100) + 'px';
                document.body.appendChild(f); pops[o.id] = f;
            },
            close: async id => { if (pops[id]) { pops[id].remove(); delete pops[id]; } },
            getWidth: async () => 300, getHeight: async () => 100
        },
        contextMenu: { create: async m => { ctxMenus[m.id] = m; }, remove: async id => { delete ctxMenus[id]; } },
        tool: { create: async t => { tools[t.id] = t; }, createMode: async m => { modes[m.id] = m; }, activateMode: async (t, m) => { window.__activeMode = m; }, activateTool: async () => {} },
        viewport: { getHeight: async () => window.__vh || 900, getWidth: async () => 1200 },
        action: { setHeight: async h => { window.__actionHeight = h; }, getHeight: async () => window.__actionHeight || 760, setWidth: async () => {}, open: async () => {}, close: async () => {} },
        room: { getPermissions: async () => (load().grant ? ['CHARACTER_UPDATE'] : []), onPermissionsChange: () => () => {} },
        // dev only helpers used by the dev bar
        _dev: { toggleGrant() { const s = load(); s.grant = !s.grant; save(s); fire(); return s.grant; }, grant: () => !!load().grant,
            reset() { save(seed()); fire(); },
            // dev stand-ins for right-click and the tool: list the context items for the chosen tokens, run one, and drag with the Attack mode
            ctxLabels: () => Object.keys(ctxMenus).map(id => ({ id, label: ctxMenus[id].icons[0].label })),
            ctxClick: async (id, ids) => { const items = load().items.filter(i => ids.indexOf(i.id) >= 0); await ctxMenus[id].onClick({ items }); },
            drag: async (fromId, toId) => { const m = modes[Object.keys(modes)[0]], pos = id => load().items.filter(i => i.id === id)[0].position; await m.onToolDragStart({}, { pointerPosition: pos(fromId) }); await m.onToolDragEnd({}, { pointerPosition: pos(toId) }); },
            click: async id => { const m = modes[Object.keys(modes)[0]]; await m.onToolClick({}, { pointerPosition: load().items.filter(i => i.id === id)[0].position }); }, setTray(pid, values) { const s = load(); s.pm = s.pm || {}; s.pm[pid] = Object.assign(s.pm[pid] || {}, { 'rodeo.owlbear.dice/rollValues': values, 'rodeo.owlbear.dice/roll': { n: Math.random() } }); save(s); fire(); }, addToken(name) { const s = load(); s.items.push({ id: 't' + Date.now(), name, layer: 'CHARACTER', type: 'IMAGE', createdUserId: me.id, metadata: {} }); save(s); fire(); } }
    };
}
