import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { sideEffectAmount } from '#gw2/platform/simulation/side-effects.js';
import { isElixirSkill } from '#gw2/professions/engineer/core/traits/alchemy.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { onResolvedCriticalHit } from '#gw2/platform/profession-definition/mechanics.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import type { RuntimeProfession, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';

import type { EngineerRuntime, EngineerRuntimeState, EngineerSkill } from '#gw2/professions/engineer/types.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerEndurance } from '#gw2/professions/engineer/core/mechanics/resources.js';
import { engineerCoreCastAvailability } from '#gw2/professions/engineer/core/mechanics/availability.js';
import { engineerRechargeRules } from '#gw2/professions/engineer/core/mechanics/recharge.js';
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
  engineerSpearSideEffectHandlers,
  completeEngineerTurret,
  engineerWeaponTasks
} from '#gw2/professions/engineer/core/mechanics/weapons.js';

const critical = engineerCoreCriticalHitDefinitions.map(onResolvedCriticalHit);
const customSpear = new Set<number>([ID.LIGHTNING_ROD, ID.CONDUIT_SURGE, ID.ELECTRIC_ARTILLERY]);

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
function detonatePrecastMines(runtime: EngineerRuntime): void {
  const skill = runtime.helpers.skillsById.get(ID.MINE_FIELD)!;
  const detonation = runtime.helpers.skillsById.get(ID.DETONATE_MINE_FIELD)!;
  for (const activationId of runtime.profession.core.pendingMineFieldActivationIds.splice(0)) {
    emitEffects(runtime, {
      owner: skill,
      baseEvent: {
        source: 'engineer',
        sourceId: skill.id,
        actorType: 'player',
        activationId,
        skillId: skill.id,
        skillName: skill.name
      }
    });
    applyEngineerToolbeltTraits(runtime, detonation, runtime.time);
  }
}

export const engineerCoreHooks: Partial<RuntimeProfession<EngineerRuntimeState>> = {
  endurance: engineerEndurance,
  availability: engineerCoreCastAvailability,
  rechargeRules: engineerRechargeRules,
  sideEffectHandlers: {
    ...engineerSpearSideEffectHandlers,
    // Both sword finishers declare the reward while live cooldown selection and proc reporting share one owner.
    'engineer.sword-recharge'(runtime, context, action) {
      if (action.type !== 'engineer.sword-recharge' || action.amount == null)
        throw new TypeError('Sword recharge reductions require an amount.');
      if (context.kind !== 'cast') throw new TypeError('Sword recharge requires a cast trigger.');
      const { cast } = context;
      reduceRecharge(
        runtime,
        cast,
        (candidate) => candidate.type === 'Weapon' && candidate.weapon === 'Sword' && candidate.id !== cast.skill.id,
        sideEffectAmount(runtime, action.amount),
        cast.skill.id,
        'Gleam Saber \u2014 Sword Recharge'
      );
    }
  },
  reserveRecharge: (_runtime, skill, work) => (skill.id === ID.HEALING_TURRET ? 0 : work),
  prepareEvent: prepareEngineerHghEvent,
  onCombatStart: detonatePrecastMines,
  // HGH grants its own unextended boons only after an elixir finishes.
  traitTriggers: ['might', 'fury'].map((boon) => ({
    trait: TRAIT.HGH,
    on: 'castCommit',
    when: (_runtime, cast) => isElixirSkill(cast.skill),
    emit: TRAIT.HGH,
    effects: (effect) => effect.type === 'boon' && effect.name === boon,
    attribution: { source: 'Trait', sourceId: TRAIT.HGH, actorType: 'player', name: `HGH — ${boon}` }
  })),
  modifyEffects(_runtime, cast, effects) {
    return customSpear.has(Number(cast.skill.id)) ? [] : effects;
  },
  onCastStart(runtime, cast) {
    if (cast.skill.independentCast) applyEngineerToolbeltTraits(runtime, cast.skill, runtime.time);
    if (cast.skill.id !== SHARED_SKILL_IDS.DODGE) return;
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
  onCastCommit(runtime, cast) {
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
      const flip = runtime.helpers.skillsById.get(skill.paletteFlipSkillId);
      if (!flip?.flipParentName)
        throw new TypeError(
          `Engineer skill ${skill.name} requires a paletteFlipSkillId referencing a consumable flip.`
        );
      armSkillFlip(state.availableFlips, flip.id, runtime.time);
    }

    if (skill.flipParentName) consumeSkillFlip(state.availableFlips, skill.id);
    completeEngineerTurret(runtime, cast);
    if (skill.id === ID.MINE_FIELD) {
      if (runtime.combatStartPending) state.pendingMineFieldActivationIds.push(cast.id);
      else applyEngineerToolbeltTraits(runtime, runtime.helpers.skillsById.get(ID.DETONATE_MINE_FIELD)!, runtime.time);
    }

    applyEngineerCastTraits(runtime, cast);
  },
  tasks: engineerWeaponTasks,
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
      for (const reaction of critical) reaction.handler(runtime, event, details);
      reactToEngineerDamage(runtime, event);
    },
    'condition.applied': reactToEngineerCondition
  }
};
