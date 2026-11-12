// dev_mock.js - a small stand-in for the OBR calls the toolkit uses, so the sheet and GM tabs run in a normal browser.
// Used only when the page is opened with ?dev=gm or ?dev=player. Scene items live in localStorage (key below), shared by every dev tab.
// It copies the parts of the real behaviour the toolkit relies on: role, item update permissions (a player may only write items they
// created, unless the dev room grants CHARACTER_UPDATE), the 16 kB metadata cap, items.onChange, modal open and close.
const STORE = 'toolkit-dev-scene';
const PLAYERS = [{ id: 'dev-gm', name: 'Dev GM', role: 'GM', color: '#a33' }, { id: 'dev-player', name: 'Dev Player', role: 'PLAYER', color: '#36a' }, { id: 'dev-player2', name: 'Other Player', role: 'PLAYER', color: '#693' }];
const seed = () => ({ grant: false, items: [
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
    const fire = () => { const items = load().items; listeners.forEach(f => f(items)); };
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
            getSelection: async () => [], getMetadata: async () => ({}), setMetadata: async () => {}, onChange: () => () => {}
        },
        party: { getPlayers: async () => PLAYERS.filter(p => p.id !== me.id).map(clone), onChange: () => () => {} },
        scene: {
            isReady: async () => true, onReadyChange: () => () => {},
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
        popover: { open: async () => {}, close: async () => {} },
        contextMenu: { create: async () => {}, remove: async () => {} },
        action: { setHeight: async () => {}, setWidth: async () => {}, open: async () => {}, close: async () => {} },
        room: { getPermissions: async () => (load().grant ? ['CHARACTER_UPDATE'] : []), onPermissionsChange: () => () => {} },
        // dev only helpers used by the dev bar
        _dev: { toggleGrant() { const s = load(); s.grant = !s.grant; save(s); fire(); return s.grant; }, grant: () => !!load().grant,
            reset() { save(seed()); fire(); }, addToken(name) { const s = load(); s.items.push({ id: 't' + Date.now(), name, layer: 'CHARACTER', type: 'IMAGE', createdUserId: me.id, metadata: {} }); save(s); fire(); } }
    };
}
