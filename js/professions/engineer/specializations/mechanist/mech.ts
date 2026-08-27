import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '../../../../platform/gw2/scheduler/skill-events.js';
import { emitStateSnapshot } from '../../../../platform/engine/events/state-snapshots.js';
import { isInternalCooldownReady } from '../../../../platform/engine/core/clock.js';
import { mechanistState } from './state.js';
import { snapshotEngineerState } from '../../state.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { engineerBalanceEffectValue, engineerBalanceValue } from '../../core/profiles.js';
import { MECHANIST_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { MECHANIST_ATTACK_TIMING } from './mechanics.js';
import { weaponStrengthMidpoint, weaponStrengthProfile } from '../../../../platform/gw2/equipment/weapons/strength.js';
import { gw2SchedulerBoonDuration } from '../../../../platform/gw2/scheduler/policy.js';
import type { SchedulerRecord, SkillId } from '../../../../platform/engine/types.js';
import type {
  EngineerCastContext,
  EngineerConfig,
  EngineerScheduledTask,
  EngineerSchedulerContext,
  EngineerSimulationEvent,
  EngineerSkill
} from '../../types.js';

// Mech strikes use the mech's native damage packet rather than the engineer's
// equipped weapon strength. The skill-specific native weapon profile is
// resolved separately from inherited mech attributes and live modifiers.
const MECH_REFERENCE_POWER = 1500;
const STANDARD_TARGET_ARMOR = 2597;
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

function mechWeaponScaling(
  context: EngineerSchedulerContext | EngineerCastContext,
  skillId: SkillId | null | undefined
): Readonly<{
  damagePerCoefficient: number;
  profileId: string;
}> {
  // Fall back to type-2 (melee) profile for any mech attack whose native
  // weapon profile has not yet been empirically measured.
  const profileId = (skillId == null ? null : MECH_WEAPON_PROFILE_BY_SKILL_ID.get(skillId)) || MECH_TYPE_2_PROFILE_ID;
  const midpoint = weaponStrengthMidpoint(weaponStrengthProfile(profileId));
  return {
    damagePerCoefficient:
      (midpoint * engineerBalanceValue(context, PROFILE.attackTiming, 'basePower', MECH_REFERENCE_POWER)) /
      engineerBalanceValue(context, PROFILE.attackTiming, 'weaponStrength', STANDARD_TARGET_ARMOR),
    profileId
  };
}

interface MechAttackPayload extends SchedulerRecord {
  readonly phase: number;
}

interface MechStrikeOptions {
  readonly at: number;
  readonly coefficient: number;
  readonly hits?: number;
  readonly name: string;
  readonly skillId: SkillId;
  readonly hitIndex?: number;
  readonly totalHits?: number;
  readonly basicAttack?: boolean;
}

function selectedSkillNames(config: EngineerConfig = {}): Set<string> {
  const selected = config.selectedSkills || [];
  return new Set((Array.isArray(selected) ? selected : Object.values(selected)).map(String));
}

// Shift Signet passively applies quickness to the mech, speeding its attacks by
// the standard 1.5× quickness multiplier only when the player also has quickness.
function mechAttackRate(context: EngineerSchedulerContext): number {
  return context.config.boons?.quickness && selectedSkillNames(context.config).has('Shift Signet')
    ? engineerBalanceValue(context, PROFILE.attackTiming, 'quicknessCastMultiplier', 1.5)
    : 1;
}

function emitMechStrike(
  context: EngineerSchedulerContext,
  { at, coefficient, hits = 1, name, skillId, hitIndex = 1, totalHits = hits, basicAttack = true }: MechStrikeOptions
): void {
  const scaling = mechWeaponScaling(context, skillId);
  emitSkillDamage(context, {
    at,
    source: 'engineer',
    sourceId: skillId,
    actorType: 'summon',
    skillId,
    skillName: name,
    name,
    coefficient,
    hits,
    hitIndex,
    totalHits,
    skillWeapon: 'Unequipped',
    independentSummonStrike: true,
    summonInheritsAttributes: true,
    summonUsesProfessionModifiers: true,
    summonBasePower: engineerBalanceValue(context, PROFILE.attackTiming, 'basePower', MECH_REFERENCE_POWER),
    summonDamagePerCoefficient: scaling.damagePerCoefficient,
    weaponStrengthProfileId: scaling.profileId,
    engineerMech: true,
    mechBasicAttack: basicAttack
  });
}

// Stamps mech-specific weapon scaling onto events that arrive from EVTC logs
// without it. EVTC replays produce raw damage packets with no summon metadata,
// so this hook retroactively annotates them before downstream rules run.
export function observeEngineerMechEvent(context: EngineerSchedulerContext, event: EngineerSimulationEvent): void {
  if (context.config.specialization !== 'Mechanist' || event.actorType !== 'summon') return;
  const skill = context.catalog?.skillsById?.get(event.skillId ?? event.sourceId);
  const slot = Number(skill?.mechanicSlot || 0);
  const engineerMech =
    event.engineerMech === true ||
    (event.skillId != null && MECH_BASIC_SKILL_IDS.has(event.skillId)) ||
    event.skillId === ID.JADE_BUSTER_CANNON ||
    (slot >= 1 && slot <= 3);

  if (!engineerMech) return;

  const updates = { engineerMech: true };

  if (event.type === 'damage' && Number(event.coefficient) > 0) {
    const basicAttack =
      event.mechBasicAttack === true || (event.skillId != null && MECH_BASIC_SKILL_IDS.has(event.skillId));
    const scaling = mechWeaponScaling(context, event.skillId ?? event.sourceId);
    Object.assign(updates, {
      independentSummonStrike: true,
      summonInheritsAttributes: true,
      summonUsesProfessionModifiers: true,
      summonBasePower: engineerBalanceValue(context, PROFILE.attackTiming, 'basePower', MECH_REFERENCE_POWER),
      summonDamagePerCoefficient: scaling.damagePerCoefficient,
      weaponStrengthProfileId: scaling.profileId,
      mechBasicAttack: basicAttack
    });
  }

  context.replaceEvent(event, updates);
}

function scheduleMechAttack(context: EngineerSchedulerContext, at: number, payload: MechAttackPayload): void {
  mechanistState.from(context).mech.nextAttackAt = at;
  context.tasks.schedule({
    type: 'engineer.mech-attack',
    at,
    ownerId: 'engineer.mech',
    payload
  });
}

function summonMech(context: EngineerCastContext): void {
  const at = context.effectiveEnd;
  mechanistState.from(context).mech.active = true;
  emitStateSnapshot(context, 'engineer', at, 'summon-mech', snapshotEngineerState(context.state.profession));
}

function recallMech(context: EngineerCastContext): void {
  const at = context.effectiveEnd;
  mechanistState.from(context).mech.active = false;
  emitStateSnapshot(context, 'engineer', at, 'recall-mech', snapshotEngineerState(context.state.profession));
}

export function isEngineerMechCommand(skill: EngineerSkill | undefined): boolean {
  const slot = Number(skill?.mechanicSlot || 0);
  return slot >= 1 && slot <= 3;
}

function emitRocketPunch(context: EngineerCastContext, skill: EngineerSkill, at: number): void {
  const scaling = mechWeaponScaling(context, ID.ROCKET_PUNCH_MECH);
  // Rocket Punch is the mech's activation, not another packet from the
  // player's triggering weapon cast, so it owns a separate strength roll.
  const activationId = context.createActivationId('summon-attack');
  emitSkillDamage(context, {
    at,
    source: 'Trait',
    sourceId: TRAIT.MECH_FIGHTER,
    actorType: 'summon',
    skillId: ID.ROCKET_PUNCH_MECH,
    skillName: 'Rocket Punch (Mech)',
    name: 'Rocket Punch (Mech)',
    coefficient: engineerBalanceEffectValue(context, PROFILE.rocketPunch, 'strike', 'coefficient', 1),
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    independentSummonStrike: true,
    summonInheritsAttributes: true,
    summonUsesProfessionModifiers: true,
    summonBasePower: engineerBalanceValue(context, PROFILE.attackTiming, 'basePower', MECH_REFERENCE_POWER),
    summonDamagePerCoefficient: scaling.damagePerCoefficient,
    weaponStrengthProfileId: scaling.profileId,
    engineerMech: true,
    explosion: true,
    activationId,
    triggeredBy: skill.name
  });
  emitSkillCondition(context, {
    at,
    source: 'Trait',
    sourceId: TRAIT.MECH_FIGHTER,
    actorType: 'summon',
    skillId: ID.ROCKET_PUNCH_MECH,
    skillName: 'Rocket Punch (Mech)',
    name: 'Rocket Punch (Mech) — Burning',
    condition: 'Burning',
    stacks: engineerBalanceEffectValue(context, PROFILE.rocketPunch, 'condition', 'stacks', 1),
    duration: engineerBalanceEffectValue(context, PROFILE.rocketPunch, 'condition', 'duration', 5),
    engineerMech: true,
    activationId,
    triggeredBy: skill.name
  });
  emitSkillControl(context, {
    at,
    source: 'Trait',
    sourceId: TRAIT.MECH_FIGHTER,
    actorType: 'summon',
    skillId: ID.ROCKET_PUNCH_MECH,
    skillName: 'Rocket Punch (Mech)',
    name: 'Rocket Punch (Mech)',
    controlKind: 'defiance',
    duration: engineerBalanceEffectValue(context, PROFILE.rocketPunch, 'control', 'duration', 100),
    engineerMech: true,
    activationId,
    triggeredBy: skill.name
  });
}

export function applyEngineerMechCastTraits(context: EngineerCastContext, skill: EngineerSkill): void {
  if (context.config.specialization !== 'Mechanist') return;
  const state = mechanistState.from(context);
  const at = context.effectiveEnd;

  if (state.mech.active && isEngineerMechCommand(skill)) {
    // The command cast already reserves its measured animation on the mech lane;
    // only its recovery extends the pause before the basic attack chain resumes.
    const hasCommandAnimation = Number(skill.castTimeMs || 0) > 0;
    const busyUntil =
      at + (hasCommandAnimation ? engineerBalanceValue(context, PROFILE.attackTiming, 'durationMultiplier', 0.35) : 0);
    state.mech.busyUntil = Math.max(Number(state.mech.busyUntil || 0), busyUntil);
  }

  if (
    state.mech.active &&
    skill.type === 'Weapon' &&
    !skill.kit &&
    skill.slot === 'Weapon_3' &&
    isInternalCooldownReady(at, Number(professionCoreState(context).traitProcReadyAt.rocketPunch || 0))
  ) {
    professionCoreState(context).traitProcReadyAt.rocketPunch =
      at + engineerBalanceValue(context, PROFILE.rocketPunch, 'internalCooldown', 5);
    emitRocketPunch(context, skill, at);
  }

  if (isEngineerMechCommand(skill) && hasTrait(context.config, TRAIT.MECH_CORE_JADE_DYNAMO)) {
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId: TRAIT.MECH_CORE_JADE_DYNAMO,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Jade Dynamo — quickness',
      kind: 'quickness',
      stacks: engineerBalanceEffectValue(context, PROFILE.jadeDynamo, 'boon', 'stacks', 1),
      duration: gw2SchedulerBoonDuration(
        context,
        skill,
        'quickness',
        engineerBalanceEffectValue(context, PROFILE.jadeDynamo, 'boon', 'duration', 2.5)
      )
    });
  }
}

