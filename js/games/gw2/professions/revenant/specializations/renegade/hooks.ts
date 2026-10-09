import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import { balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { completeRevenantCastTraits } from '#gw2/professions/revenant/core/traits/dispatch.js';
import { grantRenegadeInvocationFervor } from '#gw2/professions/revenant/core/traits/invocation/behavior.js';
import { revenantLifeSiphonBonus } from '#gw2/professions/revenant/core/traits/invocation/queries.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import {
  renegadeBuffPolicies,
  renegadeEffectStates
} from '#gw2/professions/revenant/specializations/renegade/effect-state.js';
import {
  activeKallasFervorStacks,
  bandTogetherReady
} from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
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
import {
  ashenDemeanor,
  criticalTraits,
  fervorProfile,
  furyTraits,
  grantKallasFervor
} from '#gw2/professions/revenant/specializations/renegade/traits/behavior.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Renegade owns Fervor, warband summons, Kalla's commands, and their actual hit/boon reactions. */
export const renegadeHooks: RuntimeHooks<RevenantRuntimeState, RevenantSkill> = {
  buffPolicies: renegadeBuffPolicies,
  observeEffects: renegadeEffectStates,
  initialize(runtime) {
    renegadeState.from(runtime).kallasFervorMaximumStacks = Math.max(
      1,
      balanceProfileNumber(fervorProfile(runtime), 'maximumStacks')
    );
  },
  // Enhanced Band Together is instant; normal summons keep their authored cast time.
  castDurationMs: (runtime, skill, duration) => (bandTogetherReady(runtime, skill.id) ? 0 : duration),
  // Band Together readiness is sampled before the accepted cast changes its state.

  modifyEffects(_runtime, cast, effects) {
    if (cast.skill.id === ID.HEROIC_COMMAND) return [];
    return bandTogether.get(cast)?.enhanced ? [] : effects;
  },
  sideEffectHandlers: {
    'revenant.heroic-command'(runtime, context) {
      if (context.kind !== 'cast') return;
      // Keep Core rewards ahead of elite completion state and packets.
      completeRevenantCastTraits(runtime, context.cast);
      heroicCommand(runtime, context.cast);
    },
    'revenant.begin-band-together'(runtime, context) {
      if (context.kind === 'cast') beginBandTogether(runtime, context.cast);
    },
    'revenant.arm-razorclaw'(runtime, context) {
      if (context.kind !== 'cast') return;
      // Elite completion follows Core trait publication, including any immediate boon reactions.
      completeRevenantCastTraits(runtime, context.cast);
      const selected = bandTogether.get(context.cast);
      if (!selected) return;
      razorclawsRage(runtime, context.cast, runtime.helpers.skillsById.get(selected.profileSkillId) ?? context.skill);
    },
    'revenant.complete-band-together'(runtime, context) {
      if (context.kind !== 'cast') return;
      // Keep Core rewards ahead of elite completion state and packets.
      completeRevenantCastTraits(runtime, context.cast);
      completeBandTogether(runtime, context.cast);
    },
    'revenant.soulcleave-allies'(runtime, context) {
      if (context.kind !== 'cast') return;
      // Keep Core rewards ahead of elite completion state and packets.
      completeRevenantCastTraits(runtime, context.cast);
      grantSoulcleaveAllies(runtime);
    }
  },
  onCastCommit(runtime, cast) {
    ashenDemeanor(runtime, cast);
    if (cast.skill.id === ID.SWAP_LEGENDS) grantRenegadeInvocationFervor(runtime, grantKallasFervor);
  },
  // Only Bombardment's first resolved hit emits Vindication's control packet.

  reactions: {
    'damage.resolving'(runtime, event) {
      // Core already applied its additive bonus; Fervor joins the same additive life-steal sum.
      const core = revenantLifeSiphonBonus(runtime, event);
      if (core == null) return;
      const stacks = activeKallasFervorStacks(renegadeState.from(runtime), runtime.time);
      if (!stacks) return;
      const perStack = balanceProfileNumber(fervorProfile(runtime), 'lifeSiphonDamagePerStack');
      return {
        flatStrikeMultiplier: ((event.flatStrikeMultiplier ?? 1) * (1 + core + stacks * perStack)) / (1 + core)
      };
    },
    'damage.resolved'(runtime, event, details) {
      if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
      criticalTraits(runtime, event, (details as { hitContext?: Gw2HitResolutionContext }).hitContext);
      razorclawProc(runtime, event);
      soulcleavePlayer(runtime, event);
    },
    'buff.applied': furyTraits
  }
};
