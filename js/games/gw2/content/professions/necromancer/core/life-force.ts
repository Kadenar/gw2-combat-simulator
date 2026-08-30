import { hasTrait } from '../../../../platform/combat/state/traits.js';
import { emitSkillBuff, emitSkillDamage } from '../../../../platform/scheduler/skill-events.js';
import { emitStateSnapshot } from '../../../../platform/engine/events/state-snapshots.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { snapshotNecromancerState } from '../state/index.js';
import { gw2AlliedPlayerAssumptions } from '../../../../platform/combat/state/allied-players.js';
import { selectedSkillNameSet } from '../../../../platform/builds/selected-skills.js';
/**
 * Life-force resource clock and cast finalization.
 *
 * `advanceNecromancerState` integrates everything that happens between two
 * points in time: shroud life-force drain (and auto-exit on depletion), * specialization-owned resource clocks, Signet of Undeath/Vampirism passives, * Eternal Life regen, and Lich Form expiry. `leaveShroud` performs
 * the shroud-exit bookkeeping (recharge, Soul Barbs, weapon swap). `finalize-
 * NecromancerCast` runs after each cast to advance the clock and apply skill
 * life-force gain. Called on a tight loop, so it stays allocation-light.
 */
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { syncNecromancerResources } from './state.js';
import {
  NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE,
  balanceProfileEffect,
  necromancerBalanceProfile
} from './profiles.js';
import { gainNecromancerLifeForce, purgeTimedState } from './shared.js';
import { runNecromancerResourceAdvance, runNecromancerShroudExit } from './shroud-lifecycle.js';
import type { SkillId } from '../../../../platform/engine/types.js';
import type {
  NecromancerCastContext,
  NecromancerConfig,
  NecromancerSchedulerContext,
  NecromancerSkill
} from '../types.js';

function targetConditionCount(config: NecromancerConfig): number {
  return Object.values(config.target?.conditions || {}).filter((value) => value === true || Number(value) > 0).length;
}

function targetBoonCount(config: NecromancerConfig): number {
  if (config.target?.boonless) return 0;
  if (Array.isArray(config.target?.boons)) return config.target.boons.length;
  return Math.max(0, Number(config.target?.boonCount || 1));
}

function alacrityRecharge(context: NecromancerSchedulerContext, duration: number, at: number): number {
  return duration / (context.hasBuff?.('alacrity', at) ? 1.25 : 1);
}

function setShroudRecharge(
  context: NecromancerSchedulerContext,
  entryId: SkillId | null | undefined,
  at: number
): void {
  if (entryId != null) {
    context.state.cooldowns.set(entryId, at + alacrityRecharge(context, 10, at));
  }
}

// Exit the current shroud atomically, clear its flip and drain state, then apply
// exit traits and publish the weapon-set transition.
export function leaveShroud(context: NecromancerSchedulerContext, at: number, reason = 'shroud-exit'): void {
  const state = professionCoreState(context);
  const shroud = state.activeShroud;
  if (!shroud || shroud === 'lich') return;
  const entryId = state.activeShroudEntryId;
  const exitId = state.activeShroudExitId;
  state.activeShroud = '';
  state.activeShroudEntryId = null;
  state.activeShroudExitId = null;
  state.activeShroudProfileId = '';
  state.shroudEnteredAt = 0;
  if (exitId != null) {
    delete state.availableFlips[exitId];
    delete state.availableFlips[String(exitId)];
  }

  runNecromancerShroudExit(context, at, reason);
  context.state.cooldowns.delete(ID.ISOLATE);
  setShroudRecharge(context, entryId, at);
  if (hasTrait(context, TRAIT.SOUL_BARBS)) {
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId: TRAIT.SOUL_BARBS,
      actorType: 'player',
      kind: 'necromancer-soul-barbs',
      duration: 15,
      stacks: 1
    });
  }

  context.emit({
    type: 'weapon_set',
    at,
    source: 'necromancer',
    sourceId: `necromancer.${reason}`,
    actorType: 'player',
    weaponSet: context.state.activeWeaponSet,
    shroudSwap: true
  });
  emitStateSnapshot(context, 'necromancer', at, reason, snapshotNecromancerState(context.state.profession), {
    dedupeAcrossSourceIds: true
  });
}

function activeSignetOfUndeath(context: NecromancerSchedulerContext): boolean {
  return selectedSkillNameSet(context.config.selectedSkills).has('Signet of Undeath');
}

function activeSignetOfVampirism(context: NecromancerSchedulerContext): boolean {
  return selectedSkillNameSet(context.config.selectedSkills).has('Signet of Vampirism');
}

