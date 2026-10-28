import { ACTOR } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { WEAVER_SPEAR_BUFFS } from '#gw2/professions/elementalist/specializations/weaver/skills/weapons/spear.js';
import type { ElementalistResolverContext } from '#gw2/professions/elementalist/types.js';

/** Consume live self buffs in impact order, including strikes launched before the dual skill was activated. */
export function triggerWeaverSpearFollowups(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  if (
    event.type !== 'damage' ||
    (event.actorType !== ACTOR.PLAYER && event.actorType !== ACTOR.EFFECT) ||
    event.offTarget ||
    !(Number(event.coefficient) > 0 || Number(event.flatDamage) > 0 || Number(event.flatStrikeBase) > 0)
  )
    return;

  const armed = Object.entries(WEAVER_SPEAR_BUFFS).flatMap(([id, kind]) => {
    const applications = context.combat.buffApplications(kind);
    const grant = applications
      .filter(
        (application) =>
          application.resolvedAudience.includesSelf &&
          application.stacks > 0 &&
          application.at <= event.at &&
          application.expiresAt > event.at
      )
      .at(-1);

    if (!grant) return [];

    // Retire every live application before emitting any payload, so simultaneous buffs cannot recursively retrigger.
    context.combat.reviseBuffExpiry(
      kind,
      (application) => application.resolvedAudience.includesSelf && application.at <= event.at,
      (expiresAt) => Math.min(expiresAt, event.at)
    );
    return [{ id: Number(id), grant }];
  });

  for (const { id, grant } of armed) {
    const skill = requireSkillFromContext(context, id);
    const action = requireSkillAction(skill, 'additional-strike');
    context.effects.emit({
      kind: 'profile',
      profile: skill,
      // The arming grant is consumed above; only surviving hostile rewards belong to this impact.
      effects: action.effects.filter((effect) => effect.type === 'strike' || effect.type === 'condition'),
      at: event.at,
      fullEnd: event.at,
      cause: event,
      // The dual skill owns its damage and combat roll; the triggering strike supplies only the impact boundary.
      attribution: {
        source: 'elementalist',
        sourceId: id,
        actorType: ACTOR.PLAYER,
        skillId: id,
        skillName: skill.name,
        activationId: grant.event?.activationId,
        triggeredBy: event.skillName
      }
    });
  }
}
