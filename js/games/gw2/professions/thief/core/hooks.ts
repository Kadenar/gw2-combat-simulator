import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { pruneSkillFlips, skillFlipReady, weaponFollowUpOpen } from '#gw2/platform/execution/skill-flips.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/occurrence-driver.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { thiefBuffPolicies, thiefEffectStates } from '#gw2/professions/thief/core/effect-state.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { deferThiefCompletion } from '#gw2/professions/thief/core/events.js';
import {
  grantThiefGroundAxe,
  landThiefAxe,
  recallThiefAxes,
  scheduleThiefAxeRecall,
  startThiefAxeExpiry,
  THIEF_AXE_LAND
} from '#gw2/professions/thief/core/mechanics/axes.js';
import {
  activateTrap,
  prepareTrap,
  thiefTrapAvailability
} from '#gw2/professions/thief/core/mechanics/preparations.js';
import { reactThiefCoreDamage } from '#gw2/professions/thief/core/mechanics/reactions.js';
import { setThiefKneeling, thiefEndurance, thiefInitiative } from '#gw2/professions/thief/core/mechanics/resources.js';
import {
  expireThiefScepterChain,
  THIEF_SCEPTER_CHAIN_EXPIRY,
  transitionThiefScepterChain
} from '#gw2/professions/thief/core/mechanics/scepter.js';
import { activateAssassinsSignet } from '#gw2/professions/thief/core/mechanics/signets.js';
import {
  grantDistractingThrowWindow,
  thiefSpearAvailability,
  unsuspectingStrikeBonus,
  updateSpearChain
} from '#gw2/professions/thief/core/mechanics/spear.js';
import {
  completeThiefSteal,
  consumeThiefStolenSkill,
  storedStolenSkillChoices,
  storeThiefStolenSkillChoices,
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
import { activateVenom, emitVenom, VENOMS } from '#gw2/professions/thief/core/mechanics/venoms.js';
import { infiltratorsSignetLifecycle } from '#gw2/professions/thief/core/skills/slot-skills.js';
import {
  signetCompleted,
  stealAccepted,
  stealthAttackCompleted,
  thiefCastCompleted,
  thiefConditionApplied,
  thiefDodgeStarted,
  thiefWeaponSwapped
} from '#gw2/professions/thief/core/mechanics/boundaries.js';
import { modifyThiefLifeSiphon } from '#gw2/professions/thief/core/mechanics/life-siphon.js';
import {
  leadAttacksRechargeReduction,
  sleightOfHandRechargeReduction
} from '#gw2/professions/thief/core/traits/trickery/resource-queries.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefConfig, ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

/**
 * Core gates for endurance, follow-up windows, spear stages, preparations, stealth replacements, rifle stance, stored
 * stolen skills, all read from the one live state at the current instant. Shared cost declarations gate initiative.
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

  return { ready: true };
}

/** Additive steal reductions retain their combined formula; ordinary multipliers use declared rules. */
function thiefRechargeWork(runtime: MechanicQueriesOf<ThiefRuntime>, skill: ThiefSkill, work: number): number {
  if (!skill.stealTraitSkill || skill.stealRechargeMode !== 'additive') return work;
  return work * (1 - leadAttacksRechargeReduction(runtime) - sleightOfHandRechargeReduction(runtime));
}

const THIEF_CORE_COMPLETE = 'thief.core-complete';

/** Shared swap and completion traits retain their post-packet order after intrinsic skill actions commit. */
function completeThiefCast(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>, initiativeCost: number): void {
  const skill = cast.skill;
  const committed = !cast.cancelled;
  pruneSkillFlips(runtime.profession.core.availableFlips, runtime.time);
  if (committed && skill.stealthAttack) runtime.fireTrigger(stealthAttackCompleted, { cast });
  // Swapping weapons stands up before swap rewards.
  if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) {
    setThiefKneeling(runtime, false);
    runtime.fireTrigger(thiefWeaponSwapped, { at: runtime.time });
  }

  if (committed) runtime.fireTrigger(thiefCastCompleted, { cast, initiativeCost });
}

/** Core hooks: initiative, endurance, stealth, steals, weapon follow-ups, utilities, and resolved trait reactions. */

