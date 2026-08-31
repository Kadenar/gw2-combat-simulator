/** Shares resolver-side Necromancer trait effects without coupling trait-line modules to the public dispatcher. */
import { enqueueOrdered } from '#kernel/events/queue.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SkillId } from '#gw2/platform/engine/types.js';
import type { Gw2EventDraft } from '#gw2/platform/equipment/relics/types.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent
} from '#gw2/content/professions/necromancer/types.js';

interface TraitConditionDefinition {
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
  readonly noCrit?: boolean;
  readonly damageKind?: string;
  readonly icon?: string;
}

interface TraitVulnerabilityDefinition {
  readonly name: string;
  readonly traitId: SkillId;
  readonly stacks: number;
  readonly duration: number;
}

/** Applies a trait-owned condition immediately and records its proc attribution. */
export function applyTraitCondition(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  { name, traitId, condition, stacks = 1, duration }: TraitConditionDefinition
): void {
  const application: Gw2EventDraft = {
    type: 'condition',
    at: event.at,
    name: `${name} - ${condition}`,
    skillName: name,
    condition,
    stacks,
    duration,
    source: 'Trait',
    sourceId: traitId,
    actorType: 'effect',
    triggeredBy: event.skillName
  };
  // Resolver-derived trait conditions enter canonical state immediately so
  // chained condition reactions preserve their causal timestamp ordering.
  context.applyCondition(application);

  context.recordProc?.('trait', name, event.at, event.skillName);
}

/** Queues a coefficient-based trait strike and records matching proc attribution. */
export function queueTraitCoefficientDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  { name, traitId, coefficient, noCrit = true, damageKind, icon }: TraitCoefficientDefinition
): void {
  enqueueOrdered(context.queue, {
    type: 'damage',
    at: event.at,
    name,
    skillName: name,
    coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: 'Trait',
    sourceId: traitId,
    actorType: 'effect',
    skillWeapon: 'Unequipped',
    noCrit,
    ...(damageKind ? { damageKind } : {}),
    ...(icon ? { icon } : {}),
    ...(event.summonOwner ? { summonOwner: event.summonOwner } : {}),
    triggeredBy: event.skillName
  });
  // Proc markers need the derived effect's artwork because their display name
  // does not necessarily match either the granting trait or triggering skill.
  context.recordProc?.('trait', name, event.at, event.skillName, '', icon);
}

/** Applies a trait-owned Vulnerability packet and records matching proc attribution. */
export function applyTraitVulnerability(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  { name, traitId, stacks, duration }: TraitVulnerabilityDefinition
): void {
  enqueueOrdered(context.queue, {
    type: 'condition',
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
  });
  context.recordProc?.('trait', name, event.at, event.skillName);
}

/** Reads permanent and timed Chilled target state at the requested timestamp. */
export function targetIsChilled(context: NecromancerResolverContext, at: number): boolean {
  if (
    context.config.target?.conditions?.Chilled === true ||
    Number(context.config.target?.conditions?.Chilled || 0) > 0
  )
    return true;
  return Number(professionCoreState(context).targetChilledUntil || 0) > at;
}
