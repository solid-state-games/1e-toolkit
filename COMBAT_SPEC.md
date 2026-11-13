# Combat mode: RAW build spec (1e Toolkit, Owlbear Rodeo)

Written 2026-11-12 by the rules auditor for the Technical Director and the Studio Director (TB). Source: 1e DMG, PHB and MM only, printed page numbers (text in `ADD-BOOKS-PDF/TEXT`, italics and diagrams checked in the PDF where noted). Nothing here is from 2e, OSRIC or memory. Where the books are unclear, the literal reading is recommended and the alternatives are listed in section 7 (A1 to A24) for TB.

Page key: DMG p.61-73 combat, p.67 morale, p.79 saves, p.82 zero hit points; PHB p.101-105 movement, surprise, initiative, combat; PHB p.37-38 weapons; PHB p.39 time and distance.

## 0. Scope and what already exists

Combat mode runs on a combat scene: tokens (PC tokens carry the 1e Character Sheet in item metadata; monster tokens are matched to the MM by name), a GM panel, and a shared roll window.

Already implemented in the studio code (reuse, do not rewrite):

| Piece | Where | Covers | Gap for combat mode |
|---|---|---|---|
| `surpriseSegments`, `dexSegments` | `COMBAT_CALC/combat_rules.js` | surprise segments by die and range, DEX reaction per individual | follows the text and examples, not the p.62 table (see A1) |
| `initWinner`, `timing`, `wvs` | same | higher d6 wins, tie simultaneous; weapon vs spell segment test; weapon vs weapon speed (2 or 3 attacks) | no round or segment state |
| `toHit`, `weaponAdj`, `acType`, `attacksPerRound`, `SITUATIONS`, `RANGE_PEN` | same | matrices with the repeated 20s, PHB p.38 weapon adjustments, +2 charge, +2 rear, +2 and +4 states, -4 invisible, range -2 and -5 | no shield or dexterity negation (flank, rear, charge, caster), no set-weapon doubling, no cover |
| Pummel, grapple, overbear tables and modifiers | same | DMG p.72-73 | no per-token state (prone, stunned, held, temporary damage) |
| `checkMorale`, `baseMorale`, `MORALE_TRIGGERS`, `MORALE_MODIFIERS` | `ENCOUNTER_ROLLER/js/morale.js` | DMG p.67 base, triggers, modifiers, failure bands | counts are typed by hand; no detection |
| `pursuit.js`, `reactions.js` | `ENCOUNTER_ROLLER/js/` | pursuit and evasion (DMG p.63, p.67-69), reaction table with the morale-check footnote | hook only: a fleeing group hands off to pursuit |
| Sheet fields `hp`, `hm`, weapons, AC parts, movement by encumbrance, saves, retainer loyalty | `1E_TOOLKIT/js/sheet_rules.js`, `lib/rules_1e.js` | PC side data | monster data comes from the MM by token name |

Not covered by the books (so not in the tool): hit location, critical hits, a half-move-and-attack rule, mounted combat beyond the lance, mount charge and dismount weapons (PHB p.37-38 only), fatigue (DMG p.69 says no rules), facing as a rule (only the p.69 front, flank and rear diagrams).

## 1. The round, step by step (RAW)

Time: 1 turn = 10 minutes = 10 rounds; 1 round = 1 minute = 10 segments; 1 segment = 6 seconds (PHB p.39; DMG p.61 says the surprise segment is 6 seconds).

**Step 0. Encounter set-up** (DMG p.61, steps 1 and 2)
- 0a. Determine surprise for each side (S01 to S07 below). Surprise is possible only in a close encounter: if either side is surprised, the starting distance is 1" to 3" (10 to 30 ft indoors) or less if the area is small (DMG p.62). Unsurprised encounters start 5" to 10" apart, d6 + 4 (DMG p.62).
- 0b. Determine distance if unknown (DMG p.62). In the tool the tokens are already placed, so this is read from the board and only checked against the surprise limit.

**Step 1. Surprise segments ("round 0")** (DMG p.61-62, p.71; PHB p.102-103)
- Each segment the unsurprised (or less surprised) side may take any action A to H of step 4 below, wholly or partly. A fighter with two attacks in a normal round gets two in each surprise segment, with hit rolls made accordingly (DMG p.62).
- The surprised side can do nothing at all in those segments (DMG p.61).
- Missiles may be loosed at three times the normal rate if ready, even when distance prevents melee (DMG p.62).
- Spells: only those that fit. First level magic-user and illusionist spells are usually 1 segment, as are some others; longer spells can only be begun in the first surprise segment (DMG p.61, PHB p.103). The DMG melee example says surprise attacks per segment do not apply to spell use (DMG p.71).
- Distance: 10 ft or less can usually be closed and an attack made in 1 segment (PHB p.103). A greater distance may not be closable in one segment even by charging (DMG p.61).
- Dexterity reaction is per individual (S03). The DMG melee example shows a token with +1 reaction acting one segment sooner than the rest of its side (DMG p.71).
- Then initiative is rolled and rounds run normally (DMG p.62, p.71).

**Step 2. Declare actions** (DMG p.71, p.65)
- Players state their action at the start of each round, precisely and without delay. Hesitation means doing nothing that period (DMG p.71).
- Casters name the spell they will cast at the start of the round, before anyone knows who has initiative (DMG p.65 procedure item 1).
- Choices in melee: attack, parry, fall back, or flee (PHB p.104). Choices for an encounter: the list A to H (DMG p.61).

**Step 3. Initiative** (DMG p.61-63; PHB p.104)
- One d6 per side, rolled openly unless a monster side has secret bonuses (DMG p.62). Rolled at the start of every round, after surprise (DMG p.62).
- The higher roll possesses initiative. A tie means simultaneous action and damage to both sides regardless of what is inflicted (DMG p.63).
- Dexterity and weapon speed are not used in the one-minute round except where noted (DMG p.62). The noted places are: missile fire (DMG p.64), multiple attack routines (DMG p.63), haste and slow (PHB p.104), weapon speed in ties and against casters (DMG p.66-67), charges and set weapons (DMG p.66).

**Step 4. Side with initiative acts** (DMG p.61, p.63)
Available actions, in the book's order: A avoid engagement (flee, slam door, magic to escape); B parley; C await the other side; D discharge missiles or magical device attacks, cast spells, turn undead; E close to striking range or charge; F set weapons against a charge; G strike blows to kill or subdue; H grapple or hold (DMG p.61).
- Missiles, device attacks, spells and turning can occur at the same time as each other (DMG p.64-65).
- Damage or other results are applied immediately, before the reacting side acts, so a victim may be killed, webbed or turned before it acts (DMG p.63).
- Spell attacks: the spell begins on this side's turn but ends only after its casting time; being hit meanwhile spoils it (DMG p.65).

**Step 5. Reacting side acts** (DMG p.61, p.63)
- Each member of the reacting side that can still act takes the same range of actions A to H. Any damage it inflicts is applied immediately, which may let it strike twice in a row if it wins initiative next round (DMG p.63).
- Melee after a charge or closing move has its own order, see section 5 (DMG p.66).

**Step 6. End of round**
- Morale checks that the triggers of DMG p.67 call for (section 3).
- A creature at 0 hit points or below loses 1 more hit point each following round until -10, unless aided (DMG p.82, option A11).
- Temporary (subduing, pummel, grapple, overbear) damage: the incidental portion returns at 1 hit point per round (DMG p.67, p.72-73).
- Charge cool-down, spell and condition durations tick (section 5; PHB spell durations are in rounds).
- Roll initiative again and repeat, until melee ends by fleeing, inability to continue, or death of one or both parties (DMG p.61 step 6).

