import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import {
  gladiatorSharedWisdom,
  hexEaterSharedWisdom,
  twinMoonSharedWisdom,
  beguilingHazeSharedWisdom
} from '#gw2/professions/revenant/specializations/conduit/traits/shared-wisdom.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { revenantRuntimeCoreState } from '#gw2/professions/revenant/core/state-queries.js';
import {
  BEGUILING_HAZE_SKILL_IDS,
  TWIN_MOON_SKILL_IDS
} from '#gw2/professions/revenant/specializations/conduit/skill-groups.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { impactEffects, conditionEffectTicks, strikeEffectTicks } from '#gw2/platform/effects/authoring.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';

// The accepted main/follow-up identity survives charge consumption and variant selection.
const hazeMainCasts = new WeakSet<RuntimeCast<RevenantSkill>>();

/** A completed main cast arms the follow-up charges on the shared ammo pool, retaining its main recharge. */
export function completeBeguilingHaze(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const skill = cast.skill;
  const state = conduitState.from(runtime);
  if (hazeMainCasts.has(cast)) {
    hazeMainCasts.delete(cast);
    state.beguilingHazeCharges = Math.max(
      0,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.beguilingHazeFollowUp), 'maximumStacks')
    );
    state.beguilingHazeRecharge = structuredClone(
      runtime.cooldownController.rechargeFor(skill.id) ??
        runtime.cooldownController.readAmmo(skill.id)?.recharges[0] ??
        null
    );
    state.beguilingHazeReadyAt =
      runtime.cooldownController.readyAt(skill.id) ??
      runtime.cooldownController.readAmmo(skill.id)?.nextRechargeAt ??
      runtime.time;
  }

  const ammo = runtime.cooldownController.readAmmo(skill.id);
  if (!ammo) return;
  if (state.beguilingHazeCharges > 0) {
    runtime.cooldownController.replaceAmmoCharges(skill, state.beguilingHazeCharges, state.beguilingHazeCharges, []);
    runtime.cooldownController.clear(skill.id);
  } else {
    if (!state.beguilingHazeRecharge) throw new Error('Beguiling Haze follow-ups require a main-cast recharge.');
    // Follow-up charges are temporary; exhausting them resumes only the saved main-cast timer.
    runtime.cooldownController.replaceAmmoCharges(skill, 1, 0, [state.beguilingHazeRecharge]);
    state.beguilingHazeReadyAt = runtime.cooldownController.readAmmo(skill.id)!.nextRechargeAt!;
    runtime.cooldownController.refreshAmmo(skill, runtime.time);
  }
}

const hexEaterCleanses = new WeakMap<
  RuntimeCast<RevenantSkill>,
  {
    configured: number;
    conditions: RevenantRuntime['profession']['core']['selfConditions'];
  }
>();

/** Select projectiles now; defer removal of the selected conditions until commitment. */
function hexEaterEffects(
  runtime: RevenantRuntime,
  cast: RuntimeCast<RevenantSkill>,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  if (cast.cancelled) return [];
  const core = runtime.profession.core;
  const maximum = Math.max(
    0,
    ...effects.map((effect) =>
      effect.type === 'strike'
        ? strikeEffectTicks(effect).length
        : effect.type === 'condition'
          ? conditionEffectTicks(effect).length
          : 0
    )
  );
  const configured = Math.min(maximum, core.selfConditionCount);
  const conditions = core.selfConditions
    .filter((condition) => condition.expiresAt > cast.effectiveEnd)
    .slice(0, maximum - configured);
  hexEaterCleanses.set(cast, { configured, conditions });

  const projectiles = core.selectedLegendIds.includes(LEGEND.DEMON) ? maximum : configured + conditions.length;
  if (projectiles === 0) return [];

  // Omit empty components so the materializer cannot synthesize a fallback hit.
  return effects.flatMap((effect): SkillEffect[] => {
    if (effect.type === 'strike') {
      const ticks = strikeEffectTicks(effect).slice(0, projectiles);
      return ticks.length ? [{ ...effect, ticks }] : [];
    }

    if (effect.type === 'condition') {
      const ticks = conditionEffectTicks(effect).slice(0, projectiles);
      return ticks.length ? [{ ...effect, ticks }] : [];
    }

    return [effect];
  });
}

