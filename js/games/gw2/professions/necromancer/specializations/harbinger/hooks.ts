import { harbingerBuffPolicies } from '#gw2/professions/necromancer/specializations/harbinger/effect-state.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { timedEffectState } from '#gw2/platform/combat/effect-state.js';
import { BLIGHT_MAXIMUM_STACKS } from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { isHostileTargetEvent } from '#gw2/platform/combat/state/targets.js';
import { effectFirstAt, scaleCastBoundTiming } from '#gw2/platform/effects/materializer.js';
import type { EffectMetadata, SimulationEvent } from '#gw2/platform/events/events.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { sideEffectAmount } from '#gw2/platform/effects/action-dispatch.js';
import { quantizeGw2ActionTimingMs } from '#gw2/platform/combat/action-tick.js';
import { registerNecromancerShroudLifecycle } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import {
  addBlight,
  consumeBlight,
  harbingerState,
  purgeHarbingerTimedState
} from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import {
  applyBolsteringBrew,
  applyCascadingCorruption,
  applyHarbingerEntryTraits,
  doomApproachesBlightProfile,
  doomApproachesControl,
  harbingerResolverEventReactions,
  initializeAlchemicVigor,
  twistedMedicineAudience
} from '#gw2/professions/necromancer/specializations/harbinger/traits/behavior.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const BLIGHT = 'harbinger.blight-clock';
const COMMIT = 'harbinger.blight-commit';
const IMPACT = 'harbinger.elixir-impact';
const MOVEMENT = 'harbinger.movement-impact';

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
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'necromancer',
      sourceId: ID.HARBINGER_SHROUD,
      actorType: 'player',
      skillName: 'Blight',
      kind: 'harbinger-blight',
      stacks: state.blight,
      duration: state.blight ? Math.max(...state.blightExpiries) - runtime.time : 0
    }
  });
  refreshBlight(runtime);
}

/** Spending counts once at commitment; only the delayed explosion can damage the target. */
function spendBlight(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): boolean {
  const state = harbingerState.from(runtime);
  const profile = requireBalanceProfileFromContext(
    runtime,
    HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(cast.skill.id)]
  );
  const cost = balanceProfileNumber(profile, 'blightCost');
  const empowered = state.blight >= cost;
  const consumed = empowered ? consumeBlight(state, cost, runtime.time) : 0;
  applyCascadingCorruption(runtime, cast, consumed);

  publishBlight(runtime);
  return empowered;
}

/** Elixir launch spends live Blight before queuing its independent local and hostile impact. */
function launchElixir(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>, impactAt: number): void {
  const empowered = spendBlight(runtime, cast);
  const blight = harbingerState.from(runtime).blight;
  applyBolsteringBrew(runtime, cast);

  runtime.scheduleForCast(IMPACT, impactAt, cast, { empowered, blight });
}

