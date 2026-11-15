// combat_hp.js - GM-only hit points for NPC and monster tokens (PCs keep their sheet hit points). Runs on every client but does nothing unless this one is the GM.
//  1. Rolls hit points from the MM hit dice when a token with an exact MM name joins a fighting side (item metadata `cs` = {h:[hp,max]}; GM types the maximum otherwise).
//  2. Draws a small number on each such token (OBR.scene.local: this client only, never saved, no metadata writes): the hit points, or "x" when 0 or less (dead).
//     Players' clients draw nothing. Attached to the token, no hit, locked, top-right.
//  3. Clears the per-token attack counts an earlier build wrote to `cs`, and cleans scene keys an earlier build left (undo, log/<round>, the old combat shape).
// OBR calls used: player.getRole, scene.getMetadata/setMetadata/onMetadataChange/onReadyChange/isReady, scene.items.getItems/updateItems/getItemBounds/onChange, scene.local.getItems/addItems/deleteItems.
export async function installCombatHp(OBR, NS, build) {
    if ((await OBR.player.getRole()) !== "GM") return;
    const CS = CombatState, TAG = NS + "/hp";
    let timer = null, running = false, again = false;
    async function redraw() {
        if (running) { again = true; return; }
        running = true;
        try {
            if (!(await OBR.scene.isReady())) return;
            const meta = await OBR.scene.getMetadata(), clean = CS.cleanPatch(meta);
            if (Object.keys(clean).length) { await OBR.scene.setMetadata(clean); return; }   // the change event comes back here
            const mine = await OBR.scene.local.getItems(i => i.metadata && i.metadata[TAG]), c = CS.read(meta).c;
            const items = await OBR.scene.items.getItems(i => i.layer === "CHARACTER");
            const stale = items.filter(i => CS.oldCs((i.metadata || {})[CS.CS]));
            if (stale.length) { await OBR.scene.items.updateItems(stale.map(i => i.id), d => d.forEach(x => { delete x.metadata[CS.CS]; })); return; }
            if (!c) { if (mine.length) await OBR.scene.local.deleteItems(mine.map(i => i.id)); return; }
            const fighting = items.filter(i => c.ro.indexOf(i.id) >= 0 && CS.sideOf(c, c.ro.indexOf(i.id)) < c.sd.length);
            const join = fighting.filter(i => !(i.metadata || {})[SheetRules.KEY] && !((i.metadata || {})[CS.CS] || {}).h && CS.monsterOf(i.name));
            if (join.length) { await OBR.scene.items.updateItems(join.map(i => i.id), d => d.forEach(x => { const m = CS.monsterOf(x.name); x.metadata[CS.CS] = { h: CS.rollHd(m.d.hitDice) || [1, 1] }; })); return; }
            const want = {}; fighting.forEach(i => { const h = ((i.metadata || {})[CS.CS] || {}).h; if (h && !(i.metadata || {})[SheetRules.KEY]) want[i.id] = CS.isDead(h) ? "x" : String(h[0]); });
            const have = {}; mine.forEach(i => { have[i.metadata[TAG].t] = i.metadata[TAG].s; });
            const drop = mine.filter(i => want[i.metadata[TAG].t] !== i.metadata[TAG].s).map(i => i.id);
            if (drop.length) await OBR.scene.local.deleteItems(drop);
            const need = fighting.filter(i => want[i.id] && have[i.id] !== want[i.id]);
            if (need.length) {
                const bounds = await OBR.scene.items.getItemBounds(need.map(i => i.id)), add = [];
                need.forEach((t, k) => {
                    const bb = bounds[k], d = Math.max(16, (bb.max.x - bb.min.x) * 0.24), b = build().layer("ATTACHMENT").attachedTo(t.id).disableHit(true).locked(true).disableAttachmentBehavior(["ROTATION"])
                        .metadata({ [TAG]: { t: t.id, s: want[t.id] } }).position({ x: bb.max.x - d * 0.4, y: bb.min.y + d * 0.4 }).plainText(want[t.id]);
                    ["backgroundColor", "fillColor", "strokeColor"].forEach(f => { if (typeof b[f] === "function") b[f](f === "backgroundColor" ? "#000000" : "#ffffff"); });
                    if (typeof b.backgroundOpacity === "function") b.backgroundOpacity(1);
                    add.push(b.build());
                });
                await OBR.scene.local.addItems(add);
            }
        } catch (e) { console.warn("combat hp", e); }
        finally { running = false; if (again) { again = false; soon(); } }
    }
    const soon = () => { clearTimeout(timer); timer = setTimeout(redraw, 150); };
    OBR.scene.onMetadataChange(soon); OBR.scene.items.onChange(soon); OBR.scene.onReadyChange(soon);
    soon();
    return { redraw };
}
