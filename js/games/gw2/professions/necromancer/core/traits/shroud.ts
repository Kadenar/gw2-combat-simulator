import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { cloneNecromancerAttributes } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { emitNecromancerShroudTrait } from '#gw2/professions/necromancer/core/mechanics/trait-effects.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerConfig,
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** The first accepted player strike of a mark contributes to the shared percentage grant. */
export function soulMarksLifeForce(
  runtime: NecromancerRuntime,
  skill: NecromancerSkill,
  event: NecromancerResolverEvent
): number {
  return Number(event.hitIndex ?? 1) === 1 && skill.categories?.includes('Mark') && hasTrait(runtime, TRAIT.SOUL_MARKS)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SOUL_MARKS), 'lifeForceGain')
    : 0;
}

/** Accepted non-summon fear grants life force under one cooldown; missed and travelling packets grant nothing. */
export function applyFearOfDeath(runtime: NecromancerRuntime, event: NecromancerResolverEvent): void {
  if (
    event.controlKind !== 'fear' ||
    event.actorType === 'summon' ||
    !hasTrait(runtime, TRAIT.FEAR_OF_DEATH) ||
    !runtime.procs.claim(TRAIT.FEAR_OF_DEATH, 'necromancer.core.fearOfDeath', runtime.time)
  )
    return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.FEAR_OF_DEATH);
  grantNecromancerLifeForce(runtime, balanceProfileNumber(profile, 'lifeForceGain'));
}

export function applyDhuumfire(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  skillDuration: unknown,
  shroudSkillOne: boolean
): void {
  if (!hasTrait(context, TRAIT.DHUUMFIRE) || !shroudSkillOne) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.DHUUMFIRE);
  const effect = requireEffect(profile, 'condition', 'Burning');
  const interval = event.metadata?.dhuumfireInterval || 0;
  // Zero or absent intervals bypass the claim so same-time applications remain unrestricted; the claim gates only
  // Burning, so a removed packet leaves it ready.
  if (!effect) return;
  if (interval > 0 && !context.procs.claimCooldown('dhuumfire', event.at, interval)) {
    return;
  }

  {
    /* Trait payloads and their timeline annotation share the same emission boundary. */ context.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      event: {
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.DHUUMFIRE,
        actorType: 'effect',
        skillName: 'Dhuumfire',
        triggeredBy: event.skillName,
        type: 'condition',
        ownerActorType: 'player',
        name: 'Dhuumfire' + ' - ' + String(effect.condition),
        condition: String(effect.condition),
        stacks: effectNumber(profile, effect, 'stacks'),
        duration: Number(event.metadata?.dhuumfireDuration ?? skillDuration ?? effect.duration ?? 3)
      }
    });
    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Dhuumfire', at: event.at, sourceSkill: event.skillName }
    });
  }
}

export function applyUnyieldingBlast(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  firstHit: boolean,
  shroudSkillOne: boolean
): void {
  if (!hasTrait(context, TRAIT.UNYIELDING_BLAST) || !firstHit || !shroudSkillOne) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.UNYIELDING_BLAST);
  const effect = requireEffect(profile, 'condition', 'Vulnerability');
  if (!effect) return;
  {
    /* Trait payloads and their timeline annotation share the same emission boundary. */ context.effects.emit({
      kind: 'packet',
      event: {
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.UNYIELDING_BLAST,
        actorType: 'effect',
        skillName: 'Unyielding Blast',
        triggeredBy: event.skillName,
        type: 'condition',
        name: 'Unyielding Blast',
        condition: 'Vulnerability',
        stacks: effectNumber(profile, effect, 'stacks'),
        duration: effectNumber(profile, effect, 'duration')
      }
    });
    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Unyielding Blast', at: event.at, sourceSkill: event.skillName }
    });
  }
}

/** Applies Vital Persistence at the original attribute-conversion position. */
export function modifyVitalPersistenceAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.VITAL_PERSISTENCE)) {
    const vitalPersistenceProfile = requireBalanceProfileFromContext(context, TRAIT.VITAL_PERSISTENCE);
    result.vitality += balanceProfileNumber(vitalPersistenceProfile, 'attributeBonus');
  }
}

