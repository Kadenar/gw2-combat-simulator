import { ACTOR } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { activeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { RENEGADE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Soulcleave's Summit's player proc fires once per cooldown from a landed player strike while active. */
export function soulcleavePlayer(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  const soulcleave = runtime.helpers.skillsById.get(ID.SOULCLEAVES_SUMMIT);
  const proc = runtime.helpers.skillsById.get(PROFILE.soulcleavesSummitProc);

  if (
    !soulcleave ||
    !proc ||
    event.skillId === soulcleave.id ||
    !activeRevenantUpkeep(runtime, soulcleave.id) ||
    !claimSoulcleave(runtime, 'revenant.renegade.soulcleave', proc)
  )
    return;

  runtime.effects.emit({
    kind: 'profile',
    profile: proc,
    cause: event,
    attribution: (effect) => ({
      source: 'revenant',
      sourceId: soulcleave.id,
      actorType: effect.actorType || ACTOR.EFFECT,
      skillId: soulcleave.id,
      skillName: soulcleave.name
    }),
    skillWeaponFallback: 'Unequipped',
    transform: (packet) => ({ ...packet, triggeredBy: event.skillName })
  });
}

/**
 * The player and each ally claim independent 1 s cooldowns under one boundary. A strike exactly at the deadline is
 * eligible: 2026-10-09 logs show one proc per 1 s Ofela pulse, which a strict boundary would halve for strikes landing
 * on the deadline.
 */
function claimSoulcleave(runtime: RevenantRuntime, key: string, proc: { readonly cooldown?: number }): boolean {
  if (canonicalTime(runtime.time) < canonicalTime(runtime.procs.deadline(key))) return false;

  runtime.procs.setDeadline(key, runtime.time + Math.max(0, proc.cooldown || 0));
  return true;
}

/** Soulcleave reads live upkeep on shared strikes; upkeep and energy continue independently during preparation. */
export function grantSoulcleaveAllies(runtime: RevenantRuntime): void {
  const skill = runtime.helpers.skillsById.get(ID.SOULCLEAVES_SUMMIT);
  const proc = runtime.helpers.skillsById.get(PROFILE.soulcleavesSummitProc);

  if (!skill || !proc) return;

  const startsAt = runtime.time;
  runtime.alliedStrikes.registerRecipients((allyIndex) => ({
    id: `soulcleave:${allyIndex}`,
    isActive: () => Boolean(activeRevenantUpkeep(runtime, ID.SOULCLEAVES_SUMMIT, startsAt)),
    trigger(opportunity) {
      if (!claimSoulcleave(runtime, `revenant.renegade.soulcleave:ally:${allyIndex}`, proc)) return false;

      runtime.effects.emit({
        kind: 'profile',
        profile: proc,
        attribution: (effect) => ({
          source: 'revenant',
          sourceId: skill.id,
          actorType: effect.actorType || ACTOR.EFFECT,
          skillId: skill.id,
          skillName: skill.name,
          activationId: opportunity.activationId
        }),
        skillWeaponFallback: 'Unequipped',
        transform: (event) => ({
          ...event,
          metadata: { triggeredByAlly: allyIndex },
          name: (event.name || proc.name).replace(
            "Soulcleave's Summit \u2014 ",
            `Soulcleave's Summit \u2014 Ally ${allyIndex} `
          )
        })
      });
    }
  }));
}
