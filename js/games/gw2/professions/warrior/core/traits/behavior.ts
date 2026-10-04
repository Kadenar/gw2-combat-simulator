import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { advanceCriticalProc, criticalOpportunity } from '#gw2/platform/combat/critical-procs.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  procChanceFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { buildResolverBuff } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { grantWarriorAdrenaline } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';

import type { Gw2MutableStats } from '#gw2/platform/combat/types.js';
import { scaleCastBoundTiming } from '#gw2/platform/engine/effects/materializer.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import type { WarriorModifierAttributes } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import {
  warriorActiveBuffStacks,
  warriorBoonActive,
  warriorWieldingWeapon
} from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorResolverContext, WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

// Trigger Lesser Signet of Might after the first eligible below-half-health strike at that strike's exact timestamp.
export function reactToWarriorDamage(
  context: MechanicContext<WarriorRuntimeState, WarriorSkill>,
  event: Gw2ResolverEvent
): void {
  if (
    event.actorType !== 'player' ||
    !((event.coefficient || 0) > 0) ||
    !context.combat.targetHealthBelow(0.5) ||
    !hasTrait(context, TRAIT.SIGNET_MASTERY)
  ) {
    return;
  }

  const signetMastery = requireBalanceProfileFromContext(context, TRAIT.SIGNET_MASTERY);
  // Reserve this trait's own deadline before emitting its effects.
  if (!context.procs.claim(TRAIT.SIGNET_MASTERY)) return;
  for (const effect of signetMastery.effects || []) {
    const kind = String(effect.boon || effect.kind || '');
    context.effects.emit({
      kind: 'packet',
      durationContext: event,
      event: buildResolverBuff({
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
    });
  }

  context.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Lesser Signet of Might',
      at: event.at,
      sourceSkill: event.skillName,
      detail: '10 might; Signet Mastery stack',
      icon: context.helpers.skillsById.get(ID.SIGNET_OF_MIGHT)?.icon || ''
    }
  });
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
  {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.OPPORTUNIST);
    runtime.effects.emit({
      kind: 'profile',
      profile: traitProfile,
      effects: traitProfile.effects?.filter((effect) => ['boon', 'buff', 'condition'].includes(effect.type)),
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.OPPORTUNIST,
        actorType: 'effect',
        skillId: event.skillId,
        skillName: event.skillName
      },
      cause: event,
      transform: (packet) => ({ ...packet, priority: 5, name: traitProfile.name, stacks: 1 * Number(packet.stacks) })
    });
  }
}

type WarriorRuntime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

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
    runtime.effects.emit({
      kind: 'packet',
      cause: event,
      event: {
        ...attribution,
        sourceId: TRAIT.BURST_PRECISION,
        type: 'buff',
        name: 'Burst Precision',
        kind: 'burst-precision',
        duration: balanceProfileNumber(
          profile,
          Number(event.metadata?.warriorAdrenalineSpent) >= 30 ? 'maximumStacks' : 'minimumStacks'
        )
      }
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
      if (bleeding) {
        const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.BLOODLUST);
        runtime.effects.emit({
          kind: 'profile',
          profile: traitProfile,
          effects: [bleeding],
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.BLOODLUST,
            actorType: 'effect',
            skillId: event.skillId,
            skillName: event.skillName
          },
          cause: event,
          transform: (packet) => ({
            ...packet,
            priority: 5,
            stacks: proc.quantity * Number(packet.stacks),
            name: 'Bloodlust \u2014 Bleeding',
            skillName: 'Bloodlust',
            triggeredBy: event.skillName,
            metadata: { procCount: proc.quantity }
          })
        });
      }
    }
  }

  if (criticals > 0 && hasTrait(runtime, TRAIT.FURIOUS)) {
    grantWarriorAdrenaline(
      runtime,
      criticals * balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.FURIOUS), 'resourceGain')
    );
    {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.FURIOUS);
      runtime.effects.emit({
        kind: 'profile',
        profile: traitProfile,
        effects: traitProfile.effects?.filter((effect) => ['boon', 'buff', 'condition'].includes(effect.type)),
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.FURIOUS,
          actorType: 'effect',
          skillId: event.skillId,
          skillName: event.skillName
        },
        cause: event,
        transform: (packet) => ({
          ...packet,
          priority: 5,
          name: traitProfile.name,
          stacks: criticals * Number(packet.stacks)
        })
      });
    }
  }

  if (firstBurst && claimTrait(runtime, TRAIT.SUNDERING_BURST)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.SUNDERING_BURST);
    const effect = requireEffect(profile, 'condition', criticals > 0 ? 'Critical burst' : 'Burst');
    if (effect) {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.SUNDERING_BURST);
      runtime.effects.emit({
        kind: 'profile',
        profile: traitProfile,
        effects: [effect],
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.SUNDERING_BURST,
          actorType: 'effect',
          skillId: event.skillId,
          skillName: event.skillName
        },
        cause: event,
        transform: (packet) => ({
          ...packet,
          priority: 5,
          stacks: 1 * Number(packet.stacks),
          name: 'Sundering Burst — Vulnerability'
        })
      });
    }
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
  if (hasTrait(runtime, TRAIT.CULL_THE_WEAK) && runtime.procs.claim(TRAIT.CULL_THE_WEAK)) {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.CULL_THE_WEAK);
    runtime.effects.emit({
      kind: 'profile',
      profile: traitProfile,
      effects: traitProfile.effects?.filter((effect) => ['boon', 'buff', 'condition'].includes(effect.type)),
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.CULL_THE_WEAK,
        actorType: 'effect',
        skillId: event.skillId,
        skillName: event.skillName
      },
      cause: event,
      transform: (packet) => ({ ...packet, priority: 5, name: traitProfile.name, stacks: 1 * Number(packet.stacks) })
    });
  }
}