/** Movement launch carries the post-spend snapshot; its authored control receives the trait replacement. */
function launchMovement(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  const empowered = spendBlight(runtime, cast);
  const blight = harbingerState.from(runtime).blight;
  const profile = empowered
    ? requireBalanceProfileFromContext(runtime, HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(cast.skill.id)])
    : cast.skill;
  {
    // Shared emission owns transport; the mechanic selects attribution and delivery.
    const emissionRuntime: NecromancerRuntime = runtime;
    const emissionSkill: Skill = cast.skill;
    const emissionEffects: readonly SkillEffect[] = [
      ...(profile.effects ?? []),
      ...(empowered ? (cast.skill.effects?.filter((effect) => effect.type === 'control') ?? []) : [])
    ].map((effect) => doomApproachesControl(runtime, effect));
    const emissionCast = cast;
    const emissionMetadata: EffectMetadata | undefined = {
      necromancerBlight: blight
    };
    const emissionCause: SimulationEvent | undefined = undefined;

    emissionRuntime.effects.emit({
      kind: 'profile',
      cause: emissionCause,
      profile: emissionSkill,
      effects: emissionEffects,
      attribution: (effect) => ({
        source: effect.source ?? (emissionSkill.type === 'Trait' ? 'Trait' : 'necromancer'),
        sourceId: effect.sourceId ?? emissionSkill.id,
        skillId: emissionSkill.id,
        skillName: emissionSkill.name,
        actorType: effect.actorType ?? (emissionSkill.type === 'Trait' ? 'effect' : 'player'),
        activationId:
          emissionSkill.id !== emissionCast.skill.id
            ? emissionCast.id + ':effect:' + emissionSkill.id
            : emissionCast.id,
        metadata: emissionMetadata
      }),
      skillWeaponFallback: 'Unequipped',
      transform: (event) => ({
        ...event,
        parentSkillName: emissionCast.skill.id !== emissionSkill.id ? emissionCast.skill.name : undefined,
        ...(event.type === 'damage' ? { name: emissionSkill.name } : {}),
        ...(event.type === 'condition' ? { name: emissionSkill.name + ' — ' + event.condition } : {}),
        offTarget: emissionCast.command.offTarget,
        at: canonicalTime(
          event.at +
            (emissionSkill.id === emissionCast.skill.id && isHostileTargetEvent(event)
              ? (emissionCast.command.impactDelayMs ?? 0) / 1000
              : 0)
        )
      })
    });
  }
}

