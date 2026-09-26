import { sideEffectAmount } from '#gw2/platform/simulation/side-effects.js';
import { canonicalTime, isInternalCooldownReady } from '#kernel/core/clock.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { advanceCriticalProc, criticalOpportunity } from '#gw2/platform/combat/critical-procs.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { scaleCastBoundTiming } from '#gw2/platform/engine/effects/materializer.js';
import { BRAVE_STRIDE_MOVEMENT_SKILL_IDS, reactToWarriorBuff } from '#gw2/professions/warrior/core/traits/strength.js';
import { reactToWarriorDamage } from '#gw2/professions/warrior/core/traits/arms.js';
import { consumeSkillFlip, skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import {
  balanceProfileNumber,
  effectNumber,
  procChanceFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { castCompleted, castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import type { Gw2Runtime, RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import { grantWarriorAdrenaline } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';

type WarriorRuntime = Gw2Runtime<WarriorRuntimeState>;
const SIGNET_PULSE = 'warrior.signet-of-rage-pulse';
const EMPOWER_PULSE = 'warrior.empower-allies-pulse';
// These immutable reservation facts survive resource changes during the cast; they are not another resource pool.
const burstSpends = new WeakMap<RuntimeCast, number>();

/** Actual reactions emit fresh trait packets, retaining only the triggering activation and causal placement. */
function traitEffects(
  runtime: WarriorRuntime,
  event: Gw2ResolverEvent,
  trait: number,
  overrides: Pick<Gw2ResolverEvent, 'stacks' | 'duration' | 'audience'> = {},
  quantity = 1
): void {
  const profile = requireBalanceProfileFromContext(runtime, trait);
  for (const effect of profile.effects ?? []) {
    if (effect.type !== 'boon' && effect.type !== 'buff' && effect.type !== 'condition') continue;
    const fields = {
      at: runtime.time,
      priority: 5,
      source: 'Trait',
      sourceId: trait,
      actorType: 'effect' as const,
      skillId: event.skillId,
      skillName: event.skillName,
      name: profile.name,
      stacks: quantity * effectNumber(profile, effect, 'stacks'),
      duration: effectNumber(profile, effect, 'duration'),
      ...overrides
    };
    if (effect.type === 'condition') {
      runtime.emitDerived(event, buildResolverCondition({ ...fields, condition: String(effect.condition) }));
    } else {
      runtime.emitProcedural({ ...fields, type: 'buff', kind: String(effect.boon || effect.kind) }, { cause: event });
    }
  }
}

/** A selected trait claims its own deadline only after its trigger has actually been accepted. */
function claimTrait(runtime: WarriorRuntime, trait: number): boolean {
  return hasTrait(runtime, trait) && runtime.procs.claim(trait);
}

/** Player control and player immobilization share Opportunist's single cooldown and live resource grant. */
function opportunist(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !claimTrait(runtime, TRAIT.OPPORTUNIST)) return;
  grantWarriorAdrenaline(
    runtime,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.opportunist), 'resourceGain')
  );
  traitEffects(runtime, event, TRAIT.OPPORTUNIST);
}

/** Control state is committed before Defense and Strength rewards; derived conditions reenter the common queue. */
function controlTraits(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player') return;
  opportunist(runtime, event);
  runtime.profession.core.targetControlledUntil = Math.max(
    runtime.profession.core.targetControlledUntil,
    canonicalTime(runtime.time + Number(event.duration ?? 1))
  );
  if (hasTrait(runtime, TRAIT.MERCILESS_HAMMER))
    grantWarriorAdrenaline(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.mercilessHammer), 'resourceGain')
    );
  if (claimTrait(runtime, TRAIT.STALWART_STRENGTH)) traitEffects(runtime, event, TRAIT.STALWART_STRENGTH);
  if (
    hasTrait(runtime, TRAIT.BODY_BLOW) &&
    ['stun', 'daze', 'knockback', 'pull', 'push', 'launch'].includes(String(event.controlKind).toLowerCase())
  )
    traitEffects(runtime, event, TRAIT.BODY_BLOW);
  if (claimTrait(runtime, TRAIT.AGGRESSIVE_ONSLAUGHT)) traitEffects(runtime, event, TRAIT.AGGRESSIVE_ONSLAUGHT);
}

