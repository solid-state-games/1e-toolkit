// SHARED COPY of ENCOUNTER_ROLLER/js/mounts.js: edit the master there, then run TOOLS/sync_lib.py
"use strict";
/* Party speed. Mount speeds: MM p.53 (light horse 24", medium 18", heavy 15"), pony and mule 12" (MM p.53, p.72).
   On foot: PHB p.101-102 Encumbrance table: normal gear 12", heavy 9", very heavy 6", encumbered 3" to 4" (3" used).
   DMG p.68: the pursued party moves as fast as its slowest member, so pick the encumbrance of the slowest. */
const MOUNTS = {
    "none":         { name: "On Foot",      movement: 12 },
    "light_horse":  { name: "Light Horse",  movement: 24 },
    "medium_horse": { name: "Medium Horse", movement: 18 },
    "heavy_horse":  { name: "Heavy Horse",  movement: 15 },
    "pony":         { name: "Pony",         movement: 12 },
    "mule":         { name: "Mule",         movement: 12 }
};

const ENCUMBRANCE = {
    "normal":    { name: "Normal gear (about 35 lb)",          movement: 12 },
    "heavy":     { name: "Heavy gear (about 70 lb)",           movement: 9 },
    "veryheavy": { name: "Very heavy gear (about 105 lb)",     movement: 6 },
    "encumbered": { name: "Encumbered (over 105 lb)",          movement: 3 }
};

// Speed in inches. Mounted parties move at the mount's rate; foot parties at the encumbrance rate.
function partySpeed(mountKey, encumbranceKey) {
    const mount = MOUNTS[mountKey || "none"];
    if (mount && mountKey && mountKey !== "none") return mount.movement;
    const enc = ENCUMBRANCE[encumbranceKey || "normal"] || ENCUMBRANCE.normal;
    return enc.movement;
}

if (typeof window !== 'undefined') { window.MOUNTS = MOUNTS; window.ENCUMBRANCE = ENCUMBRANCE; window.partySpeed = partySpeed; }
