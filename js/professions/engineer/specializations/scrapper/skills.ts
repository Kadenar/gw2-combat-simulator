/**
 * Scrapper Engineer skill mechanics.
 *
 * Weapon skills remain Core-owned because Weaponmaster Training makes the
 * physical weapon families profession-wide.
 */
import { ENGINEER_SKILL_IDS as ID } from "../../data/ids.js";
import type { SkillFragment } from "../../../../platform/engine/types.js";
export const SCRAPPER_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> =
  Object.freeze({
    [ID.RECONSTRUCTION_FIELD]: {
      implemented: true,
      castTimeMs: 500,
      cooldown: 25,
      comboFields: [
        {
          ownerId: "engineer",
          fieldType: "Water",
          duration: 2,
          startAnchor: "castEnd",
          inclusiveExpiry: true,
        },
      ],
      effects: [
        {
          type: "boon",
          boon: "protection",
          duration: 2,
          stacks: 1,
        },
      ],
      toolbeltParentName: "Medic Gyro",
      mechanicSlot: 1,
    },
    [ID.BYPASS_COATING]: {
      implemented: true,
      castTimeMs: 0,
      cooldown: 20,
      effects: [],
      toolbeltParentName: "Blast Gyro Tag",
    },
    [ID.PURGE_GYRO]: {
      implemented: true,
      castTimeMs: 0,
      cooldown: 20,
      effects: [],
    },
    [ID.SHREDDER_GYRO]: {
      implemented: true,
      castTimeMs: 500,
      cooldown: 20,
      effects: [
        {
          type: "strike",
          coefficient: 57.599999999999994,
          hits: 12,
          atMs: 42,
          intervalMs: 42,
          timingAnchor: "castStart",
          timingScale: "cast",
          name: "Shredder Gyro",
          actorType: "effect",
        },
      ],
    },
    [ID.DEFENSE_FIELD]: {
      implemented: true,
      castTimeMs: 0,
      cooldown: 25,
      effects: [
        {
          type: "boon",
          boon: "stability",
          duration: 6,
          stacks: 3,
        },
      ],
      toolbeltParentName: "Bulwark Gyro",
    },
    [ID.BULWARK_GYRO]: {
      implemented: true,
      castTimeMs: 0,
      cooldown: 0,
      effects: [],
    },
    [ID.CHEMICAL_FIELD]: {
      implemented: true,
      castTimeMs: 250,
      cooldown: 20,
      effects: [
        {
          type: "condition",
          condition: "Poisoned",
          stacks: 1,
          duration: 8,
          actorType: "player",
        },
      ],
      toolbeltParentName: "Purge Gyro",
    },
    [ID.MEDIC_GYRO]: {
      implemented: true,
      castTimeMs: 500,
      cooldown: 20,
      comboFields: [
        {
          ownerId: "engineer",
          fieldType: "Water",
          duration: 5,
          startAnchor: "castEnd",
          inclusiveExpiry: true,
        },
      ],
      effects: [],
    },
    [ID.SNEAK_GYRO]: {
      implemented: true,
      castTimeMs: 750,
      cooldown: 45,
      effects: [],
    },
    [ID.SPARE_CAPACITOR]: {
      implemented: true,
      castTimeMs: 500,
      cooldown: 24,
      effects: [
        {
          type: "strike",
          coefficient: 4.8,
          hits: 4,
          atMs: 125,
          intervalMs: 125,
          timingAnchor: "castStart",
          timingScale: "cast",
          name: "Spare Capacitor",
          actorType: "player",
        },
      ],
      toolbeltParentName: "Shredder Gyro",
    },
    [ID.BLAST_GYRO]: {
      implemented: true,
      castTimeMs: 250,
      cooldown: 15,
      effects: [
        {
          type: "strike",
          coefficient: 11,
          hits: 4,
          atMs: 63,
          intervalMs: 63,
          timingAnchor: "castStart",
          timingScale: "cast",
          name: "Blast Gyro",
          actorType: "effect",
        },
        {
          type: "control",
          actorType: "effect",
          metadata: {
            controlKind: "stun",
            duration: 3,
          },
        },
        {
          type: "boon",
          boon: "Might",
          duration: 15,
          stacks: 2,
        },
      ],
    },
    [ID.FUNCTION_GYRO]: {
      implemented: true,
      quicknessCastTimeMs: 280,
      cooldown: 25,
      effects: [
        {
          type: "strike",
          coefficient: 1,
          hits: 1,
          name: "Function Gyro (tool belt skill)",
          actorType: "player",
        },
      ],
      mechanicSlot: 5,
    },
    [ID.FUNCTION_GYRO_TOOL_BELT_SKILL]: {
      implemented: true,
      quicknessCastTimeMs: 280,
      cooldown: 25,
      effects: [
        {
          type: "strike",
          coefficient: 1,
          hits: 1,
          name: "Function Gyro (tool belt skill)",
          actorType: "player",
        },
      ],
      mechanicSlot: 5,
    },
    [ID.FUNCTION_GYRO_ID_72103]: {
      implemented: true,
      castTimeMs: 0,
      cooldown: 1,
      effects: [],
    },
    [ID.FUNCTION_GYRO_ID_72114]: {
      implemented: true,
      castTimeMs: 0,
      cooldown: 1,
      effects: [],
    },
  });
