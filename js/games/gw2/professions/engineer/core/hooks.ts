import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import { onResolvedCriticalHit } from '#gw2/platform/profession-definition/mechanics.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import type { RuntimeProfession, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';
import type { EngineerRuntime, EngineerRuntimeState, EngineerSkill } from '#gw2/professions/engineer/types.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/core/profiles.js';
import { engineerEndurance } from '#gw2/professions/engineer/core/mechanics/resources.js';
import { engineerCoreCastAvailability } from '#gw2/professions/engineer/core/mechanics/availability.js';
import { engineerRechargeWork } from '#gw2/professions/engineer/core/traits/modifiers.js';
import {
  handleAirBlast,
  handleConduitSurge,
  handleElectricArtillery,
  handleLightningRodPulse
} from '#gw2/professions/engineer/core/mechanics/event-handlers.js';
import { resetExplosiveEntrance } from '#gw2/professions/engineer/core/traits/explosives.js';
import {
  applyEngineerCastTraits,
  applyEngineerToolbeltTraits,
  engineerCoreCriticalHitDefinitions,
  isEngineerToolbeltSkill,
  prepareEngineerHghEvent,
  reactToEngineerCondition,
  reactToEngineerDamage
} from '#gw2/professions/engineer/core/traits/index.js';
import { emitEngineerEvent } from '#gw2/professions/engineer/core/events.js';
import {
  completeEngineerSpear,
  completeEngineerTurret,
  engineerWeaponTasks
} from '#gw2/professions/engineer/core/mechanics/weapons.js';

const critical = engineerCoreCriticalHitDefinitions.map(onResolvedCriticalHit);
const customSpear = new Set([ID.LIGHTNING_ROD, ID.CONDUIT_SURGE, ID.ELECTRIC_ARTILLERY]);

/** Recharge reductions operate on live remaining work, including ammo recharge, and report only effective changes. */
function reduceRecharge(
  runtime: EngineerRuntime,
  cast: RuntimeCast,
  predicate: (skill: EngineerSkill) => boolean,
  seconds: number,
  sourceId: number | string,
  name: string
): void {
  let reducedBy = 0;
  for (const skill of runtime.helpers.skillsById.values())
    if (predicate(skill)) reducedBy += runtime.cooldownController.reduceSkillRecharge(skill, seconds, runtime.time);
  if (reducedBy > 0)
    emitEngineerEvent(runtime, 'proc', {
      at: runtime.time,
      source: sourceId === cast.skill.id ? 'engineer' : 'Trait',
      sourceId,
      name,
      procType: sourceId === cast.skill.id ? 'skill' : 'trait',
      sourceSkill: cast.skill.name,
      cooldownReduction: reducedBy
    });
}

/** Precast mines retain activation ownership until the actual combat boundary permits detonation. */
function detonateMines(runtime: EngineerRuntime): void {
  const skill = runtime.helpers.skillsById.get(ID.MINE_FIELD)!;
  const detonation = runtime.helpers.skillsById.get(ID.DETONATE_MINE_FIELD)!;
  for (const activationId of runtime.profession.core.pendingMineFieldActivationIds.splice(0)) {
    for (const effect of skill.effects ?? [])
      for (const { event } of materializeSkillEffectApplications({
        skill,
        effect,
        start: runtime.time,
        fullEnd: runtime.time,
        baseEvent: { source: 'engineer', sourceId: skill.id, actorType: 'player', activationId }
      }))
        if (event.type === 'damage' || event.type === 'condition')
          emitEngineerEvent(runtime, event.type, { ...event, at: runtime.time }, skill);
    applyEngineerToolbeltTraits(runtime, detonation, runtime.time);
  }
}

