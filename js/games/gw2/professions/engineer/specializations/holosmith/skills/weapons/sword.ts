/**
 * Owns Holosmith sword skill fragments and heat-aware sword variants.
 * Sword cast behavior shared with Core lives in `core/hooks.ts`.
 */
import { boonKey } from '#gw2/platform/combat/boons.js';
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, WEAPON } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import { requireBalanceNumber } from '#gw2/platform/effects/validation.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/cast-effects.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import {
  effectNumber,
  requireEffect,
  requireSkillFromContext,
  skillNumber
} from '#gw2/platform/skills/balance-profiles.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { buildEngineerBuff } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { HolosmithResolverEvent } from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import {
  holosmithEventMetadata,
  holosmithHeatTier,
  snapshotHolosmithHeat
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import type {
  HolosmithSkill,
  HolosmithSkillFragment
} from '#gw2/professions/engineer/specializations/holosmith/types.js';
import type {
  EngineerResolverContext,
  EngineerRuntime,
  EngineerRuntimeState
} from '#gw2/professions/engineer/types.js';

// Only these sword autoattacks use the shared default heat factors.
const swordHeatFactors = { highStrikeFactor: 1.2, enhancedStrikeFactor: 1.3 };

// Seconds from Refraction Cutter's heat event to its extra blades' impact.
const REFRACTION_CUTTER_BLADE_DELAY = 0.36;

/** Supplies Holosmith sword fragments to Holosmith module composition. */
export const HOLOSMITH_SWORD_SKILL_MECHANICS: Readonly<Record<string, HolosmithSkillFragment>> = Object.freeze({
  [ID.SUN_EDGE]: {
    ...swordHeatFactors,
    cooldown: 0,
    castTimeMs: 440,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.88,
        hits: 1,
        name: 'Sun Edge',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 10,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.SUN_RIPPER]: {
    ...swordHeatFactors,
    cooldown: 0,
    castTimeMs: 480,
    // The EVTC's successful 441 ms cast must advance the sword chain after replay timing rounds to 440 ms.
    interruptCommitMs: 440,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.93,
        hits: 1,
        name: 'Sun Ripper',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 10,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.GLEAM_SABER]: {
    ...swordHeatFactors,
    cooldown: 0,
    castTimeMs: 720,
    // Commit the strike and recharge at 600 ms while retaining the full cast lockout.
    interruptCommitMs: 600,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 1.5 }],
        name: 'Gleam Saber',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: ACTOR.PLAYER
      }
    ],
    // A committed finisher reduces live sword recharge, including shortened casts.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.sword-recharge', amount: 1 } }]
  },
  [ID.REFRACTION_CUTTER_BLADE]: {
    cooldown: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Refraction Cutter Blade',
        damageBreakdownName: 'Refraction Cutter Blade',
        actorType: ACTOR.PLAYER,
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ],
        projectile: true
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.REFRACTION_CUTTER]: {
    // Intrinsic tuning follows this selected skill through patches and deferred work.
    baseExtraBlades: 0,
    highExtraBlades: 2,
    enhancedExtraBlades: 4,
    cooldown: 6,

    castTimeMs: 520,
    // Preserve committed swing/blade damage and keep the parent cast's lockout before the next input.
    interruptCommitMs: 360,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 1.4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Refraction Cutter - Packet 1',
        actorType: ACTOR.PLAYER
      },
      // Share one impact timing while preserving independent payloads and declaration order.
      ...impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.4,
          hits: 1,
          name: 'Refraction Cutter Blade',
          // Report projectile damage separately while retaining the parent sword cast.
          damageBreakdownName: 'Refraction Cutter Blade',
          sourceId: ID.REFRACTION_CUTTER_BLADE,
          actorType: ACTOR.PLAYER,
          comboFinishers: [
            {
              ownerId: 'engineer',
              finisherType: COMBO_FINISHER.PROJECTILE
            }
          ],
          projectile: true
        },
        {
          type: 'condition',
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 4,
          actorType: ACTOR.PLAYER
        }
      ])
    ],
    sideEffects: [
      {
        on: 'castStart',
        do: {
          type: 'engineer.refraction-cutter-extra-blades',
          id: 'heat-payload',
          effects: [
            {
              name: 'Refraction Cutter Heat Tier',
              type: 'strike',
              coefficient: 0.4,
              hits: 1
            },
            {
              name: 'Bleeding',
              type: 'condition',
              condition: CONDITION.BLEEDING,
              stacks: 1,
              duration: 4
            }
          ]
        }
      }
    ]
  },
  // Holosmith owns the original sword IDs; Core owns the non-heat Weaponmaster variants.
  [ID.RADIANT_ARC]: {
    // Intrinsic tuning follows this selected skill through patches and deferred work.
    baseDuration: 2,
    highDuration: 4,
    enhancedDuration: 6,
    cooldown: 12,

    castTimeMs: 840,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.LEAP
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Radiant Arc',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'custom',
        eventType: 'engineer.radiant-arc-quickness',
        event: {
          name: 'Radiant Arc - quickness'
        },
        actorType: ACTOR.PLAYER
      }
    ]
  }
});

