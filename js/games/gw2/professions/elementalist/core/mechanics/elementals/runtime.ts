import {
  beforeElementalStrike,
  retireElemental
} from '#gw2/professions/elementalist/core/mechanics/elementals/lifecycle.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { canonicalTime } from '#kernel/core/clock.js';
/**
 * Owns the summoned-elemental lifecycle for Glyph of Elementals (Fire / Earth).
 *
 * An elemental is a scheduler-driven autonomous companion. Once summoned it runs
 * an actorLoop for attack selection/recovery, impact tasks for started actions,
 * and a timed lifetime for expiry after same-time impacts.
 *
 * Generation counters guard against stale scheduled tasks:
 *   - summonGeneration bumps every time a new elemental is summoned; tasks from a
 *     previous summon are ignored (and the previous owner's tasks are cancelled).
 *   - actionGeneration bumps every time a new action starts; impacts from
 *     an interrupted or superseded action are ignored.
 *
 * Fire loop:  Fireball (auto) / Flame Burst (secondary, off cooldown) / Flame Barrage (player command).
 * Earth loop: Punch (auto) / Enervating Punch (secondary, off cooldown) / Stomp (player command).
 *
 * Auto-summon supplies a slotted glyph's first companion; subsequent summons require an explicit glyph cast.
 */
import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { denyCast, retryCast, selectedSlotSkillAvailability } from '#gw2/platform/execution/availability.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { GW2_ALACRITY_RECHARGE_RATE } from '#gw2/platform/combat/recharge.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import {
  elementalistBuffRequest,
  elementalistConditionRequest,
  elementalistStrikeRequest
} from '#gw2/professions/elementalist/core/events.js';
import {
  elementalForGlyphId,
  elementalRuntimeProfile,
  FLAME_BARRAGE_ID,
  selectedElementalFromSkills,
  STOMP_ID,
  type ElementalImpact,
  type ElementalKind
} from '#gw2/professions/elementalist/core/mechanics/elementals/attacks.js';
import {
  EARTH_ELEMENTAL_EVTC_PROFILE,
  FIRE_ELEMENTAL_EVTC_PROFILE
} from '#gw2/professions/elementalist/core/mechanics/elementals/profiles.js';
import { elementalistLoadoutIdentity } from '#gw2/professions/elementalist/core/mechanics/selection-policy.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profile-ids.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';
// Impact packets retain both generations so replacing an actor or action invalidates its pending hits.
interface ElementalImpactTaskPayload {
  readonly summonGeneration: number;
  readonly actionGeneration: number;
  readonly activationId: string;
  readonly impact: ElementalImpact;
  readonly hitIndex: number;
}
// Re-summoning cancels pending impact packets separately from the shared actor lifetime.
const ELEMENTAL_IMPACT_TASK = 'elementalist.elemental-impact';
const ELEMENTAL_TASK_OWNER = 'elementalist.summoned-elemental';
function ready(): AvailabilityResult {
  return { ready: true };
}

function unavailable(reason: string, retryAt?: number): AvailabilityResult {
  return retryAt == null
    ? denyCast('elementalist.summoned-elemental', reason)
    : retryCast(retryAt, 'elementalist.summoned-elemental', reason);
}

// Which elemental the loadout has slotted (drives auto-summon). Bare "Glyph of
// Elementals" is treated as the Fire variant.
function selectedElemental(context: MechanicQueriesOf<ElementalistRuntime>): ElementalKind | null {
  return selectedElementalFromSkills(selectedSkillIdSet(context.config.selectedSkillIds));
}

// Maps a stable glyph skill ID to the elemental it summons; null for unrelated skills.
function elementalForGlyph(skill: Skill): ElementalKind | null {
  return elementalForGlyphId(skill.id);
}

// Resolves the catalog skill that owns an element, so auto-summon and post-expiry recharge
// can act on the glyph even when it was never explicitly cast.
function glyphSkillForElement(context: ElementalistRuntime, element: ElementalKind): Skill | null {
  return (
    context.helpers.skillsById.get(element === 'Earth' ? ID.GLYPH_OF_ELEMENTALS_EARTH : ID.GLYPH_OF_ELEMENTALS) || null
  );
}

