import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

interface PetSkillTiming {
  readonly castTimeMs: number;
  readonly quicknessCastTimeMs: number;
  readonly recoveryMs: number;
  readonly quicknessRecoveryMs: number;
  readonly unbuffedImpactMs: Readonly<Record<number, number>>;
}
interface PetSkillTimingDefinition extends PetSkillTiming {
  /** Restrict measurements to the family members they describe; omitted means every pet with the skill. */
  readonly petNames?: readonly string[];
  /**
   * Measured pet animations replace the skill's authored cast time. Without it, the skill's patchable cast time
   * stays authoritative and this entry supplies only recovery and impact offsets.
   */
  readonly overridesSkillCastTime?: true;
  readonly petOverrides?: Readonly<Record<string, Partial<PetSkillTiming>>>;
}

// Measured pet timings: recovery includes the next-action gap, separately from recharge. Unmeasured autonomous
// attacks declare their recovery beside their pet profile instead. Per-pet measurements override only the fields
// that differ from the skill's measured baseline.
export const RANGER_PET_SKILL_TIMINGS: Readonly<Record<string, PetSkillTimingDefinition>> = Object.freeze({
  [ID.SPIDER_ENTANGLING_WEB]: {
    castTimeMs: 2000,
    recoveryMs: 2120,
    quicknessCastTimeMs: 1360,
    quicknessRecoveryMs: 1440,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true,
    petOverrides: {
      'Jungle Spider': {
        recoveryMs: 2080
      },
      'Black Widow Spider': {
        recoveryMs: 2080
      }
    }
  },
  [ID.FELINE_SLASH]: {
    castTimeMs: 1200,
    quicknessCastTimeMs: 840,
    recoveryMs: 1280,
    quicknessRecoveryMs: 920,
    unbuffedImpactMs: { 280: 400 }
  },
  [ID.FELINE_MAUL]: {
    castTimeMs: 1200,
    quicknessCastTimeMs: 880,
    recoveryMs: 1280,
    quicknessRecoveryMs: 960,
    unbuffedImpactMs: { 360: 520, 560: 760 },
    petOverrides: {
      'Jungle Stalker': {
        recoveryMs: 1240
      },
      Lynx: {
        recoveryMs: 1320
      },
      'Snow Leopard': {
        quicknessRecoveryMs: 1000
      },
      Jaguar: {
        recoveryMs: 1320
      }
    }
  },
  [ID.MOA_PECK]: {
    castTimeMs: 1200,
    recoveryMs: 1280,
    quicknessCastTimeMs: 840,
    quicknessRecoveryMs: 920,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.CANINE_BITE]: {
    castTimeMs: 1400,
    recoveryMs: 1480,
    quicknessCastTimeMs: 960,
    quicknessRecoveryMs: 1040,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.CANINE_CRIPPLING_LEAP]: {
    castTimeMs: 1320,
    recoveryMs: 1400,
    quicknessCastTimeMs: 880,
    quicknessRecoveryMs: 960,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true,
    petOverrides: {
      'Alpine Wolf': {
        quicknessRecoveryMs: 1000
      },
      'Fern Hound': {
        recoveryMs: 1440
      },
      Hyena: {
        recoveryMs: 1440
      },
      Wolf: {
        quicknessRecoveryMs: 1000
      }
    }
  },
  [ID.CANINE_BRUTAL_CHARGE]: {
    castTimeMs: 2160,
    recoveryMs: 2280,
    quicknessCastTimeMs: 1480,
    quicknessRecoveryMs: 1560,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true,
    petOverrides: {
      'Fern Hound': {
        recoveryMs: 2200
      },
      Hyena: {
        recoveryMs: 2240
      },
      Wolf: {
        recoveryMs: 2240
      }
    }
  },
  [ID.URSINE_SLASH]: {
    castTimeMs: 1920,
    recoveryMs: 2000,
    quicknessCastTimeMs: 1320,
    quicknessRecoveryMs: 1400,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.DRAKE_BITE]: {
    castTimeMs: 1400,
    recoveryMs: 1480,
    quicknessCastTimeMs: 960,
    quicknessRecoveryMs: 1040,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.DRAKE_TAIL_SWIPE]: {
    castTimeMs: 1200,
    recoveryMs: 1280,
    quicknessCastTimeMs: 1200,
    quicknessRecoveryMs: 1280,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true,
    petOverrides: {
      'Marsh Drake': {
        quicknessRecoveryMs: 1320
      },
      'Ice Drake': {
        quicknessRecoveryMs: 1320
      },
      'River Drake': {
        recoveryMs: 1320
      }
    }
  },
  [ID.TWIN_DARTS]: {
    castTimeMs: 1800,
    recoveryMs: 1880,
    quicknessCastTimeMs: 880,
    quicknessRecoveryMs: 1280,
    unbuffedImpactMs: {},
    petNames: ['Whiptail Devourer', 'Lashtail Devourer'],
    overridesSkillCastTime: true,
    petOverrides: {
      'Whiptail Devourer': {
        quicknessCastTimeMs: 1200
      },
      'Lashtail Devourer': {
        quicknessCastTimeMs: 1200
      }
    }
  },
  [ID.BIRD_SLASH]: {
    castTimeMs: 2600,
    quicknessCastTimeMs: 1760,
    recoveryMs: 2680,
    quicknessRecoveryMs: 1800,
    // Keep measured unbuffed contacts when the Quickness-authored second contact moves to 360 ms.
    unbuffedImpactMs: { 280: 400, 360: 480 },
    petOverrides: {
      // Hawk cycles average about 1840 ms, including the AI decision gap.
      Hawk: {
        quicknessRecoveryMs: 1840
      },
      Raven: {
        quicknessRecoveryMs: 1840
      },
      Owl: {
        quicknessRecoveryMs: 1840
      },
      Eagle: {
        quicknessRecoveryMs: 1840
      },
      'White Raven': {
        quicknessRecoveryMs: 1840
      }
    }
  },
  [ID.FELINE_BITE]: {
    castTimeMs: 1080,
    quicknessCastTimeMs: 760,
    recoveryMs: 1200,
    quicknessRecoveryMs: 840,
    unbuffedImpactMs: { 400: 560 },
    petOverrides: {
      'Jungle Stalker': {
        recoveryMs: 1160,
        quicknessRecoveryMs: 880
      },
      Lynx: {
        recoveryMs: 1160,
        quicknessRecoveryMs: 880
      },
      'Snow Leopard': {
        recoveryMs: 1160
      },
      Jaguar: {
        recoveryMs: 1120
      },
      Cheetah: {
        recoveryMs: 1160
      },
      'Sand Lion': {
        recoveryMs: 1160
      },
      'White Tiger': {
        recoveryMs: 1160,
        quicknessRecoveryMs: 880
      }
    }
  },
  [ID.MOA_FRENZIED_ATTACK]: {
    castTimeMs: 1520,
    recoveryMs: 1600,
    quicknessCastTimeMs: 1040,
    quicknessRecoveryMs: 1120,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true,
    petOverrides: {
      'Red Moa': {
        quicknessRecoveryMs: 1160
      }
    }
  },
  [ID.BIRD_SWOOP]: {
    castTimeMs: 2280,
    quicknessCastTimeMs: 1520,
    recoveryMs: 2360,
    quicknessRecoveryMs: 1600,
    unbuffedImpactMs: { 520: 760 },
    petOverrides: {
      Raven: {
        quicknessCastTimeMs: 1600,
        quicknessRecoveryMs: 1720
      },
      Owl: {
        quicknessCastTimeMs: 1600,
        quicknessRecoveryMs: 1680
      },
      Eagle: {
        quicknessCastTimeMs: 1600,
        quicknessRecoveryMs: 1680
      },
      'White Raven': {
        quicknessCastTimeMs: 1600,
        quicknessRecoveryMs: 1720
      }
    }
  },
  [ID.QUICKENING_SCREECH_PET]: {
    castTimeMs: 2280,
    quicknessCastTimeMs: 1520,
    recoveryMs: 2360,
    quicknessRecoveryMs: 1600,
    unbuffedImpactMs: { 520: 760 },
    petOverrides: {
      Raven: {
        quicknessCastTimeMs: 1560,
        recoveryMs: 2400,
        quicknessRecoveryMs: 1640
      },
      Owl: {
        quicknessCastTimeMs: 1560,
        quicknessRecoveryMs: 1640
      },
      Eagle: {
        quicknessCastTimeMs: 1560,
        quicknessRecoveryMs: 1640
      },
      'White Raven': {
        quicknessCastTimeMs: 1560,
        recoveryMs: 2400,
        quicknessRecoveryMs: 1640
      }
    }
  },
  [ID.SPIT]: {
    castTimeMs: 2000,
    recoveryMs: 2080,
    quicknessCastTimeMs: 833,
    quicknessRecoveryMs: 1440,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true,
    petOverrides: {
      'Forest Spider': {
        quicknessCastTimeMs: 1360
      },
      'Jungle Spider': {
        quicknessCastTimeMs: 1360
      },
      'Cave Spider': {
        quicknessCastTimeMs: 1360
      },
      'Black Widow Spider': {
        quicknessCastTimeMs: 1360
      }
    }
  },
  [ID.SPIDER_POISON_GAS]: {
    castTimeMs: 3000,
    recoveryMs: 3120,
    quicknessCastTimeMs: 2040,
    quicknessRecoveryMs: 2120,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true,
    petOverrides: {
      'Jungle Spider': {
        recoveryMs: 3080,
        quicknessRecoveryMs: 2160
      },
      'Black Widow Spider': {
        recoveryMs: 3080,
        quicknessRecoveryMs: 2160
      }
    }
  },
  [ID.PORCINE_MAUL]: {
    castTimeMs: 1200,
    quicknessCastTimeMs: 1200,
    recoveryMs: 1280,
    quicknessRecoveryMs: 1280,
    unbuffedImpactMs: { '600': 600 },
    petOverrides: {
      Siamoth: {
        recoveryMs: 1320
      }
    }
  },
  [ID.PORCINE_JAB]: {
    castTimeMs: 1400,
    quicknessCastTimeMs: 960,
    recoveryMs: 1480,
    quicknessRecoveryMs: 1040,
    unbuffedImpactMs: { '240': 320 }
  },
  [ID.PORCINE_BRUTAL_CHARGE]: {
    castTimeMs: 1840,
    quicknessCastTimeMs: 1840,
    recoveryMs: 1920,
    quicknessRecoveryMs: 1920,
    unbuffedImpactMs: { '1080': 1080 },
    petOverrides: {
      Warthog: {
        recoveryMs: 1960,
        quicknessRecoveryMs: 1960
      },
      Pig: {
        recoveryMs: 1960
      }
    }
  },
  [ID.FORAGE_ROCK]: {
    castTimeMs: 1200,
    quicknessCastTimeMs: 880,
    recoveryMs: 1240,
    quicknessRecoveryMs: 880,
    unbuffedImpactMs: {}
  },
  [ID.LACERATING_SLASH]: {
    castTimeMs: 2600,
    quicknessCastTimeMs: 1760,
    recoveryMs: 2720,
    quicknessRecoveryMs: 1840,
    unbuffedImpactMs: { 280: 400, 360: 480 }
  },
  [ID.SMOKESCALE_BITE]: {
    castTimeMs: 1680,
    recoveryMs: 1760,
    quicknessCastTimeMs: 1160,
    quicknessRecoveryMs: 1240,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.WYVERN_WING_BUFFET]: {
    castTimeMs: 4080,
    recoveryMs: 5560,
    quicknessCastTimeMs: 2760,
    quicknessRecoveryMs: 3760,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true,
    petOverrides: {
      'Fire Wyvern': {
        recoveryMs: 5480,
        quicknessRecoveryMs: 3680
      }
    }
  },
  [ID.SMOKESCALE_TAKEDOWN]: {
    castTimeMs: 1240,
    recoveryMs: 1320,
    quicknessCastTimeMs: 840,
    quicknessRecoveryMs: 920,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.FURIOUS_POUNCE]: {
    // The input completes at impact; the pet's separate recovery includes the rest of its animation.
    castTimeMs: 1560,
    quicknessCastTimeMs: 1080,
    // Unquickened log activations resume attacks at 2600 ms; impact remains earlier at 1560 ms.
    recoveryMs: 2600,
    quicknessRecoveryMs: 1760,
    unbuffedImpactMs: { 1080: 1560 }
  },
  [ID.WYVERN_WING_SWIPE]: {
    castTimeMs: 1720,
    recoveryMs: 1800,
    quicknessCastTimeMs: 1280,
    quicknessRecoveryMs: 1360,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.BRISTLEBACK_SHARPEN_SPINES]: {
    castTimeMs: 0,
    recoveryMs: 40,
    quicknessCastTimeMs: 0,
    quicknessRecoveryMs: 40,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.WYVERN_TAIL_LASH]: {
    castTimeMs: 1320,
    recoveryMs: 1320,
    quicknessCastTimeMs: 840,
    quicknessRecoveryMs: 960,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true,
    petOverrides: {
      'Fire Wyvern': {
        quicknessRecoveryMs: 920
      }
    }
  },
  [ID.BRISTLEBACK_SPIKE_SHOOT]: {
    castTimeMs: 1360,
    recoveryMs: 1440,
    quicknessCastTimeMs: 920,
    quicknessRecoveryMs: 1040,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.BRISTLEBACK_RAIN_OF_SPIKES]: {
    castTimeMs: 3680,
    recoveryMs: 3760,
    quicknessCastTimeMs: 2480,
    quicknessRecoveryMs: 2600,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.SMOKESCALE_SMOKE_ASSAULT]: {
    castTimeMs: 1520,
    recoveryMs: 1520,
    quicknessCastTimeMs: 1520,
    quicknessRecoveryMs: 1520,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.ROCK_GAZELLE_KICK]: {
    castTimeMs: 2200,
    recoveryMs: 2280,
    quicknessCastTimeMs: 1520,
    quicknessRecoveryMs: 1600,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.ROCK_GAZELLE_CHARGE]: {
    castTimeMs: 1800,
    recoveryMs: 1800,
    quicknessCastTimeMs: 680,
    quicknessRecoveryMs: 1480,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.ROCK_GAZELLE_HEADBUTT]: {
    castTimeMs: 1520,
    recoveryMs: 1600,
    quicknessCastTimeMs: 1080,
    quicknessRecoveryMs: 1160,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.TURTLE_HEAVY_SHOT]: {
    castTimeMs: 3040,
    recoveryMs: 3120,
    quicknessCastTimeMs: 2080,
    quicknessRecoveryMs: 2160,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.PHOENIX_WICKED_BITE]: {
    castTimeMs: 2040,
    recoveryMs: 2120,
    quicknessCastTimeMs: 1400,
    quicknessRecoveryMs: 1480,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.FELINE_PHASE_POUNCE]: {
    castTimeMs: 3360,
    recoveryMs: 3800,
    quicknessCastTimeMs: 2800,
    quicknessRecoveryMs: 2880,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.PHOENIX_DASH]: {
    castTimeMs: 2040,
    recoveryMs: 4080,
    quicknessCastTimeMs: 2040,
    quicknessRecoveryMs: 3280,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.VAMPIRIC_BITE]: {
    castTimeMs: 1400,
    quicknessCastTimeMs: 960,
    recoveryMs: 1480,
    quicknessRecoveryMs: 1000,
    unbuffedImpactMs: { 240: 360 }
  },
  [ID.TURTLE_JADE_CANNON]: {
    castTimeMs: 2000,
    recoveryMs: 2080,
    quicknessCastTimeMs: 1360,
    quicknessRecoveryMs: 1440,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.PHOENIX_WING_BUFFET]: {
    castTimeMs: 3880,
    recoveryMs: 4000,
    quicknessCastTimeMs: 2600,
    quicknessRecoveryMs: 2680,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.BLOODTHIRSTY_CHARGE]: {
    castTimeMs: 2480,
    quicknessCastTimeMs: 1680,
    recoveryMs: 3880,
    quicknessRecoveryMs: 2600,
    unbuffedImpactMs: { 400: 560 }
  },
  [ID.UNDEAD_PLAGUE_PET]: {
    castTimeMs: 1200,
    quicknessCastTimeMs: 800,
    recoveryMs: 1280,
    quicknessRecoveryMs: 880,
    // Quickness changes the windup; the emitted cloud still pulses once per second.
    unbuffedImpactMs: { 640: 920, 1640: 1920, 2640: 2920, 3640: 3920, 4640: 4920 }
  },
  [ID.TURTLE_SLAM]: {
    castTimeMs: 4480,
    recoveryMs: 4560,
    quicknessCastTimeMs: 3000,
    quicknessRecoveryMs: 3120,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.WALLOW_MAUL]: {
    castTimeMs: 2560,
    quicknessCastTimeMs: 1720,
    recoveryMs: 2640,
    quicknessRecoveryMs: 1760,
    unbuffedImpactMs: { 680: 1000 }
  },
  [ID.AETHER_HUNTER_BITE]: {
    castTimeMs: 2040,
    quicknessCastTimeMs: 1400,
    recoveryMs: 2120,
    quicknessRecoveryMs: 1480,
    unbuffedImpactMs: { '280': 440 }
  },
  [ID.AETHER_HUNTER_LEY_LINE_VORTEX]: {
    castTimeMs: 4040,
    quicknessCastTimeMs: 4040,
    recoveryMs: 4160,
    quicknessRecoveryMs: 4160,
    unbuffedImpactMs: { '0': 0, '680': 1000, '1360': 2000, '2040': 3000, '2720': 4000 }
  },
  [ID.AETHER_HUNTER_LUNGE]: {
    castTimeMs: 1480,
    quicknessCastTimeMs: 1480,
    recoveryMs: 1560,
    quicknessRecoveryMs: 1560,
    unbuffedImpactMs: { '200': 200 }
  },
  [ID.DIMENSION_BREACH]: {
    castTimeMs: 3000,
    quicknessCastTimeMs: 2040,
    recoveryMs: 3040,
    quicknessRecoveryMs: 2120,
    unbuffedImpactMs: { '880': 1280 }
  },
  [ID.CHAK_ELECTROCUTE]: {
    castTimeMs: 1000,
    recoveryMs: 1080,
    quicknessCastTimeMs: 720,
    quicknessRecoveryMs: 840,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.CHAK_UNLEASH_ENERGY]: {
    castTimeMs: 2040,
    recoveryMs: 2040,
    quicknessCastTimeMs: 1560,
    quicknessRecoveryMs: 1560,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.CHAK_SPIT_GOOP]: {
    castTimeMs: 1840,
    recoveryMs: 1920,
    quicknessCastTimeMs: 1240,
    quicknessRecoveryMs: 1320,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.SPINEGAZER_TORMENTING_VISIONS]: {
    castTimeMs: 4160,
    recoveryMs: 4240,
    quicknessCastTimeMs: 2800,
    quicknessRecoveryMs: 2840,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.SPINEGAZER_EVIL_EYE]: {
    castTimeMs: 2000,
    recoveryMs: 2080,
    quicknessCastTimeMs: 1360,
    quicknessRecoveryMs: 1440,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.SPINEGAZER_STARING_VOID]: {
    castTimeMs: 2200,
    recoveryMs: 2200,
    quicknessCastTimeMs: 2200,
    quicknessRecoveryMs: 2200,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.WARCLAW_BOP]: {
    castTimeMs: 1520,
    recoveryMs: 1640,
    quicknessCastTimeMs: 1080,
    quicknessRecoveryMs: 1160,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.WARCLAW_SLASH]: {
    castTimeMs: 1120,
    recoveryMs: 1200,
    quicknessCastTimeMs: 760,
    quicknessRecoveryMs: 840,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.WARCLAW_BATTLE_MAUL]: {
    castTimeMs: 2400,
    recoveryMs: 2400,
    quicknessCastTimeMs: 2400,
    quicknessRecoveryMs: 2400,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.JANTHIRI_BEE_NIBBLE]: {
    castTimeMs: 2040,
    recoveryMs: 2120,
    quicknessCastTimeMs: 1400,
    quicknessRecoveryMs: 1480,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.JANTHIRI_BEE_BUMBLE]: {
    castTimeMs: 1600,
    recoveryMs: 1680,
    quicknessCastTimeMs: 1120,
    quicknessRecoveryMs: 1200,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.JANTHIRI_BEE_STINGING_SORROW]: {
    castTimeMs: 3200,
    recoveryMs: 3280,
    quicknessCastTimeMs: 2160,
    quicknessRecoveryMs: 2240,
    unbuffedImpactMs: {},
    overridesSkillCastTime: true
  },
  [ID.RAPTOR_SWIFTWING_LEAPING_LIZARD]: {
    castTimeMs: 3120,
    quicknessCastTimeMs: 2120,
    recoveryMs: 3200,
    quicknessRecoveryMs: 2240,
    unbuffedImpactMs: { '1240': 1840 }
  },
  [ID.RAPTOR_SWIFTWING_SAURIAN_MIGHT]: {
    castTimeMs: 2200,
    quicknessCastTimeMs: 1480,
    recoveryMs: 2280,
    quicknessRecoveryMs: 1600,
    unbuffedImpactMs: { '760': 1120 }
  },
  [ID.RAPTOR_SWIFTWING_CLAW]: {
    castTimeMs: 1600,
    quicknessCastTimeMs: 1040,
    recoveryMs: 1680,
    quicknessRecoveryMs: 1120,
    unbuffedImpactMs: { '440': 680, '680': 1000 }
  },
  [ID.PIERCING_SHRIEK]: {
    castTimeMs: 1800,
    quicknessCastTimeMs: 1240,
    recoveryMs: 1920,
    quicknessRecoveryMs: 1320,
    unbuffedImpactMs: { '560': 800 }
  }
});

/** Resolve the selected pet's measurements through one table without extending them to unmeasured pets. */
export function rangerPetSkillTiming(petName: string, skillId: SkillId): PetSkillTiming | undefined {
  const definition = RANGER_PET_SKILL_TIMINGS[skillId];

  if (!definition || (definition.petNames && !definition.petNames.includes(petName))) return undefined;

  const { petNames: _petNames, overridesSkillCastTime: _overrides, petOverrides, ...timing } = definition;
  return { ...timing, ...petOverrides?.[petName] };
}
