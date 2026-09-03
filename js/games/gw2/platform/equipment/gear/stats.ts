/** Owns equipment slots, prefixes, base attributes, and infusion constants used by build calculation. */
export const GEAR_SLOTS = [
  'Helm',
  'Shoulders',
  'Chest',
  'Gloves',
  'Leggins',
  'Boots',
  'Amulet',
  'Ring1',
  'Ring2',
  'Accessory1',
  'Accessory2',
  'Back',
  'Weapon1',
  'Weapon2'
];

// Maps each prefix to level-80 ascended slot values so selected gear contributes its in-game attributes.
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
    Weapon2H: { Power: 251, Precision: 179, Ferocity: 179 }
  },
  "Zealot's": {
    Helm: { Power: 63, Precision: 45, 'Healing Power': 45 },
    Shoulders: { Power: 47, Precision: 34, 'Healing Power': 34 },
    Chest: { Power: 141, Precision: 101, 'Healing Power': 101 },
    Gloves: { Power: 47, Precision: 34, 'Healing Power': 34 },
    Leggins: { Power: 94, Precision: 67, 'Healing Power': 67 },
    Boots: { Power: 47, Precision: 34, 'Healing Power': 34 },
    Amulet: { Power: 157, Precision: 108, 'Healing Power': 108 },
    Ring1: { Power: 126, Precision: 85, 'Healing Power': 85 },
    Ring2: { Power: 126, Precision: 85, 'Healing Power': 85 },
    Accessory1: { Power: 110, Precision: 74, 'Healing Power': 74 },
    Accessory2: { Power: 110, Precision: 74, 'Healing Power': 74 },
    Back: { Power: 63, Precision: 40, 'Healing Power': 40 },
    Weapon1: { Power: 125, Precision: 90, 'Healing Power': 90 },
    Weapon2: { Power: 125, Precision: 90, 'Healing Power': 90 },
    Weapon2H: { Power: 251, Precision: 179, 'Healing Power': 179 }
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
    Weapon2H: { Power: 179, Precision: 251, Ferocity: 179 }
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
    Weapon2H: { Power: 215, Precision: 118, Ferocity: 118, Concentration: 215 }
  },
  "Viper's": {
    Helm: { Power: 54, Precision: 30, 'Condition Damage': 54, Expertise: 30 },
    Shoulders: {
      Power: 40,
      Precision: 22,
      'Condition Damage': 40,
      Expertise: 22
    },
    Chest: {
      Power: 121,
      Precision: 67,
      'Condition Damage': 121,
      Expertise: 67
    },
    Gloves: { Power: 40, Precision: 22, 'Condition Damage': 40, Expertise: 22 },
    Leggins: {
      Power: 81,
      Precision: 44,
      'Condition Damage': 81,
      Expertise: 44
    },
    Boots: { Power: 40, Precision: 22, 'Condition Damage': 40, Expertise: 22 },
    Amulet: {
      Power: 133,
      Precision: 71,
      'Condition Damage': 133,
      Expertise: 71
    },
    Ring1: {
      Power: 106,
      Precision: 56,
      'Condition Damage': 106,
      Expertise: 56
    },
    Ring2: {
      Power: 106,
      Precision: 56,
      'Condition Damage': 106,
      Expertise: 56
    },
    Accessory1: {
      Power: 92,
      Precision: 49,
      'Condition Damage': 92,
      Expertise: 49
    },
    Accessory2: {
      Power: 92,
      Precision: 49,
      'Condition Damage': 92,
      Expertise: 49
    },
    Back: { Power: 52, Precision: 27, 'Condition Damage': 52, Expertise: 27 },
    Weapon1: {
      Power: 108,
      Precision: 59,
      'Condition Damage': 108,
      Expertise: 59
    },
    Weapon2: {
      Power: 108,
      Precision: 59,
      'Condition Damage': 108,
      Expertise: 59
    },
    Weapon2H: {
      Power: 215,
      Precision: 118,
      'Condition Damage': 215,
      Expertise: 118
    }
  },
  Grieving: {
    Helm: { Power: 54, Precision: 30, Ferocity: 30, 'Condition Damage': 54 },
    Shoulders: {
      Power: 40,
      Precision: 22,
      Ferocity: 22,
      'Condition Damage': 40
    },
    Chest: { Power: 121, Precision: 67, Ferocity: 67, 'Condition Damage': 121 },
    Gloves: { Power: 40, Precision: 22, Ferocity: 22, 'Condition Damage': 40 },
    Leggins: { Power: 81, Precision: 44, Ferocity: 44, 'Condition Damage': 81 },
    Boots: { Power: 40, Precision: 22, Ferocity: 22, 'Condition Damage': 40 },
    Amulet: {
      Power: 133,
      Precision: 71,
      Ferocity: 71,
      'Condition Damage': 133
    },
    Ring1: { Power: 106, Precision: 56, Ferocity: 56, 'Condition Damage': 106 },
    Ring2: { Power: 106, Precision: 56, Ferocity: 56, 'Condition Damage': 106 },
    Accessory1: {
      Power: 92,
      Precision: 49,
      Ferocity: 49,
      'Condition Damage': 92
    },
    Accessory2: {
      Power: 92,
      Precision: 49,
      Ferocity: 49,
      'Condition Damage': 92
    },
    Back: { Power: 52, Precision: 27, Ferocity: 27, 'Condition Damage': 52 },
    Weapon1: {
      Power: 108,
      Precision: 59,
      Ferocity: 59,
      'Condition Damage': 108
    },
    Weapon2: {
      Power: 108,
      Precision: 59,
      Ferocity: 59,
      'Condition Damage': 108
    },
    Weapon2H: {
      Power: 215,
      Precision: 118,
      Ferocity: 118,
      'Condition Damage': 215
    }
  },
  "Rampager's": {
    Helm: { Precision: 63, Power: 45, 'Condition Damage': 45 },
    Shoulders: { Precision: 47, Power: 34, 'Condition Damage': 34 },
    Chest: { Precision: 141, Power: 101, 'Condition Damage': 101 },
    Gloves: { Precision: 47, Power: 34, 'Condition Damage': 34 },
    Leggins: { Precision: 94, Power: 67, 'Condition Damage': 67 },
    Boots: { Precision: 47, Power: 34, 'Condition Damage': 34 },
    Amulet: { Precision: 157, Power: 108, 'Condition Damage': 108 },
    Ring1: { Precision: 126, Power: 85, 'Condition Damage': 85 },
    Ring2: { Precision: 126, Power: 85, 'Condition Damage': 85 },
    Accessory1: { Precision: 110, Power: 74, 'Condition Damage': 74 },
    Accessory2: { Precision: 110, Power: 74, 'Condition Damage': 74 },
    Back: { Precision: 63, Power: 40, 'Condition Damage': 40 },
    Weapon1: { Precision: 125, Power: 90, 'Condition Damage': 90 },
    Weapon2: { Precision: 125, Power: 90, 'Condition Damage': 90 },
    Weapon2H: { Precision: 251, Power: 179, 'Condition Damage': 179 }
  },
  Sinister: {
    Helm: { Power: 45, Precision: 45, 'Condition Damage': 63 },
    Shoulders: { Power: 34, Precision: 34, 'Condition Damage': 47 },
    Chest: { Power: 101, Precision: 101, 'Condition Damage': 141 },
    Gloves: { Power: 34, Precision: 34, 'Condition Damage': 47 },
    Leggins: { Power: 67, Precision: 67, 'Condition Damage': 94 },
    Boots: { Power: 34, Precision: 34, 'Condition Damage': 47 },
    Amulet: { Power: 108, Precision: 108, 'Condition Damage': 157 },
    Ring1: { Power: 85, Precision: 85, 'Condition Damage': 126 },
    Ring2: { Power: 85, Precision: 85, 'Condition Damage': 126 },
    Accessory1: { Power: 74, Precision: 74, 'Condition Damage': 110 },
    Accessory2: { Power: 74, Precision: 74, 'Condition Damage': 110 },
    Back: { Power: 40, Precision: 40, 'Condition Damage': 63 },
    Weapon1: { Power: 90, Precision: 90, 'Condition Damage': 125 },
    Weapon2: { Power: 90, Precision: 90, 'Condition Damage': 125 },
    Weapon2H: { Power: 179, Precision: 179, 'Condition Damage': 251 }
  },
  Rabid: {
    Helm: { Toughness: 45, Precision: 45, 'Condition Damage': 63 },
    Shoulders: { Toughness: 34, Precision: 34, 'Condition Damage': 47 },
    Chest: { Toughness: 101, Precision: 101, 'Condition Damage': 141 },
    Gloves: { Toughness: 34, Precision: 34, 'Condition Damage': 47 },
    Leggins: { Toughness: 67, Precision: 67, 'Condition Damage': 94 },
    Boots: { Toughness: 34, Precision: 34, 'Condition Damage': 47 },
    Amulet: { Toughness: 108, Precision: 108, 'Condition Damage': 157 },
    Ring1: { Toughness: 85, Precision: 85, 'Condition Damage': 126 },
    Ring2: { Toughness: 85, Precision: 85, 'Condition Damage': 126 },
    Accessory1: { Toughness: 74, Precision: 74, 'Condition Damage': 110 },
    Accessory2: { Toughness: 74, Precision: 74, 'Condition Damage': 110 },
    Back: { Toughness: 40, Precision: 40, 'Condition Damage': 63 },
    Weapon1: { Toughness: 90, Precision: 90, 'Condition Damage': 125 },
    Weapon2: { Toughness: 90, Precision: 90, 'Condition Damage': 125 },
    Weapon2H: { Toughness: 179, Precision: 179, 'Condition Damage': 251 }
  },
  Dire: {
    Helm: { Toughness: 45, Vitality: 45, 'Condition Damage': 63 },
    Shoulders: { Toughness: 34, Vitality: 34, 'Condition Damage': 47 },
    Chest: { Toughness: 101, Vitality: 101, 'Condition Damage': 141 },
    Gloves: { Toughness: 34, Vitality: 34, 'Condition Damage': 47 },
    Leggins: { Toughness: 67, Vitality: 67, 'Condition Damage': 94 },
    Boots: { Toughness: 34, Vitality: 34, 'Condition Damage': 47 },
    Amulet: { Toughness: 108, Vitality: 108, 'Condition Damage': 157 },
    Ring1: { Toughness: 85, Vitality: 85, 'Condition Damage': 126 },
    Ring2: { Toughness: 85, Vitality: 85, 'Condition Damage': 126 },
    Accessory1: { Toughness: 74, Vitality: 74, 'Condition Damage': 110 },
    Accessory2: { Toughness: 74, Vitality: 74, 'Condition Damage': 110 },
    Back: { Toughness: 40, Vitality: 40, 'Condition Damage': 63 },
    Weapon1: { Toughness: 90, Vitality: 90, 'Condition Damage': 125 },
    Weapon2: { Toughness: 90, Vitality: 90, 'Condition Damage': 125 },
    Weapon2H: { Toughness: 179, Vitality: 179, 'Condition Damage': 251 }
  },
  Celestial: {
    Helm: {
      Power: 30,
      Precision: 30,
      Ferocity: 30,
      Concentration: 30,
      'Condition Damage': 30,
      Expertise: 30,
      Toughness: 30
    },
    Shoulders: {
      Power: 22,
      Precision: 22,
      Ferocity: 22,
      Concentration: 22,
      'Condition Damage': 22,
      Expertise: 22,
      Toughness: 22
    },
    Chest: {
      Power: 67,
      Precision: 67,
      Ferocity: 67,
      Concentration: 67,
      'Condition Damage': 67,
      Expertise: 67,
      Toughness: 67
    },
    Gloves: {
      Power: 22,
      Precision: 22,
      Ferocity: 22,
      Concentration: 22,
      'Condition Damage': 22,
      Expertise: 22,
      Toughness: 22
    },
    Leggins: {
      Power: 44,
      Precision: 44,
      Ferocity: 44,
      Concentration: 44,
      'Condition Damage': 44,
      Expertise: 44,
      Toughness: 44
    },
    Boots: {
      Power: 22,
      Precision: 22,
      Ferocity: 22,
      Concentration: 22,
      'Condition Damage': 22,
      Expertise: 22,
      Toughness: 22
    },
    Amulet: {
      Power: 72,
      Precision: 72,
      Ferocity: 72,
      Concentration: 72,
      'Condition Damage': 72,
      Expertise: 72,
      Toughness: 72
    },
    Ring1: {
      Power: 57,
      Precision: 57,
      Ferocity: 57,
      Concentration: 57,
      'Condition Damage': 57,
      Expertise: 57,
      Toughness: 57
    },
    Ring2: {
      Power: 57,
      Precision: 57,
      Ferocity: 57,
      Concentration: 57,
      'Condition Damage': 57,
      Expertise: 57,
      Toughness: 57
    },
    Accessory1: {
      Power: 50,
      Precision: 50,
      Ferocity: 50,
      Concentration: 50,
      'Condition Damage': 50,
      Expertise: 50,
      Toughness: 50
    },
    Accessory2: {
      Power: 50,
      Precision: 50,
      Ferocity: 50,
      Concentration: 50,
      'Condition Damage': 50,
      Expertise: 50,
      Toughness: 50
    },
    Back: {
      Power: 28,
      Precision: 28,
      Ferocity: 28,
      Concentration: 28,
      'Condition Damage': 28,
      Expertise: 28,
      Toughness: 28
    },
    Weapon1: {
      Power: 59,
      Precision: 59,
      Ferocity: 59,
      Concentration: 59,
      'Condition Damage': 59,
      Expertise: 59,
      Toughness: 59
    },
    Weapon2: {
      Power: 59,
      Precision: 59,
      Ferocity: 59,
      Concentration: 59,
      'Condition Damage': 59,
      Expertise: 59,
      Toughness: 59
    },
    Weapon2H: {
      Power: 118,
      Precision: 118,
      Ferocity: 118,
      Concentration: 118,
      'Condition Damage': 118,
      Expertise: 118,
      Toughness: 118
    }
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
    Weapon2H: { Power: 215, Precision: 118, Ferocity: 215, Vitality: 118 }
  },
  "Ritualist's": {
    Helm: {
      Vitality: 54,
      Concentration: 30,
      'Condition Damage': 54,
      Expertise: 30
    },
    Shoulders: {
      Vitality: 40,
      Concentration: 22,
      'Condition Damage': 40,
      Expertise: 22
    },
    Chest: {
      Vitality: 121,
      Concentration: 67,
      'Condition Damage': 121,
      Expertise: 67
    },
    Gloves: {
      Vitality: 40,
      Concentration: 22,
      'Condition Damage': 40,
      Expertise: 22
    },
    Leggins: {
      Vitality: 81,
      Concentration: 44,
      'Condition Damage': 81,
      Expertise: 44
    },
    Boots: {
      Vitality: 40,
      Concentration: 22,
      'Condition Damage': 40,
      Expertise: 22
    },
    Amulet: {
      Vitality: 133,
      Concentration: 71,
      'Condition Damage': 133,
      Expertise: 71
    },
    Ring1: {
      Vitality: 106,
      Concentration: 56,
      'Condition Damage': 106,
      Expertise: 56
    },
    Ring2: {
      Vitality: 106,
      Concentration: 56,
      'Condition Damage': 106,
      Expertise: 56
    },
    Accessory1: {
      Vitality: 92,
      Concentration: 49,
      'Condition Damage': 92,
      Expertise: 49
    },
    Accessory2: {
      Vitality: 92,
      Concentration: 49,
      'Condition Damage': 92,
      Expertise: 49
    },
    Back: {
      Vitality: 52,
      Concentration: 27,
      'Condition Damage': 52,
      Expertise: 27
    },
    Weapon1: {
      Vitality: 108,
      Concentration: 59,
      'Condition Damage': 108,
      Expertise: 59
    },
    Weapon2: {
      Vitality: 108,
      Concentration: 59,
      'Condition Damage': 108,
      Expertise: 59
    },
    Weapon2H: {
      Vitality: 215,
      Concentration: 118,
      'Condition Damage': 215,
      Expertise: 118
    }
  },
  "Plaguedoctor's": {
    Helm: {
      'Condition Damage': 54,
      Vitality: 54,
      'Healing Power': 30,
      Concentration: 30
    },
    Shoulders: {
      'Condition Damage': 40,
      Vitality: 40,
      'Healing Power': 22,
      Concentration: 22
    },
    Chest: {
      'Condition Damage': 121,
      Vitality: 121,
      'Healing Power': 67,
      Concentration: 67
    },
    Gloves: {
      'Condition Damage': 40,
      Vitality: 40,
      'Healing Power': 22,
      Concentration: 22
    },
    Leggins: {
      'Condition Damage': 81,
      Vitality: 81,
      'Healing Power': 44,
      Concentration: 44
    },
    Boots: {
      'Condition Damage': 40,
      Vitality: 40,
      'Healing Power': 22,
      Concentration: 22
    },
    Amulet: {
      'Condition Damage': 133,
      Vitality: 133,
      'Healing Power': 71,
      Concentration: 71
    },
    Ring1: {
      'Condition Damage': 106,
      Vitality: 106,
      'Healing Power': 56,
      Concentration: 56
    },
    Ring2: {
      'Condition Damage': 106,
      Vitality: 106,
      'Healing Power': 56,
      Concentration: 56
    },
    Accessory1: {
      'Condition Damage': 92,
      Vitality: 92,
      'Healing Power': 49,
      Concentration: 49
    },
    Accessory2: {
      'Condition Damage': 92,
      Vitality: 92,
      'Healing Power': 49,
      Concentration: 49
    },
    Back: {
      'Condition Damage': 52,
      Vitality: 52,
      'Healing Power': 27,
      Concentration: 27
    },
    Weapon1: {
      'Condition Damage': 108,
      Vitality: 108,
      'Healing Power': 59,
      Concentration: 59
    },
    Weapon2: {
      'Condition Damage': 108,
      Vitality: 108,
      'Healing Power': 59,
      Concentration: 59
    },
    Weapon2H: {
      'Condition Damage': 215,
      Vitality: 215,
      'Healing Power': 118,
      Concentration: 118
    }
  },
  "Trailblazer's": {
    Helm: {
      Toughness: 54,
      Expertise: 30,
      'Condition Damage': 54,
      Vitality: 30
    },
    Shoulders: {
      Toughness: 40,
      Expertise: 22,
      'Condition Damage': 40,
      Vitality: 22
    },
    Chest: {
      Toughness: 121,
      Expertise: 67,
      'Condition Damage': 121,
      Vitality: 67
    },
    Gloves: {
      Toughness: 40,
      Expertise: 22,
      'Condition Damage': 40,
      Vitality: 22
    },
    Leggins: {
      Toughness: 81,
      Expertise: 44,
      'Condition Damage': 81,
      Vitality: 44
    },
    Boots: {
      Toughness: 40,
      Expertise: 22,
      'Condition Damage': 40,
      Vitality: 22
    },
    Amulet: {
      Toughness: 133,
      Expertise: 71,
      'Condition Damage': 133,
      Vitality: 71
    },
    Ring1: {
      Toughness: 106,
      Expertise: 56,
      'Condition Damage': 106,
      Vitality: 56
    },
    Ring2: {
      Toughness: 106,
      Expertise: 56,
      'Condition Damage': 106,
      Vitality: 56
    },
    Accessory1: {
      Toughness: 92,
      Expertise: 49,
      'Condition Damage': 92,
      Vitality: 49
    },
    Accessory2: {
      Toughness: 92,
      Expertise: 49,
      'Condition Damage': 92,
      Vitality: 49
    },
    Back: {
      Toughness: 52,
      Expertise: 27,
      'Condition Damage': 52,
      Vitality: 27
    },
    Weapon1: {
      Toughness: 108,
      Expertise: 59,
      'Condition Damage': 108,
      Vitality: 59
    },
    Weapon2: {
      Toughness: 108,
      Expertise: 59,
      'Condition Damage': 108,
      Vitality: 59
    },
    Weapon2H: {
      Toughness: 215,
      Expertise: 118,
      'Condition Damage': 215,
      Vitality: 118
    }
  }
};

