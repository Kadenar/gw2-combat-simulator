import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '#gw2/platform/scheduler/skill-events.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { emitNecromancerStateSnapshot } from '#gw2/professions/necromancer/state.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { weaponStrengthProfileForName } from '#gw2/platform/equipment/weapons/strength.js';
import { strikeEffectTicks } from '#gw2/platform/engine/effects/timelines.js';
/**
 * Ritualist spirits, spirit actives, and innervations.
 *
 * Spirit summons keep a generation number so replacing a spirit invalidates
 * its old queued autoattacks. Periodic attacks share a four-second cadence.
 * Summon Spirits schedules each spirit's distinct follow-up instead of
 * collapsing them into the player cast.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import {
  gainNecromancerLifeForce,
  runCreatureSummonReactions
} from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import type { ScheduledTask, SchedulerRecord, SkillId } from '#gw2/platform/engine/types.js';
import type {
  NecromancerCastContext,
  NecromancerSchedulerContext,
  NecromancerSkill,
  RitualistState
} from '#gw2/professions/necromancer/types.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import {
  RITUALIST_BALANCE_PROFILE_IDS as PROFILE,
  RITUALIST_SPIRIT_PROFILE_BY_SKILL_ID
} from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import {
  emitEmpoweringSpirits,
  initializeRitualistSummonTraits,
  refundRitualistSoulTwisting
} from '#gw2/professions/necromancer/specializations/ritualist/traits/summon-reactions.js';

const SPIRIT_ATTACK_TASK = 'necromancer.ritualist-spirit-attack';
const SPIRIT_ATTACK_STOP_TASK = 'necromancer.ritualist-spirit-attack-stop';
const RITUALIST_SHROUD_WEAPON_PROFILE = 'transform.ritualist-shroud';

interface SpiritAttackTaskPayload extends SchedulerRecord {
  readonly skillId: SkillId;
  readonly spiritKey: string;
  readonly generation: number;
}

interface SpiritAttackStopTaskPayload extends SchedulerRecord {
  readonly ownerId: string;
}

interface SpiritDefinition {
  readonly key: string;
  readonly attackCoefficient: number;
  readonly attackWeaponStrength?: number;
  readonly summonTicks: readonly SpiritStrikeTick[];
  readonly lingeringTicks: readonly SpiritStrikeTick[];
  readonly activeTicks: readonly SpiritStrikeTick[];
  readonly activeDuration: number;
}

interface SpiritStrikeTick {
  readonly atMs: number;
  readonly coefficient: number;
}

export const ritualistSchedulerHooks = Object.freeze({
  initialize: {
    id: 'ritualist.initialize-runtime',
    order: 10,
    handler: initializeRitualistSummonTraits
  },
  onCastComplete: {
    id: 'ritualist.soul-twisting-refund',
    order: 10,
    handler: refundRitualistSoulTwisting
  },
  taskHandlers: Object.freeze({
    [SPIRIT_ATTACK_TASK]: handleSpiritAutoattack,
    [SPIRIT_ATTACK_STOP_TASK]: handleSpiritAutoattackStop
  })
});

// Decode each spirit's ordered balance-profile effects into its initial,
// autonomous, lingering, and active attack timings.
function spiritDefinition(
  context: NecromancerCastContext | NecromancerSchedulerContext,
  skillId: SkillId
): SpiritDefinition | undefined {
  // Resolve the profile and stable spirit key before interpreting positional effects.
  const profileId = RITUALIST_SPIRIT_PROFILE_BY_SKILL_ID[Number(skillId)];
  const profile = balanceProfileFromContext(context, profileId);
  if (!profile) return undefined;
  const key =
    skillId === ID.ANGUISH
      ? 'anguish'
      : skillId === ID.WANDERLUST
        ? 'wanderlust'
        : skillId === ID.PRESERVATION
          ? 'preservation'
          : '';
  if (!key) return undefined;
  const effects = profile.effects || [];
  const autoattack = effects[0];
  const initial = effects[1];
  const lingering = effects[2];
  const active = key === 'wanderlust' ? effects[3] : effects[2];
  // Procedural spirit scheduling consumes the same canonical packet timelines as declarative skills.
  const ticks = (effect: typeof initial): readonly SpiritStrikeTick[] =>
    effect?.type === 'strike'
      ? strikeEffectTicks(effect).map((tick) => ({ atMs: Number(tick.atMs), coefficient: Number(tick.coefficient) }))
      : [];
  return {
    key,
    attackCoefficient: Number(autoattack?.coefficient || 0),
    attackWeaponStrength: Number(profile.weaponStrength || 0),
    summonTicks: ticks(initial),
    lingeringTicks: key === 'wanderlust' ? ticks(lingering) : [],
    activeTicks: ticks(active),
    activeDuration: Number(active?.duration || 0)
  };
}

function activePrimaryWeapon(context: NecromancerCastContext): string {
  const weaponSet = context.state.activeWeaponSet === 2 ? 2 : 1;
  return String(gw2PrimaryWeapon(context.config, weaponSet) || gw2PrimaryWeapon(context.config, 1) || '');
}

// Snapshot the equipped main-hand profile so delayed player-owned spirit packets keep their cast-time weapon roll.
function activePrimaryWeaponFields(context: NecromancerCastContext): Readonly<SchedulerRecord> {
  const skillWeapon = activePrimaryWeapon(context) || 'Unequipped';
  const weaponStrengthProfileId = weaponStrengthProfileForName(skillWeapon)?.id;
  return {
    skillWeapon,
    ...(weaponStrengthProfileId ? { weaponStrengthProfileId } : {})
  };
}

// Stamp spirit packets with ownership plus summon strength unless an explicit strength profile was supplied.
function spiritEventFields(
  context: NecromancerCastContext | NecromancerSchedulerContext,
  key: string,
  attackType: string,
  extra: Readonly<Record<string, unknown>> = {}
): Readonly<Record<string, unknown>> {
  const { anguishConditionalDamage, ...fields } = extra;
  return {
    summonKind: 'spirit',
    summonOwner: `spirit:${key}`,
    ...(fields.weaponStrengthProfileId
      ? {}
      : {
          weaponStrength: Number(
            balanceProfileFromContext(context, CORE_PROFILE.summonAttributes)?.weaponStrength || 1048
          )
        }),
    ...fields,
    metadata: {
      spirit: key,
      spiritAttackType: attackType,
      ...(typeof anguishConditionalDamage === 'boolean' ? { anguishConditionalDamage } : {})
    }
  };
}

// All spirits share a single attack cadence (4 s interval, one shared anchor).
// Re-summoning a spirit does NOT restart the cycle; it snaps the next attack to
// the nearest future grid point so spirits never drift out of phase with each other.
function nextSpiritPulse(context: NecromancerCastContext, state: RitualistState, at: number): number {
  const resources = balanceProfileFromContext(context, PROFILE.resources);
  if (!Number.isFinite(state.spiritAutoAnchorAt)) {
    // Establish the shared cadence with the measured fresh- or re-summon attack delay.
    const delay = state.resummonedSpiritAutoCycle
      ? Number(resources?.resummonedSpiritAttackDelayMs || 4140) / 1000
      : Number(resources?.initialDelay || 7.36);
    state.spiritAutoAnchorAt = at + delay;
    state.resummonedSpiritAutoCycle = false;
  }

  const interval = Number(resources?.pulseInterval || 4);
  return state.spiritAutoAnchorAt > at
    ? state.spiritAutoAnchorAt
    : state.spiritAutoAnchorAt + Math.ceil((at - state.spiritAutoAnchorAt + Number.EPSILON) / interval) * interval;
}

// Replace a spirit generation's autonomous loop without disturbing the cadence shared by other spirits.
function queueSpiritAutoattacks(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  spirit: SpiritDefinition,
  at: number
): void {
  if (!(spirit.attackCoefficient > 0)) return;
  const state = ritualistState.from(context);
  const generation = Number(state.spiritGenerations[spirit.key] || 0);
  if (generation > 1) {
    // Cancel the previous generation's attack loop before starting the new one; generation 0 never had a loop
    context.tasks.schedule({
      type: SPIRIT_ATTACK_STOP_TASK,
      at,
      payload: { ownerId: `spirit:${spirit.key}:${generation - 1}` }
    });
  }

  context.tasks.schedule({
    type: SPIRIT_ATTACK_TASK,
    at: nextSpiritPulse(context, state, at),
    ownerId: `spirit:${spirit.key}:${generation}`,
    payload: { skillId: skill.id, spiritKey: spirit.key, generation }
  });
}

// Materialize one generation-safe spirit attack and continue its shared-cadence task loop.
function handleSpiritAutoattack(
  context: NecromancerSchedulerContext,
  task: ScheduledTask<SpiritAttackTaskPayload>
): void {
  const payload = task.payload;
  if (!payload) return;
  const skill = context.catalog.skillsById.get(payload.skillId);
  const spirit = skill ? spiritDefinition(context, skill.id) : undefined;
  // spirit.key vs payload.spiritKey cross-check guards against a skill ID mapping to the wrong spirit definition
  if (!skill || !spirit || spirit.key !== payload.spiritKey) return;

  context.emit({
    type: 'necromancer.spirit-attack',
    at: task.at,
    source: 'Spirit',
    sourceId: skill.id,
    actorType: 'summon',
    skillId: skill.id,
    skillName: `${skill.name} Autoattack`,
    name: `${skill.name} Autoattack`,
    icon: skill.icon || '',
    coefficient: spirit.attackCoefficient,
    weaponStrength:
      spirit.attackWeaponStrength ??
      Number(balanceProfileFromContext(context, CORE_PROFILE.summonAttributes)?.weaponStrength || 1048),
    requiresSpirit: spirit.key,
    requiresSpiritGeneration: payload.generation,
    summonKind: 'spirit',
    summonOwner: `spirit:${spirit.key}`,
    summonInheritsCriticalAttributes: true,
    metadata: {
      spirit: spirit.key,
      spiritAttackType: 'autoattack',
      anguishConditionalDamage: spirit.key === 'anguish'
    }
  });

  const nextAt = task.at + Number(balanceProfileFromContext(context, PROFILE.resources)?.pulseInterval || 4);
  if (context.observationEndTime == null || nextAt <= context.observationEndTime + context.epsilon) {
    context.tasks.schedule({
      type: SPIRIT_ATTACK_TASK,
      at: nextAt,
      ownerId: task.ownerId,
      payload
    });
  }
}

// Cancel the superseded generation's task owner so its queued autoattacks cannot continue.
function handleSpiritAutoattackStop(
  context: NecromancerSchedulerContext,
  task: ScheduledTask<SpiritAttackStopTaskPayload>
): void {
  if (task.payload) context.tasks.cancelOwner(task.payload.ownerId);
}

// Publish Painful Bond's visible status and matching resolver application at the same timestamp.
function emitPainfulBond(context: NecromancerCastContext, skill: NecromancerSkill, at: number): void {
  // Painful Bond is a profession status rather than a standard boon, so its
  // authored duration remains fixed even when the build has Concentration.
  const duration = Number(
    balanceProfileEffect(balanceProfileFromContext(context, PROFILE.painfulBond), 'buff')?.duration || 10
  );
  emitSkillBuff(context, {
    at,
    source: 'necromancer',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Painful Bond',
    kind: 'necromancer-painful-bond',
    duration,
    stacks: 1
  });
  context.emit({
    type: 'necromancer.painful-bond',
    at,
    mode: 'apply',
    source: 'Spirit',
    sourceId: 'ritualist.painful-bond',
    actorType: 'effect',
    skillName: 'Painful Bond',
    name: 'Painful Bond',
    icon: String(balanceProfileFromContext(context, PROFILE.painfulBond)?.icon || ''),
    duration,
    triggeredBy: skill.name
  });
}

// Materialize Anguish's initial conditions, Painful Bond, and individually timed
// barrage hits with spirit ownership metadata.
function emitAnguishInitial(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  spirit: SpiritDefinition,
  at: number
): void {
  // Apply the opening control conditions before the profile-timed barrage begins.
  emitSkillCondition(context, skill, { at, condition: 'Crippled', stacks: 1, duration: 4 });
  emitSkillCondition(context, skill, { at, condition: 'Vulnerability', stacks: 8, duration: 10 });
  const ticks = spirit.summonTicks;
  if (!ticks.length) throw new Error('Anguish requires an explicit initial strike timeline.');
  // Painful Bond begins on the first barrage impact; the barrage shares one fixed shroud-strength roll.
  emitPainfulBond(context, skill, at + Number(ticks[0].atMs) / 1000);
  for (const [index, tick] of ticks.entries()) {
    emitSkillDamage(context, skill, {
      at: at + Number(tick.atMs) / 1000,
      name: skill.name,
      source: 'Spirit',
      actorType: 'player',
      coefficient: Number(tick.coefficient),
      ...spiritEventFields(context, 'anguish', 'initial', {
        anguishConditionalDamage: true,
        weaponStrengthProfileId: RITUALIST_SHROUD_WEAPON_PROFILE,
        hitIndex: index + 1,
        totalHits: ticks.length
      })
    });
  }
}

// Schedule Wanderlust's player swing and the spirit field's staggered condition sequence.
function emitWanderlustInitial(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  spirit: SpiritDefinition,
  at: number
): void {
  // The player's own initial swing lands 0.72 s into the cast animation, before the spirit materialises
  const swing = spirit.summonTicks[0];
  if (!swing || !spirit.lingeringTicks.length) {
    throw new Error('Wanderlust requires explicit initial strike timelines.');
  }

  emitSkillDamage(context, skill, {
    at: context.start + Number(swing.atMs) / 1000,
    coefficient: Number(swing.coefficient),
    ...activePrimaryWeaponFields(context)
  });
  const fieldAt = at + Number(spirit.lingeringTicks[0].atMs) / 1000;
  // The field shares a fixed shroud-strength roll that is independent from the equipped-weapon opening roll.
  const fieldActivationId = context.createActivationId('effect');
  for (const [index, tick] of spirit.lingeringTicks.entries()) {
    emitSkillDamage(context, skill, {
      at: at + Number(tick.atMs) / 1000,
      coefficient: Number(tick.coefficient),
      name: 'Spirit of Wanderlust - Initial Attack',
      source: 'Spirit',
      actorType: 'player',
      ...spiritEventFields(context, 'wanderlust', 'initial', {
        activationId: fieldActivationId,
        weaponStrengthProfileId: RITUALIST_SHROUD_WEAPON_PROFILE,
        hitIndex: index + 1,
        totalHits: spirit.lingeringTicks.length
      })
    });
  }

  emitSkillCondition(context, skill, { at: fieldAt, condition: 'Chilled', stacks: 1, duration: 2 });
  // Vulnerability lands after the second field hit, so only the final two packets benefit from it.
  emitSkillCondition(context, skill, {
    at: fieldAt + 1,
    source: 'Spirit',
    actorType: 'player',
    condition: 'Vulnerability',
    stacks: 4,
    duration: 6,
    ...spiritEventFields(context, 'wanderlust', 'initial')
  });
  emitSkillCondition(context, skill, {
    at: fieldAt + 2,
    source: 'Spirit',
    actorType: 'player',
    condition: 'Weakness',
    stacks: 1,
    duration: 4,
    ...spiritEventFields(context, 'wanderlust', 'initial')
  });
  emitSkillCondition(context, skill, {
    at: fieldAt + 3,
    source: 'Spirit',
    actorType: 'player',
    condition: 'Slow',
    stacks: 1,
    duration: 2,
    ...spiritEventFields(context, 'wanderlust', 'initial')
  });
}

// Activate or replace one spirit, publish shared summon traits, and schedule its unique opening sequence.
function summonSpirit(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  spirit: SpiritDefinition,
  at: number
): void {
  const state = ritualistState.from(context);
  state.activeSpirits[spirit.key] = true;
  state.spiritGenerations[spirit.key] = Number(state.spiritGenerations[spirit.key] || 0) + 1;
  // Anguish has a 1.1 s window during which it fires its summoning barrage and cannot immediately respond to Summon Spirits
  const initialDuration = spirit.key === 'anguish' ? 1.1 : 0;
  state.spiritInitialUntil[spirit.key] = at + initialDuration;
  state.spiritBusyUntil[spirit.key] = at + initialDuration;
  if (state.soulTwistingAvailable) {
    // Soul Twisting consumes availability on the first summon; the completion hook refunds that skill's committed cooldown.
    state.soulTwistingAvailable = false;
    state.pendingSoulTwistSkill = skill.id;
  }

  // Shared state, trait reactions, and party boons observe the summon before spirit-specific attacks begin.
  emitNecromancerStateSnapshot(context, at, 'spirit-summoned', {
    dedupeAcrossSourceIds: true
  });
  runCreatureSummonReactions(context, skill, at);
  emitEmpoweringSpirits(context, skill, spirit.key);

  // Each spirit owns a distinct opening payload, followed by the same autonomous attack loop.
  if (spirit.key === 'anguish') {
    emitAnguishInitial(context, skill, spirit, at);
  } else if (spirit.key === 'wanderlust') {
    emitWanderlustInitial(context, skill, spirit, at);
  } else if (spirit.key === 'preservation') {
    const boonOptions = { audience: { recipients: 'party' as const, maximumRecipients: 5 } };
    emitSkillBuff(context, skill, { at, kind: 'protection', duration: 4, stacks: 1, ...boonOptions });
    emitSkillBuff(context, skill, { at, kind: 'vigor', duration: 4, stacks: 1, ...boonOptions });
  }

  queueSpiritAutoattacks(context, skill, spirit, at);
}

// Trigger the active spirits' coordinated attacks without reviving or interrupting unavailable spirits.
function summonSpirits(context: NecromancerCastContext, skill: NecromancerSkill, at: number): void {
  const state = ritualistState.from(context);
  for (const spiritId of [ID.ANGUISH, ID.WANDERLUST, ID.PRESERVATION]) {
    const spirit = spiritDefinition(context, spiritId);
    if (!spirit) continue;
    // Spirits still in their initial-attack window cannot participate in Summon Spirits
    if (!state.activeSpirits[spirit.key] || Number(state.spiritInitialUntil[spirit.key] || 0) > at) continue;
    for (const [index, tick] of spirit.activeTicks.entries()) {
      emitSkillDamage(context, skill, {
        at: at + Number(tick.atMs) / 1000,
        coefficient: Number(tick.coefficient),
        name: skill.name,
        source: 'Spirit',
        sourceId: `ritualist.${spirit.key}.summon-spirits`,
        actorType: 'player',
        skillWeapon: 'Unequipped',
        ...spiritEventFields(context, spirit.key, 'summon-spirits', {
          anguishConditionalDamage: spirit.key === 'anguish',
          weaponStrength: Number(balanceProfileFromContext(context, PROFILE.resources)?.weaponStrength || 1056),
          hitIndex: index + 1,
          totalHits: spirit.activeTicks.length
        })
      });
    }

    if (spirit.key === 'wanderlust') {
      const activeAt = at + Number(spirit.activeTicks[0]?.atMs || 0) / 1000;
      emitSkillControl(context, {
        at: activeAt,
        source: 'Spirit',
        sourceId: `ritualist.${spirit.key}.summon-spirits`,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        controlKind: 'daze',
        duration: 2,
        ...spiritEventFields(context, spirit.key, 'summon-spirits')
      });
    }

    state.spiritBusyUntil[spirit.key] = Math.max(
      Number(state.spiritBusyUntil[spirit.key] || 0),
      at + spirit.activeDuration
    );
  }

  emitNecromancerStateSnapshot(context, at, 'summon-spirits', {
    dedupeAcrossSourceIds: true
  });
}

// Dispatch Ritualist profession casts to Essence Blast, coordinated spirit attacks, or a spirit summon.
function ritualist(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const state = ritualistState.from(context);
  const at = context.effectiveEnd;
  if (skill.id === ID.ESSENCE_BLAST) {
    const spirits = Object.keys(state.activeSpirits).length;
    const essence = skill.effects?.find((effect) => effect.type === 'strike');
    // Impact lands at 14/15 of the way through the cast window (observed from EVTC timing)
    const impactAt = context.start + (context.fullEnd - context.start) * (14 / 15);
    emitSkillDamage(context, skill, {
      at: impactAt,
      coefficient: Number(essence?.coefficient || 0.75),
      skillWeapon: activePrimaryWeapon(context),
      metadata: {
        activeSpirits: spirits,
        essenceBlastDamagePerSpirit: Number(essence?.damageIncreasePerStack || 0.15)
      }
    });
    return true;
  }

  if (skill.id === ID.SUMMON_SPIRITS) {
    summonSpirits(context, skill, at);
    return true;
  }

  const spirit = spiritDefinition(context, skill.id);
  if (!spirit) return false;
  summonSpirit(context, skill, spirit, at);
  return true;
}

// Resolve the selected spirit's unique Innervate payload, then apply the shared
// life-force gain only after a recognized Innervate skill succeeds.
function innervate(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const at = context.effectiveEnd;
  if (skill.id === ID.INNERVATE_ANGUISH) {
    const strike = skill.effects?.find((effect) => effect.type === 'strike');
    const boons = skill.effects?.filter((effect) => effect.type === 'boon') || [];
    emitSkillDamage(context, skill, {
      at,
      source: 'Spirit',
      actorType: 'player',
      skillWeapon: 'Profession mechanic',
      coefficient: Number(strike?.coefficient || 1.3),
      summonKind: 'spirit',
      summonOwner: 'spirit:anguish',
      metadata: { spirit: 'anguish', spiritAttackType: 'innervate' }
    });
    const boonOptions = { audience: { recipients: 'party' as const, maximumRecipients: 5 } };
    for (const boon of boons) {
      emitSkillBuff(context, skill, {
        at,
        kind: String(boon.boon || ''),
        duration: Number(boon.duration || 0),
        stacks: Number(boon.stacks || 1),
        ...boonOptions
      });
    }
  } else if (skill.id === ID.INNERVATE_WANDERLUST) {
    emitSkillControl(context, {
      at,
      source: 'Spirit',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      controlKind: 'fear',
      duration: 1.5,
      ...spiritEventFields(context, 'wanderlust', 'innervate')
    });
  } else if (skill.id === ID.INNERVATE_PRESERVATION) {
    const boonOptions = { audience: { recipients: 'party' as const, maximumRecipients: 5 } };
    emitSkillBuff(context, skill, { at, kind: 'aegis', duration: 3, stacks: 1, ...boonOptions });
    emitSkillBuff(context, skill, { at, kind: 'resistance', duration: 4, stacks: 1, ...boonOptions });
    emitSkillBuff(context, skill, { at, kind: 'stability', duration: 5, stacks: 1, ...boonOptions });
  } else {
    return false;
  }

  // Every recognized Innervate restores the same life force and publishes the resulting state.
  gainNecromancerLifeForce(context, 10, at);
  emitNecromancerStateSnapshot(context, at, 'innervate', {
    dedupeAcrossSourceIds: true
  });
  return true;
}

/** Exposes Ritualist profession-skill and Innervate casts through the shared skill-handler contract. */
export const necromancerSpiritSkillHandlers = Object.freeze({
  'necromancer.ritualist': ritualist,
  'necromancer.innervate': innervate
});
