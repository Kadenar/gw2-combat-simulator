import { canonicalTime, isTimeInWindow, isInternalCooldownReady } from '#kernel/core/clock.js';
import { modifyNecromancerRechargeStart } from '#gw2/professions/necromancer/core/mechanics/recharge.js';
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { remainingTargetHealthBelow } from '#gw2/platform/combat/state/target-health.js';
import { targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import { armSkillFlip, consumeSkillFlip, skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import {
  balanceProfileNumber,
  requireEffect,
  effectNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import {
  runNecromancerShroudEnter,
  runNecromancerShroudExit,
  runNecromancerLifeForceDepletion
} from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import { denySkillCast } from '#gw2/platform/engine/skills/availability.js';
import { castCompleted } from '#gw2/platform/skills/timing.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { lockTransitionInput } from '#gw2/platform/skills/transition-delays.js';
import {
  necromancerLifeForceCostMultiplier,
  normalizedNecromancerLifeForceCost
} from '#gw2/professions/necromancer/core/state.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import {
  addCarapace,
  necromancerActiveMinionCompanionIds
} from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import {
  necromancerTasteForBloodStacks,
  reactToTasteForBloodGrant
} from '#gw2/professions/necromancer/core/traits/blood-magic.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import {
  modifyNecromancerWeaponEffects,
  reactToNecromancerWeapons,
  completeNecromancerWeapon,
  necromancerWeaponTasks
} from '#gw2/professions/necromancer/core/mechanics/weapons.js';
import {
  scheduleNecromancerConditions,
  reactToNecromancerConditions,
  necromancerConditionTasks
} from '#gw2/professions/necromancer/core/mechanics/conditions.js';
import { NECROMANCER_LICH_SKILL_IDS } from '#gw2/professions/necromancer/core/skills/index.js';
import {
  observeNecromancerAutoattackTransition,
  necromancerSwordTasks
} from '#gw2/professions/necromancer/core/mechanics/sword-chain.js';
import {
  initializeNecromancerPassives,
  startNecromancerAlliedOpportunities,
  necromancerPassiveTasks
} from '#gw2/professions/necromancer/core/mechanics/passives.js';
import {
  reactToNecromancerCoreDamage,
  reactToNecromancerCoreCondition,
  reactToNecromancerCoreControl,
  reactToNecromancerBlind
} from '#gw2/professions/necromancer/core/traits/index.js';
import {
  completeNecromancerMinion,
  necromancerMinionAvailability,
  necromancerMinionTasks,
  ownsNecromancerMinionSkill
} from '#gw2/professions/necromancer/core/mechanics/minions.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { DEPLETION, necromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/resources.js';

const LICH_EXPIRY = 'necromancer.lich-expiry';
const GRAVEDIGGER_RESET = 'necromancer.gravedigger-reset';

/** Entry and exit refresh Soul Barbs from the actual transition, including automatic depletion. */
function soulBarbs(runtime: NecromancerRuntime): void {
  if (!hasTrait(runtime, TRAIT.SOUL_BARBS)) return;
  runtime.emit({
    type: 'buff',
    at: runtime.time,
    source: 'Trait',
    sourceId: TRAIT.SOUL_BARBS,
    actorType: 'player',
    kind: 'necromancer-soul-barbs',
    stacks: 1,
    duration: balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SOUL_BARBS), 'duration')
  });
}

