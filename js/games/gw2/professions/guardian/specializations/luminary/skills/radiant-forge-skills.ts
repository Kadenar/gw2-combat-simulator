import {
  COMBO_FIELD,
  RECIPIENT,
  COMBO_FINISHER,
  ACTOR,
  AURA,
  CONTROL,
  WEAPON,
  BOON,
  CONDITION
} from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';

import type { CastDetailContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { impactEffects, strikeEffectCoefficient } from '#gw2/platform/effects/authoring.js';
import { effectFirstAt } from '#gw2/platform/effects/materializer.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { SkillEffect, StrikeEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { projectCastRelativeEffectTimingMs, scaleCastBoundTiming } from '#gw2/platform/execution/cast-timing.js';

import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import type { GuardianRuntimeState, GuardianSkill, GuardianRuntime } from '#gw2/professions/guardian/types.js';

/**
 * Owns Radiant Forge weapon fragments.
 * Persistent forge resources and weapon behavior remain under `mechanics/`.
 */

export const LUMINARY_RADIANT_FORGE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Slot 1: autoattack.
  [ID.GLARING_BURST]: {
    // Snapshot the selected weapon before core modifiers, with one cadence change per accepted blade attack.
    effectVariants: [
      {
        when: () => true,
        transform: burstEffects
      }
    ],
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    // The replacement strike lands at 480 ms and remains committed when the
    // action lane is released at the observed 520 ms cancel point.
    interruptCommitMs: 520,
    // Variants follow weapon slots 2–5; shared Vulnerability always follows the selected payload.
    effects: [
      {
        type: 'strike',
        name: 'Radiant Hammer',
        weaponStrengthProfileId: 'transform.radiant-forge',
        coefficient: 1,
        hits: 1,
        metadata: { radiantWeapon: 'hammer' }
      },
      {
        type: 'boon',
        name: boonKey(BOON.REGENERATION),
        boon: BOON.REGENERATION,
        duration: 2,
        audience: { recipients: RECIPIENT.PARTY },
        metadata: { radiantWeapon: 'staff' }
      },
      {
        type: 'strike',
        name: 'Radiant Blade',
        weaponStrengthProfileId: 'transform.radiant-forge',
        coefficient: 1,
        hits: 1,
        metadata: { radiantWeapon: 'blade' }
      },
      {
        type: 'boon',
        name: boonKey(BOON.RESOLUTION),
        boon: BOON.RESOLUTION,
        duration: 1.5,
        audience: { recipients: RECIPIENT.PARTY },
        metadata: { radiantWeapon: 'bulwark' }
      },
      { type: 'condition', name: CONDITION.VULNERABILITY, condition: CONDITION.VULNERABILITY, stacks: 1, duration: 8 }
    ]
  },

  // Slot 2: hammer and its follow-up.
  [ID.DAZZLING_HAMMER]: {
    // Justice and the combo aura have separate admission paths; neither fires as an ordinary cast effect.
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, _cast, effects) =>
          effects.filter((effect) => effect.metadata?.trigger !== 'radiant-justice' && effect.type !== 'aura')
      }
    ],
    // An accepted equip belongs to its captured forge entry, including delayed commitment.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.snapshot-forge' } },
      { on: 'castCommit', do: { type: 'guardian.equip-forge' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.empower-hammer' } }
    ],
    castTimeMs: 480,
    interruptCommitMs: 400,
    // Keep the hammer's boons, strike, and daze together in declaration order.
    effects: [
      ...impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        // Once launched, the hammer's impact, boons and blast combo survive cancellation of its remaining animation.
        {
          type: 'boon',
          boon: BOON.MIGHT,
          stacks: 8,
          duration: 8,
          audience: { recipients: RECIPIENT.PARTY }
        },
        {
          type: 'boon',
          boon: BOON.FURY,
          duration: 6,
          audience: { recipients: RECIPIENT.PARTY }
        },
        {
          weaponStrengthProfileId: 'transform.radiant-forge',
          type: 'strike',
          // Dazzling Hammer grants Light Aura only after this blast successfully finishes a combo.
          reactions: [
            {
              on: 'combo.resolved',
              actor: ACTOR.PLAYER,
              packets: 'each',
              when: (_runtime, trigger) => trigger.event.finisherType === COMBO_FINISHER.BLAST,
              do: { type: 'guardian.hammer-aura' }
            }
          ],
          coefficient: 1.2,
          comboFinishers: [
            {
              ownerId: 'guardian',
              finisherType: COMBO_FINISHER.BLAST,
              // Hammer can encounter a field from cast start through its committed impact, when it grants the aura.
              fieldSelectionAnchor: 'castStart'
            }
          ]
        },
        {
          type: 'control',
          controlKind: CONTROL.DAZE
        }
      ]),
      // Only the successful blast reaction grants this skill-owned aura.
      { type: 'aura', name: AURA.LIGHT, aura: AURA.LIGHT, duration: 4, metadata: { trigger: 'hammer-combo' } },
      // The armed hammer adds one delayed impact, retaining independently patchable strike and condition components.
      ...impactEffects({ atMs: 760, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          name: 'Radiant Justice Strike',
          weaponStrengthProfileId: 'transform.radiant-forge',
          coefficient: 1.5,
          hits: 1,
          metadata: { trigger: 'radiant-justice' }
        },
        {
          type: 'condition',
          name: CONDITION.VULNERABILITY,
          condition: CONDITION.VULNERABILITY,
          stacks: 8,
          duration: 8,
          metadata: { trigger: 'radiant-justice' }
        }
      ])
    ]
  },
  [ID.SHINING_SPIN]: {
    // Only the committed follow-up consumes its own flip.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.SHINING_SPIN } }],
    castTimeMs: 480,
    // The 400 ms strike remains committed when the remaining aftercast is cancelled at 440 ms.
    interruptCommitMs: 440,
    effects: [
      {
        weaponStrengthProfileId: 'transform.radiant-forge',
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1.25 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },

  // Slot 3: staff and its follow-up.
  [ID.LUMINOUS_STAFF]: {
    // Author symbol identity independently of the skill's display text.
    tags: ['symbol'],
    // An accepted equip belongs to its captured forge entry, including delayed commitment.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.snapshot-forge' } },
      { on: 'castCommit', do: { type: 'guardian.equip-forge' } }
    ],
    // An armed Radiant Resolve is consumed by the next accepted staff and travels with that cast's own packets.
    effectVariants: [
      {
        when: (runtime, cast) => !cast.cancelled && luminaryState.from(runtime).radiantResolveArmed,
        transform: (runtime, _cast, effects) => radiantResolveStaff(runtime, effects)
      },
      {
        when: () => true,
        transform: (_runtime, _cast, effects) =>
          effects.filter((effect) => effect.metadata?.trigger !== 'radiant-resolve')
      }
    ],
    castTimeMs: 560,
    // Luminous Staff's symbol creates a four-second Light field on its first pulse.
    comboFields: [
      { ownerId: 'guardian', fieldType: COMBO_FIELD.LIGHT, duration: 4, startMs: 440, startAnchor: 'castStart' }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
        // Allied symbol boons survive a missed hostile pulse.
        {
          type: 'boon',
          audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
          boon: BOON.RESOLUTION,
          duration: 1,
          stacks: 1,
          atMs: 440,
          applications: 4,
          intervalMs: 1000
        },
        // The initial staff impact grants Protection independently of the symbol's Resolution pulses.
        {
          type: 'boon',
          boon: BOON.PROTECTION,
          duration: 4,
          atMs: 440,
          audience: { recipients: RECIPIENT.PARTY }
        },
        {
          weaponStrengthProfileId: 'transform.radiant-forge',
          type: 'strike',
          metadata: { guardianSymbol: true },
          // EVTC records four Quickness packets at 440 ms and fixed one-second intervals.
          coefficient: 1.2 / 4,
          atMs: 440,
          applications: 4,
          intervalMs: 1000,
          name: 'Luminous Staff — Symbol Damage'
        }
      ]),
      // Resolve's one-use grant stays patchable on the staff and is selected only by the empowered cast.
      {
        type: 'boon',
        name: boonKey(BOON.REGENERATION),
        boon: BOON.REGENERATION,
        duration: 4,
        audience: { recipients: RECIPIENT.PARTY },
        metadata: { trigger: 'radiant-resolve' }
      }
    ]
  },
  [ID.RESTORATIVE_GLOW]: {
    // Only the committed follow-up consumes its own flip.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.RESTORATIVE_GLOW } }],
    castTimeMs: 560,
    effects: []
  },

  // Slot 4: blade and its follow-up.
  [ID.GLEAMING_BLADE]: {
    // An accepted equip belongs to its captured forge entry, including delayed commitment.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.snapshot-forge' } },
      { on: 'castCommit', do: { type: 'guardian.equip-forge' } }
    ],
    // An armed Radiant Courage is consumed by the next accepted blade and travels with that cast's own packets.
    effectVariants: [
      {
        when: (runtime, cast) => !cast.cancelled && luminaryState.from(runtime).radiantCourageSwordArmed,
        transform: (runtime, _cast, effects) => radiantCourageBlade(runtime, effects)
      },
      {
        when: () => true,
        transform: (_runtime, _cast, effects) =>
          effects.filter((effect) => effect.metadata?.trigger !== 'radiant-courage')
      }
    ],
    castTimeMs: 840,
    interruptCommitMs: 760,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        weaponStrengthProfileId: 'transform.radiant-forge',
        type: 'strike',
        // Gleaming Blade creates a combo only when its leap lands through an active field.
        ticks: [{ atMs: 760, coefficient: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'guardian',
            finisherType: COMBO_FINISHER.LEAP
          }
        ]
      },
      // Courage's Immobilize travels with the empowered blade's first strike.
      {
        type: 'condition',
        name: CONDITION.IMMOBILIZED,
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 2,
        metadata: { trigger: 'radiant-courage' }
      }
    ]
  },
  [ID.LUCENT_THRUST]: {
    // Only the committed follow-up consumes its own flip.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.LUCENT_THRUST } }],
    castTimeMs: 440,
    // The melee hit blinds; the separate projectile adds damage without a disable.
    effects: [
      {
        weaponStrengthProfileId: 'transform.radiant-forge',
        type: 'strike',
        ticks: [{ atMs: 440, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        weaponStrengthProfileId: 'transform.radiant-forge',
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 0.8 }],
        name: 'Lucent Thrust — Projectile Damage',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      ...impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'condition',
          condition: CONDITION.BLINDNESS,
          stacks: 1,
          duration: 3
        }
      ])
    ]
  },

  // Slot 5: bulwark and its follow-up.
  [ID.RADIANT_BULWARK]: {
    // Stopping the blocking channel preserves its activation boons and radiant weapon equip rewards.
    interruptMode: 'per-packet',
    // An accepted equip belongs to its captured forge entry, including delayed commitment.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.snapshot-forge' } },
      { on: 'castCommit', do: { type: 'guardian.equip-forge' } }
    ],
    castTimeMs: 1360,
    // Shield activation protects nearby allies while the blocking channel runs.
    effects: [
      {
        type: 'boon',
        boon: BOON.AEGIS,
        duration: 4,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        audience: { recipients: RECIPIENT.PARTY }
      }
    ]
  },
  [ID.BRILLIANT_SLAM]: {
    // Only the committed follow-up consumes its own flip.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.BRILLIANT_SLAM } }],
    castTimeMs: 480,
    effects: [
      {
        weaponStrengthProfileId: 'transform.radiant-forge',
        type: 'strike',
        coefficient: 1.2,
        hits: 1
      }
    ]
  },

  // Profession controls: enter and exit the forge.
  [ID.ENTER_RADIANT_FORGE]: {
    // Commit changes the form once through its shared lifetime controller.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.enter-forge' } }],
    castTimeMs: 0,
    // Custom: Enters or exits Radiant Forge and updates forge resources; see `luminary/hooks.ts`.
    inputCategory: 'bar-swap',
    // The form controller consumes these values; ordinary cast packets must not duplicate its lifetime.
    rechargeReduction: 5,
    effectVariants: [{ when: () => true, transform: () => [] }],
    effects: [{ type: 'buff', name: 'radiant-forge', kind: 'radiant-forge', stacks: 1, duration: 20 }]
  },
  [ID.EXIT_RADIANT_FORGE]: {
    // Commit changes the form once through its shared lifetime controller.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.exit-forge' } }],
    castTimeMs: 0,
    // Custom: Enters or exits Radiant Forge and updates forge resources; see `luminary/hooks.ts`.
    inputCategory: 'bar-swap',
    effects: []
  }
});