/** Selection precedes charge spending, so the final follow-up keeps its profile and shared recharge. */
function selectBeguilingHaze(
  runtime: RevenantRuntime,
  cast: RuntimeCast<RevenantSkill>,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  if (cast.cancelled) return [];
  const state = conduitState.from(runtime);
  if (state.beguilingHazeCharges > 0) state.beguilingHazeCharges -= 1;
  else hazeMainCasts.add(cast);
  return effects;
}

/** Cleanse only the condition objects reserved when this skill was accepted. */
export function cleanseHexEater(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const selected = hexEaterCleanses.get(cast);
  if (!selected) return;
  const core = runtime.profession.core;
  core.selfConditionCount = Math.max(0, core.selfConditionCount - selected.configured);
  core.selfConditions = core.selfConditions.filter(
    (condition) => condition.expiresAt > runtime.time && !selected.conditions.includes(condition)
  );
  hexEaterCleanses.delete(cast);
}

// Both API identities represent the same skill, so one fragment keeps their simulation behavior synchronized.
const BEGUILING_HAZE_SKILL: Partial<Skill> = {
  // Select the follow-up profile before its transform spends the final charge.
  effectVariants: [
    {
      when: (runtime: MechanicQueriesOf<RevenantRuntime>) => conduitState.from(runtime).beguilingHazeCharges > 0,
      profileId: PROFILE.beguilingHazeFollowUp,
      transform: selectBeguilingHaze
    },
    { when: () => true, transform: selectBeguilingHaze }
  ],
  sideEffects: [beguilingHazeSharedWisdom, { on: 'castCommit', do: { type: 'revenant.complete-haze' } }],
  // Relic of Peitha impacts 320 ms after the strike, which lands 40 ms before either variant's cast end.
  shadowstepSkill: true,
  peithaImpactAnchor: 'castEnd',
  peithaImpactDelayMs: 280,
  castTimeMs: 200,
  cooldown: 10,
  ammoCastLockout: 0,
  ammo: 1,
  ammoRecharge: 10,
  energyCost: 20,
  effects: [
    {
      type: 'strike',
      name: 'Beguiling Haze',
      actorType: 'player',
      ticks: [{ atMs: 520, coefficient: 2.2 }],
      timingAnchor: 'castStart',
      timingScale: 'fixed'
    }
  ],
  legendId: 'LegendaryEntity'
};

// Both API identities represent the same skill, so one fragment keeps their simulation behavior synchronized.
const TWIN_MOON_SWEEP_SKILL: Partial<Skill> = {
  castTimeMs: 920,
  cooldown: 3,
  energyCost: 25,
  affinityOnHit: true,
  // Shared Wisdom adds its live profile's Might at the first surviving base impact, independently of hitting a target.
  effectVariants: [twinMoonSharedWisdom],
  comboFinishers: [
    {
      ownerId: 'revenant',
      finisherType: 'Whirl',
      applications: 2,
      effectDelay: 0.04,
      ambiguousFieldSelection: 'oldest'
    }
  ],
  // Share timing defaults while preserving each packet, effect order, and local schedule.
  effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
    {
      type: 'strike',
      ticks: [{ atMs: 880, coefficient: 2.5 }],
      name: 'Twin Moon Sweep — Player',
      actorType: 'player',
      // Every resolved player packet earns affinity; fragments carry no such reaction.
      reactions: [
        { on: 'damage.resolved', actor: 'player', packets: 'each', do: { type: 'revenant.entity-hit-affinity' } }
      ]
    },
    {
      type: 'strike',
      ticks: [{ atMs: 880, coefficient: 2.5 }],
      name: 'Twin Moon Sweep — Fragment',
      actorType: 'player'
    },
    {
      type: 'condition',
      ticks: Array.from({ length: 2 }, (_, index) => ({
        atMs: 880 + index * 0,
        condition: 'Bleeding',
        stacks: 2,
        duration: 3
      })),
      actorType: 'player'
    },
    {
      type: 'boon',
      boon: 'might',
      stacks: 2,
      duration: 8,
      applications: 2,
      intervalMs: 0,
      atMs: 880
    },
    {
      type: 'condition',
      ticks: [{ atMs: 880, condition: 'Immobilized', stacks: 1, duration: 2 }],
      actorType: 'player',
      metadata: { legendId: LEGEND.ASSASSIN },
      when: (runtime: MechanicQueriesOf<RevenantRuntime>) =>
        runtime.profession.core.selectedLegendIds.includes(LEGEND.ASSASSIN)
    },
    {
      type: 'strike',
      coefficient: 0.4,
      hits: 2,
      atMs: 1400,
      name: 'Twin Moon Sweep — Shatter',
      actorType: 'player',
      metadata: { legendId: LEGEND.DEMON },
      when: (runtime: MechanicQueriesOf<RevenantRuntime>) =>
        runtime.profession.core.selectedLegendIds.includes(LEGEND.DEMON)
    },
    {
      type: 'condition',
      ticks: Array.from({ length: 2 }, (_, index) => ({
        atMs: 1400 + index * 0,
        condition: 'Confusion',
        stacks: 3,
        duration: 3
      })),
      actorType: 'player',
      metadata: { legendId: LEGEND.DEMON },
      when: (runtime: MechanicQueriesOf<RevenantRuntime>) =>
        runtime.profession.core.selectedLegendIds.includes(LEGEND.DEMON)
    }
  ]),
  legendId: 'LegendaryEntity'
};

