import { professionCoreState } from '../../../platform/engine/profession/state.js';
/**
 * Life-force resource clock and cast finalization.
 *
 * `advanceNecromancerState` integrates everything that happens between two
 * points in time: shroud life-force drain (and auto-exit on depletion),
 * specialization-owned resource clocks, Signet of Undeath/Vampirism passives,
 * Eternal Life regen, and Lich Form expiry. `leaveShroud` performs
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
import { emitDamage, emitState, gainNecromancerLifeForce, hasTrait, purgeTimedState } from './shared.js';
import { runNecromancerResourceAdvance, runNecromancerShroudExit } from './shroud-lifecycle.js';
import type { SkillId } from '../../../platform/engine/types.js';
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
    context.emit({
      type: 'buff',
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
  emitState(context, at, reason);
}

function selectedSkillNames(context: NecromancerSchedulerContext): readonly string[] {
  const selected = context.config.selectedSkills;
  return Array.isArray(selected) ? selected : Object.values(selected || {});
}

function activeSignetOfUndeath(context: NecromancerSchedulerContext): boolean {
  return selectedSkillNames(context).includes('Signet of Undeath');
}

function activeSignetOfVampirism(context: NecromancerSchedulerContext): boolean {
  return selectedSkillNames(context).includes('Signet of Vampirism');
}

export function advanceNecromancerState(context: NecromancerSchedulerContext, target: number): void {
  const state = professionCoreState(context);
  const start = Number(state.lastResourceAt || 0);
  const end = Math.max(start, Number(target || 0));
  purgeTimedState(state, end);

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
          emitDamage(context, skill, 0, {
            at: state.vampirismNextAt,
            name: 'Signet of Vampirism - Passive Life Siphon',
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
  emitState(context, end, 'advance');
}

export function applySkillLifeForceGain(context: NecromancerCastContext, skill: NecromancerSkill): void {
  let amount = Number(skill.lifeForceGain || 0);
  if (skill.categories?.includes('Mark') && hasTrait(context, TRAIT.SOUL_MARKS)) {
    amount += 3;
  }

  if (new Set<string | number>([ID.FEAST_OF_CORRUPTION, ID.DEVOURING_DARKNESS]).has(skill.id)) {
    amount += Math.min(5, targetConditionCount(context.config));
  }

  if (skill.id === 10529 && targetBoonCount(context.config) === 0) {
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

  emitState(context, context.effectiveEnd, 'after-cast');
}