/**
 * Stable per-summon actor identity, so every strike and effect the elemental produces
 * attributes to the right companion instead of bleeding across re-summons.
 */
export function elementalistElementalCompanionId(summonGeneration: number): string {
  return `elementalist-elemental:${summonGeneration}`;
}

// True if the given summon generation is still the live elemental at time `at`.
// Already queued impacts may land exactly at expiry, before the priority-50 teardown.
function activeElemental(context: ElementalistRuntime, summonGeneration: number, at: number): boolean {
  const elemental = professionCoreState(context).summonedElemental;
  return (
    (elemental.element === 'Fire' || elemental.element === 'Earth') &&
    elemental.summonGeneration === summonGeneration &&
    elemental.activeUntil >= at
  );
}

// Only Alacrity received by this elemental accelerates its autonomous recharge.
function rechargeRate(context: ElementalistRuntime, at: number): number {
  return elementalBoonActive(context, 'alacrity', at) ? GW2_ALACRITY_RECHARGE_RATE : 1;
}

// Quickness speeds up the elemental's animations 50% (divides all timing offsets).
function actionRate(context: ElementalistRuntime, at: number): number {
  return elementalBoonActive(context, 'quickness', at) ? 1.5 : 1;
}

/** Summons read only applications addressed to their current companion identity. */
function elementalBoonActive(context: ElementalistRuntime, kind: string, at: number): boolean {
  return (
    context.combat.activeBoonStacks(kind, at, 1, {
      actor: 'companion',
      companionId: elementalistElementalCompanionId(context.profession.core.summonedElemental.summonGeneration)
    }) > 0
  );
}

/** Report interruption at its actual boundary; pending hits are invalidated by the action generation. */
function interruptCurrentAction(context: ElementalistRuntime, at: number): void {
  const elemental = context.profession.core.summonedElemental;
  context.observations.interruptAction(elemental.currentActivationId, at);
}

// Starts one attack: interrupts any prior action, bumps actionGeneration, emits the
// 'action' event, and returns the generation + activation id the impact tasks carry
// so a superseded action's impacts can be discarded.
function beginSummonAction(
  context: ElementalistRuntime,
  at: number,
  skillId: number,
  skillName: string,
  animationEnd: number
): Readonly<{
  actionGeneration: number;
  activationId: string;
}> {
  const elemental = professionCoreState(context).summonedElemental;
  const element = elemental.element as ElementalKind;
  interruptCurrentAction(context, at);
  elemental.actionGeneration += 1;
  // A commanded opener already owns the AI loop; combat start must not replace its pending impacts.
  elemental.started = true;
  const activationId = `elementalist:${elemental.summonGeneration}:${elemental.actionGeneration}`;
  elemental.currentActivationId = activationId;
  context.effects.emit({
    kind: 'packet',
    event: {
      type: 'action',
      activationId,
      at,
      source: `${element} Elemental`,
      sourceId: skillId,
      actorType: 'summon',
      skillId,
      skillName,
      name: skillName,
      endsAt: at + animationEnd,
      fullEndsAt: at + animationEnd,
      summonOwner: elementalistElementalCompanionId(elemental.summonGeneration)
    }
  });
  return {
    actionGeneration: elemental.actionGeneration,
    activationId
  };
}

// Queues an IMPACT task (a single hit landing) stamped with the summon/action
// generation so it self-cancels if the elemental or action is gone by then.
function scheduleImpact(
  context: ElementalistRuntime,
  at: number,
  impact: ElementalImpact,
  action: Readonly<{
    actionGeneration: number;
    activationId: string;
  }>,
  hitIndex = 1,
  priority = -20
): void {
  const elemental = professionCoreState(context).summonedElemental;
  context.schedule(
    ELEMENTAL_IMPACT_TASK,
    at,
    {
      summonGeneration: elemental.summonGeneration,
      actionGeneration: action.actionGeneration,
      activationId: action.activationId,
      impact,
      hitIndex
    },
    { id: ELEMENTAL_TASK_OWNER, generation: elemental.summonGeneration },
    priority
  );
}