export function initializeEngineerMech(context: EngineerSchedulerContext): void {
  const state = mechanistState.from(context);

  if (!state.mech.enabled || !state.mech.active) return;
  scheduleMechAttack(context, engineerBalanceValue(context, PROFILE.attackTiming, 'initialDelay', 1), { phase: 0 });
}

export function handleEngineerMechAttack(
  context: EngineerSchedulerContext,
  task: EngineerScheduledTask<MechAttackPayload>
): void {
  const state = mechanistState.from(context);

  if (!state.mech.enabled) return;

  if (!state.mech.active) {
    scheduleMechAttack(context, task.at + 1, { phase: 0 });
    return;
  }

  // Mech is mid-command; hold the attack chain until the command animation ends.
  const busyUntil = Number(state.mech.busyUntil || 0);

  if (task.at < busyUntil - context.epsilon) {
    scheduleMechAttack(context, busyUntil, task.payload || { phase: 0 });
    return;
  }

  const rate = mechAttackRate(context);
  const phase = Number(task.payload?.phase || 0);

  if (hasTrait(context.config, TRAIT.MECH_ARMS_JADE_CANNONS)) {
    const firstArm = phase === 0;
    emitMechStrike(context, {
      at: task.at,
      coefficient: engineerBalanceEffectValue(context, PROFILE.jadeCannons, 'strike', 'coefficient', 0.42),
      name: 'Jade Energy Shot',
      skillId: firstArm ? ID.JADE_ENERGY_SHOT : ID.JADE_ENERGY_SHOT_ID_63348
    });
    scheduleMechAttack(
      context,
      task.at +
        (firstArm
          ? engineerBalanceValue(
              context,
              PROFILE.attackTiming,
              'minimumStacks',
              MECHANIST_ATTACK_TIMING.jadeCannonArmGap
            )
          : engineerBalanceValue(
              context,
              PROFILE.attackTiming,
              'threshold',
              MECHANIST_ATTACK_TIMING.jadeCannonCycleGap
            )) /
          rate,
      { phase: firstArm ? 1 : 0 }
    );
    return;
  }

  const melee = [
    { name: 'Hard Strike', skillId: ID.HARD_STRIKE },
    {
      name: 'Heavy Smash (Mech)',
      skillId: ID.HEAVY_SMASH_MECH
    },
    {
      name: 'Twin Strike (Mech)',
      skillId: ID.TWIN_STRIKE_MECH
    }
  ][phase] || {
    name: 'Hard Strike',
    skillId: ID.HARD_STRIKE
  };
  emitMechStrike(context, {
    at: task.at,
    ...melee,
    coefficient: engineerBalanceEffectValue(
      context,
      PROFILE.meleeChain,
      'strike',
      'coefficient',
      phase === 2 ? 0.8 : 0.45,
      phase
    ),
    hits: engineerBalanceEffectValue(context, PROFILE.meleeChain, 'strike', 'hits', phase === 2 ? 2 : 1, phase)
  });
  scheduleMechAttack(
    context,
    task.at +
      engineerBalanceEffectValue(
        context,
        PROFILE.meleeChain,
        'strike',
        'intervalMs',
        MECHANIST_ATTACK_TIMING.meleeChainIntervals[phase] * 1000,
        phase
      ) /
        1000 /
        rate,
    {
      phase: (phase + 1) % 3
    }
  );
}