/** Life force reads pre-entry Carapace; entry grants and successful removals then update the same stack collection. */
function prepareShroudEntry(runtime: NecromancerRuntime): void {
  const state = runtime.profession.core;
  if (hasTrait(runtime, TRAIT.SOUL_COMPREHENSION)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.SOUL_COMPREHENSION);
    const minionStacks = hasTrait(runtime, TRAIT.FLESH_OF_THE_MASTER)
      ? Object.values(state.activeMinions).reduce((sum, count) => sum + count * 2, 0)
      : 0;
    grantNecromancerLifeForce(
      runtime,
      Math.min(
        balanceProfileNumber(profile, 'maximumStacks'),
        activeStackCount(state.carapaceExpiries, runtime.time) + minionStacks
      ) * balanceProfileNumber(profile, 'lifeForcePerStack')
    );
  }

  if (hasTrait(runtime, TRAIT.ARMORED_SHROUD)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.ARMORED_SHROUD);
    addCarapace(
      state,
      balanceProfileNumber(profile, 'resourceGain'),
      runtime.time,
      balanceProfileNumber(profile, 'duration')
    );
  }

  state.selfConditions = state.selfConditions.filter((application) =>
    isTimeInWindow(runtime.time, application.appliedAt, application.expiresAt)
  );
  if (hasTrait(runtime, TRAIT.SHROUDED_REMOVAL)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.SHROUDED_REMOVAL);
    const removed = state.selfConditions.splice(0, balanceProfileNumber(profile, 'maximumConditions'));
    if (removed.length)
      addCarapace(
        state,
        removed.length * balanceProfileNumber(profile, 'resourceGain'),
        runtime.time,
        balanceProfileNumber(profile, 'duration')
      );
  }

  state.plagueSendingArmed = hasTrait(runtime, TRAIT.PLAGUE_SENDING) && state.selfConditions.length > 0;
  state.plagueSendingEntrySkillId = null;
}

/** Surviving entry packets use the shared boon and damage formulas after the transform state is established. */
function shroudEntryEffects(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  soulBarbs(runtime);
  const attribution = {
    at: runtime.time,
    source: 'Trait',
    actorType: 'effect' as const,
    activationId: cast.id,
    triggeredBy: cast.skill.name
  };
  for (const [trait, boon] of [
    [TRAIT.AWAKEN_THE_PAIN, 'might'],
    [TRAIT.FURIOUS_DEMISE, 'fury'],
    [TRAIT.SPEED_OF_SHADOWS, 'swiftness'],
    [TRAIT.ETERNAL_LIFE, 'protection']
  ] as const) {
    if (!hasTrait(runtime, trait)) continue;
    const profile = requireBalanceProfileFromContext(runtime, trait);
    const effect = requireEffect(profile, 'boon', boon);
    if (!effect) continue;
    const event = {
      ...attribution,
      type: 'buff' as const,
      sourceId: trait,
      skillName: profile.name,
      kind: boon,
      duration: effectNumber(profile, effect, 'duration'),
      stacks: effectNumber(profile, effect, 'stacks')
    };
    queueResolverBoon(runtime, event, event);
  }

  for (const trait of [TRAIT.WEAKENING_SHROUD, TRAIT.SPITEFUL_SPIRIT]) {
    if (!hasTrait(runtime, trait)) continue;
    const profile = requireBalanceProfileFromContext(runtime, trait);
    const event = { ...attribution, sourceId: trait, skillName: profile.name, offTarget: cast.command.offTarget };
    const strike = requireEffect(profile, 'strike', 'Strike');
    if (strike)
      runtime.emit(
        buildResolverStrike({
          ...event,
          coefficient: effectNumber(profile, strike, 'coefficient'),
          skillWeapon: 'Unequipped',
          canCrit: true
        })
      );
    if (trait === TRAIT.WEAKENING_SHROUD)
      for (const name of ['Bleeding', 'Weakness']) {
        const effect = requireEffect(profile, 'condition', name);
        if (effect)
          runtime.emit(
            buildResolverCondition({
              ...event,
              condition: String(effect.condition),
              stacks: effectNumber(profile, effect, 'stacks'),
              duration: effectNumber(profile, effect, 'duration')
            })
          );
      }
  }
}

/** Manual exit cancels the owned deadline so it cannot grant twice or end a replacement Lich Form. */
function exitLich(runtime: NecromancerRuntime): void {
  const state = runtime.profession.core;
  if (state.activeShroud !== 'lich') return;
  runtime.cancelOwner({ id: LICH_EXPIRY, generation: state.lichGeneration });
  state.activeShroud = '';
  state.lichEndsAt = 0;
  consumeSkillFlip(state.availableFlips, ID.EXIT_LICH_FORM);
  runtime.resourceController.refresh('lifeForce');
  grantNecromancerLifeForce(runtime, 15);
}

