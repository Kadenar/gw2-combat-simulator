import { gw2AlliedPlayerAssumptions } from '#gw2/platform/combat/state/allied-players.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { activeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { RENEGADE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { canonicalTime } from '#kernel/core/clock.js';

export const SOULCLEAVE_ALLIES = 'revenant.soulcleave-allied-proc';

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

/** Each assumed ally's Soulcleave proc arrives on its own cadence while the upkeep activation remains. */
export function soulcleaveAllies(runtime: RevenantRuntime, data: unknown): void {
  const { startsAt } = data as { startsAt: number };
  if (!activeRevenantUpkeep(runtime, ID.SOULCLEAVES_SUMMIT, startsAt)) return;
  const skill = runtime.helpers.skillsById.get(ID.SOULCLEAVES_SUMMIT);
  const proc = runtime.helpers.skillsById.get(PROFILE.soulcleavesSummitProc);
  const allies = gw2AlliedPlayerAssumptions(runtime.config);
  if (!skill || !proc || !allies.count || !allies.strikesPerSecond) return;
  for (let allyIndex = 1; allyIndex <= allies.count; allyIndex += 1)
    runtime.effects.emit({
      kind: 'profile',
      profile: proc,
      attribution: (effect) => ({
        source: 'revenant',
        sourceId: skill.id,
        actorType: effect.actorType || 'effect',
        skillId: skill.id,
        skillName: skill.name
      }),
      skillWeaponFallback: 'Unequipped',
      transform: (event) => ({
        ...event,
        name: (event.name || proc.name).replace(
          "Soulcleave's Summit \u2014 ",
          `Soulcleave's Summit \u2014 Ally ${allyIndex} `
        )
      })
    });
  runtime.schedule(
    SOULCLEAVE_ALLIES,
    canonicalTime(runtime.time + Math.max(proc.cooldown || 0, 1 / allies.strikesPerSecond)),
    data,
    undefined,
    -200
  );
}
