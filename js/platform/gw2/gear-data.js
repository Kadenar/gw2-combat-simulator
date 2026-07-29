// ─── Static GW2 Data ───────────────────────────────────────────────────────
// Ascended Guild Wars 2 stat values, validated against Discretize Gear Optimizer.
// Weapon entries describe family strength and broad hand capability. Profession
// catalogs own their exact hand availability.

export const GEAR_SLOTS = [
  "Helm",
  "Shoulders",
  "Chest",
  "Gloves",
  "Leggins",
  "Boots",
  "Amulet",
  "Ring1",
  "Ring2",
  "Accessory1",
  "Accessory2",
  "Back",
  "Weapon1",
  "Weapon2",
];

export const WEAPON_SLOTS = new Set(["Weapon1", "Weapon2"]);

// GEAR_STATS[prefix][slot] → { stat: value, ... }
export const GEAR_STATS = {
  "Berserker's": {
    Helm: { Power: 63, Precision: 45, Ferocity: 45 },
    Shoulders: { Power: 47, Precision: 34, Ferocity: 34 },
    Chest: { Power: 141, Precision: 101, Ferocity: 101 },
    Gloves: { Power: 47, Precision: 34, Ferocity: 34 },
    Leggins: { Power: 94, Precision: 67, Ferocity: 67 },
    Boots: { Power: 47, Precision: 34, Ferocity: 34 },
    Amulet: { Power: 157, Precision: 108, Ferocity: 108 },
    Ring1: { Power: 126, Precision: 85, Ferocity: 85 },
    Ring2: { Power: 126, Precision: 85, Ferocity: 85 },
    Accessory1: { Power: 110, Precision: 74, Ferocity: 74 },
    Accessory2: { Power: 110, Precision: 74, Ferocity: 74 },
    Back: { Power: 63, Precision: 40, Ferocity: 40 },
    Weapon1: { Power: 125, Precision: 90, Ferocity: 90 },
    Weapon2: { Power: 125, Precision: 90, Ferocity: 90 },
    Weapon2H: { Power: 251, Precision: 179, Ferocity: 179 },
  },
  "Assassin's": {
    Helm: { Power: 45, Precision: 63, Ferocity: 45 },
    Shoulders: { Power: 34, Precision: 47, Ferocity: 34 },
    Chest: { Power: 101, Precision: 141, Ferocity: 101 },
    Gloves: { Power: 34, Precision: 47, Ferocity: 34 },
    Leggins: { Power: 67, Precision: 94, Ferocity: 67 },
    Boots: { Power: 34, Precision: 47, Ferocity: 34 },
    Amulet: { Power: 108, Precision: 157, Ferocity: 108 },
    Ring1: { Power: 85, Precision: 126, Ferocity: 85 },
    Ring2: { Power: 85, Precision: 126, Ferocity: 85 },
    Accessory1: { Power: 74, Precision: 110, Ferocity: 74 },
    Accessory2: { Power: 74, Precision: 110, Ferocity: 74 },
    Back: { Power: 40, Precision: 63, Ferocity: 40 },
    Weapon1: { Power: 90, Precision: 125, Ferocity: 90 },
    Weapon2: { Power: 90, Precision: 125, Ferocity: 90 },
    Weapon2H: { Power: 179, Precision: 251, Ferocity: 179 },
  },
  "Diviner's": {
    Helm: { Power: 54, Precision: 30, Ferocity: 30, Concentration: 54 },
    Shoulders: { Power: 40, Precision: 22, Ferocity: 22, Concentration: 40 },
    Chest: { Power: 121, Precision: 67, Ferocity: 67, Concentration: 121 },
    Gloves: { Power: 40, Precision: 22, Ferocity: 22, Concentration: 40 },
    Leggins: { Power: 81, Precision: 44, Ferocity: 44, Concentration: 81 },
    Boots: { Power: 40, Precision: 22, Ferocity: 22, Concentration: 40 },
    Amulet: { Power: 133, Precision: 71, Ferocity: 71, Concentration: 133 },
    Ring1: { Power: 106, Precision: 56, Ferocity: 56, Concentration: 106 },
    Ring2: { Power: 106, Precision: 56, Ferocity: 56, Concentration: 106 },
    Accessory1: { Power: 92, Precision: 49, Ferocity: 49, Concentration: 92 },
    Accessory2: { Power: 92, Precision: 49, Ferocity: 49, Concentration: 92 },
    Back: { Power: 52, Precision: 27, Ferocity: 27, Concentration: 52 },
    Weapon1: { Power: 108, Precision: 59, Ferocity: 59, Concentration: 108 },
    Weapon2: { Power: 108, Precision: 59, Ferocity: 59, Concentration: 108 },
    Weapon2H: { Power: 215, Precision: 118, Ferocity: 118, Concentration: 215 },
  },
  "Viper's": {
    Helm: { Power: 54, Precision: 30, "Condition Damage": 54, Expertise: 30 },
    Shoulders: {
      Power: 40,
      Precision: 22,
      "Condition Damage": 40,
      Expertise: 22,
    },
    Chest: {
      Power: 121,
      Precision: 67,
      "Condition Damage": 121,
      Expertise: 67,
    },
    Gloves: { Power: 40, Precision: 22, "Condition Damage": 40, Expertise: 22 },
    Leggins: {
      Power: 81,
      Precision: 44,
      "Condition Damage": 81,
      Expertise: 44,
    },
    Boots: { Power: 40, Precision: 22, "Condition Damage": 40, Expertise: 22 },
    Amulet: {
      Power: 133,
      Precision: 71,
      "Condition Damage": 133,
      Expertise: 71,
    },
    Ring1: {
      Power: 106,
      Precision: 56,
      "Condition Damage": 106,
      Expertise: 56,
    },
    Ring2: {
      Power: 106,
      Precision: 56,
      "Condition Damage": 106,
      Expertise: 56,
    },
    Accessory1: {
      Power: 92,
      Precision: 49,
      "Condition Damage": 92,
      Expertise: 49,
    },
    Accessory2: {
      Power: 92,
      Precision: 49,
      "Condition Damage": 92,
      Expertise: 49,
    },
    Back: { Power: 52, Precision: 27, "Condition Damage": 52, Expertise: 27 },
    Weapon1: {
      Power: 108,
      Precision: 59,
      "Condition Damage": 108,
      Expertise: 59,
    },
    Weapon2: {
      Power: 108,
      Precision: 59,
      "Condition Damage": 108,
      Expertise: 59,
    },
    Weapon2H: {
      Power: 215,
      Precision: 118,
      "Condition Damage": 215,
      Expertise: 118,
    },
  },
  Grieving: {
    Helm: { Power: 54, Precision: 30, Ferocity: 30, "Condition Damage": 54 },
    Shoulders: {
      Power: 40,
      Precision: 22,
      Ferocity: 22,
      "Condition Damage": 40,
    },
    Chest: { Power: 121, Precision: 67, Ferocity: 67, "Condition Damage": 121 },
    Gloves: { Power: 40, Precision: 22, Ferocity: 22, "Condition Damage": 40 },
    Leggins: { Power: 81, Precision: 44, Ferocity: 44, "Condition Damage": 81 },
    Boots: { Power: 40, Precision: 22, Ferocity: 22, "Condition Damage": 40 },
    Amulet: {
      Power: 133,
      Precision: 71,
      Ferocity: 71,
      "Condition Damage": 133,
    },
    Ring1: { Power: 106, Precision: 56, Ferocity: 56, "Condition Damage": 106 },
    Ring2: { Power: 106, Precision: 56, Ferocity: 56, "Condition Damage": 106 },
    Accessory1: {
      Power: 92,
      Precision: 49,
      Ferocity: 49,
      "Condition Damage": 92,
    },
    Accessory2: {
      Power: 92,
      Precision: 49,
      Ferocity: 49,
      "Condition Damage": 92,
    },
    Back: { Power: 52, Precision: 27, Ferocity: 27, "Condition Damage": 52 },
    Weapon1: {
      Power: 108,
      Precision: 59,
      Ferocity: 59,
      "Condition Damage": 108,
    },
    Weapon2: {
      Power: 108,
      Precision: 59,
      Ferocity: 59,
      "Condition Damage": 108,
    },
    Weapon2H: {
      Power: 215,
      Precision: 118,
      Ferocity: 118,
      "Condition Damage": 215,
    },
  },
  "Rampager's": {
    Helm: { Precision: 63, Power: 45, "Condition Damage": 45 },
    Shoulders: { Precision: 47, Power: 34, "Condition Damage": 34 },
    Chest: { Precision: 141, Power: 101, "Condition Damage": 101 },
    Gloves: { Precision: 47, Power: 34, "Condition Damage": 34 },
    Leggins: { Precision: 94, Power: 67, "Condition Damage": 67 },
    Boots: { Precision: 47, Power: 34, "Condition Damage": 34 },
    Amulet: { Precision: 157, Power: 108, "Condition Damage": 108 },
    Ring1: { Precision: 126, Power: 85, "Condition Damage": 85 },
    Ring2: { Precision: 126, Power: 85, "Condition Damage": 85 },
    Accessory1: { Precision: 110, Power: 74, "Condition Damage": 74 },
    Accessory2: { Precision: 110, Power: 74, "Condition Damage": 74 },
    Back: { Precision: 63, Power: 40, "Condition Damage": 40 },
    Weapon1: { Precision: 125, Power: 90, "Condition Damage": 90 },
    Weapon2: { Precision: 125, Power: 90, "Condition Damage": 90 },
    Weapon2H: { Precision: 251, Power: 179, "Condition Damage": 179 },
  },
  Sinister: {
    Helm: { Power: 45, Precision: 45, "Condition Damage": 63 },
    Shoulders: { Power: 34, Precision: 34, "Condition Damage": 47 },
    Chest: { Power: 101, Precision: 101, "Condition Damage": 141 },
    Gloves: { Power: 34, Precision: 34, "Condition Damage": 47 },
    Leggins: { Power: 67, Precision: 67, "Condition Damage": 94 },
    Boots: { Power: 34, Precision: 34, "Condition Damage": 47 },
    Amulet: { Power: 108, Precision: 108, "Condition Damage": 157 },
    Ring1: { Power: 85, Precision: 85, "Condition Damage": 126 },
    Ring2: { Power: 85, Precision: 85, "Condition Damage": 126 },
    Accessory1: { Power: 74, Precision: 74, "Condition Damage": 110 },
    Accessory2: { Power: 74, Precision: 74, "Condition Damage": 110 },
    Back: { Power: 40, Precision: 40, "Condition Damage": 63 },
    Weapon1: { Power: 90, Precision: 90, "Condition Damage": 125 },
    Weapon2: { Power: 90, Precision: 90, "Condition Damage": 125 },
    Weapon2H: { Power: 179, Precision: 179, "Condition Damage": 251 },
  },
  Rabid: {
    Helm: { Toughness: 45, Precision: 45, "Condition Damage": 63 },
    Shoulders: { Toughness: 34, Precision: 34, "Condition Damage": 47 },
    Chest: { Toughness: 101, Precision: 101, "Condition Damage": 141 },
    Gloves: { Toughness: 34, Precision: 34, "Condition Damage": 47 },
    Leggins: { Toughness: 67, Precision: 67, "Condition Damage": 94 },
    Boots: { Toughness: 34, Precision: 34, "Condition Damage": 47 },
    Amulet: { Toughness: 108, Precision: 108, "Condition Damage": 157 },
    Ring1: { Toughness: 85, Precision: 85, "Condition Damage": 126 },
    Ring2: { Toughness: 85, Precision: 85, "Condition Damage": 126 },
    Accessory1: { Toughness: 74, Precision: 74, "Condition Damage": 110 },
    Accessory2: { Toughness: 74, Precision: 74, "Condition Damage": 110 },
    Back: { Toughness: 40, Precision: 40, "Condition Damage": 63 },
    Weapon1: { Toughness: 90, Precision: 90, "Condition Damage": 125 },
    Weapon2: { Toughness: 90, Precision: 90, "Condition Damage": 125 },
    Weapon2H: { Toughness: 179, Precision: 179, "Condition Damage": 251 },
  },
  Dire: {
    Helm: { Toughness: 45, Vitality: 45, "Condition Damage": 63 },
    Shoulders: { Toughness: 34, Vitality: 34, "Condition Damage": 47 },
    Chest: { Toughness: 101, Vitality: 101, "Condition Damage": 141 },
    Gloves: { Toughness: 34, Vitality: 34, "Condition Damage": 47 },
    Leggins: { Toughness: 67, Vitality: 67, "Condition Damage": 94 },
    Boots: { Toughness: 34, Vitality: 34, "Condition Damage": 47 },
    Amulet: { Toughness: 108, Vitality: 108, "Condition Damage": 157 },
    Ring1: { Toughness: 85, Vitality: 85, "Condition Damage": 126 },
    Ring2: { Toughness: 85, Vitality: 85, "Condition Damage": 126 },
    Accessory1: { Toughness: 74, Vitality: 74, "Condition Damage": 110 },
    Accessory2: { Toughness: 74, Vitality: 74, "Condition Damage": 110 },
    Back: { Toughness: 40, Vitality: 40, "Condition Damage": 63 },
    Weapon1: { Toughness: 90, Vitality: 90, "Condition Damage": 125 },
    Weapon2: { Toughness: 90, Vitality: 90, "Condition Damage": 125 },
    Weapon2H: { Toughness: 179, Vitality: 179, "Condition Damage": 251 },
  },
  Celestial: {
    Helm: {
      Power: 30,
      Precision: 30,
      Ferocity: 30,
      Concentration: 30,
      "Condition Damage": 30,
      Expertise: 30,
      Toughness: 30,
    },
    Shoulders: {
      Power: 22,
      Precision: 22,
      Ferocity: 22,
      Concentration: 22,
      "Condition Damage": 22,
      Expertise: 22,
      Toughness: 22,
    },
    Chest: {
      Power: 67,
      Precision: 67,
      Ferocity: 67,
      Concentration: 67,
      "Condition Damage": 67,
      Expertise: 67,
      Toughness: 67,
    },
    Gloves: {
      Power: 22,
      Precision: 22,
      Ferocity: 22,
      Concentration: 22,
      "Condition Damage": 22,
      Expertise: 22,
      Toughness: 22,
    },
    Leggins: {
      Power: 44,
      Precision: 44,
      Ferocity: 44,
      Concentration: 44,
      "Condition Damage": 44,
      Expertise: 44,
      Toughness: 44,
    },
    Boots: {
      Power: 22,
      Precision: 22,
      Ferocity: 22,
      Concentration: 22,
      "Condition Damage": 22,
      Expertise: 22,
      Toughness: 22,
    },
    Amulet: {
      Power: 72,
      Precision: 72,
      Ferocity: 72,
      Concentration: 72,
      "Condition Damage": 72,
      Expertise: 72,
      Toughness: 72,
    },
    Ring1: {
      Power: 57,
      Precision: 57,
      Ferocity: 57,
      Concentration: 57,
      "Condition Damage": 57,
      Expertise: 57,
      Toughness: 57,
    },
    Ring2: {
      Power: 57,
      Precision: 57,
      Ferocity: 57,
      Concentration: 57,
      "Condition Damage": 57,
      Expertise: 57,
      Toughness: 57,
    },
    Accessory1: {
      Power: 50,
      Precision: 50,
      Ferocity: 50,
      Concentration: 50,
      "Condition Damage": 50,
      Expertise: 50,
      Toughness: 50,
    },
    Accessory2: {
      Power: 50,
      Precision: 50,
      Ferocity: 50,
      Concentration: 50,
      "Condition Damage": 50,
      Expertise: 50,
      Toughness: 50,
    },
    Back: {
      Power: 28,
      Precision: 28,
      Ferocity: 28,
      Concentration: 28,
      "Condition Damage": 28,
      Expertise: 28,
      Toughness: 28,
    },
    Weapon1: {
      Power: 59,
      Precision: 59,
      Ferocity: 59,
      Concentration: 59,
      "Condition Damage": 59,
      Expertise: 59,
      Toughness: 59,
    },
    Weapon2: {
      Power: 59,
      Precision: 59,
      Ferocity: 59,
      Concentration: 59,
      "Condition Damage": 59,
      Expertise: 59,
      Toughness: 59,
    },
    Weapon2H: {
      Power: 118,
      Precision: 118,
      Ferocity: 118,
      Concentration: 118,
      "Condition Damage": 118,
      Expertise: 118,
      Toughness: 118,
    },
  },
  "Dragon's": {
    Helm: { Power: 54, Precision: 30, Ferocity: 54, Vitality: 30 },
    Shoulders: { Power: 40, Precision: 22, Ferocity: 40, Vitality: 22 },
    Chest: { Power: 121, Precision: 67, Ferocity: 121, Vitality: 67 },
    Gloves: { Power: 40, Precision: 22, Ferocity: 40, Vitality: 22 },
    Leggins: { Power: 81, Precision: 44, Ferocity: 81, Vitality: 44 },
    Boots: { Power: 40, Precision: 22, Ferocity: 40, Vitality: 22 },
    Amulet: { Power: 133, Precision: 71, Ferocity: 133, Vitality: 71 },
    Ring1: { Power: 106, Precision: 56, Ferocity: 106, Vitality: 56 },
    Ring2: { Power: 106, Precision: 56, Ferocity: 106, Vitality: 56 },
    Accessory1: { Power: 92, Precision: 49, Ferocity: 92, Vitality: 49 },
    Accessory2: { Power: 92, Precision: 49, Ferocity: 92, Vitality: 49 },
    Back: { Power: 52, Precision: 27, Ferocity: 52, Vitality: 27 },
    Weapon1: { Power: 108, Precision: 59, Ferocity: 108, Vitality: 59 },
    Weapon2: { Power: 108, Precision: 59, Ferocity: 108, Vitality: 59 },
    Weapon2H: { Power: 215, Precision: 118, Ferocity: 215, Vitality: 118 },
  },
  "Ritualist's": {
    Helm: {
      Vitality: 54,
      Concentration: 30,
      "Condition Damage": 54,
      Expertise: 30,
    },
    Shoulders: {
      Vitality: 40,
      Concentration: 22,
      "Condition Damage": 40,
      Expertise: 22,
    },
    Chest: {
      Vitality: 121,
      Concentration: 67,
      "Condition Damage": 121,
      Expertise: 67,
    },
    Gloves: {
      Vitality: 40,
      Concentration: 22,
      "Condition Damage": 40,
      Expertise: 22,
    },
    Leggins: {
      Vitality: 81,
      Concentration: 44,
      "Condition Damage": 81,
      Expertise: 44,
    },
    Boots: {
      Vitality: 40,
      Concentration: 22,
      "Condition Damage": 40,
      Expertise: 22,
    },
    Amulet: {
      Vitality: 133,
      Concentration: 71,
      "Condition Damage": 133,
      Expertise: 71,
    },
    Ring1: {
      Vitality: 106,
      Concentration: 56,
      "Condition Damage": 106,
      Expertise: 56,
    },
    Ring2: {
      Vitality: 106,
      Concentration: 56,
      "Condition Damage": 106,
      Expertise: 56,
    },
    Accessory1: {
      Vitality: 92,
      Concentration: 49,
      "Condition Damage": 92,
      Expertise: 49,
    },
    Accessory2: {
      Vitality: 92,
      Concentration: 49,
      "Condition Damage": 92,
      Expertise: 49,
    },
    Back: {
      Vitality: 52,
      Concentration: 27,
      "Condition Damage": 52,
      Expertise: 27,
    },
    Weapon1: {
      Vitality: 108,
      Concentration: 59,
      "Condition Damage": 108,
      Expertise: 59,
    },
    Weapon2: {
      Vitality: 108,
      Concentration: 59,
      "Condition Damage": 108,
      Expertise: 59,
    },
    Weapon2H: {
      Vitality: 215,
      Concentration: 118,
      "Condition Damage": 215,
      Expertise: 118,
    },
  },
  "Trailblazer's": {
    Helm: {
      Toughness: 54,
      Expertise: 30,
      "Condition Damage": 54,
      Vitality: 30,
    },
    Shoulders: {
      Toughness: 40,
      Expertise: 22,
      "Condition Damage": 40,
      Vitality: 22,
    },
    Chest: {
      Toughness: 121,
      Expertise: 67,
      "Condition Damage": 121,
      Vitality: 67,
    },
    Gloves: {
      Toughness: 40,
      Expertise: 22,
      "Condition Damage": 40,
      Vitality: 22,
    },
    Leggins: {
      Toughness: 81,
      Expertise: 44,
      "Condition Damage": 81,
      Vitality: 44,
    },
    Boots: {
      Toughness: 40,
      Expertise: 22,
      "Condition Damage": 40,
      Vitality: 22,
    },
    Amulet: {
      Toughness: 133,
      Expertise: 71,
      "Condition Damage": 133,
      Vitality: 71,
    },
    Ring1: {
      Toughness: 106,
      Expertise: 56,
      "Condition Damage": 106,
      Vitality: 56,
    },
    Ring2: {
      Toughness: 106,
      Expertise: 56,
      "Condition Damage": 106,
      Vitality: 56,
    },
    Accessory1: {
      Toughness: 92,
      Expertise: 49,
      "Condition Damage": 92,
      Vitality: 49,
    },
    Accessory2: {
      Toughness: 92,
      Expertise: 49,
      "Condition Damage": 92,
      Vitality: 49,
    },
    Back: {
      Toughness: 52,
      Expertise: 27,
      "Condition Damage": 52,
      Vitality: 27,
    },
    Weapon1: {
      Toughness: 108,
      Expertise: 59,
      "Condition Damage": 108,
      Vitality: 59,
    },
    Weapon2: {
      Toughness: 108,
      Expertise: 59,
      "Condition Damage": 108,
      Vitality: 59,
    },
    Weapon2H: {
      Toughness: 215,
      Expertise: 118,
      "Condition Damage": 215,
      Vitality: 118,
    },
  },
};