/** Actual entry and exit refresh Soul Barbs, including automatic depletion. */
export function applySoulBarbs(runtime: NecromancerRuntime): void {
  if (!hasTrait(runtime, TRAIT.SOUL_BARBS)) return;
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'Trait',
      sourceId: TRAIT.SOUL_BARBS,
      actorType: 'player',
      kind: 'necromancer-soul-barbs',
      stacks: 1,
      duration: balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SOUL_BARBS), 'duration')
    }
  });
}

/** Emits speed of shadows at the ordered post-entry boundary. */
export function enterSpeedOfShadows(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  emitNecromancerShroudTrait(runtime, cast, TRAIT.SPEED_OF_SHADOWS);
}

/** Emits eternal life at the ordered post-entry boundary. */
export function enterEternalLife(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  emitNecromancerShroudTrait(runtime, cast, TRAIT.ETERNAL_LIFE);
}

/** Gluttony scales a successful gain once, before the resource controller caps the pool. */
export function gluttonyLifeForceMultiplier(runtime: NecromancerRuntime): number {
  return hasTrait(runtime, TRAIT.GLUTTONY)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.GLUTTONY), 'lifeForceGainMultiplier')
    : 1;
}

/** Siphon packets apply the same active Soul Barbs window outside ordinary strike modifiers. */
export function soulBarbsSiphonMultiplier(runtime: NecromancerRuntime): number {
  return hasTrait(runtime, TRAIT.SOUL_BARBS) &&
    runtime.query.timeline.timedActive('necromancer-soul-barbs', runtime.time)
    ? 1.1
    : 1;
}

/** Applies the static Vitality trait only on the raw-config capacity path. */
export function vitalPersistenceVitality(config: NecromancerConfig, balanceContext: unknown): number {
  return hasTrait(config, TRAIT.VITAL_PERSISTENCE)
    ? balanceProfileNumber(requireBalanceProfileFromContext(balanceContext, TRAIT.VITAL_PERSISTENCE), 'attributeBonus')
    : 0;
}

/** Soul Battery changes capacity, keeping normalized resource costs consistent for every shroud variant. */
export function soulBatteryCapacity(config: NecromancerConfig, balanceContext: unknown): number {
  return hasTrait(config, TRAIT.SOUL_BATTERY)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(balanceContext, TRAIT.SOUL_BATTERY),
        'lifeForceCapacityMultiplier'
      )
    : 1;
}

/** A granted Eternal Life pulse samples the live shroud and caps its gain at the trait threshold. */
export function applyEternalLifePulse(runtime: NecromancerRuntime): void {
  const state = runtime.profession.core;
  if (state.activeShroud) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.ETERNAL_LIFE);
  const missing = Math.max(
    0,
    state.lifeForce.maximum * balanceProfileNumber(profile, 'threshold') - state.lifeForce.value
  );
  runtime.resourceController.grant(
    'lifeForce',
    Math.min(missing, (state.lifeForce.maximum * balanceProfileNumber(profile, 'lifeForceGain')) / 100)
  );
}

/** Initialization selects the trait producer; already-scheduled pulses keep their original lifetime. */
export function eternalLifePassive(runtime: NecromancerRuntime) {
  return ['eternal-life', hasTrait(runtime, TRAIT.ETERNAL_LIFE), TRAIT.ETERNAL_LIFE] as const;
}

/** Readiness advertises only the actual next pulse when its threshold can cover the cost. */
export function eternalLifeReadyAt(runtime: NecromancerRuntime, cost: number): number {
  const state = runtime.profession.core;
  const eternal = state.passiveNextAt['eternal-life'];
  const threshold =
    eternal == null
      ? 0
      : state.lifeForce.maximum *
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.ETERNAL_LIFE), 'threshold');
  return !state.activeShroud && cost <= threshold ? (eternal ?? Infinity) : Infinity;
}

/** Scourge's non-transform cast preserves its skill attribution while granting the Core Soul Barbs window. */
export function applyScourgeSoulBarbs(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  const skill = cast.skill;
  if (hasTrait(runtime, TRAIT.SOUL_BARBS))
    runtime.effects.emit({
      kind: 'packet',
      event: {
        type: 'buff',
        at: runtime.time,
        source: 'necromancer',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        activationId: cast.id,
        kind: 'necromancer-soul-barbs',
        stacks: 1,
        duration: balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SOUL_BARBS), 'duration')
      }
    });
}
