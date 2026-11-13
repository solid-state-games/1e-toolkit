// banner_sync.js - opens the phase banner popover on this client while a combat is on, and closes it when combat ends.
// Runs on every client: background.js (real Owlbear, so a player who joins late gets it) and obr_bridge.js (dev mock only).
// OBR calls used: scene.isReady/onReadyChange/getMetadata/onMetadataChange, popover.open/close.
export function watchBanner(OBR, NS, url) {
    const ID = NS + "/banner";
    let open = false;
    const sync = async meta => {
        const c = (meta || {})[NS + "/combat"], on = !!(c && c.on);
        if (on && !open) { open = true; await OBR.popover.open({ id: ID, url, width: 340, height: 74, anchorOrigin: { horizontal: "CENTER", vertical: "TOP" }, transformOrigin: { horizontal: "CENTER", vertical: "TOP" }, disableClickAway: true }); }
        else if (!on && open) { open = false; await OBR.popover.close(ID); }
    };
    const start = async () => { try { await sync((await OBR.scene.isReady()) ? await OBR.scene.getMetadata() : {}); } catch (e) { console.warn("banner", e); } };
    OBR.scene.onMetadataChange(m => { sync(m).catch(e => console.warn("banner", e)); });
    OBR.scene.onReadyChange(start);
    return start();
}
