// background.js - runs once per room (manifest background_url). Adds "Open 1e sheet" to the right-click menu of character-layer tokens.
// Docs used: manifest (background_url), context menu (create, filter, onClick), modal (open), notification (show), player (getId, getRole), scene items (getItems), scene metadata, popover (see banner_sync.js).
import OBR, { buildLabel } from "../vendor/obr-sdk.js";
import { installCombatMenus } from "./combat_menus.js";
import { installCombatHp } from "./combat_hp.js";

const NS = "io.github.solid-state-games.1e-toolkit"; // keep equal to SheetRules.NS (test/toolkit.test.js checks this)
const OWNER_KEY = NS + "/owner";
const here = p => new URL(p, location.href).href;

OBR.onReady(() => {
    installCombatMenus(OBR, NS, here).catch(e => console.warn("combat menus", e)); // right-click sides and the Fight tool
    installCombatHp(OBR, NS, buildLabel).catch(e => console.warn("combat hp", e)); // GM only: monster hit points, a number on the token (this client only)
    OBR.contextMenu.create({   // GM only: the foe mini sheet (stats from the Monster Manual by token name, hit points, notes)
        id: NS + "/foe-sheet",
        icons: [{ icon: here("vendor/icons/sword.svg"), label: "Foe sheet", filter: { min: 1, max: 1, every: [{ key: "layer", value: "CHARACTER" }], roles: ["GM"] } }],
        onClick(context) { OBR.modal.open({ id: NS + "/foe", url: here("index.html?view=foe&item=" + encodeURIComponent(context.items[0].id)), width: 560, height: 720 }); }
    });
    OBR.contextMenu.create({
        id: NS + "/open-sheet",
        icons: [{ icon: here("icon.svg"), label: "Open 1e sheet", filter: { min: 1, max: 1, every: [{ key: "layer", value: "CHARACTER" }] } }],
        async onClick(context) {
            const item = context.items[0];
            const [role, me] = await Promise.all([OBR.player.getRole(), OBR.player.getId()]);
            // Private sheets: GM opens any; a player opens only their own (the player the GM assigned, else whoever placed the token).
            const owner = (item.metadata || {})[OWNER_KEY];
            if (role !== "GM" && (owner ? owner !== me : item.createdUserId !== me)) {
                OBR.notification.show("That character's sheet is private to its player.", "WARNING");
                return;
            }
            OBR.modal.open({ id: NS + "/sheet", url: here("index.html?view=sheet&item=" + encodeURIComponent(item.id)), width: 980, height: 940 });
        }
    });
});