export function activateOverclockSignet(context: EngineerCastContext, skill: EngineerSkill): void {
  const state = mechanistState.from(context);

  if (!state.mech?.active) return;
  const at = context.effectiveEnd;
  const interval = engineerBalanceValue(context, PROFILE.overclock, 'pulseInterval', 0.65);
  const hits = engineerBalanceValue(context, PROFILE.overclock, 'maximumStacks', 5);
  // Block the basic attack loop for the full cannon burst so hits don't overlap.
  state.mech.busyUntil = Math.max(Number(state.mech.busyUntil || 0), at + interval * hits);
  for (let hit = 1; hit <= hits; hit += 1) {
    const impactAt = at + interval * hit;
    emitMechStrike(context, {
      at: impactAt,
      coefficient: engineerBalanceEffectValue(context, PROFILE.overclock, 'strike', 'coefficient', 0.95),
      hits: 1,
      name: 'Jade Buster Cannon',
      skillId: ID.JADE_BUSTER_CANNON,
      hitIndex: hit,
      totalHits: hits,
      basicAttack: false
    });
    emitSkillCondition(context, {
      at: impactAt,
      source: 'engineer',
      sourceId: ID.JADE_BUSTER_CANNON,
      actorType: 'summon',
      skillId: ID.JADE_BUSTER_CANNON,
      skillName: 'Jade Buster Cannon',
      name: 'Jade Buster Cannon — Burning',
      condition: 'Burning',
      stacks: engineerBalanceEffectValue(context, PROFILE.overclock, 'condition', 'stacks', 1),
      duration: engineerBalanceEffectValue(context, PROFILE.overclock, 'condition', 'duration', 6),
      engineerMech: true,
      triggeredBy: skill.name
    });
  }
}

export const engineerMechSkillHandlers = Object.freeze({
  'engineer.mech-summon': summonMech,
  'engineer.mech-recall': recallMech
});
