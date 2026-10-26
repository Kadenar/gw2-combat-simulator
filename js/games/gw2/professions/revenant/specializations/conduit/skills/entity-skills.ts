import { ACTOR, COMBO_FINISHER, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { effectFirstAt } from '#gw2/platform/effects/materializer.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { conditionEffectTicks, impactEffects, strikeEffectTicks } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { skillNumberFromContext, requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { revenantRuntimeCoreState } from '#gw2/professions/revenant/core/state-queries.js';
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import {
  BEGUILING_HAZE_SKILL_IDS,
  TWIN_MOON_SKILL_IDS
} from '#gw2/professions/revenant/specializations/conduit/skill-groups.js';
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Preserves Shared Wisdom's position among this skill's accepted actions. */
const twinMoonSharedWisdom: NonNullable<Skill['effectVariants']>[number] = {
  when: (runtime) => hasTrait(runtime, TRAIT.SHARED_WISDOM),
  profileId: PROFILE.sharedWisdom,
  transform: (_runtime, cast, effects) => {
    const first = cast.skill.effects?.find((effect) => !effect.metadata?.legendId);
    const impact = first ? effectFirstAt(cast.start, cast.fullEnd, first) : cast.fullEnd;
    return [
      ...(cast.skill.effects ?? []),
      ...effects
        .filter((effect) => effect.type === 'boon' && effect.name === 'twin-moon-sweep')
        .map((effect) => ({
          ...effect,
          name: 'Shared Wisdom — Might',
          atMs: (effectFirstAt(impact, impact, effect) - cast.start) * 1000,
          timingAnchor: 'castStart' as const,
          timingScale: 'fixed' as const
        }))
    ];
  }
};

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
      skillNumberFromContext(runtime, ID.BEGUILING_HAZE_FOLLOW_UP, 'maximumStacks')
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
  RevenantRuntime['profession']['core']['selfConditions']
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
  // Reserve the actual surviving applications so commitment cannot cleanse later arrivals with identical expiries.
  const conditions = core.selfConditions
    .filter((condition) => condition.expiresAt > cast.effectiveEnd)
    .slice(0, maximum);
  hexEaterCleanses.set(cast, conditions);

  const projectiles = core.selectedLegendIds.includes(LEGEND.DEMON) ? maximum : conditions.length;

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

/** Selection precedes charge spending, so the final follow-up keeps its selected payload and shared recharge. */
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
  core.selfConditions = core.selfConditions.filter(
    (condition) => condition.expiresAt > runtime.time && !selected.includes(condition)
  );
  hexEaterCleanses.delete(cast);
}

// Both API identities represent the same skill, so one fragment keeps their simulation behavior synchronized.
const BEGUILING_HAZE_SKILL: Partial<Skill> = {
  // Relic of Peitha impacts 320 ms after the strike, which lands 40 ms before either variant's cast end.
  shadowstepSkill: true,
  peithaImpactAnchor: 'castEnd',
  peithaImpactDelayMs: 280,
  cooldown: 10,
  ammoCastLockout: 0,
  ammo: 1,
  ammoRecharge: 10,
  energyCost: 20,
  legendId: 'LegendaryEntity',
  // The 280 ms launch and 240 ms teleport form one main cast; impact precedes completion by one action tick.
  castTimeMs: 520,
  effects: [
    {
      type: 'strike',
      name: 'Beguiling Haze',
      actorType: ACTOR.PLAYER,
      ticks: [{ atMs: 480, coefficient: 2.2 }],
      timingAnchor: 'castStart',
      timingScale: 'fixed'
    }
  ],
  // Select the follow-up skill before its transform spends the final charge.
  effectVariants: [
    {
      when: (runtime: MechanicQueriesOf<RevenantRuntime>) => conduitState.from(runtime).beguilingHazeCharges > 0,
      transform: (runtime, cast) =>
        selectBeguilingHaze(runtime, cast, requireSkillFromContext(runtime, ID.BEGUILING_HAZE_FOLLOW_UP).effects ?? [])
    },
    { when: () => true, transform: selectBeguilingHaze }
  ],
  sideEffects: [
    { on: 'castCommit', do: { type: 'revenant.entity-boon-completed' } },
    { on: 'castCommit', do: { type: 'revenant.complete-haze' } }
  ]
};

