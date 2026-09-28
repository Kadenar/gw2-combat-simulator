import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import { scaleCastBoundTiming } from '#gw2/platform/engine/effects/materializer.js';
import { STANDARD_TARGET_ARMOR } from '#gw2/platform/combat/formulas.js';
import { isEngineerMechCommand } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-ownership.js';
import { emitEngineerEvent } from '#gw2/professions/engineer/core/events.js';

import { shiftSignetPassive } from '#gw2/professions/engineer/specializations/mechanist/skills/signet-skills.js';
import { mechanistState } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { MECHANIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/mechanist/profiles.js';
import { MECHANIST_ATTACK_TIMING } from '#gw2/professions/engineer/specializations/mechanist/mechanics/constants.js';
import { GW2_QUICKNESS_ACTION_RATE } from '#gw2/platform/skills/timing.js';
import { weaponStrengthMidpoint, weaponStrengthProfile } from '#gw2/platform/equipment/weapons/strength.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { EngineerRuntime, EngineerResolverEvent, EngineerSkill } from '#gw2/professions/engineer/types.js';
export { isEngineerMechCommand } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-ownership.js';

// Mech strikes use the mech's native damage packet rather than the engineer's
// equipped weapon strength. The skill-specific native weapon profile is
// resolved separately from inherited mech attributes and live modifiers.
const MECH_REFERENCE_POWER = 1500;
const MECH_TYPE_1_PROFILE_ID = 'summon.weapon-type-1';
const MECH_TYPE_2_PROFILE_ID = 'summon.weapon-type-2';
const MECH_TYPE_3_PROFILE_ID = 'summon.weapon-type-3';
// The mech takes roughly one-third of a second after a command's activation
// ends before resuming its basic attack chain.
const MECH_BASIC_SKILL_IDS = new Set<SkillId>([
  ID.HARD_STRIKE,
  ID.HEAVY_SMASH_MECH,
  ID.TWIN_STRIKE_MECH,
  ID.JADE_ENERGY_SHOT,
  ID.JADE_ENERGY_SHOT_ID_63348,
  ID.ROCKET_PUNCH_MECH
]);

const MECH_WEAPON_PROFILE_BY_SKILL_ID: ReadonlyMap<SkillId, string> = new Map<SkillId, string>([
  [ID.JADE_ENERGY_SHOT, MECH_TYPE_1_PROFILE_ID],
  [ID.JADE_ENERGY_SHOT_ID_63348, MECH_TYPE_1_PROFILE_ID],
  [ID.CORE_REACTOR_SHOT, MECH_TYPE_1_PROFILE_ID],
  [ID.ROCKET_PUNCH_MECH, MECH_TYPE_1_PROFILE_ID],
  [ID.JADE_MORTAR, MECH_TYPE_2_PROFILE_ID],
  [ID.SPARK_REVOLVER, MECH_TYPE_2_PROFILE_ID],
  [ID.EXPLOSIVE_KNUCKLE, MECH_TYPE_2_PROFILE_ID],
  [ID.HARD_STRIKE, MECH_TYPE_2_PROFILE_ID],
  [ID.HEAVY_SMASH_MECH, MECH_TYPE_2_PROFILE_ID],
  [ID.TWIN_STRIKE_MECH, MECH_TYPE_2_PROFILE_ID],
  [ID.JADE_BUSTER_CANNON, MECH_TYPE_3_PROFILE_ID]
]);

/** Resolves the mech-native weapon profile and its damage-per-coefficient baseline. */
function mechWeaponScaling(skillId: SkillId | null | undefined): Readonly<{
  damagePerCoefficient: number;
  profileId: string;
}> {
  // Fall back to type-2 (melee) profile for any mech attack whose native
  // weapon profile has not yet been empirically measured.
  const profileId = (skillId == null ? null : MECH_WEAPON_PROFILE_BY_SKILL_ID.get(skillId)) || MECH_TYPE_2_PROFILE_ID;
  const midpoint = weaponStrengthMidpoint(weaponStrengthProfile(profileId));
  return {
    damagePerCoefficient: (midpoint * MECH_REFERENCE_POWER) / STANDARD_TARGET_ARMOR,
    profileId
  };
}

/** Native attacks and replay decoration share scaling fields without changing packet attribution or activation. */
function mechDamageMetadata(skillId: SkillId | null | undefined) {
  const scaling = mechWeaponScaling(skillId);
  return {
    independentSummonStrike: true,
    summonInheritsAttributes: true,
    summonUsesProfessionModifiers: true,
    summonBasePower: MECH_REFERENCE_POWER,
    summonDamagePerCoefficient: scaling.damagePerCoefficient,
    weaponStrengthProfileId: scaling.profileId
  };
}

interface MechAttackPayload {
  readonly phase: number;
}

/** Commands and basic attacks share the mech's direct or copied Quickness, evaluated at execution time. */
export function engineerMechHasQuickness(context: EngineerRuntime, at: number): boolean {
  return (
    createGw2TimelineIndex({ events: context.history }).buffStacksAt('quickness', at, 0, 1, 'summon', 'engineer.mech') >
      0 ||
    (Boolean(context.config.boons?.quickness) && shiftSignetPassive(context, at))
  );
}

function mechAttackRate(context: EngineerRuntime, at: number): number {
  return engineerMechHasQuickness(context, at) ? GW2_QUICKNESS_ACTION_RATE : 1;
}

/** The autonomous phase already reached impact; canonical ticks collapse onto that phase without changing replay timing. */
function emitMechAttack(context: EngineerRuntime, skillId: SkillId, at: number): void {
  const skill = context.helpers.skillsById.get(skillId)!;
  emitEffects(context, {
    owner: skill,
    at,
    effects: skill.effects?.map((effect) => scaleCastBoundTiming({ start: at, fullEnd: at }, skill, effect)),
    skillWeaponFallback: 'Unequipped',
    baseEvent: {
      source: 'engineer',
      sourceId: skillId,
      actorType: 'summon',
      skillId,
      skillName: skill.name,
      activationId: 'engineer.mech:' + skillId + ':' + at,
      metadata: { engineerMech: true }
    }
  });
}

/** Shift Signet copies only actual player applications, retaining their already-scaled duration. */
export function copyEngineerMechBoon(context: EngineerRuntime, event: EngineerResolverEvent): void {
  // Copy applications, not live player state: already-copied boons survive Shift going on cooldown.
  if (
    event.type === 'buff' &&
    isStandardBoon(event.kind) &&
    event.resolvedAudience?.includesSelf &&
    mechanistState.from(context).mech.active &&
    shiftSignetPassive(context, event.at)
  ) {
    emitEngineerEvent(context, 'buff', {
      at: event.at,
      source: 'engineer',
      sourceId: ID.SHIFT_SIGNET,
      actorType: 'player',
      name: `Shift Signet — ${event.kind}`,
      kind: String(event.kind),
      stacks: event.stacks || 1,
      duration: event.duration || 0,
      fixedDuration: true,
      audience: {
        recipients: 'summons',
        affectsSelf: false,
        maximumRecipients: 1,
        eligibleCompanionIds: ['engineer.mech']
      }
    });
  }
}

/** Capture the concrete mech owner before queued packets can outlive their originating activation. */
export function prepareEngineerMechEvent(context: EngineerRuntime, event: SimulationEventBase): SimulationEventBase {
  if (event.actorType !== 'summon') return event;
  // Infer ownership when replay packets lack the explicit engineerMech marker.
  const skill = context.helpers.skillsById.get(event.skillId ?? event.sourceId);
  const engineerMech =
    (event.metadata as Record<string, unknown> | undefined)?.engineerMech === true ||
    (event.skillId != null && MECH_BASIC_SKILL_IDS.has(event.skillId)) ||
    event.skillId === ID.JADE_BUSTER_CANNON ||
    isEngineerMechCommand(skill);
  if (!engineerMech) return event;

  const updates: Record<string, unknown> = {
    // All mech skills belong to the same concrete companion for shared condition rounding.
    summonOwner: 'engineer.mech',
    independentConditionOwner: true,
    metadata: { ...(event.metadata as object), engineerMech: true }
  };
  // Positive damage packets additionally need the native scaling metadata
  // consumed by summon damage resolution; other mech events need ownership only.
  if (event.type === 'damage' && Number(event.coefficient) > 0) {
    const basicAttack =
      event.mechBasicAttack === true || (event.skillId != null && MECH_BASIC_SKILL_IDS.has(event.skillId));
    Object.assign(updates, {
      ...mechDamageMetadata(event.skillId ?? event.sourceId),
      mechBasicAttack: basicAttack
    });
  }

  return { ...event, ...updates };
}

/** Emits the mech fighter trait's strike, burning, and defiance-damage packets as one activation. */
function emitRocketPunch(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  // The trait invokes the skill payload with a separate summon activation and native weapon roll.
  const punch = context.helpers.skillsById.get(ID.ROCKET_PUNCH_MECH)!;
  emitEffects(context, {
    owner: punch,
    at,
    skillWeaponFallback: 'Unequipped',
    baseEvent: {
      source: 'Trait',
      sourceId: TRAIT.MECH_FIGHTER,
      actorType: 'summon',
      skillId: punch.id,
      skillName: punch.name,
      activationId: 'engineer.rocket-punch:' + at,
      triggeredBy: skill.name,
      metadata: { engineerMech: true }
    }
  });
}

/** Applies post-cast mech lane recovery and Mechanist trait procs for the completed skill. */
export function applyEngineerMechCastTraits(context: EngineerRuntime, skill: EngineerSkill): void {
  if (context.config.specialization !== 'Mechanist') return;
  const state = mechanistState.from(context);
  const at = context.time;

  if (state.mech.active && isEngineerMechCommand(skill)) {
    // The command cast already reserves its measured animation on the mech lane;
    // only its recovery extends the pause before the basic attack chain resumes.
    const hasCommandAnimation = (skill.castTimeMs || 0) > 0;
    const busyUntil = at + (hasCommandAnimation ? MECHANIST_ATTACK_TIMING.commandRecovery : 0);
    state.mech.busyUntil = Math.max(state.mech.busyUntil || 0, busyUntil);
  }

  if (
    state.mech.active &&
    skill.type === 'Weapon' &&
    !skill.kit &&
    skill.slot === 'Weapon_3' &&
    context.procs.claim(PROFILE.rocketPunch, 'rocketPunch', at)
  ) {
    // The weapon trigger owns the interval even when Rocket Punch's optional strike is removed.
    emitRocketPunch(context, skill, at);
  }
}

/** Starts the autonomous mech attack loop when the specialization begins with an active mech. */
export function initializeEngineerMech(context: EngineerRuntime): void {
  const state = mechanistState.from(context);
  if (!state.mech.enabled || !state.mech.active) return;
  const firstAttackAt = context.time + MECHANIST_ATTACK_TIMING.initialDelay;
  context.schedule('engineer.mech-attack', firstAttackAt, { phase: 0 });
}

/** Executes one autonomous mech attack phase and schedules the next phase on the mech lane. */
export function stepMechAttack(
  context: EngineerRuntime,
  at: number,
  payload: MechAttackPayload
): { at: number; state: MechAttackPayload } | null {
  const state = mechanistState.from(context);
  if (!state.mech.enabled) return null;
  const rate = mechAttackRate(context, at);
  const phase = payload.phase || 0;
  // Jade Cannons replaces the melee chain with alternating arm shots and
  // distinct within-pair and between-pair delays.
  if (hasTrait(context.config, TRAIT.MECH_ARMS_JADE_CANNONS)) {
    const firstArm = phase === 0;
    emitMechAttack(context, firstArm ? ID.JADE_ENERGY_SHOT : ID.JADE_ENERGY_SHOT_ID_63348, at);

    const nextAt =
      at + (firstArm ? MECHANIST_ATTACK_TIMING.jadeCannonArmGap : MECHANIST_ATTACK_TIMING.jadeCannonCycleGap) / rate;
    return { at: nextAt, state: { phase: firstArm ? 1 : 0 } };
  }

  // The default chassis advances through its three-hit melee chain, wrapping
  // back to Hard Strike after Twin Strike.
  const skillId = [ID.HARD_STRIKE, ID.HEAVY_SMASH_MECH, ID.TWIN_STRIKE_MECH][phase];
  emitMechAttack(context, skillId, at);

  const nextAt = at + MECHANIST_ATTACK_TIMING.meleeChainIntervals[phase] / rate;
  return { at: nextAt, state: { phase: (phase + 1) % 3 } };
}

/** Reserves the mech lane and emits Overclock Signet's timed Jade Buster Cannon burst. */
export function activateOverclockSignet(context: EngineerRuntime, skill: EngineerSkill): void {
  const state = mechanistState.from(context);
  if (!state.mech.active) return;
  const at = context.time;
  const rate = mechAttackRate(context, at);
  const cannon = context.helpers.skillsById.get(ID.JADE_BUSTER_CANNON)!;
  const fullEnd = at + Number(cannon.castTimeMs) / 1000 / rate;
  // The lane reservation survives effect removal; cadence and payload both come from the canonical cannon.
  state.mech.busyUntil = Math.max(state.mech.busyUntil || 0, fullEnd);
  emitEffects(context, {
    owner: cannon,
    at,
    fullEnd,
    skillWeaponFallback: 'Unequipped',
    effects: cannon.effects?.map((effect) => scaleCastBoundTiming({ start: at, fullEnd }, cannon, effect)),
    baseEvent: {
      source: 'engineer',
      sourceId: cannon.id,
      actorType: 'summon',
      skillId: cannon.id,
      skillName: cannon.name,
      activationId: 'engineer.jade-buster:' + at,
      triggeredBy: skill.name,
      metadata: { engineerMech: true }
    }
  });
}