// Configured party members contribute trigger-only attacks for Vampiric
// Presence. Each ally owns the half-second interval and never adds base damage.
function emitAlliedVampiricPresenceHits(context: NecromancerSchedulerContext, start: number, end: number): void {
  if (!hasTrait(context, TRAIT.VAMPIRIC_PRESENCE)) return;
  const allies = gw2AlliedPlayerAssumptions(context.config);
  if (!allies.count || !allies.strikesPerSecond) return;
  const combatStart = context.hasExplicitCombatStart ? context.combatStartTime : 0;
  if (combatStart == null || end < combatStart - context.epsilon) return;

  const state = professionCoreState(context);
  const interval = Math.max(
    Number(necromancerBalanceProfile(context, PROFILE.vampiricPresence)?.cooldown ?? 0.5),
    1 / allies.strikesPerSecond
  );
  const windowStart = Math.max(start, combatStart);
  let nextAt = Number(state.traitProcReadyAt.vampiricPresenceAlliedNextAt || 0);
  if (!(nextAt > windowStart + context.epsilon)) nextAt = windowStart + interval;
  while (nextAt <= end + context.epsilon) {
    for (let allyIndex = 1; allyIndex <= allies.count; allyIndex += 1) {
      context.emit({
        type: 'necromancer.vampiric-presence-allied-hit',
        at: nextAt,
        source: 'Trait',
        sourceId: TRAIT.VAMPIRIC_PRESENCE,
        actorType: 'effect',
        skillName: `Allied Player ${allyIndex} Attack`,
        allyIndex
      });
    }

    nextAt += interval;
  }

  state.traitProcReadyAt.vampiricPresenceAlliedNextAt = nextAt;
}

// Allied attack opportunities are trigger-only events. Resolver-owned stack
// pools decide independently whether each player can spend Taste for Blood.
function emitAlliedTasteForBloodHits(context: NecromancerSchedulerContext, start: number, end: number): void {
  if (!hasTrait(context, TRAIT.OVERFLOWING_THIRST)) return;
  const allies = gw2AlliedPlayerAssumptions(context.config);
  if (!allies.count || !allies.strikesPerSecond) return;
  const combatStart = context.hasExplicitCombatStart ? context.combatStartTime : 0;
  if (combatStart == null || end < combatStart - context.epsilon) return;

  const state = professionCoreState(context);
  const interval = 1 / allies.strikesPerSecond;
  const windowStart = Math.max(start, combatStart);
  let nextAt = Number(state.traitProcReadyAt.tasteForBloodAlliedNextAt || 0);
  if (!(nextAt > windowStart + context.epsilon)) nextAt = windowStart + interval;
  while (nextAt <= end + context.epsilon) {
    for (let allyIndex = 1; allyIndex <= allies.count; allyIndex += 1) {
      context.emit({
        type: 'necromancer.taste-for-blood-allied-hit',
        at: nextAt,
        source: 'Trait',
        sourceId: TRAIT.OVERFLOWING_THIRST,
        actorType: 'effect',
        skillName: `Allied Player ${allyIndex} Attack`,
        allyIndex
      });
    }

    nextAt += interval;
  }

  state.traitProcReadyAt.tasteForBloodAlliedNextAt = nextAt;
}