/** The first surviving burst strike claims its activation once, even when earlier packets missed or traveled. */
function firstBurstHit(runtime: WarriorRuntime, event: Gw2ResolverEvent): boolean {
  const skill = runtime.helpers.skillsById.get(event.skillId ?? '');
  if (!skill?.burst || event.activationId == null) return false;
  const state = runtime.profession.core;
  const key = String(event.activationId);
  if (state.burstHitActivations[key]) return false;
  state.burstHitActivations[key] = true;
  const attribution = {
    at: runtime.time,
    priority: 5,
    source: 'Trait',
    actorType: 'effect' as const,
    skillId: event.skillId,
    skillName: event.skillName,
    stacks: 1
  };
  if (hasTrait(runtime, TRAIT.CULL_THE_WEAK) && runtime.procs.claim(TRAIT.CULL_THE_WEAK))
    traitEffects(runtime, event, TRAIT.CULL_THE_WEAK);
  if (hasTrait(runtime, TRAIT.BURST_PRECISION)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.burstPrecision);
    runtime.emitDerived(event, {
      ...attribution,
      sourceId: TRAIT.BURST_PRECISION,
      type: 'buff',
      name: 'Burst Precision',
      kind: 'burst-precision',
      duration: balanceProfileNumber(
        profile,
        Number(event.metadata?.warriorAdrenalineSpent) >= 30 ? 'maximumStacks' : 'minimumStacks'
      )
    });
  }

  if (hasTrait(runtime, TRAIT.BUILDING_MOMENTUM))
    runtime.endurance.grant(
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.buildingMomentum), 'resourceGain')
    );
  if (hasTrait(runtime, TRAIT.MARCHING_ORDERS) && isInternalCooldownReady(runtime.time, state.soldierFocusReadyAt)) {
    state.soldierFocusReadyAt = canonicalTime(
      runtime.time +
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.marchingOrders), 'internalCooldown')
    );
    const audience = { recipients: 'party' as const };
    traitEffects(runtime, event, TRAIT.MARCHING_ORDERS, { audience });
    if (hasTrait(runtime, TRAIT.SOLDIERS_COMFORT)) traitEffects(runtime, event, TRAIT.SOLDIERS_COMFORT, { audience });
    if (hasTrait(runtime, TRAIT.MARTIAL_CADENCE)) traitEffects(runtime, event, TRAIT.MARTIAL_CADENCE, { audience });
  }

  // Dragon Slash owns its charge-converted reward at completion rather than first impact.
  if (
    !skill.dragonSlash &&
    hasTrait(runtime, TRAIT.BERSERKERS_POWER) &&
    Number(event.metadata?.warriorAdrenalineSpent) > 0
  )
    traitEffects(runtime, event, TRAIT.BERSERKERS_POWER, { stacks: Number(event.metadata?.warriorBurstTier) + 1 });
  return true;
}