function sortNames(names) {
  return [...names].sort((a, b) => a.localeCompare(b));
}

export const PREFIXES = sortNames(Object.keys(GEAR_STATS));

export const PREFIX_GROUPS = [
  {
    label: "Power",
    items: PREFIXES.filter(
      (prefix) =>
        !Object.values(GEAR_STATS[prefix]).some((stats) =>
          Object.hasOwn(stats, "Condition Damage"),
        ),
    ),
  },
  {
    label: "Condition",
    items: PREFIXES.filter((prefix) =>
      Object.values(GEAR_STATS[prefix]).some((stats) =>
        Object.hasOwn(stats, "Condition Damage"),
      ),
    ),
  },
];

// Returns the list of effective gear slots for attribute calculation.
// For 2H weapons: Weapon1 is replaced by Weapon2H, Weapon2 is removed.
// `weapons` is the build.weapons array, e.g. ['Staff'] or ['Sword','Dagger'].
export function getActiveGearSlots(weapons, weaponData) {
  const mh = weapons?.[0] || "";
  const is2H = weaponData?.[mh]?.wielding === "2h";
  if (is2H) {
    return GEAR_SLOTS.filter((s) => s !== "Weapon2").map((s) =>
      s === "Weapon1" ? "Weapon2H" : s,
    );
  }
  return [...GEAR_SLOTS];
}

