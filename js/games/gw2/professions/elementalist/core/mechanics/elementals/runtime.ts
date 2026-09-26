import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { consumeSkillFlip, armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { canonicalTime, EPSILON } from '#kernel/core/clock.js';
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
 * Auto-summon: when enabled and a glyph is slotted, the elemental is re-summoned on
 * combat start (or first offensive event) without an explicit cast in the rotation.
 */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import {
  emitElementalistBuff,
  emitElementalistCondition,
  emitElementalistDamage
} from '#gw2/professions/elementalist/core/events.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { GW2_ALACRITY_RECHARGE_RATE } from '#gw2/platform/engine/skills/recharge.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { denyCast, retryCast } from '#gw2/platform/engine/skills/availability.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { isSelectedSlotSkill } from '#gw2/professions/elementalist/core/mechanics/weapon-state.js';
import {
  EARTH_ELEMENTAL_EVTC_PROFILE,
  ELEMENTAL_LIGHTNING_JOLT_PROFILE,
  FIRE_ELEMENTAL_EVTC_PROFILE
} from '#gw2/professions/elementalist/core/mechanics/elementals/profiles.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import {
  elementalCommandName,
  elementalForGlyphId,
  elementalRuntimeProfile,
  FLAME_BARRAGE_ID,
  selectedElementalFromSkills,
  STOMP_ID,
  type ElementalImpact,
  type ElementalKind
} from '#gw2/professions/elementalist/core/mechanics/elementals/attacks.js';

export {
  EARTH_ELEMENTAL_EVTC_PROFILE,
  FIRE_ELEMENTAL_EVTC_PROFILE
} from '#gw2/professions/elementalist/core/mechanics/elementals/profiles.js';

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

export { FLAME_BARRAGE_ID, STOMP_ID } from '#gw2/professions/elementalist/core/mechanics/elementals/attacks.js';

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
function selectedElemental(context: ElementalistRuntime): ElementalKind | null {
  return selectedElementalFromSkills(selectedSkillNameSet(context.config.selectedSkills));
}

