import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '#gw2/platform/scheduler/skill-events.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import { ritualistState } from '#gw2/content/professions/necromancer/specializations/ritualist/state.js';
import { snapshotNecromancerState } from '#gw2/content/professions/necromancer/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
/**
 * Ritualist spirits, spirit actives, and innervations.
 *
 * Spirit summons keep a generation number so replacing a spirit invalidates
 * its old queued autoattacks. Periodic attacks share a four-second cadence.
 * Summon Spirits schedules each spirit's distinct follow-up instead of
 * collapsing them into the player cast.
 */
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT
} from '#gw2/content/professions/necromancer/data/ids.js';
import {
  gainNecromancerLifeForce,
  registerNecromancerCreatureStrikeMultiplier,
  registerCreatureSummonReaction,
  runCreatureSummonReactions
} from '#gw2/content/professions/necromancer/core/mechanics/state-helpers.js';
import { syncNecromancerResources } from '#gw2/content/professions/necromancer/core/state.js';
import {
  registerNecromancerResourceAdvance,
  registerNecromancerShroudLifecycle
} from '#gw2/content/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import type { ScheduledTask, SchedulerRecord, SkillId } from '#gw2/platform/engine/types.js';
import type {
  NecromancerCastContext,
  NecromancerSchedulerContext,
  NecromancerSkill,
  RitualistState
} from '#gw2/content/professions/necromancer/types.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/content/professions/necromancer/core/profiles.js';
import {
  RITUALIST_BALANCE_PROFILE_IDS as PROFILE,
  RITUALIST_SPIRIT_PROFILE_BY_SKILL_ID
} from '#gw2/content/professions/necromancer/specializations/ritualist/profiles.js';

const SPIRIT_ATTACK_TASK = 'necromancer.ritualist-spirit-attack';
const SPIRIT_ATTACK_STOP_TASK = 'necromancer.ritualist-spirit-attack-stop';

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
  readonly summonCoefficient: number;
  readonly summonHits?: number;
  readonly summonWeaponStrength?: number;
  readonly summonDelay?: number;
  readonly summonInterval?: number;
  readonly summonHitDelays?: readonly number[];
  readonly lingeringCoefficient?: number;
  readonly lingeringHits?: number;
  readonly lingeringInterval?: number;
  readonly lingeringDelay?: number;
  readonly activeCoefficient: number;
  readonly activeHits: number;
  readonly activeDelay: number;
  readonly activeInterval: number;
  readonly activeDuration: number;
}

// Apply Ritualist traits shared by spirit and minion summons from the actual
// creature count and summon timestamp.
function applyRitualistCreatureSummonTraits(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  at: number,
  count: number
): void {
  // Boon of Creation scales its life-force grant with the number of creatures actually summoned.
  if (hasTrait(context, TRAIT.BOON_OF_CREATION)) {
    gainNecromancerLifeForce(
      context,
      Number(balanceProfileFromContext(context, PROFILE.boonOfCreation)?.lifeForceGain || 10) * count,
      at
    );
  }

  // Explosive Growth combines simultaneous summons into one coefficient-scaled trait packet.
  if (!hasTrait(context, TRAIT.EXPLOSIVE_GROWTH)) return;
  const explosive = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.explosiveGrowth), 'strike');
  emitSkillDamage(context, skill, {
    at,
    name: 'Explosive Growth',
    source: 'Trait',
    sourceId: TRAIT.EXPLOSIVE_GROWTH,
    actorType: 'effect',
    skillId: TRAIT.EXPLOSIVE_GROWTH,
    skillName: 'Explosive Growth',
    parentSkillName: skill.name,
    triggeredBy: skill.name,
    coefficient: Number(explosive?.coefficient || 1.2) * count,
    skillWeapon: 'Unequipped'
  });
}