// Maps effective slot names back to display slot names for gear assignment.
// Weapon2H → Weapon1 (since it's the single weapon piece).
export function effectiveSlotToGearSlot(effectiveSlot) {
  return effectiveSlot === "Weapon2H" ? "Weapon1" : effectiveSlot;
}

// ─── Base Stats (level 80) ────────────────────────────────────────────────────
export const BASE_STATS = {
  Power: 1000,
  Precision: 1000,
  Toughness: 1000,
  Vitality: 1000,
};

// ─── Jade Bot Core ────────────────────────────────────────────────────────────
// Tier 10 JBC adds Vitality. In-game this IS included in the conversion pool
// (trait conversions like Elements of Rage operate on full stats including JBC).
export const JBC_BONUS = { Vitality: 235 };

// ─── Infusions ────────────────────────────────────────────────────────────────
export const INFUSION_BONUS = 5;
export const INFUSION_STATS = [
  "Power",
  "Precision",
  "Condition Damage",
  "Expertise",
  "Concentration",
  "Healing Power",
  "Vitality",
  "Toughness",
];

// ─── Rune Data ────────────────────────────────────────────────────────────────
// stats: flat attribute bonuses (feed into conversion pool, treated as "converted")
// durations: percentage bonuses stored as numbers (e.g. 25 = 25%)
export const RUNE_DATA = {
  // ── Power ──
  Dragonhunter: { stats: { Power: 100, Ferocity: 300 }, durations: {} },
  Scholar: { stats: { Power: 175, Ferocity: 225 }, durations: {} },
  // ── Precision ──
  Deadeye: {
    stats: { Power: 175, Precision: 125, Ferocity: 100 },
    durations: {},
  },
  Infiltration: { stats: { Power: 175, Precision: 225 }, durations: {} },
  Thief: { stats: { Precision: 300, "Condition Damage": 100 }, durations: {} },
  Eagle: { stats: { Precision: 175, Ferocity: 225 }, durations: {} },
  Golemancer: { stats: { Precision: 100, Ferocity: 300 }, durations: {} },
  // ── Condition ──
  Trapper: {
    stats: { "Condition Damage": 300 },
    durations: { "Condition Duration": 15 },
  },
  Krait: {
    stats: { "Condition Damage": 175 },
    durations: { "Bleeding Duration": 50 },
  },
  Balthazar: {
    stats: { "Condition Damage": 175 },
    durations: { "Burning Duration": 50 },
  },
  Perplexity: {
    stats: { "Condition Damage": 175 },
    durations: { "Confusion Duration": 50 },
  },
  Thorns: {
    stats: { "Condition Damage": 175 },
    durations: { "Poison Duration": 50 },
  },
  Afflicted: {
    stats: { "Condition Damage": 175 },
    durations: {
      "Condition Duration": 10,
      "Bleeding Duration": 20,
      "Poison Duration": 10,
    },
  },
  Tormenting: {
    stats: { "Condition Damage": 175 },
    durations: { "Torment Duration": 50 },
  },
  // ── Hybrid ──
  "Flame Legion": {
    stats: { Power: 175 },
    durations: { "Burning Duration": 50 },
  },
  Baelfire: {
    stats: { Power: 175 },
    durations: { "Condition Duration": 10, "Burning Duration": 30 },
  },
  "Mad King": {
    stats: { Power: 175 },
    durations: { "Bleeding Duration": 40, "Condition Duration": 5 },
  },
  Elementalist: {
    stats: { Power: 175, "Condition Damage": 225 },
    durations: {},
  },
  Berserker: { stats: { Power: 100, "Condition Damage": 300 }, durations: {} },
  Adventurer: { stats: { Power: 225, "Condition Damage": 175 }, durations: {} },
  Renegade: {
    stats: { Ferocity: 100, "Condition Damage": 300 },
    durations: {},
  },
  Fire: {
    stats: { Power: 175 },
    durations: { "Burning Duration": 20, "Might Duration": 30 },
  },
  // ── Boon Duration ──
  Firebrand: {
    stats: { "Condition Damage": 175 },
    durations: { "Boon Duration": 10, "Quickness Duration": 30 },
  },
  Fireworks: { stats: { Power: 175 }, durations: { "Boon Duration": 25 } },
  Pack: {
    stats: { Power: 175, Precision: 125 },
    durations: { "Boon Duration": 15 },
  },
  Strength: { stats: { Power: 175 }, durations: { "Might Duration": 50 } },
  Aristocracy: {
    stats: { "Condition Damage": 175 },
    durations: { "Might Duration": 50 },
  },
  Rage: { stats: { Ferocity: 300 }, durations: { "Fury Duration": 30 } },
  // ── All Stat ──
  Leadership: {
    stats: {
      Power: 36,
      Precision: 36,
      Ferocity: 36,
      Concentration: 36,
      "Condition Damage": 36,
      Expertise: 36,
      Toughness: 36,
      Vitality: 36,
    },
    durations: { "Boon Duration": 25 },
  },
  Tempest: {
    stats: {
      Power: 36,
      Precision: 36,
      Ferocity: 36,
      Concentration: 36,
      "Condition Damage": 36,
      Expertise: 36,
      Toughness: 36,
      Vitality: 36,
    },
    durations: { "Condition Duration": 25 },
  },
  Weaver: {
    stats: {
      Power: 36,
      Precision: 36,
      Ferocity: 36,
      Concentration: 36,
      "Condition Damage": 36,
      Expertise: 36,
      Toughness: 36,
      Vitality: 36,
    },
    durations: { "Condition Duration": 10, "Burning Duration": 10 },
  },
  Divinity: {
    stats: {
      Power: 78,
      Precision: 78,
      Ferocity: 78,
      Concentration: 78,
      "Condition Damage": 78,
      Expertise: 78,
      Toughness: 78,
      Vitality: 78,
    },
    durations: {},
  },
};

