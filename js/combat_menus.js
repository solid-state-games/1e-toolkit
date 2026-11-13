// combat_menus.js - the right-click side menu and the Attack tool. Run on every client by background.js (real Owlbear) and obr_bridge.js (dev mock).
// Side menu: GM only, tokens on the Character layer, works on a multi-selection. The SDK has no sub-menus, so one item per choice.
// Attack tool: drag from the attacker to the target, or "Attack..." on a token then click the target. The request goes into the player's own metadata
// (key .../atk); the GM's open panel picks it up (js/combat_ui.js). Needs CombatState, CombatAttack (classic scripts) in the page.
// OBR calls used: contextMenu.create/remove, tool.create, tool.createMode, tool.activateMode, scene.getMetadata/setMetadata/onMetadataChange, scene.items.getItems/getItemBounds,
// player.getId/getRole/setMetadata, notification.show.
export async function installCombatMenus(OBR, NS, url) {
    const CS = CombatState, CA = CombatAttack, here = p => url(p);
    const TOOL = NS + "/attack", MODE = NS + "/attack-mode";
    let sideNames = ["Party", "Foes"], pendingAttacker = null, seq = Date.now() % 100000;
    const gm = [{ key: "layer", value: "CHARACTER" }];
    async function assign(ctx, to) {
        const meta = await OBR.scene.getMetadata();
        await OBR.scene.setMetadata(CS.sidesPatch(meta, ctx.items.map(i => i.id), to));
        OBR.notification.show("Moved " + ctx.items.length + " token" + (ctx.items.length > 1 ? "s" : "") + " to " + (to >= sideNames.length ? "Not fighting" : sideNames[to]) + ".");
    }
    async function menus() {
        const names = sideNames.concat(["Not fighting"]);
        for (let i = 0; i < names.length; i++) {
            await OBR.contextMenu.create({ id: NS + "/side-" + i, icons: [{ icon: here("vendor/icons/sword.svg"), label: "Combat: " + names[i], filter: { min: 1, every: gm, roles: ["GM"] } }], onClick: ctx => assign(ctx, i) });
        }
    }
    const names = meta => { const r = CS.read(meta); const n = r.c ? r.c.sd.map(s => s.n) : ["Party", "Foes"]; if (JSON.stringify(n) !== JSON.stringify(sideNames)) { sideNames = n; menus().catch(console.warn); } };
    // attack
    async function pick(pt) {
        const items = await OBR.scene.items.getItems(i => i.layer === "CHARACTER"), bounds = await OBR.scene.items.getItemBounds(items.map(i => i.id));
        return { items, id: CA.hit(pt, items.map((it, k) => ({ id: it.id, min: bounds[k] ? bounds[k].min : it.position, max: bounds[k] ? bounds[k].max : it.position }))) };
    }
    async function send(aId, tId) {
        const [role, me] = await Promise.all([OBR.player.getRole(), OBR.player.getId()]), items = await OBR.scene.items.getItems(i => i.layer === "CHARACTER");
        const r = CA.request(role, me, items, aId, tId, ++seq);
        if (!r.ok) { OBR.notification.show(r.msg, "WARNING"); return; }
        await OBR.player.setMetadata({ [CA.KEY]: r.req });
        OBR.notification.show("Attack sent: the GM's 1e panel resolves it.");
    }
    let dragFrom = null;
    await OBR.tool.create({ id: TOOL, icons: [{ icon: here("vendor/icons/sword.svg"), label: "Attack" }], defaultMode: MODE });
    await OBR.tool.createMode({ id: MODE, icons: [{ icon: here("vendor/icons/sword.svg"), label: "Attack: drag from the attacker to the target, or click the attacker then the target", filter: { activeTools: [TOOL] } }],
        onToolDragStart: async (ctx, ev) => { dragFrom = (await pick(ev.pointerPosition)).id; },
        onToolDragEnd: async (ctx, ev) => { const from = dragFrom; dragFrom = null; if (!from) return; const to = (await pick(ev.pointerPosition)).id; if (to) await send(from, to); },
        onToolClick: async (ctx, ev) => {
            const id = (await pick(ev.pointerPosition)).id; if (!id) { pendingAttacker = null; return; }
            if (!pendingAttacker) { pendingAttacker = id; OBR.notification.show("Now click the target."); } else { const a = pendingAttacker; pendingAttacker = null; await send(a, id); }
        } });
    await OBR.contextMenu.create({ id: NS + "/attack-from", icons: [{ icon: here("vendor/icons/sword.svg"), label: "Attack...", filter: { min: 1, max: 1, every: gm } }],
        onClick: async ctx => { pendingAttacker = ctx.items[0].id; await OBR.tool.activateMode(TOOL, MODE); OBR.notification.show("Click the target."); } });
    await menus();
    OBR.scene.onMetadataChange(names);
    // the GM is told when someone asks for an attack (the open 1e panel resolves it)
    if ((await OBR.player.getRole()) === "GM") {
        const seen = {};
        OBR.party.onChange(ps => ps.forEach(p => { const r = (p.metadata || {})[CA.KEY]; if (r && r.n && seen[p.id] !== r.n) { seen[p.id] = r.n; OBR.notification.show(p.name + " asks to attack. Open the 1e panel, Combat tab."); } }));
    }
    return { pick, send };
}
