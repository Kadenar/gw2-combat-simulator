/** Account for generated boons on the player and one independent hypothetical ally. */
import {
  advanceDurationStack,
  applyBoonExtension,
  boonKey,
  durationStackingBoonCapSeconds,
  isDurationStackingBoon,
  isStandardBoon,
  normalizeBoonDuration,
  recordBuffApplication,
  remainingDurationStackSeconds,
  standardBoonPresentation,
  type Gw2TimedBuffApplication
} from '#gw2/platform/combat/boons.js';
import { observeBuffState } from '#gw2/platform/combat/effect-state.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { ACTOR, BOON, RECIPIENT } from '#gw2/platform/constants.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { EffectRecorder } from '#gw2/platform/results/effect-report.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { canonicalEvent, eventCausalOrder } from '#kernel/events/queue.js';

export interface BoonGeneration {
  readonly generatedStackSeconds: number;
}

export interface BoonGenerationByAudience {
  readonly intensityStacking: boolean;
  readonly self: BoonGeneration;
  readonly ally: BoonGeneration;
}

/** Coverage counts generated supply, including duration beyond the observation end. */
export interface BoonCoverage {
  readonly quickness: { readonly selfPercent: number; readonly allyPercent: number };
  readonly alacrity: { readonly selfPercent: number; readonly allyPercent: number };
}

interface GenerationWindow {
  readonly start: number | null;
  readonly end: number;
}

/** Share audience and extension accounting while score collection keeps only two bounded duration pools. */
export function createBoonGenerationCollector(retainHistory: boolean, window: () => GenerationWindow) {
  const recipients = [new Map<string, Gw2TimedBuffApplication[]>(), new Map<string, Gw2TimedBuffApplication[]>()];
  const totals = new Map<string, BoonGenerationByAudience>();
  const pending = new Map<string, [number, number]>();
  let pendingAt = -Infinity;
  let knownStart: number | null = null;
  const empty = (kind: string): BoonGenerationByAudience => ({
    intensityStacking: kind === boonKey(BOON.MIGHT) || kind === boonKey(BOON.STABILITY),
    self: { generatedStackSeconds: 0 },
    ally: { generatedStackSeconds: 0 }
  });
  // Delay credit until the timestamp settles so first damage and target death can establish either boundary.
  function flush({ start, end }: GenerationWindow): void {
    if (knownStart === null && start !== null) {
      knownStart = start;

      if (start > 0) for (const kind of totals.keys()) totals.set(kind, empty(kind));
    }

    if (pendingAt >= (start ?? 0) && pendingAt < end) {
      for (const [kind, amounts] of pending) {
        const previous = totals.get(kind) ?? empty(kind);
        totals.set(kind, {
          intensityStacking: previous.intensityStacking,
          self: { generatedStackSeconds: previous.self.generatedStackSeconds + amounts[0] },
          ally: { generatedStackSeconds: previous.ally.generatedStackSeconds + amounts[1] }
        });
      }
    }

    pending.clear();
  }

  function record(input: SimulationEvent): void {
    if (
      input.cancelled ||
      input.actorType === ACTOR.ENVIRONMENT ||
      (input.type !== 'buff' && input.type !== 'boon_extension')
    )
      return;

    const event = normalizeBoonDuration(canonicalEvent(input));
    const bounds = window();

    if (event.at >= bounds.end) return;

    if (event.at !== pendingAt) {
      flush(bounds);
      pendingAt = event.at;
    }

    for (const [index, boons] of recipients.entries()) {
      const credit = (kind: string, amount: number): void => {
        if (!totals.has(kind)) totals.set(kind, empty(kind));

        const values = pending.get(kind) ?? [0, 0];
        values[index] += amount;
        pending.set(kind, values);
      };

      if (event.type === 'buff') {
        const kind = String(event.kind).toLowerCase();

        if (!isStandardBoon(kind) || (!retainHistory && kind !== 'quickness' && kind !== 'alacrity')) continue;

        // Party grants contribute once even when live allies are absent or the native recipient cap is small.
        // Named grants count only for ally 1 so per-player procs cannot multiply the hypothetical ally's supply.
        const applies =
          index === 0
            ? gw2BoonApplicationRecipients({}, event.audience ? { ...event, resolvedAudience: undefined } : event)
                .includesSelf
            : event.audience
              ? event.audience.recipients === RECIPIENT.PARTY && (event.audience.alliedPlayerIndex ?? 1) === 1
              : (event.resolvedAudience?.alliedPlayerCount ?? 0) > 0 &&
                (event.resolvedAudience?.alliedPlayerIndex ?? 1) === 1;

        if (!applies) continue;

        credit(kind, Math.max(0, event.duration || 0) * Math.max(1, event.stacks || 1));
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
      } else {
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
          credit(kind, stacks * Math.max(0, event.duration || 0));
        }

        applyBoonExtension(boons, { ...event, extensionAudience: RECIPIENT.SELF });
      }

      // Compact score state after each accepted event; old receipts cannot affect future extension eligibility.
      if (!retainHistory)
        for (const [kind, applications] of boons) {
          const duration = remainingDurationStackSeconds(applications, event.at, {
            maximum: durationStackingBoonCapSeconds(kind)
          });
          boons.set(
            kind,
            duration > 0
              ? [
                  {
                    at: event.at,
                    expiresAt: canonicalTime(event.at + duration),
                    duration,
                    stacks: 1,
                    resolvedAudience: applications[0]!.resolvedAudience
                  }
                ]
              : []
          );
        }
    }
  }

  return {
    record,
    finish(start: number, end: number) {
      flush({ start, end });
      return {
        boons: totals as ReadonlyMap<string, BoonGenerationByAudience>,
        allyApplications: recipients[1]! as ReadonlyMap<string, readonly Gw2TimedBuffApplication[]>
      };
    }
  };
}