export const RUNE_NAMES = sortNames(Object.keys(RUNE_DATA));

export const RUNE_GROUPS = [
  { label: "Power", items: ["Dragonhunter", "Scholar"] },
  {
    label: "Precision",
    items: ["Deadeye", "Infiltration", "Thief", "Eagle", "Golemancer"],
  },
  {
    label: "Condition",
    items: [
      "Trapper",
      "Krait",
      "Balthazar",
      "Perplexity",
      "Thorns",
      "Afflicted",
      "Tormenting",
    ],
  },
  {
    label: "Hybrid",
    items: [
      "Flame Legion",
      "Baelfire",
      "Mad King",
      "Elementalist",
      "Berserker",
      "Adventurer",
      "Renegade",
      "Fire",
    ],
  },
  {
    label: "Boon Duration",
    items: [
      "Firebrand",
      "Fireworks",
      "Pack",
      "Strength",
      "Aristocracy",
      "Rage",
    ],
  },
  {
    label: "All Stats",
    items: ["Leadership", "Tempest", "Weaver", "Divinity"],
  },
];

// ─── Food Data ────────────────────────────────────────────────────────────────
// isConverted: true  → stats feed into the conversion pool (subject to utility/trait conversions)
// isConverted: false → stats applied after conversions as flat buffs
// durations: percentage bonuses stored as numbers
export const NOURISHMENT_ICON =
  "https://wiki.guildwars2.com/images/c/ca/Nourishment_food.png";