/** Starts an autonomous single-hit attack; secondary profiles also arm their own recharge. */
function startSingleImpactAttack(
  context: ElementalistRuntime,
  at: number,
  profile:
    | typeof FIRE_ELEMENTAL_EVTC_PROFILE.fireball
    | typeof FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst
    | typeof EARTH_ELEMENTAL_EVTC_PROFILE.punch
    | typeof EARTH_ELEMENTAL_EVTC_PROFILE.enervatingPunch,
  name: string,
  impact: 'fireball' | 'flame-burst' | 'punch' | 'enervating-punch'
): void {
  const rate = actionRate(context, at);
  const elemental = professionCoreState(context).summonedElemental;
  const action = beginSummonAction(context, at, profile.skillId, name, profile.animationEnd / rate);
  if ('cooldown' in profile)
    elemental.secondaryAttackReadyAt = at + profile.animationEnd / rate + profile.cooldown / rechargeRate(context, at);
  scheduleImpact(context, at + profile.impact / rate, impact, action);
  elemental.busyUntil = at + profile.recovery / rate;
}

// --- Attack starters -------------------------------------------------------
// Each starter follows the same shape: read the EVTC-derived timing profile, scale
// offsets by the quickness action rate, emit the action, queue its impact(s), mark
// the elemental busy until the shared actor loop can select another attack.
// Fire player command (flip skill): three projectiles + a final explosion hit.
// Recovery is longer on the first-ever command vs subsequent ones (EVTC-observed).
function startFlameBarrage(context: ElementalistRuntime, at: number): void {
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBarrage;
  const rate = actionRate(context, at);
  const elemental = professionCoreState(context).summonedElemental;
  const postCommandRecovery =
    elemental.actionGeneration === 0
      ? FIRE_ELEMENTAL_EVTC_PROFILE.postCommandRecovery
      : FIRE_ELEMENTAL_EVTC_PROFILE.subsequentCommandRecovery;
  const action = beginSummonAction(context, at, profile.skillId, 'Flame Barrage', profile.animationEnd / rate);
  profile.projectileImpacts.forEach((offset, index) => {
    scheduleImpact(context, at + offset / rate, 'flame-barrage-projectile', action, index + 1);
  });
  scheduleImpact(context, at + profile.explosionImpact / rate, 'flame-barrage-explosion', action, 4, -19);
  const nextAt = at + profile.animationEnd / rate + postCommandRecovery;
  elemental.busyUntil = nextAt;
}

// Earth player command (flip skill): hit + Crippled/Immobilized + party Protection.
// Same first-vs-subsequent recovery split as Flame Barrage.
function startStomp(context: ElementalistRuntime, at: number): void {
  const profile = EARTH_ELEMENTAL_EVTC_PROFILE.stomp;
  const rate = actionRate(context, at);
  const elemental = professionCoreState(context).summonedElemental;
  const postCommandRecovery =
    elemental.actionGeneration === 0
      ? EARTH_ELEMENTAL_EVTC_PROFILE.postCommandRecovery
      : EARTH_ELEMENTAL_EVTC_PROFILE.subsequentCommandRecovery;
  const action = beginSummonAction(context, at, profile.skillId, 'Stomp', profile.animationEnd / rate);
  scheduleImpact(context, at + profile.impact / rate, 'stomp', action);
  const nextAt = at + profile.animationEnd / rate + postCommandRecovery;
  elemental.busyUntil = nextAt;
}

