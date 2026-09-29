import { advanceCriticalProc, criticalOpportunity } from '#gw2/platform/combat/critical-procs.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { remainingTargetHealthBelow } from '#gw2/platform/combat/state/target-health.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  procChanceFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { buildResolverBuff } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { grantWarriorAdrenaline } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { traitEffects, castTraitBuff, triggerTraitBuffs } from '#gw2/professions/warrior/core/mechanics/emission.js';
import {
  warriorActiveBuffStacks,
  warriorBoonActive,
  warriorWieldingWeapon
} from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import type { WarriorModifierAttributes } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorRuntimeState, WarriorResolverContext, WarriorSkill } from '#gw2/professions/warrior/types.js';
import type { Gw2MutableStats } from '#gw2/platform/combat/types.js';
import { scaleCastBoundTiming } from '#gw2/platform/engine/effects/materializer.js';
import { canonicalTime } from '#kernel/core/clock.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';

// Trigger Lesser Signet of Might after the first eligible below-half-health strike at that strike's exact timestamp.
export function reactToWarriorDamage(context: Gw2Runtime<WarriorRuntimeState>, event: Gw2ResolverEvent): void {
  if (
    event.actorType !== 'player' ||
    !((event.coefficient || 0) > 0) ||
    !remainingTargetHealthBelow(context.config, context, 0.5) ||
    !hasTrait(context, TRAIT.SIGNET_MASTERY)
  ) {
    return;
  }

  const signetMastery = requireBalanceProfileFromContext(context, TRAIT.SIGNET_MASTERY);
  // Reserve this trait's own deadline before emitting its effects.
  if (!context.procs.claim(TRAIT.SIGNET_MASTERY)) return;
  for (const effect of signetMastery.effects || []) {
    const kind = String(effect.boon || effect.kind || '');
    queueResolverBoon(
      context,
      event,
      buildResolverBuff({
        at: event.at,
        priority: 5,
        source: 'Trait',
        sourceId: TRAIT.SIGNET_MASTERY,
        actorType: 'effect',
        skillId: TRAIT.SIGNET_MASTERY,
        skillName: 'Lesser Signet of Might',
        kind,
        stacks: effectNumber(signetMastery, effect, 'stacks'),
        duration: effectNumber(signetMastery, effect, 'duration')
      })
    );
  }

  context.recordProc(
    'trait',
    'Lesser Signet of Might',
    event.at,
    event.skillName,
    '10 might; Signet Mastery stack',
    context.helpers.skillsById.get(ID.SIGNET_OF_MIGHT)?.icon || ''
  );
}

// Resolve Arms-owned attributes, including live signet state and critical-proc stacks.
export function modifyWarriorArmsAttributes(
  context: Gw2ModifierContext,
  result: WarriorModifierAttributes,
  staticRulesApplied: boolean
): void {
  const signetMasteryProfile = requireBalanceProfileFromContext(context, TRAIT.SIGNET_MASTERY);
  const signetStacks = warriorActiveBuffStacks(
    context,
    'signet-mastery',
    balanceProfileNumber(signetMasteryProfile, 'maximumStacks')
  );
  if (hasTrait(context, TRAIT.SIGNET_MASTERY)) {
    result.ferocity += signetStacks * balanceProfileNumber(signetMasteryProfile, 'attributeBonus');
  }

  if (
    hasTrait(context, TRAIT.DEEP_STRIKES) &&
    warriorBoonActive(context, 'fury') &&
    !(staticRulesApplied && Boolean(context.config?.boons?.fury))
  ) {
    const deepStrikesProfile = requireBalanceProfileFromContext(context, TRAIT.DEEP_STRIKES);
    result.conditionDamage += balanceProfileNumber(deepStrikesProfile, 'attributeBonus');
  }

  if (hasTrait(context, TRAIT.BLADEMASTER) && warriorWieldingWeapon(context, 'Sword')) {
    const blademasterProfile = requireBalanceProfileFromContext(context, TRAIT.BLADEMASTER);
    result.conditionDamage += balanceProfileNumber(blademasterProfile, 'attributeBonus');
  }

  const furiousProfile = requireBalanceProfileFromContext(context, TRAIT.FURIOUS);
  result.conditionDamage +=
    warriorActiveBuffStacks(context, 'furious-surge', balanceProfileNumber(furiousProfile, 'maximumStacks')) *
    balanceProfileNumber(furiousProfile, 'attributeBonus');
  if (hasTrait(context, TRAIT.BURST_PRECISION) && warriorActiveBuffStacks(context, 'burst-precision', 1) > 0) {
    const burstPrecisionProfile = requireBalanceProfileFromContext(context, TRAIT.BURST_PRECISION);
    result.ferocity += balanceProfileNumber(burstPrecisionProfile, 'attributeBonus');
  }
}

