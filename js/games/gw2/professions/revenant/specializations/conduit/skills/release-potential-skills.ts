import { conditionEffectTicks, impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill, SkillEffect } from '#gw2/platform/engine/skills/types.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { effectiveConduitAffinity } from '#gw2/professions/revenant/specializations/conduit/traits/behavior.js';

/** Capture equipped-legend eligibility at acceptance; full affinity unlocks every Dervish component. */
const releaseLegend = (legend: string) => (runtime: RevenantRuntime) =>
  runtime.profession.core.selectedLegendIds.includes(legend) ||
  effectiveConduitAffinity(runtime) >=
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.affinity), 'minimumStacks');

/** Releases inherit active-weapon attribution; Assassin durations snapshot affinity, Mesmer conditions resolve live. */
function releaseEffects(
  runtime: RevenantRuntime,
  cast: RuntimeCast,
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
      if (cast.skill.id === ID.RELEASE_POTENTIAL_MESMER) return [];
      if (assassin) {
        const multiplier = 1 + affinity * Number(effect.durationPerAffinity || 0);
        const ticks = conditionEffectTicks(effect).map((tick) => ({ ...tick, duration: tick.duration * multiplier }));
        return ticks.length ? [{ ...effect, ticks }] : [];
      }
    }

    return [effect];
  });
}

export const CONDUIT_RELEASE_POTENTIAL_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.RELEASE_POTENTIAL_MONK]: {
    effectVariants: [{ when: () => true, transform: releaseEffects }],
    // The shared scheduler materializes these packets; conditional legend components declare their own gates.
    castTimeMs: 360,
    cooldown: 10,
    energyCost: 0,
    effects: [
      { type: 'boon', boon: 'resistance', duration: 2, stacks: 1 },
      { type: 'boon', boon: 'regeneration', duration: 6, stacks: 1 }
    ]
  },
  [ID.RELEASE_POTENTIAL_MESMER]: {
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.mesmer-release' } }
    ],
    effectVariants: [{ when: () => true, transform: releaseEffects }],
    // Strike and daze use ordinary scheduling; Conduit evaluates the conditions' affinity at impact.
    castTimeMs: 440,
    cooldown: 10,
    energyCost: 0,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.98,
        hits: 1,
        name: 'Release Potential: Mesmer',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 3,
        durationPerAffinity: 0.1,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 8,
        durationReductionPerAffinity: 0.15,
        actorType: 'player',
        target: 'self'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'daze'
      }
    ])
  },
  [ID.RELEASE_POTENTIAL_DERVISH]: {
    effectVariants: [{ when: () => true, transform: releaseEffects }],
    // The shared scheduler materializes these packets; conditional legend components declare their own gates.
    castTimeMs: 680,
    // Dervish commits its impact before the remaining animation can be cancelled.
    interruptCommitMs: 560,
    cooldown: 10,
    energyCost: 0,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.98,
        hits: 1,
        name: 'Release Potential: Dervish',
        weaponStrengthProfileId: 'weapon.sword',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 6,
        actorType: 'player',
        metadata: { legendId: LEGEND.DEMON },
        when: releaseLegend(LEGEND.DEMON)
      },
      {
        type: 'boon',
        boon: 'might',
        stacks: 10,
        duration: 8,
        metadata: { legendId: LEGEND.CENTAUR },
        when: releaseLegend(LEGEND.CENTAUR)
      },
      {
        type: 'boon',
        boon: 'fury',
        stacks: 1,
        duration: 8,
        metadata: { legendId: LEGEND.CENTAUR },
        when: releaseLegend(LEGEND.CENTAUR)
      }
    ])
  },
  [ID.RELEASE_POTENTIAL_ASSASSIN]: {
    effectVariants: [{ when: () => true, transform: releaseEffects }],
    // Conduit snapshots condition-duration scaling; the shared scheduler owns all release packets.
    // Assassin releases the cast lane at 720 ms; the final strike follows at 800 ms.
    castTimeMs: 720,
    cooldown: 10,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        name: 'Release Potential: Assassin',
        actorType: 'player',
        weaponStrengthProfileId: 'nonweapon.profession-mechanic',
        ticks: [160, 480, 800].map((atMs) => ({
          atMs,
          coefficient: 0.6
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      // Share one impact timing while preserving independent payloads and declaration order.
      ...impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'condition',
          condition: 'Crippled',
          stacks: 1,
          duration: 2,
          durationPerAffinity: 0.2,
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Immobilized',
          stacks: 1,
          duration: 2,
          durationPerAffinity: 0.2,
          actorType: 'player'
        }
      ])
    ]
  },
  [ID.RELEASE_POTENTIAL_WARRIOR]: {
    effectVariants: [{ when: () => true, transform: releaseEffects }],
    // The shared scheduler materializes these packets; conditional legend components declare their own gates.
    castTimeMs: 520,
    cooldown: 10,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.649,
        hits: 1,
        name: 'Release Potential: Warrior',
        actorType: 'player'
      }
    ]
  }
});