// Damage metadata marking an elemental strike as independent: it uses the profile's
// own base attributes (not inherited player stats or profession modifiers) and a
// fixed 5% crit / 150% crit damage, so its numbers are self-contained.
function summonStrikeMetadata(element: ElementalKind, summonGeneration: number, baseDamage: number) {
  const profile = elementalRuntimeProfile(element);
  return {
    independentSummonStrike: true,
    summonInheritsAttributes: false,
    summonUsesProfessionModifiers: false,
    summonBasePower: profile.basePower,
    summonBasePrecision: profile.basePrecision,
    summonBaseFerocity: profile.baseFerocity,
    summonCriticalChance: 0.05,
    summonCriticalDamage: 1.5,
    summonDamagePerCoefficient: baseDamage,
    summonOwner: elementalistElementalCompanionId(summonGeneration),
    skillWeapon: 'Unequipped'
  };
}

// The elite observes each valid strike before Core emits the autonomous or commanded hit.
function emitStrike(
  context: ElementalistRuntime,
  payload: ElementalImpactTaskPayload,
  skillId: number,
  skillName: string,
  baseDamage: number,
  hitIndex: number,
  totalHits: number,
  coefficient = 1,
  fields: {
    readonly summonUsesEquipmentModifiers?: boolean;
  } = {},
  emissionCast?: EffectDelivery['cast']
): void {
  const elemental = professionCoreState(context).summonedElemental;
  const element = elemental.element as ElementalKind;
  beforeElementalStrike(context, {
    summonGeneration: payload.summonGeneration,
    element,
    companionId: elementalistElementalCompanionId(payload.summonGeneration),
    activationId: payload.activationId,
    emissionCast
  });

  context.effects.emit(
    elementalistStrikeRequest(
      context,
      {
        activationId: payload.activationId,
        at: context.time,
        source: `${element} Elemental`,
        sourceId: skillId,
        actorType: 'summon',
        skillId,
        skillName,
        name: skillName,
        coefficient,
        hits: 1,
        hitIndex,
        totalHits,
        ...summonStrikeMetadata(element, payload.summonGeneration || 0, baseDamage),
        ...fields
      },
      emissionCast
    )
  );
}

// Elemental-applied conditions use player ownership so they benefit from player condition attributes.
function emitPlayerOwnedCondition(
  context: ElementalistRuntime,
  payload: ElementalImpactTaskPayload,
  skillId: number,
  skillName: string,
  condition: string,
  duration: number,
  stacks = 1,
  emissionCast?: EffectDelivery['cast']
): void {
  const elemental = professionCoreState(context).summonedElemental;
  context.effects.emit(
    elementalistConditionRequest(
      {
        activationId: payload.activationId,
        at: context.time,
        source: `${elemental.element} Elemental`,
        // Physical summon ownership remains explicit even though this condition uses the player's damage stats.
        summonOwner: elementalistElementalCompanionId(payload.summonGeneration || 0),
        skillId,
        skillName,
        name: `${skillName} — ${condition}`,
        condition,
        stacks,
        duration
      },
      emissionCast
    )
  );
}

// Flame Burst shares Might to the 5-player party.
function emitFlameBurstMight(
  context: ElementalistRuntime,
  payload: ElementalImpactTaskPayload,
  emissionCast?: EffectDelivery['cast']
): void {
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst;
  const sourceSkill = context.helpers.skillsById.get(ID.GLYPH_OF_ELEMENTALS);
  if (!sourceSkill) return;
  context.effects.emit(
    elementalistBuffRequest(
      {
        activationId: payload.activationId,
        at: context.time,
        source: 'Fire Elemental',
        sourceId: profile.skillId,
        actorType: 'player',
        skillId: profile.skillId,
        skillName: 'Flame Burst',
        name: 'Flame Burst — Might',
        kind: 'might',
        stacks: profile.mightStacks,
        duration: profile.mightDuration,
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      },
      emissionCast
    )
  );
}

// Stomp shares Protection to the 5-player party.
function emitStompProtection(
  context: ElementalistRuntime,
  payload: ElementalImpactTaskPayload,
  emissionCast?: EffectDelivery['cast']
): void {
  const profile = EARTH_ELEMENTAL_EVTC_PROFILE.stomp;
  const sourceSkill = context.helpers.skillsById.get(ID.GLYPH_OF_ELEMENTALS_EARTH);
  if (!sourceSkill) return;
  context.effects.emit(
    elementalistBuffRequest(
      {
        activationId: payload.activationId,
        at: context.time,
        source: 'Earth Elemental',
        sourceId: profile.skillId,
        actorType: 'player',
        skillId: profile.skillId,
        skillName: 'Stomp',
        name: 'Stomp — Protection',
        kind: 'protection',
        stacks: 1,
        duration: profile.protectionDuration,
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      },
      emissionCast
    )
  );
}

