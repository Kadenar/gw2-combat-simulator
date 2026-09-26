import { EPSILON } from '#kernel/core/clock.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { pruneSkillFlips, skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { denySkillCast, selectedSlotSkillAvailability } from '#gw2/professions/shared/availability.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { spearChainStageForSkill } from '#gw2/professions/thief/data/spear-chain-stages.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { modifyThiefLifeSiphon } from '#gw2/professions/thief/core/traits/modifiers.js';
import {
  deferThiefCompletion,
  emitDeferredThiefBuff,
  takeThiefCompletion,
  THIEF_EMIT_TASK,
  THIEF_FLIP_EXPIRY,
  expireThiefFlip,
  thiefCastCommitted
} from '#gw2/professions/thief/core/events.js';
import {
  completeThiefCoreResources,
  grantThiefInitiative,
  restartThiefInfiltratorsSignet,
  spendThiefCoreResources,
  THIEF_INFILTRATORS_SIGNET_PULSE,
  thiefInfiltratorsSignetPulse,
  thiefEndurance,
  thiefInitiative
} from '#gw2/professions/thief/core/mechanics/resources.js';
import {
  beginThiefStealthAttack,
  completeThiefStealthAttack,
  reactThiefStealthBreakingStrike,
  thiefBonusStealthAttack,
  thiefSameInstantStealthBreak,
  thiefStealthed
} from '#gw2/professions/thief/core/mechanics/stealth.js';
import {
  completeThiefSteal,
  consumeThiefStolenSkill,
  emitThiefStealTraits,
  storedStolenSkillChoices,
  THIEF_STOLEN_SKILL_IDS
} from '#gw2/professions/thief/core/mechanics/steal.js';
import {
  completeThiefCoreActions,
  completeThiefWeaponState,
  expireThievesGuild,
  expireThiefScepterChain,
  reactThiefSpinningAxe,
  startThievesGuild,
  THIEF_GUILD_ATTACK,
  THIEF_GUILD_EXPIRY,
  THIEF_SCEPTER_CHAIN_EXPIRY,
  thievesGuildAttack,
  thiefSpearEffects,
  thiefTrapAvailability,
  transitionThiefScepterChain
} from '#gw2/professions/thief/core/mechanics/weapons.js';
import {
  completeThiefCastTraits,
  reactThiefCoreBuff,
  reactThiefCoreCondition,
  reactThiefCoreDamage,
  startThiefDodge
} from '#gw2/professions/thief/core/traits/index.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { ThiefResolverContext, ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

/**
 * Core gates for endurance, follow-up windows, spear stages, preparations, stealth replacements, rifle stance, stored
 * stolen skills, and initiative, all read from the one live state at the current instant.
 */
