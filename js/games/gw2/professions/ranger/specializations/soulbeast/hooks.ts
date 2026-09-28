import type { TraitTrigger } from '#gw2/platform/profession-definition/trigger-rules.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { RangerRuntimeState } from '#gw2/professions/ranger/types.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { soulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import { soulbeastCastAvailability } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import {
  soulbeastEventHandlers,
  reactToRangerWinterBite,
  reactToSoulbeastBuff,
  reactToSoulbeastDamage
} from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { setRangerPetActive } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import { applyRangerBeastSkillTraits } from '#gw2/professions/ranger/core/traits/index.js';
import { setBeastmode } from '#gw2/professions/ranger/specializations/soulbeast/skills/beastmode-skills.js';
import { activateSoulbeastStance } from '#gw2/professions/ranger/specializations/soulbeast/skills/stance-skills.js';
import { rangerEvent } from '#gw2/professions/ranger/core/events.js';
import { scheduleSharedStance } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';

/** Merge, stance grants, and hit reactions mutate their sole state slice at the owning cast boundary. */
export const soulbeastHooks: Partial<RuntimeProfession<RangerRuntimeState>> = {
  // Control rewards retain the triggering recipient; poison siphons remain noncritical profile strikes.
  traitTriggers: [
    ...(
      [
        [TRAIT.TWICE_AS_VICIOUS, PROFILE.twiceAsVicious, 'Twice as Vicious', ['twice-as-vicious']],
        [TRAIT.BESTIAL_RAGE, PROFILE.bestialRage, 'Bestial Rage', ['might', 'fury']]
      ] as const
    ).map<Exclude<TraitTrigger<RangerRuntimeState>, { on: 'castStart' | 'castCommit' }>>(
      ([trait, emit, name, names]) => ({
        trait,
        emit,
        on: 'control.resolved',
        ...(trait === TRAIT.BESTIAL_RAGE ? { icd: 'profile' as const } : {}),
        when: (runtime) =>
          names.some((effectName) =>
            Boolean(
              requireEffect(
                requireBalanceProfileFromContext(runtime, emit),
                effectName === 'twice-as-vicious' ? 'buff' : 'boon',
                effectName
              )
            )
          ),
        effects: (effect) =>
          (effect.type === 'boon' || effect.type === 'buff') && names.some((name) => name === effect.name),
        attribution: (_runtime, event) => ({
          skillId: trait,
          skillName: name,
          name,
          triggeredBy: event.skillName,
          ...(event.metadata?.triggeredByAlly
            ? {
                audience: {
                  recipients: 'party' as const,
                  alliedPlayerIndex: event.metadata.triggeredByAlly,
                  affectsSelf: false,
                  maximumRecipients: 1,
                  eligibleCompanionIds: []
                },
                metadata: { triggeredByAlly: event.metadata.triggeredByAlly }
              }
            : {})
        })
      })
    ),
    {
      trait: TRAIT.PREDATORS_CUNNING,
      emit: PROFILE.predatorsCunning,
      on: 'condition.applied',
      when: (_runtime, event) => event.condition === 'Poisoned',
      effects: (effect) => effect.type === 'strike' && effect.name === 'Strike',
      attribution: (_runtime, event) => ({
        skillId: TRAIT.PREDATORS_CUNNING,
        skillName: "Predator's Cunning",
        name: "Predator's Cunning",
        skillWeapon: 'Unequipped',
        triggeredBy: event.skillName
      })
    }
  ],
  initialize(runtime) {
    setRangerPetActive(runtime, !soulbeastState.from(runtime).beastmodeActive);
  },
  onCombatStart(runtime) {
    for (const event of soulbeastState.from(runtime).pendingSharedStances.splice(0))
      scheduleSharedStance(runtime, event);
  },
  availability: soulbeastCastAvailability,
  sideEffectHandlers: {
    'ranger.beastmode-enter'(runtime, context) {
      setBeastmode(runtime, context.skill, true);
    },
    'ranger.beastmode-leave'(runtime, context) {
      setBeastmode(runtime, context.skill, false);
    },
    'ranger.vulture-stance'(runtime, context) {
      activateSoulbeastStance(runtime, context.skill, 'vulture-stance', PROFILE.vultureStance);
    },
    'ranger.one-wolf-pack'(runtime, context) {
      soulbeastState.from(runtime).oneWolfPackUntil =
        runtime.time + activateSoulbeastStance(runtime, context.skill, 'one-wolf-pack', PROFILE.oneWolfPack);
    }
  },
  onCastCommit(runtime, cast) {
    const state = soulbeastState.from(runtime);
    const skill = cast.skill;
    if (skill.id === ID.PET_SWAP) state.archetype = rangerPetByName(runtime.profession.core.activePet).archetype;
    if (!state.beastmodeActive) return;
    if (skill.categories?.includes('Command') && hasTrait(runtime, TRAIT.RESOUNDING_TIMBRE))
      runtime.emit(
        rangerEvent(
          {
            at: runtime.time,
            sourceId: TRAIT.RESOUNDING_TIMBRE,
            skillId: skill.id,
            skillName: 'Resounding Timbre',
            duration: balanceProfileNumber(
              requireBalanceProfileFromContext(runtime, CORE_PROFILE.resoundingTimbre),
              'durationMultiplier'
            )
          },
          'boon_extension'
        )
      );
    if (skill.beastmodeSkill && skill.id !== ID.BEASTMODE && skill.id !== ID.LEAVE_BEASTMODE)
      applyRangerBeastSkillTraits(runtime, skill, false);
  },
  eventHandlers: soulbeastEventHandlers,
  reactions: {
    'damage.resolved'(runtime, event) {
      reactToSoulbeastDamage(runtime, event);
      reactToRangerWinterBite(runtime, event);
    },
    'buff.applied': reactToSoulbeastBuff
  }
};