// IMPACT task handler: lands one hit. Bails if the summon expired/was replaced or the
// action was superseded, then dispatches per impact kind to emit strike + effects.
function handleElementalImpactTask(
  context: ElementalistRuntime,
  payload: ElementalImpactTaskPayload,
  emissionCast?: EffectDelivery['cast']
): void {
  const elemental = professionCoreState(context).summonedElemental;
  if (
    !activeElemental(context, payload.summonGeneration, context.time) ||
    payload.actionGeneration !== elemental.actionGeneration
  ) {
    return;
  }

  if (payload.impact === 'fireball') {
    const profile = FIRE_ELEMENTAL_EVTC_PROFILE.fireball;
    emitStrike(
      context,
      payload,
      profile.skillId,
      'Fireball',
      profile.baseDamage,
      1,
      1,
      undefined,
      undefined,
      emissionCast
    );
    return;
  }

  if (payload.impact === 'flame-burst') {
    const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst;
    emitStrike(
      context,
      payload,
      profile.skillId,
      'Flame Burst',
      profile.baseDamage,
      1,
      1,
      undefined,
      undefined,
      emissionCast
    );
    // Read the burn count from the profile so balance changes reach the emitted condition.
    emitPlayerOwnedCondition(
      context,
      payload,
      profile.skillId,
      'Flame Burst',
      'Burning',
      profile.burningDuration,
      profile.burningStacks,
      emissionCast
    );
    emitFlameBurstMight(context, payload, emissionCast);
    return;
  }

  if (payload.impact === 'flame-barrage-projectile') {
    // Each landed projectile supplies one player-owned burn
    const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBarrage;
    emitStrike(
      context,
      payload,
      profile.skillId,
      'Flame Barrage',
      profile.damagePerCoefficient,
      payload.hitIndex || 1,
      4,
      profile.projectileCoefficient,
      // The elemental's own Might scales Barrage; owner equipment still does not.
      { summonUsesEquipmentModifiers: false },
      emissionCast
    );
    emitPlayerOwnedCondition(
      context,
      payload,
      profile.skillId,
      'Flame Barrage',
      'Burning',
      profile.burningDuration,
      profile.burningStacks,
      emissionCast
    );
    return;
  }

  if (payload.impact === 'flame-barrage-explosion') {
    // Final 4th hit of Flame Barrage with its own explosion coefficient.
    const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBarrage;
    emitStrike(
      context,
      payload,
      profile.skillId,
      'Flame Barrage',
      profile.damagePerCoefficient,
      4,
      4,
      profile.explosionCoefficient,
      { summonUsesEquipmentModifiers: false },
      emissionCast
    );
    return;
  }

  if (payload.impact === 'punch') {
    const profile = EARTH_ELEMENTAL_EVTC_PROFILE.punch;
    emitStrike(
      context,
      payload,
      profile.skillId,
      'Punch',
      profile.baseDamage,
      1,
      1,
      undefined,
      undefined,
      emissionCast
    );
    return;
  }

  if (payload.impact === 'enervating-punch') {
    const profile = EARTH_ELEMENTAL_EVTC_PROFILE.enervatingPunch;
    emitStrike(
      context,
      payload,
      profile.skillId,
      'Enervating Punch',
      profile.baseDamage,
      1,
      1,
      undefined,
      undefined,
      emissionCast
    );
    emitPlayerOwnedCondition(
      context,
      payload,
      profile.skillId,
      'Enervating Punch',
      'Weakness',
      profile.weaknessDuration,
      undefined,
      emissionCast
    );
    return;
  }

  // All other impact variants returned above; the remaining command is Stomp.
  const profile = EARTH_ELEMENTAL_EVTC_PROFILE.stomp;
  emitStrike(context, payload, profile.skillId, 'Stomp', profile.baseDamage, 1, 1, undefined, undefined, emissionCast);
  emitPlayerOwnedCondition(
    context,
    payload,
    profile.skillId,
    'Stomp',
    'Crippled',
    profile.crippleDuration,
    undefined,
    emissionCast
  );
  emitPlayerOwnedCondition(
    context,
    payload,
    profile.skillId,
    'Stomp',
    'Immobilized',
    profile.immobilizeDuration,
    undefined,
    emissionCast
  );
  emitStompProtection(context, payload, emissionCast);
}

