import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';

/** Axe health bonuses observe the resolved crossing hit without recording a gain for another pass. */
export function reactToNecromancerAxeHealth(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  if (event.actorType !== ACTOR.PLAYER || !(Number(event.coefficient) > 0)) return;

  const skill = skillForEvent(context.helpers, event);

  if (!skill || skill.id !== ID.UNHOLY_FEAST) return;

  if (!context.combat.targetHealthBelow(0.5)) return;

  const burst = context.helpers.skillsById.get(ID.UNHOLY_BURST);

  if (!burst) return;

  // The shared service expands the selected strike profile at the resolved crossing hit.
  context.effects.emit({
    kind: 'profile',
    profile: burst,
    effects: (burst.effects ?? []).filter((effect) => effect.type === 'strike'),
    at: event.at,
    fullEnd: event.at,
    attribution: {
      source: 'necromancer',
      sourceId: burst.id,
      skillId: burst.id,
      skillName: burst.name,
      actorType: ACTOR.PLAYER,
      triggeredBy: skill.name,
      activationId: event.activationId
    }
  });
}
