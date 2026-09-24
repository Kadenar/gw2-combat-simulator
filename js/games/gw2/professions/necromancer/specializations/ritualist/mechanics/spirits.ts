import { refreshResource } from '#gw2/platform/combat/resources/resource-policy.js';
import { ritualistLifeForceDepletion } from '#gw2/professions/necromancer/specializations/ritualist/traits/summon-reactions.js';
import { actorLoop } from '#gw2/platform/profession-definition/mechanics.js';
import { EPSILON } from '#kernel/core/clock.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { emitNecromancerStateSnapshot } from '#gw2/professions/necromancer/family-state.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { weaponStrengthProfileForName } from '#gw2/platform/equipment/weapons/strength.js';
import { strikeEffectTicks } from '#gw2/platform/engine/effects/authoring.js';
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
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  NecromancerCastContext,
  NecromancerSchedulerContext,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import type { RitualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
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

const RITUALIST_SHROUD_WEAPON_PROFILE = 'transform.ritualist-shroud';

interface SpiritAttackState {
  readonly skillId: SkillId;
  readonly spiritKey: string;
  readonly generation: number;
}

interface SpiritDefinition {
  readonly key: string;
  readonly initialBusyMs: number;
  readonly autoattackImpactDelayMs: number;
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

// Each spirit retains its shared-grid selection while the actor loop owns replacement and recurrence.
const spiritActions = actorLoop({ id: 'necromancer.ritualist-spirit-actions', step: stepSpiritAttack });

export const ritualistSchedulerHooks = Object.freeze({
  initialize: {
    id: 'ritualist.initialize-runtime',
    order: 10,
    handler: initializeRitualistSummonTraits
  },
  onCastComplete: [
    {
      id: 'ritualist.commit-spirit',
      order: -20,
      handler: (context: NecromancerCastContext, skill: NecromancerSkill) => {
        // Replacement generations and busy windows begin at commitment, preserving the old spirit during the cast.
        if (skill.handlerId === 'necromancer.ritualist' && skill.id !== ID.ESSENCE_BLAST) ritualist(context, skill);
        if (skill.handlerId === 'necromancer.innervate') innervate(context, skill);
      }
    },
    { id: 'ritualist.soul-twisting-refund', order: 10, handler: refundRitualistSoulTwisting }
  ],
  taskHandlers: { ...spiritActions.taskHandlers, ...ritualistLifeForceDepletion.taskHandlers }
});

// Each spirit declares only the attacks it owns; named packets keep their role after a sibling is removed.
const SPIRIT_ATTACKS: Readonly<
  Record<
    string,
    { readonly autoattack: string; readonly initial?: string; readonly lingering?: string; readonly active?: string }
  >
> = Object.freeze({
  anguish: {
    autoattack: 'Anguish Autoattack',
    initial: 'Anguish Initial Barrage',
    active: 'Summon Spirits - Anguish'
  },
  wanderlust: {
    autoattack: 'Wanderlust Autoattack',
    initial: 'Wanderlust Initial Swing',
    lingering: 'Wanderlust Initial Field',
    active: 'Summon Spirits - Wanderlust'
  },
  preservation: { autoattack: 'Preservation Autoattack' }
});

// Decode each spirit's named balance-profile effects into its initial,
// autonomous, lingering, and active attack timings.
function spiritDefinition(
  context: NecromancerCastContext | NecromancerSchedulerContext,
  skillId: SkillId
): SpiritDefinition | undefined {
  const key =
    skillId === ID.ANGUISH
      ? 'anguish'
      : skillId === ID.WANDERLUST
        ? 'wanderlust'
        : skillId === ID.PRESERVATION
          ? 'preservation'
          : '';
  if (!key) return undefined;
  const profile = requireBalanceProfileFromContext(context, RITUALIST_SPIRIT_PROFILE_BY_SKILL_ID[Number(skillId)]);
  const attacks = SPIRIT_ATTACKS[key];
  const strike = (name: string | undefined) => (name ? requireEffect(profile, 'strike', name) : undefined);
  const autoattack = strike(attacks.autoattack);
  const active = strike(attacks.active);
  // Procedural spirit scheduling consumes the same canonical packet timelines as declarative skills; a removed
  // attack contributes no ticks.
  const ticks = (effect: ReturnType<typeof strike>): readonly SpiritStrikeTick[] =>
    effect
      ? strikeEffectTicks(effect).map((tick) => ({ atMs: Number(tick.atMs), coefficient: Number(tick.coefficient) }))
      : [];
  return {
    key,
    initialBusyMs: balanceProfileNumber(profile, 'initialBusyMs'),
    autoattackImpactDelayMs: balanceProfileNumber(profile, 'autoattackImpactDelayMs'),
    // A removed autoattack leaves a zero coefficient, which disables the autonomous loop.
    attackCoefficient: autoattack ? effectNumber(profile, autoattack, 'coefficient') : 0,
    attackWeaponStrength: balanceProfileNumber(profile, 'weaponStrength'),
    summonTicks: ticks(strike(attacks.initial)),
    lingeringTicks: ticks(strike(attacks.lingering)),
    activeTicks: ticks(active),
    activeDuration: active ? effectNumber(profile, active, 'duration') : 0
  };
}

function activePrimaryWeapon(context: NecromancerCastContext): string {
  const weaponSet = context.state.activeWeaponSet === 2 ? 2 : 1;
  return String(gw2ActivePrimaryWeapon(context.config, weaponSet) || '');
}

// Snapshot the equipped main-hand profile so delayed player-owned spirit packets keep their cast-time weapon roll.
function activePrimaryWeaponFields(context: NecromancerCastContext) {
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
          weaponStrength: balanceProfileNumber(
            requireBalanceProfileFromContext(context, CORE_PROFILE.summonAttributes),
            'weaponStrength'
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
  const resources = requireBalanceProfileFromContext(context, PROFILE.resources);
  if (!Number.isFinite(state.spiritAutoAnchorAt)) {
    // Establish the shared cadence with the measured fresh- or re-summon attack delay.
    const delay = state.resummonedSpiritAutoCycle
      ? balanceProfileNumber(resources, 'resummonedSpiritAttackDelayMs') / 1000
      : balanceProfileNumber(resources, 'initialDelay');
    state.spiritAutoAnchorAt = at + delay;
    state.resummonedSpiritAutoCycle = false;
  }

  const interval = balanceProfileNumber(resources, 'pulseInterval');
  return state.spiritAutoAnchorAt > at
    ? state.spiritAutoAnchorAt
    : state.spiritAutoAnchorAt + Math.ceil((at - state.spiritAutoAnchorAt + Number.EPSILON) / interval) * interval;
}

// Replace a spirit generation's autonomous loop without disturbing the cadence shared by other spirits.
function startSpiritActions(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  spirit: SpiritDefinition,
  at: number
): void {
  if (!(spirit.attackCoefficient > 0)) return;
  // An authored zero interval disables autonomous attacks rather than creating a zero-step clock.
  if (!(balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'pulseInterval') > 0))
    return;
  const state = ritualistState.from(context);
  const generation = Number(state.spiritGenerations[spirit.key] || 0);
  if (generation > 1) {
    // Cancel the previous generation's attack loop before starting the new one; generation 0 never had a loop
    spiritActions.stop(context, at, `spirit:${spirit.key}:${generation - 1}`);
  }

  spiritActions.start(context, at, {
    key: `spirit:${spirit.key}`,
    firstAt: nextSpiritPulse(context, state, at),
    ownerId: `spirit:${spirit.key}:${generation}`,
    state: { skillId: skill.id, spiritKey: spirit.key, generation }
  });
}

// Materialize one generation-safe spirit attack and continue its shared-cadence task loop.
function stepSpiritAttack(
  context: NecromancerSchedulerContext,
  at: number,
  payload: SpiritAttackState
): { at: number; state: SpiritAttackState } | null {
  const skill = context.catalog.skillsById.get(payload.skillId);
  const spirit = skill ? spiritDefinition(context, skill.id) : undefined;
  // spirit.key vs payload.spiritKey cross-check guards against a skill ID mapping to the wrong spirit definition
  if (!skill || !spirit || spirit.key !== payload.spiritKey) return null;

  context.emit({
    type: 'necromancer.spirit-attack',
    at: at,
    source: 'Spirit',
    sourceId: skill.id,
    actorType: 'summon',
    skillId: skill.id,
    skillName: `${skill.name} Autoattack`,
    name: `${skill.name} Autoattack`,
    icon: skill.icon || '',
    coefficient: spirit.attackCoefficient,
    weaponStrength: spirit.attackWeaponStrength,
    requiresSpirit: spirit.key,
    requiresSpiritGeneration: payload.generation,
    // The shared clock starts animations; readiness is checked before their later impacts.
    spiritAttackDelay: spirit.autoattackImpactDelayMs / 1000,
    summonKind: 'spirit',
    summonOwner: `spirit:${spirit.key}`,
    summonInheritsCriticalAttributes: true,
    metadata: {
      spirit: spirit.key,
      spiritAttackType: 'autoattack',
      anguishConditionalDamage: spirit.key === 'anguish'
    }
  });

  const nextAt =
    at + balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'pulseInterval');
  if (nextAt > at && (context.observationEndTime == null || nextAt <= context.observationEndTime + EPSILON)) {
    return { at: nextAt, state: payload };
  }

  return null;
}

// Publish Painful Bond's visible status and matching resolver application at the same timestamp.
function emitPainfulBond(context: NecromancerCastContext, skill: NecromancerSkill, at: number): void {
  // Painful Bond is a profession status rather than a standard boon, so its
  // authored duration remains fixed even when the build has Concentration.
  const profile = requireBalanceProfileFromContext(context, PROFILE.painfulBond);
  const bond = requireEffect(profile, 'buff', 'necromancer-painful-bond');
  // The visible status and resolver application are one window, so a removed buff opens neither.
  if (!bond) return;
  const duration = effectNumber(profile, bond, 'duration');
  emitSkillBuff(context, {
    at,
    source: 'necromancer',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Painful Bond',
    kind: String(bond.kind),
    duration,
    stacks: effectNumber(profile, bond, 'stacks')
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
    icon: String(profile.icon || ''),
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
  emitSkillCondition(context, {
    skill,
    at,
    condition: 'Crippled',
    stacks: 1,
    duration: 4
  });
  emitSkillCondition(context, {
    skill,
    at,
    condition: 'Vulnerability',
    stacks: 8,
    duration: 10
  });
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

  emitSkillCondition(context, {
    skill,
    at: fieldAt,
    condition: 'Chilled',
    stacks: 1,
    duration: 2
  });
  // Vulnerability lands after the second field hit, so only the final two packets benefit from it.
  emitSkillCondition(context, {
    skill,
    at: fieldAt + 1,
    source: 'Spirit',
    actorType: 'player',
    condition: 'Vulnerability',
    stacks: 4,
    duration: 6,
    ...spiritEventFields(context, 'wanderlust', 'initial')
  });
  emitSkillCondition(context, {
    skill,
    at: fieldAt + 2,
    source: 'Spirit',
    actorType: 'player',
    condition: 'Weakness',
    stacks: 1,
    duration: 4,
    ...spiritEventFields(context, 'wanderlust', 'initial')
  });
  emitSkillCondition(context, {
    skill,
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
  refreshResource(context, 'lifeForce', true, at);
  state.spiritGenerations[spirit.key] = Number(state.spiritGenerations[spirit.key] || 0) + 1;
  // Replacing one spirit cancels its old generation; its opening animation can make it miss a shared pulse.
  const initialDuration = spirit.initialBusyMs / 1000;
  // Command eligibility retains its separate commitment window; this recording measures autonomous readiness.
  state.spiritInitialUntil[spirit.key] = at + (spirit.key === 'anguish' ? 1.1 : 0);
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
    emitSpiritBoons(context, skill, at);
  }

  startSpiritActions(context, skill, spirit, at);
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
          weaponStrength: balanceProfileNumber(
            requireBalanceProfileFromContext(context, PROFILE.resources),
            'weaponStrength'
          ),
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
    // Custom emission must honor the scheduler's cancellation decision before creating the blast.
    if (context.action.cancelled === true) return true;
    const spirits = Object.keys(state.activeSpirits).length;
    const essence = skill.effects?.find((effect) => effect.type === 'strike');
    // A removed blast strike emits nothing.
    if (!essence) return true;
    // Impact lands at 14/15 of the way through the cast window (observed from EVTC timing)
    const impactAt = context.start + (context.fullEnd - context.start) * (14 / 15);
    emitSkillDamage(context, skill, {
      at: impactAt,
      coefficient: effectNumber(skill, essence, 'coefficient'),
      persistsAfterInterrupt: essence.persistsAfterInterrupt === true,
      skillWeapon: activePrimaryWeapon(context),
      // Snapshot the spirit count at activation; the modifier rule owns per-spirit scaling.
      metadata: {
        activeSpirits: spirits
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
    if (strike)
      emitSkillDamage(context, skill, {
        at,
        source: 'Spirit',
        actorType: 'player',
        skillWeapon: 'Profession mechanic',
        coefficient: effectNumber(skill, strike, 'coefficient'),
        summonKind: 'spirit',
        summonOwner: 'spirit:anguish',
        metadata: { spirit: 'anguish', spiritAttackType: 'innervate' }
      });
    emitSpiritBoons(context, skill, at);
  } else if (skill.id === ID.INNERVATE_WANDERLUST) {
    const control = skill.effects?.find((effect) => effect.type === 'control');
    if (control)
      emitSkillControl(context, {
        at,
        source: 'Spirit',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        controlKind: String(control.controlKind),
        ...spiritEventFields(context, 'wanderlust', 'innervate')
      });
  } else if (skill.id === ID.INNERVATE_PRESERVATION) {
    emitSpiritBoons(context, skill, at);
  } else {
    return false;
  }

  // Every recognized Innervate restores the same life force and publishes the resulting state.
  gainNecromancerLifeForce(context, Number(skill.innervateLifeForceGain), at);
  emitNecromancerStateSnapshot(context, at, 'innervate', {
    dedupeAcrossSourceIds: true
  });
  return true;
}

/** Spirit grants retain their cast timing while sharing canonical boon values and recipients with presentation. */
function emitSpiritBoons(context: NecromancerCastContext, skill: NecromancerSkill, at: number): void {
  for (const effect of skill.effects || []) {
    if (effect.type !== 'boon' || !effect.boon) continue;
    emitSkillBuff(context, skill, {
      at,
      kind: effect.boon,
      duration: effect.duration,
      stacks: effect.stacks,
      audience: effect.audience
    });
  }
}

/** Exposes Ritualist profession-skill and Innervate casts through the shared skill-handler contract. */
export const necromancerSpiritSkillHandlers = Object.freeze({
  // Essence Blast snapshots its activation-time spirit count; summons and Innervate are committed by the hook.
  'necromancer.ritualist': (context: NecromancerCastContext, skill: NecromancerSkill) => {
    if (skill.id === ID.ESSENCE_BLAST) return ritualist(context, skill);
    // The player's opening swing precedes the summon and does not mutate its generation or busy window.
    if (skill.id === ID.WANDERLUST) {
      const swing = spiritDefinition(context, skill.id)?.summonTicks[0];
      if (swing)
        emitSkillDamage(context, skill, {
          at: context.start + Number(swing.atMs) / 1000,
          coefficient: Number(swing.coefficient),
          ...activePrimaryWeaponFields(context)
        });
    }

    return true;
  },
  'necromancer.innervate': () => true
});