// Both API identities represent the same skill, so one fragment keeps their simulation behavior synchronized.
const TWIN_MOON_SWEEP_SKILL: Partial<Skill> = {
  cooldown: 3,
  energyCost: 25,
  affinityOnHit: true,
  legendId: 'LegendaryEntity',
  castTimeMs: 920,
  comboFinishers: [
    {
      ownerId: 'revenant',
      finisherType: COMBO_FINISHER.WHIRL,
      applications: 2,
      effectDelay: 0.04
    }
  ],
  // Share timing defaults while preserving each packet, effect order, and local schedule.
  effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
    {
      type: 'strike',
      ticks: [{ atMs: 880, coefficient: 2.5 }],
      name: 'Twin Moon Sweep — Player',
      actorType: ACTOR.PLAYER,
      // Every resolved player packet earns affinity; fragments carry no such reaction.
      reactions: [
        { on: 'damage.resolved', actor: ACTOR.PLAYER, packets: 'each', do: { type: 'revenant.entity-hit-affinity' } }
      ]
    },
    {
      type: 'strike',
      ticks: [{ atMs: 880, coefficient: 2.5 }],
      name: 'Twin Moon Sweep — Fragment',
      actorType: ACTOR.PLAYER
    },
    {
      type: 'condition',
      ticks: Array.from({ length: 2 }, (_, index) => ({
        atMs: 880 + index * 0,
        condition: CONDITION.BLEEDING,
        stacks: 2,
        duration: 3
      })),
      actorType: ACTOR.PLAYER
    },
    {
      type: 'boon',
      boon: BOON.MIGHT,
      stacks: 2,
      duration: 8,
      applications: 2,
      intervalMs: 0,
      atMs: 880
    },
    {
      type: 'condition',
      ticks: [{ atMs: 880, condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 2 }],
      actorType: ACTOR.PLAYER,
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
      actorType: ACTOR.PLAYER,
      metadata: { legendId: LEGEND.DEMON },
      when: (runtime: MechanicQueriesOf<RevenantRuntime>) =>
        runtime.profession.core.selectedLegendIds.includes(LEGEND.DEMON)
    },
    {
      type: 'condition',
      ticks: Array.from({ length: 2 }, (_, index) => ({
        atMs: 1400 + index * 0,
        condition: CONDITION.CONFUSION,
        stacks: 3,
        duration: 3
      })),
      actorType: ACTOR.PLAYER,
      metadata: { legendId: LEGEND.DEMON },
      when: (runtime: MechanicQueriesOf<RevenantRuntime>) =>
        runtime.profession.core.selectedLegendIds.includes(LEGEND.DEMON)
    }
  ]),
  // Shared Wisdom adds its live profile's Might at the first surviving base impact, independently of hitting a target.
  effectVariants: [twinMoonSharedWisdom]
};

// Align measured impacts and their attached effects on the nearest 40 ms action tick.
export const CONDUIT_ENTITY_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // The selected follow-up owns its payload and charge budget; the main button retains the activation identity.
  [ID.BEGUILING_HAZE_FOLLOW_UP]: {
    // Recorded follow-up segments replay through the same player button and shared charge pool.
    parentId: ID.BEGUILING_HAZE,
    simulatorExcluded: true,
    castTimeMs: 240,
    interruptCommitMs: 200,
    maximumStacks: 2,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        name: 'Beguiling Haze — Follow-Up',
        actorType: ACTOR.PLAYER,
        persistsAfterInterrupt: true,
        ticks: [{ atMs: 200, coefficient: 0.6 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.BEGUILING_HAZE_ID_76805]: BEGUILING_HAZE_SKILL,
  [ID.TWIN_MOON_SWEEP]: TWIN_MOON_SWEEP_SKILL,
  [ID.TWIN_MOON_SWEEP_ID_77001]: TWIN_MOON_SWEEP_SKILL,
  [ID.BEGUILING_HAZE]: BEGUILING_HAZE_SKILL,
  [ID.HEX_EATER_VORTEX]: {
    cooldown: 5,
    energyCost: 15,
    legendId: 'LegendaryEntity',
    // The local variant selects the projectile count; the scheduler owns their authored impacts.
    castTimeMs: 520,
    // Keep each projectile's strike and Torment on the same fixed impact tick.
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        name: 'Hex-Eater Vortex',
        actorType: ACTOR.PLAYER,
        ticks: [440, 560, 680, 800, 920, 1040].map((atMs) => ({
          atMs,
          coefficient: 0.2
        }))
      },
      {
        type: 'condition',
        name: 'Hex-Eater Vortex',
        actorType: ACTOR.PLAYER,
        ticks: [440, 560, 680, 800, 920, 1040].map((atMs) => ({
          atMs,
          condition: CONDITION.TORMENT,
          stacks: 1,
          duration: 1.5
        }))
      }
    ]),
    // Snapshot projectiles at acceptance; the commit action consumes only that selection.
    effectVariants: [{ when: () => true, transform: hexEaterEffects }],
    // Only a successful cast cleanses its selected conditions and grants Shared Wisdom's Resolution.
    sideEffects: [
      {
        on: 'castCommit',
        do: { type: 'revenant.hex-eater-cleanse' }
      },
      { on: 'castCommit', do: { type: 'revenant.entity-boon-completed' } }
    ]
  },
  [ID.GLADIATORS_DEFENSE]: {
    cooldown: 5,
    energyCost: 10,
    legendId: 'LegendaryEntity',
    // The default input cancels the remaining animation after the committed impact.
    castTimeMs: 240,
    defaultInterruptMs: 40,
    interruptCommitMs: 40,
    // Explicit impact timing lets the ordinary scheduler retain the packets when the animation is cancelled.
    effects: impactEffects({ atMs: 40, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: "Gladiator's Defense",
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 5,
        actorType: ACTOR.PLAYER
      },
      { type: 'boon', boon: BOON.RESOLUTION, duration: 3, stacks: 1 },
      { type: 'boon', boon: BOON.RESISTANCE, duration: 3, stacks: 1 }
    ]),
    // Dwarf resonance broadens only this skill's boons; other equipped legends keep them personal.
    effectVariants: [
      {
        when: (runtime) => runtime.profession.core.selectedLegendIds.includes(LEGEND.DWARF),
        transform: (_runtime, _cast, effects) =>
          effects.map((effect) =>
            effect.type === 'boon'
              ? { ...effect, audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 } }
              : effect
          )
      }
    ],
    // Shared Wisdom grants only this skill's Stability on a successful cast, using the live trait profile.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.entity-boon-completed' } }]
  },
  [ID.LEGENDARY_ENTITY_STANCE]: {
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
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