// Actor step: picks the next autonomous attack. Prefers the secondary attack
// (Flame Burst / Enervating Punch) whenever its cooldown is ready, else the auto.
// Player commands (Flame Barrage / Stomp) are driven by the rotation, not here.
// Ready-first Fire AI omits observed selection delays; replace when their eligibility rule is established.
function stepElemental(
  context: ElementalistRuntime,
  at: number,
  state: {
    summonGeneration: number;
  }
): {
  at: number;
  state: {
    summonGeneration: number;
  };
} | null {
  const elemental = professionCoreState(context).summonedElemental;
  if (
    !activeElemental(context, state.summonGeneration, at) ||
    // New attacks require a live window even though final queued impacts can still land.
    at >= elemental.activeUntil
  ) {
    return null;
  }

  if (elemental.element === 'Earth') {
    // Decisions compare the projected recharge to this canonical wake without early readiness.
    if (canonicalTime(elemental.secondaryAttackReadyAt) <= canonicalTime(at)) {
      startSingleImpactAttack(
        context,
        at,
        EARTH_ELEMENTAL_EVTC_PROFILE.enervatingPunch,
        'Enervating Punch',
        'enervating-punch'
      );
    } else {
      startSingleImpactAttack(context, at, EARTH_ELEMENTAL_EVTC_PROFILE.punch, 'Punch', 'punch');
    }
  } else if (canonicalTime(elemental.secondaryAttackReadyAt) <= canonicalTime(at)) {
    startSingleImpactAttack(context, at, FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst, 'Flame Burst', 'flame-burst');
  } else {
    startSingleImpactAttack(context, at, FIRE_ELEMENTAL_EVTC_PROFILE.fireball, 'Fireball', 'fireball');
  }

  return elemental.busyUntil < elemental.activeUntil ? { at: elemental.busyUntil, state } : null;
}

/** A command replaces only the next decision; impact tasks keep their action-generation checks. */
function scheduleElementalDecision(context: ElementalistRuntime, at: number): void {
  const generation = context.profession.core.summonedElemental.summonGeneration;
  const owner = { id: 'elementalist.elemental-decision', generation };
  context.cancelOwner(owner);
  context.schedule('elementalist.elemental-decision', at, generation, owner);
}

// Lifetime teardown: end of lifetime. Interrupts the in-flight action, clears all
// elemental state, removes the command flip, and puts the glyph on its post-expiry
// recharge so it can be re-summoned. Ignored if a newer summon already superseded it.
function expireElemental(
  context: ElementalistRuntime,
  at: number,
  captured: {
    summonGeneration: number;
  }
): void {
  const state = professionCoreState(context);
  const elemental = state.summonedElemental;
  if (captured.summonGeneration !== elemental.summonGeneration) return;
  const element = elemental.element;
  if (element !== 'Fire' && element !== 'Earth') return;
  context.cancelOwner({ id: 'elementalist.elemental-decision', generation: captured.summonGeneration });
  interruptCurrentAction(context, at);
  elemental.actionGeneration += 1;
  elemental.element = null;
  elemental.activeUntil = 0;
  elemental.busyUntil = 0;
  elemental.secondaryAttackReadyAt = 0;
  elemental.currentActivationId = null;
  retireElemental(context, captured.summonGeneration);
  elemental.started = false;
  consumeSkillFlip(
    state.availableFlips,
    element === 'Earth' ? ID.STOMP_ELEMENTAL_COMMAND : ID.FLAME_BARRAGE_ELEMENTAL_COMMAND
  );
  const glyph = glyphSkillForElement(context, element);
  if (glyph) {
    const summonedElementalProfile = requireBalanceProfileFromContext(context, PROFILE.summonedElemental);
    context.cooldownController.startRecharge(glyph, at, balanceProfileNumber(summonedElementalProfile, 'recharge'));
  }
}