export function claimTrait(runtime: WarriorRuntime, trait: number): boolean {
  return hasTrait(runtime, trait) && runtime.procs.claim(trait);
}

export function triggerOpportunist(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !claimTrait(runtime, TRAIT.OPPORTUNIST)) return;
  grantWarriorAdrenaline(
    runtime,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.OPPORTUNIST), 'resourceGain')
  );
  traitEffects(runtime, event, TRAIT.OPPORTUNIST);
}

type WarriorRuntime = Gw2Runtime<WarriorRuntimeState>;

/** Apply line-owned rewards at the shared reaction boundary. */
export function burstPrecisionHit(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  const attribution = {
    at: runtime.time,
    priority: 5,
    source: 'Trait',
    actorType: 'effect' as const,
    skillId: event.skillId,
    skillName: event.skillName,
    stacks: 1
  };
  if (hasTrait(runtime, TRAIT.BURST_PRECISION)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.BURST_PRECISION);
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
}

/** Apply line-owned rewards at the shared reaction boundary. */
export function armsCriticalRewards(
  runtime: WarriorRuntime,
  event: Gw2ResolverEvent,
  opportunity: ReturnType<typeof criticalOpportunity>,
  firstBurst: boolean
): void {
  const criticals = opportunity.sampledCriticals;
  if (hasTrait(runtime, TRAIT.BLOODLUST)) {
    const proc = advanceCriticalProc(opportunity, {
      id: 'warrior.core.bloodlust',
      at: runtime.time,
      chanceOnCriticalHit: procChanceFromContext(runtime, TRAIT.BLOODLUST),
      randomStream: 'warrior.bloodlust',
      roll: (chance, stream) => runtime.random.roll(chance, stream)
    });
    if (proc) {
      const profile = requireBalanceProfileFromContext(runtime, TRAIT.BLOODLUST);
      const bleeding = requireEffect(profile, 'condition', 'Bleeding');
      if (bleeding)
        traitEffects(
          runtime,
          event,
          TRAIT.BLOODLUST,
          {
            name: 'Bloodlust \u2014 Bleeding',
            skillName: 'Bloodlust',
            triggeredBy: event.skillName,
            metadata: { procCount: proc.quantity }
          },
          proc.quantity,
          [bleeding]
        );
    }
  }

  if (criticals > 0 && hasTrait(runtime, TRAIT.FURIOUS)) {
    grantWarriorAdrenaline(
      runtime,
      criticals * balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.FURIOUS), 'resourceGain')
    );
    traitEffects(runtime, event, TRAIT.FURIOUS, {}, criticals);
  }

  if (firstBurst && claimTrait(runtime, TRAIT.SUNDERING_BURST)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.SUNDERING_BURST);
    const effect = requireEffect(profile, 'condition', criticals > 0 ? 'Critical burst' : 'Burst');
    if (effect)
      traitEffects(runtime, event, TRAIT.SUNDERING_BURST, { name: 'Sundering Burst — Vulnerability' }, 1, [effect]);
  }
}

/** Apply line-owned rewards at the shared reaction boundary. */
export function mercilessHammerControl(runtime: WarriorRuntime): void {
  if (hasTrait(runtime, TRAIT.MERCILESS_HAMMER))
    grantWarriorAdrenaline(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.MERCILESS_HAMMER), 'resourceGain')
    );
}

/** Apply line-owned rewards at the shared reaction boundary. */
export function cullTheWeakBurst(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (hasTrait(runtime, TRAIT.CULL_THE_WEAK) && runtime.procs.claim(TRAIT.CULL_THE_WEAK))
    traitEffects(runtime, event, TRAIT.CULL_THE_WEAK);
}

