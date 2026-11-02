import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, BOON, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import {
  affinity,
  effectiveConduitAffinity
} from '#gw2/professions/revenant/specializations/conduit/traits/behavior.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Capture equipped-legend eligibility at acceptance; full affinity unlocks every Dervish component. */
const releaseLegend = (legend: string) => (runtime: MechanicQueriesOf<RevenantRuntime>) =>
  runtime.profession.core.selectedLegendIds.includes(legend) ||
  effectiveConduitAffinity(runtime) >=
    skillNumberFromContext(runtime, ID.RELEASE_POTENTIAL_DERVISH, 'allLegendAffinityThreshold');

/** Releases inherit active-weapon attribution; Assassin durations snapshot affinity, Mesmer conditions resolve live. */
function releaseEffects(
  runtime: RevenantRuntime,
  cast: RuntimeCast<RevenantSkill>,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  const assassin = cast.skill.id === ID.RELEASE_POTENTIAL_ASSASSIN;
  const affinity = assassin ? effectiveConduitAffinity(runtime) : 0;
  const set = runtime.activeWeaponSet === 2 ? 2 : 1;
  const weapon =
    cast.skill.weapon ||
    (cast.skill.type === 'Profession' ? (gw2PrimaryWeapon(runtime.config, set) ?? '') : 'Unequipped');
  return effects.flatMap((effect): SkillEffect[] => {
    if (effect.type === 'strike') return [{ ...effect, weapon }];

    if (effect.type === 'condition') {
      // Mesmer's dedicated impact task emits these conditions after sampling affinity; ordinary emission would duplicate them.
      if (cast.skill.id === ID.RELEASE_POTENTIAL_MESMER) return [];

      if (assassin) {
        // Each condition keeps its own rate and base duration; the modifier uses this accepted factor after affinity changes.
        const multiplier = 1 + affinity * (effect.durationPerAffinity || 0);
        return [{ ...effect, metadata: { ...effect.metadata, revenantReleaseConditionDurationFactor: multiplier } }];
      }
    }

    return [effect];
  });
}