// Kicks off the attack loop after the initial target-acquisition delay. Idempotent
// via the `started` flag so combat-start and cast paths don't double-start it.
function startElemental(context: ElementalistRuntime, at: number): void {
  const elemental = professionCoreState(context).summonedElemental;
  if (
    (elemental.element !== 'Fire' && elemental.element !== 'Earth') ||
    elemental.started ||
    elemental.activeUntil <= at
  ) {
    return;
  }

  elemental.started = true;
  const summonedElementalProfile = requireBalanceProfileFromContext(context, PROFILE.summonedElemental);
  const delay = balanceProfileNumber(summonedElementalProfile, 'initialDelay');
  scheduleElementalDecision(context, at + delay);
}

// Core spawn: cancels the previous elemental's tasks, resets summonedElemental state
// with a fresh summonGeneration, emits the expiry marker, arms its lifetime, and enables
// the command flip. Optionally starts the attack loop immediately.
function summonElemental(
  context: ElementalistRuntime,
  at: number,
  startImmediately: boolean,
  element: ElementalKind
): void {
  const state = professionCoreState(context);
  // Replacement ends the old action and flip together with its queued work.
  interruptCurrentAction(context, at);
  const previousElement = state.summonedElemental.element;
  if (previousElement === 'Fire' || previousElement === 'Earth')
    consumeSkillFlip(
      state.availableFlips,
      previousElement === 'Earth' ? ID.STOMP_ELEMENTAL_COMMAND : ID.FLAME_BARRAGE_ELEMENTAL_COMMAND
    );
  const previousGeneration = state.summonedElemental.summonGeneration;
  retireElemental(context, previousGeneration);
  context.cancelOwner({ id: 'elementalist.elemental-decision', generation: previousGeneration });
  context.cancelOwner({ id: ELEMENTAL_TASK_OWNER, generation: previousGeneration });
  const summonGeneration = state.summonedElemental.summonGeneration + 1;
  const summonedElementalProfile = requireBalanceProfileFromContext(context, PROFILE.summonedElemental);
  state.summonedElemental = {
    element,
    summonGeneration,
    actionGeneration: 0,
    activeUntil: canonicalTime(at + balanceProfileNumber(summonedElementalProfile, 'durationMultiplier')),
    busyUntil: at,
    secondaryAttackReadyAt: at,
    currentActivationId: null,
    started: false
  };
  const expiresAt = state.summonedElemental.activeUntil;
  context.schedule(
    'elementalist.elemental-expire',
    expiresAt,
    { summonGeneration },
    { id: ELEMENTAL_TASK_OWNER, generation: summonGeneration },
    50
  );
  armSkillFlip(
    state.availableFlips,
    element === 'Earth' ? ID.STOMP_ELEMENTAL_COMMAND : ID.FLAME_BARRAGE_ELEMENTAL_COMMAND,
    at,
    expiresAt
  );
  if (startImmediately) startElemental(context, at);
}

/**
 * Cast-complete hook: spawns the elemental at cast end. Its attack loop starts immediately
 * unless the rotation is still pre-combat and waiting on an explicit combat-start event.
 */
export function completeElementalistGlyphCast(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  const element = elementalForGlyph(skill);
  if (!element) return;
  summonElemental(context, cast.effectiveEnd, context.combatActive, element);
}

/**
 * Cast-complete hook for the player-commanded flip skills: pre-empts whatever the elemental
 * is doing and drives Flame Barrage / Stomp on the live companion.
 */