// Align measured impacts and their attached effects on the nearest 40 ms action tick.
export const CONDUIT_ENTITY_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.BEGUILING_HAZE_ID_76805]: BEGUILING_HAZE_SKILL,
  [ID.TWIN_MOON_SWEEP]: TWIN_MOON_SWEEP_SKILL,
  [ID.TWIN_MOON_SWEEP_ID_77001]: TWIN_MOON_SWEEP_SKILL,
  [ID.BEGUILING_HAZE]: BEGUILING_HAZE_SKILL,
  [ID.HEX_EATER_VORTEX]: {
    // Snapshot projectiles at acceptance; the commit action consumes only that selection.
    effectVariants: [{ when: () => true, transform: hexEaterEffects }],
    // The local variant selects the projectile count; the scheduler owns their authored impacts.
    castTimeMs: 520,
    cooldown: 5,
    energyCost: 15,
    // Only a successful cast cleanses its selected conditions and grants Shared Wisdom's Resolution.
    sideEffects: [
      {
        on: 'castCommit',
        do: { type: 'revenant.hex-eater-cleanse' }
      },
      hexEaterSharedWisdom
    ],
    // Keep each projectile's strike and Torment on the same fixed impact tick.
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        name: 'Hex-Eater Vortex',
        actorType: 'player',
        ticks: [440, 560, 680, 800, 920, 1040].map((atMs) => ({
          atMs,
          coefficient: 0.2
        }))
      },
      {
        type: 'condition',
        name: 'Hex-Eater Vortex',
        actorType: 'player',
        ticks: [440, 560, 680, 800, 920, 1040].map((atMs) => ({
          atMs,
          condition: 'Torment',
          stacks: 1,
          duration: 1.5
        }))
      }
    ]),
    legendId: 'LegendaryEntity'
  },
  [ID.GLADIATORS_DEFENSE]: {
    // The default input cancels the remaining animation after the committed impact.
    castTimeMs: 240,
    interruptCommitMs: 40,
    defaultInterruptMs: 40,
    cooldown: 5,
    energyCost: 10,
    // Shared Wisdom grants only this skill's Stability on a successful cast, using the live trait profile.
    sideEffects: [gladiatorSharedWisdom],
    // Explicit impact timing lets the ordinary scheduler retain the packets when the animation is cancelled.
    effects: impactEffects({ atMs: 40, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: "Gladiator's Defense",
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      },
      { type: 'boon', boon: 'resolution', duration: 3, stacks: 1 },
      { type: 'boon', boon: 'resistance', duration: 3, stacks: 1 }
    ]),
    legendId: 'LegendaryEntity'
  },
  [ID.LEGENDARY_ENTITY_STANCE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  }
});

function equippedLegend(context: Gw2ModifierContext, legendId: string): boolean {
  return (revenantRuntimeCoreState(context).selectedLegendIds || []).includes(legendId);
}

// Equipped-legend resonance retains the outgoing multiplier stage for every authored strike.
export const conduitEntityModifierRules: readonly Gw2ModifierRule[] = [
  {
    id: 'revenant.beguiling-haze-assassin-resonance',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    // Assassin resonance doubles Beguiling Haze damage when Assassin is equipped (not necessarily active).
    factor: 2,
    when: (context) =>
      BEGUILING_HAZE_SKILL_IDS.has(Number(context.event?.skillId)) && equippedLegend(context, LEGEND.ASSASSIN)
  },
  {
    id: 'revenant.twin-moon-assassin-resonance',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    when: (context) =>
      TWIN_MOON_SKILL_IDS.has(Number(context.event?.skillId)) && equippedLegend(context, LEGEND.ASSASSIN)
  }
];