/** Duration and label inspect the same cadence that selection advances only after acceptance. */
export function glaringBurstDuration(
  runtime: MechanicQueriesOf<GuardianRuntime>,
  skill: Skill,
  duration: number
): number {
  const state = luminaryState.from(runtime);
  return state.radiantWeapon === 'blade'
    ? duration * ((state.glaringBurstSwordSlow ? 680 : 440) / (skill.castTimeMs ?? 600))
    : duration;
}

/** Labels inspect the current Luminary variant before accepted effects advance its cadence. */
export function glaringBurstDetail(context: CastDetailContext<GuardianRuntimeState>): string | undefined {
  const specialization = context.readProfessionState().specialization;

  if (specialization.kind !== 'Luminary') throw new TypeError('Glaring Burst requires Luminary state.');

  const state = specialization.state;
  const label =
    state.radiantWeapon === 'blade'
      ? `Sword (${state.glaringBurstSwordSlow ? 'slow' : 'fast'})`
      : { hammer: WEAPON.HAMMER, staff: WEAPON.STAFF, bulwark: WEAPON.SHIELD }[state.radiantWeapon];
  return label ? `Variant: ${label}` : undefined;
}

/** Capture the Glaring Burst variant once per accepted attack, then use normal packet materialization. */
function burstEffects(
  runtime: GuardianRuntime,
  cast: RuntimeCast<GuardianSkill>,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  if (cast.cancelled) return [];

  const state = luminaryState.from(runtime);
  const weapon = state.radiantWeapon;
  const slow = state.glaringBurstSwordSlow;
  const runtimeMs = (cast.fullEnd - cast.start) * 1000;
  const atMs =
    weapon === 'blade'
      ? runtimeMs * ((slow ? 440 : 360) / (slow ? 680 : 440))
      : projectCastRelativeEffectTimingMs(cast.skill, runtimeMs, 480);

  if (weapon === 'blade') state.glaringBurstSwordSlow = !slow;

  return effects
    .filter((effect) => !effect.metadata?.radiantWeapon || effect.metadata.radiantWeapon === weapon)
    .map((effect) => ({
      ...effect,
      ...(effect.type === 'strike' ? { name: cast.skill.name } : {}),
      atMs,
      timingAnchor: 'castStart',
      timingScale: 'fixed',
      metadata: { radiantWeapon: weapon }
    }));
}