/**
 * Heightened Focus: the first player strike after its internal cooldown that lands while the target is below half
 * health grants Quickness and readies every Burst skill, so execute phases can chain bursts. The adrenaline-scaled
 * outgoing-healing stacks are support-only and intentionally not modeled.
 */
export function triggerHeightenedFocus(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (
    event.actorType !== 'player' ||
    !((event.coefficient || 0) > 0) ||
    !hasTrait(runtime, TRAIT.HEIGHTENED_FOCUS) ||
    !runtime.combat.targetHealthBelow(0.5) ||
    !runtime.procs.claim(TRAIT.HEIGHTENED_FOCUS)
  )
    return;
  {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.HEIGHTENED_FOCUS);
    runtime.effects.emit({
      kind: 'profile',
      profile: traitProfile,
      effects: traitProfile.effects?.filter((effect) => ['boon', 'buff', 'condition'].includes(effect.type)),
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.HEIGHTENED_FOCUS,
        actorType: 'effect',
        skillId: event.skillId,
        skillName: event.skillName
      },
      cause: event,
      transform: (packet) => ({ ...packet, priority: 5, name: traitProfile.name, stacks: 1 * Number(packet.stacks) })
    });
  }

  // The live catalog defines which skills are bursts, including elite primal bursts and chants.
  for (const skill of runtime.helpers.skills) if (skill.burst) runtime.cooldownController.clear(skill.id);
  runtime.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Heightened Focus',
      at: event.at,
      sourceSkill: event.skillName,
      detail: 'quickness; Burst skills recharged'
    }
  });
}

/**
 * In game a burst's recharge begins at activation, so a Heightened Focus trigger during that burst's own cast also
 * readies it. The simulator commits recharge at completion, before this hook, so the burst is cleared again here when
 * the latest trigger (recovered from the proc deadline) falls inside its cast window.
 */