const coreLifecycle: RuntimeHooks<ThiefRuntimeState, ThiefSkill> = {
  /** Seed non-expiring Lead Attacks stacks for an isolated damage occurrence. */
  prepareDamageState(runtime, _skill, inputs) {
    // Off and Active suppress the passive; the active bonus is supplied by the preview's native buff.
    if ('assassinsSignet' in inputs)
      runtime.profession.core.assassinsSignetPassiveDisabledUntil = inputs.assassinsSignet === 'passive' ? 0 : Infinity;
    // These detached windows must be available even when Lead Attacks is not selected.
    runtime.profession.core.revealedUntil = inputs.revealed ? Infinity : 0;
    runtime.profession.core.stealthUntil = inputs.stealth ? Infinity : 0;
    if (!hasTrait(runtime, TRAIT.LEAD_ATTACKS)) return;
    const stacks = Number(inputs.leadAttacks ?? 0);
    const maximum = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, TRAIT.LEAD_ATTACKS),
      'maximumStacks'
    );
    if (!Number.isInteger(stacks) || stacks < 0 || stacks > maximum)
      throw new RangeError('Lead Attacks exceeds the selected build maximum.');
    runtime.profession.core.leadAttackExpirations = Array(stacks).fill(Infinity);
  },
  // Previously stolen inventory is available during setup without firing a steal or its trait effects.
  initialize(runtime) {
    if ((runtime.config as ThiefConfig).initialPreSteal === 1 && runtime.profession.specialization.kind === 'Core')
      storeThiefStolenSkillChoices(runtime, THIEF_STOLEN_SKILL_IDS);
  },
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
    // Signet rewards follow a completed activation, ahead of the skill's other completion actions.
    'thief.signet-completed'(runtime, context) {
      if (context.kind === 'cast') runtime.fireTrigger(signetCompleted, { cast: context.cast });
    },
    'thief.kneel': (runtime) => setThiefKneeling(runtime, true),
    'thief.stand': (runtime) => setThiefKneeling(runtime, false),
    'thief.recall-axes': scheduleThiefAxeRecall,
    'thief.spear-chain': (runtime, context) => updateSpearChain(runtime, context.skill),
    'thief.consume-stolen': (runtime, context) => consumeThiefStolenSkill(runtime, context.skill),
    'thief.steal'(runtime, context) {
      if (context.kind !== 'cast') return;
      // Preserve the shared trait notification before acquisition and Kleptomaniac.
      runtime.fireTrigger(stealAccepted, { cast: context.cast });
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
  onCombatStart(runtime) {
    startThiefAxeExpiry(runtime);
  },
  endurance: thiefEndurance,
  availability: thiefAvailability,
  rechargeWork: thiefRechargeWork,
  // A Double Edge recast while recharging keeps the running recharge instead of reserving a new one.
  reserveRecharge: (runtime, skill, work) =>
    skill.usableWhileRecharging === true && (runtime.cooldownController.readyAt(skill.id) || 0) > runtime.time
      ? 0
      : work,
  onCastStart(runtime, cast) {
    const skill = cast.skill;
    pruneSkillFlips(runtime.profession.core.availableFlips, runtime.time);
    if (skill.id === SHARED_SKILL_IDS.DODGE) runtime.fireTrigger(thiefDodgeStarted, { cast });
    if (skill.stealthAttack) beginThiefStealthAttack(runtime, cast);
  },
  modifyEffects: selectThiefStealth,
  onCastCommit(runtime, cast) {
    // Capture the accepted cost before the deferred task resolves its skill from the live catalog.
    deferThiefCompletion(runtime, THIEF_CORE_COMPLETE, cast, {
      initiativeCost: Math.max(0, cast.skill.initiativeCost || 0)
    });
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
    'condition.applied'(runtime, event) {
      runtime.fireTrigger(thiefConditionApplied, { cause: event });
    }
  },
  tasks: {
    'thief.recall-axes'(runtime, data) {
      recallThiefAxes(runtime, (data as { cast: RuntimeCast<ThiefSkill> }).cast);
    },
    [THIEF_AXE_LAND]: landThiefAxe,
    'thief.distracting-throw-window': grantDistractingThrowWindow,
    [THIEF_CORE_COMPLETE](runtime, data) {
      const { cast, initiativeCost } = data as { cast: RuntimeCast<ThiefSkill>; initiativeCost: number };
      completeThiefCast(runtime, cast, initiativeCost);
    },
    [THIEF_SCEPTER_CHAIN_EXPIRY]: expireThiefScepterChain
  }
};

/** Compose skill-owned lifecycle behavior with the shared profession rules. */
export const thiefCoreHooks = composeRuntimeHooks<ThiefRuntimeState, ThiefSkill>([
  infiltratorsSignetLifecycle,
  coreLifecycle
]);