function transition(runtime: NecromancerRuntime, entering: boolean, skill?: NecromancerSkill): void {
  const kind = entering ? 'shroudEntryMs' : 'shroudExitMs';
  lockTransitionInput(runtime, kind, skill);
  runtime.emit({
    type: 'weapon_set',
    at: runtime.time,
    source: 'necromancer',
    sourceId: entering ? 'necromancer.shroud-enter' : 'necromancer.shroud-exit',
    actorType: 'player',
    weaponSet: runtime.activeWeaponSet,
    shroudSwap: true
  });
}

/** Exit mutates the same state seen by attacks and starts entry recharge only after the form ends. */
function exitNecromancerShroud(runtime: NecromancerRuntime): void {
  const state = runtime.profession.core;
  if (!state.activeShroud || state.activeShroud === 'lich') return;
  // Depletion has no cast completion; the actual form exit still invalidates its pending attack chain.
  resetAutoattackChains(runtime);
  const entry =
    state.activeShroudEntryId == null ? undefined : runtime.helpers.skillsById?.get(state.activeShroudEntryId);
  if (state.activeShroudExitId != null) consumeSkillFlip(state.availableFlips, state.activeShroudExitId);
  state.activeShroud = '';
  state.activeShroudEntryId = null;
  state.activeShroudExitId = null;
  state.activeShroudProfileId = '';
  runNecromancerShroudExit(runtime);
  runtime.resourceController.refresh('lifeForce');
  runtime.cooldownController.clear(ID.ISOLATE);
  if (entry) {
    // A known marker timestamp admits hostile packets but does not move an earlier authored exit into combat.
    if (
      runtime.combatStartPending ||
      runtime.cursor.command?.type === 'combat-start' ||
      (runtime.combatStartTime != null && runtime.time < runtime.combatStartTime)
    )
      runtime.cooldownController.clear(entry.id);
    else runtime.cooldownController.startRecharge(entry, runtime.time, 10);
  }

  transition(runtime, false);
  soulBarbs(runtime);
}

/** Landed player packets own weapon gains and the post-hit half-health test; no predicted observation is replayed. */
function damage(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  if (!(Number(event.coefficient) > 0)) return;
  const skill = runtime.helpers.skillsById?.get(event.skillId ?? event.sourceId) as NecromancerSkill | undefined;
  if (!skill) return;
  // A command grants its resource only after its owned summon strike lands on a living target.
  if (event.actorType === 'summon' && Boolean(skill.minionKey)) {
    grantNecromancerLifeForce(runtime, Number(skill.lifeForceOnHit ?? 0));
    return;
  }

  if (event.actorType !== 'player') return;
  let amount = Number(skill.lifeForcePerHit ?? skill.lifeForcePerPulse ?? skill.lifeForceOnHit ?? 0);
  if (Number(event.hitIndex ?? 1) === 1) {
    amount += Number(skill.lifeForceGain ?? 0);
    if (skill.categories?.includes('Mark') && hasTrait(runtime, TRAIT.SOUL_MARKS))
      amount += balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SOUL_MARKS), 'lifeForceGain');
    // Count at impact, before this skill's own conditions, and never credit a missed or still-travelling packet.
    if (Number(skill.lifeForcePerCondition) > 0) {
      const count = Number(
        event.metadata?.necromancerConditionCount ??
          targetConditionCount({ config: runtime.config, query: runtime.query, runtime, time: runtime.time })
      );
      amount += Math.min(Number(skill.maximumConditions), count) * Number(skill.lifeForcePerCondition);
    }
  }

  if (hasTrait(runtime, TRAIT.SPITEFUL_FORTITUDE) && remainingTargetHealthBelow(runtime.config, runtime, 0.5)) {
    amount += balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, PROFILE.spitefulFortitude),
      'lifeForceGain'
    );
  }

  grantNecromancerLifeForce(runtime, amount);
  if (skill.id === ID.CHILLING_SCYTHE) runtime.cooldownController.clear(ID.GRAVEDIGGER);
}