export const CONDUIT_RELEASE_POTENTIAL_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RevenantSkill>>> = {
  [ID.RELEASE_POTENTIAL_MONK]: {
    name: 'Release Potential: Monk',
    icon: 'https://render.guildwars2.com/file/2A674993E0E107A16E17FB5AC4AA757362EC434C/3713171.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 10,
    energyCost: 0,
    // The shared scheduler materializes these packets; conditional legend components declare their own gates.
    castTimeMs: 360,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.RESISTANCE,
        duration: 2,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 6,
        stacks: 1
      }
    ],
    effectVariants: [{ when: () => true, transform: releaseEffects }]
  },
  [ID.RELEASE_POTENTIAL_MESMER]: {
    name: 'Release Potential: Mesmer',
    icon: 'https://render.guildwars2.com/file/43CFBABF78D21302519219E3549CDDBA6A7B98BB/3746485.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 10,
    energyCost: 0,
    // Strike and daze use ordinary scheduling; Conduit evaluates the conditions' affinity at impact.
    castTimeMs: 440,
    // Outgoing Torment carries impact-time affinity; self-Torment retains its separate expiry handler.
    modifiers: [
      {
        id: 'revenant.release-mesmer-condition-affinity',
        target: 'conditionBaseDuration',
        operation: 'multiply',
        factor: (context) => Number(context.event?.metadata?.revenantReleaseConditionDurationFactor),
        when: (context) =>
          isGw2PlayerModifierOwnedEvent(context.event) &&
          context.event?.metadata?.revenantReleaseConditionDurationFactor != null
      }
    ],
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.98,
        hits: 1,
        name: 'Release Potential: Mesmer',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 2,
        duration: 3,
        durationPerAffinity: 0.1,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 1,
        duration: 8,
        durationReductionPerAffinity: 0.15,
        actorType: ACTOR.PLAYER,
        target: RECIPIENT.SELF
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.DAZE
      }
    ]),
    effectVariants: [{ when: () => true, transform: releaseEffects }],
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelledBeforeCommit,
        do: { type: 'revenant.mesmer-release' }
      }
    ]
  },
  [ID.RELEASE_POTENTIAL_DERVISH]: {
    name: 'Release Potential: Dervish',
    icon: 'https://render.guildwars2.com/file/127861C8CAA5C05A05D191480D54D40C022EF205/3713170.png',
    type: 'Profession',
    slot: 'Profession_2',
    // This release unlocks all legend rewards at its own Affinity threshold.
    allLegendAffinityThreshold: 3,
    // Strike damage reads current affinity at impact, independently of the selected legend components.
    modifiers: [
      {
        id: 'revenant.release-dervish-affinity',
        label: 'Release Potential: Dervish - affinity',
        target: 'strikeDamage',
        operation: 'multiply',
        order: 101,
        parameters: { damagePerAffinity: 0.1 },
        factor: (context, _target, parameters) => 1 + affinity(context) * parameters.damagePerAffinity
      }
    ],
    cooldown: 10,
    energyCost: 0,
    // The shared scheduler materializes these packets; conditional legend components declare their own gates.
    castTimeMs: 680,
    // Dervish commits its impact before the remaining animation can be cancelled.
    interruptCommitMs: 560,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // Use the live Dervish coefficient as the baseline for preview balance edits.
        coefficient: 1.8,
        hits: 1,
        name: 'Release Potential: Dervish',
        weaponStrengthProfileId: 'nonweapon.profession-mechanic',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 3,
        duration: 6,
        actorType: ACTOR.PLAYER,
        metadata: { legendId: LEGEND.DEMON },
        when: releaseLegend(LEGEND.DEMON)
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        stacks: 10,
        duration: 8,
        metadata: { legendId: LEGEND.CENTAUR },
        when: releaseLegend(LEGEND.CENTAUR)
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.FURY,
        stacks: 1,
        duration: 8,
        metadata: { legendId: LEGEND.CENTAUR },
        when: releaseLegend(LEGEND.CENTAUR)
      }
    ]),
    effectVariants: [{ when: () => true, transform: releaseEffects }]
  },
  [ID.RELEASE_POTENTIAL_ASSASSIN]: {
    name: 'Release Potential: Assassin',
    icon: 'https://render.guildwars2.com/file/11A390F793A2EBE57DA6DD6FFD03290CCE6F0305/3713169.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 10,
    energyCost: 0,
    // Conduit snapshots condition-duration scaling; the shared scheduler owns all release packets.
    // Assassin releases the cast lane at 720 ms; the final strike follows at 800 ms.
    castTimeMs: 720,
    interruptCommitMs: 640,
    retainsCastLockoutAfterInterrupt: true,
    // Strike affinity remains live while the condition durations retain their separate cast snapshot.
    modifiers: [
      {
        id: 'revenant.release-assassin-condition-affinity',
        target: 'conditionBaseDuration',
        operation: 'multiply',
        factor: (context) => Number(context.event?.metadata?.revenantReleaseConditionDurationFactor),
        when: (context) =>
          isGw2PlayerModifierOwnedEvent(context.event) &&
          context.event?.metadata?.revenantReleaseConditionDurationFactor != null
      },
      {
        id: 'revenant.release-assassin-affinity',
        label: 'Release Potential: Assassin - affinity',
        target: 'strikeDamage',
        operation: 'multiply',
        order: 101,
        parameters: { damagePerAffinity: 0.1 },
        factor: (context, _target, parameters) => 1 + affinity(context) * parameters.damagePerAffinity
      }
    ],
    effects: [
      {
        type: 'strike',
        name: 'Release Potential: Assassin',
        actorType: ACTOR.PLAYER,
        persistsAfterInterrupt: true,
        weaponStrengthProfileId: 'nonweapon.profession-mechanic',
        ticks: [160, 480, 800].map((atMs) => ({
          atMs,
          coefficient: 0.6
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      // Share one impact timing while preserving independent payloads and declaration order.
      ...impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
        {
          type: 'condition',
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 2,
          durationPerAffinity: 0.2,
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.IMMOBILIZED,
          stacks: 1,
          duration: 2,
          durationPerAffinity: 0.2,
          actorType: ACTOR.PLAYER
        }
      ])
    ],
    effectVariants: [{ when: () => true, transform: releaseEffects }]
  },
  [ID.RELEASE_POTENTIAL_WARRIOR]: {
    name: 'Release Potential: Warrior',
    icon: 'https://render.guildwars2.com/file/35BD2F7D624203D7A0B3E5C2EE6A650ABF301323/3713172.png',
    type: 'Profession',
    slot: 'Profession_2',
    // Warrior's release has a stronger intrinsic strike bonus per current affinity stack.
    modifiers: [
      {
        id: 'revenant.release-warrior-affinity',
        label: 'Release Potential: Warrior - affinity',
        target: 'strikeDamage',
        operation: 'multiply',
        order: 102,
        parameters: { damagePerAffinity: 0.15 },
        factor: (context, _target, parameters) => 1 + affinity(context) * parameters.damagePerAffinity
      }
    ],
    cooldown: 10,
    energyCost: 0,
    // The shared scheduler materializes these packets; conditional legend components declare their own gates.
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1.649,
        hits: 1,
        name: 'Release Potential: Warrior',
        actorType: ACTOR.PLAYER
      }
    ],
    effectVariants: [{ when: () => true, transform: releaseEffects }]
  }
};