/** Every critical consumer uses the same resolved hit fact; only independent trait chances draw additional rolls. */
function criticalTraits(
  runtime: WarriorRuntime,
  event: Gw2ResolverEvent,
  hit: Gw2HitResolutionContext,
  firstBurst: boolean
): void {
  const opportunity = criticalOpportunity(
    hit.critEligible ? hit.critical.chance : 0,
    hit.critical.didCrit,
    Math.max(1, Number(event.hits ?? 1))
  );
  const criticals = opportunity.sampledCriticals;
  if (criticals > 0 && event.skillId === ID.KEEN_STRIKE) {
    const buff = {
      type: 'buff' as const,
      at: runtime.time,
      priority: 5,
      source: 'Trait',
      sourceId: ID.KEEN_STRIKE,
      actorType: 'effect' as const,
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Keen Strike — Critical Might',
      kind: 'might',
      stacks: 1,
      duration: 5
    };
    runtime.emitProcedural(buff, { cause: event });
  }

  if (hasTrait(runtime, TRAIT.BLOODLUST)) {
    const proc = advanceCriticalProc(opportunity, {
      id: 'warrior.core.bloodlust',
      at: runtime.time,
      chanceOnCriticalHit: procChanceFromContext(runtime, PROFILE.bloodlust),
      randomStream: 'warrior.bloodlust',
      roll: (chance, stream) => runtime.random.roll(chance, stream)
    });
    if (proc) {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.bloodlust);
      const bleeding = requireEffect(profile, 'condition', 'Bleeding');
      if (bleeding)
        runtime.emitDerived(
          event,
          buildResolverCondition({
            at: runtime.time,
            priority: 5,
            source: 'Trait',
            sourceId: TRAIT.BLOODLUST,
            actorType: 'effect',
            skillId: event.skillId,
            skillName: 'Bloodlust',
            triggeredBy: event.skillName,
            metadata: { procCount: proc.quantity },
            condition: 'Bleeding',
            stacks: proc.quantity * effectNumber(profile, bleeding, 'stacks'),
            duration: effectNumber(profile, bleeding, 'duration')
          })
        );
    }
  }

  if (criticals > 0 && hasTrait(runtime, TRAIT.FURIOUS)) {
    grantWarriorAdrenaline(
      runtime,
      criticals * balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.furious), 'resourceGain')
    );
    traitEffects(runtime, event, TRAIT.FURIOUS, {}, criticals);
  }

  if (firstBurst && claimTrait(runtime, TRAIT.SUNDERING_BURST)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.sunderingBurst);
    const effect = requireEffect(profile, 'condition', criticals > 0 ? 'Critical burst' : 'Burst');
    if (effect)
      runtime.emitDerived(
        event,
        buildResolverCondition({
          at: runtime.time,
          priority: 5,
          source: 'Trait',
          sourceId: TRAIT.SUNDERING_BURST,
          actorType: 'effect',
          skillId: event.skillId,
          skillName: event.skillName,
          name: 'Sundering Burst — Vulnerability',
          condition: 'Vulnerability',
          stacks: effectNumber(profile, effect, 'stacks'),
          duration: effectNumber(profile, effect, 'duration')
        })
      );
  }

  if (criticals > 0 && hasTrait(runtime, TRAIT.AXE_MASTERY)) {
    const skill = runtime.helpers.skillsById.get(event.skillId ?? '');
    if ((skill?.skillWeapon || skill?.weapon || event.skillWeapon) === 'Axe')
      grantWarriorAdrenaline(
        runtime,
        criticals * balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.axeMastery), 'resourceGain')
      );
  }

  if (hasTrait(runtime, TRAIT.FORCEFUL_GREATSWORD)) {
    const weapons = gw2ConfiguredWeaponSet(runtime.config, runtime.activeWeaponSet);
    const chance = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, PROFILE.forcefulGreatsword),
      'procChance'
    );
    const proc = advanceCriticalProc(opportunity, {
      id: 'warrior.core.forceful-greatsword',
      at: runtime.time,
      chanceOnCriticalHit: Math.min(1, chance * (weapons.includes('Greatsword') ? 2 : 1)),
      randomStream: 'warrior.forceful-greatsword',
      roll: (chance, stream) => runtime.random.roll(chance, stream)
    });
    if (proc) traitEffects(runtime, event, TRAIT.FORCEFUL_GREATSWORD, {}, proc.quantity);
  }
}

/** Selected trait components use the common buff queue; standard boons sample current duration modifiers. */
function castTraitBuff(
  runtime: WarriorRuntime,
  cast: RuntimeCast,
  trait: number,
  profileId: string | number,
  name: string,
  kind: string,
  type: 'boon' | 'buff',
  at = runtime.time,
  priority = 0
): void {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  const effect = requireEffect(profile, type, kind);
  if (!effect) return;
  const event = {
    type: 'buff' as const,
    at,
    priority,
    source: 'Trait',
    sourceId: trait,
    actorType: 'effect' as const,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id,
    name,
    kind,
    stacks: effectNumber(profile, effect, 'stacks'),
    duration: effectNumber(profile, effect, 'duration')
  };
  // A modifier opening at a future impact is queued now, so it precedes the same-instant hits it modifies.
  if (at > runtime.time) runtime.emit(event);
  else runtime.emitProcedural(event);
}