/** Completed heal, signet, and shroud casts claim trait effects once against current cooldowns and Carapace. */
function completionTraits(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill;
  const state = runtime.profession.core;
  const cause = {
    at: runtime.time,
    source: 'Trait',
    actorType: 'effect' as const,
    activationId: cast.id,
    triggeredBy: skill.name,
    offTarget: cast.command.offTarget
  };
  if (skill.type === 'Heal' && hasTrait(runtime, TRAIT.DARK_DEFENSE)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.DARK_DEFENSE);
    if (
      tryConsumeProcCooldown(
        state.traitProcReadyAt,
        'darkDefense',
        runtime.time,
        balanceProfileNumber(profile, 'internalCooldown')
      )
    ) {
      addCarapace(
        state,
        balanceProfileNumber(profile, 'resourceGain'),
        runtime.time,
        balanceProfileNumber(profile, 'duration')
      );
      const boon = requireEffect(profile, 'boon', 'protection');
      if (boon) {
        const event = {
          ...cause,
          type: 'buff' as const,
          sourceId: TRAIT.DARK_DEFENSE,
          skillName: profile.name,
          kind: String(boon.boon),
          stacks: effectNumber(profile, boon, 'stacks'),
          duration: effectNumber(profile, boon, 'duration')
        };
        queueResolverBoon(runtime, event, event);
      }
    }
  }

  if (skill.categories?.includes('Signet') && hasTrait(runtime, TRAIT.SIGNETS_OF_SUFFERING)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.SIGNETS_OF_SUFFERING);
    const strike = requireEffect(profile, 'strike', 'Strike');
    if (strike)
      runtime.emit(
        buildResolverStrike({
          ...cause,
          sourceId: TRAIT.SIGNETS_OF_SUFFERING,
          skillName: profile.name,
          coefficient: 0,
          skillWeapon: 'Unequipped',
          noCrit: true,
          flatStrikeBase: effectNumber(profile, strike, 'flatStrikeBase'),
          damageKind: 'life-steal'
        })
      );
  }

  if (skill.type === 'Heal' && hasTrait(runtime, TRAIT.MALICIOUS_SWARM)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.MALICIOUS_SWARM);
    const strike = requireEffect(profile, 'strike', 'Strike');
    if (
      strike &&
      tryConsumeProcCooldown(
        state.traitProcReadyAt,
        'maliciousSwarm',
        runtime.time,
        balanceProfileNumber(profile, 'internalCooldown')
      )
    )
      runtime.emit(
        buildResolverStrike({
          ...cause,
          sourceId: TRAIT.MALICIOUS_SWARM,
          skillName: 'Lesser Signet of the Locust',
          skillWeapon: 'Unequipped',
          coefficient: effectNumber(profile, strike, 'coefficient')
        })
      );
  }

  if (skill.shroudSlot === 4 && hasTrait(runtime, TRAIT.TRANSFUSION)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.TRANSFUSION);
    const event = {
      ...cause,
      sourceId: TRAIT.TRANSFUSION,
      skillId: ID.LESSER_CHILBLAINS,
      skillName: 'Lesser Chilblains',
      parentSkillName: skill.name,
      icon: runtime.helpers.skillsById.get(ID.CHILLBLAINS)?.icon
    };
    const strike = requireEffect(profile, 'strike', 'Strike');
    if (strike)
      runtime.emit(
        buildResolverStrike({
          ...event,
          coefficient: effectNumber(profile, strike, 'coefficient'),
          skillWeapon: 'Unequipped'
        })
      );
    for (const name of ['Poisoned', 'Chilled']) {
      const condition = requireEffect(profile, 'condition', name);
      if (condition)
        runtime.emit(
          buildResolverCondition({
            ...event,
            condition: String(condition.condition),
            stacks: effectNumber(profile, condition, 'stacks'),
            duration: effectNumber(profile, condition, 'duration')
          })
        );
    }
  }
}

