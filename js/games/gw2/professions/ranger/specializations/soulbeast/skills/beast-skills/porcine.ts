/**
 * Owns Soulbeast merged-pet skill definitions for the Porcine family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { COMBO_FIELD, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
export const SOULBEAST_PORCINE_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.MAUL_ID_41406]: {
    name: 'Maul',
    icon: 'https://render.guildwars2.com/file/24073F5A0566ABE32DFB74204E9FA01025D85D71/104055.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 12,
    beastmodeSkill: true,
    castTimeMs: 560,
    interruptCommitMs: 400,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [400, 440].map((atMs) => ({ atMs, coefficient: 1.1 }))
      },
      {
        type: 'condition',
        // Each impact applies one stack, keeping partial casts consistent with their landed hits.
        ticks: [400, 440].map((atMs) => ({ atMs, condition: CONDITION.BLEEDING, stacks: 1, duration: 6 }))
      }
    ])
  },
  [ID.UNDEAD_PLAGUE]: {
    name: 'Undead Plague',
    icon: 'https://render.guildwars2.com/file/28CBACDF0A6D07087766675435495E087F67BE6F/2604859.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 20,
    beastmodeSkill: true,
    castTimeMs: 680,
    interruptCommitMs: 680,
    comboFields: [
      { ownerId: 'ranger', fieldType: COMBO_FIELD.POISON, duration: 5, startMs: 680, startAnchor: 'castStart' }
    ],
    // The cast launches a five-pulse poison field; later pulses survive the next player action.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      { type: 'strike', ticks: [680, 1680, 2680, 3680, 4680].map((atMs) => ({ atMs, coefficient: 0.2 })) },
      {
        type: 'condition',
        ticks: [680, 1680, 2680, 3680, 4680].map((atMs) => ({
          atMs,
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 4
        }))
      }
    ])
  },
  [ID.BRUTAL_CHARGE_ID_46432]: {
    name: 'Brutal Charge',
    icon: 'https://render.guildwars2.com/file/D89C043113B1B24AE538C6F5DC297924459E3EBA/104054.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 30,
    beastmodeSkill: true,
    // The merged charge occupies the cast lane through travel and recovery; Claw activates on contact.
    castTimeMs: 800,
    effects: impactEffects({ atMs: 680, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.67,
        hits: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKDOWN
      }
    ])
  }
};