/** Acceptance rewards survive later cancellation; Kick opens its modifier at the first authored impact. */
function startTraits(runtime: WarriorRuntime, cast: RuntimeCast): void {
  const skill = cast.skill;
  if (!skill.categories?.includes('Physical') || !hasTrait(runtime, TRAIT.PEAK_PERFORMANCE)) return;
  let at = cast.effectiveEnd;
  if (skill.id === ID.KICK) {
    const strike = skill.effects?.find((effect) => effect.type === 'strike');
    const timing = strike && scaleCastBoundTiming(cast, skill, strike);
    const firstTick = Array.isArray(timing?.ticks) ? timing.ticks[0] : undefined;
    const offsetMs = Number(firstTick?.atMs ?? timing?.atMs ?? skill.castTimeMs ?? 0);
    at = Math.min(at, cast.start + offsetMs / 1000);
  }

  castTraitBuff(
    runtime,
    cast,
    TRAIT.PEAK_PERFORMANCE,
    PROFILE.peakPerformance,
    'Peak Performance',
    'peak-performance',
    'buff',
    at
  );
}

/** Only completed activations earn signet, movement, and dodge rewards, using the live resource owner. */
function completeTraits(runtime: WarriorRuntime, cast: RuntimeCast): void {
  const skill = cast.skill;
  if (
    hasTrait(runtime, TRAIT.BRAVE_STRIDE) &&
    (skill.movementSkill || BRAVE_STRIDE_MOVEMENT_SKILL_IDS.some((id) => id === skill.id))
  ) {
    grantWarriorAdrenaline(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.braveStride), 'resourceGain')
    );
    castTraitBuff(runtime, cast, TRAIT.BRAVE_STRIDE, PROFILE.braveStride, 'Brave Stride', 'stability', 'boon');
  }

  if (skill.id !== ID.DODGE || !hasTrait(runtime, TRAIT.RECKLESS_DODGE)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.recklessDodge);
  const strike = requireEffect(profile, 'strike', 'Strike');
  if (strike)
    runtime.emit(
      buildResolverStrike({
        at: runtime.time,
        source: 'Warrior',
        sourceId: TRAIT.RECKLESS_DODGE,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        activationId: cast.id,
        name: 'Reckless Dodge',
        coefficient: effectNumber(profile, strike, 'coefficient'),
        skillWeapon: ''
      })
    );
  castTraitBuff(runtime, cast, TRAIT.RECKLESS_DODGE, PROFILE.recklessDodge, 'Reckless Dodge — Might', 'might', 'boon');
}

/** One-bar elites reserve only the authored cost; Core reserves the whole pool for the activation's tier. */
function burstAdrenalineSpend(runtime: WarriorRuntime, skill: WarriorSkill): number {
  const available = runtime.profession.core.adrenaline;
  return skill.primalBurst || ['Spellbreaker', 'Paragon'].includes(runtime.profession.specialization.kind)
    ? Math.min(available, Number(skill.adrenalineCost ?? 0))
    : available;
}

/** Tier-dependent packets and fields use the same activation-time resource thresholds. */
function burstTier(runtime: WarriorRuntime, spent: number): number {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.burstTiers);
  return spent >= balanceProfileNumber(profile, 'maximumStacks')
    ? 3
    : spent >= balanceProfileNumber(profile, 'threshold')
      ? 2
      : 1;
}

/** Each pulse checks current recharge and then schedules only its next occurrence, preserving cadence while suppressed. */
function signetPulse(runtime: WarriorRuntime): void {
  if ((runtime.cooldowns.get(ID.SIGNET_OF_RAGE) ?? 0) <= runtime.time) grantWarriorAdrenaline(runtime, 2);
  runtime.profession.core.nextSignetPulseAt = canonicalTime(runtime.time + 3);
  runtime.schedule(SIGNET_PULSE, runtime.profession.core.nextSignetPulseAt, null, undefined, -220);
}

