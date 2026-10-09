import { gw2AlliedPlayerAssumptions } from '#gw2/platform/combat/state/allied-players.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { activeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { RENEGADE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';

/** Soulcleave's Summit's player proc fires once per cooldown from a landed player strike while active. */
export function soulcleavePlayer(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  const soulcleave = runtime.helpers.skillsById.get(ID.SOULCLEAVES_SUMMIT);
  const proc = runtime.helpers.skillsById.get(PROFILE.soulcleavesSummitProc);
  if (
    !soulcleave ||
    !proc ||
    event.skillId === soulcleave.id ||
    !activeRevenantUpkeep(runtime, soulcleave.id) ||
    !runtime.procs.claimCooldown('revenant.renegade.soulcleave', runtime.time, Math.max(0, proc.cooldown || 0))
  )
    return;
  runtime.effects.emit({
    kind: 'profile',
    profile: proc,
    cause: event,
    attribution: (effect) => ({
      source: 'revenant',
      sourceId: soulcleave.id,
      actorType: effect.actorType || 'effect',
      skillId: soulcleave.id,
      skillName: soulcleave.name
    }),
    skillWeaponFallback: 'Unequipped',
    transform: (packet) => ({ ...packet, triggeredBy: event.skillName })
  });
}

/** Soulcleave reads live upkeep on shared strikes; upkeep and energy continue independently during preparation. */
export function initializeSoulcleaveAllies(runtime: RevenantRuntime): void {
  const skill = runtime.helpers.skillsById.get(ID.SOULCLEAVES_SUMMIT);
  const proc = runtime.helpers.skillsById.get(PROFILE.soulcleavesSummitProc);
  if (!skill || !proc) return;
  for (let allyIndex = 1; allyIndex <= gw2AlliedPlayerAssumptions(runtime.config).count; allyIndex++)
    runtime.alliedStrikes.register({
      id: `soulcleave:${allyIndex}`,
      allyIndex,
      internalCooldown: Math.max(0, proc.cooldown || 0),
      trigger(opportunity) {
        if (!activeRevenantUpkeep(runtime, ID.SOULCLEAVES_SUMMIT)) return false;
        runtime.effects.emit({
          kind: 'profile',
          profile: proc,
          attribution: (effect) => ({
            source: 'revenant',
            sourceId: skill.id,
            actorType: effect.actorType || 'effect',
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
    });
}