/** Apply line-owned rewards at the shared reaction boundary. */
export function axeMasteryCritical(runtime: WarriorRuntime, event: Gw2ResolverEvent, criticals: number): void {
  if (criticals > 0 && hasTrait(runtime, TRAIT.AXE_MASTERY)) {
    const skill = runtime.helpers.skillsById.get(event.skillId ?? '');
    if ((skill?.skillWeapon || skill?.weapon || event.skillWeapon) === 'Axe')
      grantWarriorAdrenaline(
        runtime,
        criticals * balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.AXE_MASTERY), 'resourceGain')
      );
  }
}

/** Apply line-owned rewards at the shared reaction boundary. */
export function versatileRageSwap(runtime: WarriorRuntime): void {
  if (hasTrait(runtime, TRAIT.VERSATILE_RAGE))
    grantWarriorAdrenaline(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.VERSATILE_RAGE), 'resourceGain')
    );
}

/** Refund the captured burst spend before later completion rewards. */
export function burstMasteryCommit(runtime: WarriorRuntime, cast: RuntimeCast, spent: number): void {
  if (cast.skill.burst && cast.skill.id !== ID.FULL_COUNTER && spent > 0 && hasTrait(runtime, TRAIT.BURST_MASTERY)) {
    grantWarriorAdrenaline(
      runtime,
      spent * balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.BURST_MASTERY), 'resourceGain')
    );
    // The refund is live now; Swiftness resolves after same-time burst damage, preserving reward ordering.
    castTraitBuff(
      runtime,
      cast,
      TRAIT.BURST_MASTERY,
      TRAIT.BURST_MASTERY,
      'Burst Mastery — Swiftness',
      'swiftness',
      'boon',
      runtime.time,
      5
    );
  }
}

/** Dragon Slash refunds its captured Flow pool using the elite tuning. */
export function burstMasteryDragonSlash(
  runtime: WarriorRuntime,
  cast: RuntimeCast,
  release: { flowSpent: number }
): void {
  if (hasTrait(runtime, TRAIT.BURST_MASTERY)) {
    grantWarriorAdrenaline(
      runtime,
      release.flowSpent *
        balanceProfileNumber(
          requireBalanceProfileFromContext(runtime, 'warrior.bladesworn.burst-mastery'),
          'resourceGain'
        )
    );
    triggerTraitBuffs(runtime, cast, TRAIT.BURST_MASTERY, undefined, 5);
  }
}

export function reactToWarriorBuff(context: WarriorResolverContext, event: Gw2ResolverEvent): void {
  if (Number(event.sourceId) !== TRAIT.PEAK_PERFORMANCE || event.kind !== 'peak-performance') return;
  context.recordProc('trait', 'Peak Performance', event.at, event.skillName, '+10% strike damage for 6 seconds');
}

// Resolve Strength-owned attributes without hiding their formulas in the cross-line composer.
export function modifyWarriorStrengthAttributes(
  context: Gw2ModifierContext,
  result: WarriorModifierAttributes,
  staticRulesApplied: boolean,
  gearPower: number
): void {
  if (hasTrait(context, TRAIT.PINNACLE_OF_STRENGTH)) {
    const pinnacleOfStrengthProfile = requireBalanceProfileFromContext(context, TRAIT.PINNACLE_OF_STRENGTH);
    result.power +=
      (context.query?.mightStacksAt(context.time, context.runtime, context.event) || 0) *
      balanceProfileNumber(pinnacleOfStrengthProfile, 'attributeBonus');
  }

  if (hasTrait(context, TRAIT.FORCEFUL_GREATSWORD) && !staticRulesApplied) {
    const forcefulGreatswordProfile = requireBalanceProfileFromContext(context, TRAIT.FORCEFUL_GREATSWORD);
    result.power +=
      balanceProfileNumber(forcefulGreatswordProfile, 'attributeBonus') +
      Number(warriorWieldingWeapon(context, 'Greatsword')) *
        balanceProfileNumber(forcefulGreatswordProfile, 'weaponAttributeBonus');
  }

  if (hasTrait(context, TRAIT.GREAT_FORTITUDE) && !staticRulesApplied) {
    const greatFortitudeProfile = requireBalanceProfileFromContext(context, TRAIT.GREAT_FORTITUDE);
    // Static builds already bake this gear-only conversion; live Might and signets must not feed it.
    const conversion = balanceProfileNumber(greatFortitudeProfile, 'attributeConversion');
    result.vitality += gearPower * conversion;
    result.ferocity += gearPower * conversion;
  }
}