// Initialize spirit generations, shared cadence, Soul Twisting, and Ritualist
// resource state from the selected build.
function initializeRitualistRuntime(context: NecromancerSchedulerContext): void {
  // Register summon traits and autonomous-spirit scaling before casts begin.
  registerCreatureSummonReaction(context, 'ritualist.creature-summon-traits', applyRitualistCreatureSummonTraits);
  registerNecromancerCreatureStrikeMultiplier(context, 'ritualist.spirits-strength', (castContext) =>
    hasTrait(castContext, TRAIT.SPIRITS_STRENGTH) ? 1.5 : 1
  );
  // Entering shroud establishes a new spirit cadence; exiting drops spirits unless Lingering Spirits owns them.
  registerNecromancerShroudLifecycle(context, 'ritualist.shroud', {
    onEnter: (runtime, skill) => {
      if (skill.shroudEntry !== 'ritualist') return;
      const state = ritualistState.from(runtime);
      state.resummonedSpiritAutoCycle = Object.keys(state.activeSpirits).length > 0;
      state.spiritAutoAnchorAt = Number.NaN;
      state.soulTwistingAvailable = hasTrait(runtime, TRAIT.SOUL_TWISTING);
    },
    onExit: (runtime) => {
      if (hasTrait(runtime, TRAIT.LINGERING_SPIRITS)) return;
      ritualistState.from(runtime).activeSpirits = {};
    }
  });
  // Lingering spirits pay continuous life force outside shroud and disappear when the resource is exhausted.
  registerNecromancerResourceAdvance(context, 'ritualist.lingering-spirits', (runtime, start, end) => {
    const core = professionCoreState(runtime);
    const state = ritualistState.from(runtime);
    if (core.activeShroud || !Object.keys(state.activeSpirits).length || !hasTrait(runtime, TRAIT.LINGERING_SPIRITS)) {
      return;
    }

    const drainPercent = Number(balanceProfileFromContext(runtime, PROFILE.resources)?.lifeForceDrain || 3);
    core.lifeForce = Math.max(0, core.lifeForce - core.maximumLifeForce * (drainPercent / 100) * (end - start));
    if (core.lifeForce <= runtime.epsilon) {
      core.lifeForce = 0;
      state.activeSpirits = {};
    }

    syncNecromancerResources(core);
  });
}

// Refund only the completed summon that consumed Soul Twisting's one-use allowance.
function refundSoulTwisting(context: NecromancerCastContext, skill: NecromancerSkill): void {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const state = ritualistState.from(context);
  if (state.pendingSoulTwistSkill !== skill.id) return;
  // Soul Twisting refunds exactly the first spirit summon after entering Ritualist Shroud.
  context.state.cooldowns.delete(skill.id);
  delete state.pendingSoulTwistSkill;
}

