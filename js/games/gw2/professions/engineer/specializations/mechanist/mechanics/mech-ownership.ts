import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { eventSkill } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { resolverSkill } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { engineerEvent } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import type {
  EngineerConfig,
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerSimulationEvent,
  EngineerSkill
} from '#gw2/professions/engineer/types.js';

/** Only F1-F3 are mech commands; the summon/recall slot is excluded. */
export function isEngineerMechCommand(skill: EngineerSkill | undefined): boolean {
  const slot = skill?.mechanicSlot || 0;
  return slot >= 1 && slot <= 3;
}

/** Explicit ownership wins; each caller controls whether its context permits legacy command inference. */
export function isEngineerMechEvent(
  event: EngineerSimulationEvent | undefined,
  skill: () => EngineerSkill | undefined,
  allowInference = true
): boolean {
  return (
    event?.metadata?.engineerMech === true ||
    event?.application?.metadata?.engineerMech === true ||
    (allowInference && event?.actorType === 'summon' && isEngineerMechCommand(skill()))
  );
}

/** Resolve an authored command row without depending on trait identities in the mechanics layer. */
export function selectedMechCommand(
  traits: EngineerConfig | ReadonlySet<SkillId>,
  groups: readonly (readonly [SkillId, SkillId])[]
): SkillId {
  for (const [trait, skill] of groups) if (hasTrait(traits, trait)) return skill;
  return groups[0][1];
}

/** Modifier ownership permits command inference only in an active Mechanist context. */
export function engineerMechModifierEvent(context: Gw2ModifierContext): boolean {
  return isEngineerMechEvent(
    engineerEvent(context),
    () => eventSkill(context),
    context.config?.specialization === 'Mechanist'
  );
}

/** Resolver events retain the same explicit ownership and command-slot inference. */
export function engineerMechResolverEvent(context: EngineerResolverContext, event: EngineerResolverEvent): boolean {
  return isEngineerMechEvent(event, () => resolverSkill(context, event.skillId ?? event.application?.skillId));
}