const FOOD_CATALOG = {
  Power: {
    "Plate of Jerk Poultry": {
      isConverted: true,
      stats: { Power: 150 },
      durations: {},
    },
    "Plate of Truffle Steak": {
      isConverted: true,
      stats: { Power: 100, Precision: 70 },
      durations: {},
    },
    "Bowl of Sweet and Spicy Butternut Squash Soup": {
      isConverted: true,
      stats: { Power: 100, Ferocity: 70 },
      durations: {},
    },
    "Bowl of Sawgill Mushroom Risotto": {
      isConverted: true,
      stats: { Precision: 150 },
      durations: {},
    },
    "Bowl of Curry Butternut Squash Soup": {
      isConverted: true,
      stats: { Ferocity: 70, Precision: 100 },
      durations: {},
    },
    "Plate of Coq Au Vin with Salsa": {
      isConverted: true,
      stats: { Power: 100, Precision: 70 },
      durations: {},
      proc: {
        type: "critStrike",
        chance: 0.66,
        icdMs: 2000,
        flatDamage: 325,
        name: "Nourishment",
      },
    },
    "Cilantro Lime Sous-Vide Steak": {
      isConverted: true,
      stats: { Power: 100, Ferocity: 70 },
      durations: {},
      proc: {
        type: "critStrike",
        chance: 0.66,
        icdMs: 2000,
        flatDamage: 325,
        name: "Nourishment",
      },
    },
  },
  Condition: {
    "Plate of Beef Rendang": {
      isConverted: true,
      stats: { "Condition Damage": 100, Expertise: 70 },
      durations: {},
    },
    "Rare Veggie Pizza": {
      isConverted: true,
      stats: { "Condition Damage": 70, Expertise: 100 },
      durations: {},
    },
    "Fishy Rice Bowl": {
      isConverted: true,
      stats: { "Condition Damage": 70 },
      durations: { "Burning Duration": 15 },
    },
    "Bowl of Kimchi Tofu Stew": {
      isConverted: true,
      stats: { "Condition Damage": 70 },
      durations: { "Poison Duration": 15 },
    },
    "Meaty Asparagus Skewer": {
      isConverted: true,
      stats: { "Condition Damage": 70 },
      durations: { "Torment Duration": 15 },
    },
    "Meaty Rice Bowl": {
      isConverted: true,
      stats: { "Condition Damage": 70 },
      durations: { "Bleeding Duration": 15 },
    },
    "Plate of Kimchi Pancakes": {
      isConverted: true,
      stats: { "Condition Damage": 70 },
      durations: { "Bleeding Duration": 15 },
    },
    "Cilantro and Cured Meat Flatbread": {
      isConverted: true,
      stats: { "Condition Damage": 100, Expertise: 70 },
      durations: {},
      proc: {
        type: "critStrike",
        chance: 0.66,
        icdMs: 2000,
        flatDamage: 325,
        name: "Nourishment",
      },
    },
    "Salsa-Topped Veggie Flatbread": {
      isConverted: true,
      stats: { "Condition Damage": 70, Expertise: 100 },
      durations: {},
      proc: {
        type: "critStrike",
        chance: 0.66,
        icdMs: 2000,
        flatDamage: 325,
        name: "Nourishment",
      },
    },
  },
  Hybrid: {
    "Plate of Fire Flank Steak": {
      isConverted: true,
      stats: { Power: 100, "Condition Damage": 70 },
      durations: {},
    },
    "Bowl of Fancy Potato and Leek Soup": {
      isConverted: true,
      stats: { Precision: 100, "Condition Damage": 70 },
      durations: {},
    },
    "Bowl of Truffle Risotto": {
      isConverted: true,
      stats: { Precision: 70, "Condition Damage": 100 },
      durations: {},
    },
    "Bowl of Sweet and Spicy Beans": {
      isConverted: true,
      stats: { Power: 70, "Condition Damage": 100 },
      durations: {},
    },
    "Bowl of Fire Meat Chili": {
      isConverted: true,
      stats: { Precision: 70 },
      durations: { "Burning Duration": 15 },
    },
  },
  Concentration: {
    "Soul Pastry": {
      isConverted: true,
      stats: { Power: 70, Concentration: 100 },
      durations: {},
    },
    "Plate of Eggs Benedict": {
      isConverted: true,
      stats: { Expertise: 70, Concentration: 100 },
      durations: {},
    },
    "Plate of Beef Carpaccio with Salsa Garnish": {
      isConverted: true,
      stats: { Power: 70, Concentration: 100 },
      durations: {},
      proc: {
        type: "critStrike",
        chance: 0.66,
        icdMs: 2000,
        flatDamage: 325,
        name: "Nourishment",
      },
    },
    "Salsa Eggs Benedict": {
      isConverted: true,
      stats: { Expertise: 70, Concentration: 100 },
      durations: {},
      proc: {
        type: "critStrike",
        chance: 0.66,
        icdMs: 2000,
        flatDamage: 325,
        name: "Nourishment",
      },
    },
  },
  "All Stats": {
    "Dragon's Revelry Starcake": {
      isConverted: false,
      stats: {
        Power: 45,
        Ferocity: 45,
        Precision: 45,
        "Condition Damage": 45,
        Expertise: 45,
        Vitality: 45,
        Toughness: 45,
        Concentration: 45,
      },
      durations: {},
    },
    "Spherified Cilantro Oyster Soup": {
      isConverted: true,
      stats: {
        Power: 45,
        Ferocity: 45,
        Precision: 45,
        "Condition Damage": 45,
        Expertise: 45,
        Vitality: 45,
        Toughness: 45,
        Concentration: 45,
      },
      durations: {},
      proc: {
        type: "critStrike",
        chance: 0.66,
        icdMs: 2000,
        flatDamage: 325,
        name: "Nourishment",
      },
    },
  },
};

