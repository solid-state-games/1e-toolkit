// combat_menus.js - the right-click side menu (GM only). Run by background.js (real Owlbear) and obr_bridge.js (dev mock).
// Side menu: tokens on the Character layer, works on a multi-selection. The SDK has no sub-menus, so one item per choice (the sides' current names, then Not fighting).
// OBR calls used: contextMenu.create, scene.getMetadata/setMetadata/onMetadataChange, notification.show.
export async function installCombatMenus(OBR, NS, url) {
    const CS = CombatState;
    const icon = url("vendor/icons/sword.svg");
    let sideNames = ["Party", "Foes"];
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
    await menus();
    OBR.scene.onMetadataChange(names);
}
