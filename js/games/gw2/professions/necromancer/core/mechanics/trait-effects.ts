import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type {
  NecromancerSkill,
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime
} from '#gw2/professions/necromancer/types.js';

/** Shares resolver-side Necromancer trait effects without coupling trait-line modules to the public dispatcher. */

interface TraitConditionDefinition {
  readonly procCount?: number;
  readonly name: string;
  readonly traitId: SkillId;
  readonly condition: string;
  readonly stacks?: number;
  readonly duration: number;
}

interface TraitCoefficientDefinition {
  readonly name: string;
  readonly traitId: SkillId;
  readonly coefficient: number;
  readonly canCrit?: boolean;
  readonly damageKind?: string;
  readonly icon?: string;
}

interface TraitVulnerabilityDefinition {
  readonly name: string;
  readonly traitId: SkillId;
  readonly stacks: number;
  readonly duration: number;
}

/** Applies a player-owned trait condition immediately so equipment triggers and chained reactions can observe it. */
export function applyTraitCondition(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  { name, traitId, condition, stacks = 1, duration, procCount }: TraitConditionDefinition
): void {
  const application = buildResolverCondition({
    at: event.at,
    name: `${name} - ${condition}`,
    skillName: name,
    condition,
    stacks,
    duration,
    source: 'Trait',
    sourceId: traitId,
    actorType: 'effect',
    ownerActorType: 'player',
    triggeredBy: event.skillName,
    ...(procCount == null ? {} : { metadata: { procCount } })
  });
  // Resolver-derived trait conditions enter canonical state immediately so
  // chained condition reactions preserve their causal timestamp ordering.
  context.applyCondition(application);

  context.recordProc('trait', name, event.at, event.skillName);
}

/** Queues a coefficient-based trait strike and records matching proc attribution. */
export function queueTraitCoefficientDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  { name, traitId, coefficient, canCrit = false, damageKind, icon }: TraitCoefficientDefinition
): void {
  context.queue.enqueue(
    buildResolverStrike({
      at: event.at,
      skillName: name,
      coefficient,

      source: 'Trait',
      sourceId: traitId,
      actorType: 'effect',
      skillWeapon: 'Unequipped',
      canCrit,
      ...(damageKind ? { damageKind } : {}),
      ...(icon ? { icon } : {}),
      ...(event.summonOwner ? { summonOwner: event.summonOwner } : {}),
      triggeredBy: event.skillName
    })
  );
  // Proc markers need the derived effect's artwork because their display name
  // does not necessarily match either the granting trait or triggering skill.
  context.recordProc('trait', name, event.at, event.skillName, '', icon);
}

/** Applies a trait-owned Vulnerability packet and records matching proc attribution. */
export function applyTraitVulnerability(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  { name, traitId, stacks, duration }: TraitVulnerabilityDefinition
): void {
  context.queue.enqueue(
    buildResolverCondition({
      at: event.at,
      name,
      skillName: name,
      condition: 'Vulnerability',
      stacks,
      duration,
      source: 'Trait',
      sourceId: traitId,
      actorType: 'effect',
      triggeredBy: event.skillName
    })
  );
  context.recordProc('trait', name, event.at, event.skillName);
}

/** Reads permanent and timed Chilled target state at the requested timestamp. */
export function targetIsChilled(context: NecromancerResolverContext, at: number): boolean {
  if (context.config.target?.conditions?.Chilled === true || (context.config.target?.conditions?.Chilled || 0) > 0)
    return true;
  return (professionCoreState(context).targetChilledUntil || 0) > at;
}

/** Emits the selected entry profile after the form and specialization state are established. */
export function emitNecromancerShroudTrait(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  trait: number
): void {
  if (!hasTrait(runtime, trait)) return;
  const profile = requireBalanceProfileFromContext(runtime, trait);
  emitEffects(runtime, {
    owner: profile,
    baseEvent: {
      source: 'Trait',
      sourceId: trait,
      actorType: 'effect',
      skillName: profile.name,
      activationId: cast.id,
      triggeredBy: cast.skill.name
    },
    skillWeaponFallback: 'Unequipped',
    // Target misses affect hostile packets only; entry boons still reach the player.
    transform: (event) => ({
      ...event,
      name: profile.name,
      ...(event.type === 'buff' ? {} : { offTarget: cast.command.offTarget })
    })
  });
}
