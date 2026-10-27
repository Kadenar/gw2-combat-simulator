import { eventDamagePackets } from '#gw2/platform/results/damage-packets.js';
import { effectSummary } from '#gw2/platform/results/effect-report.js';
import {
  mechanicResourceSpends,
  timelineDeadTimeMarkers,
  timelineStepsWithChargeFills
} from '#gw2/app/rotation/timeline/model.js';
import type { Gw2SimulationResult, SimulationStep } from '#gw2/platform/results/types.js';

interface ObservationInterval {
  startMs: number;
  endMs: number;
}

interface SkillObservation {
  label: string;
  damage: number;
  casts: number;
  hits: number;
}

/** Typed canonical identities keep same-named skills and actor components separate. */
function skillKey(actor: string, id: unknown, summon = ''): string {
  return JSON.stringify([actor, id, summon]);
}

/** Union intervals before measuring so overlapping waits or failed attempts never multiply elapsed time. */
function intervalSeconds(intervals: readonly ObservationInterval[]): number {
  const merged: ObservationInterval[] = [];
  for (const interval of [...intervals].sort((a, b) => a.startMs - b.startMs)) {
    if (interval.endMs <= interval.startMs) continue;

    const previous = merged.at(-1);

    if (previous && interval.startMs <= previous.endMs) previous.endMs = Math.max(previous.endMs, interval.endMs);
    else merged.push({ ...interval });
  }

  return merged.reduce((sum, interval) => sum + (interval.endMs - interval.startMs) / 1000, 0);
}

/**
 * Index a detached run once. Point payouts use [start, end], matching engine terminal-hit reporting;
 * intervals use clipped duration, so shared endpoints have zero area. Condition ticks already contain
 * each application's exact fractional/rounded payout and replace its aggregate damage entirely.
 */
export function rotationObservations(result: Gw2SimulationResult, duration: number) {
  const start = result.dpsStartTime;
  const end = start + duration;
  const inside = (at: number) => duration > 0 && at >= start && at <= end;
  const skills = new Map<string, SkillObservation>();
  const activations = new Map<string, SimulationStep>();
  const countedActivations = new Set<string>();
  const usefulActivations = new Set<string>();
  const procs = new Map<string, { label: string; count: number }>();
  const ensureSkill = (id: string, label: string) => {
    let row = skills.get(id);

    if (!row) {
      row = { label, damage: 0, casts: 0, hits: 0 };
      skills.set(id, row);
    }

    return row;
  };

  for (const step of result.steps) {
    if (step.activationId) activations.set(step.activationId, step);

    if (step.invalid || step.skillId == null || !inside(step.start / 1000)) continue;

    const row = ensureSkill(skillKey('player', step.skillId), step.skill);
    row.casts++;

    if (step.activationId) countedActivations.add(step.activationId);
  }

  let damage = 0;
  for (const event of result.resolvedEvents) {
    const step = event.activationId ? activations.get(event.activationId) : undefined;
    const owner = event.traitId ?? event.skillId ?? event.sourceId;
    const id = skillKey(event.actorType, owner, event.summonKind);
    const packets =
      event.type === 'damage' || event.type === 'condition'
        ? eventDamagePackets(event).filter((packet) => inside(packet.at))
        : [];
    const amount = event.cancelled === true ? 0 : packets.reduce((sum, packet) => sum + packet.damage, 0);

    // Environment damage is outside the player's score, just as it is in resolver totals.
    if (event.actorType !== 'environment' && amount > 0) {
      const row = ensureSkill(id, event.name || event.skillName || String(owner));

      // The opening cast often precedes first damage; count it when its own output enters this window.
      if (
        step?.activationId &&
        !step.invalid &&
        event.actorType === 'player' &&
        event.traitId == null &&
        step.skillId === owner &&
        !countedActivations.has(step.activationId)
      ) {
        row.casts++;
        countedActivations.add(step.activationId);
      }

      row.damage += amount;
      damage += amount;
      const hits = event.type === 'damage' && event.damageKind !== 'condition' ? (event.hits ?? 1) : 0;
      row.hits += hits;
    }

    // Preserve accepted damage and utility so support casts are never treated as unresolved failures.
    if (
      event.activationId &&
      (amount > 0 ||
        (inside(event.at) &&
          event.cancelled !== true &&
          ['buff', 'resource', 'control', 'aura', 'combo', 'boon_extension', 'condition'].includes(event.type)))
    )
      usefulActivations.add(event.activationId);

    const count = event.metadata?.procCount;

    if (count != null && count > 0 && inside(event.at) && event.cancelled !== true) {
      const procId = JSON.stringify([event.actorType, event.traitId ?? event.sourceId]);
      const proc = procs.get(procId) ?? {
        label: event.name || event.skillName || String(event.sourceId),
        count: 0
      };
      proc.count += count;
      procs.set(procId, proc);
    }
  }

  const cancellations = new Map<string, { label: string; count: number }>();
  for (const step of result.steps) {
    if (!step.interrupted || step.invalid || step.skillId == null || !inside(step.end / 1000)) continue;

    // Preserved damage or utility is not an unresolved interruption in the comparison.
    if (step.activationId && usefulActivations.has(step.activationId)) continue;

    const id = skillKey('player', step.skillId);
    const row = cancellations.get(id) ?? { label: step.skill, count: 0 };
    row.count++;
    cancellations.set(id, row);
  }

  const idleIntervals = new Map<string, ObservationInterval[]>();
  const stepsByIndex = new Map(result.steps.map((step) => [step.ri, step]));
  for (const marker of timelineDeadTimeMarkers(
    timelineStepsWithChargeFills(result.steps, mechanicResourceSpends(result)),
    result.resolvedEvents
  )) {
    const kind = marker.reason == null ? 'gap' : marker.reason === 'explicit-wait' ? 'wait' : 'failed-cast';
    const step = stepsByIndex.get(marker.insertionIndex);

    // A commit marker alone cannot erase recorded utility; keep that time occupied rather than calling it failed.
    if (kind === 'failed-cast' && step?.activationId && usefulActivations.has(step.activationId)) continue;

    const startMs = Math.max(start * 1000, marker.start);
    const endMs = Math.min(end * 1000, marker.end);

    if (endMs <= startMs) continue;

    const intervals = idleIntervals.get(kind) ?? [];
    intervals.push({ startMs, endMs });
    idleIntervals.set(kind, intervals);
  }

  const idle = new Map([...idleIntervals].map(([kind, intervals]) => [kind, intervalSeconds(intervals)]));
  const effectsAvailable =
    result.effectReport != null && result.effectReport.start <= start && result.effectReport.end >= end;
  const effects = new Map(
    (effectsAvailable ? result.effectReport.tracks : []).map((track) => {
      const { uptime, averageStacks } = effectSummary(track, start, end);
      return [
        track.id,
        {
          label: track.name ?? track.kind,
          effect: {
            kind: track.kind,
            name: track.name,
            origin: track.origin,
            recipient: track.recipient
          },
          uptime,
          averageStacks
        }
      ] as const;
    })
  );
  return { damage, skills, procs, cancellations, idle, effects, effectsAvailable };
}
