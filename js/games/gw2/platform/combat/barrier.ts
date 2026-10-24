import { RECIPIENT } from '#gw2/platform/constants.js';
import type { EffectAudience } from '#gw2/platform/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';

export interface BarrierRecipient {
  readonly key: string;
  readonly allyIndex?: number;
  readonly audience: EffectAudience;
}

/** Accepted barrier buffs supply actual recipients; reactions never reconstruct delivery from a cast or party size. */
export function barrierRecipients(event: Gw2ResolverEvent): readonly BarrierRecipient[] {
  const audience = event.resolvedAudience;

  if (
    event.type !== 'buff' ||
    event.kind !== 'barrier' ||
    !audience ||
    !(Number(event.duration) > 0) ||
    !((event.stacks ?? 1) > 0)
  )
    return [];

  return [
    ...(audience.includesSelf ? [{ key: RECIPIENT.SELF, audience: { recipients: RECIPIENT.SELF } }] : []),
    ...Array.from({ length: audience.alliedPlayerCount }, (_, index) => {
      const ally = audience.alliedPlayerIndex ?? index + 1;
      return {
        key: `ally:${ally}`,
        allyIndex: ally,
        audience: {
          recipients: RECIPIENT.PARTY,
          affectsSelf: false,
          alliedPlayerIndex: ally,
          maximumRecipients: 1,
          eligibleCompanionIds: []
        }
      };
    }),
    ...audience.companionIds.map((id) => ({
      key: `companion:${id}`,
      audience: { recipients: RECIPIENT.SUMMONS, affectsSelf: false, maximumRecipients: 1, eligibleCompanionIds: [id] }
    }))
  ];
}

/** Barrier can reach companions without boon sharing; its player-owned boon rewards must still honor that setting. */
export function barrierBoonRecipients(
  event: Gw2ResolverEvent,
  config: { readonly sharePlayerBoonsWithSummons?: boolean }
): readonly BarrierRecipient[] {
  return barrierRecipients(event).filter(
    (recipient) => config.sharePlayerBoonsWithSummons !== false || recipient.audience.recipients !== RECIPIENT.SUMMONS
  );
}

/**
 * Requests one grouped boon reward for the barrier's boon-eligible recipients, so ordinary boon resolution still
 * selects and records them. Companions only fill slots after every eligible ally, so a request without allies must
 * address summons directly or party resolution would hand those slots to unrelated allies.
 */
export function barrierBoonAudience(
  event: Gw2ResolverEvent,
  config: { readonly sharePlayerBoonsWithSummons?: boolean }
): EffectAudience | null {
  const recipients = barrierBoonRecipients(event, config);

  if (!recipients.length) return null;

  const allies = recipients.filter((recipient) => recipient.allyIndex != null).length;
  const companionIds = recipients.flatMap((recipient) =>
    recipient.audience.recipients === RECIPIENT.SUMMONS ? (recipient.audience.eligibleCompanionIds ?? []) : []
  );
  const alliedPlayerIndex = event.resolvedAudience?.alliedPlayerIndex;
  return {
    recipients: allies || !companionIds.length ? RECIPIENT.PARTY : RECIPIENT.SUMMONS,
    affectsSelf: recipients.some((recipient) => recipient.audience.recipients === RECIPIENT.SELF),
    ...(allies && alliedPlayerIndex != null ? { alliedPlayerIndex } : {}),
    maximumRecipients: recipients.length,
    eligibleCompanionIds: companionIds
  };
}