export const engineerCoreHooks: Partial<RuntimeProfession<EngineerRuntimeState>> = {
  endurance: engineerEndurance,
  availability: engineerCoreCastAvailability,
  rechargeWork: engineerRechargeWork,
  reserveRecharge: (_runtime, skill, work) => (skill.id === ID.HEALING_TURRET ? 0 : work),
  prepareEvent(runtime, event) {
    // Conduit Surge owns its leap at impact; its zero-effect action must not make a second attempt.
    if (event.type === 'action' && event.skillId === ID.CONDUIT_SURGE) return { ...event, comboFinishers: [] };
    return prepareEngineerHghEvent(runtime, event);
  },
  onCombatStart: detonateMines,
  modifyEffects(runtime, cast, effects) {
    if (customSpear.has(Number(cast.skill.id)) || (cast.skill.id === ID.MINE_FIELD && runtime.combatStartPending))
      return [];
    if (cast.skill.id !== ID.DETONATE || !hasTrait(runtime.config, TRAIT.GADGETEER)) return effects;
    return effects.flatMap<SkillEffect>((effect) =>
      effect.type === 'strike'
        ? [
            effect,
            {
              ...effect,
              comboFinishers: effect.comboFinishers?.map((finisher) => ({
                ...finisher,
                attemptGroup: 'gadgeteer-mine'
              }))
            }
          ]
        : [effect]
    );
  },
  onCastStart(runtime, cast) {
    if (cast.skill.independentCast) applyEngineerToolbeltTraits(runtime, cast.skill, runtime.time);
    if (cast.skill.id !== ID.DODGE) return;
    runtime.endurance.spend(
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'resourceCost')
    );
    emitEngineerEvent(runtime, 'engineer.dodge', { at: runtime.time, activationId: cast.id }, cast.skill);
    for (const [trait, name, predicate] of [
      [TRAIT.POWER_WRENCH, 'Power Wrench', (skill: EngineerSkill) => skill.type === 'Elite' || skill.slot === 'Elite'],
      [TRAIT.ADRENAL_IMPLANT, 'Adrenal Implant', isEngineerToolbeltSkill]
    ] as const)
      if (hasTrait(runtime.config, trait))
        reduceRecharge(
          runtime,
          cast,
          predicate,
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, trait), 'rechargeReduction'),
          trait,
          name
        );
  },
  onCastComplete(runtime, cast) {
    if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
    const skill = cast.skill as EngineerSkill;
    const state = runtime.profession.core;
    if (skill.kitTransition) {
      state.activeKit = skill.kitTransition === 'equip' ? (skill.kitName ?? skill.name) : '';
      emitEngineerEvent(
        runtime,
        'sigil_swap',
        { at: runtime.time, activationId: cast.id, weaponSet: runtime.activeWeaponSet },
        skill
      );
    }

    if (skill.paletteFlipSkillId != null && !skill.flipParentName) {
      const flip = runtime.helpers.skillsById.get(skill.paletteFlipSkillId) as EngineerSkill | undefined;
      if (!flip?.flipParentName)
        throw new TypeError(
          `Engineer skill ${skill.name} requires a paletteFlipSkillId referencing a consumable flip.`
        );
      armSkillFlip(state.availableFlips, flip.id, runtime.time);
    }

    if (skill.flipParentName) consumeSkillFlip(state.availableFlips, skill.id);
    completeEngineerTurret(runtime, cast);
    if (skill.id !== ID.ELECTRIC_ARTILLERY || !castWasInterrupted(cast)) completeEngineerSpear(runtime, cast);
    if (skill.id === ID.GLEAM_SABER || skill.id === ID.GLEAM_SABER_ID_70771)
      reduceRecharge(
        runtime,
        cast,
        (candidate) => candidate.type === 'Weapon' && candidate.weapon === 'Sword' && candidate.id !== skill.id,
        1,
        skill.id,
        'Gleam Saber — Sword Recharge'
      );
    if (skill.id === ID.MINE_FIELD) {
      if (runtime.combatStartPending) state.pendingMineFieldActivationIds.push(cast.id);
      else applyEngineerToolbeltTraits(runtime, runtime.helpers.skillsById.get(ID.DETONATE_MINE_FIELD)!, runtime.time);
    }

    if (!castWasInterrupted(cast)) applyEngineerCastTraits(runtime, cast);
  },
  tasks: {
    ...engineerWeaponTasks,
    'engineer.buff': (runtime, data) => emitEngineerEvent(runtime, 'buff', data as SimulationEventBase)
  },
  eventHandlers: {
    'engineer.kinetic-battery': OBSERVABLE_EVENT_HANDLER,
    'engineer.air-blast': handleAirBlast,
    'engineer.dodge': resetExplosiveEntrance,
    'engineer.lightning-rod-pulse': handleLightningRodPulse,
    'engineer.conduit-surge': handleConduitSurge,
    'engineer.electric-artillery': handleElectricArtillery
  },
  reactions: {
    'damage.resolved'(runtime, event, details) {
      for (const reaction of critical) reaction.handler(runtime, event, details as NativeResolvedDamageDetails);
      reactToEngineerDamage(runtime, event, details as NativeResolvedDamageDetails);
    },
    'condition.applied': reactToEngineerCondition
  }
};
