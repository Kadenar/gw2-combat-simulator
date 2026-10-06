import {
  buffApplicationStacks,
  buffMatchesAudience,
  durationStackingBoonCapSeconds,
  isDurationStackingBoon,
  isStandardBoon,
  remainingDurationStackSeconds,
  type Gw2TimedBuffApplication
} from '#gw2/platform/combat/boons.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

/** Per-recipient boon and buff stack reads over accepted applications, for live queries and boon copying. */

export type EffectRecipient =
  { readonly actor: 'player' } | { readonly actor: 'companion'; readonly companionId: string | null };

/** Read one recipient's accepted grants; only isolated previews may read scheduled applications. */
export function appliedEffectStacks(
  context: Pick<Gw2ModifierContext, 'runtime' | 'timeline' | 'time'>,
  kind: string,
  maximum: number,
  recipient: EffectRecipient = { actor: 'player' },
  fallbackDuration = 0
): number {
  kind = kind.toLowerCase();
  const audience = recipient.actor === 'player' ? 'all' : 'summon';
  const companionId = recipient.actor === 'companion' ? recipient.companionId : undefined;
  // A retired entity has no live boons or buffs; earlier queries still see its accepted grants.
  if (companionId && context.time >= (context.runtime?.retiredCompanions?.get(companionId) ?? Infinity)) return 0;
  if (!context.runtime)
    return context.timeline?.buffStacksAt(kind, context.time, fallbackDuration, maximum, audience, companionId) ?? 0;
  const applications = (isStandardBoon(kind) ? context.runtime.boons : context.runtime.buffs)?.get(kind) ?? [];
  // Accepted histories are chronological, so duration pools can replay without copying and sorting each query.
  return buffApplicationStacks(applications, kind, context.time, maximum, { audience, companionId, ordered: true });
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
  const audience = recipient.actor === 'player' ? 'all' : 'summon';
  const companionId = recipient.actor === 'companion' ? recipient.companionId : undefined;
  const configured = recipient.actor === 'player' ? Number(config.boons?.[kind] || 0) : 0;
  const maximum = kind === 'might' || kind === 'stability' ? 25 : 1;
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
    ? remainingDurationStackSeconds(
        permanent > 0
          ? [
              { at: refreshAt, duration: durationStackingBoonCapSeconds(kind) },
              ...matching.filter((application) => application.at >= refreshAt)
            ]
          : matching,
        at,
        { maximum: durationStackingBoonCapSeconds(kind), ordered: true }
      )
    : permanent > 0
      ? (10000 - phaseMs) / 1000
      : Math.max(
          0,
          ...matching.filter((application) => application.at <= at).map((application) => application.expiresAt - at)
        );
  return { stacks, duration };
}