/** A consumed entitlement's payload shares the first strike's timing so impact delay and interruption treat both alike. */
function atFirstStrike(effects: readonly SkillEffect[], trigger: string): readonly SkillEffect[] {
  const impact = effects.find((effect): effect is StrikeEffect => effect.type === 'strike');

  if (!impact) throw new TypeError(`${trigger} requires a radiant weapon strike.`);

  return impactEffects(
    {
      atMs: impact.ticks?.[0]?.atMs ?? impact.atMs,
      timingAnchor: impact.timingAnchor,
      timingScale: impact.timingScale
    },
    effects.filter((effect) => effect.metadata?.trigger === trigger)
  );
}

/** Consume Radiant Courage once at acceptance; this blade's strikes carry its multiplier and immobilize. */
function radiantCourageBlade(runtime: GuardianRuntime, effects: readonly SkillEffect[]): readonly SkillEffect[] {
  luminaryState.from(runtime).radiantCourageSwordArmed = false;

  return [
    ...effects
      .filter((effect) => effect.metadata?.trigger !== 'radiant-courage')
      .map((effect) =>
        effect.type === 'strike'
          ? { ...effect, metadata: { ...effect.metadata, guardianRadiantCourage: true } }
          : effect
      ),
    ...atFirstStrike(effects, 'radiant-courage')
  ];
}

