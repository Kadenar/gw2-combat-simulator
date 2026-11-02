/**
 * Owns Evoker familiar basic and empowered skill definitions.
 * Owns their patchable timing, replacement cancellation, tier selection, and basic-to-empowered conversion.
 */
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillDefinition, SkillId } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import {
  BASIC_FAMILIARS,
  FAMILIAR_ELEMENTS
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import {
  IGNITE_TIERS,
  igniteTierEffect,
  projectIgniteEffects
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiar-projection.js';
import { emitResource } from '#gw2/professions/elementalist/specializations/evoker/mechanics/resources.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import type {
  ElementalistModifierContext,
  ElementalistRuntime,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

/**
 * Complete Evoker familiar definitions with explicit activation behavior.
 *
 * The eight familiar skills form four basic/empowered pairs declared in
 * `skill-flips.ts`. Definitions declare their start and commit behavior; gating uses
 * charge/empowered state in `mechanics/availability.ts`, not the `cooldown: 0`
 * declared here.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const EVOKER_FAMILIAR_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ElementalistSkill>>> = {
  [ID.IGNITE]: {
    name: 'Ignite',
    icon: 'https://render.guildwars2.com/file/3C20D2FF75DA624828651AD5CEB463AC90A01207/3680117.png',
    tierResetDuration: 15,
    empoweredUnlockDelay: 0.96,
    // A basic cast within this start-to-start window cancels the preceding empowered activation.
    duration: 2.4,
    type: 'Profession',
    slot: 'Profession_5',
    attunement: 'Fire',

    cooldown: 0,
    skillFamily: 'Familiar',
    castTimeMs: 0,
    effects: impactEffects({ atMs: 880, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.63 },
      { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
    ]),
    // Acceptance advances the Burning tier once and selects that tier's packet for this cast.
    effectVariants: [{ when: () => true, transform: acceptIgniteEffects }],
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      {
        on: 'castStart',
        do: {
          type: 'elementalist.evoker.begin-familiar',
          id: 'burning-tiers',
          // Duration templates are selected at acceptance, never emitted by the lifecycle action.
          effects: [
            { type: 'condition', name: 'Tier 1', condition: CONDITION.BURNING, stacks: 1, duration: 2 },
            { type: 'condition', name: 'Tier 2', condition: CONDITION.BURNING, stacks: 1, duration: 0.5 },
            { type: 'condition', name: 'Tier 3', condition: CONDITION.BURNING, stacks: 1, duration: 1 },
            { type: 'condition', name: 'Tier 4', condition: CONDITION.BURNING, stacks: 1, duration: 1.5 }
          ]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-basic-familiar' } }
    ]
  },
  [ID.CONFLAGRATION]: {
    name: 'Conflagration',
    icon: 'https://render.guildwars2.com/file/D20BEA0141B9C458045D0C77C8CF5C16151B3C5F/3680115.png',
    type: 'Profession',
    slot: 'Profession_5',
    attunement: 'Fire',

    cooldown: 0,
    skillFamily: 'Familiar',
    castTimeMs: 360,
    // A released Conflagration survives cutting the command animation short.
    interruptCommitMs: 320,
    effects: impactEffects(
      { atMs: 1040, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 1.56 },
        {
          type: 'condition',
          condition: CONDITION.BURNING,
          stacks: 2,
          duration: 4.5
        }
      ]
    ),
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-empowered-familiar' } }
    ]
  },
  [ID.SPLASH]: {
    name: 'Splash',
    icon: 'https://render.guildwars2.com/file/2C4C57C5B721422A66D3CEAB4ACE753E4FE69355/3680119.png',
    empoweredUnlockDelay: 0.84,
    // A basic cast within this start-to-start window cancels the preceding empowered activation.
    duration: 2.4,
    type: 'Profession',
    slot: 'Profession_5',
    attunement: 'Water',

    cooldown: 0,
    skillFamily: 'Familiar',
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: BOON.REGENERATION,
        // Share this support boon with affected allies within its recipient cap.
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        stacks: 1,
        duration: 4,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-basic-familiar' } }
    ]
  },
  [ID.BUOYANT_DELUGE]: {
    name: 'Buoyant Deluge',
    icon: 'https://render.guildwars2.com/file/80B7BBD01BFF65A4E29307D59079EF9875119924/3680116.png',
    type: 'Profession',
    slot: 'Profession_5',
    attunement: 'Water',

    cooldown: 0,
    skillFamily: 'Familiar',
    castTimeMs: 360,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.WATER,
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'control',
        atMs: 2200,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: CONTROL.STUN
      }
    ],
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-empowered-familiar' } }
    ]
  },
  [ID.ZAP]: {
    name: 'Zap',
    icon: 'https://render.guildwars2.com/file/234FFB056E376AEE0D6D150A3C23C669BEC0359A/3680120.png',
    empoweredUnlockDelay: 0.68,
    // A basic cast within this start-to-start window cancels the preceding empowered activation.
    duration: 2.3,
    type: 'Profession',
    slot: 'Profession_5',
    attunement: 'Air',

    cooldown: 0,
    skillFamily: 'Familiar',
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
            coefficient: 0.6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      {
        on: 'castCommit',
        do: {
          type: 'elementalist.evoker.zap',
          id: 'zap-window',
          effects: [{ type: 'buff', name: 'Zap Window', kind: 'zap buff', stacks: 1, duration: 5 }]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-basic-familiar' } }
    ]
  },
  [ID.LIGHTNING_BLITZ]: {
    name: 'Lightning Blitz',
    icon: 'https://render.guildwars2.com/file/CF99A0354E3667FDE3702CAEA4C3B6AFB2D6ACFD/3680113.png',
    type: 'Profession',
    slot: 'Profession_5',
    attunement: 'Air',

    cooldown: 0,
    skillFamily: 'Familiar',
    castTimeMs: 360,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [1120, 1360, 1600, 1840, 2080].map((atMs) => ({ atMs, coefficient: 0.28 }))
      },
      {
        type: 'condition',
        ticks: [1120, 1360, 1600, 1840, 2080].map((atMs) => ({
          atMs,
          condition: CONDITION.WEAKNESS,
          stacks: 1,
          duration: 3
        }))
      }
    ]),
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      {
        on: 'castCommit',
        do: {
          type: 'elementalist.evoker.lightning-blitz',
          id: 'electric-enchantment',
          // Keep this charge batch independent of Hare's Agility and trait-granted enchantments.
          effects: [{ type: 'buff', name: 'Lightning Blitz Enchantment', stacks: 1, duration: 6 }]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-empowered-familiar' } }
    ]
  },
  [ID.CALCIFY]: {
    name: 'Calcify',
    icon: 'https://render.guildwars2.com/file/C938A2442A5508F415AB72F70AA9A85AFA57FCDD/3680114.png',
    internalCooldown: 0.25,
    empoweredUnlockDelay: 0.28,
    // A basic cast within this start-to-start window cancels the preceding empowered activation.
    duration: 2.2,
    type: 'Profession',
    slot: 'Profession_5',
    attunement: 'Earth',

    cooldown: 0,
    skillFamily: 'Familiar',
    castTimeMs: 0,
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.65, canCrit: true },
      { type: 'control', applications: 1, controlKind: CONTROL.DAZE }
    ]),
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      {
        on: 'castStart',
        do: {
          type: 'elementalist.evoker.begin-familiar',
          id: 'protection',
          // Equipped Earth passively grants Protection on disables; casting does not emit this payload.
          effects: [
            {
              type: 'boon',
              name: BOON.PROTECTION,
              boon: BOON.PROTECTION,
              stacks: 1,
              duration: 2,
              audience: { recipients: RECIPIENT.SELF }
            }
          ]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-basic-familiar' } }
    ]
  },
  [ID.SEISMIC_IMPACT]: {
    name: 'Seismic Impact',
    icon: 'https://render.guildwars2.com/file/026020B3C3EF9AC03DF8C352E91299562573FCCA/3680118.png',
    type: 'Profession',
    slot: 'Profession_5',
    attunement: 'Earth',

    cooldown: 0,
    skillFamily: 'Familiar',
    castTimeMs: 360,
    effects: impactEffects({ atMs: 2120, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.15,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.BLAST
          }
        ],

        canCrit: true
      },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 6, duration: 10 },
      // The initial knockdown triggers disable passives before the later damage and barrier pulses.
      { type: 'control', applications: 1, controlKind: CONTROL.KNOCKDOWN, atMs: 1320 },
      // The barrier supplies party Protection independently of hitting an enemy; its pulses keep a fixed cadence.
      {
        type: 'boon',
        boon: BOON.PROTECTION,
        stacks: 1,
        duration: 1.5,
        applications: 5,
        atMs: 2320,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ]),
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-empowered-familiar' } }
    ]
  }
};

/** Basic-to-empowered identity; delays and replacement windows belong to the basic skills. */
const FAMILIAR_EMPOWERED_BY_BASIC: ReadonlyMap<SkillId, SkillId> = new Map([
  [ID.IGNITE, ID.CONFLAGRATION],
  [ID.ZAP, ID.LIGHTNING_BLITZ],
  [ID.SPLASH, ID.BUOYANT_DELUGE],
  [ID.CALCIFY, ID.SEISMIC_IMPACT]
]);

/** Reverse index of the flip pairing: empowered familiar ID back to its basic form. */
const FAMILIAR_BASIC_BY_EMPOWERED: ReadonlyMap<SkillId, SkillId> = new Map(
  [...FAMILIAR_EMPOWERED_BY_BASIC].map(([basic, empowered]) => [empowered, basic])
);

/** A skill-declared start owns its reservation and the basic/empowered replacement window. */
export function beginFamiliarCast(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  const state = evokerState.from(context.profession);
  const familiarElement = FAMILIAR_ELEMENTS.get(skill.id);

  // familiar casts block every other action until they finish (enforced in availability.ts)
  if (familiarElement) {
    state.activeFamiliarCast = {
      reservationId: cast.id,
      endsAt: cast.effectiveEnd,
      resetsCharges: BASIC_FAMILIARS.has(skill.id)
    };
  }

  // if the empowered familiar was recently cast and the basic fires within the window, the empowered effects are retroactively cancelled
  const empoweredSkill = FAMILIAR_EMPOWERED_BY_BASIC.get(skill.id);

  if (empoweredSkill) {
    const window = skillNumber(skill, 'duration');
    const basicKey = String(skill.id);
    const recent = state.lastEmpoweredFamiliarByBasic[basicKey];

    if (recent?.skillId === empoweredSkill && cast.start - recent.start < window) {
      context.cancelOwner({ id: recent.activationId, generation: 0 });
      state.cancelledFamiliarActivations[cast.id] = true;
      state.lastEmpoweredFamiliarByBasic[basicKey] = null;
    }
  }

  const basic = FAMILIAR_BASIC_BY_EMPOWERED.get(skill.id);

  if (basic) {
    state.lastEmpoweredFamiliarByBasic[String(basic)] = {
      skillId: skill.id,
      activationId: cast.id,
      start: cast.start
    };
  }
}

/**
 * Advance Ignite's Burning tier once per accepted cast and select that tier's packet. A replaced Ignite keeps the
 * current tier; `modifyFamiliarEffects` removes its packets.
 */
export function acceptIgniteEffects(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  const state = evokerState.from(context.profession);

  if (state.cancelledFamiliarActivations[cast.id]) return effects;

  if (cast.start - state.igniteLastUsedAt >= skillNumber(cast.skill, 'tierResetDuration')) state.igniteTier = 0;

  const burning = igniteTierEffect(context, state.igniteTier);
  state.igniteTier = Math.min(state.igniteTier + 1, IGNITE_TIERS.length - 1);
  state.igniteLastUsedAt = cast.start;
  return projectIgniteEffects(effects, burning);
}

/** Replacement cancellation remains shared across familiar packets, independent of their selected payload. */
export function modifyFamiliarEffects(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  return evokerState.from(context.profession).cancelledFamiliarActivations[cast.id] ? [] : effects;
}

/** Convert basic charges and gate the empowered flip using the selected patch's familiar delay. */
export function settleBasicFamiliar(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>): void {
  const skill = cast.skill;
  const state = evokerState.from(context.profession);
  const at = cast.effectiveEnd;
  context.resourceController.replace('familiarCharges', 0);
  // Complete the conversion before publishing its combined reading or flushing deferred rewards.
  context.resourceController.grant('empoweredCharges', 1);
  const flip = FAMILIAR_EMPOWERED_BY_BASIC.get(skill.id);
  const empowered = flip ? context.helpers.skillsById.get(flip) : undefined;

  if (flip && empowered) {
    const delay = skillNumber(skill, 'empoweredUnlockDelay');
    context.cooldownController.setReadyAt(
      empowered.id,
      Math.max(context.cooldownController.readyAt(empowered.id) || 0, at + delay)
    );
  }

  emitResource(context, cast, skill, state);
}

/** Zap grants its strike bonus only to the Air familiar configuration during its buff. */
export const zapModifiers: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'elementalist.zap',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.03,
    when: (context: ElementalistModifierContext) =>
      context.config?.evokerElement === 'Air' && activeBuffStacks(context, 'zap buff', 1) > 0
  }
]);
