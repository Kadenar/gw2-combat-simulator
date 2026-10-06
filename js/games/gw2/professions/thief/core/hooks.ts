import { infiltratorsSignetLifecycle } from '#gw2/professions/thief/core/skills/slot-skills.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/occurrence-driver.js';
import { emitVenom, VENOMS } from '#gw2/professions/thief/core/mechanics/venoms.js';
import {
  completeThiefStealthAttack,
  completeThiefWeaponSwap,
  startThiefDodge
} from '#gw2/professions/thief/core/traits/behavior.js';
import {
  leadAttacksRechargeReduction,
  sleightOfHandRechargeReduction
} from '#gw2/professions/thief/core/traits/resource-queries.js';

import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { modifyThiefLifeSiphon } from '#gw2/professions/thief/core/traits/behavior.js';
import { EPSILON } from '#kernel/core/clock.js';

import { pruneSkillFlips, skillFlipReady, weaponFollowUpOpen } from '#gw2/platform/execution/skill-flips.js';

import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { thiefSpearAvailability } from '#gw2/professions/thief/core/mechanics/spear.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { deferThiefCompletion } from '#gw2/professions/thief/core/events.js';
import {
  grantThiefGroundAxe,
  landThiefAxe,
  recallThiefAxes,
  THIEF_AXE_LAND
} from '#gw2/professions/thief/core/mechanics/axes.js';
import {
  activateTrap,
  prepareTrap,
  thiefTrapAvailability
} from '#gw2/professions/thief/core/mechanics/preparations.js';
import {
  setThiefKneeling,
  spendThiefCoreResources,
  thiefEndurance,
  thiefInitiative
} from '#gw2/professions/thief/core/mechanics/resources.js';
import {
  expireThiefScepterChain,
  THIEF_SCEPTER_CHAIN_EXPIRY,
  transitionThiefScepterChain
} from '#gw2/professions/thief/core/mechanics/scepter.js';
import { activateAssassinsSignet } from '#gw2/professions/thief/core/mechanics/signets.js';
import {
  grantDistractingThrowWindow,
  unsuspectingStrikeBonus,
  updateSpearChain
} from '#gw2/professions/thief/core/mechanics/spear.js';
import {
  completeThiefSteal,
  consumeThiefStolenSkill,
  storedStolenSkillChoices,
  THIEF_STOLEN_SKILL_IDS
} from '#gw2/professions/thief/core/mechanics/steal.js';
import {
  beginThiefStealthAttack,
  commitThiefStealth,
  reactThiefStealthBreakingStrike,
  selectThiefStealth,
  thiefBonusStealthAttack,
  thiefSameInstantStealthBreak,
  thiefStealthed
} from '#gw2/professions/thief/core/mechanics/stealth.js';
import { activateVenom } from '#gw2/professions/thief/core/mechanics/venoms.js';
import {
  completeThiefCastTraits,
  reactThiefCoreCondition,
  reactThiefCoreDamage
} from '#gw2/professions/thief/core/traits/dispatch.js';
import { emitThiefStealTraits } from '#gw2/professions/thief/core/traits/steal.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

/**
 * Core gates for endurance, follow-up windows, spear stages, preparations, stealth replacements, rifle stance, stored
 * stolen skills, and initiative, all read from the one live state at the current instant.
 */
function thiefAvailability(runtime: MechanicQueriesOf<ThiefRuntime>, skill: ThiefSkill): AvailabilityResult {
  const core = runtime.profession.core;
  const now = runtime.time;
  if (skill.type === 'Weapon' && skill.flipParentId != null && !skillFlipReady(core.availableFlips[skill.id], now)) {
    const parent = runtime.helpers.skillsById.get(Number(skill.flipParentId));
    return denySkillCast(
      skill,
      'thief.follow-up',
      parent?.dualWieldOpener ? 'use its opening dual-wield skill first.' : 'use its opening weapon skill first.'
    );
  }

  const spear = thiefSpearAvailability(runtime, skill);
  if (spear) return spear;
  const trap = thiefTrapAvailability(runtime, skill);
  if (trap) return trap;
  // A closed follow-up already answered above with its opener-specific reason.
  if (weaponFollowUpOpen(core.availableFlips, skill, now))
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
    Boolean(skill.kneelSkill) !== core.kneeling
  )
    return denySkillCast(skill, 'thief.rifle-stance', core.kneeling ? 'use a kneeling rifle skill.' : 'kneel first.');
  if (
    skill.slot === 'Profession_2' &&
    (skill.categories || []).includes('stolen skill') &&
    !storedStolenSkillChoices(core).includes(skill.id)
  )
    return denySkillCast(skill, 'thief.stolen-skill', 'steal this skill before using it.');

  const cost = skill.initiativeCost || 0;
  if (cost <= 0) return { ready: true };
  const readyAt = runtime.resourceController.readyAt('initiative', cost);
  // Retain fractional initiative while waiting for the tick that detects affordability.
  return runtime.resourceController.value('initiative') + EPSILON >= cost &&
    (readyAt == null || readyAt <= now + EPSILON)
    ? { ready: true }
    : denySkillCast(skill, 'thief.initiative', `requires ${skill.initiativeCost} initiative.`, readyAt);
}

