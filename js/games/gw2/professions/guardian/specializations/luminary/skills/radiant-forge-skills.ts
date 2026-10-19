import {
  COMBO_FIELD,
  RECIPIENT,
  COMBO_FINISHER,
  ACTOR,
  CONTROL,
  WEAPON,
  BOON,
  CONDITION
} from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';

import type { CastDetailContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { impactEffects, strikeEffectCoefficient } from '#gw2/platform/effects/authoring.js';
import { effectFirstAt } from '#gw2/platform/effects/materializer.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { projectCastRelativeEffectTimingMs, scaleCastBoundTiming } from '#gw2/platform/execution/cast-timing.js';

import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/luminary/profiles.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import type { GuardianRuntimeState, GuardianSkill, GuardianRuntime } from '#gw2/professions/guardian/types.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';

/**
 * Owns Radiant Forge weapon fragments.
 * Persistent forge resources and weapon behavior remain under `mechanics/`.
 */

export const LUMINARY_RADIANT_FORGE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.EXIT_RADIANT_FORGE]: {
    // Commit changes the form once through its shared lifetime controller.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.exit-forge' } }],
    castTimeMs: 0,
    // Custom: Enters or exits Radiant Forge and updates forge resources; see `luminary/hooks.ts`.
    inputCategory: 'bar-swap',
    effects: []
  },
  [ID.LUMINOUS_STAFF]: {
    // Author symbol identity independently of the skill's display text.
    tags: ['symbol'],
    // An accepted equip belongs to its captured forge entry, including delayed commitment.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.snapshot-forge' } },
      { on: 'castCommit', do: { type: 'guardian.equip-forge' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.empower-staff' } }
    ],
    castTimeMs: 560,
    // Luminous Staff's symbol creates a four-second Light field on its first pulse.
    comboFields: [
      { ownerId: 'guardian', fieldType: COMBO_FIELD.LIGHT, duration: 4, startMs: 440, startAnchor: 'castStart' }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
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
    ])
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
  [ID.GLEAMING_BLADE]: {
    // An accepted equip belongs to its captured forge entry, including delayed commitment.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.snapshot-forge' } },
      { on: 'castCommit', do: { type: 'guardian.equip-forge' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.empower-blade' } }
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
            finisherType: COMBO_FINISHER.LEAP,
            ambiguousFieldSelection: 'oldest'
          }
        ]
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
  [ID.GLARING_BURST]: {
    // Snapshot the selected weapon before core modifiers, with one cadence change per accepted blade attack.
    effectVariants: [
      {
        when: (runtime) => luminaryState.from(runtime).radiantWeapon === 'hammer',
        profileId: PROFILE.glaringBurstHammer,
        transform: burstEffects
      },
      {
        when: (runtime) => luminaryState.from(runtime).radiantWeapon === 'blade',
        profileId: PROFILE.glaringBurstBlade,
        transform: burstEffects
      },
      {
        when: (runtime) => luminaryState.from(runtime).radiantWeapon === 'staff',
        profileId: PROFILE.glaringBurstStaff,
        transform: burstEffects
      },
      {
        when: (runtime) => luminaryState.from(runtime).radiantWeapon === 'bulwark',
        profileId: PROFILE.glaringBurstBulwark,
        transform: burstEffects
      },
      {
        when: () => true,
        profileId: PROFILE.glaringBurstVulnerability,
        transform: (runtime, cast) => burstEffects(runtime, cast, [])
      }
    ],
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    // The replacement strike lands at 480 ms and remains committed when the
    // action lane is released at the observed 520 ms cancel point.
    interruptCommitMs: 520,
    effects: []
  },
  [ID.ENTER_RADIANT_FORGE]: {
    // Commit changes the form once through its shared lifetime controller.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.enter-forge' } }],
    castTimeMs: 0,
    // Custom: Enters or exits Radiant Forge and updates forge resources; see `luminary/hooks.ts`.
    inputCategory: 'bar-swap',
    effects: []
  },
  [ID.RESTORATIVE_GLOW]: {
    // Only the committed follow-up consumes its own flip.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.RESTORATIVE_GLOW } }],
    castTimeMs: 560,
    effects: []
  },
  [ID.RADIANT_BULWARK]: {
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
  [ID.DAZZLING_HAMMER]: {
    // An accepted equip belongs to its captured forge entry, including delayed commitment.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.snapshot-forge' } },
      { on: 'castCommit', do: { type: 'guardian.equip-forge' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.empower-hammer' } }
    ],
    castTimeMs: 480,
    interruptCommitMs: 400,
    // Keep the hammer's boons, strike, and daze together in declaration order.
    effects: impactEffects(
      { atMs: 440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
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
              fieldSelectionAnchor: 'castStart',
              ambiguousFieldSelection: 'oldest'
            }
          ]
        },
        {
          type: 'control',
          controlKind: CONTROL.DAZE
        }
      ]
    )
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
  }
});

