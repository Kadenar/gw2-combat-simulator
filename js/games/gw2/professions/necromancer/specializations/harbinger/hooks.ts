import { canonicalTime } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { isHostileTargetEvent } from '#gw2/platform/combat/state/targets.js';
import { assertSimulationEvent } from '#gw2/platform/engine/events/events.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import {
  effectFirstAt,
  materializeSkillEffectApplications,
  scaleCastBoundTiming
} from '#gw2/platform/engine/effects/materializer.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { quantizeGw2ActionTimingMs } from '#gw2/platform/skills/timing.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { necromancerLifeForceCostMultiplier } from '#gw2/professions/necromancer/core/state.js';
import { necromancerActiveMinionCompanionIds } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { registerNecromancerShroudLifecycle } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  addBlight,
  consumeBlight,
  harbingerState,
  purgeHarbingerTimedState
} from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { harbingerResolverEventReactions } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/blight-effects.js';
import {
  HARBINGER_BALANCE_PROFILE_IDS as PROFILE,
  HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID
} from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { NecromancerRuntime, NecromancerRuntimeState } from '#gw2/professions/necromancer/types.js';
import type { Skill, SkillEffect } from '#gw2/platform/engine/skills/types.js';
import type { EffectMetadata } from '#gw2/platform/engine/events/events.js';

const BLIGHT = 'harbinger.blight-clock';
const COMMIT = 'harbinger.blight-commit';
const IMPACT = 'harbinger.elixir-impact';

/** One replaceable wake owns the next actual accrual, expiry, or Meltdown deadline. */
function refreshBlight(runtime: NecromancerRuntime): void {
  const state = harbingerState.from(runtime);
  runtime.cancelOwner({ id: BLIGHT, generation: state.blightGeneration });
  state.blightGeneration++;
  const at = Math.min(state.nextBlightAt ?? Infinity, ...state.blightExpiries, state.meltdownUntil || Infinity);
  if (Number.isFinite(at)) runtime.schedule(BLIGHT, at, null, { id: BLIGHT, generation: state.blightGeneration }, -20);
}

/** Reports current Blight without replaying a state snapshot into the combat world. */
function publishBlight(runtime: NecromancerRuntime): void {
  const state = harbingerState.from(runtime);
  runtime.emit({
    type: 'buff',
    at: runtime.time,
    source: 'necromancer',
    sourceId: ID.HARBINGER_SHROUD,
    actorType: 'player',
    skillName: 'Blight',
    kind: 'harbinger-blight',
    stacks: state.blight,
    duration: state.blight ? Math.max(...state.blightExpiries) - runtime.time : 0
  });
  refreshBlight(runtime);
}

/** Selected packets share the materializer and actual boon recipients; target rejection remains in the common queue. */
function emitEffects(
  runtime: NecromancerRuntime,
  skill: Skill,
  effects: readonly SkillEffect[],
  cast?: RuntimeCast,
  metadata?: EffectMetadata
): void {
  for (const effect of effects) {
    for (const { event } of materializeSkillEffectApplications({
      skill,
      effect,
      start: runtime.time,
      fullEnd: runtime.time,
      baseEvent: {
        source: effect.source ?? (skill.type === 'Trait' ? 'Trait' : 'necromancer'),
        sourceId: effect.sourceId ?? skill.id,
        skillId: skill.id,
        skillName: skill.name,
        actorType: effect.actorType ?? (skill.type === 'Trait' ? 'effect' : 'player'),
        // A triggered trait owns one activation distinct from its originating weapon or shroud cast.
        activationId: cast && skill.id !== cast.skill.id ? `${cast.id}:effect:${skill.id}` : cast?.id,
        metadata
      },
      skillWeaponFallback: 'Unequipped'
    })) {
      const packet = assertSimulationEvent({
        ...event,
        parentSkillName: cast && cast.skill.id !== skill.id ? cast.skill.name : undefined,
        // Profile effect labels identify authoring slots; combat rows identify the skill that delivered the strike.
        ...(event.type === 'damage' ? { name: skill.name } : {}),
        ...(event.type === 'condition' ? { name: `${skill.name} — ${event.condition}` } : {}),
        offTarget: cast?.command.offTarget,
        at: canonicalTime(
          event.at +
            (skill.id === cast?.skill.id && isHostileTargetEvent(event)
              ? Number(cast.command.impactDelayMs ?? 0) / 1000
              : 0)
        )
      });
      if (packet.type === 'buff')
        queueResolverBoon(runtime, packet, { ...packet, kind: String(packet.kind), duration: Number(packet.duration) });
      else runtime.emit(packet);
    }
  }
}

function party(runtime: NecromancerRuntime) {
  return {
    recipients: 'party' as const,
    maximumRecipients: 5,
    eligibleCompanionIds: necromancerActiveMinionCompanionIds(runtime)
  };
}