function thiefAvailability(runtime: ThiefRuntime, rawSkill: Skill): AvailabilityResult {
  const skill = rawSkill as ThiefSkill;
  const selection = selectedSlotSkillAvailability({ config: runtime.config, catalog: runtime.helpers }, skill);
  if (selection) return selection;
  const core = runtime.profession.core;
  const now = runtime.time;
  if (skill.id === ID.DODGE) {
    const readyAt = runtime.endurance.readyAt(50);
    return readyAt != null && readyAt <= now + EPSILON
      ? { ready: true }
      : denySkillCast(
          skill,
          'thief.endurance',
          'requires 50 endurance.',
          readyAt != null && Number.isFinite(readyAt) ? readyAt : null
        );
  }

  if (skill.type === 'Weapon' && skill.flipParentId != null && !skillFlipReady(core.availableFlips[skill.id], now)) {
    const parent = runtime.helpers.skillsById.get(Number(skill.flipParentId)) as ThiefSkill | undefined;
    return denySkillCast(
      skill,
      'thief.follow-up',
      parent?.dualWieldOpener ? 'use its opening dual-wield skill first.' : 'use its opening weapon skill first.'
    );
  }

  const spearStage = spearChainStageForSkill(skill.id);
  if (spearStage != null && Number(core.spearChainStage || 0) !== spearStage)
    return denySkillCast(skill, 'thief.spear-chain', `requires spear chain stage ${spearStage + 1}.`);
  const trap = thiefTrapAvailability(runtime, skill);
  if (trap) return trap;
  if (
    skill.type === 'Weapon' &&
    skill.flipSkillId != null &&
    skill.flipSkillId !== skill.nextChainId &&
    skillFlipReady(core.availableFlips[skill.flipSkillId], now)
  )
    return denySkillCast(skill, 'thief.follow-up-active', 'use or wait out the active follow-up skill.');

  const [mainHand] = gw2ConfiguredWeaponSet(runtime.config, runtime.activeWeaponSet === 2 ? 2 : 1);
  const stealthed = thiefStealthed(runtime);
  const bonusStealthAttack = thiefBonusStealthAttack(runtime);
  // Stealth replaces the equipped weapon's slot one, never the separate Shadow Shroud bar.
  if (skill.stealthAttack) {
    if (!stealthed && !bonusStealthAttack && !thiefSameInstantStealthBreak(runtime))
      return denySkillCast(skill, 'thief.not-stealthed', 'requires stealth.');
    if (skill.requiredMainHand && skill.requiredMainHand !== (mainHand || ''))
      return denySkillCast(skill, 'thief.stealth-weapon', `requires ${skill.requiredMainHand}.`);
  } else if (
    (stealthed || bonusStealthAttack) &&
    !skill.shadowShroudSkill &&
    skill.type === 'Weapon' &&
    skill.slot === 'Weapon_1'
  )
    return denySkillCast(skill, 'thief.stealth-replacement', "the active weapon's stealth attack replaces skill 1.");

  if (skill.id === ID.KNEEL && core.kneeling) return denySkillCast(skill, 'thief.kneeling', 'already kneeling.');
  if (skill.id === ID.FREE_ACTION && !core.kneeling) return denySkillCast(skill, 'thief.not-kneeling', 'kneel first.');
  if (
    skill.weapon === 'Rifle' &&
    skill.id !== ID.KNEEL &&
    skill.id !== ID.FREE_ACTION &&
    !skill.stealthAttack &&
    Boolean(skill.kneelSkill) !== Boolean(core.kneeling)
  )
    return denySkillCast(skill, 'thief.rifle-stance', core.kneeling ? 'use a kneeling rifle skill.' : 'kneel first.');
  if (
    skill.slot === 'Profession_2' &&
    (skill.categories || []).includes('stolen skill') &&
    !storedStolenSkillChoices(core).includes(skill.id)
  )
    return denySkillCast(skill, 'thief.stolen-skill', 'steal this skill before using it.');

  const cost = Number(skill.initiativeCost || 0);
  if (cost <= 0) return { ready: true };
  const readyAt = runtime.resourceController.readyAt('initiative', cost);
  // Retain fractional initiative while waiting for the tick that detects affordability.
  return runtime.resourceController.value('initiative') + EPSILON >= cost &&
    (readyAt == null || readyAt <= now + EPSILON)
    ? { ready: true }
    : denySkillCast(skill, 'thief.initiative', `requires ${skill.initiativeCost} initiative.`, readyAt);
}

/** Lead Attacks and Sleight of Hand shorten steal-family recharges, multiplicatively unless the skill opts out. */
function thiefRechargeWork(runtime: ThiefRuntime, rawSkill: Skill, work: number): number {
  const skill = rawSkill as ThiefSkill;
  if (!skill.stealTraitSkill) return work;
  const leadAttacks = hasTrait(runtime, TRAIT.LEAD_ATTACKS);
  const sleightOfHand = hasTrait(runtime, TRAIT.SLEIGHT_OF_HAND);
  const lead = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, PROFILE.leadAttacks),
    'rechargeMultiplier'
  );
  const sleight = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, PROFILE.sleightOfHand),
    'rechargeMultiplier'
  );
  if (skill.stealRechargeMode === 'additive')
    return work * (1 - Number(leadAttacks) * (1 - lead) - Number(sleightOfHand) * (1 - sleight));
  return work * (leadAttacks ? lead : 1) * (sleightOfHand ? sleight : 1);
}

const THIEF_CORE_COMPLETE = 'thief.core-complete';

