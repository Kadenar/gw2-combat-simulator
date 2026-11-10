import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND } from '#gw2/professions/revenant/data/legends.js';
import { conduitBuffPolicies } from '#gw2/professions/revenant/specializations/conduit/effect-state.js';
import { costAffinity } from '#gw2/professions/revenant/specializations/conduit/mechanics/affinity-gains.js';
import {
  conduitAffinityPolicy,
  gainAffinity
} from '#gw2/professions/revenant/specializations/conduit/mechanics/affinity.js';
import { beguilingHazeLifecycle } from '#gw2/professions/revenant/specializations/conduit/mechanics/beguiling-haze.js';
import { conduitFormLifecycle } from '#gw2/professions/revenant/specializations/conduit/mechanics/forms.js';
import {
  entityBoonCompleted,
  entityCastCompleted
} from '#gw2/professions/revenant/specializations/conduit/mechanics/trigger-points.js';
import { conduitUpkeepLifecycle } from '#gw2/professions/revenant/specializations/conduit/mechanics/upkeep.js';
import { cleanseHexEater } from '#gw2/professions/revenant/specializations/conduit/skills/entity-skills.js';
import {
  dervishAttack,
  dervishCasts,
  lesserDaggers
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
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';

const RELEASE_POTENTIAL_IDS = new Set<SkillId>(Object.values(REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND));

const conduitLifecycle: RuntimeHooks<RevenantRuntimeState, RevenantSkill> = {
  resources: { affinity: conduitAffinityPolicy },
  buffPolicies: conduitBuffPolicies,
  // Control-triggered Burning shares Mistfire's profile, excluding its own Twin Moon chain.

  availability(runtime, skill) {
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
  rechargeWork(runtime, skill, work) {
    if (skill.id === ID.SWAP_LEGENDS) return enhancedLegendRecharge(runtime, skill, work);

    // Form-specific recharge belongs to the selected Demon skill, independently of its normal cooldown.
    if (
      (skill.id === ID.PAIN_ABSORPTION || skill.id === ID.BANISH_ENCHANTMENT) &&
      revenantConduitFormIsActive(conduitState.from(runtime.profession), 'Mesmer', runtime.time)
    )
      return Math.max(0, skillNumber(requireSkill(runtime.helpers, skill.id), 'mesmerRecharge'));

    return kineticInsightRecharge(runtime, skill, work);
  },
  onCastStart(runtime, cast) {
    const skill = cast.skill;
    costAffinity(runtime, cast);

    if (
      skill.legendId === LEGEND.ENTITY &&
      revenantConduitFormIsActive(conduitState.from(runtime.profession), 'Dervish', cast.start)
    )
      dervishCasts.add(cast);
  },
  onCastCommit(runtime, cast) {
    const skill = cast.skill;

    // Cosmic Wisdom form procs follow successful casts through the common completion path.
    if (skill.legendId === LEGEND.ASSASSIN) lesserDaggers(runtime, skill);

    if (dervishCasts.has(cast)) {
      dervishAttack(runtime, cast, runtime.time);

      if (skill.id === ID.TWIN_MOON_SWEEP) dervishAttack(runtime, cast, runtime.time, true);
    }

    dervishCasts.delete(cast);

    // Shared Wisdom Swiftness belongs only to Entity legend skills.
    if (skill.legendId === LEGEND.ENTITY) runtime.fireTrigger(entityCastCompleted, { cast });
  },
  sideEffectHandlers: {
    'revenant.entity-boon-completed'(runtime, context) {
      if (context.kind === 'cast') runtime.fireTrigger(entityBoonCompleted, { cast: context.cast });
    },
    'revenant.hex-eater-cleanse'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Hex-Eater cleanse requires a cast.');

      cleanseHexEater(runtime, context.cast);
    },
    'revenant.mesmer-release'(runtime, context) {
      if (context.kind === 'cast') scheduleMesmerReleaseConditions(runtime, context.cast);
    },
    'revenant.entity-hit-affinity'(runtime, context) {
      if (context.kind === 'effect') gainAffinity(runtime, (context.skill.energyCost || 0) >= 25 ? 2 : 1);
    }
  },
  tasks: {
    [MESMER_RELEASE]: mesmerRelease
  }
};

/** Start upkeep contributions after Conduit's immediate completion rewards and form transitions. */
export const conduitHooks = composeRuntimeHooks<RevenantRuntimeState, RevenantSkill>([
  beguilingHazeLifecycle,
  conduitLifecycle,
  conduitFormLifecycle,
  conduitUpkeepLifecycle
]);