export function completeElementalistElementalCommand(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  if (skill.id === FLAME_BARRAGE_ID) {
    startFlameBarrage(context, cast.effectiveEnd);
  } else if (skill.id === STOMP_ID) {
    startStomp(context, cast.effectiveEnd);
  } else {
    return;
  }

  // A command replaces the pending decision, including target acquisition, with its own recovery deadline.
  const elemental = professionCoreState(context).summonedElemental;
  scheduleElementalDecision(context, elemental.busyUntil);
}

/** Generation zero permits one automatic opener; expiry never bypasses the glyph's recharge with another summon. */
export function ensureElementalistElemental(context: ElementalistRuntime, skill?: Skill): void {
  const selected = selectedElemental(context);
  if (
    selected &&
    context.profession.core.summonedElemental.summonGeneration === 0 &&
    (!skill || !elementalForGlyph(skill))
  ) {
    const glyph = glyphSkillForElement(context, selected);
    if (glyph) summonElemental(context, context.time, context.combatActive, selected);
  }

  if (context.combatActive) startElemental(context, context.time);
}

/**
 * Availability gate for this subsystem. Command flips (Flame Barrage / Stomp) are usable when
 * the matching elemental is active — or its automatic opener has not yet spawned; the glyphs themselves are
 * blocked (with a retry time) while their elemental lives. Returns null for unrelated skills.
 */
export function elementalistElementalAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill
): AvailabilityResult | null {
  const elemental = professionCoreState(context).summonedElemental;
  if (skill.id === FLAME_BARRAGE_ID) {
    const active = elemental.element === 'Fire' && elemental.activeUntil > context.time;
    return active || (elemental.summonGeneration === 0 && selectedElemental(context) === 'Fire')
      ? ready()
      : unavailable('an active Fire Elemental is required.');
  }

  if (skill.id === STOMP_ID) {
    const active = elemental.element === 'Earth' && elemental.activeUntil > context.time;
    return active || (elemental.summonGeneration === 0 && selectedElemental(context) === 'Earth')
      ? ready()
      : unavailable('an active Earth Elemental is required.');
  }

  if (!elementalForGlyph(skill)) return null;
  // Summon glyphs require an equipped slot before readiness or retry; command flips use the live elemental above.
  if (
    selectedSlotSkillAvailability({ config: context.config, catalog: context.helpers }, skill, {
      identity: elementalistLoadoutIdentity,
      omittedLoadout: 'deny'
    })
  ) {
    return denyCast('elementalist.not-equipped', 'the skill is not equipped.');
  }

  return elemental.activeUntil > context.time
    ? unavailable(`the ${elemental.element || 'summoned'} elemental is still active.`, elemental.activeUntil)
    : ready();
}

/**
 * Register shared autonomous/lifetime dispatch alongside the generation-checked impact handler.
 */
export const elementalistElementalTasks = {
  'elementalist.elemental-decision'(context: ElementalistRuntime, data: unknown): void {
    const generation = Number(data);
    const elemental = context.profession.core.summonedElemental;
    if (!activeElemental(context, generation, context.time)) return;
    if (canonicalTime(elemental.busyUntil) > context.time) {
      scheduleElementalDecision(context, elemental.busyUntil);
      return;
    }

    const next = stepElemental(context, context.time, { summonGeneration: generation });
    if (next) scheduleElementalDecision(context, next.at);
  },
  'elementalist.elemental-expire'(context: ElementalistRuntime, data: unknown): void {
    const captured = data as {
      summonGeneration: number;
    };
    if (captured.summonGeneration !== context.profession.core.summonedElemental.summonGeneration) return;
    const element = context.profession.core.summonedElemental.element;
    expireElemental(context, context.time, captured);
    context.effects.emit({
      kind: 'packet',
      event: {
        type: 'marker',
        at: context.time,
        source: 'Elementalist',
        sourceId: 'elementalist.elemental-expire',
        actorType: 'summon',
        name: element + ' Elemental expires'
      }
    });
  },
  [ELEMENTAL_IMPACT_TASK](context: ElementalistRuntime, data: unknown): void {
    handleElementalImpactTask(context, data as ElementalImpactTaskPayload, undefined);
  }
};
