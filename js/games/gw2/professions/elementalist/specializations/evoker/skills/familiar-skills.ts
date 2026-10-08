import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
/**
 * Owns Evoker familiar basic and empowered skill fragments.
 * Owns their patchable timing, replacement cancellation, tier selection, and basic-to-empowered conversion.
 */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { BalanceProfile, Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/profile-authoring.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
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
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/**
 * Simulator-owned skill definitions merged over the API catalog for Evoker.
 *
 * The eight familiar skills form four basic/empowered pairs linked by
 * `nextChainId`. Definitions declare their start and commit behavior; gating uses
 * charge/empowered state in `mechanics/availability.ts`, not the `cooldown: 0`
 * declared here.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const EVOKER_FAMILIAR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.IGNITE]: {
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castStart', do: { type: 'elementalist.evoker.capture-ignite-tier' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-basic-familiar' } }
    ],
    // The start action snapshots one tier; repeated packet selection cannot increment it again.
    effectVariants: [
      { when: () => true, profileId: PROFILE.ignite, transform: (_runtime, cast) => selectIgniteEffects(cast) }
    ],

    name: 'Ignite',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Fire',
    mechanicSlot: 5,
    categories: ['Familiar'],
    castTimeMs: 0,
    cooldown: 0,
    nextChainId: ID.CONFLAGRATION,
    skillFamily: 'Familiar',
    effects: impactEffects({ atMs: 880, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.63 },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
    ])
  },
  [ID.CONFLAGRATION]: {
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-empowered-familiar' } }
    ],

    name: 'Conflagration',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Fire',
    mechanicSlot: 5,
    categories: ['Familiar'],
    castTimeMs: 360,
    // A released Conflagration survives cutting the command animation short.
    interruptCommitMs: 320,
    cooldown: 0,
    nextChainId: ID.IGNITE,
    skillFamily: 'Familiar',
    effects: impactEffects(
      { atMs: 1040, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 1.56 },
        {
          type: 'condition',
          condition: 'Burning',
          stacks: 2,
          duration: 4.5,
          metadata: {}
        }
      ]
    )
  },
  [ID.SPLASH]: {
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-basic-familiar' } }
    ],

    name: 'Splash',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Water',
    mechanicSlot: 5,
    categories: ['Familiar'],
    castTimeMs: 0,
    cooldown: 0,
    nextChainId: ID.BUOYANT_DELUGE,
    skillFamily: 'Familiar',
    effects: [
      {
        type: 'boon',
        boon: 'Regeneration',
        stacks: 1,
        duration: 4,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.BUOYANT_DELUGE]: {
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-empowered-familiar' } }
    ],

    name: 'Buoyant Deluge',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Water',
    mechanicSlot: 5,
    categories: ['Familiar'],
    castTimeMs: 360,
    cooldown: 0,
    nextChainId: ID.SPLASH,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Water',
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Familiar',
    effects: [
      {
        type: 'control',
        atMs: 2200,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      }
    ]
  },
  [ID.ZAP]: {
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.zap' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-basic-familiar' } }
    ],

    name: 'Zap',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Air',
    mechanicSlot: 5,
    categories: ['Familiar'],
    castTimeMs: 0,
    cooldown: 0,
    nextChainId: ID.LIGHTNING_BLITZ,
    skillFamily: 'Familiar',
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
    ]
  },
  [ID.LIGHTNING_BLITZ]: {
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.lightning-blitz' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-empowered-familiar' } }
    ],

    name: 'Lightning Blitz',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Air',
    mechanicSlot: 5,
    categories: ['Familiar'],
    castTimeMs: 360,
    cooldown: 0,
    nextChainId: ID.ZAP,
    skillFamily: 'Familiar',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [1120, 1360, 1600, 1840, 2080].map((atMs) => ({ atMs, coefficient: 0.28 }))
      },
      {
        type: 'condition',
        ticks: [1120, 1360, 1600, 1840, 2080].map((atMs) => ({ atMs, condition: 'Weakness', stacks: 1, duration: 3 })),
        metadata: {}
      }
    ])
  },
  [ID.CALCIFY]: {
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-basic-familiar' } }
    ],

    name: 'Calcify',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Earth',
    mechanicSlot: 5,
    categories: ['Familiar'],
    castTimeMs: 0,
    cooldown: 0,
    nextChainId: ID.SEISMIC_IMPACT,
    skillFamily: 'Familiar',
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.65, canCrit: true },
      { type: 'control', applications: 1, controlKind: 'crowd-control' }
    ])
  },
  [ID.SEISMIC_IMPACT]: {
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-empowered-familiar' } }
    ],

    name: 'Seismic Impact',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Earth',
    mechanicSlot: 5,
    categories: ['Familiar'],
    castTimeMs: 360,
    cooldown: 0,
    nextChainId: ID.CALCIFY,
    skillFamily: 'Familiar',
    effects: impactEffects({ atMs: 2120, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.15,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {},
        canCrit: true
      },
      { type: 'condition', condition: 'Bleeding', stacks: 6, duration: 10, metadata: {} },
      // The initial knockdown triggers disable passives before the later damage and barrier pulses.
      { type: 'control', applications: 1, controlKind: 'crowd-control', atMs: 1320 },
      // The barrier supplies party Protection independently of hitting an enemy; its pulses keep a fixed cadence.
      {
        type: 'boon',
        boon: 'Protection',
        stacks: 1,
        duration: 1.5,
        applications: 5,
        atMs: 2320,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ])
  }
});

/**
 * Familiar tuning remains registered as profiles so patch overrides reach both skills and previews.
 * initialDelay is the flip delay after basic completion; durationMultiplier is the
 * empowered-to-basic cancellation window measured between cast starts, both in seconds.
 */
export const familiarBalanceProfiles: readonly BalanceProfile[] = Object.freeze([
  variant(PROFILE.ignite, ID.IGNITE, 'Ignite - Familiar State', {
    initialDelay: 0.96,
    durationMultiplier: 2.4,
    threshold: 15,
    pulseInterval: 1,
    effects: [
      {
        type: 'condition',
        name: 'Tier 1',
        condition: 'Burning',
        stacks: 1,
        duration: 2
      },
      {
        type: 'condition',
        name: 'Tier 2',
        condition: 'Burning',
        stacks: 1,
        duration: 0.5
      },
      {
        type: 'condition',
        name: 'Tier 3',
        condition: 'Burning',
        stacks: 1,
        duration: 1
      },
      {
        type: 'condition',
        name: 'Tier 4',
        condition: 'Burning',
        stacks: 1,
        duration: 1.5
      }
    ]
  }),
  variant(PROFILE.splash, ID.SPLASH, 'Splash - Familiar State', {
    initialDelay: 0.84,
    durationMultiplier: 2.4
  }),
  variant(PROFILE.zap, ID.ZAP, 'Zap - Familiar State', {
    initialDelay: 0.68,
    durationMultiplier: 2.3,
    // The emitter, policy, and damage modifier share this single buff identity.
    effects: [{ type: 'buff', name: 'Zap Window', kind: 'zap buff', stacks: 1, duration: 5 }]
  }),
  variant(PROFILE.lightningBlitz, ID.LIGHTNING_BLITZ, 'Lightning Blitz - Electric Enchantment', {
    resourceGain: 1,
    // This skill's grant has its own lifetime, independent of Galvanic Enchantment and Hare's Agility.
    effects: [{ type: 'buff', name: 'Lightning Blitz Enchantment', duration: 6 }]
  }),
  variant(PROFILE.calcify, ID.CALCIFY, 'Calcify - Familiar State', {
    initialDelay: 0.28,
    durationMultiplier: 2.2,
    // The equipped Earth familiar grants personal Protection on disables, independently of party pulses.
    internalCooldown: 0.25,
    effects: [
      { type: 'boon', name: 'Protection', boon: 'protection', stacks: 1, duration: 2, audience: { recipients: 'self' } }
    ]
  })
]);

/** Basic-to-empowered identity; delays and interruption windows belong to the profiles. */
const FAMILIAR_EMPOWERED_BY_BASIC: ReadonlyMap<SkillId, SkillId> = new Map([
  [ID.IGNITE, ID.CONFLAGRATION],
  [ID.ZAP, ID.LIGHTNING_BLITZ],
  [ID.SPLASH, ID.BUOYANT_DELUGE],
  [ID.CALCIFY, ID.SEISMIC_IMPACT]
]);

/** Balance profile that owns each basic familiar's timing values. */
const FAMILIAR_PROFILE_BY_BASIC: ReadonlyMap<SkillId, SkillId> = new Map([
  [ID.IGNITE, PROFILE.ignite],
  [ID.SPLASH, PROFILE.splash],
  [ID.ZAP, PROFILE.zap],
  [ID.CALCIFY, PROFILE.calcify]
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
  const state = evokerState.from(context);
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
    const window = balanceProfileNumber(
      requireBalanceProfileFromContext(context, FAMILIAR_PROFILE_BY_BASIC.get(skill.id) ?? skill.id),
      'durationMultiplier'
    );
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

const igniteBurningByCast = new WeakMap<RuntimeCast<ElementalistSkill>, SkillEffect | undefined>();
/** Capture and advance the tier once at acceptance; effect selection only reads this immutable choice. */
export function captureIgniteTier(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>): void {
  const state = evokerState.from(context);
  if (state.cancelledFamiliarActivations[cast.id]) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.ignite);
  if (cast.start - state.igniteLastUsedAt >= balanceProfileNumber(profile, 'threshold')) state.igniteTier = 0;
  igniteBurningByCast.set(cast, igniteTierEffect(context, state.igniteTier));
  state.igniteTier = Math.min(state.igniteTier + 1, IGNITE_TIERS.length - 1);
  state.igniteLastUsedAt = cast.start;
}

/** Replacement cancellation remains shared across familiar packets, independent of their selected payload. */
export function modifyFamiliarEffects(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  return evokerState.from(context).cancelledFamiliarActivations[cast.id] ? [] : effects;
}

/** Ignite's definition selects Burning from its accepted tier without advancing state during a query. */
export function selectIgniteEffects(cast: RuntimeCast<ElementalistSkill>): readonly SkillEffect[] {
  return projectIgniteEffects(cast.skill.effects ?? [], igniteBurningByCast.get(cast));
}

/** Convert basic charges and gate the empowered flip using the selected patch's familiar delay. */
export function settleBasicFamiliar(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>): void {
  const skill = cast.skill;
  const state = evokerState.from(context);
  const at = cast.effectiveEnd;
  {
    context.resourceController.replace('familiarCharges', 0);
    // Complete the conversion before publishing its combined reading or flushing deferred rewards.
    context.resourceController.grant('empoweredCharges', 1);
    const flip = FAMILIAR_EMPOWERED_BY_BASIC.get(skill.id);
    const empowered = flip ? context.helpers.skillsById.get(flip) : undefined;
    if (flip && empowered) {
      const delay = balanceProfileNumber(
        requireBalanceProfileFromContext(context, FAMILIAR_PROFILE_BY_BASIC.get(skill.id) ?? skill.id),
        'initialDelay'
      );
      context.cooldownController.setReadyAt(
        empowered.id,
        Math.max(context.cooldownController.readyAt(empowered.id) || 0, at + delay)
      );
    }

    emitResource(context, cast, skill, state);
  }
}
