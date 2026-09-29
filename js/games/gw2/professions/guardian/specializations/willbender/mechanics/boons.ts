import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import { guardianBoonDuration } from '#gw2/professions/guardian/core/traits/behavior.js';
import type { GuardianRuntimeState } from '#gw2/professions/guardian/types.js';

type Runtime = Gw2Runtime<GuardianRuntimeState>;
/** Boons sample live attributes without inheriting hostile annotations or recipients. */
export function willbenderBoon(
  runtime: Runtime,
  event: Gw2ResolverEvent,
  profileId: string | number,
  name: string,
  sourceId: number,
  party = false
): void {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  const effect = requireEffect(profile, 'boon', name);
  if (!effect) return;
  emitEffects(runtime, {
    owner: profile,
    effects: [effect],
    baseEvent: {
      source: 'guardian',
      sourceId,
      actorType: 'player',
      skillId: sourceId,
      skillName: profile.name,
      activationId: event.activationId,
      triggeredBy: event.skillName
    },
    transform: (packet) => ({
      ...packet,
      duration: guardianBoonDuration(runtime, packet),
      name: profile.name + ' — ' + name,
      causalOrder: event.causalOrder ?? event.eventOrder,
      audience: { recipients: party ? 'party' : 'self' }
    })
  });
}
