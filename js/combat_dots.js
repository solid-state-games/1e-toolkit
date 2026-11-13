// combat_dots.js - the "acted" dot on each roster token. Every client draws its own LOCAL items (OBR.scene.local: never saved, never shared, no metadata
// writes) from the combat state and each token's `cs`. Nothing for the GM to do: it redraws on scene metadata and item changes and clears at End combat.
// States (CombatAttack.dotState): none = no dot; "some" attacks used but not all = open white dot; "done" = black filled dot; "unable" (surprised this segment) =
// open dot with a slash. Black and white with the opposite colour as outline so it reads on any token art. Top-right of the token, sized from its bounds.
// Each dot is attached to its token (attachedTo) so it follows and scales with it; rotation is not inherited.
// Per browser switch: localStorage "tk-dots" = "0" turns the dots off here. Needs CombatState, CombatAttack (classic scripts) in the page.
// OBR calls used: scene.getMetadata/onMetadataChange/onReadyChange/isReady, scene.items.getItems/getItemBounds/onChange, scene.local.getItems/addItems/deleteItems.
export function installCombatDots(OBR, NS, build) {
    const CS = CombatState, CA = CombatAttack, DOT = NS + "/dot", FLAG = "tk-dots";
    let timer = null, running = false, again = false;
    const enabled = () => { try { return localStorage.getItem(FLAG) !== "0"; } catch (e) { return true; } };
    const ink = (state, d, pos, id, role) => {
        const dark = state === "done", w = Math.max(2, d * 0.14);
        const b = build().layer("ATTACHMENT").attachedTo(id).disableHit(true).locked(true).disableAttachmentBehavior(["ROTATION"]).metadata({ [DOT]: { t: id, s: state } }).position(pos);
        if (role === "slash") return b.shapeType("RECTANGLE").width(d * 1.1).height(Math.max(2, d * 0.16)).rotation(-45).fillColor("#000000").fillOpacity(1).strokeColor("#ffffff").strokeOpacity(1).strokeWidth(1).build();
        return b.shapeType("CIRCLE").width(d).height(d).fillColor(dark ? "#000000" : "#ffffff").fillOpacity(1).strokeColor(dark ? "#ffffff" : "#000000").strokeOpacity(1).strokeWidth(w).build();
    };
    async function redraw() {
        if (running) { again = true; return; }
        running = true;
        try {
            const mine = await OBR.scene.local.getItems(i => i.metadata && i.metadata[DOT]);
            const r = (await OBR.scene.isReady()) ? CS.read(await OBR.scene.getMetadata()) : { c: null };
            if (!r.c || !enabled()) { if (mine.length) await OBR.scene.local.deleteItems(mine.map(i => i.id)); return; }
            const c = r.c, toks = (await OBR.scene.items.getItems(i => i.layer === "CHARACTER" && c.ro.indexOf(i.id) >= 0));
            const want = {}; toks.forEach(t => { const s = CA.dotState(c, c.ro.indexOf(t.id), (t.metadata || {})[CA.CS]); if (s) want[t.id] = s; });
            const have = {}; mine.forEach(i => { have[i.metadata[DOT].t] = i.metadata[DOT].s; });
            const drop = mine.filter(i => want[i.metadata[DOT].t] !== i.metadata[DOT].s).map(i => i.id);
            if (drop.length) await OBR.scene.local.deleteItems(drop);
            const need = toks.filter(t => want[t.id] && have[t.id] !== want[t.id]);
            if (need.length) {
                const bounds = await OBR.scene.items.getItemBounds(need.map(t => t.id)), add = [];
                need.forEach((t, k) => {
                    const bb = bounds[k], width = bb.max.x - bb.min.x, d = Math.max(12, width * 0.22), pos = { x: bb.max.x - d * 0.7, y: bb.min.y + d * 0.7 };
                    add.push(ink(want[t.id], d, pos, t.id, "dot")); if (want[t.id] === "unable") add.push(ink("unable", d, pos, t.id, "slash"));
                });
                await OBR.scene.local.addItems(add);
            }
        } catch (e) { console.warn("dots", e); }
        finally { running = false; if (again) { again = false; soon(); } }
    }
    const soon = () => { clearTimeout(timer); timer = setTimeout(redraw, 150); };
    OBR.scene.onMetadataChange(soon); OBR.scene.items.onChange(soon); OBR.scene.onReadyChange(soon);
    window.addEventListener("storage", e => { if (e.key === FLAG) soon(); });
    soon();
    return { redraw };
}
