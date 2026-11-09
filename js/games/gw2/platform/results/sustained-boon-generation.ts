/** Estimate repeated supply from complete observed yields, keeping each recipient and source independent. */
import { isDurationStackingBoon } from '#gw2/platform/combat/boons.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { RECIPIENT } from '#gw2/platform/constants.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

export interface SustainedBoonSource {
  readonly sourceId: string;
  readonly name: string;
  readonly percent: number | null;
  readonly intervals: number;
  readonly excludedIntervals: number;
  readonly reasons: readonly string[];
}

export interface SustainedBoonEstimate {
  readonly percent: number | null;
  readonly status: 'available' | 'incomplete' | 'unavailable';
  readonly intervals: number;
  readonly sources: readonly SustainedBoonSource[];
}

export interface SustainedBoonByAudience {
  readonly self: SustainedBoonEstimate;
  readonly ally: SustainedBoonEstimate;
}

/** Rejected applications have a known zero yield; pending applications can still make a batch incomplete. */
export interface ScheduledBoonApplication {
  readonly event: SimulationEvent;
  rejected: boolean;
}

/** Match the existing hypothetical ally policy, including named grants and self-only applications. */
export function generationApplies(event: SimulationEvent, index: number): boolean {
  if (event.type === 'boon_extension') return index === 0 || event.extensionAudience === 'all';

  return index === 0
    ? gw2BoonApplicationRecipients({}, event.audience ? { ...event, resolvedAudience: undefined } : event).includesSelf
    : event.audience
      ? event.audience.recipients === RECIPIENT.PARTY && (event.audience.alliedPlayerIndex ?? 1) === 1
      : (event.resolvedAudience?.alliedPlayerCount ?? 0) > 0 && (event.resolvedAudience?.alliedPlayerIndex ?? 1) === 1;
}

interface Batch {
  readonly event: SimulationEvent;
  readonly seen: Set<number>;
  readonly recipients: readonly boolean[];
}

interface Activation {
  readonly at: number;
  readonly batches: Map<string, Batch>;
}

interface Source {
  readonly key: string;
  readonly activations: Map<string, Activation>;
}

interface Credit {
  readonly event: SimulationEvent;
  readonly source: Source;
  readonly kind: string;
  readonly recipient: number;
  readonly amount: number;
}

interface SourceSample {
  readonly name: string;
  readonly yields: Map<string, number>;
  readonly activations: Map<number, { duration: number; complete: boolean }>;
  readonly reasons: Set<string>;
}

type AudienceSamples = readonly [Map<Source, SourceSample>, Map<Source, SourceSample>];