export const FOOD_DATA = Object.fromEntries(
  Object.values(FOOD_CATALOG).flatMap((foods) => Object.entries(foods)),
);

export const FOOD_NAMES = sortNames(Object.keys(FOOD_DATA));

export const FOOD_GROUPS = Object.entries(FOOD_CATALOG).map(
  ([label, foods]) => ({
    label,
    items: Object.keys(foods),
  }),
);

// ─── Utility Conversions ─────────────────────────────────────────────────────
// Percentage of the source stat (from conversion base pool) added to target stat.
// Rates come from Utility_conversions.csv.
export const UTILITY_CONVERSION_RATES = {
  Power: 3,
  Precision: 3,
  Toughness: 3,
  Vitality: 3,
  "Condition Damage": 6,
  Ferocity: 6,
  "Healing Power": 6,
  Concentration: 8,
  Expertise: 8,
};

// UTILITY_DATA[name] → array of { to, from } conversion pairs
export const UTILITY_DATA = {
  "Toxic Tuning Crystal": [
    { to: "Condition Damage", from: "Power" },
    { to: "Condition Damage", from: "Precision" },
  ],
  "Potent Lucent Oil": [
    { to: "Concentration", from: "Power" },
    { to: "Concentration", from: "Precision" },
  ],
  "Toxic Maintenance Oil": [
    { to: "Concentration", from: "Power" },
    { to: "Concentration", from: "Condition Damage" },
  ],
  "Toxic Sharpening Stone": [
    { to: "Power", from: "Condition Damage" },
    { to: "Power", from: "Expertise" },
  ],
  "Furious Sharpening Stone": [
    { to: "Power", from: "Precision" },
    { to: "Ferocity", from: "Precision" },
  ],
  "Furious Tuning Crystal": [
    { to: "Condition Damage", from: "Precision" },
    { to: "Expertise", from: "Precision" },
  ],
  "Superior Sharpening Stone": [
    { to: "Power", from: "Precision" },
    { to: "Power", from: "Ferocity" },
  ],
  "Magnanimous Tuning Crystal": [
    { to: "Condition Damage", from: "Vitality" },
    { to: "Condition Damage", from: "Toughness" },
  ],
  "Tuning Icicle": [
    { to: "Condition Damage", from: "Precision" },
    { to: "Condition Damage", from: "Expertise" },
  ],
};

export const UTILITY_NAMES = sortNames(Object.keys(UTILITY_DATA));