**Segment-by-segment parts** (the only places the books count segments inside a round)
- Surprise (step 1).
- Spell versus weapon timing: adjusted segment = weapon speed factor minus the losing side's initiative die, negatives read as positive; weapon blow first if that is less than the spell's casting time in segments, simultaneous if equal, spell first if greater. Checked against the worked examples: factor 5 sword, 3 segment fireball: roll 1 spell first, roll 2 simultaneous, rolls 3 to 5 blow first; dagger factor 2 strikes first on rolls 1 to 4 and simultaneously on 5; speed 9 or 10 never beats the spell (DMG p.66-67).
- Attacks on a caster come on the segment shown by the initiative die of whichever side it belongs to, winner's die for the winner's side (a roll of 5 means segment 5, not the loser's 4 or less). So all such attacks fall in segments 1 to 6 (DMG p.65 procedure item 2).
- Movement per segment: PHB p.102 table (section 4).
- Flaming oil on a creature burns 1 to 3 segments at 1 hit point per segment (DMG p.64).
- Psionic combat runs in segments (DMG p.79 note a). Out of scope.

## 2. Rule table

Automate column: **auto** = the tool computes and applies; **prompt** = the tool detects and asks the GM to confirm or roll; **display** = shown as a reminder only.
Toggle names are `cm.<name>`. Default on means the RAW restriction is enforced; the GM can switch each one off. A toggle off never hides the rule from the log.
Data: T = token or sheet field, M = monster data from the MM by token name, C = combat state (section 8).

### 2.1 Time, surprise and initiative

| id | rule (paraphrased, exact numbers) | page | data needed | automate? | toggle | default |
|---|---|---|---|---|---|---|
| R01 | Round = 1 minute = 10 segments of 6 s; turn = 10 rounds | PHB p.39; DMG p.61 | C round | auto (counter) | `cm.rounds` | on |
| R02 | Order: surprise, distance, initiative, first side acts, second side acts, repeat | DMG p.61 | C phase | auto (phase machine) | none | on |
| R03 | Actions are stated at the start of each round; delay means doing nothing | DMG p.71 | T declared action | prompt (declare step) | `cm.declare` | off |
| S01 | Surprise: d6 per side, surprised on 1-2 normally; some creatures 1 in 6, 1 in 8, 5 in 6 and so on; the most favourable member represents the side | DMG p.61; PHB p.102 | C per-side range (T race/class, M) | auto roll, GM sets ranges | `cm.surprise` | on |
| S02 | Segments lost = the surprised side's die score; both surprised: subtract the lesser from the greater; equal = no effect | DMG p.61-62 | C | auto | `cm.surprise` | on |
| S03 | DEX reaction (PHB p.11 Table I: 3 -3, 4 -2, 5 -1, 6 to 15 none, 16 +1, 17 +2, 18 +3): per individual, a penalty adds segments, a bonus removes them, never creates surprise or affects others | DMG p.62, p.71; PHB p.11 | T dex | auto | `cm.surprise-dex` | on |
| S04 | Prior detection (noise, light, magic, awareness) negates surprise; surprise can be one-sided, roll only for the side subject to the condition | DMG p.62; PHB p.103 | none | prompt (GM sets range 0 or skips the side) | none | on |
| S05 | In a surprise segment the active side attacks as if the segment were a full round; missiles at 3 times rate if ready; spells only if casting time fits (1 segment spells), longer ones begin in segment 1 | DMG p.62, p.71; PHB p.103 | T attacks per round, spell time | auto (attack allowance); prompt (spells) | `cm.surprise-attacks` | on |
| S06 | Surprised side cannot react at all during its lost segments | DMG p.61 | T sg (segments left) | auto (bars all actions) | `cm.surprise-bar` | on |
| S07 | With surprise on, distance is 1" to 3" or less | DMG p.62 | token distance | prompt (warn if more) | none | on |
| I01 | Initiative: d6 per side each round after surprise; higher possesses it; tie = simultaneous, damage to both | DMG p.62-63; PHB p.104 | C | auto | `cm.initiative` | on |
| I02 | Initiative gives first action; results (damage, web, turn) apply before the other side acts | DMG p.63 | C phase | auto (phase order) | `cm.phase-order` | on |
| I03 | DEX attacking adjustment adjusts a missile-firer's initiative roll for that individual only; it can let that individual fire before the opposing winner | DMG p.64 | T dex, weapon kind | prompt | `cm.missile-dex-init` | on |
| I04 | Slowed or hasted: the non-slowed, non-hasted side always has initiative; hasted strike first, slowed last. Haste doubles move and attack rate (not casting); slow halves them | PHB p.104-105, p.74-75 | T condition flags | auto flag, prompt order | `cm.haste-slow` | on |
| I05 | Two or more attack routines in a round: that side attacks FIRST and LAST with those members; both sides: initiative decides FIRST and THIRD versus SECOND and LAST; single routine members go in the middle; three routines extrapolate | DMG p.63; PHB p.104-105 | T attacks per round | prompt (shows slots) | `cm.multi-attack-order` | on |
| I06 | Fighter and paladin 3/2 from level 7, 2/1 from 13; ranger 3/2 from 8, 2/1 from 15; 3/2 is two routines in every odd round | PHB p.25; DMG p.63 | T class, level | auto (from sheet) | `cm.multi-attack` | on |
| I07 | Tied initiative, both using weapons: lower speed factor strikes first; difference of 5 or more, or twice the lower factor: lower gets 2 attacks first; 10 or more: 2 before and 1 at the same time as the slower. Not used when closing or charging, only after an initial round of melee or when no closing was needed | DMG p.66 | T weapon speed (PHB p.38) | prompt (calculator exists: `wvs`) | `cm.speed-factor` | on |
| I08 | Weapon speed also decides when a blow lands against an opponent doing something else (casting): adjusted segment test above | DMG p.66-67 | T speed, C initiative die, spell segments | prompt (`timing`) | `cm.caster-timing` | on |

### 2.2 Movement, closing, charging, missiles

| id | rule | page | data | automate? | toggle | default |
|---|---|---|---|---|---|---|
| M01 | Movement rate in inches; combat: 1" = 10 ft per round (6" = 60 ft per round, 6 ft per segment; 12" = 120 ft, 12 ft; and so on) | PHB p.102 | T move (sheet encumbrance band), grid scale | auto (budget) | `cm.move-budget` | on |
| M02 | Encumbrance bands: 12" normal gear about 35#; 9" heavy gear about 70#; 6" very heavy 105#; 3" to 4" over 105#. Strength modifies | PHB p.101-102 | T sheet move | auto (read from sheet) | none | on |
| M03 | Close to striking range: move at base speed to engage; melee is not possible that round (opponent over 1" away); other actions (missiles, spells) are fine | DMG p.66 | T start pos, end pos, target | auto bar | `cm.move-bar` | on |
| M04 | Charge: brings the charger into melee on the charge round if it ends within 10 ft; indoors double base speed; outdoors base + 33 1/3 percent (two-legged) or + 50 percent (four-legged); encumbered creatures cannot charge | DMG p.66 | T move, encumbrance, legs | auto (budget, bar) | `cm.charge` | on |
| M05 | No DEX AC bonus when charging; a creature without a DEX bonus is 1 AC worse (AC 3 becomes 4); AC 10 is unchanged | DMG p.66 | T dex AC part | auto (adds to defender AC) | `cm.charge-ac` | on |
| M06 | At the end of a charge initiative is not checked; the longer weapon (reach) strikes first; the charger gets +2 to hit if it survives first blows | DMG p.66 | T weapon length (PHB p.38), charge flag | auto (order and +2) | `cm.charge-first` | on |
| M07 | Only one charge each turn: 9 rounds must pass before another | DMG p.66; PHB p.39 | T last charge round | auto bar | `cm.charge-cooldown` | on |
| M08 | Set weapon (braced spear, spiked pole arm, fork, glaive): the set weapon strikes first against a charger and does double the die result on a hit. PHB p.37 italic weapons (double only vs L when set): military fork, glaive, glaive-guisarme, javelin, spear; spear also doubles vs any size when set; lance (any horse) doubles vs any size when the wielder is on a charging mount | DMG p.66; PHB p.37 | T weapon, declared "set", charge flag | auto (first strike, x2) | `cm.set-weapon` | on |
| M09 | Breaking off from melee: the opponent gets one free attack or attack routine, as a rear attack on a stunned opponent (+4, no shield, no DEX); then the leaver moves at full rate and, unless pursued by a faster creature, melee ends | DMG p.70 | T engaged flag, positions | prompt (offers the free attack) | `cm.break-off` | on |
| M10 | Fall back: a retrograde move facing the foe, may combine with a parry; foes not otherwise engaged can follow. Flee: rapid withdrawal exposing the rear; later attacks only if the foe can follow at equal or greater speed | PHB p.104-105 | T declared action | prompt | `cm.fall-back` | on |
| M11 | Moving unengaged figures go to the unengaged enemy; helping friends means travelling at normal rates | DMG p.70 | tokens | display | none | on |
| M12 | A fleeing party cannot escape if the foe is in striking range (use M09); it can always flee if it has initiative or the foe is surprised; pursuit then follows DMG p.63 and p.67-69 | DMG p.63, p.67-69 | C | prompt (hand off to pursuit engine) | `cm.flee-pursuit` | on |
| F01 | Missiles: rate of fire per round by weapon (PHB p.38 table: bows 2, light crossbow 1, heavy crossbow 1/2, dart 3, dagger 2, others 1); ranges S, M, L in inches, 1" = 10 ft indoors, 10 yd outdoors; medium range -2, long -5 to hit; beyond long is out of range | PHB p.38-39; DMG p.74 | T weapon, distance | auto (band and penalty) | `cm.range` | on |
| F02 | Strength bonuses do not apply to missiles unless special weapons are used; DEX attacking adjustment applies (PHB p.11) | DMG p.64 | T | auto | `cm.missile-str` | on |
| F03 | Giant and machine missiles: target gets no DEX bonus to AC | DMG p.64 | T | auto (tag source) | none | on |
| F04 | Cover: 25 percent +2 AC, 50 percent +4, 75 percent +7, 90 percent +10; concealment: 25 percent +1, 50 percent +2, 75 percent +3, 90 percent +4 (missile fire) | DMG p.64 | T target cover choice | prompt (GM picks cover) | `cm.cover` | on |
| F05 | Missiles into a melee: split by value S = 1/2, M = 1, L = 1 1/2 (L not much larger than man-size); ratio sets the chance each missile goes to each side | DMG p.63 | T sizes | prompt (shows ratio) | `cm.melee-fire` | on |
| F06 | Missile that misses: d6 feet off, d8 direction (d4 for distance optional at short range) | DMG p.64 | none | display | none | on |

### 2.3 Melee modifiers and positions

| id | rule | page | data | automate? | toggle | default |
|---|---|---|---|---|---|---|
| P01 | Flank attack: negates the defender's shield AC bonus | DMG p.70 | T shield AC part, relative position | auto (with F-switch) | `cm.flank` | on |
| P02 | Rear attack: +2 to hit, negates shield and DEX AC bonus | DMG p.70; PHB p.38 | same | auto (with R-switch) | `cm.rear` | on |
| P03 | Rear flank (attacker unseen): negates DEX bonus | DMG p.70 | same | auto | `cm.rear` | on |
| P04 | Stunned, prone, motionless: treat as attacked from the rear but +4, not +2 (so also no shield, no DEX) | DMG p.70; PHB p.38 | T prone, stunned flags | auto (token switch) | `cm.prone` | on |
| P05 | Special to-hit: +2 vs encumbered, held by one leg, off balance; +4 vs stunned, held by both legs, slowed, partially bound; automatic vs magically asleep, held, paralysed, totally immobile | DMG p.67 | T condition flags | auto | `cm.states` | on |
| P06 | Magically asleep or held opponents in a general melee when the attacker is subject to enemy action: automatically struck, maximum damage, twice the normal number of attacks; otherwise slain or bound one per round. Normally sleeping opponents are not covered (assassination table) | DMG p.70 | T flags | auto (max damage), prompt (when to allow) | `cm.helpless` | on |
| P07 | Totally immobile and powerless: trussed or slain in 1 round, no bonus needed | DMG p.67 | T | prompt | `cm.helpless` | on |
| P08 | Invisible attacker or target: -4 to hit; invisible creatures cannot be attacked from flank or rear unless seen | DMG p.70 | T invisible flag | auto (-4) | `cm.invisible` | on |
| P09 | Charging: +2 to hit, and no DEX AC bonus for the charger (M05, M06) | DMG p.66 | T | auto | `cm.charge-first` | on |
| P10 | Shield bonus is good against at most 3 attackers; extra attackers hit as if no shield. Attackers whom the defender cannot see ignore DEX bonus (PHB example: 7 hobgoblins vs a dwarf, 4 attack at AC 0, then AC 2 without DEX) | PHB p.105 | T attackers this round | auto count, prompt | `cm.shield-cap` | on |
| P11 | Opponents per figure: S defender 4 M or 2 L (up to 6 S space permitting); M defender 8 S, 6 M or 4 L; L defender 12 S, 8 M or 6 L; narrow places limit it | DMG p.69 | T sizes, tokens adjacent | prompt (warns) | `cm.opp-limit` | off |
| P12 | Two weapons (second a dagger or hand axe): primary -2, secondary -4; DEX below 6 adds the PHB penalties to each; DEX above 15 reduces penalties but never to a bonus (16: -3/-1, 17: -2/0, 18: -1/0); no shield or parry with the second | DMG p.70 | T dex, weapons | auto (adds to roll) | `cm.two-weapon` | on |
| P13 | Spell and curse adjustments (curse, prayer, protection from evil) must change the AC, not the die roll | DMG p.70 | T | display | none | on |
| P14 | Parry: no return attack that round; the parrier's Strength to-hit bonus is subtracted from the opponent's to-hit roll(s) | PHB p.104-105 | T declared action, str hit bonus | auto (modifier) | `cm.parry` | on |
| P15 | Weaponless attack mode (pummel, grapple, overbear): column plus secret d6 variable (defender d4); an armed opponent strikes first and a weapon hit only fends the attacker off; monks fight normally until stunned | DMG p.72-73 | per COMBAT_CALC | prompt (hand off to calculator) | `cm.weaponless` | on |
| P16 | Subduing with a weapon: 75 percent of damage is temporary and 25 percent real (not for PCs). Pummel and grapple: 25 percent actual, 75 percent returns at 1 hp per round. Overbear: 50 percent actual | DMG p.67, p.72-73 | T temp damage | auto (split) | `cm.subdual` | on |
| P17 | Monk open hand: man-size limits by monk level (6'6" and 300# at level 1, then +2" and +50# per level) and not vs undead, golems, doppelgangers | DMG p.70-71 | T size, weight | display | none | on |

### 2.4 Spells, devices, turning

| id | rule | page | data | automate? | toggle | default |
|---|---|---|---|---|---|---|
| C01 | Caster names the spell at the start of the round before initiative is known | DMG p.65 | T casting | auto (declare) | `cm.cast-declare` | on |
| C02 | Casting time is in segments (PHB spell entry); the spell starts on its side's turn and completes after the casting time | DMG p.65; PHB p.40ff | T spell segments | auto (completion segment) | `cm.cast-time` | on |
| C03 | Any successful hit (blow, missile, spell not saved against), a punch, a grapple or overbear, ends the spell and it is lost | DMG p.65, p.70 | T casting, attack result | auto (cancel) | `cm.cast-interrupt` | on |
| C04 | Caster cannot move (not even walk) while casting, and cannot be crouching or prone unless the spell has no somatic part; interruption for any reason cancels | DMG p.65 | T moved, prone | auto (cancel on move), prompt | `cm.cast-still` | on |
| C05 | Caster cannot use DEX bonus to avoid being hit while casting | DMG p.65 | T dex AC part | auto (drop DEX) | `cm.cast-dex` | on |
| C06 | Intelligent monsters aware of spell danger target casters if not engaged | DMG p.65 | none | display | none | on |
| C07 | Device attacks (rods, staves, wands) and breath and gaze attacks use initiative; breath and gaze are unpreventable if the creature lives to its action; saves apply | DMG p.65; PHB p.104 | T device | prompt (rolls saves) | `cm.devices` | on |
| C08 | Turning undead: each cleric may attempt once per encounter; on success against mixed groups it may continue each round; counters allowed; may be done at the same time as other actions | DMG p.65-66 | T cleric, undead | prompt | `cm.turning` | on |
| C09 | Cover of 90 percent or better: no damage from a spell if the save succeeds; hard cover helps saves | DMG p.65 | T | display | none | on |

### 2.5 Damage, death, saves

| id | rule | page | data | automate? | toggle | default |
|---|---|---|---|---|---|---|
| D01 | Damage is hit points; a hit scores damage; some hits allow a further save (poison, paralysis) | PHB p.105 | T hp, hm | auto (apply, GM undo) | `cm.damage` | on |
| D02 | Death at 0: PHB says 0 or negative hit points is dead (regeneration can prevent it) | PHB p.105 | T hp | auto | `cm.death-mode` = "phb" | see A11 |
| D03 | Zero hit points (DMG alternative): at 0 (optionally as low as -3 if the same blow took it from above 0) the creature is unconscious; it loses 1 more hit point each following round until -10 and dies; aid in any round stops the loss | DMG p.82 | T hp, state | auto (bleed), prompt (aid) | `cm.death-mode` = "dmg" | see A11 |
| D04 | Revived from 0 or less: coma 1 to 6 turns, then a week's rest minimum; at -6 or worse scarring or loss of a member is optional | DMG p.82 | T | display | none | on |
| D05 | Unconscious by pummel or grapple: 1 round plus 1 round per point beyond 0; can be trussed or slain in 1 round | DMG p.72 | T | auto (timer) | `cm.subdual` | on |
| D06 | Doubled damage (set weapon, lance on a charging mount) doubles the die result, not an extra roll; bonuses are added after | DMG p.66; PHB p.37 | T weapon | auto | `cm.set-weapon` | on |
| D07 | Saving throws: per class and level (PCs), monsters by hit dice (plus one die per extra 4 hp), non-intelligent creatures at half hit dice rounded up (not poison or death); a natural 1 always fails | DMG p.79 | T saves (sheet), M hd | auto (target number), prompt (roll) | `cm.saves` | on |
| D08 | Items must save against dragon fire, lightning and the like | PHB p.105; DMG p.64 | none | display | none | on |
| D09 | Item charges: unless noted, rods 50 minus d10-1, staves 25 minus d6-1, wands 100 minus d20-1; each use spends 1 charge (some functions 2); some wands work once per round | DMG p.132-135 | T item charges | prompt (decrement) | `cm.item-charges` | on |

### 2.6 Morale (detail in section 3)

| id | rule | page | data | automate? | toggle | default |
|---|---|---|---|---|---|---|
| O01 | Morale checks apply to non-leader NPCs: henchmen, hirelings, groups of intelligent monsters. PCs never check; powerful monsters never check; weak ones probably not while they have leadership; berserkers and similar never check | DMG p.67; PHB p.106; MM p.67-68 | T side, role, `fearless` flag | auto (skip flagged) | `cm.morale` | on |
| O02 | Triggers and modifiers as in section 3 | DMG p.67 | T, C counts | auto detect, prompt roll | `cm.morale-alerts` | on |
| O03 | Henchman base = loyalty score (50 percent plus Charisma adjustment and the DMG p.36-37 modifiers); typical combat checks: combat with possibly dangerous foe: runs away; liege incapacitated or slain: runs away; surrounded by superior foe or offered surrender terms: surrenders | DMG p.36-37 | T retainer loyalty (sheet) | auto (base), prompt | `cm.morale-loyalty` | on |
| O04 | Monster base = 50 percent + 5 percent per hit die above 1 + 1 percent per hit point above whole dice | DMG p.67 | M hd | auto | `cm.morale` | on |
| O05 | Failure bands by points failed: 1 to 15 fall back fighting; 16 to 30 disengage and retreat; 31 to 50 flee in panic; 51 or more surrender | DMG p.67 | none | auto (sets status) | `cm.morale-effects` | on |
| O06 | A reaction roll of 01 to 25 can instead call for a morale check | DMG p.63 | none | display | none | on |

## 3. Morale triggers the tool can detect

Roll: d100; add the modifiers to the roll; the adjusted roll must be equal to or less than the morale score for morale to hold. Failure percent = adjusted roll minus score (DMG p.67; same direction as `checkMorale`). All counts use the "party" of the checking creature, defined by a token's `unit` field (A14).

| Trigger (DMG p.67) | Modifier | How the tool detects it | Detect |
|---|---|---|---|
| Faced by an obviously superior force; check each round. The book's footnote example: one force is hitting twice as often as the other | +0 | Count hits landed by each side in the last full round from the log; if one side hit at least twice as often as the other (and at least 2 hits), the lesser side's units are flagged | auto flag, GM confirms |
| 25 percent of the party eliminated or slain | +5 | Count dead, unconscious, fled, surrendered tokens in the unit against the unit's starting size; first time the figure reaches 25 percent | auto |
| Leader unconscious | +10 | Token with `leader` flag reaches 0 hp or below (unconscious per D03) or gets an unconscious condition | auto |
| 50 percent or more eliminated or slain | +15 | As above at 50 percent | auto |
| Leader slain or deserts | +30 | Leader token dead, or fled or surrendered after a failed morale result | auto |
| Individual taking 25 or 50 percent personal wound damage (footnote) | +5 / +15 | Hit points lost divided by max hit points, per token, after each damage entry | auto |
| Each enemy slain | -10 each | Count of enemy tokens set dead by this unit's side since its last check | auto count |
| Each enemy deserting | -5 each | Enemy tokens set fled (after morale failure) in that window | auto count |
| Inflicting casualties without receiving any | -20 | The side has at least 1 kill and the unit's side has 0 losses | auto |
| Each friend killed | +10 each | Same count for the unit | auto count |
| Taking casualties without receiving any | +10 | The unit's side has at least 1 loss and 0 kills | auto |
| Each friend deserting | +15 each | Friends set fled | auto count |
| Outnumbered and outclassed by 3 or more to 1 | +20 | Token count ratio 3:1 is detected; "outclassed" (hit dice or level) is a judgement | auto count, prompt for "outclassed" |
| Reaction roll 01 to 25 | n/a | Only if the GM uses the reaction table in combat | prompt |
| Henchman situations (liege down, surrounded, offered terms) | per DMG p.36 | Liege token dead or unconscious for each retainer linked to it; surrounded = 3 or more foes adjacent and no friends adjacent (suggested) | auto (liege), prompt (rest) |

Notification: when a trigger fires, the combat panel adds a "Morale check needed" card (one per unit, grouped, with the base score, the modifiers listed, and a roll button) and calls `OBR.notification.show` to the GM only. Checks are per creature (DMG p.67 "for each creature"); the card offers "roll for all in unit" using one roll each. Result sets the token's `m` status (0 holds, 1 falls back fighting, 2 disengages and retreats, 3 flees, 4 surrenders) and logs it. A fled or surrendered token is out of the combat count and is marked on the token.

When to re-check: see A14 (default: once when each threshold is first crossed, once for each leader event, and every round for the superior-force flag).

Skip list (no card): tokens marked as PCs and tokens with `fearless` (set from MM text: berserkers and any entry saying "never check morale"). PHB p.106 says weak monsters probably do not check while they have leadership: shown as a note on the card, not enforced.

## 4. Movement in a round, and measuring on an Owlbear grid

What RAW gives, in feet indoors (outdoors read feet as yards, see A9). Rate R in inches comes from the sheet (by encumbrance band, PHB p.101-102) or the MM.

| Action | Distance allowed per round | Per segment | Melee that round? | Page |
|---|---|---|---|---|
| Normal move or "close to striking range" | R x 10 ft | R ft | No (A8) | PHB p.102; DMG p.66 |
| Charge, indoors | 2 x R x 10 ft | 2 x R ft | Yes if it ends within 10 ft of the foe | DMG p.66 |
| Charge, outdoors, two-legged | R x 10 yd x 4/3 | not given | Yes if it ends within 10 ft | DMG p.66 |
| Charge, outdoors, four-legged | R x 10 yd x 3/2 | not given | same | DMG p.66 |
| Break off then move away | full movement rate | R ft | free attack to the foe first | DMG p.70 |
| Casting a spell | no movement | none | not applicable | DMG p.65 |
| Surprise segment closing | up to the foe if 10 ft or less ("usually") else up to R ft per segment | R ft | yes if it closes to within 10 ft (see A17) | PHB p.103; DMG p.61 |

Examples: R = 12": move 120 ft per round (12 ft per segment), indoor charge 240 ft. R = 6" (very heavy gear): move 60 ft per round (6 ft per segment), indoor charge 120 ft. R = 3" to 4" (encumbered): no charge (A10).

**Measuring on the board**
- Unit conversion: PHB p.39 gives 1" = 10 ft indoors and 1" = 10 yd outdoors for ranges. PHB p.102 applies the 10 ft figure to combat movement in the dungeon and in cities, and says outdoor encounter movement is handled the same way as dungeon combat; DMG p.66 says the base speed is tens of yards outdoors. Setting `cm.scale` per combat: "indoors (1 inch = 10 ft)" or "outdoors (1 inch = 10 yd)", default indoors, with "outdoors" using yards for range and for movement as DMG p.66 reads (A9).
- Recommended scene grid: 1 square = 1 inch. The book's own figure diagrams use squares or hexes of one inch per face for 25 mm figures (DMG p.69-70), so one square then equals 10 ft (or 10 yd). A rate of 12" is 12 squares per round; striking range (10 ft) is the adjacent squares.
- If the GM has set another grid scale (for example 5 ft squares), read it with `OBR.scene.grid.getScale()` (the SDK has `getScale`, `getDpi`, `getType`, `getMeasurement`; the exact return shape must be checked in a real room, since the docs were unreachable) and convert: inches = distance in feet / 10. Let the GM override the feet-per-square value in the combat panel; if the scale is missing, ask.
- Distance method: default Chebyshev (a diagonal counts as one square). It matches the eight neighbours the DMG shows around a defender (DMG p.69) and is the SDK's `CHEBYSHEV` measurement; alternatives are alternating diagonals (5-10-5) or straight-line distance (A20). Use the same method for movement and range.
- Token footprints: measure between the nearest edges of the two token footprints, not centres, so large tokens work: distance to a target = max(0, edge gap in squares) x feet per square. Striking range = edge gap of 0 or 1 square when a square is 10 ft (that is, adjacent), or gap up to 10 ft in general.
- Moved this round: at the start of the round store each token's position. After each drop (not during dragging) add the measured distance from the previous resting position. Path length is the sum of straight segments between drops, so the GM can undo a mistaken drag by moving the token back (the sum reduces) or pressing "reset move".

**Barring attacks after moving too far** (`cm.move-bar`): when the attack tool is dragged, the check reads `moved` (feet) and `closed` (the token began its action more than 10 ft from the target). If `closed` and no valid charge, melee is barred with the reason shown, and missiles and spells are not (A8). If the charge conditions fail (moved more than the charge budget, encumbered, cool-down, ends over 10 ft away), melee is barred and the token's AC loses its DEX bonus for the rest of the round if it had started the charge. A move beyond the normal budget shows "over by N ft" and bars everything except the GM override. Each of these is its own toggle (`cm.move-budget`, `cm.move-bar`, `cm.charge`).

## 5. Charges

### 5.1 The combat charge (DMG p.66)
1. Declared as action E at the start of the round (DMG p.61, p.71) by the side whose turn it is (A10: a charge can also be the reaction).
2. Not allowed if the creature is encumbered (A10), or if it charged in the last 9 rounds (one charge per turn, interval of 9 rounds).
3. Move: indoors up to 2 x base speed; outdoors base + 1/3 (two-legged) or + 1/2 (four-legged).
4. The charger must finish within 10 ft of the foe for any blows to be struck that round.
5. While charging: no DEX bonus to AC; creatures with none are 1 AC worse; AC 10 unchanged.
6. At the end of the charge no initiative roll: the longer weapon (reach) strikes first. The charger has +2 to hit if it survives any attacks that come before its own. Literal reading: if the charger strikes first there are no earlier attacks to survive, so it still has the +2 (A10 item 5).
7. Set weapons against a charge (M08): initiative goes to the set weapon automatically; double die result on a hit (per PHB p.37 italics and notes).
8. A lance carried by a charging mount's rider does double damage to any size (PHB p.37 note).
9. Grappling, pummelling and overbearing: charging to attack comes second in the first-attack order, after surprise (DMG p.72-73); rushing or leaping adds 15 percent to the overbear result roll (DMG p.73).
10. Weapon speed factors are not used when closing or charging (DMG p.66); after the first round of melee they apply (I07).

Tool state: `ch` = round of the last charge (cool-down = current round minus `ch` must be 10 or more under the reading in A10), `charging` = true while resolving.

### 5.2 Item charges (DMG p.132-135)
Rods, staves and wands hold charges (defaults in D09); each use spends 1 (some 2); some wands may work once per round. Sheet equipment lines may carry a charge count; combat mode prompts "spend a charge?" when the GM marks a device use, shows the remaining count to the GM only, and logs the use without the number to others. When a device reaches 0 charges it is spent (a completely drained rod, staff or wand cannot be used again, DMG p.132). Charge values are secret to players in the book ("the user will not necessarily be aware of the number of charges", DMG p.132).

### 5.3 Other uses of the word
The books use "charge" for nothing else in combat. A monster whose MM entry mentions charging is read with the 5.1 rules, and a leaping or pouncing creature falls under the set-weapon rule (DMG p.66 lists leaping, pouncing and falling opponents).

## 6. Flank, rear, prone and helpless modifiers

| Situation | Modifier | Page |
|---|---|---|
| Flank attack | defender loses shield AC bonus | DMG p.70 |
| Attack on a rear flank (defender cannot see attacker) | defender loses DEX AC bonus | DMG p.70 |
| Rear attack | +2 to hit; defender loses shield and DEX | DMG p.70; PHB p.38 |
| Stunned, prone or motionless defender | treated as rear attack but +4 to hit (shield and DEX also lost) | DMG p.70; PHB p.38 |
| Held by one leg, encumbered, off balance | +2 to hit; no DEX | DMG p.67 |
| Slowed, held by both legs, partially bound, stunned | +4 to hit | DMG p.67 |
| Magically asleep, held, paralysed, totally immobile | automatic hit; in a general melee the attacker is subject to enemy actions: maximum damage and twice the attacks; otherwise slain or bound, one per round | DMG p.67, p.70 |
| Pummel/grapple vs prone without shield or ready weapon, or helpless | automatic hit (pummel); +30 percent result (helpless) | DMG p.72 |
| Break-off free attack | rear attack on stunned: +4, no shield, no DEX | DMG p.70 |
| Charging attacker | +2 to hit; its own DEX bonus lost | DMG p.66 |
| Invisible attacker | -4 to hit; cannot be flanked or rear-attacked unless seen | DMG p.70 |
| Attacker with second weapon | -2 primary, -4 secondary | DMG p.70 |
| Shield used against more than 3 attackers | extra attackers ignore it | PHB p.105 |
| Cover or concealment vs missiles | AC bonuses (F04) | DMG p.64 |
| Giant or machine missiles | target gets no DEX bonus | DMG p.64 |

**Which cells are front, flank and rear** (DMG p.69 diagrams, read from the PDF; the number of attackers possible is also in the DMG p.70 rat example):
- Hex grid, flat top: 3 front, 2 flank, 1 rear (6 giant rats fight frontally, 4 from flank and 2 from the rear, two rats per hex, DMG p.70). Hex grid with the other orientation: 2 front, 2 front-or-flank, 2 rear.
- Square grid: 3 front (the row ahead), 2 flank (the squares at the sides, labelled front-flank), 3 rear (the row behind). Diamond layout: 3 front, 2 side, 3 rear.

How the tool decides (the SD wants switches): each attack prompt shows two switches, "Attack from: front / flank / rear" and "Defender: prone", plus the token conditions (stunned, held, asleep). Default is manual (both switches off, GM sets them). Optional `cm.auto-facing` reads the defender token's rotation as its facing (front = token's upward direction at 0 degrees, with an offset setting) and classifies the attacker's bearing: square grid front within 67.5 degrees of facing, flank 67.5 to 112.5, rear beyond; this is derived from the eight-neighbour diagram and is NOT a book rule (A12). Shield cap (P10): the tool counts distinct attackers on a defender in the round and from the 4th on drops the shield, regardless of facing, under `cm.shield-cap`.

Prone: set by the GM switch on the token or by a result (pummel "off balance", overbear "knocked flat", grapple "both fall"). There is no stand-up time or movement cost in the books (A13): standing is a prompt only. A prone caster cannot cast unless the spell has no somatic part (C04).

## 7. What is ambiguous (literal reading recommended, alternatives)

| # | Question | Pages | Literal reading (recommended) | Alternatives |
|---|---|---|---|---|
| A1 | Surprise table vs text | DMG p.62, p.71; PHB p.103 | Segments lost = the die score of a surprised side; for two surprised sides subtract. The text, both worked examples and the melee example agree. The printed table rows "party 1, monster 2" and "party 2, monster 1" say the opposite of the text (the lower roller is shown surprised). COMBAT_CALC follows the text; the studio GOTCHAS line says "apps follow the table". TB to settle which one the whole toolkit uses | Use the table: lower die of the two is the surprised side, difference in segments |
| A2 | Segments versus rounds | DMG p.61-63, p.65-67; PHB p.39, p.104 | Initiative is per round and orders two phases (winner then loser). Segments matter only for surprise, caster timing and the weapon-vs-spell test | (a) Treat the initiative die as the segment in which the side acts for everything; (b) use weapon speed for every attack in order. Both go beyond p.62, which says speed and dexterity are not used in the minute round except as noted |
| A3 | What the initiative die means | DMG p.65-67 | Only when a caster is involved: it is the segment at which attacks on casters arrive and the number subtracted from weapon speed | Segment number for all attacks |
| A4 | Order inside a side's phase | DMG p.63-64 | Not specified: all that side's actions are simultaneous with damage applied as it occurs; the GM chooses order (offer a drag-order list) | Fixed order: missiles and magic, then closing, then melee (A to H) |
| A5 | Multiple routines in initiative | DMG p.63; PHB p.104-105 | As printed: FIRST and LAST for two routines; for three or more, "extrapolate" and roll for the first mid-point. PHB says a multi-attacker strikes once before opponents who cannot, "regardless of initiative", but fighter against fighter uses initiative | Strict initiative then second routine at the end; haste as first-and-last for the hasted side only |
| A6 | Haste or slow vs initiative | PHB p.104-105 | "Initiative will always go to the non-slowed or hasted side": read as: a hasted side beats a slowed side, and a side with hasted or non-slowed members beats the other. Prompt the GM when mixed; display only | Roll as normal and use A5 for the extra routine |
| A7 | Weapon speed use | DMG p.62, p.66, p.71 | Only on ties (I07), against casters (I08), and in single combats where the DM chooses (PHB p.105). Not for every blow | Compare speed factors every round (not RAW) |
| A8 | Moving and attacking | DMG p.66; PHB p.102 | Closing at base speed means no melee this round; a charge gives melee. There is no "move half and attack". Missiles after moving are not restricted by the pages read | Bar missiles after full movement; allow a short step (for example 1" or 10 ft) and still attack. Offer a threshold setting |
| A9 | Outdoor combat scale | DMG p.66; PHB p.39, p.102 | Closing and charge distances are tens of yards outdoors (DMG p.66); ranges are yards (PHB p.39). PHB p.102 says outdoor encounters move as in the dungeon | Feet everywhere in combat |
| A10 | Charge details | DMG p.66 | (1) AC: lose the DEX bonus; those with none go 1 worse. (2) "Encumbered" means the last PHB p.101 band (3" to 4" over 105#); heavy and very heavy gear can charge. (3) One charge per turn: next charge allowed from the round that is 10 later (9 full rounds between). (4) Equal weapon length at the end of a charge: no rule; show both orders and ask. (5) The +2 applies whenever the charger is not struck down first, including when it strikes first. (6) No minimum charge distance is given; none enforced. (7) A defender can also charge in its reaction phase | (2) any armour or load above normal gear; (3) once per fixed 10-round turn; (4) the lower weapon speed first, or simultaneous; (5) the +2 only when the foe struck first; (1) loses the bonus and also goes 1 worse |
| A11 | Death at zero | PHB p.105; DMG p.82 | Two books differ. DMG p.82 (the DM book) gives unconscious at 0, -1 per round to -10, with an optional -3 from the same blow. PHB p.105 says dead at 0 or less. Setting `cm.death-mode` per campaign; recommend DMG p.82 as the default because it is the more detailed procedure and the PHB sentence also mentions "certain magical means" only for regeneration | PHB: dead at 0; DMG with the -3 option on |
| A12 | Flank and rear without facing | DMG p.69-70; PHB p.105 | Books give diagrams, not facing rules. Manual switches by default; the angle mapping in section 6 is an optional aid, not RAW | Always manual; or count the nth attacker as flank by the shield cap only |
| A13 | Prone | DMG p.67, p.70 | The +4 and rear treatment apply while prone. No book rule for how long standing takes or what it costs | Standing costs the move; standing costs the action |
| A14 | Morale details | DMG p.67; PHB p.106 | Triggers are per party and per creature; "eliminated" counts slain, unconscious, fled and surrendered; each enemy slain or friend killed counts since the unit's last check; "faced by superior force" is checked every round; other thresholds once when crossed. Count modifiers on the roll as `checkMorale` does | "Eliminated" only slain; counts over the whole fight; re-check every round while a threshold holds |
| A15 | Break off and flee | DMG p.63, p.70; PHB p.104-105 | DMG p.63 says fleeing is never possible when the foe is in striking range, p.70 says a creature can break off at the cost of a free attack. Use p.70: one attack or routine by each opponent in contact | No break-off in striking range at all; each engaged opponent gets its full routine |
| A16 | Parry | PHB p.104-105; DMG p.70 | Subtract the parrier's Strength to-hit bonus from the foe's roll (so a Strength 16 or less character gets nothing). DMG p.70 says AC, not the die roll, should carry adjustments: apply as a bonus to the parrier's AC if the toggle `cm.parry-as-ac` is on | Parry gives a fixed AC bonus (not RAW) |
| A17 | Surprise timing | DMG p.61-62, p.71; PHB p.103 | Surprise segments are extra 6-second steps (round 0) before round 1, then initiative. "10 ft or less can usually be closed in 1 segment" is applied as: allowed if the gap is 10 ft or less, else by R ft per segment, double indoors for a charge | The surprise segments are the first part of round 1 |
| A18 | Missile rate and initiative | PHB p.38; DMG p.62-64 | Rate is per round (1, 2, 1/2, 3 per PHB p.38); initiative decides which side fires first. A rate of 2 is treated as one routine of two shots (not first and last). Surprise triples it | Treat rate 2 as two routines (I05) |
| A19 | Spell completion segment | DMG p.65-67; PHB p.40ff | Spell is begun when its side acts and completes casting-time segments later; the DMG sword and fireball example fixes the comparison. Spells measured in rounds or turns span rounds and are lost if interrupted | Spell always resolves at the end of the side's phase |
| A20 | Measuring diagonals and footprints | DMG p.69 | Chebyshev (matches the eight neighbours); edge to edge | 5-10-5 diagonals; straight-line distance |
| A21 | Size and AC | PHB p.105 | The PHB gives a dwarf versus giant example only (+4); no general table. Display only, GM adds a modifier | None |
| A22 | Mounted combat | PHB p.37-38; DMG p.66 | No procedure. Only the lance doubling, dismount weapons and the quadruped charge rate exist. A mounted token is treated as one token on the mount's movement | Mount and rider as two linked tokens with the rider using the mount's rate |
| A23 | Ties with weapons | DMG p.63, p.66 | Tied initiative: blows are simultaneous, except when both use weapons: lower speed first. Weaponless vs weaponless stays simultaneous | Always simultaneous |
| A24 | Spell versus saved attack | DMG p.65, p.70 | A spell hit "not saved against" interrupts; a save made means no interruption. The save is made when the attack is resolved | Any spell attack interrupts |

### 7.1 Rulings (TB, 2026-11-13)

TB took every recommended reading above, unless Gygax's own forum answers clarified it. Search (EN World "Q&A with Gary Gygax", Dragonsfoot Q&A threads, 13 Nov 2026) found:

- **A1 surprise: text.** Gygax confirmed the difference reading ("Your understanding is correct", EN World Q&A post #2,013, 3 Mar 2004). With the text, both examples and PHB p.103, that settles it. Encounter Roller now matches Combat Calc.
- **A23 ties, refined.** Same post: where initiative is tied, the longer weapon strikes first in the initial round (matches DMG p.66, longer reach first when closing). He adds his group seldom used the weapon speed comparison, which is still correct as printed. So: tie in the round melee is joined, longer weapon first; later rounds, lower speed factor first (I07). He also notes a lance does not automatically beat a spear or pole arm of 8 ft or less on a charge.
- **A10 charge.** A Gygax answer quoted on Dragonsfoot allows two attacks after a short charge and one after a long one. It's a reported table ruling, not book text, and the primary post wasn't found. Not in the defaults; it could become an optional toggle later.
- **A11, A12 and the rest:** no Gygax answer found. Recommended readings stand.

## 8. Data model

Goal: small, rebuilt from rules rather than stored. Owlbear metadata is limited to 16 kB per object (room, scene, item) per the studio notes (docs.owlbear.rodeo returned 403; confirm in a real room). Keep a 14 kB ceiling per object. Namespace stays `io.github.solid-state-games.1e-toolkit` (never change it); new keys sit under it.

### 8.1 Where each piece lives

| Data | Stored in | Why |
|---|---|---|
| Combat state, options, sides, roster, current round | Scene metadata, key `.../combat` | one combat per scene (TB uses a separate combat scene); everyone can read it |
| Log (history) | Scene metadata, keys `.../log/<round>` (one per round) | append rewrites only the current round's key; old keys are summarised and deleted |
| Per-token combat state | Item metadata on each combatant, key `.../cs` | travels with the token; written by the GM only; read by all |
| Sheet (PCs) | Existing `.../sheet` key on the token | unchanged; combat mode reads `hp`, `hm`, weapons, move, saves, loyalty, and writes `hp` only through the GM panel |
| Monster hp and stats | `.../cs` on the monster token (`h`, `hd`) | monsters have no sheet; stats looked up from the MM by name |
| Toggles | In `combat` as an integer bit mask plus a small object for scale and mode | 32 toggles in 4 bytes |
| Roll window messages | Same log entries (everyone reads scene metadata and refreshes on change) | no separate channel |
| Archive | Exported as a text file when the GM ends combat; not kept in the room | keeps metadata small |

The GM panel needs `OBR.player.getRole() == GM` to write. Players may roll their own attacks into a pending slot (see 8.5); the GM tab commits it.

### 8.2 `combat` (scene, about 2 to 3 kB with a 40-token roster)

```
{ v:1, on:1,                 // version, combat active
  rd:3, ph:2, sg:0,          // round (0 = surprise), phase 0 declare 1 init 2 first side 3 second side 4 end, surprise segment
  sc:{u:10, m:'i', ft:10},   // unit (feet per inch), mode i/o, feet per grid square (from the scene or GM)
  op: 0x...,                 // toggle bit mask (section 2)
  dm:'dmg',                  // death mode
  sd:[ {n:'Party', ra:2, sr:4, sl:0, in:5}, {n:'Goblins', ra:2, sr:1, sl:1, in:3} ],
                             // per side: name, surprise range, surprise roll, segments lost, initiative d6 this round
  w:0,                       // index of the side with initiative this round, 2 for tie
  ro:['id1','id2',...],      // roster: token ids once; everything else uses the index
  un:[ {s:0,n:'Retainers',n0:6,l:3} ],   // morale units: side, name, starting size, leader roster index
  k:[...]                    // pending morale cards
}
```
Token ids are 36-character UUIDs, so they appear only in `ro`; elsewhere a roster index of 1 to 2 digits is used (saves about 35 bytes per mention).

### 8.3 `log/<round>` (scene)
One key per round: `[[seg,kind,actor,target,roll,need,dmg,hpBefore,flags,text?], ...]`, about 20 to 30 bytes per entry; 40 entries per round is about 1 kB. Kinds: 0 initiative, 1 surprise, 2 attack, 3 damage, 4 save, 5 morale, 6 move or charge, 7 spell, 8 condition, 9 undo. `hpBefore` makes GM undo exact: undo restores the target's previous hit points from the last matching entry and appends an undo entry (nothing is deleted from history). Keep the last 6 rounds in detail; older rounds fold into one summary line `[round, initiative winner, kills A, kills B, hp lost A, hp lost B]` (about 25 bytes) in `log/s`. Keep the last 6 rounds in detail (about 7 kB at 1.2 kB each) and at most the last 100 summary lines (2.5 kB); with `combat` at about 3 kB the scene stays near 12.5 kB. If it passes 13 kB, fold more rounds early.

### 8.4 `cs` (token, about 60 to 140 bytes)
```
{ s:0,           // side index
  u:0,           // morale unit index (-1 none)
  L:0,           // leader flag
  c:0,           // condition bits: 1 prone 2 stunned 4 held 8 asleep 16 slowed 32 hasted 64 unconscious 128 dead 256 fled 512 surrendered 1024 invisible 2048 helpless-bound
  m:0,           // morale status 0 to 4
  sg:0,          // surprise segments left, individual (after DEX)
  rs:3,          // round stamp: per-round fields below are valid only if rs equals the current round
  p:[x,y],       // position at start of the round, grid squares times 10 rounded
  mv:0,          // feet moved this round
  at:0,          // attack routines used this round
  ch:0,          // round of the last charge
  ct:[sp,seg,r], // casting: spell index, casting time in segments, round started (or 0)
  td:0,          // temporary (subdual) damage
  sh:0,          // attackers this round (shield cap)
  a:0,           // declared action code: 0 none 1 attack 2 parry 3 fall back 4 flee 5 set weapon 6 charge 7 cast 8 missile
  h:[hp,max],    // monsters only
  hd:'4+2', z:1, mr:90, fl:0   // monsters: hit dice, size 0 S 1 M 2 L, move in inches, flags (fearless, biped)
}
```
Lazy reset: per-round fields are not rewritten at round end; a reader treats them as 0 when `rs` is not the current round, which avoids a write to every token each round. The sheet keeps its own `hp` and `hm`; PCs do not duplicate them in `cs`.

### 8.5 Rolls and the shared window
Roll window: a popover listing the current round's log entries, updated by `OBR.scene.onMetadataChange`; every player sees attack rolls, needed numbers, damage and saves; hit points are shown only to the GM and the owner (UI level only, as decided). Dice: the studio decision is a setting, "Owlbear Dice tray" or "in-sheet". With the tray, the tool asks the player to roll in the tray and reads their `rodeo.owlbear.dice/roll` player metadata (the Dice extension has no API to start a roll); in-sheet rolls come from the toolkit's own roller. Hidden rolls write nothing in the tray and must use the in-sheet roller. Each roll carries a source flag so the log shows how it was made.

### 8.6 Attack pipeline (drag attacker onto target)
`onToolDragStart` gives the attacker token, `onToolDragEnd` gives the target by hit test at the drop point. Checks, in order, each behind its toggle, with a one-line reason and a GM override:
1. Both tokens in the roster, attacker not dead, unconscious or surrendered; target not fled (`cm.damage`).
2. Round phase: attacker's side acts now, or is simultaneous (`cm.phase-order`).
3. Surprise: attacker not inside its lost segments (`cm.surprise-bar`).
4. Declared action fits (attack, not cast or parry) (`cm.declare`).
5. Distance: melee within striking range or after a valid charge; missiles in range S, M or L, else out of range (`cm.move-bar`, `cm.range`).
6. Movement: `moved` within the budget, or charge rules met (`cm.move-budget`, `cm.charge`).
7. Attacks used this round below the allowance (3/2 pattern or surprise segment count) (`cm.multi-attack`).
8. Casting: attacker not mid-spell unless it is the interrupt (`cm.cast-still`).
9. Build the number: class and level matrix column against the defender's AC after removing shield, DEX, or both (flank, rear, prone, charge, caster, shield cap, cover), weapon adjustment vs the defender's armour type, to-hit bonuses (+2, +4, charge, range, invisible, two weapons, parry), per P and F rows.
10. Roll d20 (tray or in-sheet); hit if the roll is at least the number needed (no automatic hit on 20 and no automatic miss on 1, per the COMBAT_CALC interpretation); automatic hit for asleep or held.
11. Damage: dice from the weapon (PHB p.37) for the target's size, Strength bonus for melee, doubled die result when M08 applies, split temporary and real damage for subduing modes.
12. Apply to hit points (sheet `hp` or monster `h`), set conditions from the death mode, write the log entry with `hpBefore`, show the result in the shared window, and run morale detection (section 3).
13. Cancel any spell in progress for the target if the hit interrupts (C03).

## 9. Toggle list

All toggles are in the combat panel under "Restrictions", grouped as below. Each can be flipped mid-combat and is logged.
`cm.rounds`, `cm.declare`, `cm.surprise`, `cm.surprise-dex`, `cm.surprise-attacks`, `cm.surprise-bar`, `cm.initiative`, `cm.phase-order`, `cm.missile-dex-init`, `cm.haste-slow`, `cm.multi-attack`, `cm.multi-attack-order`, `cm.speed-factor`, `cm.caster-timing`, `cm.move-budget`, `cm.move-bar`, `cm.charge`, `cm.charge-ac`, `cm.charge-first`, `cm.charge-cooldown`, `cm.set-weapon`, `cm.break-off`, `cm.fall-back`, `cm.flee-pursuit`, `cm.range`, `cm.missile-str`, `cm.cover`, `cm.melee-fire`, `cm.flank`, `cm.rear`, `cm.prone`, `cm.states`, `cm.helpless`, `cm.invisible`, `cm.shield-cap`, `cm.opp-limit`, `cm.two-weapon`, `cm.parry`, `cm.parry-as-ac`, `cm.weaponless`, `cm.subdual`, `cm.cast-declare`, `cm.cast-time`, `cm.cast-interrupt`, `cm.cast-still`, `cm.cast-dex`, `cm.devices`, `cm.turning`, `cm.damage`, `cm.death-mode`, `cm.saves`, `cm.item-charges`, `cm.morale`, `cm.morale-alerts`, `cm.morale-loyalty`, `cm.morale-effects`, `cm.auto-facing`, `cm.scale`.
Defaults off: `cm.declare`, `cm.opp-limit`, `cm.auto-facing`, `cm.parry-as-ac`. Everything else defaults on (RAW), except `cm.death-mode` which is a choice (A11).

## 10. Verified and not checked

Verified against the page text this session: DMG p.61-73 in full (surprise, initiative, distance, parleying, missiles, spells in melee, undead turning, charge, set weapons, weapon speed, subduing, special to-hit, morale, pursuit, melee, flank and rear, breaking off, two weapons, monks, the worked melee example, pummel, grapple, overbear); DMG p.69 diagrams and PHB p.37-38 italics checked in the PDF; DMG p.36-37 (loyalty and combat situations), p.64 cover table, p.79 saves note, p.82 zero hit points, p.132-135 item charges; PHB p.39 time and distance, p.101-103 movement and surprise, p.104-105 initiative and combat, p.106 morale, p.11 Dexterity Table I, p.74-75 haste and slow, p.25 attacks per round (via the audited COMBAT_CALC). The COMBAT_CALC claim that the code follows the text on surprise was run: `surpriseSegments(1,2,2,2)` returns side B 1 segment, which the p.62 table row "1, 2: party surprised" contradicts.

Not checked: the saving throw matrix cells and the combat matrices (covered by COMBAT_CALC RAW_AUDIT); MM per-monster morale or surprise text beyond the berserker and p.76 examples seen (monster `fearless` and surprise ranges must be taken from MM entries when the monster data is wired in); psionic combat, aerial combat, siege machines, ship combat (DMG p.50-53 and later), and the Owlbear SDK behaviour in a real room (grid scale return shape, metadata limit, drag events) which needs a live test.
