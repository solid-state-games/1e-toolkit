# Combat mode: how others do it (Owlbear, Roll20)

Researched 2026-11-13 by the TD. Read with `COMBAT_SPEC.md`. Sources at the bottom.

## Owlbear Rodeo (36 extensions under the Combat tag)

Nobody does what we plan. Every Owlbear combat tool is a tracker (order, HP, conditions); none resolves an attack against a target's AC and applies the damage. The drag-attacker-onto-target pipeline (spec 8.6) is new ground there.

| Extension | What it does | Take from it |
|---|---|---|
| Initiative Tracker (official) | right-click "Add to Initiative", shared list, arrow to advance | the context-menu entry point; players expect it |
| Clash! (Battle-System) | init, rounds, HP math ("-15"), up to 5 effects with round durations and an expiry popup to all, stat blocks auto-load on tokens whose name matches a saved creature, GM hides enemy info, players edit their own tokens | **name-match auto-load is exactly our MM auto-fill**; HP math input; effect durations that count down and alert |
| Battle Board (Missing Link Dev) | groups share one initiative, "staged" groups sit in the list but out of initiative until activated, range rings, HP math, Healthy/Bloodied/Dead labels | **staged groups = our "hold encounter" then "place"**; side-based initiative maps to 1e side initiative |
| Movement Tracker | tracks movement used; overshoot is reversed with a reminder; a "using spell" bypass; GM resets all at once | **enforce by undoing the overshoot, with a bypass button**: that is our `cm.move-budget` with GM override |
| Old School Combat (mattpwalsh) | declarations, side initiative, then per side: morale, movement, missile, magic, melee; banner popover everyone sees | the persistent phase banner. Its phase order is B/X style, not 1e (DMG p.61 has no fixed missile-magic-melee order: spec A4) |
| Dolmenwood Combat Tracker | phase prompts; every player presses Ready before Next Phase | a "ready" handshake for the declare step (`cm.declare`) |
| Stat Bubbles, Simple HP Tracker, Owl Trackers | HP bars and AC on tokens, GM-only visibility | HP shown to GM + owner only, as decided |
| Condition Markers, Colored Rings, Token Auras | markers on tokens | show prone, held, fled etc. as small token attachments, not our own art |
| Character Distances, Bendy Ruler, AoE Shapes | measuring | we measure ourselves for movement and range (spec 4); no need to depend on them |
| OSRIC 3.0 sheet (mogadon-RPG) | ability, ancestry and combat-roll calculator | the nearest old-school sheet; no combat state |

## Roll20

The deepest prior art is the **RPGMaster** API suite (AD&D **2e**, Pro accounts only): RoundMaster, InitiativeMaster, AttackMaster. The 1e character sheets have no combat scripts of their own; the 1e sheet's initiative button just pushes a roll to the Turn Order.

**InitiativeMaster.** Three modes: standard (side rolls, side order), group (side roll plus each character's chosen action speed), individual. Each round every token picks an action from a menu built from its sheet (weapons in hand, memorised spells, items, thief skills, "other": move, change weapon). The menu then writes the turn-order entries itself, including multiple attacks: a longbow at 2/round, speed 8, after a roll of 5 goes in at 13 and 21. A "who hasn't chosen yet" check runs before the round. **For us:** the action menu is a good shape for `cm.declare`, but 1e is side initiative on d6 with speed only on ties and against casters (spec A2, A3, A7), so we take the menu and drop the speed-sum ordering.

**AttackMaster.** Three attack commands: Roll20 rolls; the player types their own roll (for physical dice); and a GM-only "targeted" attack where the GM picks a target, the tool shows the AC the roll hits and the target's AC, rolls damage for S/M and L, and shows the target's hp. Weapons must be "in hand"; ammo is counted and recovered; AC is recomputed from worn armour with shield and Dex switches. **For us:** offer three roll sources (in-sheet, typed physical roll, Owlbear Dice tray) not two; show "hits AC n" next to the target's AC so the table can follow the maths.

**RoundMaster.** Turn tracker plus timed statuses: a status gets a duration and a step (-1 per round), a marker on the token, a countdown number visible on PC tokens only (NPC durations stay GM-only), automatic removal at 0, and a GM confirm when a player sets a status on something. Clear-on-round empties the tracker each round for fresh initiative. **For us:** spell and condition durations in rounds with an expiry alert; GM confirm on player-set conditions; hide durations on monsters.

**The 1e sheet (ADnD_1E_Revised).** Switches for to-hit table (with the repeating 20s) or THAC0, "fighter 5%" option, weapon vs armour type, and encumbrance feeding initiative and surprise. Confirms our matrix-first approach is what 1e players expect, with THAC0 as an opt-out.

**Drag-to-apply.** Roll20 users drag a chat roll onto a token's bar to apply damage; Fantasy Grounds does the same with typed damage rolls. That is the established gesture; ours (drag the attacker onto the target, the tool rolls and applies) goes one step further.

## What this changes in our plan

1. MM auto-fill by token name: do it the Clash! way. Name match on drop, "apply to all with this name" (already in the spec).
2. "Hold encounter" and "place": copy Battle Board's staged groups. A held encounter sits as a staged side in the combat state; placing it activates it.
3. Movement limit: reverse the overshoot with a one-line reminder and a GM/"special movement" bypass, as Movement Tracker does, rather than blocking the drag.
4. Rolls: three sources (in-sheet, typed physical roll, Dice tray). Typed rolls suit TB's in-room play test.
5. Durations: conditions and spells carry rounds left, count down at round end, alert all on expiry; monster durations GM-only.
6. A phase banner popover everyone sees (round, surprise segment, which side acts), from Old School Combat.
7. Nobody else resolves attacks or morale on Owlbear. That is our edge; worth saying in the card text when it ships.

## Not checked

Owlbear's metadata size limit (docs.owlbear.rodeo returns 403 to fetches; still 16 kB per object from the studio notes, confirm in a real room). Roll20 wiki pages also 403; the RPGMaster facts come from the READMEs in github.com/Roll20/roll20-api-scripts.

## Sources

- https://extensions.owlbear.rodeo/tag/combat
- https://extensions.owlbear.rodeo/clash
- https://extensions.owlbear.rodeo/battle-board
- https://extensions.owlbear.rodeo/movement-tracker
- https://github.com/mattpwalsh/old-school-combat
- https://github.com/DoctorYagle/dolmenwood-combat-tracker
- https://github.com/mogadon-RPG/osric-3-char-sheet
- https://github.com/Roll20/roll20-api-scripts (InitMaster, AttackMaster, RoundMaster READMEs)
- https://github.com/Roll20/roll20-character-sheets/tree/master/ADnD_1E_Revised