// Advance all continuous Necromancer state to one timestamp: timed traits,
// signet pulses, life-force sources and drain, and expiring transformations.
export function advanceNecromancerState(context: NecromancerSchedulerContext, target: number): void {
  const state = professionCoreState(context);
  const start = Number(state.lastResourceAt || 0);
  const end = Math.max(start, Number(target || 0));
  purgeTimedState(state, end);
  emitAlliedVampiricPresenceHits(context, start, end);
  emitAlliedTasteForBloodHits(context, start, end);

  if (activeSignetOfUndeath(context)) {
    const passive = necromancerBalanceProfile(context, PROFILE.signetOfUndeathPassive);
    const interval = Number(passive?.pulseInterval || 3);
    while (state.signetNextLifeForceAt <= end + context.epsilon) {
      if (state.signetNextLifeForceAt > start + context.epsilon) {
        gainNecromancerLifeForce(context, Number(passive?.lifeForceGain || 0), state.signetNextLifeForceAt);
      }

      state.signetNextLifeForceAt += interval;
    }
  }

  if (activeSignetOfVampirism(context)) {
    const passive = necromancerBalanceProfile(context, PROFILE.signetOfVampirismPassive);
    const strike = balanceProfileEffect(passive, 'strike');
    const strikeMetadata = strike?.metadata || {};
    const interval = Number(passive?.pulseInterval || 3);
    const cooldownReadyAt = Number(context.state.cooldowns.get(ID.SIGNET_OF_VAMPIRISM) || 0);
    const passiveWhileRecharging = hasTrait(context, TRAIT.SIGNETS_OF_SUFFERING) && Boolean(state.activeShroud);
    while (state.vampirismNextAt <= end + context.epsilon) {
      if (
        state.vampirismNextAt > start + context.epsilon &&
        (cooldownReadyAt <= state.vampirismNextAt + context.epsilon || passiveWhileRecharging)
      ) {
        const skill = context.catalog.skillsById.get(ID.SIGNET_OF_VAMPIRISM);
        if (skill)
          emitSkillDamage(context, skill, {
            at: state.vampirismNextAt,
            name: 'Signet of Vampirism - Passive Life Siphon',
            coefficient: 0,
            skillWeapon: 'Unequipped',
            metadata: {
              flatStrikeBase: Number(strike?.flatStrikeBase || 0),
              flatStrikePowerCoeff: Number(strike?.flatStrikePowerCoeff || 0),
              noCrit: strikeMetadata.noCrit === true,
              damageKind: String(strikeMetadata.damageKind || '')
            }
          });
      }

      state.vampirismNextAt += interval;
    }
  }

  if (!state.activeShroud && hasTrait(context, TRAIT.ETERNAL_LIFE)) {
    const seconds = Math.max(0, Math.floor(end) - Math.floor(start));
    const threshold = state.maximumLifeForce * 0.66;
    state.lifeForce = Math.min(threshold, state.lifeForce + seconds * state.maximumLifeForce * 0.03);
  }

  runNecromancerResourceAdvance(context, start, end);

  if (state.activeShroud && state.activeShroud !== 'lich') {
    const shroudProfile = necromancerBalanceProfile(context, state.activeShroudProfileId || PROFILE.shroud);
    const rate = (Number(state.maximumLifeForce || 100) * Number(shroudProfile?.lifeForceDrain || 0)) / 100;
    const elapsed = end - start;
    const potentialDrain = rate * elapsed;
    const exitAt = potentialDrain >= state.lifeForce && rate > 0 ? start + state.lifeForce / rate : end;

    state.lifeForce = Math.max(0, state.lifeForce - rate * (exitAt - start));
    syncNecromancerResources(state);
    if (state.lifeForce <= context.epsilon) {
      state.lifeForce = 0;
      leaveShroud(context, exitAt, 'life-force-depleted');
    }
  }

  if (state.activeShroud === 'lich' && state.lichEndsAt <= end + context.epsilon) {
    state.activeShroud = '';
    state.lichEndsAt = 0;
    delete state.availableFlips[ID.EXIT_LICH_FORM];
    gainNecromancerLifeForce(context, 15, end);
  }

  state.lastResourceAt = end;
  syncNecromancerResources(state);
  emitStateSnapshot(context, 'necromancer', end, 'advance', snapshotNecromancerState(context.state.profession), {
    dedupeAcrossSourceIds: true
  });
}

export function applySkillLifeForceGain(context: NecromancerCastContext, skill: NecromancerSkill): void {
  let amount = Number(skill.lifeForceGain || 0);
  if (skill.categories?.includes('Mark') && hasTrait(context, TRAIT.SOUL_MARKS)) {
    amount += 3;
  }

  if (new Set<string | number>([ID.FEAST_OF_CORRUPTION, ID.DEVOURING_DARKNESS]).has(skill.id)) {
    amount += Math.min(5, targetConditionCount(context.config));
  }

  // Dark Pact's fixed gain is conditional on having at least one target boon to remove.
  if (skill.id === ID.DARK_PACT && targetBoonCount(context.config) === 0) {
    amount = 0;
  }

  if (amount > 0) {
    gainNecromancerLifeForce(context, amount, context.effectiveEnd, 'skill-life-force');
  }
}

export function finalizeNecromancerCast(context: NecromancerCastContext, skill: NecromancerSkill): void {
  advanceNecromancerState(context, context.effectiveEnd);
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  applySkillLifeForceGain(context, skill);
  const state = professionCoreState(context);
  if (state.pendingShroudEntryId === skill.id) {
    context.state.cooldowns.set(skill.id, Number.POSITIVE_INFINITY);
    delete state.pendingShroudEntryId;
  }

  emitStateSnapshot(
    context,
    'necromancer',
    context.effectiveEnd,
    'after-cast',
    snapshotNecromancerState(context.state.profession),
    { dedupeAcrossSourceIds: true }
  );
}
