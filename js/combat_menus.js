// combat_menus.js - the right-click side menu and the Fight tool (GM only). Run by background.js (real Owlbear) and obr_bridge.js (dev mock).
// Side menu: tokens on the Character layer, works on a multi-selection. The SDK has no sub-menus, so one item per choice (the sides' current names, then Not fighting).
// Fight tool: drag from one token to another, or click one then the other, or right-click "Fight..." then click the other. It only adds a pair
// ("who's fighting whom") to the combat; nothing is rolled or checked. Needs CombatState, CombatAttack (classic scripts) in the page.
// OBR calls used: contextMenu.create, tool.create, tool.createMode, tool.activateMode, scene.getMetadata/setMetadata/onMetadataChange,
// scene.items.getItems/getItemBounds, notification.show.
export async function installCombatMenus(OBR, NS, url) {
    const CS = CombatState, CA = CombatAttack;
    const TOOL = NS + "/fight", MODE = NS + "/fight-mode", icon = url("vendor/icons/sword.svg");
    let sideNames = ["Party", "Foes"], pending = null, dragFrom = null;
    const gmOnly = { min: 1, every: [{ key: "layer", value: "CHARACTER" }], roles: ["GM"] };
    async function assign(ctx, to) {
        await OBR.scene.setMetadata(CS.sidesPatch(await OBR.scene.getMetadata(), ctx.items.map(i => i.id), to));
        OBR.notification.show("Moved " + ctx.items.length + " token" + (ctx.items.length > 1 ? "s" : "") + " to " + (to >= sideNames.length ? "Not fighting" : sideNames[to]) + ".");
    }
    async function menus() {
        const names = sideNames.concat(["Not fighting"]);
        for (let i = 0; i < names.length; i++) await OBR.contextMenu.create({ id: NS + "/side-" + i, icons: [{ icon, label: "Combat: " + names[i], filter: gmOnly }], onClick: ctx => assign(ctx, i) });
    }
    const names = meta => { const r = CS.read(meta), n = r.c ? r.c.sd.map(s => s.n) : ["Party", "Foes"]; if (JSON.stringify(n) !== JSON.stringify(sideNames)) { sideNames = n; menus().catch(console.warn); } };
    async function pick(pt) {
        const items = await OBR.scene.items.getItems(i => i.layer === "CHARACTER"), bounds = await OBR.scene.items.getItemBounds(items.map(i => i.id));
        return CA.hit(pt, items.map((it, k) => ({ id: it.id, min: bounds[k] ? bounds[k].min : it.position, max: bounds[k] ? bounds[k].max : it.position })));
    }
    async function pair(aId, tId) {
        const r = CS.pairPatch(await OBR.scene.getMetadata(), aId, tId);
        if (r.msg) { OBR.notification.show(r.msg, "WARNING"); return; }
        await OBR.scene.setMetadata(r.patch); OBR.notification.show("Paired. See the Combat card.");
    }
    await OBR.tool.create({ id: TOOL, icons: [{ icon, label: "Fight", filter: { roles: ["GM"] } }], defaultMode: MODE });
    await OBR.tool.createMode({ id: MODE, icons: [{ icon, label: "Fight: drag from one token to the other, or click one then the other", filter: { activeTools: [TOOL] } }],
        onToolDragStart: async (ctx, ev) => { dragFrom = await pick(ev.pointerPosition); },
        onToolDragEnd: async (ctx, ev) => { const from = dragFrom; dragFrom = null; if (!from) return; const to = await pick(ev.pointerPosition); if (to) await pair(from, to); },
        onToolClick: async (ctx, ev) => {
            const id = await pick(ev.pointerPosition); if (!id) { pending = null; return; }
            if (!pending) { pending = id; OBR.notification.show("Now click the other token."); } else { const a = pending; pending = null; await pair(a, id); }
        } });
    await OBR.contextMenu.create({ id: NS + "/fight-from", icons: [{ icon, label: "Fight...", filter: { min: 1, max: 1, every: [{ key: "layer", value: "CHARACTER" }], roles: ["GM"] } }],
        onClick: async ctx => { pending = ctx.items[0].id; await OBR.tool.activateMode(TOOL, MODE); OBR.notification.show("Click the other token."); } });
    await menus();
    OBR.scene.onMetadataChange(names);
}