/** Core completion: resources, steals, stealth attacks, utilities, weapon state, and completion traits. */
function completeThiefCast(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as ThiefSkill;
  const committed = thiefCastCommitted(cast);
  pruneSkillFlips(runtime.profession.core.availableFlips, runtime.time);
  completeThiefCoreResources(runtime, cast, committed);
  if (committed && skill.id === ID.STEAL) {
    emitThiefStealTraits(runtime, cast);
    completeThiefSteal(runtime, THIEF_STOLEN_SKILL_IDS);
  }

  if (committed && THIEF_STOLEN_SKILL_IDS.includes(skill.id)) consumeThiefStolenSkill(runtime, skill);
  if (committed && skill.stealthAttack) completeThiefStealthAttack(runtime, cast);
  if (committed && skill.id === ID.ASHEN_ASSAULT)
    grantThiefInitiative(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.ashenAssaultRefund), 'resourceGain')
    );
  completeThiefCoreActions(runtime, cast, committed);
  completeThiefWeaponState(runtime, cast, committed, !castWasInterrupted(cast));
  completeThiefCastTraits(runtime, cast, committed);
}

/** Core hooks: initiative, endurance, stealth, steals, weapon follow-ups, utilities, and resolved trait reactions. */
export const thiefCoreHooks: Partial<RuntimeProfession<ThiefRuntimeState>> = {
  resources: { initiative: thiefInitiative },
  endurance: thiefEndurance,
  initialize(runtime) {
    restartThiefInfiltratorsSignet(runtime);
  },
  onCombatStart(runtime) {
    // A precast Thieves Guild begins attacking at the accepted combat boundary.
    startThievesGuild(runtime);
  },
  availability: thiefAvailability,
  rechargeWork: thiefRechargeWork,
  // A Double Edge recast while recharging keeps the running recharge instead of reserving a new one.
  reserveRecharge: (runtime, skill, work) =>
    skill.usableWhileRecharging === true && Number(runtime.cooldowns.get(skill.id) || 0) > runtime.time + EPSILON
      ? 0
      : work,
  modifyEffects(runtime, cast, effects) {
    // Dodges own their packets through the selected landing; their authored effects are never emitted directly.
    if (cast.skill.id === ID.DODGE) return [];
    return thiefSpearEffects(runtime, cast, effects);
  },
  onCastStart(runtime, cast) {
    const skill = cast.skill as ThiefSkill;
    pruneSkillFlips(runtime.profession.core.availableFlips, runtime.time);
    spendThiefCoreResources(runtime, cast);
    if (skill.id === ID.DODGE) startThiefDodge(runtime, cast);
    if (skill.stealthAttack) beginThiefStealthAttack(runtime, cast);
  },
  onCastComplete(runtime, cast) {
    deferThiefCompletion(runtime, THIEF_CORE_COMPLETE, cast);
  },
  onAutoattackChainTransition: transitionThiefScepterChain,
  onCooldownReset(runtime) {
    restartThiefInfiltratorsSignet(runtime);
  },
  reactions: {
    'damage.resolving'(runtime, event) {
      return modifyThiefLifeSiphon(runtime as unknown as ThiefResolverContext, event);
    },
    'damage.resolved'(runtime, event, details) {
      reactThiefStealthBreakingStrike(runtime, event);
      reactThiefSpinningAxe(runtime, event);
      reactThiefCoreDamage(runtime, event, details);
    },
    'condition.applied': reactThiefCoreCondition,
    'buff.applied': reactThiefCoreBuff
  },
  tasks: {
    [THIEF_EMIT_TASK]: emitDeferredThiefBuff,
    [THIEF_FLIP_EXPIRY]: expireThiefFlip,
    [THIEF_CORE_COMPLETE](runtime, data) {
      const cast = takeThiefCompletion(runtime, THIEF_CORE_COMPLETE, data);
      if (cast) completeThiefCast(runtime, cast);
    },
    [THIEF_INFILTRATORS_SIGNET_PULSE]: thiefInfiltratorsSignetPulse,
    [THIEF_SCEPTER_CHAIN_EXPIRY]: expireThiefScepterChain,
    [THIEF_GUILD_ATTACK]: thievesGuildAttack,
    [THIEF_GUILD_EXPIRY]: expireThievesGuild
  }
};