/** Consume Radiant Resolve once at acceptance; the staff's first symbol pulse grants its Regeneration. */
function radiantResolveStaff(runtime: GuardianRuntime, effects: readonly SkillEffect[]): readonly SkillEffect[] {
  luminaryState.from(runtime).radiantResolveArmed = false;

  return [
    ...effects.filter((effect) => effect.metadata?.trigger !== 'radiant-resolve'),
    ...atFirstStrike(effects, 'radiant-resolve')
  ];
}

/** Intrinsic weapon multipliers run after shared additive bonuses using each packet's accepted empowerment. */
export const luminaryWeaponModifiers: readonly Gw2ModifierRule[] = [
  {
    id: 'guardian.shining-spin',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    order: 100,
    when: (context) => context.event?.skillId === ID.SHINING_SPIN && Boolean(context.config?.target?.defiant)
  },
  {
    id: 'guardian.glaring-burst-hammer',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    // Glaring Burst's hammer variant scales its packet after shared additive damage bonuses.
    operation: 'multiply',
    factor: 1.25,
    order: 100,
    when: (context) => context.event?.skillId === ID.GLARING_BURST && context.event.metadata?.radiantWeapon === 'hammer'
  },
  {
    id: 'guardian.gleaming-blade',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    order: 100,
    when: (context) =>
      context.event?.skillId === ID.GLEAMING_BLADE && context.event.metadata?.guardianRadiantCourage === true
  }
];

/** Linked self effects use the packet materializer's scaling and anchor so they resolve with the selected impact. */
export function luminaryImpactAt(cast: RuntimeCast<GuardianSkill>): number {
  const effect = cast.skill.effects?.find(
    (effect) =>
      effect.type === 'strike' && effect.metadata?.trigger !== 'radiant-justice' && strikeEffectCoefficient(effect) > 0
  );

  if (effect?.type !== 'strike') return cast.effectiveEnd;

  return canonicalTime(effectFirstAt(cast.start, cast.fullEnd, scaleCastBoundTiming(cast, cast.skill, effect)));
}