/** Blight lives on the one runtime; shroud callbacks own every entry and exit, including automatic depletion. */
export const harbingerHooks: RuntimeHooks<NecromancerRuntimeState, NecromancerSkill> = {
  buffPolicies: harbingerBuffPolicies,
  // Observe the same retained pools and mode flags that Harbinger combat mutates.
  observeEffects(runtime) {
    const state = harbingerState.from(runtime);
    return [
      timedEffectState(
        'harbinger-blight',
        state.blightExpiries.map((expiresAt) => ({ expiresAt, stacks: 1 })),
        BLIGHT_MAXIMUM_STACKS,
        { name: 'Blight' }
      ),
      timedEffectState(
        'harbinger-shroud',
        runtime.profession.core.activeShroud ? [{ stacks: 1, expiresAt: null }] : [],
        1,
        { name: 'Harbinger Shroud' }
      ),
      timedEffectState('meltdown', [{ stacks: 1, expiresAt: state.meltdownUntil }], 1)
    ];
  },
  initialize(runtime) {
    initializeAlchemicVigor(runtime);

    registerNecromancerShroudLifecycle(runtime, 'harbinger.shroud', {
      onEnter(skill) {
        if (skill.shroudEntry !== 'harbinger') return;
        harbingerState.from(runtime).nextBlightAt = Math.floor(runtime.time) + 1;
        applyHarbingerEntryTraits(runtime, skill);
        refreshBlight(runtime);
      },
      onExit() {
        harbingerState.from(runtime).nextBlightAt = Infinity;
        refreshBlight(runtime);
      }
    });
    publishBlight(runtime);
  },

  sideEffectHandlers: {
    'harbinger.elixir-launch'(runtime, context) {
      if (context.kind !== 'cast' || context.cast.cancelled) return;
      const cast = context.cast;
      const strike = cast.skill.effects?.find((effect) => effect.type === 'strike');
      const impactAt = strike
        ? effectFirstAt(cast.start, cast.fullEnd, scaleCastBoundTiming(cast, cast.skill, strike))
        : cast.fullEnd;
      const at = canonicalTime(cast.start + 0.36);
      runtime.scheduleForCast(COMMIT, at, cast, { impactAt: Math.max(at, canonicalTime(impactAt)) });
    },
    'harbinger.movement-launch'(runtime, context, action) {
      if (context.kind !== 'cast') return;
      const cast = context.cast;
      if (action.type !== 'harbinger.movement-launch' || action.amount == null)
        throw new TypeError('Movement launch requires progress.');
      const progress = sideEffectAmount(runtime, action.amount);
      const at = canonicalTime(
        cast.start + quantizeGw2ActionTimingMs((cast.fullEnd - cast.start) * progress * 1000) / 1000
      );
      if (at <= cast.effectiveEnd) runtime.scheduleForCast(MOVEMENT, at, cast);
    }
  },

  tasks: {
    [BLIGHT](runtime) {
      const state = harbingerState.from(runtime);
      purgeHarbingerTimedState(state, runtime.time);
      if (state.meltdownUntil && state.meltdownUntil <= runtime.time) state.meltdownUntil = 0;
      if (runtime.profession.core.activeShroud === 'harbinger' && Number(state.nextBlightAt) <= runtime.time) {
        const profile = requireBalanceProfileFromContext(runtime, doomApproachesBlightProfile(runtime));
        addBlight(state, balanceProfileNumber(profile, 'blightGain'), runtime.time);
        state.nextBlightAt = runtime.time + 1;
      }

      publishBlight(runtime);
    },
    [COMMIT](runtime, data) {
      const { cast, impactAt } = data as { cast: RuntimeCast<NecromancerSkill>; impactAt: number };
      launchElixir(runtime, cast, impactAt);
    },
    [MOVEMENT](runtime, data) {
      launchMovement(runtime, (data as { cast: RuntimeCast<NecromancerSkill> }).cast);
    },
    [IMPACT](runtime, data) {
      const { cast, empowered, blight } = data as {
        cast: RuntimeCast<NecromancerSkill>;
        empowered: boolean;
        blight: number;
      };
      const profile = requireBalanceProfileFromContext(
        runtime,
        HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(cast.skill.id)]
      );
      addBlight(harbingerState.from(runtime), balanceProfileNumber(profile, 'blightGain'), runtime.time);
      publishBlight(runtime);
      {
        // Shared emission owns transport; the mechanic selects attribution and delivery.
        const emissionRuntime: NecromancerRuntime = runtime;
        const emissionSkill: Skill = cast.skill;
        const emissionEffects: readonly SkillEffect[] = ((empowered ? profile : cast.skill).effects ?? []).map(
          (effect) => ({
            ...effect,
            atMs: 0,
            timingAnchor: 'castStart',
            timingScale: 'fixed',
            audience: twistedMedicineAudience(runtime, effect)
          })
        );
        const emissionCast = cast;
        const emissionMetadata: EffectMetadata | undefined = { necromancerBlight: blight };
        const emissionCause: SimulationEvent | undefined = undefined;

        emissionRuntime.effects.emit({
          kind: 'profile',
          cause: emissionCause,
          profile: emissionSkill,
          effects: emissionEffects,
          attribution: (effect) => ({
            source: effect.source ?? (emissionSkill.type === 'Trait' ? 'Trait' : 'necromancer'),
            sourceId: effect.sourceId ?? emissionSkill.id,
            skillId: emissionSkill.id,
            skillName: emissionSkill.name,
            actorType: effect.actorType ?? (emissionSkill.type === 'Trait' ? 'effect' : 'player'),
            activationId:
              emissionSkill.id !== emissionCast.skill.id
                ? emissionCast.id + ':effect:' + emissionSkill.id
                : emissionCast.id,
            metadata: emissionMetadata
          }),
          skillWeaponFallback: 'Unequipped',
          transform: (event) => ({
            ...event,
            parentSkillName: emissionCast.skill.id !== emissionSkill.id ? emissionCast.skill.name : undefined,
            ...(event.type === 'damage' ? { name: emissionSkill.name } : {}),
            ...(event.type === 'condition' ? { name: emissionSkill.name + ' — ' + event.condition } : {}),
            offTarget: emissionCast.command.offTarget,
            at: canonicalTime(
              event.at +
                (emissionSkill.id === emissionCast.skill.id && isHostileTargetEvent(event)
                  ? (emissionCast.command.impactDelayMs ?? 0) / 1000
                  : 0)
            )
          })
        });
      }
    }
  },
  reactions: { 'damage.resolved': harbingerResolverEventReactions.damage }
};