export const HAMMER = 'guardian.luminary.hammer';

export const WEAPON_BOON = 'guardian.luminary.weapon-boon';

export const BLADE_IMMOBILIZE = 'guardian.luminary.blade-immobilize';

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

  const vulnerability = requireEffect(
    requireBalanceProfileFromContext(runtime, PROFILE.glaringBurstVulnerability),
    'condition',
    CONDITION.VULNERABILITY
  );
  return [...effects, ...(vulnerability ? [vulnerability] : [])].map((effect) => ({
    ...effect,
    ...(effect.type === 'strike' ? { name: cast.skill.name } : {}),
    atMs,
    timingAnchor: 'castStart',
    timingScale: 'fixed',
    metadata: { radiantWeapon: weapon }
  }));
}

/** Hammer samples its entitlement at impact; blade/staff consume theirs at acceptance and deliver at impact. */
const luminaryWeaponActions: RuntimeProfession<GuardianRuntimeState, GuardianSkill>['sideEffectHandlers'] = {
  'guardian.empower-hammer'(runtime, context) {
    if (context.kind === 'cast') runtime.scheduleForCast(HAMMER, luminaryImpactAt(context.cast), context.cast);
  },
  'guardian.empower-blade'(runtime, context) {
    if (context.kind !== 'cast') return;

    const state = luminaryState.from(runtime);

    if (!state.radiantCourageSwordArmed) return;

    state.radiantCourageSwordArmed = false;
    // Capture the consumed entitlement now, but apply its condition only if the blade reaches impact.
    runtime.scheduleForCast(BLADE_IMMOBILIZE, luminaryImpactAt(context.cast), context.cast);
    runtime.scheduleForCast(
      WEAPON_BOON,
      luminaryImpactAt(context.cast),
      context.cast,
      { kind: 'guardian-radiant-courage-sword', duration: 0.001 },
      undefined,
      -10
    );
  },
  'guardian.empower-staff'(runtime, context) {
    if (context.kind !== 'cast') return;

    const state = luminaryState.from(runtime);

    if (!state.radiantResolveArmed) return;

    state.radiantResolveArmed = false;
    runtime.scheduleForCast(WEAPON_BOON, luminaryImpactAt(context.cast), context.cast, {
      kind: boonKey(BOON.REGENERATION),
      duration: 4,
      party: true
    });
  }
};

/** Registers radiant weapon actions with the Luminary hook assembly. */
export const luminaryWeaponLifecycle = {
  sideEffectHandlers: luminaryWeaponActions
} satisfies RuntimeHooks<GuardianRuntimeState, GuardianSkill>;

/** Intrinsic weapon multipliers run after shared additive bonuses and query live empowerment at impact. */
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
      context.event?.skillId === ID.GLEAMING_BLADE && buffActive(context, 'guardian-radiant-courage-sword')
  }
];

/** Linked self effects use the packet materializer's scaling and anchor so they resolve with the selected impact. */
export function luminaryImpactAt(cast: RuntimeCast<GuardianSkill>): number {
  const effect = cast.skill.effects?.find((effect) => effect.type === 'strike' && strikeEffectCoefficient(effect) > 0);

  if (effect?.type !== 'strike') return cast.effectiveEnd;

  return canonicalTime(effectFirstAt(cast.start, cast.fullEnd, scaleCastBoundTiming(cast, cast.skill, effect)));
}
