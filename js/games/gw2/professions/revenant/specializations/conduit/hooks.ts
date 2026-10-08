import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { activeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { completeRevenantCastTraits } from '#gw2/professions/revenant/core/traits/dispatch.js';
import { beguilingHazeCastDuration } from '#gw2/professions/revenant/data/beguiling-haze-timing.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND } from '#gw2/professions/revenant/data/legends.js';
import { isRevenantUpkeep } from '#gw2/professions/revenant/data/upkeep-skills.js';
import { conduitBuffPolicies } from '#gw2/professions/revenant/specializations/conduit/effect-state.js';
import {
  UPKEEP_AFFINITY,
  costAffinity,
  upkeepAffinity
} from '#gw2/professions/revenant/specializations/conduit/mechanics/affinity-gains.js';
import {
  conduitAffinityPolicy,
  gainAffinity
} from '#gw2/professions/revenant/specializations/conduit/mechanics/affinity.js';
import { FORM_EXPIRY } from '#gw2/professions/revenant/specializations/conduit/mechanics/form-expiry.js';
import {
  cosmicWisdom,
  formExpiry,
  swapLegend
} from '#gw2/professions/revenant/specializations/conduit/mechanics/forms.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import {
  BEGUILING_HAZE_SKILL_IDS,
  TWIN_MOON_SKILL_IDS
} from '#gw2/professions/revenant/specializations/conduit/skill-groups.js';
import {
  cleanseHexEater,
  completeBeguilingHaze
} from '#gw2/professions/revenant/specializations/conduit/skills/entity-skills.js';
import {
  UPKEEP_DAGGERS,
  dervishAttack,
  dervishCasts,
  lesserDaggers,
  upkeepDaggers
} from '#gw2/professions/revenant/specializations/conduit/skills/form-attacks.js';
import {
  MESMER_RELEASE,
  mesmerRelease,
  scheduleMesmerReleaseConditions
} from '#gw2/professions/revenant/specializations/conduit/skills/mesmer-release.js';
import { conduitState, revenantConduitFormIsActive } from '#gw2/professions/revenant/specializations/conduit/state.js';
import {
  enhancedLegendRecharge,
  kineticInsightRecharge
} from '#gw2/professions/revenant/specializations/conduit/traits/behavior.js';
import { completionSharedWisdom } from '#gw2/professions/revenant/specializations/conduit/traits/shared-wisdom.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const RELEASE_POTENTIAL_IDS = new Set<SkillId>(Object.values(REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND));