export const ritualistSchedulerHooks = Object.freeze({
  initialize: {
    id: 'ritualist.initialize-runtime',
    order: 10,
    handler: initializeRitualistRuntime
  },
  onCastComplete: {
    id: 'ritualist.soul-twisting-refund',
    order: 10,
    handler: refundSoulTwisting
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
  // Normalize authored millisecond timings and explicit tick lists into scheduler seconds.
  const initialTicks = Array.isArray(initial?.ticks)
    ? (initial.ticks as readonly {
        readonly atMs: number;
        readonly coefficient?: number;
      }[])
    : [];
  const initialHitDelays = initialTicks.map((tick) => Number(tick.atMs || 0) / 1000);
  return {
    key,
    attackCoefficient: Number(autoattack?.coefficient || 0),
    attackWeaponStrength: Number(profile.weaponStrength || 0),
    summonCoefficient: initialTicks.length
      ? initialTicks.reduce((sum, tick) => sum + Number(tick.coefficient || 0), 0)
      : Number(initial?.coefficient || 0),
    summonHits: initialTicks.length || Number(initial?.hits || 1),
    summonWeaponStrength: Number(initial?.weaponStrength || 0),
    summonDelay: initialHitDelays[0] || Number(initial?.atMs || 0) / 1000,
    summonHitDelays: initialHitDelays.length ? initialHitDelays : undefined,
    lingeringCoefficient: key === 'wanderlust' ? Number(lingering?.coefficient || 0) : undefined,
    lingeringHits: key === 'wanderlust' ? Number(lingering?.hits || 1) : undefined,
    lingeringInterval: key === 'wanderlust' ? Number(lingering?.intervalMs || 0) / 1000 : undefined,
    lingeringDelay: key === 'wanderlust' ? Number(lingering?.atMs || 0) / 1000 : undefined,
    activeCoefficient: Number(active?.coefficient || 0),
    activeHits: Number(active?.hits || 0),
    activeDelay: Number(active?.atMs || 0) / 1000,
    activeInterval: Number(active?.intervalMs || 0) / 1000,
    activeDuration: Number(active?.duration || 0)
  };
}

// Resolve the cast-time weapon used by player-owned spirit packets, including incomplete-loadout fallback.
function activePrimaryWeapon(context: NecromancerCastContext): string {
  // Player-owned spirit skill packets inherit the weapon selected at cast time,
  // with the existing set-1 fallback retained for incomplete sandbox configs.
  const weaponSet = context.state.activeWeaponSet === 2 ? 2 : 1;
  return String(gw2PrimaryWeapon(context.config, weaponSet) || gw2PrimaryWeapon(context.config, 1) || '');
}

// Stamp spirit packets with stable ownership, attack classification, and summon weapon strength.
function spiritMetadata(
  context: NecromancerCastContext | NecromancerSchedulerContext,
  key: string,
  attackType: string,
  extra: Readonly<Record<string, unknown>> = {}
): Readonly<Record<string, unknown>> {
  return {
    summonKind: 'spirit',
    summonOwner: `spirit:${key}`,
    spirit: key,
    spiritAttackType: attackType,
    weaponStrength: Number(balanceProfileFromContext(context, CORE_PROFILE.summonAttributes)?.weaponStrength || 1048),
    ...extra
  };
}

// All spirits share a single attack cadence (4 s interval, one shared anchor).
// Re-summoning a spirit does NOT restart the cycle; it snaps the next attack to
// the nearest future grid point so spirits never drift out of phase with each other.
function nextSpiritPulse(context: NecromancerCastContext, state: RitualistState, at: number): number {
  const resources = balanceProfileFromContext(context, PROFILE.resources);
  if (!Number.isFinite(state.spiritAutoAnchorAt)) {
    // First summon in the rotation picks the delay (shorter after a re-summon due to in-game animation timing)
    const delay = state.resummonedSpiritAutoCycle
      ? Number(resources?.rechargeOffsetMs || 4140) / 1000
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
    spirit: spirit.key,
    spiritAttackType: 'autoattack',
    anguishConditionalDamage: spirit.key === 'anguish'
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

// Grant Empowering Spirits' shared Quickness and the summoned spirit's distinct
// party boon from the same profile-driven application.
function emitEmpoweringSpirits(context: NecromancerCastContext, skill: NecromancerSkill, key: string): void {
  if (!hasTrait(context, TRAIT.EMPOWERING_SPIRITS)) return;
  const profile = balanceProfileFromContext(context, PROFILE.empoweringSpirits);
  const quickness = balanceProfileEffect(profile, 'boon');
  const boonOptions = {
    metadata: { recipients: 'party', maximumRecipients: 5 }
  };
  emitSkillBuff(context, skill, {
    at: context.effectiveEnd,
    kind: String(quickness?.boon || 'quickness'),
    duration: Number(quickness?.duration || 3.75),
    stacks: Number(quickness?.stacks || 1),
    ...boonOptions
  });
  // The remaining profile entries map one distinct party boon to each spirit.
  const boonIndex = key === 'anguish' ? 1 : key === 'wanderlust' ? 2 : 3;
  const boon = balanceProfileEffect(profile, 'boon', boonIndex);
  if (key === 'anguish') {
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
      kind: String(boon?.boon || 'might'),
      duration: Number(boon?.duration || 10),
      stacks: Number(boon?.stacks || 8),
      ...boonOptions
    });
  } else if (key === 'wanderlust') {
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
      kind: String(boon?.boon || 'fury'),
      duration: Number(boon?.duration || 5),
      stacks: Number(boon?.stacks || 1),
      ...boonOptions
    });
  } else if (key === 'preservation') {
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
      kind: String(boon?.boon || 'resolution'),
      duration: Number(boon?.duration || 4),
      stacks: Number(boon?.stacks || 1),
      ...boonOptions
    });
  }
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
  const hitCount = Number(spirit.summonHits || 1);
  const hitDelays =
    spirit.summonHitDelays ||
    Array.from(
      { length: hitCount },
      (_, index) => Number(spirit.summonDelay || 0) + index * Number(spirit.summonInterval || 0)
    );
  // Painful Bond begins on the first barrage impact and shares the same authored hit schedule.
  emitPainfulBond(context, skill, at + Number(hitDelays[0] || 0));
  for (let index = 0; index < hitDelays.length; index += 1) {
    emitSkillDamage(context, skill, {
      at: at + Number(hitDelays[index]),
      name: skill.name,
      source: 'Spirit',
      actorType: 'player',
      coefficient: spirit.summonCoefficient / hitCount,
      metadata: spiritMetadata(context, 'anguish', 'initial', {
        anguishConditionalDamage: true,
        weaponStrength: spirit.summonWeaponStrength,
        hitIndex: index + 1,
        totalHits: hitCount
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
  emitSkillDamage(context, skill, {
    at: context.start + 0.72,
    coefficient: spirit.summonCoefficient,
    skillWeapon: activePrimaryWeapon(context)
  });
  const fieldAt = at + Number(spirit.lingeringDelay || 0);
  emitSkillDamage(context, skill, {
    at: fieldAt,
    coefficient: Number(spirit.lingeringCoefficient || 0),
    hits: Number(spirit.lingeringHits || 1),
    interval: Number(spirit.lingeringInterval || 0),
    name: 'Spirit of Wanderlust - Initial Attack',
    source: 'Spirit',
    actorType: 'player',
    metadata: spiritMetadata(context, 'wanderlust', 'initial')
  });
  emitSkillCondition(context, skill, { at: fieldAt, condition: 'Chilled', stacks: 1, duration: 2 });
  // The lingering field applies its later conditions on their own observed offsets.
  emitSkillCondition(context, skill, {
    at: fieldAt,
    source: 'Spirit',
    actorType: 'player',
    condition: 'Vulnerability',
    stacks: 4,
    duration: 6,
    metadata: spiritMetadata(context, 'wanderlust', 'initial')
  });
  emitSkillCondition(context, skill, {
    at: fieldAt + 2,
    source: 'Spirit',
    actorType: 'player',
    condition: 'Weakness',
    stacks: 1,
    duration: 4,
    metadata: spiritMetadata(context, 'wanderlust', 'initial')
  });
  emitSkillCondition(context, skill, {
    at: fieldAt + 3,
    source: 'Spirit',
    actorType: 'player',
    condition: 'Slow',
    stacks: 1,
    duration: 2,
    metadata: spiritMetadata(context, 'wanderlust', 'initial')
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
  emitStateSnapshot(context, 'necromancer', at, 'spirit-summoned', snapshotNecromancerState(context.state.profession), {
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
    const boonOptions = {
      metadata: { recipients: 'party', maximumRecipients: 5 }
    };
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
    if (spirit.activeCoefficient > 0 && spirit.activeHits > 0) {
      emitSkillDamage(context, skill, {
        at: at + spirit.activeDelay,
        coefficient: spirit.activeCoefficient,
        hits: spirit.activeHits,
        interval: spirit.activeInterval,
        name: skill.name,
        source: 'Spirit',
        sourceId: `ritualist.${spirit.key}.summon-spirits`,
        actorType: 'player',
        skillWeapon: 'Unequipped',
        metadata: spiritMetadata(context, spirit.key, 'summon-spirits', {
          anguishConditionalDamage: spirit.key === 'anguish',
          weaponStrength: Number(balanceProfileFromContext(context, PROFILE.resources)?.weaponStrength || 1056)
        })
      });
    }

    if (spirit.key === 'wanderlust') {
      emitSkillControl(context, {
        at: at + spirit.activeDelay,
        source: 'Spirit',
        sourceId: `ritualist.${spirit.key}.summon-spirits`,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        controlKind: 'daze',
        duration: 2,
        ...spiritMetadata(context, spirit.key, 'summon-spirits')
      });
    }

    state.spiritBusyUntil[spirit.key] = Math.max(
      Number(state.spiritBusyUntil[spirit.key] || 0),
      at + spirit.activeDuration
    );
  }

  emitStateSnapshot(context, 'necromancer', at, 'summon-spirits', snapshotNecromancerState(context.state.profession), {
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
      metadata: {
        summonKind: 'spirit',
        summonOwner: 'spirit:anguish',
        spirit: 'anguish',
        spiritAttackType: 'innervate'
      }
    });
    const boonOptions = {
      metadata: { recipients: 'party', maximumRecipients: 5 }
    };
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
      ...spiritMetadata(context, 'wanderlust', 'innervate')
    });
  } else if (skill.id === ID.INNERVATE_PRESERVATION) {
    const boonOptions = {
      metadata: { recipients: 'party', maximumRecipients: 5 }
    };
    emitSkillBuff(context, skill, { at, kind: 'aegis', duration: 3, stacks: 1, ...boonOptions });
    emitSkillBuff(context, skill, { at, kind: 'resistance', duration: 4, stacks: 1, ...boonOptions });
    emitSkillBuff(context, skill, { at, kind: 'stability', duration: 5, stacks: 1, ...boonOptions });
  } else {
    return false;
  }

  // Every recognized Innervate restores the same life force and publishes the resulting state.
  gainNecromancerLifeForce(context, 10, at);
  emitStateSnapshot(context, 'necromancer', at, 'innervate', snapshotNecromancerState(context.state.profession), {
    dedupeAcrossSourceIds: true
  });
  return true;
}

/** Exposes Ritualist profession-skill and Innervate casts through the shared skill-handler contract. */
export const necromancerSpiritSkillHandlers = Object.freeze({
  'necromancer.ritualist': ritualist,
  'necromancer.innervate': innervate
});
