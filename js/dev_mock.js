// dev_mock.js - a small stand-in for the OBR calls the toolkit uses, so the sheet and GM tabs run in a normal browser.
// Used only when the page is opened with ?dev=gm or ?dev=player. Scene items live in localStorage (key below), shared by every dev tab.
// It copies the parts of the real behaviour the toolkit relies on: role, item update permissions (a player may only write items they
// created, unless the dev room grants CHARACTER_UPDATE), the 16 kB metadata cap, items.onChange, modal open and close.
const STORE = 'toolkit-dev-scene';
const PLAYERS = [{ id: 'dev-gm', name: 'Dev GM', role: 'GM', color: '#a33' }, { id: 'dev-player', name: 'Dev Player', role: 'PLAYER', color: '#36a' }, { id: 'dev-player2', name: 'Other Player', role: 'PLAYER', color: '#693' }];
const seed = () => ({ grant: false, meta: {}, pm: {}, items: [
    { id: 't1', name: 'Aldric (your token)', layer: 'CHARACTER', type: 'IMAGE', createdUserId: 'dev-player', metadata: {} },
    { id: 't2', name: 'Brenna (other player)', layer: 'CHARACTER', type: 'IMAGE', createdUserId: 'dev-player2', metadata: {} },
    { id: 't3', name: 'Goblin NPC (GM token)', layer: 'CHARACTER', type: 'IMAGE', createdUserId: 'dev-gm', metadata: {} },
    { id: 't4', name: 'Map', layer: 'MAP', type: 'IMAGE', createdUserId: 'dev-gm', metadata: {} }] });
const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || seed(); } catch (e) { return seed(); } };
const save = s => localStorage.setItem(STORE, JSON.stringify(s));
const bytes = o => new Blob([JSON.stringify(o)]).size;

export default function makeMock(role) {
    const me = role === 'gm' ? PLAYERS[0] : PLAYERS[1];
    const listeners = new Set();
    const metaListeners = new Set(), partyL = new Set(), playerL = new Set(), pops = {};
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
            getSelection: async () => [], getMetadata: async () => clone((load().pm || {})[me.id] || {}), setMetadata: async () => {}, onChange: cb => { playerL.add(cb); return () => playerL.delete(cb); }
        },
        party: { getPlayers: async () => others(), onChange: cb => { partyL.add(cb); return () => partyL.delete(cb); } },
        scene: {
            isReady: async () => true, onReadyChange: () => () => {},
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
        contextMenu: { create: async () => {}, remove: async () => {} },
        viewport: { getHeight: async () => window.__vh || 900, getWidth: async () => 1200 },
        action: { setHeight: async h => { window.__actionHeight = h; }, getHeight: async () => window.__actionHeight || 760, setWidth: async () => {}, open: async () => {}, close: async () => {} },
        room: { getPermissions: async () => (load().grant ? ['CHARACTER_UPDATE'] : []), onPermissionsChange: () => () => {} },
        // dev only helpers used by the dev bar
        _dev: { toggleGrant() { const s = load(); s.grant = !s.grant; save(s); fire(); return s.grant; }, grant: () => !!load().grant,
            reset() { save(seed()); fire(); }, setTray(pid, values) { const s = load(); s.pm = s.pm || {}; s.pm[pid] = { 'rodeo.owlbear.dice/rollValues': values, 'rodeo.owlbear.dice/roll': { n: Math.random() } }; save(s); fire(); }, addToken(name) { const s = load(); s.items.push({ id: 't' + Date.now(), name, layer: 'CHARACTER', type: 'IMAGE', createdUserId: me.id, metadata: {} }); save(s); fire(); } }
    };
}
