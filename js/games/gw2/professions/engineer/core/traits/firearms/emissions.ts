import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { buildEngineerCondition } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerResolverContext, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';

type FirearmsConditionOwner =
  | { readonly actorType: 'effect'; readonly ownerActorType: 'player' }
  | { readonly actorType: 'summon'; readonly metadata: { readonly engineerMech: true } };

/** Share trait tuning and emission order while callers explicitly retain player or companion ownership. */
function emitFirearmsCondition(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  owner: FirearmsConditionOwner,
  sourceId: number,
  name: string,
  condition: string,
  quantity = 1,
  procCount?: number
): void {
  const profile = requireBalanceProfileFromContext(context, sourceId);
  const effect = requireEffect(profile, 'condition', condition);
  if (!effect) return;
  context.effects.emit({
    kind: 'packet',
    event: buildEngineerCondition(event, {
      name,
      condition: String(effect.condition),
      stacks: Number(effect.stacks) * quantity,
      duration: Number(effect.duration),
      sourceId,
      ...owner,
      ...(procCount == null ? {} : { procCount })
    }),
    settlement: 'reaction'
  });
  context.effects.emit({
    attribution: { source: 'Trait', sourceId, actorType: 'effect' },
    kind: 'announcement',
    cause: event,
    announcement: { type: 'trait', name, at: event.at, sourceSkill: event.skillName, icon: '' }
  });
}

/** Serrated Steel records proc quantity separately from the selected profile's bleeding stack count. */
export function emitSerratedSteel(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  quantity: number,
  owner: FirearmsConditionOwner
): void {
  emitFirearmsCondition(context, event, owner, TRAIT.SERRATED_STEEL, 'Serrated Steel', 'Bleeding', quantity, quantity);
}

/** Each eligible Incendiary Powder proc emits one profile application after its actor's cooldown gate. */
export function emitIncendiaryPowder(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  owner: FirearmsConditionOwner
): void {
  emitFirearmsCondition(context, event, owner, TRAIT.INCENDIARY_POWDER, 'Incendiary Powder', 'Burning');
}