// Auto-summon the selected glyph's elemental unless explicitly disabled.
function automaticSummoningEnabled(context: ElementalistRuntime): boolean {
  return context.config.autoSummonElemental !== false;
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

// The player-commanded flip skill name for an element (used to tag events as
// player-commanded vs autonomous and to resolve the authored command ID).
function commandName(element: ElementalKind): 'Flame Barrage' | 'Stomp' {
  return elementalCommandName(element);
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

// Quickness speeds up the elemental's animations 50% (divides all timing offsets).
function actionRate(context: ElementalistRuntime, at: number): number {
  return elementalBoonActive(context, 'quickness', at) ? 1.5 : 1;
}

/** Summons read only applications addressed to their current companion identity. */
function elementalBoonActive(context: ElementalistRuntime, kind: string, at: number): boolean {
  return (
    buffApplicationStacks(context.boons.get(kind) ?? [], kind, at, 1, {
      audience: 'summon',
      companionId: elementalistElementalCompanionId(context.profession.core.summonedElemental.summonGeneration)
    }) > 0
  );
}

/** Report interruption at its actual boundary; pending hits are invalidated by the action generation. */
function interruptCurrentAction(context: ElementalistRuntime, at: number): void {
  const elemental = context.profession.core.summonedElemental;
  const action = context.history.find(
    (event) => event.type === 'action' && event.activationId === elemental.currentActivationId
  );
  if (action && Number(action.fullEndsAt || action.endsAt || 0) > at)
    Object.assign(action, { endsAt: at, interrupted: true, interruptedAt: at });
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
): Readonly<{ actionGeneration: number; activationId: string }> {
  const elemental = professionCoreState(context).summonedElemental;
  const element = elemental.element as ElementalKind;
  const playerCommanded = skillName === commandName(element);
  interruptCurrentAction(context, at);
  elemental.actionGeneration += 1;
  // A commanded opener already owns the AI loop; combat start must not replace its pending impacts.
  elemental.started = true;
  const activationId = `elementalist:${elemental.summonGeneration}:${elemental.actionGeneration}`;
  elemental.currentActivationId = activationId;
  context.emit({
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
    summonOwner: elementalistElementalCompanionId(elemental.summonGeneration),
    autonomousElementalSkill: !playerCommanded,
    playerCommandedElementalSkill: playerCommanded
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
  action: Readonly<{ actionGeneration: number; activationId: string }>,
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

// --- Attack starters -------------------------------------------------------
// Each starter follows the same shape: read the EVTC-derived timing profile, scale
// offsets by the quickness action rate, emit the action, queue its impact(s), mark
// the elemental busy until the shared actor loop can select another attack.

// Fire auto-attack: single projectile hit.
function startFireball(context: ElementalistRuntime, at: number): void {
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.fireball;
  const rate = actionRate(context, at);
  const action = beginSummonAction(context, at, profile.skillId, 'Fireball', profile.animationEnd / rate);
  scheduleImpact(context, at + profile.impact / rate, 'fireball', action);
  const nextAt = at + profile.recovery / rate;
  professionCoreState(context).summonedElemental.busyUntil = nextAt;
}

// Fire secondary: hit + party Might; sets its own cooldown (alacrity-scaled) before
// it can be chosen again over the Fireball auto.
function startFlameBurst(context: ElementalistRuntime, at: number): void {
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst;
  const rate = actionRate(context, at);
  const elemental = professionCoreState(context).summonedElemental;
  const action = beginSummonAction(context, at, profile.skillId, 'Flame Burst', profile.animationEnd / rate);
  elemental.secondaryAttackReadyAt = at + profile.animationEnd / rate + profile.cooldown / GW2_ALACRITY_RECHARGE_RATE;
  scheduleImpact(context, at + profile.impact / rate, 'flame-burst', action);
  const nextAt = at + profile.recovery / rate;
  elemental.busyUntil = nextAt;
}

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

// Earth auto-attack: single melee hit.
function startPunch(context: ElementalistRuntime, at: number): void {
  const profile = EARTH_ELEMENTAL_EVTC_PROFILE.punch;
  const rate = actionRate(context, at);
  const action = beginSummonAction(context, at, profile.skillId, 'Punch', profile.animationEnd / rate);
  scheduleImpact(context, at + profile.impact / rate, 'punch', action);
  const nextAt = at + profile.recovery / rate;
  professionCoreState(context).summonedElemental.busyUntil = nextAt;
}

// Earth secondary: hit + Weakness; cooldown-gated (alacrity-scaled) like Flame Burst.
function startEnervatingPunch(context: ElementalistRuntime, at: number): void {
  const profile = EARTH_ELEMENTAL_EVTC_PROFILE.enervatingPunch;
  const rate = actionRate(context, at);
  const elemental = professionCoreState(context).summonedElemental;
  const action = beginSummonAction(context, at, profile.skillId, 'Enervating Punch', profile.animationEnd / rate);
  elemental.secondaryAttackReadyAt = at + profile.animationEnd / rate + profile.cooldown / GW2_ALACRITY_RECHARGE_RATE;
  scheduleImpact(context, at + profile.impact / rate, 'enervating-punch', action);
  const nextAt = at + profile.recovery / rate;
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

// Emits one damage event for a strike. If a Lightning Jolt copy is armed (see
// armElementalistElementalLightningJolt), it fires first as a one-shot bonus hit and
// is consumed. The main strike is tagged autonomous vs player-commanded by name.
function emitStrike(
  context: ElementalistRuntime,
  payload: ElementalImpactTaskPayload,
  skillId: number,
  skillName: string,
  baseDamage: number,
  hitIndex: number,
  totalHits: number,
  coefficient = 1,
  fields: { readonly summonUsesEquipmentModifiers?: boolean } = {}
): void {
  const elemental = professionCoreState(context).summonedElemental;
  const element = elemental.element as ElementalKind;
  const pendingLightningJolt = elemental.pendingLightningJolt;
  if (pendingLightningJolt) {
    // Lightning Jolt is an allied one-shot charge, so the elemental consumes its copy on its next strike.
    elemental.pendingLightningJolt = null;
    emitElementalistDamage(context, {
      activationId: `${payload.activationId}:lightning-jolt`,
      at: context.time,
      source: `${element} Elemental`,
      sourceId: pendingLightningJolt.skillId,
      actorType: 'summon',
      skillId: pendingLightningJolt.skillId,
      skillName: 'Lightning Jolt',
      name: 'Lightning Jolt',
      coefficient: pendingLightningJolt.coefficient,
      hits: 1,
      noCrit: true,
      skillWeapon: 'Unequipped',
      weaponStrengthProfileId: ELEMENTAL_LIGHTNING_JOLT_PROFILE.weaponStrengthProfileId,
      independentSummonStrike: true,
      summonInheritsAttributes: false,
      summonBasePower: ELEMENTAL_LIGHTNING_JOLT_PROFILE.basePower,
      summonBasePrecision: 1000,
      summonBaseFerocity: 0,
      summonUsesMight: false,
      summonUsesEquipmentModifiers: false,
      summonUsesProfessionModifiers: false,
      summonOwner: elementalistElementalCompanionId(Number(payload.summonGeneration || 0))
    });
  }

  emitElementalistDamage(context, {
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
    autonomousElementalSkill: skillName !== commandName(element),
    playerCommandedElementalSkill: skillName === commandName(element),
    ...summonStrikeMetadata(element, Number(payload.summonGeneration || 0), baseDamage),
    ...fields
  });
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
  emitElementalistCondition(context, {
    activationId: payload.activationId,
    at: context.time,
    source: `${elemental.element} Elemental`,
    skillId,
    skillName,
    name: `${skillName} — ${condition}`,
    condition,
    stacks,
    duration
  });
}

// Flame Burst shares Might to the 5-player party.
function emitFlameBurstMight(context: ElementalistRuntime, payload: ElementalImpactTaskPayload): void {
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst;
  const sourceSkill = context.helpers.skillsById.get(ID.GLYPH_OF_ELEMENTALS);
  if (!sourceSkill) return;
  emitElementalistBuff(context, {
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
  });
}

// Stomp shares Protection to the 5-player party.
function emitStompProtection(context: ElementalistRuntime, payload: ElementalImpactTaskPayload): void {
  const profile = EARTH_ELEMENTAL_EVTC_PROFILE.stomp;
  const sourceSkill = context.helpers.skillsById.get(ID.GLYPH_OF_ELEMENTALS_EARTH);
  if (!sourceSkill) return;
  emitElementalistBuff(context, {
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
  });
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
    emitPlayerOwnedCondition(context, payload, profile.skillId, 'Flame Burst', 'Burning', profile.burningDuration);
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
      Number(payload.hitIndex || 1),
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

  if (payload.impact === 'stomp') {
    const profile = EARTH_ELEMENTAL_EVTC_PROFILE.stomp;
    emitStrike(context, payload, profile.skillId, 'Stomp', profile.baseDamage, 1, 1);
    emitPlayerOwnedCondition(context, payload, profile.skillId, 'Stomp', 'Crippled', profile.crippleDuration);
    emitPlayerOwnedCondition(context, payload, profile.skillId, 'Stomp', 'Immobilized', profile.immobilizeDuration);
    emitStompProtection(context, payload);
  }
}

// Actor step: picks the next autonomous attack. Prefers the secondary attack
// (Flame Burst / Enervating Punch) whenever its cooldown is ready, else the auto.
// Player commands (Flame Barrage / Stomp) are driven by the rotation, not here.
// Ready-first Fire AI omits observed selection delays; replace when their eligibility rule is established.
function stepElemental(
  context: ElementalistRuntime,
  at: number,
  state: { summonGeneration: number }
): { at: number; state: { summonGeneration: number } } | null {
  const elemental = professionCoreState(context).summonedElemental;
  if (
    !activeElemental(context, state.summonGeneration, at) ||
    // New attacks require a live window even though final queued impacts can still land.
    at >= elemental.activeUntil
  ) {
    return null;
  }

  if (elemental.element === 'Earth') {
    if (elemental.secondaryAttackReadyAt <= at + EPSILON) {
      startEnervatingPunch(context, at);
    } else {
      startPunch(context, at);
    }
  } else if (elemental.secondaryAttackReadyAt <= at + EPSILON) {
    startFlameBurst(context, at);
  } else {
    startFireball(context, at);
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
function expireElemental(context: ElementalistRuntime, at: number, captured: { summonGeneration: number }): void {
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
  elemental.pendingLightningJolt = null;
  elemental.started = false;
  consumeSkillFlip(state.availableFlips, context.helpers.skillsByName.get(commandName(element))!.id);
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
  _skill: Skill,
  at: number,
  startImmediately: boolean,
  element: ElementalKind
): void {
  const state = professionCoreState(context);

  // Replacement ends the old action and flip together with its queued work.
  interruptCurrentAction(context, at);
  const previousElement = state.summonedElemental.element;
  if (previousElement === 'Fire' || previousElement === 'Earth')
    consumeSkillFlip(state.availableFlips, context.helpers.skillsByName.get(commandName(previousElement))!.id);
  const previousGeneration = state.summonedElemental.summonGeneration;
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
    pendingLightningJolt: null,
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
  armSkillFlip(state.availableFlips, context.helpers.skillsByName.get(commandName(element))!.id, at, expiresAt);
  if (startImmediately) startElemental(context, at);
}

/**
 * Cast-complete hook: spawns the elemental at cast end. Its attack loop starts immediately
 * unless the rotation is still pre-combat and waiting on an explicit combat-start event.
 */
export function completeElementalistGlyphCast(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  const element = elementalForGlyph(skill);
  if (!element) return;
  summonElemental(context, skill, cast.effectiveEnd, context.combatActive, element);
}

/**
 * Cast-complete hook for the player-commanded flip skills: pre-empts whatever the elemental
 * is doing and drives Flame Barrage / Stomp on the live companion.
 */
export function completeElementalistElementalCommand(
  context: ElementalistRuntime,
  cast: RuntimeCast,
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

/**
 * Arms one Lightning Jolt copy on the live elemental. The charge rides the elemental's next
 * strike as a bonus hit and is consumed there (see emitStrike); ignored with no elemental out.
 */
export function armElementalistElementalLightningJolt(
  context: ElementalistRuntime,
  cast: RuntimeCast,
  skillId: number,
  coefficient: number
): void {
  const elemental = professionCoreState(context).summonedElemental;
  if ((elemental.element === 'Fire' || elemental.element === 'Earth') && elemental.activeUntil > cast.effectiveEnd) {
    // Only represented allied actors are armed; unmodeled party members cannot contribute synthetic damage.
    elemental.pendingLightningJolt = { coefficient, skillId };
  }
}

/** A slotted automatic companion exists for the opener, then begins attacking at combat start. */
export function ensureElementalistElemental(context: ElementalistRuntime, skill?: Skill): void {
  const selected = selectedElemental(context);
  if (
    selected &&
    automaticSummoningEnabled(context) &&
    context.profession.core.summonedElemental.activeUntil <= context.time &&
    (!skill || !elementalForGlyph(skill))
  ) {
    const glyph = glyphSkillForElement(context, selected);
    if (glyph) summonElemental(context, glyph, context.time, context.combatActive, selected);
  }

  if (context.combatActive) startElemental(context, context.time);
}

/**
 * Availability gate for this subsystem. Command flips (Flame Barrage / Stomp) are usable when
 * the matching elemental is active — or would be auto-summoned; the glyphs themselves are
 * blocked (with a retry time) while their elemental lives. Returns null for unrelated skills.
 */
export function elementalistElementalAvailability(
  context: ElementalistRuntime,
  skill: Skill
): AvailabilityResult | null {
  const elemental = professionCoreState(context).summonedElemental;
  if (skill.id === FLAME_BARRAGE_ID) {
    const active = elemental.element === 'Fire' && elemental.activeUntil > context.time;
    return active ||
      (elemental.activeUntil <= context.time &&
        automaticSummoningEnabled(context as unknown as ElementalistRuntime) &&
        selectedElemental(context as unknown as ElementalistRuntime) === 'Fire')
      ? ready()
      : unavailable('an active Fire Elemental is required.');
  }

  if (skill.id === STOMP_ID) {
    const active = elemental.element === 'Earth' && elemental.activeUntil > context.time;
    return active ||
      (elemental.activeUntil <= context.time &&
        automaticSummoningEnabled(context as unknown as ElementalistRuntime) &&
        selectedElemental(context as unknown as ElementalistRuntime) === 'Earth')
      ? ready()
      : unavailable('an active Earth Elemental is required.');
  }

  if (!elementalForGlyph(skill)) return null;
  // Summon glyphs require an equipped slot before readiness or retry; command flips use the live elemental above.
  if (!isSelectedSlotSkill(skill, selectedSkillNameSet(context.config.selectedSkills))) {
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
    const captured = data as { summonGeneration: number };
    if (captured.summonGeneration !== context.profession.core.summonedElemental.summonGeneration) return;
    const element = context.profession.core.summonedElemental.element;
    expireElemental(context, context.time, captured);
    context.emit({
      type: 'marker',
      at: context.time,
      source: 'Elementalist',
      sourceId: 'elementalist.elemental-expire',
      actorType: 'summon',
      name: element + ' Elemental expires'
    });
  },
  [ELEMENTAL_IMPACT_TASK](context: ElementalistRuntime, data: unknown): void {
    handleElementalImpactTask(context, data as ElementalImpactTaskPayload);
  }
};