/** Entry and completed Dark Barrage independently deliver the surviving Deathly Haste boons. */
function deathlyHaste(runtime: NecromancerRuntime, skill: Skill): void {
  if (!hasTrait(runtime, TRAIT.DEATHLY_HASTE)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.deathlyHaste);
  emitEffects(
    runtime,
    skill,
    (profile.effects ?? []).map((effect) => ({
      ...effect,
      atMs: 0,
      audience: party(runtime),
      source: skill.id === ID.DARK_BARRAGE ? 'Trait' : 'necromancer',
      sourceId: skill.id === ID.DARK_BARRAGE ? TRAIT.DEATHLY_HASTE : skill.id
    }))
  );
}

/** Spending counts once at commitment; only the delayed explosion can damage the target. */
function spendBlight(runtime: NecromancerRuntime, cast: RuntimeCast): boolean {
  const state = harbingerState.from(runtime);
  const profile = requireBalanceProfileFromContext(
    runtime,
    HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(cast.skill.id)]
  );
  const cost = balanceProfileNumber(profile, 'blightCost');
  const empowered = state.blight >= cost;
  const consumed = empowered ? consumeBlight(state, cost, runtime.time) : 0;
  if (
    consumed &&
    hasTrait(runtime, TRAIT.CASCADING_CORRUPTION) &&
    !runtime.combatStartPending &&
    !(runtime.combatStartTime != null && runtime.time < runtime.combatStartTime)
  ) {
    const corruption = requireBalanceProfileFromContext(runtime, PROFILE.cascadingCorruption);
    const meltdown = requireEffect(corruption, 'buff', 'meltdown');
    const strike = requireEffect(corruption, 'strike', 'Strike');
    const torment = requireEffect(corruption, 'condition', 'Torment');
    if (meltdown || strike || torment) {
      state.cascadingCorruptionStacks += consumed;
      const threshold = balanceProfileNumber(corruption, 'minimumStacks');
      if (state.cascadingCorruptionStacks >= threshold) {
        state.cascadingCorruptionStacks -= threshold;
        if (meltdown)
          state.meltdownUntil = canonicalTime(runtime.time + effectNumber(corruption, meltdown, 'duration'));
        runtime.emit({
          type: 'proc',
          procType: 'trait',
          at: runtime.time,
          name: 'Meltdown',
          icon: 'https://wiki.guildwars2.com/wiki/Special:FilePath/Meltdown.png',
          sourceSkill: cast.skill.name,
          source: 'Trait',
          sourceId: TRAIT.CASCADING_CORRUPTION,
          actorType: 'effect',
          activationId: cast.id
        });
        emitEffects(
          runtime,
          { id: ID.CASCADING_CORRUPTION, name: 'Cascading Corruption', type: 'Trait' },
          [meltdown, strike, torment]
            .filter((effect) => effect != null)
            .map((effect) => ({
              ...effect,
              sourceId: TRAIT.CASCADING_CORRUPTION,
              atMs: quantizeGw2ActionTimingMs(Number(effect.atMs ?? 0))
            })),
          cast
        );
      }
    }
  }

  publishBlight(runtime);
  return empowered;
}

/** Empowerment is selected at the launch/hit boundary, after earlier stack expiries and passive ticks. */
function commit(runtime: NecromancerRuntime, cast: RuntimeCast, impactAt: number): void {
  const empowered = spendBlight(runtime, cast);
  const blight = harbingerState.from(runtime).blight;
  if (cast.skill.categories?.includes('Elixir')) {
    if (hasTrait(runtime, TRAIT.BOLSTERING_BREW)) {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.bolsteringBrew);
      emitEffects(
        runtime,
        cast.skill,
        (profile.effects ?? []).map((effect) => ({
          ...effect,
          atMs: 0,
          audience: hasTrait(runtime, TRAIT.TWISTED_MEDICINE) ? party(runtime) : undefined
        })),
        cast
      );
    }

    runtime.schedule(IMPACT, impactAt, { cast, empowered, blight });
  } else {
    const profile = empowered
      ? requireBalanceProfileFromContext(runtime, HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(cast.skill.id)])
      : cast.skill;
    emitEffects(runtime, cast.skill, profile.effects ?? [], cast, {
      blightEmpowered: empowered,
      necromancerBlight: blight
    });
    if (cast.skill.id !== ID.DEVOURING_CUT)
      runtime.emit({
        type: 'control',
        at: canonicalTime(runtime.time + Number(cast.command.impactDelayMs ?? 0) / 1000),
        source: 'necromancer',
        sourceId: cast.skill.id,
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        actorType: 'player',
        activationId: cast.id,
        offTarget: cast.command.offTarget,
        controlKind: hasTrait(runtime, TRAIT.DOOM_APPROACHES) ? 'fear' : 'daze'
      });
  }
}