// ─── Weapon Data ──────────────────────────────────────────────────────────────
// wielding: 'mh' = main-hand only, 'oh' = off-hand only,
//           'mh+oh' = either hand, '2h' = two-handed, '-' = special
export const WEAPON_DATA = {
  // Broadly available in either hand; profession catalogs narrow these.
  Axe: { wielding: "mh+oh", weaponStrength: 1000 },
  Dagger: { wielding: "mh+oh", weaponStrength: 1000 },
  Mace: { wielding: "mh+oh", weaponStrength: 1000 },
  Scepter: { wielding: "mh", weaponStrength: 1000 },
  // Main-hand or off-hand
  Sword: { wielding: "mh+oh", weaponStrength: 1000 },
  // Off-hand only
  Focus: { wielding: "oh", weaponStrength: 900 },
  Pistol: { wielding: "mh+oh", weaponStrength: 1000 },
  Shield: { wielding: "oh", weaponStrength: 900 },
  Torch: { wielding: "oh", weaponStrength: 900 },
  Warhorn: { wielding: "oh", weaponStrength: 900 },
  // Two-handed
  Greatsword: { wielding: "2h", weaponStrength: 1100 },
  Hammer: { wielding: "2h", weaponStrength: 1100 },
  Longbow: { wielding: "2h", weaponStrength: 1000 },
  Rifle: { wielding: "2h", weaponStrength: 1150 },
  Shortbow: { wielding: "2h", weaponStrength: 1000 },
  Spear: { wielding: "2h", weaponStrength: 1000 },
  Staff: { wielding: "2h", weaponStrength: 1100 },
  // Special / internal
  Unequipped: { wielding: "-", weaponStrength: 690.5 },
  "Profession mechanic": { wielding: "-", weaponStrength: 1100 },
  //'Conjured Weapon': { wielding: '2h', weaponStrength: 968.5 },
};

// ─── Sigil Data ───────────────────────────────────────────────────────────────
// Stat values are percentages stored as numbers (e.g. 7 = 7%).
// Only non-zero fields are listed; all others default to 0 when accessed with ||0.
// Sigils with no stat effect (proc-only: Air, Blight, Earth, Torment, Doom,
// Energy, Geomancy, Hydromancy, Severance) have icons but no numeric effect fields.
export const SIGIL_DATA = {
  Accuracy: {
    criticalChance: 7,
    icon: "https://render.guildwars2.com/file/4B0EFF29FD064E5E93E4F8616BE309A451450AED/220661.png",
  },
  Force: {
    strikeDamageA: 5,
    icon: "https://render.guildwars2.com/file/D7420E430D002E07382035EF0D0F77370C4EE6B8/220662.png",
  },
  Bursting: {
    conditionDamageA: 5,
    icon: "https://render.guildwars2.com/file/7ABFCEDF80329157F734FD56B293765D9B940FAD/619703.png",
  },
  Malice: {
    conditionDuration: 10,
    icon: "https://render.guildwars2.com/file/797D052CB4EA63A61A3225962128D197ACB3ED17/619709.png",
  },
  Agony: {
    bleedingDuration: 20,
    icon: "https://render.guildwars2.com/file/BAF34EB051D118F8A7C1645E0D940ED0660E6269/220658.png",
  },
  Smoldering: {
    burningDuration: 20,
    icon: "https://render.guildwars2.com/file/60AAB7109E5D679901E00DC066774EE5FB3E6052/220659.png",
  },
  Venom: {
    poisonDuration: 20,
    icon: "https://render.guildwars2.com/file/080B4F940A05E60A084AA4B1D230F923A1A47CEC/220664.png",
  },
  Demons: {
    tormentDuration: 20,
    icon: "https://render.guildwars2.com/file/52D5D9FE5E0B9091415092A9E21DE830010D2E0E/220674.png",
  },
  Impact: {
    strikeDamageA: 3,
    icon: "https://render.guildwars2.com/file/D9ACA0C94D90A76B1C500D5DE6D62B6820FEDAE2/221170.png",
  },
  Air: {
    icon: "https://render.guildwars2.com/file/C337CC61DF2F5EE44B7D053EFF33059111024444/220676.png",
  },
  Blight: {
    icon: "https://render.guildwars2.com/file/AE0A1C7816B56296FEA527E1D01376491374195A/941026.png",
  },
  Earth: {
    icon: "https://render.guildwars2.com/file/251EE3B8B5ADB8D7F7A35DBAEFABA35AEACDF51B/220677.png",
  },
  Torment: {
    icon: "https://render.guildwars2.com/file/E42EB6198022E5B4D71C5EE41465DD4EB84A0465/665778.png",
  },
  Doom: {
    icon: "https://render.guildwars2.com/file/6CE4D1D6E5392C4CC8BACA595E3393EBF208BEED/220686.png",
  },
  Energy: {
    icon: "https://render.guildwars2.com/file/3A064B97AB7D0E1F1250EFB5F06798A8FE623708/220688.png",
  },
  Geomancy: {
    icon: "https://render.guildwars2.com/file/B79B430645DDF54E6792909A52F5CA40A4911407/220687.png",
  },
  Hydromancy: {
    icon: "https://render.guildwars2.com/file/B5F3E2021863079919299707290698504B5C7E90/220689.png",
  },
  Severance: {
    icon: "https://render.guildwars2.com/file/396D7A5DBFA03BC49C12DAB532C4E34D342F0B51/1766396.png",
  },
  Concentration: {
    boonDuration: 10,
    icon: "https://render.guildwars2.com/file/C501D2CCF95A7B59F15EEDEF9C7D42C2DECE48E7/1201533.png",
  },
};

export const SIGIL_NAMES = sortNames(Object.keys(SIGIL_DATA));

const CONDITION_SIGILS = new Set([
  "Agony",
  "Blight",
  "Bursting",
  "Demons",
  "Doom",
  "Earth",
  "Geomancy",
  "Malice",
  "Smoldering",
  "Torment",
  "Venom",
]);

export const SIGIL_GROUPS = [
  {
    label: "Power",
    items: SIGIL_NAMES.filter((name) => !CONDITION_SIGILS.has(name)),
  },
  {
    label: "Condition",
    items: SIGIL_NAMES.filter((name) => CONDITION_SIGILS.has(name)),
  },
];