export function startTraits(runtime: WarriorRuntime, cast: RuntimeCast): void {
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
    TRAIT.PEAK_PERFORMANCE,
    'Peak Performance',
    'peak-performance',
    'buff',
    at
  );
}

export function completeTraits(runtime: WarriorRuntime, cast: RuntimeCast): void {
  const skill = cast.skill;
  if (hasTrait(runtime, TRAIT.BRAVE_STRIDE) && skill.movementSkill) {
    grantWarriorAdrenaline(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.BRAVE_STRIDE), 'resourceGain')
    );
    castTraitBuff(runtime, cast, TRAIT.BRAVE_STRIDE, TRAIT.BRAVE_STRIDE, 'Brave Stride', 'stability', 'boon');
  }
}

/** Apply line-owned rewards at the shared reaction boundary. */
export function buildingMomentumBurst(runtime: WarriorRuntime): void {
  if (hasTrait(runtime, TRAIT.BUILDING_MOMENTUM))
    runtime.endurance.grant(
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.BUILDING_MOMENTUM), 'resourceGain')
    );
}

/** Apply line-owned rewards at the shared reaction boundary. */
export function berserkersPowerBurst(runtime: WarriorRuntime, event: Gw2ResolverEvent, skill: WarriorSkill): void {
  if (
    !skill.dragonSlash &&
    hasTrait(runtime, TRAIT.BERSERKERS_POWER) &&
    Number(event.metadata?.warriorAdrenalineSpent) > 0
  )
    traitEffects(runtime, event, TRAIT.BERSERKERS_POWER, { stacks: Number(event.metadata?.warriorBurstTier) + 1 });
}

/** Apply line-owned rewards at the shared reaction boundary. */
export function forcefulGreatswordCritical(
  runtime: WarriorRuntime,
  event: Gw2ResolverEvent,
  opportunity: ReturnType<typeof criticalOpportunity>
): void {
  if (hasTrait(runtime, TRAIT.FORCEFUL_GREATSWORD)) {
    const weapons = gw2ConfiguredWeaponSet(runtime.config, runtime.activeWeaponSet);
    const chance = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, TRAIT.FORCEFUL_GREATSWORD),
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

/** Berserk's live power pool participates in Great Fortitude's conversion. */
export function convertBerserkPower(
  context: Gw2ModifierContext,
  result: Gw2MutableStats & { ferocity: number },
  powerBonus: number
): void {
  if (hasTrait(context, TRAIT.GREAT_FORTITUDE)) {
    const greatFortitudeProfile = requireBalanceProfileFromContext(context, TRAIT.GREAT_FORTITUDE);
    const conversion = balanceProfileNumber(greatFortitudeProfile, 'attributeConversion');
    result.vitality = (result.vitality || 0) + powerBonus * conversion;
    result.ferocity += powerBonus * conversion;
  }
}

/** Dragon Slash grants the charge-converted reward at completion. */
export function berserkersPowerDragonSlash(runtime: WarriorRuntime, cast: RuntimeCast, adrenalineSpent: number): void {
  triggerTraitBuffs(runtime, cast, TRAIT.BERSERKERS_POWER, adrenalineSpent / 10 + 1, 5);
}

export const EMPOWER_PULSE = 'warrior.empower-allies-pulse';

// Resolve Tactics-owned attributes without hiding their formulas in the cross-line composer.
export function modifyWarriorTacticsAttributes(
  context: Gw2ModifierContext,
  result: WarriorModifierAttributes,
  staticRulesApplied: boolean
): void {
  if (hasTrait(context, TRAIT.ROARING_REVEILLE) && !staticRulesApplied) {
    const roaringReveilleProfile = requireBalanceProfileFromContext(context, TRAIT.ROARING_REVEILLE);
    result.concentration += balanceProfileNumber(roaringReveilleProfile, 'attributeBonus');
  }
}

export function empowerPulse(runtime: WarriorRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.EMPOWER_ALLIES);
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  const might = requireEffect(profile, 'boon', 'might');
  if (!hasTrait(runtime, TRAIT.EMPOWER_ALLIES) || interval <= 0 || !might) return;
  traitEffects(
    runtime,
    { type: 'buff', at: runtime.time, source: 'Trait', sourceId: TRAIT.EMPOWER_ALLIES, actorType: 'effect' },
    TRAIT.EMPOWER_ALLIES,
    { priority: 0, audience: { recipients: 'party' } },
    1,
    [might]
  );
  runtime.schedule(EMPOWER_PULSE, canonicalTime(runtime.time + interval), null, undefined, -210);
}

