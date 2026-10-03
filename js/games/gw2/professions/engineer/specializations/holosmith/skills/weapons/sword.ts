import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';
import type { EngineerResolverContext, EngineerRuntime } from '#gw2/professions/engineer/types.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { HolosmithResolverEvent } from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import { requireBalanceNumber } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { buildEngineerBuff } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import {
  holosmithEventMetadata,
  holosmithHeatTier,
  snapshotHolosmithHeat
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
/**
 * Owns Holosmith sword skill fragments and heat-aware sword variants.
 * Sword cast behavior shared with Core lives in `core/hooks.ts`.
 */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type {
  HolosmithSkill,
  HolosmithSkillFragment
} from '#gw2/professions/engineer/specializations/holosmith/types.js';

/** Supplies Holosmith sword fragments to Holosmith module composition. */
export const HOLOSMITH_SWORD_SKILL_MECHANICS: Readonly<Record<string, HolosmithSkillFragment>> = Object.freeze({
  // Holosmith owns the original sword IDs; Core owns the non-heat Weaponmaster variants.
  [ID.RADIANT_ARC]: {
    castTimeMs: 840,
    cooldown: 12,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Radiant Arc',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      },
      {
        type: 'custom',
        eventType: 'engineer.radiant-arc-quickness',
        event: {
          name: 'Radiant Arc - quickness'
        },
        actorType: 'player'
      }
    ]
  },
  [ID.SUN_EDGE]: {
    castTimeMs: 440,
    cooldown: 0,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.88,
        hits: 1,
        name: 'Sun Edge',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      }
    ])
  },
  [ID.REFRACTION_CUTTER]: {
    castTimeMs: 520,
    // Preserve committed swing/blade damage and keep the parent cast's lockout before the next input.
    interruptCommitMs: 360,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 6,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 1.4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Refraction Cutter - Packet 1',
        actorType: 'player'
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
          actorType: 'player',
          comboFinishers: [
            {
              ownerId: 'engineer',
              finisherType: 'Projectile',
              preferredFieldTypes: ['Fire'],
              ambiguousFieldSelection: 'oldest'
            }
          ],
          projectile: true
        },
        {
          type: 'condition',
          condition: 'Bleeding',
          stacks: 1,
          duration: 4,
          actorType: 'player'
        }
      ]),
      {
        type: 'custom',
        eventType: 'engineer.refraction-cutter-extra-blades',
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        event: {
          name: 'Refraction Cutter extra blades'
        },
        actorType: 'player'
      }
    ]
  },
  [ID.REFRACTION_CUTTER_BLADE]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Refraction Cutter Blade',
        damageBreakdownName: 'Refraction Cutter Blade',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Projectile',
            preferredFieldTypes: ['Fire'],
            ambiguousFieldSelection: 'oldest'
          }
        ],
        projectile: true
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.SUN_RIPPER]: {
    castTimeMs: 480,
    // The EVTC's successful 441 ms cast must advance the sword chain after replay timing rounds to 440 ms.
    interruptCommitMs: 440,
    cooldown: 0,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.93,
        hits: 1,
        name: 'Sun Ripper',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      }
    ])
  },
  [ID.GLEAM_SABER]: {
    // A committed finisher reduces live sword recharge, including shortened casts.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.sword-recharge', amount: 1 } }],
    castTimeMs: 720,
    // Commit the strike and recharge at 600 ms while retaining the full cast lockout.
    interruptCommitMs: 600,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 1.5 }],
        name: 'Gleam Saber',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
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
      kind: 'quickness',
      stacks: 1,
      duration: requireBalanceNumber(event.duration, 'Radiant Arc field=duration')
    }),
    durationContext: event
  });
}

/** Materializes every heat-granted Refraction Cutter blade as a strike, bleed, and projectile finisher. */
function handleRefractionCutterExtraBlades(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  const extraBlades = Math.max(0, Math.trunc(holosmithEventMetadata(event).extraBlades || 0));
  const refractionCutterHeatTierProfile = requireBalanceProfileFromContext(context, PROFILE.refractionCutterHeatTier);
  const delay = Math.max(0, balanceProfileNumber(refractionCutterHeatTierProfile, 'initialDelay'));
  const strike = requireEffect(refractionCutterHeatTierProfile, 'strike', 'Refraction Cutter Heat Tier');
  const condition = requireEffect(refractionCutterHeatTierProfile, 'condition', 'Bleeding');
  // Materialize each extra blade independently so its strike can own a matching combo attempt and bleed.
  for (let blade = 0; blade < extraBlades; blade += 1) {
    const at = event.at + delay;
    if (strike) {
      context.effects.emit({
        kind: 'packet',
        event: buildResolverStrike({
          at,
          name: 'Refraction Cutter Blade',
          // Heat-generated blades share the base projectile's separate damage identity.
          damageBreakdownName: 'Refraction Cutter Blade',
          skillName: event.skillName,
          coefficient: effectNumber(refractionCutterHeatTierProfile, strike, 'coefficient'),

          hitIndex: blade + 2,
          totalHits: extraBlades + 1,
          source: 'engineer',
          sourceId: ID.REFRACTION_CUTTER_BLADE,
          actorType: 'player',
          skillId: event.skillId,
          skillWeapon: 'Sword',
          projectile: true,
          comboFinishers: [
            {
              ownerId: 'engineer',
              finisherType: 'Projectile',
              chance: 1,
              preferredFieldTypes: ['Fire'],
              ambiguousFieldSelection: 'oldest'
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
          actorType: 'player',
          skillId: event.skillId
        })
      });
    }
  }
}

/** Arc and Cutter capture their tier; direct Holosmith sword hits sample their profile at impact. */
export function prepareHolosmithSwordEvent(
  context: EngineerRuntime<HolosmithSkill>,
  event: SimulationEventBase
): SimulationEventBase {
  if (event.type === 'engineer.radiant-arc-quickness' || event.type === 'engineer.refraction-cutter-extra-blades') {
    const snapshot = snapshotHolosmithHeat(context);
    const tier = holosmithHeatTier(snapshot);
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
    const profile = requireBalanceProfileFromContext(
      context,
      arc ? PROFILE.radiantArcHeatTier : PROFILE.refractionCutterHeatTier
    );
    return {
      ...event,
      holosmithActivationHeat: snapshot.heat,
      holosmithEnhancedCapacitySelected: snapshot.enhancedCapacitySelected,
      ...(arc
        ? { duration: balanceProfileNumber(profile, field) }
        : { extraBlades: balanceProfileNumber(profile, field) })
    };
  }

  if (
    event.type !== 'damage' ||
    event.actorType !== 'player' ||
    !([ID.SUN_EDGE, ID.SUN_RIPPER, ID.GLEAM_SABER] as readonly number[]).includes(
      Number(event.skillId ?? event.sourceId)
    )
  )
    return event;
  return { ...event, holosmithStrikeProfileId: PROFILE.swordHeatTier };
}

export const holosmithSwordEventHandlers = Object.freeze({
  'engineer.radiant-arc-quickness': handleRadiantArcQuickness,
  'engineer.refraction-cutter-extra-blades': handleRefractionCutterExtraBlades
});