/** Additive steal reductions retain their combined formula; ordinary multipliers use declared rules. */
function thiefRechargeWork(runtime: MechanicQueriesOf<ThiefRuntime>, skill: ThiefSkill, work: number): number {
  if (!skill.stealTraitSkill || skill.stealRechargeMode !== 'additive') return work;
  return work * (1 - leadAttacksRechargeReduction(runtime) - sleightOfHandRechargeReduction(runtime));
}

const THIEF_CORE_COMPLETE = 'thief.core-complete';

/** Shared swap and completion traits retain their post-packet order after intrinsic skill actions commit. */
function completeThiefCast(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const skill = cast.skill;
  const committed = !cast.cancelled;
  pruneSkillFlips(runtime.profession.core.availableFlips, runtime.time);
  if (committed && skill.stealthAttack) completeThiefStealthAttack(runtime, cast);
  if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) completeThiefWeaponSwap(runtime);
  completeThiefCastTraits(runtime, cast, committed);
}

/** Core hooks: initiative, endurance, stealth, steals, weapon follow-ups, utilities, and resolved trait reactions. */
import { thiefBuffPolicies, thiefEffectStates } from '#gw2/professions/thief/core/effect-state.js';

const coreLifecycle: RuntimeHooks<ThiefRuntimeState, ThiefSkill> = {
  // Known damage payloads are invoked once without their activation requirements.
  damageEffects: VENOMS.map((venom) => ({
    id: `venom:${venom.skillId}`,
    name: venom.skillName,
    source: 'Profession' as const,
    unit: 'charge' as const,
    sourceIds: [venom.skillId],
    emit: (runtime) => emitVenom(runtime, damageInputEvent(runtime), venom)
  })),

  buffPolicies: thiefBuffPolicies,
  observeEffects: thiefEffectStates,
  sideEffectHandlers: {
    'thief.assassins-signet': activateAssassinsSignet,
    'thief.kneel': (runtime) => setThiefKneeling(runtime, true),
    'thief.stand': (runtime) => setThiefKneeling(runtime, false),
    'thief.recall-axes': recallThiefAxes,
    'thief.spear-chain': (runtime, context) => updateSpearChain(runtime, context.skill),
    'thief.consume-stolen': (runtime, context) => consumeThiefStolenSkill(runtime, context.skill),
    'thief.steal'(runtime, context) {
      if (context.kind !== 'cast') return;
      // Preserve the shared trait notification before acquisition and Kleptomaniac.
      emitThiefStealTraits(runtime, context.cast);
      completeThiefSteal(runtime, THIEF_STOLEN_SKILL_IDS);
    },
    'thief.prepare-trap'(runtime, context) {
      if (context.kind === 'cast') prepareTrap(runtime, context.cast);
    },
    'thief.activate-trap'(runtime, context) {
      if (context.kind === 'cast') activateTrap(runtime, context.cast);
    },
    'thief.activate-venom'(runtime, context) {
      if (context.kind === 'cast') activateVenom(runtime, context.cast);
    },
    'thief.stealth'(runtime, context) {
      commitThiefStealth(runtime, context);
    },

    'thief.ground-axe': grantThiefGroundAxe,
    'thief.unsuspecting-bleeding'(runtime, context) {
      if (context.kind === 'effect') unsuspectingStrikeBonus(runtime, context.trigger.event);
    }
  },
  resources: { initiative: thiefInitiative },
  endurance: thiefEndurance,
  availability: thiefAvailability,
  rechargeWork: thiefRechargeWork,
  // A Double Edge recast while recharging keeps the running recharge instead of reserving a new one.
  reserveRecharge: (runtime, skill, work) =>
    skill.usableWhileRecharging === true && (runtime.cooldownController.readyAt(skill.id) || 0) > runtime.time + EPSILON
      ? 0
      : work,
  onCastStart(runtime, cast) {
    const skill = cast.skill;
    pruneSkillFlips(runtime.profession.core.availableFlips, runtime.time);
    spendThiefCoreResources(runtime, cast);
    if (skill.id === SHARED_SKILL_IDS.DODGE) startThiefDodge(runtime, cast);
    if (skill.stealthAttack) beginThiefStealthAttack(runtime, cast);
  },
  modifyEffects: selectThiefStealth,
  onCastCommit(runtime, cast) {
    deferThiefCompletion(runtime, THIEF_CORE_COMPLETE, cast);
  },
  onAutoattackChainTransition: transitionThiefScepterChain,
  reactions: {
    'damage.resolving'(runtime, event) {
      return modifyThiefLifeSiphon(runtime, event);
    },
    'damage.resolved'(runtime, event, details) {
      reactThiefStealthBreakingStrike(runtime, event);
      reactThiefCoreDamage(runtime, event, details);
    },
    'condition.applied': reactThiefCoreCondition
  },
  tasks: {
    [THIEF_AXE_LAND]: landThiefAxe,
    'thief.distracting-throw-window': grantDistractingThrowWindow,
    [THIEF_CORE_COMPLETE](runtime, data) {
      const { cast } = data as { cast: RuntimeCast<ThiefSkill> };
      completeThiefCast(runtime, cast);
    },
    [THIEF_SCEPTER_CHAIN_EXPIRY]: expireThiefScepterChain
  }
};

/** Compose skill-owned lifecycle behavior with the shared profession rules. */
export const thiefCoreHooks = composeRuntimeHooks<ThiefRuntimeState, ThiefSkill>([
  infiltratorsSignetLifecycle,
  coreLifecycle
]);