export const SIGIL_PROCS = Object.freeze({
  Air: {
    trigger: "crit",
    cooldown: 3,
    effect: "strike",
    coefficient: 1.1,
    weaponStrength: 690.5,
    canCrit: false,
    icon: SIGIL_DATA.Air.icon,
  },
  Torment: {
    trigger: "crit",
    cooldown: 5,
    effect: "condition",
    condition: "Torment",
    stacks: 2,
    duration: 5,
    icon: SIGIL_DATA.Torment.icon,
  },
  Earth: {
    trigger: "crit",
    cooldown: 2,
    effect: "condition",
    condition: "Bleeding",
    stacks: 1,
    duration: 6,
    icon: SIGIL_DATA.Earth.icon,
  },
  Blight: {
    trigger: "crit",
    cooldown: 8,
    effect: "condition",
    condition: "Poisoned",
    stacks: 2,
    duration: 4,
    icon: SIGIL_DATA.Blight.icon,
  },
  Doom: {
    trigger: "swap",
    cooldown: 9,
    effect: "next-hit-condition",
    condition: "Poisoned",
    stacks: 3,
    duration: 8,
    icon: SIGIL_DATA.Doom.icon,
  },
  Geomancy: {
    trigger: "swap",
    cooldown: 9,
    effect: "strike-condition",
    coefficient: 0.25,
    weaponStrength: 690.5,
    canCrit: true,
    condition: "Bleeding",
    stacks: 3,
    duration: 8,
    icon: SIGIL_DATA.Geomancy.icon,
  },
  Hydromancy: {
    trigger: "swap",
    cooldown: 9,
    effect: "strike-condition",
    coefficient: 1,
    weaponStrength: 690.5,
    canCrit: true,
    condition: "Chilled",
    stacks: 1,
    duration: 2,
    icon: SIGIL_DATA.Hydromancy.icon,
  },
  Energy: {
    trigger: "swap",
    cooldown: 9,
    effect: "endurance",
    icon: SIGIL_DATA.Energy.icon,
  },
  Severance: {
    trigger: "control",
    cooldown: 1,
    effect: "severance",
    duration: 4,
    icon: SIGIL_DATA.Severance.icon,
  },
});

// ─── Relic Data ───────────────────────────────────────────────────────────────
// Proc logic is implemented by the standalone runtime resolver.
// This list controls which relics are available in the UI.
export const RELIC_DATA = {
  Akeem: {
    trigger: "CC enemy with 5+ Torment/Confusion stacks",
    cooldown: 10,
    icon: "https://render.guildwars2.com/file/594C437E9606A167F4F372BCEB0C2B7C7828037B/3122330.png",
  },
  Fireworks: {
    trigger: "Use weapon skill (CD ≥20s)",
    cooldown: 0,
    icon: "https://render.guildwars2.com/file/2999CCF7C94267B2EE3DDA7459050864622927C9/3122349.png",
  },
  Mistburn: { trigger: "At least 10 Might stacks", cooldown: 0 },
  "Mist Stranger": { trigger: "Extra flat damage on every hit", cooldown: 0 },
  Peitha: {
    trigger: "Shadowstep or deception skill",
    cooldown: 4,
    icon: "https://render.guildwars2.com/file/949A6A4179F514FCDEF3AC3D9C292B38D5E0047D/3122365.png",
  },
  Shackles: {
    trigger: "Immobilize an enemy (5s tether, 3.0 strike on expiry)",
    cooldown: 10,
    icon: "https://render.guildwars2.com/file/7946A50DBDC2E45E004AAA801904015C50CC22B3/3745069.png",
  },
  Aristocracy: {
    trigger: "Apply weakness or vulnerability",
    cooldown: 1,
    icon: "https://render.guildwars2.com/file/BCC01F0B6616FE26ED4BE159532A6A6FBD0EA2D8/3122332.png",
  },
  Brawler: {
    trigger:
      "Grant yourself Protection or Resolution (+10% strike damage for 4s)",
    cooldown: 8,
    icon: "https://render.guildwars2.com/file/2B5297A932F55DA3BDDD0A39C9CB0D9CF70244A1/3122334.png",
  },
  Claw: {
    trigger: "CC enemy",
    cooldown: 0,
    icon: "https://render.guildwars2.com/file/19B5DB56E495C70754A8BE3621CADC0FD7402845/3375220.png",
  },
  Dragonhunter: {
    trigger:
      "Hit a foe with a trap skill (+10% strike damage and condition duration for 5s)",
    cooldown: 0,
    icon: "https://render.guildwars2.com/file/F61EEC535059F1FA027049AB4DEFCD5465405DB7/3122344.png",
  },
  Eagle: {
    trigger: "Enemy below 50% HP",
    cooldown: 0,
    icon: "https://render.guildwars2.com/file/DFF4EB43AD0803F60D105658052321A0BE1AF02C/3592832.png",
  },
  Fractal: {
    trigger: "Apply bleeding on enemy with 6+ bleed stacks",
    cooldown: 20,
    icon: "https://render.guildwars2.com/file/B2D409644147BF18935A95A52505ABCB9EECE142/3122351.png",
  },
  Thorns: {
    trigger: "Gain Condition Damage when struck by enemies",
    cooldown: 5,
    icon: "https://wiki.guildwars2.com/images/8/8a/Relic_of_Thorns.png",
  },
  Thief: {
    trigger: "Use weapon skill with CD or resource cost",
    cooldown: 0,
    icon: "https://render.guildwars2.com/file/3523AC08EB04347CF371E9A91F4B985D12FB4ED3/3122371.png",
  },
};

function derivedProfessionWielding(catalog, weapon, fallback) {
  const explicit = catalog?.weaponHands?.get?.(weapon);
  if (explicit) return explicit;
  if (fallback === "2h" || fallback === "-") return fallback;

  const slots = (catalog?.skills || [])
    .filter((skill) => skill.weapon === weapon)
    .map((skill) => String(skill.slot || ""));
  const mainHand = slots.some((slot) => /^Weapon_[1-3]$/.test(slot));
  const offHand = slots.some((slot) => /^Weapon_[4-5]$/.test(slot));
  if (mainHand && offHand) return "mh+oh";
  if (mainHand) return "mh";
  if (offHand) return "oh";
  return fallback;
}

/**
 * Combines shared weapon-family strength with profession-owned availability.
 */
export function createProfessionWeaponData(
  catalog,
  { weaponData = WEAPON_DATA } = {},
) {
  return Object.freeze(
    Object.fromEntries(
      [...(catalog?.weapons || [])]
        .filter((name) => weaponData[name])
        .map((name) => {
          const shared = weaponData[name];
          return [
            name,
            Object.freeze({
              ...shared,
              wielding: derivedProfessionWielding(
                catalog,
                name,
                shared.wielding,
              ),
            }),
          ];
        }),
    ),
  );
}

export const RELIC_NAMES = sortNames(Object.keys(RELIC_DATA));