export function readyHeightenedFocusBurst(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  if (!cast.skill.burst || !hasTrait(runtime, TRAIT.HEIGHTENED_FOCUS)) return;
  const readyAt = runtime.procs.deadline(TRAIT.HEIGHTENED_FOCUS);
  if (!(readyAt > 0)) return;
  // Canonicalize subtraction roundoff without admitting procs outside the cast window.
  const triggeredAt = canonicalTime(
    readyAt -
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.HEIGHTENED_FOCUS), 'internalCooldown')
  );
  if (triggeredAt >= canonicalTime(cast.start) && triggeredAt <= canonicalTime(runtime.time))
    runtime.cooldownController.clear(cast.skill.id);
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
export function burstMasteryCommit(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>, spent: number): void {
  if (cast.skill.burst && cast.skill.id !== ID.FULL_COUNTER && spent > 0 && hasTrait(runtime, TRAIT.BURST_MASTERY)) {
    grantWarriorAdrenaline(
      runtime,
      spent * balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.BURST_MASTERY), 'resourceGain')
    );
    // The refund is live now; Swiftness resolves after same-time burst damage, preserving reward ordering.
    {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.BURST_MASTERY);
      const selectedEffect = requireEffect(traitProfile, 'boon', 'swiftness');
      if (selectedEffect)
        runtime.effects.emit({
          kind: 'profile',
          profile: traitProfile,
          effects: [selectedEffect],
          at: runtime.time,
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.BURST_MASTERY,
            actorType: 'effect',
            skillId: cast.skill.id,
            skillName: cast.skill.name,
            activationId: cast.id
          },
          transform: (event) => ({ ...event, name: 'Burst Mastery — Swiftness', priority: 5 })
        });
    }
  }
}

/** Dragon Slash refunds its captured Flow pool using the elite tuning. */
export function burstMasteryDragonSlash(
  runtime: WarriorRuntime,
  cast: RuntimeCast<WarriorSkill>,
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
    {
      if (hasTrait(runtime, TRAIT.BURST_MASTERY)) {
        const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.BURST_MASTERY);
        runtime.effects.emit({
          kind: 'profile',
          profile: traitProfile,
          effects: traitProfile.effects?.filter((effect) => effect.type === 'boon' || effect.type === 'buff'),
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.BURST_MASTERY,
            actorType: 'effect',
            skillId: cast.skill.id,
            skillName: cast.skill.name,
            activationId: cast.id
          },
          transform: (event) => ({ ...event, name: traitProfile.name, stacks: event.stacks, priority: 5 })
        });
      }
    }
  }
}

export function reactToWarriorBuff(context: WarriorResolverContext, event: Gw2ResolverEvent): void {
  if (Number(event.sourceId) !== TRAIT.PEAK_PERFORMANCE || event.kind !== 'peak-performance') return;
  context.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Peak Performance',
      at: event.at,
      sourceSkill: event.skillName,
      detail: '+10% strike damage for 6 seconds'
    }
  });
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

export function startTraits(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
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

  {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.PEAK_PERFORMANCE);
    const selectedEffect = requireEffect(traitProfile, 'buff', 'peak-performance');
    if (selectedEffect)
      runtime.effects.emit({
        kind: 'profile',
        profile: traitProfile,
        effects: [selectedEffect],
        at: at,
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.PEAK_PERFORMANCE,
          actorType: 'effect',
          skillId: cast.skill.id,
          skillName: cast.skill.name,
          activationId: cast.id
        },
        transform: (event) => ({ ...event, name: 'Peak Performance', priority: 0 })
      });
  }
}

