import type { TraitTrigger } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { SCRAPPER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/scrapper/profiles.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { EngineerRuntimeState, EngineerResolverEvent, EngineerSkill } from '#gw2/professions/engineer/types.js';
import { scrapperState } from '#gw2/professions/engineer/specializations/scrapper/state.js';
import { scrapperMaximumAmmo } from '#gw2/professions/engineer/specializations/scrapper/traits/ex-machina.js';
import { applyScrapperCastTraits } from '#gw2/professions/engineer/specializations/scrapper/traits/index.js';
import {
  scrapperResolverEventReactions,
  triggerMassMomentum
} from '#gw2/professions/engineer/specializations/scrapper/traits/reactions.js';

// Heal classification is shared by actual heals and their toolbelt parents.
const healingSkill = (skill: Skill | undefined) => skill?.type === 'Heal' || skill?.slot === 'Heal';

/** Actual combo results grant Kinetic Accelerators once; one pending pulse rechecks live Stability. */
export const scrapperHooks: Partial<RuntimeProfession<EngineerRuntimeState>> = {
  // Function Gyro's Stability seeds the existing live Stability pulse loop.
  traitTriggers: [
    {
      trait: TRAIT.SPEED_OF_SYNERGY,
      emit: PROFILE.speedOfSynergy,
      on: 'castCommit',
      when: (_runtime, cast) => healingSkill(cast.skill) && cast.skill.id !== ID.MED_KIT,
      effects: (effect) => effect.type === 'buff' && effect.name === 'Healing skill superspeed',
      attribution: { actorType: 'player', name: 'Speed of Synergy \u2014 superspeed' }
    },
    ...(['Healing toolbelt superspeed', 'Med Kit toolbelt superspeed'] as const).map<
      Extract<TraitTrigger<EngineerRuntimeState>, { on: 'castCommit' }>
    >((name) => ({
      trait: TRAIT.SPEED_OF_SYNERGY,
      emit: PROFILE.speedOfSynergy,
      on: 'castCommit' as const,
      when: (runtime, cast) =>
        cast.skill.toolbeltParentId != null &&
        healingSkill(runtime.helpers.skillsById.get((cast.skill as EngineerSkill).toolbeltParentId!)) &&
        (cast.skill.toolbeltParentId === ID.MED_KIT) === (name === 'Med Kit toolbelt superspeed'),
      effects: (effect) => effect.type === 'buff' && effect.name === name,
      attribution: { actorType: 'player' as const, name: 'Speed of Synergy \u2014 superspeed' }
    })),
    {
      trait: TRAIT.GYROSCOPIC_ACCELERATION,
      emit: PROFILE.gyroscopicAcceleration,
      on: 'castCommit',
      when: (_runtime, cast) =>
        cast.skill.id === ID.FUNCTION_GYRO ||
        Boolean(cast.skill.categories?.some((category) => category.toLowerCase() === 'well')),
      effects: (effect) => effect.type === 'buff' && effect.name === 'superspeed',
      attribution: { actorType: 'player', name: 'Gyroscopic Acceleration \u2014 superspeed' }
    },
    // Function Gyro's trait control uses its authored packet and keeps the casting skill's identity.
    {
      trait: TRAIT.SYSTEM_SHOCKER,
      emit: PROFILE.systemShocker,
      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === ID.FUNCTION_GYRO,
      effects: (effect) => effect.type === 'control' && effect.name === 'System Shocker',
      attribution: { name: 'System Shocker — daze' }
    },

    {
      trait: TRAIT.MASS_MOMENTUM,
      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === ID.FUNCTION_GYRO,
      emit: PROFILE.massMomentum,
      effects: (effect) => effect.type === 'boon' && effect.name === 'stability',
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.MASS_MOMENTUM,
        actorType: 'player',
        name: 'Mass Momentum — stability'
      }
    }
  ],
  maximumAmmo: scrapperMaximumAmmo,
  onCastCommit(runtime, cast) {
    if (!cast.cancelled) applyScrapperCastTraits(runtime, cast);
  },
  tasks: {
    'engineer.mass-momentum'(runtime, data) {
      const state = scrapperState.from(runtime);
      if (state.massMomentumAt !== runtime.time) return;
      state.massMomentumAt = Infinity;
      triggerMassMomentum(runtime, { ...(data as EngineerResolverEvent), at: runtime.time });
    }
  },
  reactions: {
    'damage.resolved': scrapperResolverEventReactions.damage,
    'buff.applied': scrapperResolverEventReactions.buff,
    'combo.resolved': scrapperResolverEventReactions.combo
  }
};