/** Replay resolved events through the same collector used during score execution. */
export function buildBoonGeneration(events: readonly SimulationEvent[], start: number, end: number) {
  const collector = createBoonGenerationCollector(true, () => ({ start, end }));
  const ordered = [...events].sort(
    (left, right) => left.at - right.at || (eventCausalOrder(left) ?? 0) - (eventCausalOrder(right) ?? 0)
  );
  for (const event of ordered) collector.record(event);
  return collector.finish(start, end);
}

/** Use the DPS window as denominator while combat entry controls which applications receive credit. */
export function generatedBoonCoverage(
  boons: ReadonlyMap<string, BoonGenerationByAudience>,
  dpsWindow: number
): BoonCoverage {
  const coverage = (kind: string) => ({
    selfPercent: dpsWindow > 0 ? ((boons.get(kind)?.self.generatedStackSeconds ?? 0) / dpsWindow) * 100 : 0,
    allyPercent: dpsWindow > 0 ? ((boons.get(kind)?.ally.generatedStackSeconds ?? 0) / dpsWindow) * 100 : 0
  });
  return { quickness: coverage('quickness'), alacrity: coverage('alacrity') };
}

/** Project one hypothetical ally without changing live combat recipients. */
export function projectedPartyEffects(generation: ReturnType<typeof buildBoonGeneration>, end: number) {
  const recorder = new EffectRecorder();
  // Each track owns its capture scope, so unrelated grants never replay or clear its accepted history.
  for (const [kind, applications] of generation.allyApplications) {
    const recipientId = 'ally:1';
    const scope = `${recipientId}:${kind}`;
    const policy = { kind, maximumStacks: standardBoonPresentation(kind)?.maximumStacks };
    const duration = isDurationStackingBoon(kind);
    const template = observeBuffState(kind, [], 0, policy, recipientId);
    const maximum = durationStackingBoonCapSeconds(kind);
    const times = new Set([0, end]);
    for (const application of applications) {
      if (application.at <= end) times.add(application.at);

      if (application.expiresAt <= end) times.add(application.expiresAt);
    }

    // Generation histories are chronological, including extension splits; retain only live intensity windows.
    let next = 0;
    let live: Gw2TimedBuffApplication[] = [];
    let remaining = 0;
    let previousTime = 0;
    let source: SimulationEvent | undefined;
    for (const at of [...times].sort((a, b) => a - b)) {
      if (!duration) live = live.filter((application) => application.expiresAt > at);

      while (next < applications.length && applications[next]!.at <= at) {
        const application = applications[next++]!;

        if (duration) {
          remaining = advanceDurationStack(remaining, application, previousTime, maximum);
          previousTime = application.at;

          if (application.event) source = application.event;
        } else if (application.expiresAt > at) live.push(application);
      }

      const pool = duration ? canonicalTime(Math.max(0, remaining - Math.max(0, at - previousTime))) : 0;
      const state = duration
        ? {
            ...template,
            source,
            windows: pool > 0 ? [{ stacks: 1, expiresAt: canonicalTime(at + pool) }] : []
          }
        : observeBuffState(kind, live, at, policy, recipientId);
      recorder.capture(at, [{ ...state, origin: 'party-projection' }], scope);
    }
  }

  return recorder.finish(end);
}