/** Scheduled batches expose omitted final pulses; only resolved credits supply generated duration. */
export function createSustainedBoonCollector() {
  const sources = new Map<string, Source>();
  const eventSources = new WeakMap<SimulationEvent, Source>();
  const credits: Credit[] = [];

  // Observation and each audience's credit share the event's one source lookup.
  function sourceFor(event: SimulationEvent): Source {
    const cached = eventSources.get(event);

    if (cached) return cached;

    const key = JSON.stringify([
      event.actorType,
      event.ownerActorType,
      event.summonKind,
      event.traitId,
      event.sourceId
    ]);
    let source = sources.get(key);

    if (!source) {
      source = { key, activations: new Map() };
      sources.set(key, source);
    }

    eventSources.set(event, source);
    return source;
  }

  function expect(event: SimulationEvent, rejected = false): Batch | undefined {
    if (!event.boonGeneration || !['buff', 'boon_extension'].includes(event.type)) return;

    const lineage = event.boonGeneration;
    const source = sourceFor(event);
    let activation = source.activations.get(lineage.activationId);

    if (!activation) {
      activation = { at: lineage.at, batches: new Map() };
      source.activations.set(lineage.activationId, activation);
    }

    let batch = activation.batches.get(lineage.batchId);

    if (!batch) {
      batch = { event, seen: new Set(), recipients: [generationApplies(event, 0), generationApplies(event, 1)] };
      activation.batches.set(lineage.batchId, batch);
    }

    if (rejected) batch.seen.add(lineage.applicationIndex);

    return batch;
  }

  function observe(event: SimulationEvent): void {
    expect(event)?.seen.add(event.boonGeneration!.applicationIndex);
  }

  function finish(start: number, end: number): Readonly<Record<string, SustainedBoonByAudience>> {
    const rows = new Map<string, AudienceSamples>();
    const sourceRows = new Map<Source, Map<string, (SourceSample | undefined)[]>>();

    // Group credits once. Labels belong to the contributed boon and audience, not the source's first packet.
    for (const { event, source, kind, recipient, amount } of credits) {
      if (amount <= 0 || event.at < start || event.at >= end) continue;

      let audiences = rows.get(kind);

      if (!audiences) {
        audiences = [new Map(), new Map()];
        rows.set(kind, audiences);
      }

      if (event.boonGeneration && event.boonGeneration.at < start) continue;

      let sample = audiences[recipient]!.get(source);

      if (!sample) {
        sample = {
          name: event.name ?? event.skillName ?? String(event.sourceId),
          yields: new Map(),
          activations: new Map(),
          reasons: new Set()
        };
        audiences[recipient]!.set(source, sample);
        let kinds = sourceRows.get(source);

        if (!kinds) {
          kinds = new Map();
          sourceRows.set(source, kinds);
        }

        const samples = kinds.get(kind) ?? [];
        samples[recipient] = sample;
        kinds.set(kind, samples);
      }

      const id = event.boonGeneration?.activationId;

      if (id) sample.yields.set(id, (sample.yields.get(id) ?? 0) + amount);
      else sample.reasons.add('Missing activation lineage');
    }

    // Visit each activation's batches once. Extensions can contribute to several boon rows.
    for (const [source, kinds] of sourceRows) {
      for (const [id, activation] of source.activations) {
        if (activation.at < start || activation.at >= end) continue;

        const matched = new Map<SourceSample, boolean>();
        for (const { event, seen, recipients } of activation.batches.values()) {
          const complete = seen.size === event.boonGeneration!.expectedApplications;
          const include = (samples: (SourceSample | undefined)[] | undefined): void => {
            samples?.forEach((sample, recipient) => {
              if (sample && recipients[recipient]) matched.set(sample, (matched.get(sample) ?? true) && complete);
            });
          };

          if (event.type === 'buff') include(event.kind ? kinds.get(event.kind.toLowerCase()) : undefined);
          else
            for (const [kind, samples] of kinds)
              if ((!event.kind || event.kind === kind) && event.excludedKind !== kind) include(samples);
        }

        // Simultaneous procs share a repeat boundary and sum their yields without zero-length intervals.
        for (const [sample, complete] of matched) {
          const group = sample.activations.get(activation.at) ?? { duration: 0, complete: true };
          group.duration += sample.yields.get(id) ?? 0;
          group.complete &&= complete;
          sample.activations.set(activation.at, group);
        }
      }
    }

    const result: Record<string, SustainedBoonByAudience> = {};
    for (const [kind, audiences] of rows) {
      const estimates = audiences.map((samples): SustainedBoonEstimate => {
        const estimates: SustainedBoonSource[] = [];
        for (const [source, sample] of samples) {
          const activations = [...sample.activations].sort(([a], [b]) => a - b);
          const reasons = sample.reasons;
          let duration = 0;
          let elapsed = 0;
          let intervals = 0;
          let excludedIntervals = 0;
          for (let i = 0; i + 1 < activations.length; i++) {
            const [at, group] = activations[i]!;

            if (!group.complete) {
              excludedIntervals++;
              reasons.add('Incomplete activation yield');
              continue;
            }

            intervals++;
            elapsed += activations[i + 1]![0] - at;
            duration += group.duration;
          }

          if (activations.length < 2 && !reasons.has('Missing activation lineage'))
            reasons.add('Fewer than two observed activations');

          estimates.push({
            sourceId: source.key,
            name: sample.name,
            percent: elapsed > 0 ? (duration / elapsed) * 100 : null,
            intervals,
            excludedIntervals,
            reasons: [...reasons]
          });
        }

        const intervals = estimates.reduce((sum, source) => sum + source.intervals, 0);
        const incomplete = estimates.some((source) => source.percent === null || source.reasons.length > 0);
        return {
          percent: incomplete ? null : estimates.reduce((sum, source) => sum + (source.percent ?? 0), 0),
          status: incomplete ? (intervals > 0 ? 'incomplete' : 'unavailable') : 'available',
          intervals,
          sources: estimates
        };
      });
      result[kind] = { self: estimates[0]!, ally: estimates[1]! };
    }

    return result;
  }

  return {
    expect,
    observe,
    finish,
    credit(event: SimulationEvent, kind: string, recipient: number, amount: number): void {
      if (isDurationStackingBoon(kind)) credits.push({ event, source: sourceFor(event), kind, recipient, amount });
    }
  };
}
