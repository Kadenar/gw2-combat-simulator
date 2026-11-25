import { gw2Time } from '#gw2/platform/combat/clock.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { ACTOR } from '#gw2/platform/constants.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { payPendingEnergy } from '#gw2/professions/revenant/core/mechanics/resources.js';
import { eliteLegendInvoked } from '#gw2/professions/revenant/core/mechanics/trigger-points.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import {
  renegadeBuffPolicies,
  renegadeEffectStates
} from '#gw2/professions/revenant/specializations/renegade/effect-state.js';
import { bandTogetherReady } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import {
  renegadeBoonApplied,
  renegadeCastCompleted,
  renegadeStruck
} from '#gw2/professions/revenant/specializations/renegade/mechanics/trigger-points.js';
import { heroicCommand } from '#gw2/professions/revenant/specializations/renegade/skills/heroic-command.js';
import {
  grantSoulcleaveAllies,
  soulcleavePlayer
} from '#gw2/professions/revenant/specializations/renegade/skills/soulcleave.js';
import {
  bandTogether,
  beginBandTogether,
  completeBandTogether,
  razorclawProc,
  razorclawsRage
} from '#gw2/professions/revenant/specializations/renegade/skills/warband.js';
import { renegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Renegade owns Fervor, warband summons, Kalla's commands, and their actual hit/boon reactions. */
export const renegadeHooks: RuntimeHooks<RevenantRuntimeState, RevenantSkill> = {
  /** Hold the selected preview state while evaluating detached damage queries. */
  prepareDamageState(runtime, _skill, inputs) {
    const state = renegadeState.from(runtime.profession);
    state.kallasFervor = Array.from({ length: Number(inputs.kallasFervor ?? 0) }, () => ({
      at: runtime.time,
      expiresAt: Infinity
    }));

    if ('fullEndurance' in inputs)
      runtime.profession.core.endurance.value = inputs.fullEndurance ? ENDURANCE.maximum : 0;
  },
  buffPolicies: renegadeBuffPolicies,
  observeEffects: renegadeEffectStates,
  // Enhanced Band Together is instant; normal summons keep their authored cast time.
  castDurationMs: (runtime, skill, duration) => (bandTogetherReady(runtime, skill.id) ? 0 : duration),
  // Band Together readiness is sampled before the accepted cast changes its state.

  modifyEffects: (_runtime, cast, effects) => (bandTogether.get(cast)?.enhanced ? [] : effects),
  onCastStart(runtime, cast) {
    if (cast.skill.id !== ID.ICERAZORS_IRE && cast.skill.id !== ID.RAZORCLAWS_RAGE) return;

    const spendAt = gw2Time(cast.start + 0.32);

    // Instant Band Together casts pay before their enhancement rewards, so All for One never lands on an unpaid pool.
    if (cast.fullEnd < spendAt) payPendingEnergy(runtime, cast.id, cast.skill.name);
    // Normal summons spend during their windup.
    else if (cast.effectiveEnd >= spendAt)
      runtime.schedule(
        'renegade.pay-summon-energy',
        spendAt,
        { castId: cast.id, skillName: cast.skill.name },
        undefined,
        -101
      );
  },
  tasks: {
    // Pay before cancellation or a legend swap at the same instant.
    'renegade.pay-summon-energy'(runtime, data) {
      const { castId, skillName } = data as { castId: string; skillName: string };
      payPendingEnergy(runtime, castId, skillName);
    }
  },
  sideEffectHandlers: {
    'revenant.heroic-command'(runtime, context) {
      if (context.kind === 'cast') heroicCommand(runtime, context.cast);
    },
    'revenant.begin-band-together'(runtime, context) {
      if (context.kind === 'cast') beginBandTogether(runtime, context.cast);
    },
    'revenant.arm-razorclaw'(runtime, context) {
      if (context.kind !== 'cast') return;

      const selected = bandTogether.get(context.cast);

      if (!selected) return;

      razorclawsRage(runtime, context.cast, runtime.helpers.skillsById.get(selected.profileSkillId) ?? context.skill);
    },
    'revenant.complete-band-together'(runtime, context) {
      if (context.kind === 'cast') completeBandTogether(runtime, context.cast);
    },
    'revenant.soulcleave-allies'(runtime, context) {
      if (context.kind !== 'cast') return;

      grantSoulcleaveAllies(runtime);
    }
  },
  onCastCommit(runtime, cast) {
    runtime.fireTrigger(renegadeCastCompleted, { cast });

    if (cast.skill.id === ID.SWAP_LEGENDS) runtime.fireTrigger(eliteLegendInvoked);
  },
  // Only Bombardment's first resolved hit emits Vindication's control packet.

  reactions: {
    'damage.resolved'(runtime, event, details) {
      if (event.actorType !== ACTOR.PLAYER || !(Number(event.coefficient) > 0)) return;

      runtime.fireTrigger(renegadeStruck, {
        cause: event,
        hit: details.hitContext
      });
      razorclawProc(runtime, event);
      soulcleavePlayer(runtime, event);
    },
    'buff.applied'(runtime, event) {
      runtime.fireTrigger(renegadeBoonApplied, { cause: event });
    }
  }
};