/** Resolves the heat-scaled Quickness packet emitted by Holosmith's Radiant Arc variant. */
function handleRadiantArcQuickness(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  context.effects.emit({
    kind: 'packet',
    event: buildEngineerBuff(event, {
      name: 'Radiant Arc - quickness',
      kind: boonKey(BOON.QUICKNESS),
      stacks: 1,
      duration: requireBalanceNumber(event.duration, 'Radiant Arc field=duration')
    }),
    durationContext: event
  });
}

/** Materializes every heat-granted Refraction Cutter blade as a strike, bleed, and projectile finisher. */
function handleRefractionCutterExtraBlades(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  const extraBlades = Math.max(0, Math.trunc(holosmithEventMetadata(event).extraBlades || 0));
  const skill = requireSkillFromContext(context, ID.REFRACTION_CUTTER);
  const strike = requireEffect(
    skill,
    'strike',
    'Refraction Cutter Heat Tier',
    requireSkillAction(skill, 'heat-payload')
  );
  const condition = requireEffect(skill, 'condition', CONDITION.BLEEDING, requireSkillAction(skill, 'heat-payload'));
  // Materialize each extra blade independently so its strike can own a matching combo attempt and bleed.
  for (let blade = 0; blade < extraBlades; blade += 1) {
    const at = event.at + REFRACTION_CUTTER_BLADE_DELAY;

    if (strike) {
      context.effects.emit({
        kind: 'packet',
        event: buildResolverStrike({
          at,
          name: 'Refraction Cutter Blade',
          // Heat-generated blades share the base projectile's separate damage identity.
          damageBreakdownName: 'Refraction Cutter Blade',
          skillName: event.skillName,
          coefficient: effectNumber(skill, strike, 'coefficient'),

          hitIndex: blade + 2,
          totalHits: extraBlades + 1,
          source: 'engineer',
          sourceId: ID.REFRACTION_CUTTER_BLADE,
          actorType: ACTOR.PLAYER,
          skillId: event.skillId,
          skillWeapon: WEAPON.SWORD,
          projectile: true,
          comboFinishers: [
            {
              ownerId: 'engineer',
              finisherType: COMBO_FINISHER.PROJECTILE,
              chance: 1
            }
          ]
        })
      });
    }

    // Pair the blade's bleed with the same delayed impact and application index.
    if (condition) {
      context.effects.emit({
        kind: 'packet',
        event: buildResolverCondition({
          at,
          name: `${event.skillName} - Bleeding`,
          skillName: event.skillName,
          condition: String(condition.condition),
          stacks: Number(condition.stacks),
          duration: Number(condition.duration),
          applicationIndex: blade + 2,
          totalApplications: extraBlades + 1,
          source: 'engineer',
          sourceId: event.skillId ?? event.sourceId,
          actorType: ACTOR.PLAYER,
          skillId: event.skillId
        })
      });
    }
  }
}

/** Arc and Cutter capture their tier; direct Holosmith sword hits sample their skill tuning at impact. */
export function prepareHolosmithSwordEvent(
  context: EngineerRuntime<HolosmithSkill>,
  event: SimulationEventBase
): SimulationEventBase {
  if (event.type === 'engineer.radiant-arc-quickness' || event.type === 'engineer.refraction-cutter-extra-blades') {
    const snapshot = snapshotHolosmithHeat(context);
    const tier = holosmithHeatTier(snapshot, context);
    const arc = event.type === 'engineer.radiant-arc-quickness';
    const field = arc
      ? tier === 'enhanced'
        ? 'enhancedDuration'
        : tier === 'high'
          ? 'highDuration'
          : 'baseDuration'
      : tier === 'enhanced'
        ? 'enhancedExtraBlades'
        : tier === 'high'
          ? 'highExtraBlades'
          : 'baseExtraBlades';
    const skill = requireSkillFromContext(context, arc ? ID.RADIANT_ARC : ID.REFRACTION_CUTTER);
    return {
      ...event,
      holosmithActivationHeat: snapshot.heat,
      holosmithEnhancedCapacitySelected: snapshot.enhancedCapacitySelected,
      ...(arc ? { duration: skillNumber(skill, field) } : { extraBlades: skillNumber(skill, field) })
    };
  }

  if (
    event.type !== 'damage' ||
    event.actorType !== ACTOR.PLAYER ||
    !([ID.SUN_EDGE, ID.SUN_RIPPER, ID.GLEAM_SABER] as readonly number[]).includes(
      Number(event.skillId ?? event.sourceId)
    )
  )
    return event;

  return { ...event, holosmithStrikeSkillId: event.skillId ?? event.sourceId };
}

export const holosmithSwordEventHandlers = Object.freeze({
  'engineer.radiant-arc-quickness': handleRadiantArcQuickness,
  'engineer.refraction-cutter-extra-blades': handleRefractionCutterExtraBlades
});

/** Launch the skill's deferred component; its resolver reads the selected action payload. */
export const holosmithSwordSideEffectHandlers: RuntimeHooks<
  EngineerRuntimeState,
  HolosmithSkill
>['sideEffectHandlers'] = {
  'engineer.refraction-cutter-extra-blades'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Heat components require a cast.');

    const { cast } = context;

    if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;

    for (const packet of buildEngineerPackets(
      'engineer.refraction-cutter-extra-blades',
      { at: runtime.time, activationId: context.cast.id, offTarget: context.cast.command.offTarget },
      context.skill
    ))
      runtime.effects.emit({ kind: 'packet', event: packet });
  }
};