/** Empower Allies owns one next wake; removing its Might or disabling cadence cannot leave a recurring task. */
function empowerPulse(runtime: WarriorRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.empowerAllies);
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  const might = requireEffect(profile, 'boon', 'might');
  if (!hasTrait(runtime, TRAIT.EMPOWER_ALLIES) || interval <= 0 || !might) return;
  const event = {
    type: 'buff' as const,
    at: runtime.time,
    source: 'Trait',
    sourceId: TRAIT.EMPOWER_ALLIES,
    actorType: 'effect' as const,
    name: 'Empower Allies',
    kind: 'might',
    stacks: effectNumber(profile, might, 'stacks'),
    duration: effectNumber(profile, might, 'duration'),
    audience: { recipients: 'party' as const }
  };
  runtime.emitProcedural(event);
  runtime.schedule(EMPOWER_PULSE, canonicalTime(runtime.time + interval), null, undefined, -210);
}

/** The shared swap commits its destination first; Core then resets Focus, grants adrenaline, and claims Fury once. */
function weaponSwapTraits(runtime: WarriorRuntime, cast: RuntimeCast): void {
  const state = runtime.profession.core;
  if (hasTrait(runtime, TRAIT.MARTIAL_CADENCE)) state.soldierFocusReadyAt = runtime.time;
  if (hasTrait(runtime, TRAIT.VERSATILE_RAGE))
    grantWarriorAdrenaline(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.VERSATILE_RAGE), 'resourceGain')
    );
  if (!hasTrait(runtime, TRAIT.FURIOUS_BURST)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.furiousBurst);
  if (!runtime.procs.claim(PROFILE.furiousBurst)) return;
  const fury = requireEffect(profile, 'boon', 'fury');
  if (!fury) return;
  const event = {
    type: 'buff' as const,
    at: runtime.time,
    source: 'Trait',
    sourceId: TRAIT.FURIOUS_BURST,
    actorType: 'effect' as const,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id,
    name: 'Furious Burst',
    kind: 'fury',
    stacks: effectNumber(profile, fury, 'stacks'),
    duration: effectNumber(profile, fury, 'duration')
  };
  queueResolverBoon(runtime, event, event);
}

