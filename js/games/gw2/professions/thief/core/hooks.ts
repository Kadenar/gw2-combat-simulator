import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { pruneSkillFlips } from '#gw2/platform/execution/skill-flips.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/input-event.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { thiefBuffPolicies, thiefEffectStates } from '#gw2/professions/thief/core/effect-state.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { deferThiefCompletion } from '#gw2/professions/thief/core/events.js';
import { thiefAvailability } from '#gw2/professions/thief/core/mechanics/availability.js';
import {
  grantThiefGroundAxe,
  landThiefAxe,
  recallThiefAxes,
  scheduleThiefAxeRecall,
  startThiefAxeExpiry,
  THIEF_AXE_LAND
} from '#gw2/professions/thief/core/mechanics/axes.js';
import {
  signetCompleted,
  stealAccepted,
  stealthAttackCompleted,
  thiefCastCompleted,
  thiefConditionApplied,
  thiefDodgeStarted,
  thiefStruck,
  thiefWeaponSwapped,
  venomsConsumed
} from '#gw2/professions/thief/core/mechanics/trigger-points.js';
import { modifyThiefLifeSiphon } from '#gw2/professions/thief/core/mechanics/life-siphon.js';
import { activateTrap, prepareTrap } from '#gw2/professions/thief/core/mechanics/preparations.js';
import { setThiefKneeling, thiefEndurance, thiefInitiative } from '#gw2/professions/thief/core/mechanics/resources.js';
import {
  expireThiefScepterChain,
  THIEF_SCEPTER_CHAIN_EXPIRY,
  transitionThiefScepterChain
} from '#gw2/professions/thief/core/mechanics/scepter.js';
import { activateAssassinsSignet } from '#gw2/professions/thief/core/mechanics/signets.js';
import {
  ashenAssaultLifecycle,
  grantDistractingThrowWindow,
  unsuspectingStrikeBonus,
  updateSpearChain
} from '#gw2/professions/thief/core/mechanics/spear.js';
import {
  completeThiefSteal,
  consumeThiefStolenSkill,
  storeThiefStolenSkillChoices,
  THIEF_STOLEN_SKILL_IDS
} from '#gw2/professions/thief/core/mechanics/steal.js';
import {
  beginThiefStealthAttack,
  commitThiefStealth,
  reactThiefStealthBreakingStrike,
  selectThiefStealth
} from '#gw2/professions/thief/core/mechanics/stealth.js';
import { activateVenom, applyActiveVenoms, emitVenom, VENOMS } from '#gw2/professions/thief/core/mechanics/venoms.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { infiltratorsSignetLifecycle } from '#gw2/professions/thief/core/skills/slot-skills.js';
import {
  leadAttacksRechargeReduction,
  sleightOfHandRechargeReduction
} from '#gw2/professions/thief/core/traits/trickery/resource-queries.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefConfig, ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

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
    const maximum = balanceNumberFromContext(runtime, TRAIT.LEAD_ATTACKS, 'maximumStacks');

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
  ashenAssaultLifecycle(ID.ASHEN_ASSAULT, PROFILE.ashenAssaultRefund),
  coreLifecycle
]);

/** Landed strikes reach critical and Deadly Arts traits, consume venoms, then reach the aggregate venom traits. */
export function reactThiefCoreDamage(
  runtime: ThiefRuntime,
  event: Gw2ResolverEvent,
  details: Record<string, unknown>
): void {
  runtime.fireTrigger(thiefStruck, { cause: event, details: details });
  // Multiple venom types consume their charges but share one siphon per player strike.
  runtime.fireTrigger(venomsConsumed, { cause: event, consumed: applyActiveVenoms(runtime, event) });
}
