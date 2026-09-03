import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { SPECIALIZATIONS } from '#gw2/professions/guardian/data/guardian-api-metadata.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boon-duration.js';
import type { SkillId } from '#gw2/platform/engine/types.js';
import type {
  GuardianCoreState,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill
} from '#gw2/professions/guardian/types.js';

const TRAIT_BY_ID = new Map(
  SPECIALIZATIONS.flatMap((specialization) => [
    ...specialization.minorTraits,
    ...specialization.majorTraits.flat()
  ]).map((trait) => [Number(trait.id), trait])
);

/** Provides shared Guardian trait metadata and resolver emissions without making trait lines import the dispatcher. */
export function guardianTraitIcon(traitId: SkillId): string {
  return TRAIT_BY_ID.get(Number(traitId))?.icon || '';
}

// Emit a normalized Guardian proc marker with trait icon and triggering-skill
// attribution shared by core and specialization rules.
export function emitGuardianProc(
  context: GuardianSchedulerContext,
  {
    name,
    at,
    sourceSkill,
    detail = '',
    icon = '',
    procType = 'trait',
    source = 'Trait'
  }: {
    readonly name: string;
    readonly at: number;
    readonly sourceSkill: string;
    readonly detail?: string;
    readonly icon?: string;
    readonly procType?: string;
    readonly source?: string;
  }
): void {
  context.emit({
    type: 'proc',
    procType,
    at,
    source,
    sourceId: name,
    actorType: 'effect',
    name,
    sourceSkill,
    detail,
    icon
  });
}

export function isGuardianSymbolSkill(skill: GuardianSkill | undefined, fallbackName = ''): boolean {
  const name = skill?.name || fallbackName;
  const description = String(skill?.description || '');
  return (
    /^Symbol of /.test(name) ||
    /^Lesser Symbol of /.test(name) ||
    /^Symbol\./.test(description) ||
    /\bcreat(?:e|ing) a symbol\b/i.test(description)
  );
}

export function guardianResolverState(context: GuardianResolverContext): GuardianCoreState {
  return professionCoreState(context);
}

export function guardianResolverEpsilon(context: GuardianResolverContext): number {
  return Number(context.epsilon || 0.0001);
}

export function recordGuardianTraitProc(
  context: GuardianResolverContext,
  traitId: SkillId,
  name: string,
  at: number,
  sourceSkill: string | undefined,
  detail: string
): void {
  context.recordProc('trait', name, at, sourceSkill, detail, guardianTraitIcon(traitId));
}

// Queue a resolver-owned buff with canonical trait attribution and explicit
// recipient semantics.
export function queueGuardianResolverBuff(
  context: GuardianResolverContext,
  {
    at,
    sourceId,
    skillName,
    kind,
    duration,
    stacks = 1,
    priority = -5
  }: {
    readonly at: number;
    readonly sourceId: SkillId;
    readonly skillName: string;
    readonly kind: string;
    readonly duration: number;
    readonly stacks?: number;
    readonly priority?: number;
  }
): void {
  const durationEvent = {
    type: 'buff',
    at,
    source: 'guardian',
    sourceId,
    actorType: 'player',
    skillId: sourceId,
    skillName,
    kind,
    duration,
    stacks
  } as GuardianResolverEvent;
  enqueueOrdered(context.queue, {
    type: 'buff',
    at,
    priority,
    source: 'guardian',
    sourceId,
    actorType: 'player',
    skillId: sourceId,
    skillName,
    kind,
    duration: gw2ResolverBoonDuration(context, durationEvent, kind, duration),
    stacks
  });
}
