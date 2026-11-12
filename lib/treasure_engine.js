// SHARED COPY of TREASURE_GENERATOR/treasure_engine.js: edit the master there, then run TOOLS/sync_lib.py
/* Treasure engine for AD&D 1st Edition (RAW). No DOM. Works in a browser (window.TreasureEngine) and node (module.exports).
 * Sources: MM p.5, p.105 (treasure types); DMG p.25-26 (gems, jewellery), p.120-125 (random treasure), p.165-168 (swords),
 * PHB p.40-42 (spell lists). Every table row is [maxRoll, name, ...]; a table covers 1..sides with no gaps. */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- dice
  // NdM, NdM+K, NdM-K, NdMxK (also * and the multiplication sign). Returns {total, rolls, spec}.
  const DICE_RX = /^\s*(\d*)\s*d\s*(\d+)\s*(?:([+\-x*×])\s*(\d+))?\s*$/i;
  function rollDice(spec, rng) {
    const m = DICE_RX.exec(String(spec));
    if (!m) throw new Error('Bad dice spec: ' + spec);
    const n = m[1] === '' ? 1 : parseInt(m[1], 10), sides = parseInt(m[2], 10), k = m[4] === undefined ? 0 : parseInt(m[4], 10);
    const r = rng || Math.random, rolls = [];
    let total = 0;
    for (let i = 0; i < n; i++) { const v = Math.floor(r() * sides) + 1; rolls.push(v); total += v; }
    if (m[3] === '+') total += k; else if (m[3] === '-') total -= k; else if (m[3]) total *= k;
    return { total, rolls, spec: String(spec).trim() };
  }
  // MM treasure ranges ("4-40") are the dice that give that range: 1-6 is d6, 4-40 is 4d10, 10-40 is 10d4.
  function rangeToDice(lo, hi) {
    if (lo === 1) return '1d' + hi;
    if (hi % lo !== 0) throw new Error('Range has no clean dice: ' + lo + '-' + hi);
    return lo + 'd' + (hi / lo);
  }

  // ---------------------------------------------------------------- data
  const TABLES = {
  // POTIONS (DMG p.121 III.A)
  potions: [
    [3, "Potion of Animal Control", 250, 400],
    [6, "Potion of Clairaudience", 250, 400],
    [9, "Potion of Clairvoyance", 300, 500],
    [12, "Potion of Climbing", 300, 500],
    [15, "Potion of Delusion", 0, 150],
    [18, "Potion of Diminution", 300, 500],
    [20, "Potion of Dragon Control", null, null, {"h": "dragonControl"}],
    [23, "Potion of ESP", 500, 850],
    [26, "Potion of Extra-Healing", 400, 800],
    [29, "Potion of Fire Resistance", 250, 400],
    [32, "Potion of Flying", 500, 750],
    [34, "Potion of Gaseous Form", 300, 400],
    [36, "Potion of Giant Control", null, null, {"h": "giantControl"}],
    [39, "Potion of Giant Strength", null, null, {"h": "giantStrength"}],
    [41, "Potion of Growth", 250, 300],
    [47, "Potion of Healing", 200, 400],
    [49, "Potion of Heroism", 300, 500],
    [51, "Potion of Human Control", 500, 900],
    [54, "Potion of Invisibility", 250, 500],
    [57, "Potion of Invulnerability", 350, 500],
    [60, "Potion of Levitation", 250, 400],
    [63, "Potion of Longevity", 500, 1000],
    [66, "Oil of Etherealness", 600, 1500],
    [69, "Oil of Slipperiness", 400, 750],
    [72, "Philter of Love", 200, 300],
    [75, "Philter of Persuasiveness", 400, 850],
    [78, "Potion of Plant Control", 250, 300],
    [81, "Potion of Polymorph (self)", 200, 350],
    [84, "Potion of Poison", 0, 0],
    [87, "Potion of Speed", 200, 450],
    [90, "Potion of Super-Heroism", 450, 750],
    [93, "Potion of Sweet Water", 200, 250],
    [96, "Potion of Treasure Finding", 600, 2000],
    [97, "Potion of Undead Control", 700, 2500],
    [100, "Potion of Water Breathing", 400, 900],
  ],
  // RINGS (DMG p.122 III.C)
  rings: [
    [6, "Ring of Contrariness", 0, 1000],
    [12, "Ring of Delusion", 0, 2000],
    [14, "Ring of Djinni Summoning", 3000, 20000],
    [15, "Ring of Elemental Command", 5000, 25000],
    [21, "Ring of Feather Falling", 1000, 5000],
    [27, "Ring of Fire Resistance", 1000, 5000],
    [30, "Ring of Free Action", 1000, 5000],
    [33, "Ring of Human Influence", 2000, 10000],
    [40, "Ring of Invisibility", 1500, 7500],
    [43, "Ring of Mammal Control", 1000, 5000],
    [44, "Ring of Multiple Wishes", 5000, 25000],
    [60, "Ring of Protection", null, null, {"h": "ringProtection"}],
    [61, "Ring of Regeneration", 5000, 40000],
    [63, "Ring of Shooting Stars", 3000, 15000],
    [65, "Ring of Spell Storing", 2500, 22500],
    [69, "Ring of Spell Turning", 2000, 17500],
    [75, "Ring of Swimming", 1000, 5000],
    [77, "Ring of Telekinesis", 2000, 10000],
    [79, "Ring of Three Wishes", 3000, 15000],
    [85, "Ring of Warmth", 1000, 5000],
    [90, "Ring of Water Walking", 1000, 5000],
    [98, "Ring of Weakness", 0, 1000],
    [99, "Ring of Wizardry", 4000, 50000],
    [100, "Ring of X-Ray Vision", 4000, 35000],
  ],
  // RODS, STAVES & WANDS (DMG p.122 III.D)
  rods: [
    [3, "Rod of Absorption", 7500, 40000],
    [4, "Rod of Beguiling", 5000, 30000],
    [14, "Rod of Cancellation", 10000, 15000],
    [16, "Rod of Lordly Might", 6000, 20000],
    [17, "Rod of Resurrection", 10000, 35000],
    [18, "Rod of Rulership", 8000, 35000],
    [19, "Rod of Smiting", 4000, 15000],
    [20, "Staff of Command", 5000, 25000],
    [22, "Staff of Curing", 6000, 25000],
    [23, "Staff of the Magi", 15000, 75000],
    [24, "Staff of Power", 12000, 60000],
    [27, "Staff of the Serpent", 7000, 35000],
    [31, "Staff of Striking", 6000, 15000],
    [33, "Staff of Withering", 8000, 35000],
    [34, "Wand of Conjuration", 7000, 35000],
    [38, "Wand of Enemy Detection", 2000, 10000],
    [41, "Wand of Fear", 3000, 15000],
    [44, "Wand of Fire", 4500, 25000],
    [47, "Wand of Frost", 6000, 50000],
    [52, "Wand of Illumination", 2000, 10000],
    [56, "Wand of Illusion", 3000, 20000],
    [59, "Wand of Lightning", 4000, 30000],
    [68, "Wand of Magic Detection", 2500, 25000],
    [73, "Wand of Metal & Mineral Detection", 1500, 7500],
    [78, "Wand of Magic Missiles", 4000, 35000],
    [86, "Wand of Negation", 3500, 15000],
    [89, "Wand of Paralyzation", 3500, 25000],
    [92, "Wand of Polymorphing", 3500, 25000],
    [94, "Wand of Secret Door & Trap Location", 5000, 40000],
    [100, "Wand of Wonder", 6000, 10000],
  ],
  // ARMOUR & SHIELDS (DMG p.124 III.F)
  armor: [
    [5, "Chain Mail +1", 600, 3500],
    [9, "Chain Mail +2", 1200, 7500],
    [11, "Chain Mail +3", 2000, 12500],
    [19, "Leather Armor +1", 300, 2000],
    [26, "Plate Mail +1", 800, 5000],
    [32, "Plate Mail +2", 1750, 10500],
    [35, "Plate Mail +3", 2750, 15500],
    [37, "Plate Mail +4", 3500, 20500],
    [38, "Plate Mail +5", 4500, 27500],
    [39, "Plate Mail of Etherealness", 5000, 30000],
    [44, "Plate Mail of Vulnerability", 0, 1500],
    [50, "Ring Mail +1", 400, 2500],
    [55, "Scale Mail +1", 500, 3000],
    [59, "Scale Mail +2", 1100, 6750],
    [63, "Splint Mail +1", 700, 4000],
    [66, "Splint Mail +2", 1500, 8500],
    [68, "Splint Mail +3", 2250, 14500],
    [69, "Splint Mail +4", 3000, 19000],
    [75, "Studded Leather +1", 400, 2500],
    [84, "Shield +1", 250, 2500],
    [89, "Shield +2", 500, 5000],
    [93, "Shield +3", 800, 8000],
    [95, "Shield +4", 1200, 12000],
    [96, "Shield +5", 1750, 17500],
    [97, "Shield, large, +1, +4 vs. missiles", 400, 4000],
    [100, "Shield -1, missile attractor", 0, 750],
  ],
  // SWORDS (DMG p.124 III.G)
  sword: [
    [25, "Sword +1", 400, 2000, {"plus": 1, "max": 1, "pw": 0}],
    [30, "Sword +1, +2 vs. magic-using & enchanted creatures", 600, 3000, {"plus": 1, "max": 2, "pw": 0}],
    [35, "Sword +1, +3 vs. lycanthropes & shape changers", 700, 3500, {"plus": 1, "max": 3, "pw": 0}],
    [40, "Sword +1, +3 vs. regenerating creatures", 800, 4000, {"plus": 1, "max": 3, "pw": 0}],
    [45, "Sword +1, +4 vs. reptiles", 800, 4000, {"plus": 1, "max": 4, "pw": 0}],
    [49, "Sword +1, Flame Tongue", 900, 4500, {"plus": 1, "max": 4, "pw": 0}],
    [50, "Sword +1, Luck Blade", 1000, 5000, {"plus": 1, "max": 1, "pw": 1}],
    [58, "Sword +2", 800, 4000, {"plus": 2, "max": 2, "pw": 0}],
    [62, "Sword +2, Giant Slayer", 900, 4500, {"plus": 2, "max": 3, "pw": 0}],
    [66, "Sword +2, Dragon Slayer", 900, 4500, {"plus": 2, "max": 4, "pw": 0}],
    [67, "Sword +2, Nine Lives Stealer", 1600, 8000, {"plus": 2, "max": 2, "pw": 1}],
    [71, "Sword +3", 1400, 7000, {"plus": 3, "max": 3, "pw": 0}],
    [74, "Sword +3, Frost Brand", 1600, 8000, {"plus": 3, "max": 6, "pw": 0}],
    [76, "Sword +4", 2000, 10000, {"plus": 4, "max": 4, "pw": 0}],
    [77, "Sword +4, Defender", 3000, 15000, {"plus": 4, "max": 4, "pw": 1}],
    [78, "Sword +5", 3000, 15000, {"plus": 5, "max": 5, "pw": 0}],
    [79, "Sword +5, Defender", 3600, 18000, {"plus": 5, "max": 5, "pw": 1}],
    [80, "Sword +5, Holy Avenger", 4000, 20000, {"plus": 5, "max": 5, "pw": 1, "al": "LG"}],
    [81, "Sword of Dancing", 4400, 22000, {"plus": 1, "max": 4, "pw": 1}],
    [82, "Sword of Wounding", 4400, 22000, {"plus": 1, "max": 1, "pw": 1}],
    [83, "Sword of Life Stealing", 5000, 25000, {"plus": 2, "max": 2, "pw": 1}],
    [84, "Sword of Sharpness", 7000, 35000, {"plus": 1, "max": 1, "pw": 1, "al": "C"}],
    [85, "Sword, Vorpal Weapon", 10000, 50000, {"plus": 3, "max": 3, "pw": 1, "al": "L"}],
    [90, "Sword +1, Cursed", 400, 0, {"plus": 1, "max": 1, "pw": 0, "cursed": 1}],
    [95, "Sword -2, Cursed", 600, 0, {"plus": 0, "max": 0, "pw": 0, "cursed": 1}],
    [100, "Sword, Cursed Berserking", 900, 0, {"plus": 2, "max": 2, "pw": 0, "cursed": 1}],
  ],
  // MISC MAGIC 1 (DMG p.122)
  m1: [
    [2, "Alchemy Jug", 3000, 12000],
    [4, "Amulet of Inescapable Location", 0, 1000],
    [5, "Amulet of Life Protection", 5000, 20000],
    [7, "Amulet of the Planes", 6000, 30000],
    [11, "Amulet of Proof Against Detection and Location", 4000, 15000],
    [13, "Apparatus of Kwalish", 8000, 35000],
    [16, "Arrow of Direction", 2500, 17500],
    [17, "Artifact or Relic", null, null, {"h": "special"}],
    [20, "Bag of Beans", 1000, 5000],
    [21, "Bag of Devouring", 0, 1500],
    [26, "Bag of Holding", 5000, 25000],
    [27, "Bag of Transmuting", 0, 500],
    [29, "Bag of Tricks", 2500, 15000],
    [31, "Beaker of Plentiful Potions", 1500, 12500],
    [32, "Boat, Folding", 10000, 25000],
    [33, "Book of Exalted Deeds", 8000, 40000],
    [34, "Book of Infinite Spells", 9000, 50000],
    [35, "Book of Vile Darkness", 8000, 40000],
    [36, "Boots of Dancing", 0, 5000],
    [42, "Boots of Elvenkind", 1000, 5000],
    [47, "Boots of Levitation", 2000, 15000],
    [51, "Boots of Speed", 2500, 20000],
    [55, "Boots of Striding and Springing", 2500, 20000],
    [58, "Bowl Commanding Water Elementals", 4000, 25000],
    [59, "Bowl of Watery Death", 0, 1000],
    [79, "Bracers of Defense", null, null, {"h": "bracers"}],
    [81, "Bracers of Defenselessness", 0, 2000],
    [84, "Brazier Commanding Fire Elementals", 4000, 25000],
    [85, "Brazier of Sleep Smoke", 0, 1000],
    [92, "Brooch of Shielding", 1000, 10000],
    [93, "Broom of Animated Attack", 0, 3000],
    [98, "Broom of Flying", 2000, 10000],
    [100, "Bucknard’s Everfull Purse", null, null, {"h": "bucknard"}],
  ],
  // MISC MAGIC 2 (DMG p.122-123)
  m2: [
    [6, "Candle of Invocation", 1000, 5000],
    [8, "Carpet of Flying", 7500, 25000],
    [10, "Censer Controlling Air Elementals", 4000, 25000],
    [11, "Censer of Summoning Hostile Air Elementals", 0, 1000],
    [13, "Chime of Opening", 3500, 20000],
    [14, "Chime of Hunger", 0, 0],
    [18, "Cloak of Displacement", 3000, 17500],
    [27, "Cloak of Elvenkind", 1000, 6000],
    [30, "Cloak of Manta Ray", 2000, 12500],
    [32, "Cloak of Poisonousness", 0, 2500],
    [55, "Cloak of Protection", null, null, {"h": "cloakProtection"}],
    [60, "Crystal Ball", 1000, 5000, {"note": "Add 100% of the value for each additional feature (DMG p.123)"}],
    [61, "Crystal Hypnosis Ball", 0, 3000],
    [63, "Cube of Force", 3000, 20000],
    [65, "Cube of Frost Resistance", 2000, 14000],
    [67, "Cubic Gate", 5000, 17500],
    [69, "Daern’s Instant Fortress", 7000, 27500],
    [72, "Decanter of Endless Water", 1000, 3000],
    [76, "Deck of Many Things", 0, 10000],
    [77, "Drums of Deafening", 0, 500],
    [79, "Drums of Panic", 6500, 35000],
    [85, "Dust of Appearance", 1000, 4000],
    [91, "Dust of Disappearance", 2000, 8000],
    [92, "Dust of Sneezing and Choking", 0, 1000],
    [93, "Efreeti Bottle", 9000, 45000],
    [94, "Eversmoking Bottle", 500, 2500],
    [95, "Eyes of Charming", 4000, 24000],
    [97, "Eyes of the Eagle", 3500, 18000],
    [99, "Eyes of Minute Seeing", 2000, 12500],
    [100, "Eyes of Petrification", 0, 0],
  ],
  // MISC MAGIC 3 (DMG p.123)
  m3: [
    [15, "Figurine of Wondrous Power", null, null, {"unit": "per hit die of the figurine", "xp": 100, "gp": 1000}],
    [16, "Flask of Curses", 0, 1000],
    [18, "Gauntlets of Dexterity", 1000, 10000],
    [20, "Gauntlets of Fumbling", 0, 1000],
    [22, "Gauntlets of Ogre Power", 1000, 15000],
    [25, "Gauntlets of Swimming and Climbing", 1000, 10000],
    [26, "Gem of Brightness", 2000, 17500],
    [27, "Gem of Seeing", 2000, 25000],
    [28, "Girdle of Femininity/Masculinity", 0, 1000],
    [29, "Girdle of Giant Strength", 200, 2500],
    [30, "Helm of Brilliance", 2500, 60000],
    [35, "Helm of Comprehending Languages & Reading Magic", 1000, 12500],
    [37, "Helm of Opposite Alignment", 0, 1000],
    [39, "Helm of Telepathy", 3000, 35000],
    [40, "Helm of Teleportation", 2500, 30000],
    [45, "Helm of Underwater Action", 1000, 10000],
    [46, "Horn of Blasting", 5000, 55000],
    [48, "Horn of Bubbles", 0, 0],
    [49, "Horn of Collapsing", 1500, 25000],
    [53, "Horn of the Tritons", 2000, 17500],
    [60, "Horn of Valhalla", null, null, {"h": "horn"}],
    [63, "Horseshoes of Speed", 2000, 10000],
    [65, "Horseshoes of a Zephyr", 1500, 7500],
    [70, "Incense of Meditation", 500, 7500],
    [71, "Incense of Obsession", 0, 500],
    [72, "Ioun Stones", null, null, {"h": "ioun"}],
    [78, "Instrument of the Bards", null, null, {"unit": "per level of instrument for bards", "xp": 1000, "gp": 5000}],
    [80, "Iron Flask", 0, 0],
    [85, "Javelin of Lightning", 250, 3000],
    [90, "Javelin of Piercing", 250, 3000],
    [91, "Jewel of Attacks", 0, 1000],
    [92, "Jewel of Flawlessness", null, null, {"unit": "1,000 g.p. per facet", "xp": 0, "gp": 1000}],
    [100, "Keoghtom’s Ointment", 500, 10000],
  ],
  // MISC MAGIC 4 (DMG p.123)
  m4: [
    [1, "Libram of Gainful Conjuration", 8000, 40000],
    [2, "Libram of Ineffable Damnation", 8000, 40000],
    [3, "Libram of Silver Magic", 8000, 40000],
    [4, "Lyre of Building", 5000, 30000],
    [5, "Manual of Bodily Health", 5000, 50000],
    [6, "Manual of Gainful Exercise", 5000, 50000],
    [7, "Manual of Golems", 3000, 30000],
    [8, "Manual of Puissant Skill at Arms", 8000, 40000],
    [9, "Manual of Quickness of Action", 5000, 50000],
    [10, "Manual of Stealthy Pilfering", 8000, 40000],
    [11, "Mattock of the Titans", 3500, 7000],
    [12, "Maul of the Titans", 4000, 12000],
    [15, "Medallion of ESP", null, null, {"h": "medallion"}],
    [17, "Medallion of Thought Projection", 0, 1000],
    [18, "Mirror of Life Trapping", 2500, 25000],
    [19, "Mirror of Mental Prowess", 5000, 50000],
    [20, "Mirror of Opposition", 0, 2000],
    [23, "Necklace of Adaptation", 1000, 10000],
    [27, "Necklace of Missiles", null, null, {"unit": "per hit die of each missile", "xp": 50, "gp": 200}],
    [33, "Necklace of Prayer Beads", null, null, {"unit": "per special bead", "xp": 500, "gp": 3000}],
    [35, "Necklace of Strangulation", 0, 1000],
    [38, "Net of Entrapment", 1000, 7500],
    [42, "Net of Snaring", 1000, 6000],
    [44, "Nolzurs’ Marvelous Pigments", null, null, {"unit": "per pot of pigments", "xp": 500, "gp": 3000}],
    [46, "Pearl of Power", null, null, {"unit": "per level of spell", "xp": 200, "gp": 2000}],
    [48, "Pearl of Wisdom", 500, 5000],
    [50, "Periapt of Foul Rotting", 0, 1000],
    [53, "Periapt of Health", 1000, 10000],
    [60, "Periapt of Proof Against Poison", 1500, 12500],
    [64, "Periapt of Wound Closure", 1000, 10000],
    [70, "Phylactery of Faithfulness", 1000, 7500],
    [74, "Phylactery of Long Years", 3000, 25000],
    [76, "Phylactery of Monstrous Attention", 0, 2000],
    [84, "Pipes of the Sewers", 1750, 8500],
    [85, "Portable Hole", 5000, 50000],
    [100, "Quaal’s Feather Token", null, null, {"h": "quaal"}],
  ],
  // MISC MAGIC 5 (DMG p.124)
  m5: [
    [1, "Robe of the Archmagi", 6000, 65000],
    [8, "Robe of Blending", 3500, 35000],
    [9, "Robe of Eyes", 4500, 50000],
    [10, "Robe of Powerlessness", 0, 1000],
    [11, "Robe of Scintillating Colors", 2750, 25000],
    [19, "Robe of Useful Items", 1500, 15000],
    [25, "Rope of Climbing", 1000, 10000],
    [27, "Rope of Constriction", 0, 1000],
    [31, "Rope of Entanglement", 1250, 12000],
    [32, "Rug of Smothering", 0, 1500],
    [33, "Rug of Welcome", 6500, 45000],
    [34, "Saw of Mighty Cutting", 1750, 12500],
    [35, "Scarab of Death", 0, 2500],
    [38, "Scarab of Enraging Enemies", 1000, 8000],
    [40, "Scarab of Insanity", 1500, 11000],
    [46, "Scarab of Protection", 2500, 25000],
    [47, "Spade of Colossal Excavation", 1000, 6500],
    [48, "Sphere of Annihilation", 3750, 30000],
    [50, "Stone of Controlling Earth Elementals", 1500, 12500],
    [52, "Stone of Good Luck (Luckstone)", 3000, 25000],
    [54, "Stone of Weight (Loadstone)", 0, 1000],
    [57, "Talisman of Pure Good", 3500, 27500],
    [58, "Talisman of the Sphere", 100, 10000],
    [60, "Talisman of Ultimate Evil", 3500, 32500],
    [66, "Talisman of Zagy", 1000, 10000],
    [67, "Tome of Clear Thought", 8000, 48000],
    [68, "Tome of Leadership and Influence", 7500, 40000],
    [69, "Tome of Understanding", 8000, 43500],
    [76, "Trident of Fish Command", 500, 4000],
    [78, "Trident of Submission", 1250, 12500],
    [83, "Trident of Warning", 1000, 10000],
    [85, "Trident of Yearning", 0, 1000],
    [87, "Vacuous Grimoire", 0, 1000],
    [90, "Well of Many Worlds", 6000, 12000],
    [100, "Wings of Flying", 750, 7500],
  ],
  // MISC WEAPONS (DMG p.125 III.H); last column is the number-in-bundle range, or null
  weapons: [
    [8, "Arrow +1", 20, 120, "2-24"],
    [12, "Arrow +2", 50, 300, "2-16"],
    [14, "Arrow +3", 75, 450, "2-12"],
    [15, "Arrow of Slaying", 250, 2500, null],
    [20, "Axe +1", 300, 1750, null],
    [22, "Axe +2", 600, 3750, null],
    [23, "Axe +2, Throwing", 750, 4500, null],
    [24, "Axe +3", 1000, 7000, null],
    [27, "Battle Axe +1", 400, 2500, null],
    [32, "Bolt +2", 50, 300, "2-20"],
    [35, "Bow +1", 500, 3500, null],
    [36, "Crossbow of Accuracy, +3", 2000, 12000, null],
    [37, "Crossbow of Distance", 1500, 7500, null],
    [38, "Crossbow of Speed", 1500, 7500, null],
    [46, "Dagger +1, +2 vs. creatures smaller than man-sized", 100, 750, null],
    [50, "Dagger +2, +3 vs. creatures larger than man-sized", 250, 2000, null],
    [51, "Dagger of Venom", 350, 3000, null],
    [56, "Flail +1", 450, 4000, null],
    [60, "Hammer +2", 300, 2500, null],
    [62, "Hammer +3", 650, 6000, null],
    [63, "Hammer +3, Dwarven Thrower", 1500, 15000, null],
    [64, "Hammer of Thunderbolts", 2500, 25000, null],
    [67, "Javelin +2", 750, 5000, null],
    [72, "Mace +1", 350, 3000, null],
    [75, "Mace +2", 700, 4500, null],
    [76, "Mace of Disruption", 1750, 17500, null],
    [77, "Mace +4", 1500, 15000, null],
    [80, "Military Pick +1", 350, 2500, null],
    [83, "Morning Star +1", 400, 3000, null],
    [88, "Scimitar +2", 750, 6000, null],
    [89, "Sling of Seeking +2", 700, 7000, null],
    [94, "Spear +1", 500, 3000, null],
    [96, "Spear +2", 1000, 6500, null],
    [97, "Spear +3", 1750, 15000, null],
    [99, "Spear, Cursed Backbiter", 0, 1000, null],
    [100, "Trident (Military Fork) +3", 1500, 12500, null],
  ],
  // SPECIAL: artifacts and relics (DMG p.124); sale value only, no x.p.
  special: [
    [1, "Axe of the Dwarvish Lords", 0, 55000],
    [2, "Baba Yaga\u2019s Hut", 0, 90000],
    [4, "Codex of the Infinite Planes", 0, 62500],
    [20, "Crown of Might", 0, 50000],
    [21, "Crystal of the Ebon Flame", 0, 75000],
    [22, "Cup and Talisman of Al\u2019Akbar", 0, 85000],
    [24, "Eye of Vecna", 0, 35000],
    [25, "Hand of Vecna", 0, 60000],
    [26, "Heward\u2019s Mystical Organ", 0, 25000],
    [27, "Horn of Change", 0, 20000],
    [29, "Invulnerable Coat of Arnd", 0, 47500],
    [31, "Iron Flask of Tuerny the Merciless", 0, 50000],
    [32, "Jacinth of Inestimable Beauty", 0, 100000],
    [33, "Johydee\u2019s Mask", 0, 40000],
    [35, "Kuroth\u2019s Quill", 0, 27500],
    [37, "Mace of Cuthbert", 0, 35000],
    [38, "Machine of Lum the Mad", 0, 72500],
    [40, "Mighty Servant of Leuk-O", 0, 185000],
    [47, "Orb of the Dragonkind", 0, 0, {"h": "dragonkind"}],
    [63, "Orb of Might", 0, 100000],
    [64, "Queen Ehlissa\u2019s Marvelous Nightingale", 0, 112500],
    [66, "Recorder of Ye\u2019Cind", 0, 80000],
    [68, "Ring of Gaxx", 0, 17500],
    [74, "Rod of Seven Parts", 0, 25000],
    [91, "Sceptre of Might", 0, 150000],
    [92, "Sword of Kas", 0, 97000],
    [98, "Teeth of Dahlver-Nar", 0, 5000, {"unit": "5,000 g.p. per tooth"}],
    [99, "Throne of the Gods", 0, 0],
    [100, "Wand of Orcus", 0, 10000],
  ]
  };

  // MM p.105 treasure types. coin/gem/jewellery: [min, max, chance%]. Coins A-I,O-R,W,Y,Z are in 1,000s (platinum 100s).
  const TYPES = {
    A: { cp: [1, 6, 25], sp: [1, 6, 30], ep: [1, 6, 35], gp: [1, 10, 40], pp: [1, 4, 25], gems: [4, 40, 60], jew: [3, 30, 50], mm: { chance: 30, parts: [{ mom: 3 }] } },
    B: { cp: [1, 8, 50], sp: [1, 6, 25], ep: [1, 4, 25], gp: [1, 3, 25], gems: [1, 8, 30], jew: [1, 4, 20], mm: { chance: 10, parts: [{ only: ['armour', 'sword', 'weapon'], n: 1 }] } },
    C: { cp: [1, 12, 20], sp: [1, 6, 30], ep: [1, 4, 10], gems: [1, 6, 25], jew: [1, 3, 20], mm: { chance: 10, parts: [{ mom: 2 }] } },
    D: { cp: [1, 8, 10], sp: [1, 12, 15], ep: [1, 8, 15], gp: [1, 6, 50], gems: [1, 10, 30], jew: [1, 6, 25], mm: { chance: 15, parts: [{ mom: 2 }, { only: ['potion'], n: 1 }] } },
    E: { cp: [1, 10, 5], sp: [1, 12, 25], ep: [1, 6, 25], gp: [1, 8, 25], gems: [1, 12, 15], jew: [1, 8, 10], mm: { chance: 25, parts: [{ mom: 3 }, { only: ['scroll'], n: 1 }] } },
    F: { sp: [1, 20, 10], ep: [1, 12, 15], gp: [1, 10, 40], pp: [1, 8, 35], gems: [3, 30, 20], jew: [1, 10, 10], mm: { chance: 30, parts: [{ mom: 3, exclude: ['sword', 'weapon'] }, { only: ['potion'], n: 1 }, { only: ['scroll'], n: 1 }] } },
    G: { gp: [10, 40, 50], pp: [1, 20, 50], gems: [5, 20, 30], jew: [1, 10, 25], mm: { chance: 35, parts: [{ mom: 4 }, { only: ['scroll'], n: 1 }] } },
    H: { cp: [5, 30, 25], sp: [1, 100, 40], ep: [10, 40, 40], gp: [10, 60, 55], pp: [5, 50, 25], gems: [1, 100, 50], jew: [10, 40, 50], mm: { chance: 15, parts: [{ mom: 4 }, { only: ['potion'], n: 1 }, { only: ['scroll'], n: 1 }] } },
    I: { pp: [3, 18, 30], gems: [2, 20, 55], jew: [1, 12, 50], mm: { chance: 15, parts: [{ mom: 1 }] } },
    J: { cp: [3, 24], ind: 1 }, K: { sp: [3, 18], ind: 1 }, L: { ep: [2, 12], ind: 1 }, M: { gp: [2, 8], ind: 1 }, N: { pp: [1, 6], ind: 1 },
    O: { cp: [1, 4, 25], sp: [1, 3, 20] },
    P: { sp: [1, 6, 30], ep: [1, 2, 25] },
    Q: { gems: [1, 4, 50] },
    R: { gp: [2, 8, 40], pp: [10, 60, 50], gems: [4, 32, 55], jew: [1, 12, 45] },
    S: { mm: { chance: 40, parts: [{ only: ['potion'], n: [2, 8] }] } },
    T: { mm: { chance: 50, parts: [{ only: ['scroll'], n: [1, 4] }] } },
    U: { gems: [10, 80, 90], jew: [5, 30, 80], mm: { chance: 70, parts: [{ each: 1 }] } },
    V: { mm: { chance: 85, parts: [{ each: 2 }] } },
    W: { gp: [5, 30, 60], pp: [1, 8, 15], gems: [10, 80, 60], jew: [5, 40, 50], mm: { chance: 55, parts: [{ map: 1 }] } },
    X: { mm: { chance: 60, parts: [{ only: ['misc'], n: 1 }, { only: ['potion'], n: 1 }] } },
    Y: { gp: [2, 12, 70] },
    Z: { cp: [1, 3, 20], sp: [1, 4, 25], ep: [1, 4, 25], gp: [1, 4, 30], pp: [1, 6, 30], gems: [10, 60, 55], jew: [5, 30, 50], mm: { chance: 50, parts: [{ magic: 3 }] } }
  };
  const COIN_KEYS = ['cp', 'sp', 'ep', 'gp', 'pp'];
  const COIN_NAME = { cp: 'copper', sp: 'silver', ep: 'electrum', gp: 'gold', pp: 'platinum' };
  const COIN_GP = { cp: 1 / 200, sp: 1 / 20, ep: 1 / 2, gp: 1, pp: 5 }; // PHB p.35
  const COIN_UNIT = { cp: 1000, sp: 1000, ep: 1000, gp: 1000, pp: 100 }; // MM p.105 column heads

  // DMG p.121 III: magic item category by d100.
  const MAGIC_CAT = [[20, 'potion'], [35, 'scroll'], [40, 'ring'], [45, 'rod'], [48, 'misc', 'm1'], [51, 'misc', 'm2'], [54, 'misc', 'm3'], [57, 'misc', 'm4'], [60, 'misc', 'm5'], [75, 'armour'], [86, 'sword'], [100, 'weapon']];
  const CAT_LABEL = { potion: 'Potions', scroll: 'Scrolls', ring: 'Rings', rod: 'Rods, Staves & Wands', misc: 'Miscellaneous Magic', special: 'Artifacts & Relics', armour: 'Armour & Shields', sword: 'Swords', weapon: 'Miscellaneous Weapons' };
  const CAT_ORDER = ['Potions', 'Scrolls', 'Rings', 'Rods, Staves & Wands', 'Miscellaneous Magic', 'Artifacts & Relics', 'Armour & Shields', 'Swords', 'Miscellaneous Weapons'];

  // DMG p.120
  const MAP_TYPE = [[5, 'false', 'False map'], [70, 'monetary', 'Map to monetary treasure'], [90, 'magic', 'Map to magic treasure'], [100, 'hoard', 'Map to a combined hoard']];
  const MAP_LOC = [[20, 'labyrinth of caves found in the lair'], [60, 'outdoors, 5-8 miles distant', '1d4+4'], [90, 'outdoors, 10-40 miles distant', '1d4x10'], [100, 'outdoors, 50-500 miles distant', '1d10x50']];
  const MAP_SIT = [[10, 'buried and unguarded'], [20, 'hidden in water'], [70, 'guarded in a lair'], [80, 'somewhere in a ruins'], [90, 'in a burial crypt'], [100, 'secreted in a town']];
  const DIRECTIONS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  // d20 rows: [max, key]; II.A monetary, II.B magic
  const MONETARY_ROWS = [[2, '1-2'], [5, '3-5'], [10, '6-10'], [12, '11-12'], [15, '13-15'], [17, '16-17'], [18, 'twice'], [19, 'thrice'], [20, 'all']];
  const MAGIC_ROWS = [[5, '1-5'], [8, '6-8'], [12, '9-12'], [14, '13-14'], [18, '15-18'], [19, '19'], [20, '20']];
  const COMBINED = [ // DMG p.120 II.C
    [20, { mon: ['1-2'], mag: ['1-5'] }], [40, { mon: ['6-10'], mag: ['1-5'] }],
    [55, { mon: ['3-5', '6-10'], mag: ['1-5', '15-18'] }], [65, { mon: ['1-2', '3-5', '6-10'], mag: ['9-12', '13-14'] }],
    [75, { mon: ['6-10', '11-12'], mag: ['6-8', '15-18'] }], [80, { mon: ['3-5', '6-10', '11-12', '16-17'], mag: ['1-5', '9-12'] }],
    [85, { mon: ['all'], mapMag: ['1-5'] }], [90, { mon: ['all'], mapMag: ['19'] }],
    [96, { mapMon: ['1-2', '3-5'], mag: ['20'] }], [100, { mapMon: ['11-12', '13-15'], mapMag: ['15-18'], mag: ['20'] }]
  ];

  // DMG p.26 gems and jewellery
  const GEM_BASE = [[25, 10, 'ornamental'], [50, 50, 'semi-precious'], [70, 100, 'fancy'], [90, 500, 'fancy (precious)'], [99, 1000, 'gem stone'], [100, 5000, 'gem stone (jewel)']];
  const GEM_LADDER = [0.05, 0.25, 0.5, 1, 5, 10, 50, 100, 500, 1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000]; // 1 sp, 5 sp, 10 sp, 1 gp, 5 gp, 10 gp ...
  const JEWEL = [ // [max, lo, hi, dice, description, setWithGems]
    [10, 100, 1000, '1d10x100', 'ivory or wrought silver', false], [20, 200, 1200, '2d6x100', 'wrought silver and gold', false],
    [40, 300, 1800, '3d6x100', 'wrought gold', false], [50, 500, 3000, '5d6x100', 'jade, coral or wrought platinum', false],
    [70, 1000, 6000, '1d6x1000', 'silver with gems', true], [90, 2000, 8000, '2d4x1000', 'gold with gems', true], [100, 2000, 12000, '2d6x1000', 'platinum with gems', true]
  ];
  const ARMOUR_SIZE = [[65, 'man-sized'], [85, 'elf-sized'], [95, 'dwarf-sized'], [100, 'gnome or halfling sized']]; // DMG p.124
  const SWORD_KIND = [[70, 'longsword'], [90, 'broadsword'], [95, 'short sword'], [99, 'bastard sword'], [100, 'two-handed sword']]; // DMG p.124

  // Scrolls DMG p.121: [max, spells, MU range, clerical range]
  const SCROLL_ROWS = [
    [10, 1, [1, 4], [1, 4]], [16, 1, [1, 6], [1, 6]], [19, 1, [2, 9], [2, 7]], [24, 2, [1, 4], [1, 4]], [27, 2, [1, 8], [1, 6]],
    [32, 3, [1, 4], [1, 4]], [35, 3, [2, 9], [2, 7]], [39, 4, [1, 6], [1, 6]], [42, 4, [1, 8], [1, 6]], [46, 5, [1, 6], [1, 6]],
    [49, 5, [1, 8], [1, 6]], [52, 6, [1, 6], [1, 6]], [54, 6, [3, 8], [3, 6]], [57, 7, [1, 8], [1, 8]], [59, 7, [2, 9], [2, 9]], [60, 7, [4, 9], [4, 7]]
  ];
  const PROTECTION = [[62, 'Demons', 2500], [64, 'Devils', 2500], [70, 'Elementals', 1500], [76, 'Lycanthropes', 1000], [82, 'Magic', 1500], [87, 'Petrification', 2000], [92, 'Possession', 2000], [97, 'Undead', 1500]];
  const CURSES = [
    [25, 'Reader polymorphed to a monster of equal level which attacks any creatures nearby'], [30, 'Reader turned to liquid and drains away'],
    [40, 'Reader and all within 20’ radius transported 200 to 1,200 miles in a random direction'],
    [50, 'Reader and all within 20’ radius transported to another planet, plane or continuum'], [75, 'Disease fatal to reader in 2-8 turns unless cured'],
    [90, 'Explosive runes'], [99, 'A magic item nearby is “de-magicked”'], [100, 'A randomly rolled spell affects the reader at 12th level of magic use']
  ];

  // Spell lists, PHB p.40-42
  const SPELLS = {
    cleric: {
      1: ['Bless', 'Command', 'Create Water', 'Cure Light Wounds', 'Detect Evil', 'Detect Magic', 'Light', 'Protection From Evil', 'Purify Food & Drink', 'Remove Fear', 'Resist Cold', 'Sanctuary'],
      2: ['Augury', 'Chant', 'Detect Charm', 'Find Traps', 'Hold Person', 'Know Alignment', 'Resist Fire', 'Silence 15’ Radius', 'Slow Poison', 'Snake Charm', 'Speak With Animals', 'Spiritual Hammer'],
      3: ['Animate Dead', 'Continual Light', 'Create Food & Water', 'Cure Blindness', 'Cure Disease', 'Dispel Magic', 'Feign Death', 'Glyph Of Warding', 'Locate Object', 'Prayer', 'Remove Curse', 'Speak With Dead'],
      4: ['Cure Serious Wounds', 'Detect Lie', 'Divination', 'Exorcise', 'Lower Water', 'Neutralize Poison', 'Protection From Evil 10’ Radius', 'Speak With Plants', 'Sticks To Snakes', 'Tongues'],
      5: ['Atonement', 'Commune', 'Cure Critical Wounds', 'Dispel Evil', 'Flame Strike', 'Insect Plague', 'Plane Shift', 'Quest', 'Raise Dead', 'True Seeing'],
      6: ['Aerial Servant', 'Animate Object', 'Blade Barrier', 'Conjure Animals', 'Find The Path', 'Heal', 'Part Water', 'Speak With Monsters', 'Stone Tell', 'Word Of Recall'],
      7: ['Astral Spell', 'Control Weather', 'Earthquake', 'Gate', 'Holy (Unholy) Word', 'Regenerate', 'Restoration', 'Resurrection', 'Symbol', 'Wind Walk']
    },
    druid: {
      1: ['Animal Friendship', 'Detect Magic', 'Detect Snares & Pits', 'Entangle', 'Faerie Fire', 'Invisibility To Animals', 'Locate Animals', 'Pass Without Trace', 'Predict Weather', 'Purify Water', 'Shillelagh', 'Speak With Animals'],
      2: ['Barkskin', 'Charm Person Or Mammal', 'Create Water', 'Cure Light Wounds', 'Feign Death', 'Fire Trap', 'Heat Metal', 'Locate Plants', 'Obscurement', 'Produce Flame', 'Trip', 'Warp Wood'],
      3: ['Call Lightning', 'Cure Disease', 'Hold Animal', 'Neutralize Poison', 'Plant Growth', 'Protection From Fire', 'Pyrotechnics', 'Snare', 'Stone Shape', 'Summon Insects', 'Tree', 'Water Breathing'],
      4: ['Animal Summoning I', 'Call Woodland Beings', 'Control Temperature 10’ Radius', 'Cure Serious Wounds', 'Dispel Magic', 'Hallucinatory Forest', 'Hold Plant', 'Plant Door', 'Produce Fire', 'Protection From Lightning', 'Repel Insects', 'Speak With Plants'],
      5: ['Animal Growth', 'Animal Summoning II', 'Anti-Plant Shell', 'Commune With Nature', 'Control Winds', 'Insect Plague', 'Pass Plant', 'Sticks To Snakes', 'Transmute Rock To Mud', 'Wall Of Fire'],
      6: ['Animal Summoning III', 'Anti-Animal Shell', 'Conjure Fire Elemental', 'Cure Critical Wounds', 'Feeblemind', 'Fire Seeds', 'Transport Via Plants', 'Turn Wood', 'Wall Of Thorns', 'Weather Summoning'],
      7: ['Animate Rock', 'Chariot Of Sustarre', 'Confusion', 'Conjure Earth Elemental', 'Control Weather', 'Creeping Doom', 'Finger Of Death', 'Fire Storm', 'Reincarnate', 'Transmute Metal To Wood']
    },
    mu: {
      1: ['Affect Normal Fires', 'Burning Hands', 'Charm Person', 'Comprehend Languages', 'Dancing Lights', 'Detect Magic', 'Enlarge', 'Erase', 'Feather Fall', 'Find Familiar', 'Friends', 'Hold Portal', 'Identify', 'Jump', 'Light', 'Magic Missile', 'Mending', 'Message', 'Nystul’s Magic Aura', 'Protection From Evil', 'Push', 'Read Magic', 'Shield', 'Shocking Grasp', 'Sleep', 'Spider Climb', 'Tenser’s Floating Disc', 'Unseen Servant', 'Ventriloquism', 'Write'],
      2: ['Audible Glamer', 'Continual Light', 'Darkness 15’ Radius', 'Detect Evil', 'Detect Invisibility', 'ESP', 'Fools Gold', 'Forget', 'Invisibility', 'Knock', 'Leomund’s Trap', 'Levitate', 'Locate Object', 'Magic Mouth', 'Mirror Image', 'Pyrotechnics', 'Ray Of Enfeeblement', 'Rope Trick', 'Scare', 'Shatter', 'Stinking Cloud', 'Strength', 'Web', 'Wizard Lock'],
      3: ['Blink', 'Clairaudience', 'Clairvoyance', 'Dispel Magic', 'Explosive Runes', 'Feign Death', 'Fireball', 'Flame Arrow', 'Fly', 'Gust Of Wind', 'Haste', 'Hold Person', 'Infravision', 'Invisibility 10’ Radius', 'Leomund’s Tiny Hut', 'Lightning Bolt', 'Monster Summoning I', 'Phantasmal Force', 'Protection From Evil 10’ Radius', 'Protection From Normal Missiles', 'Slow', 'Suggestion', 'Tongues', 'Water Breathing'],
      4: ['Charm Monster', 'Confusion', 'Dig', 'Dimension Door', 'Enchanted Weapon', 'Extension I', 'Fear', 'Fire Charm', 'Fire Shield', 'Fire Trap', 'Fumble', 'Hallucinatory Terrain', 'Ice Storm', 'Massmorph', 'Minor Globe of Invulnerability', 'Monster Summoning II', 'Plant Growth', 'Polymorph Other', 'Polymorph Self', 'Rary’s Mnemonic Enhancer', 'Remove Curse', 'Wall Of Fire', 'Wall Of Ice', 'Wizard Eye'],
      5: ['Airy Water', 'Animal Growth', 'Animate Dead', 'Bigby’s Interposing Hand', 'Cloudkill', 'Cone Of Cold', 'Conjure Elemental', 'Contact Other Plane', 'Distance Distortion', 'Extension II', 'Feeblemind', 'Hold Monster', 'Leomund’s Secret Chest', 'Magic Jar', 'Monster Summoning III', 'Mordenkainen’s Faithful Hound', 'Passwall', 'Stone Shape', 'Telekinesis', 'Teleport', 'Transmute Rock To Mud', 'Wall Of Force', 'Wall Of Iron', 'Wall Of Stone'],
      6: ['Anti-Magic Shell', 'Bigby’s Forceful Hand', 'Control Weather', 'Death Spell', 'Disintegrate', 'Enchant An Item', 'Extension III', 'Geas', 'Glassee', 'Globe Of Invulnerability', 'Guards And Wards', 'Invisible Stalker', 'Legend Lore', 'Lower Water', 'Monster Summoning IV', 'Move Earth', 'Otiluke’s Freezing Sphere', 'Part Water', 'Project Image', 'Reincarnation', 'Repulsion', 'Spiritwrack', 'Stone To Flesh', 'Tenser’s Transformation'],
      7: ['Bigby’s Grasping Hand', 'Cacodemon', 'Charm Plants', 'Delayed Blast Fireball', 'Drawmij’s Instant Summons', 'Duo-Dimension', 'Limited Wish', 'Mass Invisibility', 'Monster Summoning V', 'Mordenkainen’s Sword', 'Phase Door', 'Power Word, Stun', 'Reverse Gravity', 'Simulacrum', 'Statue', 'Vanish'],
      8: ['Antipathy/Sympathy', 'Bigby’s Clenched Fist', 'Clone', 'Glassteel', 'Incendiary Cloud', 'Mass Charm', 'Maze', 'Mind Blank', 'Monster Summoning VI', 'Otto’s Irresistible Dance', 'Permanency', 'Polymorph Any Object', 'Power Word, Blind', 'Serten’s Spell Immunity', 'Symbol', 'Trap The Soul'],
      9: ['Astral Spell', 'Bigby’s Crushing Hand', 'Gate', 'Imprisonment', 'Meteor Swarm', 'Monster Summoning VII', 'Power Word, Kill', 'Prismatic Sphere', 'Shape Change', 'Temporal Stasis', 'Time Stop', 'Wish']
    },
    illusionist: {
      1: ['Audible Glamer', 'Change Self', 'Color Spray', 'Dancing Lights', 'Darkness', 'Detect Illusion', 'Detect Invisibility', 'Gaze Reflection', 'Hypnotism', 'Light', 'Phantasmal Force', 'Wall Of Fog'],
      2: ['Blindness', 'Blur', 'Deafness', 'Detect Magic', 'Fog Cloud', 'Hypnotic Pattern', 'Improved Phantasmal Force', 'Invisibility', 'Magic Mouth', 'Mirror Image', 'Misdirection', 'Ventriloquism'],
      3: ['Continual Darkness', 'Continual Light', 'Dispel Illusion', 'Fear', 'Hallucinatory Terrain', 'Illusionary Script', 'Invisibility 10’ Radius', 'Non-detection', 'Paralyzation', 'Rope Trick', 'Spectral Force', 'Suggestion'],
      4: ['Confusion', 'Dispel Exhaustion', 'Emotion', 'Improved Invisibility', 'Massmorph', 'Minor Creation', 'Phantasmal Killer', 'Shadow Monsters'],
      5: ['Chaos', 'Demi-Shadow Monsters', 'Major Creation', 'Maze', 'Projected Image', 'Shadow Door', 'Shadow Magic', 'Summon Shadow'],
      6: ['Conjure Animals', 'Demi-Shadow Magic', 'Mass Suggestion', 'Permanent Illusion', 'Programmed Illusion', 'Shades', 'True Sight', 'Veil'],
      7: ['Alter Reality', 'Astral Spell', 'Prismatic Spray', 'Prismatic Wall', 'Vision', 'First Level Magic-User Spells']
    }
  };
  const MAX_SPELL_LEVEL = { mu: 9, cleric: 7, druid: 7, illusionist: 7 };
  const CLASS_LABEL = { mu: 'magic-user', cleric: 'cleric', druid: 'druid', illusionist: 'illusionist' };

  // DMG p.167 sword tables
  const SW_INT = [[75, 0], [83, 12], [89, 13], [94, 14], [97, 15], [99, 16], [100, 17]];
  const SW_ALIGN = [[5, 'chaotic good'], [15, 'chaotic neutral'], [20, 'chaotic evil'], [25, 'neutral evil'], [30, 'lawful evil'], [55, 'lawful good'], [60, 'lawful neutral'], [80, 'neutral'], [100, 'neutral good']];
  const SW_PRIMARY = [[11, 'detect elevator/shifting rooms/walls in a 1" radius'], [22, 'detect sloping passages in a 1" radius'], [33, 'detect traps of large size in a 1" radius'], [44, 'detect evil/good in a 1" radius'], [55, 'detect precious metals, kind and amount, in a 2" radius'], [66, 'detect gems, kind and number, in a 1/2" radius'], [77, 'detect magic in a 1" radius'], [82, 'detect secret doors in a 1/2" radius'], [87, 'detect invisible objects in a 1" radius'], [92, 'locate object in a 12" radius'], [98, 'twice'], [100, 'extra']];
  const SW_EXTRA = [[7, 'charm person on contact, 3 times/day'], [15, 'clairaudience, 3" range, 3 times/day, 1 round per use'], [22, 'clairvoyance, 3" range, 3 times/day, 1 round per use'], [28, 'determine directions and depth, 2 times/day'], [34, 'ESP, 3" range, 3 times/day, 1 round per use'], [41, 'flying, 12"/turn, 1 hour/day'], [47, 'heal, 1 time/day'], [54, 'illusion, 12" range, 2 times/day, as the wand'], [61, 'levitation, 1 turn duration, 3 times/day, at 6th level of magic use'], [67, 'strength, 1 time/day (upon wielder only)'], [75, 'telekinesis, 2,500 g.p. wt. maximum, 2 times/day, 1 round each use'], [81, 'telepathy, 6" range, 2 times/day'], [88, 'teleportation, 1 time/day, 6,000 g.p. wt. maximum, 2 segments to activate'], [94, 'X-ray vision, 4" range, 2 times/day, 1 turn per use'], [97, 'twice'], [99, 'choice'], [100, 'choice+purpose']];
  const SW_PURPOSE = [[10, 'defeat/slay diametrically opposed alignment'], [20, 'kill clerics'], [30, 'kill fighters'], [40, 'kill magic-users'], [50, 'kill thieves'], [55, 'kill bards/monks'], [65, 'overthrow law and/or chaos'], [75, 'slay good and/or evil'], [100, 'slay non-human monsters']];
  const SW_POWER = [[10, 'blindness for 2-12 rounds'], [20, 'confusion for 2-12 rounds'], [25, 'disintegrate'], [55, 'fear for 1-4 rounds'], [65, 'insanity for 1-4 rounds'], [80, 'paralysis for 1-4 rounds'], [100, '+2 on all saving throws, -1 on each die of damage sustained']];
  const SW_LANG = [[40, 1], [70, 2], [85, 3], [95, 4], [99, 5], [100, 6]];
  const SW_INT_INFO = { 12: { pa: 1, comm: 'semi-empathy' }, 13: { pa: 2, comm: 'empathy' }, 14: { pa: 2, comm: 'speech' }, 15: { pa: 3, comm: 'speech' }, 16: { pa: 3, comm: 'speech; reads languages and maps of any non-magical sort', readLang: 1 }, 17: { pa: 3, comm: 'speech and telepathy; reads languages and magical writings', readLang: 1, readMagic: 1, tele: 1, extra: 1 } };
  const DRAGONS = [['black', 'CE'], ['blue', 'LE'], ['brass', 'CG'], ['bronze', 'LG'], ['copper', 'CG'], ['gold', 'LG'], ['green', 'LE'], ['red', 'CE'], ['silver', 'LG'], ['white', 'CE']];

  // sub-tables for items whose x.p./g.p. depend on a variety (DMG p.121-126, p.130, p.139-152)
  const SUB = {
    dragon: [[2, 'white'], [4, 'black'], [7, 'green'], [9, 'blue'], [10, 'red'], [12, 'brass'], [14, 'copper'], [15, 'bronze'], [16, 'silver'], [17, 'gold'], [19, 'evil (black, blue, green, red, white)'], [20, 'good (brass, bronze, copper, gold, silver)']],
    giantControl: [[5, 'hill giant'], [9, 'stone giant'], [13, 'frost giant'], [17, 'fire giant'], [19, 'cloud giant'], [20, 'storm giant']],
    giantStrength: [[6, 'hill giant'], [10, 'stone giant'], [14, 'frost giant'], [17, 'fire giant'], [19, 'cloud giant'], [20, 'storm giant']],
    ringProt: [[70, '+1'], [82, '+2'], [83, '+2, 5’ radius protection'], [90, '+3'], [91, '+3, 5’ radius protection'], [97, '+4 on AC, +2 on saving throws'], [100, '+6 on AC, +1 on saving throws']],
    bracers: [[5, 8], [15, 7], [35, 6], [50, 5], [70, 4], [85, 3], [100, 2]],
    cloak: [[35, 1], [65, 2], [85, 3], [95, 4], [100, 5]],
    bucknard: [[50, 'sp, ep and gp'], [90, 'cp, ep and pp'], [100, 'cp, ep and gems']],
    horn: [[8, 'silver', 1], [15, 'brass', 1], [18, 'bronze', 2], [20, 'iron', 3]],
    medallion: [[15, '30’ range', 0], [18, '30’ range with empathy', 0], [19, '60’ range', 1], [20, '90’ range', 1]]
  };

  // every roll table, for the coverage test: [name, sides, rows]
  const TABLE_INDEX = [];
  Object.keys(TABLES).forEach(function (k) { TABLE_INDEX.push([k, 100, TABLES[k]]); });
  [['magicCategory', 100, MAGIC_CAT], ['mapType', 100, MAP_TYPE], ['mapLocation', 100, MAP_LOC], ['mapSituation', 100, MAP_SIT], ['monetary', 20, MONETARY_ROWS], ['magicHoard', 20, MAGIC_ROWS],
    ['combinedHoard', 100, COMBINED], ['gemBase', 100, GEM_BASE], ['jewellery', 100, JEWEL], ['armourSize', 100, ARMOUR_SIZE], ['swordKind', 100, SWORD_KIND], ['curse', 100, CURSES], ['swordInt', 100, SW_INT], ['swordAlign', 100, SW_ALIGN], ['swordPrimary', 100, SW_PRIMARY], ['swordExtra', 100, SW_EXTRA], ['swordPurpose', 100, SW_PURPOSE], ['swordPower', 100, SW_POWER], ['swordLang', 100, SW_LANG],
    ['dragonControl', 20, SUB.dragon], ['giantControl', 20, SUB.giantControl], ['giantStrength', 20, SUB.giantStrength], ['ringProtection', 100, SUB.ringProt], ['bracers', 100, SUB.bracers], ['cloak', 100, SUB.cloak], ['bucknard', 100, SUB.bucknard], ['horn', 20, SUB.horn], ['medallion', 20, SUB.medallion]
  ].forEach(function (t) { TABLE_INDEX.push(t); });

  // scroll table 1-100 as one table: spells 01-60, protection 61-97, curse 98-00
  const SCROLL_ALL = SCROLL_ROWS.map(function (r) { return [r[0], 'spell', r[1], r[2], r[3]]; })
    .concat(PROTECTION.map(function (r) { return [r[0], 'prot', r[1], r[2]]; }), [[100, 'curse']]);
  TABLE_INDEX.push(['scroll', 100, SCROLL_ALL]);

  // ---------------------------------------------------------------- context, logging, picking
  function makeCtx(opts) {
    const rng = opts.rng || Math.random, logOn = opts.log !== false, log = [];
    const c = { rng: rng, log: log };
    c.d = function (n) { return Math.floor(rng() * n) + 1; };
    c.say = function (s) { if (logOn) log.push(s); };
    c.dice = function (spec, label) {
      const r = rollDice(spec, rng);
      if (logOn) log.push(label + ': ' + spec + '=' + r.total + (r.rolls.length > 1 || /[+\-x*]/.test(spec) ? ' [' + r.rolls.join(',') + ']' : ''));
      return r.total;
    };
    c.pick = function (rows, sides, label, describe) {
      const r = c.d(sides);
      const row = rows.find(function (x) { return r <= x[0]; });
      if (logOn) log.push(label + ': d' + sides + '=' + r + ' -> ' + (describe ? describe(row) : row[1]));
      return { roll: r, row: row };
    };
    c.chance = function (pct, label) {
      const r = c.d(100), ok = r <= pct;
      if (logOn) log.push(label + ': d100=' + r + ' (need ' + pct + ' or less) -> ' + (ok ? 'yes' : 'no'));
      return ok;
    };
    return c;
  }
  function rangeOf(rows, row) { const i = rows.indexOf(row); return [i === 0 ? 1 : rows[i - 1][0] + 1, row[0]]; }
  function fmtRange(a) { return a[0] === a[1] ? String(a[0]) : a[0] + '-' + a[1]; }
  function round2(v) { return Math.round(v * 100) / 100; }

  // ---------------------------------------------------------------- results
  function newResult() {
    return { coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, totalGp: 0 }, gems: { stones: [], groups: [], count: 0, total: 0 }, jewellery: { pieces: [], count: 0, total: 0 },
      magic: { items: [], totalXp: 0, totalGp: 0, unvalued: 0 }, maps: [], notes: [] };
  }
  function finalize(res) {
    let g = 0;
    COIN_KEYS.forEach(function (k) { g += res.coins[k] * COIN_GP[k]; });
    res.coins.totalGp = round2(g);
    const groups = {};
    res.gems.stones.forEach(function (s) { const key = s.base + '|' + s.value; (groups[key] = groups[key] || { base: s.base, value: s.value, count: 0 }).count++; });
    res.gems.groups = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return a.base - b.base || a.value - b.value; });
    res.gems.count = res.gems.stones.length;
    res.gems.total = round2(res.gems.stones.reduce(function (a, s) { return a + s.value; }, 0));
    res.jewellery.count = res.jewellery.pieces.length;
    res.jewellery.total = res.jewellery.pieces.reduce(function (a, p) { return a + p.value; }, 0);
    let xp = 0, gp = 0, un = 0;
    res.magic.items.forEach(function (it) {
      if (typeof it.xp === 'number') xp += it.xp; else un++;
      if (typeof it.gp === 'number') gp += it.gp;
    });
    res.magic.totalXp = xp; res.magic.totalGp = gp; res.magic.unvalued = un;
    return res;
  }

  // ---------------------------------------------------------------- gems and jewellery (DMG p.25-26)
  function rollGem(ctx) {
    const b = ctx.pick(GEM_BASE, 100, 'gem base value', function (r) { return r[1] + ' gp (' + r[2] + ')'; }).row;
    const base = b[1], start = GEM_LADDER.indexOf(base);
    const maxIdx = Math.min(start + 7, GEM_LADDER.length - 1), minIdx = Math.max(start - 5, 0);
    let idx = start, value = base, mode = 'any'; const steps = [];
    for (let guard = 0; guard < 40; guard++) {
      let r = ctx.d(10);
      if (mode === 'up') while (r > 8) r = ctx.d(10);      // "roll again ignoring results above 8"
      if (mode === 'down') while (r === 1) r = ctx.d(10);  // "roll again ignoring any result below 2"
      if (r === 1) { if (idx < maxIdx) { idx++; value = GEM_LADDER[idx]; steps.push('up one step to ' + value + ' gp'); mode = 'up'; continue; } steps.push('at the top step'); break; }
      if (r === 2) { value = value * 2; steps.push('doubled'); break; }
      if (r === 3) { const p = ctx.d(6) * 10; value = value * (1 + p / 100); steps.push('+' + p + '%'); break; }
      if (r <= 8) { steps.push('unchanged'); break; }
      if (r === 9) { const p = ctx.d(4) * 10; value = value * (1 - p / 100); steps.push('-' + p + '%'); break; }
      if (idx > minIdx) { idx--; value = GEM_LADDER[idx]; steps.push('down one step to ' + value + ' gp'); mode = 'down'; continue; }
      steps.push('at the bottom step'); break;
    }
    value = round2(value);
    ctx.say('gem variation d10: ' + steps.join(', ') + ' -> ' + value + ' gp');
    return { base: base, value: value, kind: b[2], variation: steps.join(', ') };
  }
  function rollJewel(ctx) {
    let ci = ctx.pick(JEWEL, 100, 'jewellery class', function (r) { return r[1] + '-' + r[2] + ' gp (' + r[4] + ')'; }).row;
    let cls = JEWEL.indexOf(ci); const trail = []; let value;
    for (let guard = 0; guard < 10; guard++) {
      const c = JEWEL[cls]; value = ctx.dice(c[3], 'jewellery value');
      const w = ctx.d(10);
      if (w !== 1) { ctx.say('workmanship d10=' + w + ' -> ordinary'); break; }
      if (cls < JEWEL.length - 1 && ctx.d(2) === 2) { ctx.say('workmanship d10=1 -> next higher class'); trail.push('exceptional workmanship: next class up'); cls++; continue; }
      value = c[2]; trail.push('exceptional workmanship: top of class (' + value + ' gp)'); ctx.say('workmanship d10=1 -> highest value in class'); break;
    }
    let bonus = 0;
    if (JEWEL[cls][5]) {
      const g = ctx.d(8);
      if (g === 1) {
        bonus = 5000;
        while (bonus < 640000 && ctx.d(6) === 1) bonus *= 2;
        value += bonus; trail.push('exceptional stone in the setting: +' + bonus + ' gp');
      }
      ctx.say('jewellery gem check d8=' + g + (bonus ? ' -> +' + bonus + ' gp' : ' -> none'));
    }
    return { value: value, kind: JEWEL[cls][4], range: JEWEL[cls][1] + '-' + JEWEL[cls][2], workmanship: trail, gemBonus: bonus };
  }

  // ---------------------------------------------------------------- spells and scrolls (DMG p.121)
  function makeScroll(ctx) {
    const p = ctx.pick(SCROLL_ALL, 100, 'scroll', function (r) {
      return r[1] === 'spell' ? r[2] + ' spell(s)' : r[1] === 'prot' ? 'Protection from ' + r[2] : 'cursed scroll';
    });
    const row = p.row;
    const item = { category: CAT_LABEL.scroll, qty: 1, notes: [], dm: [] };
    if (row[1] === 'prot') {
      item.name = 'Scroll of Protection from ' + row[2]; item.xp = row[3]; item.gp = row[3] * 5;
      item.scroll = { kind: 'protection', against: row[2] };
      return item;
    }
    if (row[1] === 'curse') {
      const c = ctx.pick(CURSES, 100, 'scroll curse');
      item.name = 'Scroll (cursed)'; item.playerName = 'Scroll'; item.xp = 0; item.gp = 0; item.cursed = true;
      item.curse = c.row[1]; item.dm.push('Cursed scroll. Curse on reading: ' + c.row[1]);
      item.scroll = { kind: 'cursed' };
      return item;
    }
    const clerical = ctx.d(100) >= 71; ctx.say('scroll class d100: ' + (clerical ? '71-00 clerical' : '01-70 magic-user'));
    let cls;
    if (clerical) { const dr = ctx.d(100) <= 25; cls = dr ? 'druid' : 'cleric'; ctx.say('clerical scroll druidical? ' + (dr ? 'yes (25%)' : 'no')); }
    else { const il = ctx.d(100) <= 10; cls = il ? 'illusionist' : 'mu'; ctx.say('magic-user scroll illusionist? ' + (il ? 'yes (10%)' : 'no')); }
    const rng = clerical ? row[4] : row[3];
    const hi = Math.min(rng[1], MAX_SPELL_LEVEL[cls]), lo = rng[0];
    const spells = [], used = {};
    let levels = 0;
    for (let i = 0; i < row[2]; i++) {
      const lvl = lo + ctx.d(hi - lo + 1) - 1;
      const pool = SPELLS[cls][lvl].filter(function (s) { return !used[s]; });
      const sp = pool[ctx.d(pool.length) - 1];
      used[sp] = 1; spells.push({ name: sp, level: lvl }); levels += lvl;
      ctx.say('spell ' + (i + 1) + ': level ' + lvl + ' (' + lo + '-' + hi + ') -> ' + sp);
    }
    spells.sort(function (a, b) { return a.level - b.level || (a.name < b.name ? -1 : 1); });
    item.name = 'Scroll (' + CLASS_LABEL[cls] + '): ' + spells.map(function (s) { return s.name + ' (' + s.level + ')'; }).join(', ');
    item.xp = levels * 100; item.gp = item.xp * 3;
    item.scroll = { kind: 'spells', class: CLASS_LABEL[cls], count: row[2], row: row[0], range: [lo, rng[1]], spells: spells };
    return item;
  }

  // ---------------------------------------------------------------- variable-value magic items
  function interp(lo, hi, i, n, step) { return Math.round((lo + (hi - lo) * (n <= 1 ? 0 : i / (n - 1))) / step) * step; }
  const HANDLERS = {
    dragonControl: function (ctx, it) {
      const p = ctx.pick(SUB.dragon, 20, 'dragon control type'), i = SUB.dragon.indexOf(p.row);
      it.name = 'Potion of Dragon Control (' + p.row[1] + ')'; it.xp = interp(500, 1000, i, SUB.dragon.length, 50); it.gp = interp(5000, 9000, i, SUB.dragon.length, 100);
      it.dm.push('DMG range 500-1,000 x.p. / 5,000-9,000 g.p.; value set by position in the type table');
    },
    giantControl: function (ctx, it) {
      const p = ctx.pick(SUB.giantControl, 20, 'giant control type'), i = SUB.giantControl.indexOf(p.row);
      it.name = 'Potion of Giant Control (' + p.row[1] + 's)'; it.xp = 400 + i * 100; it.gp = 1000 + i * 1000;
      it.dm.push('DMG range 400-900 x.p. / 1,000-6,000 g.p.; value set by giant type, hill lowest to storm highest');
    },
    giantStrength: function (ctx, it) {
      const p = ctx.pick(SUB.giantStrength, 20, 'giant strength type'), i = SUB.giantStrength.indexOf(p.row);
      it.name = 'Potion of Giant Strength (' + p.row[1] + ')'; it.xp = 500 + i * 50; it.gp = 900 + i * 100;
      it.dm.push('DMG range 500-750 x.p. / 900-1,400 g.p.; value set by giant type, hill lowest to storm highest');
    },
    ringProtection: function (ctx, it) {
      const p = ctx.pick(SUB.ringProt, 100, 'ring of protection value'), i = SUB.ringProt.indexOf(p.row);
      it.name = 'Ring of Protection ' + p.row[1]; it.xp = interp(2000, 4000, i, SUB.ringProt.length, 50); it.gp = interp(10000, 20000, i, SUB.ringProt.length, 100);
      it.dm.push('DMG range 2,000-4,000 x.p. / 10,000-20,000 g.p.; value set by position in the protection table');
    },
    bracers: function (ctx, it) {
      const p = ctx.pick(SUB.bracers, 100, 'bracers of defense AC'), pts = 10 - p.row[1];
      it.name = 'Bracers of Defense AC ' + p.row[1]; it.xp = 500 * pts; it.gp = 3000 * pts;
    },
    bucknard: function (ctx, it) {
      const p = ctx.pick(SUB.bucknard, 100, 'Bucknard’s purse contents'), i = SUB.bucknard.indexOf(p.row);
      it.name = 'Bucknard’s Everfull Purse (' + p.row[1] + ')'; it.xp = [1500, 2500, 4000][i]; it.gp = [15000, 25000, 40000][i];
      it.notes.push('Makes 26 of each listed coin or gem type each morning');
    },
    cloakProtection: function (ctx, it) {
      const p = ctx.pick(SUB.cloak, 100, 'cloak of protection plus');
      it.name = 'Cloak of Protection +' + p.row[1]; it.xp = 1000 * p.row[1]; it.gp = 10000 * p.row[1];
    },
    horn: function (ctx, it) {
      const p = ctx.pick(SUB.horn, 20, 'horn of Valhalla type');
      it.name = 'Horn of Valhalla (' + p.row[1] + ')'; it.xp = 1000 * p.row[2]; it.gp = 15000 * p.row[2];
    },
    ioun: function (ctx, it) {
      const n = ctx.dice('1d10', 'ioun stones found');
      it.name = 'Ioun Stones (' + n + ')'; it.xp = 300 * n; it.gp = 5000 * n; it.qty = n;
      it.dm.push('300 x.p. and 5,000 g.p. per stone; dice for the property of each stone (DMG p.147)');
    },
    medallion: function (ctx, it) {
      const p = ctx.pick(SUB.medallion, 20, 'medallion of ESP type');
      it.name = 'Medallion of ESP (' + p.row[1] + ')'; it.xp = p.row[2] ? 3000 : 1000; it.gp = p.row[2] ? 30000 : 10000;
    },
    quaal: function (ctx, it) {
      const hi = ctx.d(2) === 2; ctx.say('Quaal’s feather token value pair d2=' + (hi ? 2 : 1));
      it.name = 'Quaal’s Feather Token'; it.xp = hi ? 1000 : 500; it.gp = hi ? 7000 : 2000;
      it.dm.push('Token type: roll d20 on the feather token table (DMG p.152)');
    },
    special: function (ctx, it) {
      const p = ctx.pick(TABLES.special, 100, 'artifact or relic (Special table)');
      const r = p.row;
      it.name = r[1]; it.category = CAT_LABEL.special; it.xp = 0; it.gp = r[3];
      it.dm.push('Artifact or relic: gives no x.p. (DMG p.124); see its full description');
      if (r[4] && r[4].h === 'dragonkind') { const n = ctx.dice('1d8', 'Orb of Dragonkind value (x10,000)'); it.gp = n * 10000; }
      if (r[4] && r[4].unit) { it.gp = null; it.unit = r[4].unit; it.unitGp = r[3]; }
    }
  };
  const CURSED_RX = /^(Potion of (Delusion|Poison)|Ring of (Contrariness|Delusion|Weakness)|Amulet of Inescapable Location|Bag of (Devouring|Transmuting)|Boots of Dancing|Bowl of Watery Death|Bracers of Defenselessness|Brazier of Sleep Smoke|Broom of Animated Attack|Censer of Summoning|Chime of Hunger|Cloak of Poisonousness|Crystal Hypnosis Ball|Dust of Sneezing|Flask of Curses|Gauntlets of Fumbling|Girdle of Femininity|Helm of Opposite|Incense of Obsession|Medallion of Thought|Mirror of Opposition|Necklace of Strangulation|Periapt of Foul|Phylactery of Monstrous|Robe of Powerlessness|Rope of Constriction|Rug of Smothering|Scarab of Death|Stone of Weight|Trident of Yearning|Vacuous|Plate Mail of Vulnerability|Shield -1|Spear, Cursed|Jewel of Attacks|Drums of Deafening|Eyes of Petrification)/;

  // an item from a [max, name, xp, gp, extra] table
  function tableItem(ctx, key, cat, label) {
    const p = ctx.pick(TABLES[key], 100, label, function (r) { return r[1]; }), row = p.row, extra = row[4];
    const it = { name: row[1], category: cat, xp: row[2], gp: row[3], qty: 1, notes: [], dm: [] };
    if (extra && typeof extra === 'object') {
      if (extra.h) HANDLERS[extra.h](ctx, it);
      if (extra.unit) { it.unit = extra.unit; it.unitXp = extra.xp; it.unitGp = extra.gp; }
      if (extra.note) it.notes.push(extra.note);
    }
    if (CURSED_RX.test(it.name)) { it.cursed = true; it.dm.push('Cursed or harmful item'); }
    if (/^Potion of (Delusion|Poison)$/.test(it.name)) it.dm.push('The DM must mislead the possessor into thinking the potion is harmless (DMG p.121)');
    return it;
  }
  function makeWeapon(ctx) {
    const it = tableItem(ctx, 'weapons', CAT_LABEL.weapon, 'misc weapon');
    const row = TABLES.weapons.find(function (r) { return r[1] === it.name; });
    if (row[4]) {
      const q = ctx.dice(row[4].replace(/^(\d+)-(\d+)$/, function (m, a, b) { return rangeToDice(+a, +b); }), 'number in bundle');
      it.qty = q; it.unitXp = it.xp; it.unitGp = it.gp; it.xp = it.xp * q; it.gp = it.gp * q;
      it.name = it.name + ', ' + q + ' in number';
      it.dm.push(it.unitXp + ' x.p. and ' + it.unitGp + ' g.p. each');
    }
    return it;
  }
  function makeArmour(ctx) {
    const it = tableItem(ctx, 'armor', CAT_LABEL.armour, 'armour & shield');
    const s = ctx.pick(ARMOUR_SIZE, 100, 'armour size');
    it.size = s.row[1]; it.notes.push(it.size);
    return it;
  }

  // ---------------------------------------------------------------- swords (DMG p.124, p.165-168)
  function makeSword(ctx) {
    const p = ctx.pick(TABLES.sword, 100, 'sword', function (r) { return r[1]; });
    const row = p.row, meta = row[4];
    const it = { name: row[1], category: CAT_LABEL.sword, xp: row[2], gp: row[3], qty: 1, notes: [], dm: [] };
    const k = ctx.pick(SWORD_KIND, 100, 'sword type');
    it.swordType = k.row[1]; it.notes.push(it.swordType);
    if (meta.cursed) { it.cursed = true; it.gp = 0; it.dm.push('Cursed sword (DMG p.166); alignment is absolutely neutral'); }
    if (/Luck Blade/.test(it.name)) { const w = ctx.dice('1d4+1', 'luck blade wishes'); it.dm.push('Luck Blade: ' + w + ' wishes (keep the count secret)'); }
    if (/Dragon Slayer/.test(it.name)) it.dragonSlayer = true;
    const t = ctx.pick(SW_INT, 100, 'sword intelligence (Table 1)', function (r) { return r[1] ? 'Intelligence ' + r[1] : 'none'; });
    const intel = t.row[1];
    const restrict = meta.al; // LG Holy Avenger, C Sharpness, L Vorpal
    if (restrict === 'LG') it.dm.push('Holy Avenger: always lawful good');
    if (restrict === 'C') it.dm.push('Sword of Sharpness: always chaotic');
    if (restrict === 'L') it.dm.push('Vorpal weapon: always lawful');
    let align = null;
    if (intel || restrict || it.dragonSlayer) {
      if (meta.cursed) align = 'neutral';
      else if (restrict === 'LG') align = 'lawful good';
      else for (let g = 0; g < 100; g++) {
        const a = ctx.pick(SW_ALIGN, 100, 'sword alignment (Table 2)').row[1];
        if ((restrict === 'C' && !/^chaotic/.test(a)) || (restrict === 'L' && !/^lawful/.test(a))) continue;
        align = a; break;
      }
    }
    if (it.dragonSlayer) {
      const code = { 'lawful good': 'LG', 'lawful neutral': 'LN', 'lawful evil': 'LE', 'neutral good': 'NG', neutral: 'N', 'chaotic good': 'CG', 'chaotic neutral': 'CN', 'chaotic evil': 'CE' };
      let dr;
      for (let g = 0; g < 50; g++) { dr = DRAGONS[ctx.d(10) - 1]; if (!intel || code[align] !== dr[1]) break; }
      it.dm.push('Dragon Slayer: triple damage against ' + dr[0] + ' dragons');
    }
    if (!intel) return it;
    const info = SW_INT_INFO[intel];
    const sw = { intelligence: intel, communication: info.comm, alignment: align, primary: [], extraordinary: [], purpose: null, languages: 0, ego: 0, personality: 0 };
    const plusEgo = meta.pw && meta.plus === meta.max ? meta.plus * 2 : meta.plus + (meta.max > meta.plus ? meta.max : 0);
    let ego = plusEgo;
    const prim = {}, extra = {};
    function addPrim(txt) { prim[txt] = (prim[txt] || 0) + 1; }
    const CHOICE = 'wielder chooses 1 power from the extraordinary power table';
    function rollExtra(ignoring) {
      for (let g = 0; g < 50; g++) {
        const r = ctx.pick(SW_EXTRA, 100, 'sword extraordinary power (Table 4)').row;
        if (r[1] === 'twice') { if (ignoring) continue; rollExtra(true); rollExtra(true); return; }
        if (r[1] === 'choice' || r[1] === 'choice+purpose') { extra[CHOICE] = (extra[CHOICE] || 0) + 1; if (r[1] === 'choice+purpose') rollPurpose(); return; }
        extra[r[1]] = (extra[r[1]] || 0) + 1; return;
      }
    }
    function rollPurpose() {
      if (sw.purpose) return;
      const a = ctx.pick(SW_PURPOSE, 100, 'sword special purpose (Table 5A)').row[1];
      const b = ctx.pick(SW_POWER, 100, 'special purpose power (Table 5B)').row[1];
      sw.purpose = { purpose: a, power: b };
    }
    for (let i = 0; i < info.pa; i++) {
      const r = ctx.pick(SW_PRIMARY, 100, 'sword primary ability (Table 3)').row;
      if (r[1] === 'twice') {
        for (let n = 0; n < 2; n++) { for (let g = 0; g < 50; g++) { const q = ctx.pick(SW_PRIMARY, 100, 'primary ability (ignoring 93-00)').row; if (q[1] !== 'twice' && q[1] !== 'extra') { addPrim(q[1]); break; } } }
      } else if (r[1] === 'extra') rollExtra();
      else addPrim(r[1]);
    }
    if (info.extra) rollExtra();
    Object.keys(prim).forEach(function (k) { sw.primary.push(prim[k] > 1 ? k + ' (range x' + prim[k] + ')' : k); ego += prim[k]; });
    Object.keys(extra).forEach(function (k) { sw.extraordinary.push(extra[k] > 1 ? k + ' (uses/day x' + extra[k] + ')' : k); ego += 2 * extra[k]; });
    if (sw.purpose) ego += 5;
    if (intel >= 14) {
      const langRoll = function (no00) { let r; do { r = ctx.pick(SW_LANG, 100, 'sword languages (Table 6)').row[1]; } while (no00 && r === 6); return r; };
      let n = langRoll(false);
      if (n === 6) n = Math.max(6, langRoll(true) + langRoll(true));
      sw.languages = n + 1; // its alignment language plus n others
      ego += Math.ceil(sw.languages / 2);
    }
    if (info.tele) ego += 2;
    if (info.readLang) ego += 1;
    if (info.readMagic) ego += 2;
    sw.ego = ego; sw.personality = intel + ego;
    it.sword = sw;
    it.dm.push('Intelligent sword: Int ' + intel + ', ' + align + ', ego ' + ego + ', personality ' + sw.personality + (ego >= 19 ? ' (ego 19 or higher: considers itself superior to any character)' : ''));
    return it;
  }

  // ---------------------------------------------------------------- magic item entry points
  function allowedSet(exclude) {
    const all = ['potion', 'scroll', 'ring', 'rod', 'misc', 'armour', 'sword', 'weapon'];
    return new Set(all.filter(function (c) { return !exclude || exclude.indexOf(c) < 0; }));
  }
  function rollCategory(ctx, allowed, label) {
    label = label || 'magic item category';
    const slots = [];
    for (let r = 1; r <= 100; r++) { const c = MAGIC_CAT.find(function (x) { return r <= x[0]; }); if (!allowed || allowed.has(c[1])) slots.push(r); }
    if (slots.length === 100) return ctx.pick(MAGIC_CAT, 100, label, function (r) { return CAT_LABEL[r[1]]; }).row;
    if (allowed.size === 1 && !allowed.has('misc')) return MAGIC_CAT.find(function (x) { return allowed.has(x[1]); });
    const i = ctx.d(slots.length), r = slots[i - 1], row = MAGIC_CAT.find(function (x) { return r <= x[0]; });
    ctx.say(label + ': restricted d' + slots.length + '=' + i + ' (d100 equivalent ' + r + ') -> ' + CAT_LABEL[row[1]]);
    return row;
  }
  function itemOfCategory(ctx, row) {
    switch (row[1]) {
      case 'potion': return tableItem(ctx, 'potions', CAT_LABEL.potion, 'potion');
      case 'scroll': return makeScroll(ctx);
      case 'ring': return tableItem(ctx, 'rings', CAT_LABEL.ring, 'ring');
      case 'rod': return tableItem(ctx, 'rods', CAT_LABEL.rod, 'rod, staff or wand');
      case 'misc': return tableItem(ctx, row[2], CAT_LABEL.misc, 'miscellaneous magic ' + row[2].slice(1));
      case 'armour': return makeArmour(ctx);
      case 'sword': return makeSword(ctx);
      default: return makeWeapon(ctx);
    }
  }
  function magicItem(ctx, allowed) { return itemOfCategory(ctx, rollCategory(ctx, allowed)); }

  // ---------------------------------------------------------------- maps (DMG p.120)
  function mapObject(ctx, depth, forced) {
    let kind;
    if (forced) kind = forced.kind;
    else { const t = ctx.pick(MAP_TYPE, 100, 'map type', function (r) { return r[2]; }).row; kind = t[1]; }
    const loc = ctx.pick(MAP_LOC, 100, 'map location', function (r) { return r[1]; }).row;
    const m = { kind: kind, category: 'Maps', location: loc[1], situation: null, direction: null, qty: 1, notes: [], dm: [] };
    if (loc[2]) { const n = ctx.dice(loc[2], 'map distance (miles)'); m.location = 'outdoors, ' + n + ' miles distant'; m.miles = n; }
    if (loc[0] > 20) {
      m.situation = ctx.pick(MAP_SIT, 100, 'treasure situation', function (r) { return r[1]; }).row[1];
      m.direction = DIRECTIONS[ctx.d(8) - 1]; ctx.say('map direction: ' + m.direction);
    }
    m.name = 'Map: ' + m.location + (m.direction ? ', to the ' + m.direction : '');
    const sub = newResult();
    if (kind === 'false') { m.dm.push('False map: leads to no treasure'); }
    else {
      if (forced && forced.mon) forced.mon.forEach(function (k) { monetaryRow(ctx, sub, k); });
      if (forced && forced.mag) forced.mag.forEach(function (k) { magicRow(ctx, sub, k); });
      if (!forced) {
        if (kind === 'monetary') monetaryRoll(ctx, sub);
        else if (kind === 'magic') magicRoll(ctx, sub);
        else combinedRoll(ctx, sub, depth + 1);
      }
      finalize(sub);
      m.dm.push('Leads to ' + (kind === 'hoard' || (forced && forced.mon && forced.mag) ? 'a combined hoard' : kind + ' treasure') + (m.situation ? ', ' + m.situation : ''));
    }
    m.dmTreasure = kind === 'false' ? null : sub;
    return m;
  }

  // ---------------------------------------------------------------- DMG p.120 hoards
  function addGems(ctx, res, n) { for (let i = 0; i < n; i++) res.gems.stones.push(rollGem(ctx)); }
  function addJewels(ctx, res, n) { for (let i = 0; i < n; i++) res.jewellery.pieces.push(rollJewel(ctx)); }
  function monetaryRow(ctx, res, key) {
    switch (key) {
      case '1-2': res.coins.cp += ctx.dice('2d4', 'copper (x10,000)') * 10000; res.coins.sp += ctx.dice('1d4+1', 'silver (x10,000)') * 10000; break;
      case '3-5': res.coins.ep += ctx.dice('5d6', 'electrum (x1,000)') * 1000; break;
      case '6-10': res.coins.gp += ctx.dice('3d6', 'gold (x1,000)') * 1000; break;
      case '11-12': res.coins.pp += ctx.dice('5d4', 'platinum (x100)') * 100; break;
      case '13-15': addGems(ctx, res, ctx.dice('1d10x10', 'gems')); break;
      case '16-17': addJewels(ctx, res, ctx.dice('5d10', 'jewellery')); break;
      case 'all': ['1-2', '3-5', '6-10', '11-12', '13-15', '16-17'].forEach(function (k) { monetaryRow(ctx, res, k); }); break;
    }
  }
  function monetaryRoll(ctx, res) {
    const r = ctx.pick(MONETARY_ROWS, 20, 'II.A monetary', function (x) { return x[1]; }).row[1];
    if (r === 'twice' || r === 'thrice') {
      const times = r === 'twice' ? 2 : 3;
      for (let i = 0; i < times; i++) {
        let k; do { k = ctx.pick(MONETARY_ROWS, 20, 'II.A monetary (discount above 17)', function (x) { return x[1]; }).row[1]; } while (k === 'twice' || k === 'thrice' || k === 'all');
        monetaryRow(ctx, res, k);
      }
    } else monetaryRow(ctx, res, r);
  }
  function magicRow(ctx, res, key) {
    const add = function (it) { res.magic.items.push(it); };
    const any = function (n, ex) { for (let i = 0; i < n; i++) add(magicItem(ctx, allowedSet(ex))); };
    const cat = function (c, n) { for (let i = 0; i < (n || 1); i++) add(magicItem(ctx, new Set([c]))); };
    switch (key) {
      case '1-5': any(1); cat('potion', 4); break;
      case '6-8': any(2); break;
      case '9-12': cat('sword'); cat('armour'); cat('weapon'); break;
      case '13-14': any(3, ['sword', 'potion']); break;
      case '15-18': cat('potion', 6); cat('scroll', 6); break;
      case '19': any(2); cat('ring'); cat('rod'); break;
      case '20': any(3); cat('rod'); cat('misc'); break;
    }
  }
  function magicRoll(ctx, res) { magicRow(ctx, res, ctx.pick(MAGIC_ROWS, 20, 'II.B magic', function (x) { return x[1]; }).row[1]); }
  function combinedRoll(ctx, res, depth) {
    const c = ctx.pick(COMBINED, 100, 'II.C combined hoard', function (x) {
      return ['mon', 'mag', 'mapMon', 'mapMag'].filter(function (k) { return x[1][k]; }).map(function (k) { return k + ' ' + x[1][k].join(' & '); }).join('; ');
    }).row[1];
    if (c.mon) c.mon.forEach(function (k) { monetaryRow(ctx, res, k); });
    if (c.mag) c.mag.forEach(function (k) { magicRow(ctx, res, k); });
    const mapped = [];
    if (c.mapMon) mapped.push({ kind: 'monetary', mon: c.mapMon });
    if (c.mapMag && c.mapMon) { mapped[0].kind = 'hoard'; mapped[0].mag = c.mapMag; }
    else if (c.mapMag) mapped.push({ kind: 'magic', mag: c.mapMag });
    mapped.forEach(function (f) {
      if (depth >= 1) { (f.mon || []).forEach(function (k) { monetaryRow(ctx, res, k); }); (f.mag || []).forEach(function (k) { magicRow(ctx, res, k); }); }
      else res.maps.push(mapObject(ctx, depth, f));
    });
  }

  // ---------------------------------------------------------------- MM treasure types
  function rollType(ctx, res, t, spec, individual) {
    COIN_KEYS.forEach(function (k) {
      const l = spec[k]; if (!l) return;
      if (l[2] !== undefined && !ctx.chance(l[2], t + ' ' + COIN_NAME[k])) return;
      const n = ctx.dice(rangeToDice(l[0], l[1]), t + ' ' + COIN_NAME[k] + (individual ? ' pieces' : ' (x' + COIN_UNIT[k] + ')'));
      res.coins[k] += individual ? n : n * COIN_UNIT[k];
    });
    if (spec.gems && ctx.chance(spec.gems[2], t + ' gems')) addGems(ctx, res, ctx.dice(rangeToDice(spec.gems[0], spec.gems[1]), t + ' gem count'));
    if (spec.jew && ctx.chance(spec.jew[2], t + ' jewellery')) addJewels(ctx, res, ctx.dice(rangeToDice(spec.jew[0], spec.jew[1]), t + ' jewellery count'));
    if (spec.mm && ctx.chance(spec.mm.chance, t + ' maps or magic')) spec.mm.parts.forEach(function (part) { mmPart(ctx, res, t, part); });
  }
  function mmPart(ctx, res, t, part) {
    const add = function (it) { res.magic.items.push(it); };
    if (part.mom) {
      for (let i = 0; i < part.mom; i++) {
        const r = ctx.d(100); ctx.say(t + ' map or magic (I): d100=' + r + (r <= 10 ? ' -> map' : ' -> magic'));
        if (r <= 10) res.maps.push(mapObject(ctx, 0)); else add(magicItem(ctx, allowedSet(part.exclude)));
      }
    } else if (part.only) {
      const n = Array.isArray(part.n) ? ctx.dice(rangeToDice(part.n[0], part.n[1]), t + ' quantity') : part.n;
      for (let i = 0; i < n; i++) add(magicItem(ctx, new Set(part.only)));
    } else if (part.each) {
      for (let i = 0; i < part.each; i++) ['ring', 'rod', 'misc', 'armour', 'sword', 'weapon'].forEach(function (c) { add(magicItem(ctx, new Set([c]))); });
    } else if (part.map) {
      for (let i = 0; i < part.map; i++) res.maps.push(mapObject(ctx, 0));
    } else if (part.magic) {
      for (let i = 0; i < part.magic; i++) add(magicItem(ctx, null));
    }
  }

  const NOTES = {
    B: 'Type B magic is an inclusion list: a sword, armour or shield, or miscellaneous weapon only (MM p.105).',
    F: 'Type F excludes swords and miscellaneous weapons (MM p.105).',
    U: 'Type U: one item from each of rings, rods/staves/wands, miscellaneous magic, armour and shields, swords, miscellaneous weapons (reading of MM p.105).',
    V: 'Type V: two items from each of rings, rods/staves/wands, miscellaneous magic, armour and shields, swords, miscellaneous weapons (reading of MM p.105).'
  };

  function generate(opts) {
    opts = opts || {};
    const types = (opts.types || []).map(function (t) { return String(t).toUpperCase(); }).filter(function (t) { return TYPES[t]; });
    const individuals = Math.max(1, Math.floor(Number(opts.individuals) || 1)), mult = Math.max(1, Math.floor(Number(opts.multiplier) || 1));
    const ctx = makeCtx(opts), res = newResult();
    res.types = types; res.individuals = individuals; res.multiplier = mult;
    types.forEach(function (t) {
      const spec = TYPES[t];
      if (spec.ind) { for (let i = 0; i < individuals; i++) rollType(ctx, res, t, spec, true); }
      else for (let m = 0; m < mult; m++) rollType(ctx, res, t, spec, false);
      if (NOTES[t]) res.notes.push(NOTES[t]);
    });
    finalize(res);
    res.log = ctx.log;
    return res;
  }
  function generateHoard(kind, opts) {
    opts = opts || {};
    const k = String(kind || '').toUpperCase().replace(/^II\./, '').replace(/\.$/, '');
    const ctx = makeCtx(opts), res = newResult();
    if (k === 'A' || k === 'MONETARY') monetaryRoll(ctx, res);
    else if (k === 'B' || k === 'MAGIC') magicRoll(ctx, res);
    else if (k === 'C' || k === 'COMBINED') combinedRoll(ctx, res, 0);
    else throw new Error('Unknown hoard kind: ' + kind + ' (use A, B or C)');
    res.types = []; res.individuals = 1; res.multiplier = 1; res.hoard = k === 'MONETARY' ? 'A' : k === 'MAGIC' ? 'B' : k === 'COMBINED' ? 'C' : k;
    finalize(res);
    res.log = ctx.log;
    return res;
  }

  const api = {
    generate: generate, generateHoard: generateHoard, rollDice: rollDice, rangeToDice: rangeToDice,
    TYPES: TYPES, TABLES: TABLES, TABLE_INDEX: TABLE_INDEX, SPELLS: SPELLS, CAT_ORDER: CAT_ORDER, COIN_KEYS: COIN_KEYS, COIN_NAME: COIN_NAME, COIN_GP: COIN_GP
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TreasureEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