export const PREFIXES = [...Object.keys(GEAR_STATS)].sort((a, b) => a.localeCompare(b));

const GEAR_STATS_LOOKUP = GEAR_STATS as Readonly<
  Record<string, Readonly<Record<string, Readonly<Record<string, number>>>>>
>;

export const PREFIX_GROUPS = [
  {
    label: 'Power',
    items: PREFIXES.filter(
      (prefix) =>
        !Object.values(GEAR_STATS_LOOKUP[prefix] || {}).some((stats) => Object.hasOwn(stats, 'Condition Damage'))
    )
  },
  {
    label: 'Condition',
    items: PREFIXES.filter((prefix) =>
      Object.values(GEAR_STATS_LOOKUP[prefix] || {}).some((stats) => Object.hasOwn(stats, 'Condition Damage'))
    )
  }
];

// ─── Base Stats (level 80) ────────────────────────────────────────────────────
export const BASE_STATS = {
  Power: 1000,
  Precision: 1000,
  Toughness: 1000,
  Vitality: 1000
};

// ─── Jade Bot Core ────────────────────────────────────────────────────────────
// Tier 10 JBC adds Vitality. In-game this IS included in the conversion pool
// (trait conversions like Elements of Rage operate on full stats including JBC).
export const JBC_BONUS = { Vitality: 235 };

// ─── Infusions ────────────────────────────────────────────────────────────────
export const INFUSION_BONUS = 5;
export const INFUSION_STATS = [
  'Power',
  'Precision',
  'Condition Damage',
  'Expertise',
  'Concentration',
  'Healing Power',
  'Vitality',
  'Toughness'
];