/** Apply line-owned rewards at the shared reaction boundary. */
export function soldierFocusBurst(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (
    hasTrait(runtime, TRAIT.MARCHING_ORDERS) &&
    runtime.procs.claim(TRAIT.MARCHING_ORDERS, 'warrior.core.soldierFocus', runtime.time)
  ) {
    // All Soldier's Focus rewards share the claim; Martial Cadence still owns its explicit swap resets.
    const audience = { recipients: 'party' as const };
    traitEffects(runtime, event, TRAIT.MARCHING_ORDERS, { audience });
    if (hasTrait(runtime, TRAIT.SOLDIERS_COMFORT)) traitEffects(runtime, event, TRAIT.SOLDIERS_COMFORT, { audience });
    if (hasTrait(runtime, TRAIT.MARTIAL_CADENCE)) traitEffects(runtime, event, TRAIT.MARTIAL_CADENCE, { audience });
  }
}

/** Apply line-owned rewards at the shared reaction boundary. */
export function resetSoldierFocus(runtime: WarriorRuntime): void {
  if (hasTrait(runtime, TRAIT.MARTIAL_CADENCE)) runtime.procs.readyAt['warrior.core.soldierFocus'] = runtime.time;
}

/** Arm the first selected pulse after the Core pool is initialized. */
export function initializeEmpowerAllies(runtime: WarriorRuntime): void {
  if (hasTrait(runtime, TRAIT.EMPOWER_ALLIES)) runtime.schedule(EMPOWER_PULSE, 0, null, undefined, -210);
}

/** Control events trigger Defense and Strength rewards; derived conditions reenter the common queue. */
export function controlTraits(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player') return;
  triggerOpportunist(runtime, event);
  mercilessHammerControl(runtime);
}

/** The first surviving burst strike claims its activation once, even when earlier packets missed or traveled. */
export function firstBurstHit(runtime: WarriorRuntime, event: Gw2ResolverEvent): boolean {
  const skill = runtime.helpers.skillsById.get(event.skillId ?? '');
  if (!skill?.burst || event.activationId == null) return false;
  const state = runtime.profession.core;
  const key = event.activationId;
  if (state.burstHitActivations[key]) return false;
  state.burstHitActivations[key] = true;

  cullTheWeakBurst(runtime, event);
  burstPrecisionHit(runtime, event);

  buildingMomentumBurst(runtime);
  soldierFocusBurst(runtime, event);

  // Dragon Slash owns its charge-converted reward at completion rather than first impact.
  berserkersPowerBurst(runtime, event, skill);
  return true;
}

/** Every critical consumer uses the same resolved hit fact; only independent trait chances draw additional rolls. */
export function criticalTraits(
  runtime: WarriorRuntime,
  event: Gw2ResolverEvent,
  hit: Gw2HitResolutionContext,
  firstBurst: boolean
): void {
  const opportunity = criticalOpportunity(
    hit.critEligible ? hit.critical.chance : 0,
    hit.critical.didCrit,
    Math.max(1, event.hits ?? 1)
  );
  const criticals = opportunity.sampledCriticals;

  armsCriticalRewards(runtime, event, opportunity, firstBurst);

  axeMasteryCritical(runtime, event, criticals);

  forcefulGreatswordCritical(runtime, event, opportunity);
}

/** The shared swap commits its destination first; Core then resets Focus and grants adrenaline. */
export function weaponSwapTraits(runtime: WarriorRuntime): void {
  resetSoldierFocus(runtime);
  versatileRageSwap(runtime);
}
