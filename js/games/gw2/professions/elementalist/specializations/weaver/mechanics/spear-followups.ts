import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { WEAVER_SPEAR_FOLLOWUPS } from '#gw2/professions/elementalist/specializations/weaver/skills/weapons/spear.js';
import type { ElementalistResolverContext } from '#gw2/professions/elementalist/types.js';

/** Consume live self buffs in impact order, including strikes launched before the dual skill was activated. */
export function triggerWeaverSpearFollowups(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  if (
    event.type !== 'damage' ||
    (event.actorType !== 'player' && event.actorType !== 'effect') ||
    event.offTarget ||
    !(Number(event.coefficient) > 0 || Number(event.flatDamage) > 0 || Number(event.flatStrikeBase) > 0)
  )
    return;

  const armed = Object.entries(WEAVER_SPEAR_FOLLOWUPS).flatMap(([id, kind]) => {
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
    return [{ id: Number(id), kind, grant }];
  });

  for (const { id, kind, grant } of armed) {
    const skill = context.helpers.skillsById.get(id)!;
    context.effects.emit({
      kind: 'profile',
      profile: requireBalanceProfileFromContext(context, kind),
      at: event.at,
      fullEnd: event.at,
      cause: event,
      // The dual skill owns its damage and combat roll; the triggering strike supplies only the impact boundary.
      attribution: {
        source: 'elementalist',
        sourceId: id,
        actorType: 'player',
        skillId: id,
        skillName: skill.name,
        activationId: grant.event?.activationId,
        triggeredBy: event.skillName
      }
    });
  }
}