function complete(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  // Committed Gravedigger strikes retain their reset through an interrupted animation; sample health when its lockout ends.
  if (cast.skill.id === ID.GRAVEDIGGER && !cast.cancelled) runtime.schedule(GRAVEDIGGER_RESET, cast.fullEnd);
  if (!castCompleted(cast)) return;
  completeNecromancerMinion(runtime, cast);
  completeNecromancerWeapon(runtime, cast);
  const skill = cast.skill as NecromancerSkill;
  const state = runtime.profession.core;
  // Follow-ups own exact completion-time windows; ordinary attack chains and dedicated summons/forms own their own state.
  const next = runtime.helpers.autoattackChainPositions.get(Number(skill.id))?.next;
  if (
    [ID.DARK_PATH, ID.RIPPLE_OF_HORROR, ID.INFUSING_TERROR].some((id) => id === Number(skill.id)) &&
    skill.flipSkillId != null
  ) {
    runtime.armFlip(skill.flipSkillId, { expiresAt: runtime.time + Number(skill.flipDuration) });
  } else if (
    skill.flipSkillId != null &&
    skill.flipSkillId !== next &&
    skill.flipSkillId !== skill.nextChainId &&
    !ownsNecromancerMinionSkill(skill) &&
    !skill.shroudEntry &&
    !skill.shroudExit &&
    skill.id !== ID.LICH_FORM &&
    skill.id !== ID.EXIT_LICH_FORM
  ) {
    const flip = runtime.helpers.skillsById.get(skill.flipSkillId);
    if (flip && flip.name !== skill.name && flip.flipParentId === skill.id)
      runtime.armFlip(flip.id, {
        expiresAt: cast.rechargeStart + Math.max(1, Number(skill.flipDuration ?? skill.cooldown ?? 5))
      });
  }

  if (skill.flipParentId != null && !skill.shroudExit && !Boolean(skill.minionKey))
    consumeSkillFlip(state.availableFlips, skill.id);
  if (skill.id === ID.LICH_FORM) {
    state.activeShroud = 'lich';
    state.lichEndsAt = canonicalTime(runtime.time + 20);
    state.lichGeneration++;
    armSkillFlip(state.availableFlips, ID.EXIT_LICH_FORM, runtime.time, state.lichEndsAt);
    runtime.resourceController.refresh('lifeForce');
    runtime.schedule(LICH_EXPIRY, state.lichEndsAt, null, { id: LICH_EXPIRY, generation: state.lichGeneration }, -20);
  } else if (skill.id === ID.EXIT_LICH_FORM) exitLich(runtime);
  else if (skill.shroudEntry) {
    prepareShroudEntry(runtime);
    state.activeShroud = skill.shroudEntry;
    state.activeShroudEntryId = skill.id;
    state.activeShroudProfileId = String(skill.shroudProfileId || PROFILE.shroud);
    const exit = [...(runtime.helpers.skillsById?.values() ?? [])].find(
      (candidate) => candidate.shroudExit === skill.shroudEntry
    );
    state.activeShroudExitId = exit?.id ?? null;
    if (exit) armSkillFlip(state.availableFlips, exit.id, runtime.time);
    runtime.cooldownController.setReadyAt(skill.id, Infinity);
    runNecromancerShroudEnter(runtime, skill);
    runtime.resourceController.refresh('lifeForce');
    shroudEntryEffects(runtime, cast);
    transition(runtime, true, skill);
  } else if (skill.shroudExit) exitNecromancerShroud(runtime);
  completionTraits(runtime, cast);
}

