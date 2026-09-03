/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Defines Core heal, utility, elite, turret, and palette-follow-up skill fragments. */
export const ENGINEER_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.HEALING_TURRET]: {
    // Custom: Arms this skill's follow-up palette flip; see `core/mechanics/skill-flips.ts`.
    handlerId: 'engineer.arm-flip',
    paletteFlipSkillId: ID.DETONATE_HEALING_TURRET,
    castTimeMs: 750,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.SUPPLY_CRATE]: {
    castTimeMs: 1000,
    cooldown: 75,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Supply Crate',
        actorType: 'summon'
      },
      {
        type: 'control',
        actorType: 'summon',
        controlKind: 'stun',
        duration: 2
      }
    ]
  },
  [ID.DETONATE_HEALING_TURRET]: {
    // Custom: Consumes the armed follow-up flip and related trait effects; see `core/mechanics/skill-flips.ts`.
    handlerId: 'engineer.consume-flip',
    flipParentName: 'Healing Turret',
    castTimeMs: 0,
    cooldown: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Detonate Healing Turret',
        actorType: 'player'
      }
    ]
  },
  [ID.CLEANSING_BURST]: {
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.THROW_MINE]: {
    // Custom: Arms this skill's follow-up palette flip; see `core/mechanics/skill-flips.ts`.
    handlerId: 'engineer.arm-flip',
    paletteFlipSkillId: ID.DETONATE,
    castTimeMs: 500,
    cooldown: 12,
    rechargeAnchor: 'castStart'
  },
  [ID.DETONATE]: {
    // Custom: Consumes the armed follow-up flip and related trait effects; see `core/mechanics/skill-flips.ts`.
    handlerId: 'engineer.consume-flip',
    flipParentName: 'Throw Mine',
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        damageKind: 'explosion',
        name: 'Detonate (engineer skill)',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'stun',
        duration: 2
      }
    ]
  },
  [ID.DEPLOY_MINE]: {
    castTimeMs: 500,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 1.65,
        hits: 1,
        name: 'Deploy Mine',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'stun',
        duration: 2
      }
    ]
  },
  [ID.PLAGUE]: {
    castTimeMs: 0,
    cooldown: 105,
    effects: [
      {
        type: 'strike',
        coefficient: 0.39,
        hits: 1,
        name: 'Plague',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.A_E_D]: {
    castTimeMs: 750,
    cooldown: 24,
    effects: []
  },
  [ID.DETONATE_SUPPLY_CRATE_TURRETS]: {
    castTimeMs: 0,
    cooldown: 25,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Detonate Supply Crate Turrets',
        actorType: 'player'
      }
    ]
  },
  [ID.OVERCHARGE_SUPPLY_CRATE]: {
    castTimeMs: 0,
    cooldown: 1,
    effects: []
  },
  [ID.THROW_MINE_ID_30337]: {
    castTimeMs: 500,
    cooldown: 12,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Throw Mine',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'stun',
        duration: 2
      }
    ]
  },
  [ID.DEPLOY_MINE_ID_30893]: {
    castTimeMs: 500,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 1.65,
        hits: 1,
        name: 'Deploy Mine',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'stun',
        duration: 2
      }
    ]
  }
});