export function completeTraits(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  const skill = cast.skill;
  if (hasTrait(runtime, TRAIT.BRAVE_STRIDE) && skill.movementSkill) {
    grantWarriorAdrenaline(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.BRAVE_STRIDE), 'resourceGain')
    );
    {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.BRAVE_STRIDE);
      const selectedEffect = requireEffect(traitProfile, 'boon', 'stability');
      if (selectedEffect)
        runtime.effects.emit({
          kind: 'profile',
          profile: traitProfile,
          effects: [selectedEffect],
          at: runtime.time,
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.BRAVE_STRIDE,
            actorType: 'effect',
            skillId: cast.skill.id,
            skillName: cast.skill.name,
            activationId: cast.id
          },
          transform: (event) => ({ ...event, name: 'Brave Stride', priority: 0 })
        });
    }
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
  ) {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.BERSERKERS_POWER);
    runtime.effects.emit({
      kind: 'profile',
      profile: traitProfile,
      effects: traitProfile.effects?.filter((effect) => ['boon', 'buff', 'condition'].includes(effect.type)),
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.BERSERKERS_POWER,
        actorType: 'effect',
        skillId: event.skillId,
        skillName: event.skillName
      },
      cause: event,
      transform: (packet) => ({
        ...packet,
        priority: 5,
        name: traitProfile.name,
        stacks: Number(event.metadata?.warriorBurstTier) + 1
      })
    });
  }
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
    if (proc) {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.FORCEFUL_GREATSWORD);
      runtime.effects.emit({
        kind: 'profile',
        profile: traitProfile,
        effects: traitProfile.effects?.filter((effect) => ['boon', 'buff', 'condition'].includes(effect.type)),
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.FORCEFUL_GREATSWORD,
          actorType: 'effect',
          skillId: event.skillId,
          skillName: event.skillName
        },
        cause: event,
        transform: (packet) => ({
          ...packet,
          priority: 5,
          name: traitProfile.name,
          stacks: proc.quantity * Number(packet.stacks)
        })
      });
    }
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
export function berserkersPowerDragonSlash(
  runtime: WarriorRuntime,
  cast: RuntimeCast<WarriorSkill>,
  adrenalineSpent: number
): void {
  {
    if (hasTrait(runtime, TRAIT.BERSERKERS_POWER)) {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.BERSERKERS_POWER);
      runtime.effects.emit({
        kind: 'profile',
        profile: traitProfile,
        effects: traitProfile.effects?.filter((effect) => effect.type === 'boon' || effect.type === 'buff'),
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.BERSERKERS_POWER,
          actorType: 'effect',
          skillId: cast.skill.id,
          skillName: cast.skill.name,
          activationId: cast.id
        },
        transform: (event) => ({ ...event, name: traitProfile.name, stacks: adrenalineSpent / 10 + 1, priority: 5 })
      });
    }
  }
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
  {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.EMPOWER_ALLIES);
    runtime.effects.emit({
      kind: 'profile',
      profile: traitProfile,
      effects: [might],
      attribution: { source: 'Trait', sourceId: TRAIT.EMPOWER_ALLIES, actorType: 'effect' },
      cause: { type: 'buff', at: runtime.time, source: 'Trait', sourceId: TRAIT.EMPOWER_ALLIES, actorType: 'effect' },
      transform: (packet) => ({
        ...packet,
        name: traitProfile.name,
        stacks: 1 * Number(packet.stacks),
        priority: 0,
        audience: { recipients: 'party' }
      })
    });
  }

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
    {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.MARCHING_ORDERS);
      runtime.effects.emit({
        kind: 'profile',
        profile: traitProfile,
        effects: traitProfile.effects?.filter((effect) => ['boon', 'buff', 'condition'].includes(effect.type)),
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.MARCHING_ORDERS,
          actorType: 'effect',
          skillId: event.skillId,
          skillName: event.skillName
        },
        cause: event,
        transform: (packet) => ({
          ...packet,
          priority: 5,
          name: traitProfile.name,
          stacks: 1 * Number(packet.stacks),
          audience
        })
      });
    }

    if (hasTrait(runtime, TRAIT.SOLDIERS_COMFORT)) {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.SOLDIERS_COMFORT);
      runtime.effects.emit({
        kind: 'profile',
        profile: traitProfile,
        effects: traitProfile.effects?.filter((effect) => ['boon', 'buff', 'condition'].includes(effect.type)),
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.SOLDIERS_COMFORT,
          actorType: 'effect',
          skillId: event.skillId,
          skillName: event.skillName
        },
        cause: event,
        transform: (packet) => ({
          ...packet,
          priority: 5,
          name: traitProfile.name,
          stacks: 1 * Number(packet.stacks),
          audience
        })
      });
    }

    if (hasTrait(runtime, TRAIT.MARTIAL_CADENCE)) {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.MARTIAL_CADENCE);
      runtime.effects.emit({
        kind: 'profile',
        profile: traitProfile,
        effects: traitProfile.effects?.filter((effect) => ['boon', 'buff', 'condition'].includes(effect.type)),
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.MARTIAL_CADENCE,
          actorType: 'effect',
          skillId: event.skillId,
          skillName: event.skillName
        },
        cause: event,
        transform: (packet) => ({
          ...packet,
          priority: 5,
          name: traitProfile.name,
          stacks: 1 * Number(packet.stacks),
          audience
        })
      });
    }
  }
}

/** Apply line-owned rewards at the shared reaction boundary. */
export function resetSoldierFocus(runtime: WarriorRuntime): void {
  if (hasTrait(runtime, TRAIT.MARTIAL_CADENCE)) runtime.procs.setDeadline('warrior.core.soldierFocus', runtime.time);
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
