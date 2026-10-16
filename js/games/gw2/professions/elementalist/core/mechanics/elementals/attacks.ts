import { GW2_ALACRITY_RECHARGE_RATE } from '#gw2/platform/combat/recharge.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  elementalistBuffRequest,
  elementalistConditionRequest,
  elementalistStrikeRequest
} from '#gw2/professions/elementalist/core/events.js';
import {
  beforeElementalStrike,
  ELEMENTAL_TASK_OWNER
} from '#gw2/professions/elementalist/core/mechanics/elementals/lifecycle.js';
import {
  EARTH_ELEMENTAL_EVTC_PROFILE,
  FIRE_ELEMENTAL_EVTC_PROFILE
} from '#gw2/professions/elementalist/core/mechanics/elementals/profiles.js';
import {
  elementalRuntimeProfile,
  type ElementalKind,
  activeElemental,
  elementalistElementalCompanionId
} from '#gw2/professions/elementalist/core/mechanics/elementals/queries.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Attack execution owns action generations, impact scheduling, and each attack payload. */
type ElementalImpact =
  | 'fireball'
  | 'flame-burst'
  | 'flame-barrage-projectile'
  | 'flame-barrage-explosion'
  | 'punch'
  | 'enervating-punch'
  | 'stomp';

// Impact packets retain both generations so replacing an actor or action invalidates its pending hits.
interface ElementalImpactTaskPayload {
  readonly summonGeneration: number;
  readonly actionGeneration: number;
  readonly activationId: string;
  readonly impact: ElementalImpact;
  readonly hitIndex: number;
}

const ELEMENTAL_IMPACT_TASK = 'elementalist.elemental-impact';

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
export function interruptCurrentAction(context: ElementalistRuntime, at: number): void {
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
export function startSingleImpactAttack(
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
export function startFlameBarrage(context: ElementalistRuntime, at: number): void {
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
export function startStomp(context: ElementalistRuntime, at: number): void {
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
  } = {}
): void {
  const elemental = professionCoreState(context).summonedElemental;
  const element = elemental.element as ElementalKind;
  beforeElementalStrike(context, {
    summonGeneration: payload.summonGeneration,
    element,
    companionId: elementalistElementalCompanionId(payload.summonGeneration),
    activationId: payload.activationId
  });

  context.effects.emit(
    elementalistStrikeRequest(context, {
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
    })
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
  stacks = 1
): void {
  const elemental = professionCoreState(context).summonedElemental;
  context.effects.emit(
    elementalistConditionRequest({
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
    })
  );
}

// Flame Burst shares Might to the 5-player party.
function emitFlameBurstMight(context: ElementalistRuntime, payload: ElementalImpactTaskPayload): void {
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst;
  const sourceSkill = context.helpers.skillsById.get(ID.GLYPH_OF_ELEMENTALS);

  if (!sourceSkill) return;

  context.effects.emit(
    elementalistBuffRequest({
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
    })
  );
}

// Stomp shares Protection to the 5-player party.
function emitStompProtection(context: ElementalistRuntime, payload: ElementalImpactTaskPayload): void {
  const profile = EARTH_ELEMENTAL_EVTC_PROFILE.stomp;
  const sourceSkill = context.helpers.skillsById.get(ID.GLYPH_OF_ELEMENTALS_EARTH);

  if (!sourceSkill) return;

  context.effects.emit(
    elementalistBuffRequest({
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
    })
  );
}

// IMPACT task handler: lands one hit. Bails if the summon expired/was replaced or the
// action was superseded, then dispatches per impact kind to emit strike + effects.
function handleElementalImpactTask(context: ElementalistRuntime, payload: ElementalImpactTaskPayload): void {
  const elemental = professionCoreState(context).summonedElemental;

  if (
    !activeElemental(context, payload.summonGeneration, context.time) ||
    payload.actionGeneration !== elemental.actionGeneration
  ) {
    return;
  }

  if (payload.impact === 'fireball') {
    const profile = FIRE_ELEMENTAL_EVTC_PROFILE.fireball;
    emitStrike(context, payload, profile.skillId, 'Fireball', profile.baseDamage, 1, 1);
    return;
  }

  if (payload.impact === 'flame-burst') {
    const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst;
    emitStrike(context, payload, profile.skillId, 'Flame Burst', profile.baseDamage, 1, 1);
    // Read the burn count from the profile so balance changes reach the emitted condition.
    emitPlayerOwnedCondition(
      context,
      payload,
      profile.skillId,
      'Flame Burst',
      'Burning',
      profile.burningDuration,
      profile.burningStacks
    );
    emitFlameBurstMight(context, payload);
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
      { summonUsesEquipmentModifiers: false }
    );
    emitPlayerOwnedCondition(
      context,
      payload,
      profile.skillId,
      'Flame Barrage',
      'Burning',
      profile.burningDuration,
      profile.burningStacks
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
      { summonUsesEquipmentModifiers: false }
    );
    return;
  }

  if (payload.impact === 'punch') {
    const profile = EARTH_ELEMENTAL_EVTC_PROFILE.punch;
    emitStrike(context, payload, profile.skillId, 'Punch', profile.baseDamage, 1, 1);
    return;
  }

  if (payload.impact === 'enervating-punch') {
    const profile = EARTH_ELEMENTAL_EVTC_PROFILE.enervatingPunch;
    emitStrike(context, payload, profile.skillId, 'Enervating Punch', profile.baseDamage, 1, 1);
    emitPlayerOwnedCondition(
      context,
      payload,
      profile.skillId,
      'Enervating Punch',
      'Weakness',
      profile.weaknessDuration
    );
    return;
  }

  // All other impact variants returned above; the remaining command is Stomp.
  const profile = EARTH_ELEMENTAL_EVTC_PROFILE.stomp;
  emitStrike(context, payload, profile.skillId, 'Stomp', profile.baseDamage, 1, 1);
  emitPlayerOwnedCondition(context, payload, profile.skillId, 'Stomp', 'Crippled', profile.crippleDuration);
  emitPlayerOwnedCondition(context, payload, profile.skillId, 'Stomp', 'Immobilized', profile.immobilizeDuration);
  emitStompProtection(context, payload);
}

/** Impact dispatch stays with attack execution so action and summon generations are checked before emission. */
export const elementalistElementalAttackTasks = {
  [ELEMENTAL_IMPACT_TASK](context: ElementalistRuntime, data: unknown): void {
    handleElementalImpactTask(context, data as ElementalImpactTaskPayload);
  }
};