/** Blight lives on the one runtime; shroud callbacks own every entry and exit, including automatic depletion. */
export const harbingerHooks: Partial<RuntimeProfession<NecromancerRuntimeState>> = {
  initialize(runtime) {
    if (!professionStaticRulesApplied(runtime.config)) {
      const vitality =
        Number(runtime.config.stats?.vitality ?? 1000) +
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.alchemicVigor), 'attributeBonus');
      runtime.profession.core.lifeForceCostMultiplier = necromancerLifeForceCostMultiplier(
        { ...runtime.config, stats: { ...runtime.config.stats, vitality } },
        runtime
      );
    }

    registerNecromancerShroudLifecycle(runtime, 'harbinger.shroud', {
      onEnter(skill) {
        if (skill.shroudEntry !== 'harbinger') return;
        harbingerState.from(runtime).nextBlightAt = Math.floor(runtime.time) + 1;
        if (hasTrait(runtime, TRAIT.CORRUPTED_TALENT))
          grantNecromancerLifeForce(
            runtime,
            balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.corruptedTalent), 'lifeForceGain')
          );
        deathlyHaste(runtime, skill);
        if (hasTrait(runtime, TRAIT.IMPLACABLE_FOE))
          emitEffects(runtime, skill, requireBalanceProfileFromContext(runtime, PROFILE.implacableFoe).effects ?? []);
        refreshBlight(runtime);
      },
      onExit() {
        harbingerState.from(runtime).nextBlightAt = Infinity;
        refreshBlight(runtime);
      }
    });
    publishBlight(runtime);
  },
  // Pistol recharge uses the selected trait profile.
  rechargeRules: [
    {
      trait: TRAIT.DARK_GUNSLINGER,
      when: (_runtime, skill) => skill.weapon === 'Pistol',
      multiplier: { profile: PROFILE.darkGunslinger, field: 'rechargeMultiplier' }
    }
  ],
  onCastStart(runtime, cast) {
    if (cast.skill.categories?.includes('Elixir')) {
      if (cast.cancelled) return;
      const strike = cast.skill.effects?.find((effect) => effect.type === 'strike');
      const impactAt = strike
        ? effectFirstAt(cast.start, cast.fullEnd, scaleCastBoundTiming(cast, cast.skill, strike))
        : cast.fullEnd;
      // The thrown elixir's self Blight and boons remain local; only hostile packets carry target travel below.
      const at = canonicalTime(cast.start + 0.36);
      runtime.schedule(COMMIT, at, { cast, impactAt: Math.max(at, canonicalTime(impactAt)) });
    } else if ([ID.VORACIOUS_ARC, ID.DEVOURING_CUT].some((id) => id === Number(cast.skill.id))) {
      const progress = cast.skill.id === ID.DEVOURING_CUT ? 0.75 : 20 / 21;
      const at = canonicalTime(
        cast.start + quantizeGw2ActionTimingMs((cast.fullEnd - cast.start) * progress * 1000) / 1000
      );
      if (at <= cast.effectiveEnd) runtime.schedule(COMMIT, at, { cast, impactAt: at });
    }
  },
  modifyEffects(_runtime, cast, effects) {
    if (HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(cast.skill.id)]) return [];
    return effects;
  },
  onCastComplete(runtime, cast) {
    if (cast.skill.id === ID.DARK_BARRAGE && !cast.cancelled) deathlyHaste(runtime, cast.skill);
  },
  tasks: {
    [BLIGHT](runtime) {
      const state = harbingerState.from(runtime);
      purgeHarbingerTimedState(state, runtime.time);
      if (state.meltdownUntil && state.meltdownUntil <= runtime.time) state.meltdownUntil = 0;
      if (runtime.profession.core.activeShroud === 'harbinger' && Number(state.nextBlightAt) <= runtime.time) {
        const profile = requireBalanceProfileFromContext(
          runtime,
          hasTrait(runtime, TRAIT.DOOM_APPROACHES) ? PROFILE.doomApproaches : PROFILE.resources
        );
        addBlight(state, balanceProfileNumber(profile, 'blightGain'), runtime.time);
        state.nextBlightAt = runtime.time + 1;
      }

      publishBlight(runtime);
    },
    [COMMIT](runtime, data) {
      const { cast, impactAt } = data as { cast: RuntimeCast; impactAt: number };
      commit(runtime, cast, impactAt);
    },
    [IMPACT](runtime, data) {
      const { cast, empowered, blight } = data as { cast: RuntimeCast; empowered: boolean; blight: number };
      const profile = requireBalanceProfileFromContext(
        runtime,
        HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(cast.skill.id)]
      );
      addBlight(harbingerState.from(runtime), balanceProfileNumber(profile, 'blightGain'), runtime.time);
      publishBlight(runtime);
      emitEffects(
        runtime,
        cast.skill,
        ((empowered ? profile : cast.skill).effects ?? []).map((effect) => ({
          ...effect,
          atMs: 0,
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          audience:
            effect.type === 'boon' && hasTrait(runtime, TRAIT.TWISTED_MEDICINE) ? party(runtime) : effect.audience
        })),
        cast,
        { blightEmpowered: empowered, necromancerBlight: blight }
      );
    }
  },
  reactions: { 'damage.resolved': harbingerResolverEventReactions.damage }
};
