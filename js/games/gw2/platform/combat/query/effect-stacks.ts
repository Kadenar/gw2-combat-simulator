/** Per-recipient boon and buff stack reads over accepted applications, for live queries and boon copying. */
import {
  buffApplicationStacks,
  buffMatchesAudience,
  durationStackingBoonCapSeconds,
  durationStackState,
  isDurationStackingBoon,
  isStandardBoon,
  type Gw2TimedBuffApplication
} from '#gw2/platform/combat/boons.js';
import { buffApplicationExpiry } from '#gw2/platform/combat/buff-expiry.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { ACTOR, BOON, RECIPIENT } from '#gw2/platform/constants.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export type EffectRecipient =
  { readonly actor: typeof ACTOR.PLAYER } | { readonly actor: 'companion'; readonly companionId: string | null };

/** Read one recipient's accepted grants; only isolated previews may read scheduled applications. */
export function appliedEffectStacks(
  context: Pick<Gw2ModifierContext, 'runtime' | 'timeline' | 'time'>,
  kind: string,
  maximum: number,
  recipient: EffectRecipient = { actor: ACTOR.PLAYER },
  fallbackDuration = 0
): number {
  kind = kind.toLowerCase();
  const audience = recipient.actor === ACTOR.PLAYER ? RECIPIENT.SELF : RECIPIENT.SUMMONS;
  const companionId = recipient.actor === 'companion' ? recipient.companionId : undefined;
  // A retired entity has no live boons or buffs; earlier queries still see its accepted grants.
  const retiredAt = companionId ? context.runtime?.liveEffects?.queries.companionRetiredAt(companionId) : undefined;

  if (retiredAt != null)
    return context.time >= retiredAt
      ? 0
      : (context.timeline?.buffStacksAt(kind, context.time, fallbackDuration, maximum, audience, companionId) ?? 0);

  if (!context.runtime)
    return context.timeline?.buffStacksAt(kind, context.time, fallbackDuration, maximum, audience, companionId) ?? 0;

  // Live queries use accepted stores; only the historical path above may replay a retired recipient.
  return context.runtime.liveEffects?.queries.stacks(kind, context.time, maximum, recipient) ?? 0;
}

/** Snapshot executed applications for one recipient so copying never reconstructs live state from reporting facts. */
export function liveBoonSnapshot(
  applications: readonly Readonly<Gw2TimedBuffApplication>[],
  config: Gw2Config,
  kind: string,
  at: number,
  recipient: EffectRecipient
): { readonly stacks: number; readonly duration: number } {
  // Copying a boon cannot expose ordinary buff windows or malformed assumptions.
  if (!isStandardBoon(kind)) return { stacks: 0, duration: 0 };

  const audience = recipient.actor === ACTOR.PLAYER ? RECIPIENT.SELF : RECIPIENT.SUMMONS;
  const companionId = recipient.actor === 'companion' ? recipient.companionId : undefined;
  const configured = recipient.actor === ACTOR.PLAYER ? Number(config.boons?.[kind] || 0) : 0;
  const maximum = kind === BOON.MIGHT || kind === BOON.STABILITY ? 25 : 1;
  const permanent = Math.max(0, Math.min(maximum, configured));
  const stacks = Math.min(
    maximum,
    permanent + buffApplicationStacks(applications, kind, at, maximum, { ordered: true, audience, companionId })
  );

  if (!stacks) return { stacks: 0, duration: 0 };

  const matching = applications.filter((application) => buffMatchesAudience(application, audience, companionId));
  // Configured player boons refresh every ten seconds from rotation start, including negative precast times.
  const phaseMs = ((Math.round(at * 1000) % 10000) + 10000) % 10000;
  const refreshAt = (Math.round(at * 1000) - phaseMs) / 1000;
  const duration = isDurationStackingBoon(kind)
    ? durationStackState(
        permanent > 0
          ? [
              { at: refreshAt, duration: durationStackingBoonCapSeconds(kind) },
              ...matching.filter((application) => application.at >= refreshAt)
            ]
          : matching,
        at,
        { maximum: durationStackingBoonCapSeconds(kind), ordered: true }
      ).remaining
    : permanent > 0
      ? (10000 - phaseMs) / 1000
      : // A removed grant, such as a pre-extension segment, contributes only its time before removal.
        Math.max(
          0,
          ...matching
            .filter((application) => application.at <= at)
            .map((application) => buffApplicationExpiry(application) - at)
        );
  return { stacks, duration };
}
