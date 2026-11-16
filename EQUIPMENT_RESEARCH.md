# Equipment rework: research and proposal

TB asked (2026-11-16): one Gear list for PC and NPC, weapons and armour with worn/wielded toggles, the Combat tab links to it, no duplicate weapon spots. Look at Baldur's Gate 3 and SkyUI first.

## What we have now (v0.8.0)

- Equipment page: one table grouped by place (Carried, then each place), columns Item, Qty, lb, AC, Worn, Move to. Worn tick only shows for armour, shields and AC magic items.
- Combat page: "Weapons of proficiency" chips, and the weapons table is built from those chips, not from what is carried. So a long sword sits in two spots (gear and proficiency), a carried weapon you are not proficient in never reaches the table, and a weapon left at the inn still shows as usable.
- Magic weapons (Sword, long +1) don't change to-hit or damage.

## What the two games do well

**Baldur's Gate 3** (Larian)
- Equipped items sit in named slots beside the portrait: armour, helm, cloak, gloves, boots, amulet, two rings.
- Two weapon sets, melee (main and off hand) and ranged, switched with one control. You always see what is in hand.
- Everything else is one bag; the camp chest holds what you left behind. Right-click sends an item to camp.
- Search box doubles as a filter (weapons, scrolls, potions). Sort by value, weight or type.

**SkyUI** (Skyrim mod)
- A list, not a grid: one line per item, readable at a glance.
- Category tabs across the top (All, Weapons, Armour, and so on) plus a text search.
- Sortable columns: Equipped, Damage or Armour, Weight, Value. Equipped sorts first.
- Small icon on the line marks equipped and which hand.

## What we take

1. **One list (SkyUI).** Every item once, one line, category filter (All, Weapons, Armour, Magic, Gear) and a search box. The key stat in one column: damage S-M/L for weapons, AC for armour.
2. **Status toggles on the line.** Worn (armour, shield, helm, rings, cloaks, bracers) and In hand (weapons). Missile weapons and ammunition get Ready.
3. **A short "On you" strip at the top (BG3 slots, lite).** In hand, Ready, Armour, Shield, Rings, Other worn. Read-only summary: AC and move beside it. Click a slot to jump to its line.
4. **Places stay** (our version of the camp chest): items left at a place can't be worn or held; Move to stays.
5. **Combat page reads the list.** Its weapons table lists In hand and Ready weapons only, with a "Change on the Gear page" link. Proficiency stays a list of names (PHB p.37 needs slots and the non-proficiency penalty), shown as a P mark on the line; a non-proficient weapon in hand shows its penalty (PHB p.37).

Left out: grids, drag and drop, item value, paper-doll art. The sheet must fit the 16 kB token limit, so the toggle is one flag on the existing gear row.

## Sources

- Baldur's Gate 3: [Gamepressure interface](https://www.gamepressure.com/baldurs-gate-iii/interface/zad9f7), [Gamewatcher sorting](https://www.gamewatcher.com/baldurs-gate-3/guides/how-to-sort-your-inventory-in-baldur-s-gate-3), [Itemlevel inventory guide](https://itemlevel.net/baldurs-gate-3-inventory-management-guide)
- SkyUI: [Gamepressure SkyUI](https://www.gamepressure.com/theelderscrollsvskyrim/skyui/z6a0da), [Steam Workshop page](https://steamcommunity.com/sharedfiles/filedetails/?id=8122)
