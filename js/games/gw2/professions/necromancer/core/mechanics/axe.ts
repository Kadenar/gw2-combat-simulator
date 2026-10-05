import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';

/** Axe health bonuses observe the resolved crossing hit without recording a gain for another pass. */
export function reactToNecromancerAxeHealth(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
  const skill = skillForEvent(context.helpers, event);
  if (!skill || (skill.id !== ID.RENDING_CLAWS && skill.id !== ID.UNHOLY_FEAST)) return;
  if (!context.combat.targetHealthBelow(0.5)) return;

  if (skill.id === ID.RENDING_CLAWS) {
    const vulnerability = skill.effects?.find((effect) => effect.type === 'condition')?.ticks?.[
      Number(event.hitIndex || 1) - 1
    ];
    if (!vulnerability || !('condition' in vulnerability)) return;
    // Duplicate only this hit's authored Vulnerability application below half health.
    context.effects.emit({
      kind: 'packet',
      event: buildResolverCondition({
        at: event.at,
        source: 'necromancer',
        sourceId: skill.id,
        skillId: skill.id,
        skillName: skill.name,
        actorType: 'player',
        condition: vulnerability.condition,
        stacks: vulnerability.stacks,
        duration: vulnerability.duration
      })
    });
    return;
  }

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
      actorType: 'player',
      triggeredBy: skill.name,
      activationId: event.activationId
    }
  });
}