/** Core resources and burst packets execute in the Core hooks; elite behavior composes at the family boundary. */
export const warriorCoreHooks: Partial<RuntimeProfession<WarriorRuntimeState>> = {
  // Custom verbs keep specialization-dependent resource conversion and catalog-matched targets in their owner.
  sideEffectHandlers: {
    'warrior.adrenaline'(runtime, _cast, action) {
      if (action.type !== 'warrior.adrenaline' || action.amount == null)
        throw new TypeError('Adrenaline grants require an amount.');
      grantWarriorAdrenaline(runtime, sideEffectAmount(runtime, action.amount));
    },
    'warrior.rifle-restock'(runtime) {
      for (const skill of runtime.helpers.skills) {
        if (skill.weapon === 'Rifle' && skill.ammo)
          runtime.cooldownController.restoreAmmo(skill, 1, runtime.time, 'reset');
        if (skill.id === ID.KILL_SHOT || skill.id === ID.GUN_FLAME) runtime.cooldownController.clear(skill.id);
      }
    }
  },
  // Only an authored measurement and an eligible active offhand can replace the selected duration.
  castDurationMs(runtime, skill, durationMs) {
    const measured = Number(skill.dualWieldCastTimeMs);
    const offhand = gw2ConfiguredWeaponSet(runtime.config, runtime.activeWeaponSet)[1];
    return measured > 0 &&
      hasTrait(runtime, TRAIT.DUAL_WIELDING) &&
      ['Axe', 'Dagger', 'Mace', 'Sword'].includes(String(offhand))
      ? measured
      : durationMs;
  },
  initialize(runtime) {
    if (hasTrait(runtime, TRAIT.EMPOWER_ALLIES)) runtime.schedule(EMPOWER_PULSE, 0, null, undefined, -210);
  },
  endurance: {
    state: (runtime) => runtime.profession.core,
    maximum: () => 100,
    regenerationRate(runtime, vigor) {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
      return (
        balanceProfileNumber(profile, 'enduranceRegenerationPerSecond') *
        (vigor ? balanceProfileNumber(profile, 'vigorRegenerationMultiplier') : 1)
      );
    }
  },
  onCombatStart(runtime) {
    if (!selectedSkillNameSet(runtime.config.selectedSkills).has('Signet of Rage')) return;
    runtime.profession.core.nextSignetPulseAt = canonicalTime(runtime.time + 3);
    runtime.schedule(SIGNET_PULSE, runtime.profession.core.nextSignetPulseAt, null, undefined, -220);
  },
  // Selected weapon and burst traits share live, patchable recharge rules.
  rechargeRules: [
    {
      trait: TRAIT.VERSATILE_POWER,
      when: (_runtime, skill) => Boolean(skill.burst),
      multiplier: { profile: TRAIT.VERSATILE_POWER, field: 'rechargeMultiplier' }
    },
    ...(
      [
        ['Greatsword', TRAIT.FORCEFUL_GREATSWORD],
        ['Sword', TRAIT.BLADEMASTER],
        ['Axe', TRAIT.AXE_MASTERY]
      ] as const
    ).map(([weapon, trait]) => ({
      trait,
      when: (_runtime: WarriorRuntime, skill: WarriorSkill) => skill.weapon === weapon,
      multiplier: { profile: trait, field: 'rechargeMultiplier' }
    }))
  ],
  rechargeWork: (_runtime, skill, work) => (skill.id === ID.SWAP_WEAPONS ? Math.min(5, work) : work),
  traitTriggers: [
    {
      trait: TRAIT.THICK_SKIN,
      on: 'castStart',
      when: (_runtime, cast) => cast.skill.type === 'Heal',
      emit: TRAIT.THICK_SKIN,
      attribution: { name: 'Thick Skin', priority: 0 }
    },
    {
      trait: TRAIT.SIGNET_MASTERY,
      on: 'castComplete',
      when: (_runtime, cast) => Boolean(cast.skill.categories?.includes('Signet')),
      emit: PROFILE.signetMastery,
      effects: (effect) => effect.type === 'buff' && effect.kind === 'signet-mastery',
      attribution: { name: 'Signet Mastery', priority: 0 }
    },
    {
      trait: TRAIT.LEG_SPECIALIST,
      on: 'condition.applied',
      when: (_runtime, event) => event.condition === 'Crippled',
      emit: TRAIT.LEG_SPECIALIST,
      attribution: { priority: 5 }
    }
  ],
  availability(runtime, rawSkill) {
    const skill = rawSkill as WarriorSkill;
    const state = runtime.profession.core;
    if (skill.id === ID.TACTICAL_BLOW && !skillFlipReady(state.availableFlips[ID.TACTICAL_BLOW], runtime.time))
      return {
        ready: false,
        retryAt: null,
        code: 'warrior.counterblow',
        reason: 'Tactical Blow requires an active Counterblow.'
      };
    // Berserker owns re-entry readiness while its active mode temporarily reduces the resource cap.
    if (
      skill.id === ID.BERSERK &&
      runtime.profession.specialization.kind === 'Berserker' &&
      runtime.profession.specialization.state.berserkActive
    )
      return { ready: true };
    // Bladesworn's own availability rejects weapon bursts and checks its Flow/charge state.
    if (runtime.profession.specialization.kind === 'Bladesworn') return { ready: true };
    const cost = Number(skill.adrenalineCost ?? 0);
    if (state.adrenaline < cost)
      return {
        ready: false,
        retryAt:
          cost <= state.maximumAdrenaline &&
          state.nextSignetPulseAt > runtime.time &&
          Number.isFinite(state.nextSignetPulseAt)
            ? state.nextSignetPulseAt
            : null,
        code: 'warrior.adrenaline',
        reason: `${skill.name} requires ${cost} adrenaline.`
      };
    return { ready: true };
  },
  onCastStart(runtime, cast) {
    startTraits(runtime, cast);
    // Attempting the manual follow-up consumes its occurrence, even if the attack is later canceled.
    if (cast.skill.id === ID.TACTICAL_BLOW) consumeSkillFlip(runtime.profession.core.availableFlips, ID.TACTICAL_BLOW);
    if (cast.skill.burst && !cast.skill.dragonSlash) {
      const state = runtime.profession.core;
      const spent = burstAdrenalineSpend(runtime, cast.skill);
      burstSpends.set(cast, spent);
      state.adrenaline -= spent;
    }
  },
  modifyComboFields(runtime, cast, fields) {
    if (cast.skill.id !== ID.COMBUSTIVE_SHOT) return fields;
    const tier = burstTier(runtime, burstAdrenalineSpend(runtime, cast.skill));
    const duration =
      tier * balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.combustiveShot), 'durationPerTier');
    return fields?.flatMap((field) =>
      field.ownerId !== 'warrior' ? [field] : duration > 0 ? [{ ...field, duration }] : []
    );
  },
  modifyEffects(runtime, cast, effects) {
    // Dragon's Roar commits the available rounds; the shared completion spends the final reserved round once.
    if (cast.skill.id === ID.DRAGONS_ROAR) {
      const ammo = runtime.ammo.get(cast.skill.id);
      const bullets = Math.max(1, Number(ammo?.charges ?? 1));
      if (ammo && ammo.charges > 1) ammo.charges = 1;
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.dragonsRoar);
      const strike = requireEffect(profile, 'strike', 'Strike');
      if (!strike) return [];
      const durationMs = (cast.effectiveEnd - cast.start) * 1000;
      const first = durationMs * balanceProfileNumber(profile, 'firstPacketRatio');
      const interval = durationMs * balanceProfileNumber(profile, 'packetIntervalRatio');
      return [
        {
          type: 'strike',
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          name: "Dragon's Roar — Damage per Bullet",
          damageKind: 'explosion',
          weapon: 'Pistol',
          ticks: Array.from({ length: bullets }, (_, index) => ({
            atMs: first + index * interval,
            coefficient: effectNumber(profile, strike, 'coefficient')
          }))
        }
      ];
    }

    if (!cast.skill.burst || cast.skill.dragonSlash) return effects;
    const spent = burstSpends.get(cast)!;
    const tier = burstTier(runtime, spent);
    if (cast.skill.id === ID.COMBUSTIVE_SHOT) {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.combustiveShot);
      const interval = balanceProfileNumber(profile, 'pulseInterval');
      const pulses = interval > 0 ? tier + 1 : 1;
      // Each selected component keeps its own removal semantics and fixed post-completion cadence.
      const timing = {
        timingAnchor: 'castEnd' as const,
        timingScale: 'fixed' as const,
        persistsAfterInterrupt: true,
        metadata: { warriorAdrenalineSpent: spent, warriorBurstTier: tier }
      };
      const strike = requireEffect(profile, 'strike', 'Strike');
      const burning = requireEffect(profile, 'condition', 'Burning');
      return [
        ...(strike
          ? [
              {
                ...timing,
                type: 'strike' as const,
                weapon: 'Longbow',
                ticks: Array.from({ length: pulses }, (_, index) => ({
                  atMs: index * interval * 1000,
                  coefficient: effectNumber(profile, strike, 'coefficient')
                }))
              }
            ]
          : []),
        ...(burning
          ? [
              {
                ...timing,
                type: 'condition' as const,
                condition: String(burning.condition),
                stacks: effectNumber(profile, burning, 'stacks'),
                duration: effectNumber(profile, burning, 'duration'),
                atMs: 0,
                applications: pulses,
                intervalMs: interval * 1000
              }
            ]
          : [])
      ];
    }

    return effects.flatMap((effect) => {
      const captured = {
        ...effect,
        metadata: { ...effect.metadata, warriorAdrenalineSpent: spent, warriorBurstTier: tier }
      };
      if (cast.skill.id === ID.ARCING_SLICE && effect.type === 'boon' && effect.boon === 'fury')
        return [{ ...captured, duration: Number(effect.duration) * [1, 1.5, 2][tier - 1] }];
      if (cast.skill.id === ID.KILL_SHOT && effect.type === 'strike')
        return [{ ...captured, coefficient: (Number(effect.coefficient) * [2.25, 2.75, 3.25][tier - 1]) / 2.25 }];
      if (cast.skill.id === ID.EVISCERATE && effect.type === 'strike') {
        const profile = requireBalanceProfileFromContext(
          runtime,
          [PROFILE.eviscerateTier1, PROFILE.eviscerateTier2, PROFILE.eviscerateTier3][tier - 1]
        );
        const strike = requireEffect(profile, 'strike', 'Strike');
        return strike ? [{ ...captured, coefficient: effectNumber(profile, strike, 'coefficient') }] : [];
      }

      if (cast.skill.id === ID.BLOODTHIRSTER && effect.type === 'condition' && effect.condition === 'Bleeding') {
        const profile = requireBalanceProfileFromContext(runtime, PROFILE.bloodthirsterTiers);
        const bleeding = requireEffect(profile, 'condition', `Tier ${tier}`);
        return bleeding
          ? [
              {
                ...captured,
                stacks: effectNumber(profile, bleeding, 'stacks'),
                duration: effectNumber(profile, bleeding, 'duration')
              }
            ]
          : [];
      }

      return [captured];
    });
  },
  onCastCommit(runtime, cast) {
    // A committed block may release early; its follow-up inherits the remaining original channel window.
    if (cast.skill.id === ID.COUNTERBLOW && runtime.time < cast.fullEnd && !cast.cancelled) {
      runtime.armFlip(ID.TACTICAL_BLOW, { expiresAt: cast.fullEnd });
    }

    if (!castCompleted(cast)) return;
    // Successful bursts refund the captured spend at completion, independently of target acceptance.
    const spent = burstSpends.get(cast) ?? 0;
    if (cast.skill.burst && cast.skill.id !== ID.FULL_COUNTER && spent > 0 && hasTrait(runtime, TRAIT.BURST_MASTERY)) {
      grantWarriorAdrenaline(
        runtime,
        spent * balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.burstMastery), 'resourceGain')
      );
      // The refund is live now; Swiftness resolves after same-time burst damage, preserving reward ordering.
      castTraitBuff(
        runtime,
        cast,
        TRAIT.BURST_MASTERY,
        PROFILE.burstMastery,
        'Burst Mastery — Swiftness',
        'swiftness',
        'boon',
        runtime.time,
        5
      );
    }
  },
  onCastComplete(runtime, cast) {
    if (!castCompleted(cast)) return;
    completeTraits(runtime, cast);
    if (cast.skill.inputCategory === 'weapon-swap' && !castWasInterrupted(cast)) weaponSwapTraits(runtime, cast);
  },
  onCooldownReset(runtime) {
    runtime.profession.core.adrenaline = runtime.profession.core.maximumAdrenaline;
  },
  tasks: {
    [SIGNET_PULSE]: signetPulse,
    [EMPOWER_PULSE]: empowerPulse
  },
  reactions: {
    'damage.resolving'(runtime, event) {
      // The controlled-target bonus observes accepted control at impact, including control arriving during travel.
      if (
        event.skillId === ID.FIERCE_BLOW &&
        Number(event.coefficient) > 0 &&
        (runtime.config.target?.controlled ||
          runtime.config.target?.defiant ||
          runtime.profession.core.targetControlledUntil > runtime.time)
      )
        return { coefficient: Number(event.coefficient) * 1.5 };
    },
    'damage.resolved'(runtime, event, details) {
      if ((event.actorType === 'player' || event.canTriggerCriticalTraits === true) && Number(event.coefficient) > 0) {
        const firstBurst = firstBurstHit(runtime, event);
        criticalTraits(runtime, event, details?.hitContext as Gw2HitResolutionContext, firstBurst);
      }

      if (
        runtime.profession.specialization.kind !== 'Bladesworn' &&
        (event.actorType === 'player' || event.source === 'Sigil') &&
        Number(event.coefficient) > 0
      )
        grantWarriorAdrenaline(runtime, Math.max(1, Number(event.hits ?? 1)));
      reactToWarriorDamage(runtime, event);
    },
    'buff.applied': reactToWarriorBuff,
    'control.resolved': controlTraits,
    'condition.applied'(runtime, event) {
      if (event.condition === 'Immobilized') opportunist(runtime, event);
    }
  }
};