/** Core mechanics share one live queue and resource owner with the active specialization. */
export const necromancerCoreHooks: Partial<RuntimeProfession<NecromancerRuntimeState>> = {
  rechargeStart: (_runtime, cast, at) => modifyNecromancerRechargeStart(cast, at),
  resources: { lifeForce: necromancerLifeForce },
  initialize(runtime) {
    runtime.profession.core.lifeForceCostMultiplier = necromancerLifeForceCostMultiplier(runtime.config, runtime);
    initializeNecromancerPassives(runtime);
  },
  onCombatStart(runtime) {
    if (runtime.hasExplicitCombatStart) startNecromancerAlliedOpportunities(runtime);
  },
  availability(runtime, rawSkill) {
    const skill = rawSkill as NecromancerSkill;
    const state = runtime.profession.core;
    if (skill.id === ID.DEVOURING_DARKNESS && !hasTrait(runtime, TRAIT.LINGERING_CURSE))
      return denySkillCast(skill, 'necromancer.trait-locked', 'requires Lingering Curse.');
    if (skill.id === ID.FEAST_OF_CORRUPTION && hasTrait(runtime, TRAIT.LINGERING_CURSE))
      return denySkillCast(
        skill,
        'necromancer.trait-replacement',
        'Devouring Darkness replaces it while Lingering Curse is selected.'
      );
    const minionGate = necromancerMinionAvailability(runtime, skill);
    if (minionGate) return minionGate;
    if (
      skill.flipParentId != null &&
      !skill.shroudExit &&
      !runtime.helpers.autoattackChainPositions.has(Number(skill.id)) &&
      !skillFlipReady(state.availableFlips[skill.id], runtime.time)
    )
      return denySkillCast(skill, 'necromancer.flip-not-armed', 'not currently armed.');
    if (NECROMANCER_LICH_SKILL_IDS.includes(skill.id))
      return state.activeShroud === 'lich'
        ? { ready: true }
        : denySkillCast(skill, 'necromancer.not-in-lich', 'Lich Form is not active.');
    if (skill.shroudEntry) {
      if (state.activeShroud)
        return denySkillCast(skill, 'necromancer.in-shroud', `already in ${state.activeShroud} shroud.`);
      if ((skill.specialization || 'Core') !== (runtime.config.specialization || 'Core'))
        return denySkillCast(skill, 'necromancer.wrong-specialization', 'requires its matching specialization.');
      const minimum = (state.lifeForce.maximum * Number(skill.minimumShroudLifeForcePercent ?? 10)) / 100;
      if (runtime.resourceController.value('lifeForce') < minimum)
        return denySkillCast(
          skill,
          'necromancer.insufficient-life-force',
          'requires more life force.',
          runtime.resourceController.readyAt('lifeForce', minimum)
        );
    } else if (skill.shroudExit) {
      if (state.activeShroud !== skill.shroudExit)
        return denySkillCast(skill, 'necromancer.not-in-shroud', 'the matching shroud is not active.');
    } else if (skill.shroud && state.activeShroud !== skill.shroud)
      return denySkillCast(skill, 'necromancer.wrong-shroud', `requires ${skill.shroud} shroud.`);
    else if (!skill.shroud && state.activeShroud && !skill.usableInShroud)
      return denySkillCast(skill, 'necromancer.in-shroud', 'cannot cast in shroud.');
    const cost = normalizedNecromancerLifeForceCost(state, skill.lifeForceCost ?? 0);
    if (runtime.resourceController.value('lifeForce') < cost)
      return denySkillCast(
        skill,
        'necromancer.insufficient-life-force',
        'requires more life force.',
        runtime.resourceController.readyAt('lifeForce', cost)
      );
    return { ready: true };
  },
  // Recharge traits select work once at acceptance; the shared controller applies permanent Alacrity.
  rechargeWork(runtime, skill, work) {
    if (skill.shroudEntry || skill.rechargeOnMinionDeath) return 0;
    if (skill.categories?.includes('Corruption') && hasTrait(runtime, TRAIT.MASTER_OF_CORRUPTION))
      work *= balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, TRAIT.MASTER_OF_CORRUPTION),
        'rechargeMultiplier'
      );
    if (skill.shroud && hasTrait(runtime, TRAIT.SINISTER_SHROUD))
      work *= balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, PROFILE.sinisterShroud),
        'rechargeMultiplier'
      );
    return work;
  },
  modifyEffects: (runtime, cast, effects) =>
    ownsNecromancerMinionSkill(cast.skill as NecromancerSkill) || cast.skill.id === ID.DEVOURING_DARKNESS
      ? []
      : modifyNecromancerWeaponEffects(runtime, cast, effects),
  onCastStart(runtime, cast) {
    scheduleNecromancerConditions(runtime, cast);
    const cost = normalizedNecromancerLifeForceCost(runtime.profession.core, Number(cast.skill.lifeForceCost ?? 0));
    if (cost) runtime.resourceController.spend('lifeForce', cost);
    // Delivered party buffs seed the same per-recipient pools consumed by actual player, minion, and allied hits.
    const stacks = necromancerTasteForBloodStacks(Number(cast.skill.id));
    if (stacks && hasTrait(runtime, TRAIT.OVERFLOWING_THIRST)) {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.overflowingThirst);
      const buff = requireEffect(profile, 'buff', 'taste-for-blood');
      if (buff)
        runtime.emit({
          type: 'buff',
          at: runtime.time,
          source: 'Trait',
          sourceId: TRAIT.OVERFLOWING_THIRST,
          actorType: 'player',
          skillId: cast.skill.id,
          skillName: cast.skill.name,
          activationId: cast.id,
          kind: String(buff.kind),
          duration: effectNumber(profile, buff, 'duration'),
          stacks,
          audience: {
            recipients: 'party',
            maximumRecipients: 5,
            eligibleCompanionIds: necromancerActiveMinionCompanionIds(runtime)
          }
        });
    }
  },
  onCastComplete: complete,
  onAutoattackChainTransition: observeNecromancerAutoattackTransition,
  onCooldownReset(runtime) {
    runtime.resourceController.grant('lifeForce', runtime.profession.core.lifeForce.maximum);
    runtime.profession.core.selfConditions = [];
  },
  tasks: {
    ...necromancerSwordTasks,
    ...necromancerWeaponTasks,
    ...necromancerConditionTasks,
    ...necromancerMinionTasks,
    ...necromancerPassiveTasks,
    [GRAVEDIGGER_RESET](runtime) {
      if (remainingTargetHealthBelow(runtime.config, runtime, 0.5)) runtime.cooldownController.clear(ID.GRAVEDIGGER);
    },
    [DEPLETION](runtime) {
      exitNecromancerShroud(runtime);
      runNecromancerLifeForceDepletion(runtime);
    },
    [LICH_EXPIRY]: exitLich
  },
  reactions: {
    'buff.applied'(runtime, event) {
      if (event.kind === 'taste-for-blood') reactToTasteForBloodGrant(runtime, event);
    },
    'damage.resolved'(runtime, event, details) {
      damage(runtime, event);
      reactToNecromancerWeapons(runtime, event);
      reactToNecromancerConditions(runtime, event);
      reactToNecromancerCoreDamage(runtime, event, details);
    },
    'condition.applied'(runtime, event) {
      // These hands have no strike packet; their first accepted authored condition owns the fixed life-force grant.
      if (
        event.actorType === 'player' &&
        event.sourceId === event.skillId &&
        Number(event.applicationIndex ?? 1) === 1 &&
        ((event.skillId === ID.SPECTRAL_GRASP && event.condition === 'Chilled') ||
          (event.skillId === ID.SOUL_GRASP && event.condition === 'Vulnerability'))
      )
        grantNecromancerLifeForce(runtime, Number(runtime.helpers.skillsById.get(event.skillId)?.lifeForceGain ?? 0));
      reactToNecromancerCoreCondition(runtime, event);
    },
    'control.resolved'(runtime, event) {
      // Fear of Death belongs to an accepted fear application, so misses and pending travel grant nothing.
      const state = runtime.profession.core;
      if (
        event.controlKind === 'fear' &&
        event.actorType !== 'summon' &&
        hasTrait(runtime, TRAIT.FEAR_OF_DEATH) &&
        isInternalCooldownReady(runtime.time, state.fearOfDeathReadyAt)
      ) {
        const profile = requireBalanceProfileFromContext(runtime, TRAIT.FEAR_OF_DEATH);
        state.fearOfDeathReadyAt = runtime.time + balanceProfileNumber(profile, 'internalCooldown');
        grantNecromancerLifeForce(runtime, balanceProfileNumber(profile, 'lifeForceGain'));
      }

      reactToNecromancerCoreControl(runtime, event);
    },
    'blind.resolved': reactToNecromancerBlind
  }
};
