import {
  durationStackingBoonCapSeconds,
  isDurationStackingBoon,
  isStandardBoon,
  normalizeBoonDuration,
  recordBuffApplication,
  remainingDurationStackSeconds
} from '#gw2/platform/combat/state/boons.js';
import { applyBoonExtension } from '#gw2/platform/combat/state/boon-extensions.js';
import type { Gw2TimedBuffApplication } from '#gw2/platform/combat/state/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import { canonicalEvent, eventCausalOrder } from '#kernel/events/queue.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';

// Reporting projects party grants onto a full subgroup without changing combat assumptions or events.
export const PRESENTATION_ALLIED_PLAYER_COUNT = 4;

export interface BoonGeneration {
  readonly generatedStackSeconds: number;
}

export interface BoonGenerationByAudience {
  readonly intensityStacking: boolean;
  readonly self: BoonGeneration;
  readonly selfOnly: BoonGeneration;
  readonly sharedWithSelf: BoonGeneration;
  readonly allies: BoonGeneration;
}

/** Projects authored audiences onto four allies; personal boons never seed an ally's extension history. */
export function buildBoonGeneration(
  events: readonly SimulationEvent[],
  start: number,
  end: number
): { readonly alliedPlayerCount: number; readonly boons: ReadonlyMap<string, BoonGenerationByAudience> } {
  const ordered = events
    .filter(
      (event) =>
        event.at >= start &&
        !event.cancelled &&
        event.actorType !== 'environment' &&
        (event.type === 'buff' || event.type === 'boon_extension')
    )
    .map((event) =>
      normalizeBoonDuration(
        canonicalEvent(
          event.type === 'buff' && event.audience
            ? {
                ...event,
                resolvedAudience: gw2BoonApplicationRecipients(
                  { allies: { count: PRESENTATION_ALLIED_PLAYER_COUNT } },
                  { ...event, resolvedAudience: undefined }
                )
              }
            : event
        )
      )
    )
    .sort((left, right) => left.at - right.at || (eventCausalOrder(left) ?? 0) - (eventCausalOrder(right) ?? 0));
  const alliedPlayerCount = PRESENTATION_ALLIED_PLAYER_COUNT;
  const totals = new Map<string, BoonGenerationByAudience>();
  // The party model selects players in order before summons. Separate histories preserve partial recipient caps.
  const recipients = Array.from({ length: alliedPlayerCount + 1 }, () => new Map<string, Gw2TimedBuffApplication[]>());
  const empty = (): BoonGeneration => ({ generatedStackSeconds: 0 });
  const add = (previous: BoonGeneration, amount: number): BoonGeneration => ({
    generatedStackSeconds: previous.generatedStackSeconds + amount
  });
  for (const event of ordered) {
    if (event.at >= end) break;
    const amounts = new Map<string, number[]>();
    for (const [index, boons] of recipients.entries()) {
      const credit = (kind: string, amount: number): void => {
        const values = amounts.get(kind) || Array(recipients.length).fill(0);
        values[index] = amount;
        amounts.set(kind, values);
      };

      if (event.type === 'buff') {
        const audience = event.resolvedAudience;
        if (
          !isStandardBoon(event.kind) ||
          !audience ||
          !(index === 0 ? audience.includesSelf : index <= audience.alliedPlayerCount)
        )
          continue;
        const kind = String(event.kind).toLowerCase();
        credit(kind, Math.max(0, Number(event.duration || 0)) * Math.max(1, Number(event.stacks || 1)));
        // Each projection is local to this report; the original event and its recipients remain untouched.
        recordBuffApplication(boons, {
          ...event,
          resolvedAudience: {
            includesSelf: true,
            includesSummons: false,
            alliedPlayerCount: 0,
            companionIds: [],
            recipientCount: 1
          }
        });
        continue;
      }

      if (index > 0 && event.extensionAudience !== 'all') continue;
      for (const [kind, applications] of boons) {
        if ((event.kind && event.kind !== kind) || event.excludedKind === kind) continue;
        const stacks = isDurationStackingBoon(kind)
          ? Number(
              remainingDurationStackSeconds(applications, event.at, {
                maximum: durationStackingBoonCapSeconds(kind)
              }) > 0
            )
          : applications.reduce(
              (sum, application) =>
                sum + (application.at <= event.at && application.expiresAt > event.at ? application.stacks : 0),
              0
            );
        credit(kind, stacks * Math.max(0, Number(event.duration || 0)));
      }

      applyBoonExtension(boons, { ...event, extensionAudience: 'self' });
    }

    for (const [kind, values] of amounts) {
      const own = values[0]!;
      const allied = values.slice(1).reduce((sum, amount) => sum + amount, 0);
      const previous = totals.get(kind) || {
        // Percentage presentation is independent of which boons the combat engine models as duration pools.
        intensityStacking: kind === 'might' || kind === 'stability',
        self: empty(),
        selfOnly: empty(),
        sharedWithSelf: empty(),
        allies: empty()
      };
      totals.set(kind, {
        intensityStacking: previous.intensityStacking,
        self: add(previous.self, own),
        selfOnly: add(previous.selfOnly, allied > 0 ? 0 : own),
        sharedWithSelf: add(previous.sharedWithSelf, allied > 0 ? own : 0),
        allies: add(previous.allies, allied)
      });
    }
  }

  return { alliedPlayerCount, boons: totals };
}