export const conduitHooks: RuntimeHooks<RevenantRuntimeState, RevenantSkill> = {
  resources: { affinity: conduitAffinityPolicy },
  buffPolicies: conduitBuffPolicies,
  // Passive affinity accrual does not extend damage observation; damaging dagger upkeep remains bounded normally.
  backgroundTasks: [UPKEEP_AFFINITY],
  // Control-triggered Burning shares Mistfire's profile, excluding its own Twin Moon chain.

  availability(runtime, skill) {
    const state = conduitState.from(runtime);
    if (BEGUILING_HAZE_SKILL_IDS.has(skill.id)) {
      // Project the shared recharge without mutating state during an availability query.
      const readyAt = state.beguilingHazeRecharge
        ? gw2CooldownReadyAt(runtime.cooldownController.project(skill, state.beguilingHazeRecharge))
        : state.beguilingHazeReadyAt;
      if ((state.beguilingHazeCharges || 0) <= 0 && runtime.time < (readyAt || 0))
        return denySkillCast(skill, 'revenant.beguiling-haze-cooldown', 'Beguiling Haze is recharging.', readyAt);
    }

    // All five variants share one bar slot; block the variant the active legend does not supply.
    if (
      RELEASE_POTENTIAL_IDS.has(skill.id) &&
      REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND[runtime.profession.core.activeLegendId] !== skill.id
    )
      return denySkillCast(
        skill,
        'revenant.release-variant',
        'the active legend supplies a different Release Potential variant.'
      );
    return { ready: true };
  },
  castDurationMs(runtime, skill, durationMs) {
    if (!BEGUILING_HAZE_SKILL_IDS.has(skill.id)) return durationMs;
    const specialization = runtime.profession.specialization;
    if (specialization.kind !== 'Conduit') throw new TypeError('Beguiling Haze requires Conduit state.');
    return (
      beguilingHazeCastDuration(
        durationMs / 1000,
        (specialization.state.beguilingHazeCharges || 0) > 0,
        requireBalanceProfileFromContext(runtime, PROFILE.beguilingHazeFollowUp),
        requireBalanceProfileFromContext(runtime, PROFILE.beguilingHazeMainCastExtension)
      ) * 1000
    );
  },
  rechargeWork(runtime, skill, work) {
    if (skill.id === ID.SWAP_LEGENDS) return enhancedLegendRecharge(runtime, skill, work);

    const mesmerProfile =
      skill.id === ID.PAIN_ABSORPTION
        ? PROFILE.mesmerPainAbsorption
        : skill.id === ID.BANISH_ENCHANTMENT
          ? PROFILE.mesmerBanishEnchantment
          : null;
    // Mesmer form gives these Demon utilities a recharge; Alacrity still applies to the new base.
    if (mesmerProfile && revenantConduitFormIsActive(conduitState.from(runtime), 'Mesmer', runtime.time))
      return Math.max(0, balanceProfileNumber(requireBalanceProfileFromContext(runtime, mesmerProfile), 'cooldown'));
    return kineticInsightRecharge(runtime, skill, work);
  },
  onCastStart(runtime, cast) {
    const skill = cast.skill;
    costAffinity(runtime, cast);
    if (
      skill.legendId === LEGEND.ENTITY &&
      revenantConduitFormIsActive(conduitState.from(runtime), 'Dervish', cast.start)
    )
      dervishCasts.add(cast);
  },
  onCastCommit(runtime, cast) {
    const skill = cast.skill;
    // Cosmic Wisdom form procs follow successful casts through the common completion path.
    if (skill.legendId === LEGEND.ASSASSIN) lesserDaggers(runtime, skill);
    if (dervishCasts.has(cast)) {
      dervishAttack(runtime, cast, runtime.time);
      if (TWIN_MOON_SKILL_IDS.has(skill.id)) dervishAttack(runtime, cast, runtime.time, true);
    }

    dervishCasts.delete(cast);
    // Shared Wisdom Swiftness belongs only to Entity legend skills.
    if (skill.legendId === LEGEND.ENTITY) completionSharedWisdom(runtime, cast, 'entity-skill');

    if (skill.id === ID.SWAP_LEGENDS) swapLegend(runtime, cast);
    if (isRevenantUpkeep(skill) && activeRevenantUpkeep(runtime, skill.id, runtime.time)) {
      const data = { skillId: skill.id, startsAt: runtime.time };
      runtime.schedule(UPKEEP_AFFINITY, canonicalTime(runtime.time + 3), data, undefined, -200);
      if (skill.id === ID.IMPOSSIBLE_ODDS)
        runtime.schedule(UPKEEP_DAGGERS, canonicalTime(runtime.time + 1), data, undefined, -190);
    }
  },
  sideEffectHandlers: {
    'revenant.complete-haze'(runtime, context) {
      if (context.kind !== 'cast') return;
      // Shared Wisdom is already published; Core traits precede the shared-ammo transition.
      completeRevenantCastTraits(runtime, context.cast);
      completeBeguilingHaze(runtime, context.cast);
    },
    'revenant.hex-eater-cleanse'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Hex-Eater cleanse requires a cast.');
      cleanseHexEater(runtime, context.cast);
    },
    'revenant.mesmer-release'(runtime, context) {
      if (context.kind === 'cast') scheduleMesmerReleaseConditions(runtime, context.cast);
    },
    'revenant.cosmic-wisdom'(runtime, context) {
      if (context.kind !== 'cast') return;
      // Core cast traits must see the pre-form attributes before Cosmic Wisdom opens its form.
      completeRevenantCastTraits(runtime, context.cast);
      cosmicWisdom(runtime, context.cast);
    },
    'revenant.entity-hit-affinity'(runtime, context) {
      if (context.kind === 'effect') gainAffinity(runtime, (context.skill.energyCost || 0) >= 25 ? 2 : 1);
    }
  },
  onCooldownReset(runtime) {
    // A full cooldown reset makes Beguiling Haze immediately available.
    conduitState.from(runtime).beguilingHazeReadyAt = runtime.time;
    conduitState.from(runtime).beguilingHazeRecharge = null;
  },
  tasks: {
    [FORM_EXPIRY]: formExpiry,
    [UPKEEP_AFFINITY]: upkeepAffinity,
    [UPKEEP_DAGGERS]: upkeepDaggers,
    [MESMER_RELEASE]: mesmerRelease
  }
};
