import { canonicalTime } from '#kernel/core/clock.js';

export type EncounterPhase =
  | { readonly id: string; readonly kind: 'boss'; readonly endHealthPercent: number; readonly groupDps: number }
  | { readonly id: string; readonly kind: 'split'; readonly durationSeconds: number };

export interface EncounterConfig {
  readonly health: number;
  readonly phases: readonly EncounterPhase[];
}

export interface EncounterPhaseResult {
  readonly id: string;
  readonly kind: 'boss' | 'split';
  readonly start: number;
  end: number | null;
  playerDamage: number;
  groupDamage: number;
  dps: number;
}

export interface EncounterResult {
  readonly health: number;
  readonly remainingHealth: number;
  readonly phaseId: string;
  readonly phaseKind: 'boss' | 'split';
  readonly defeated: boolean;
  readonly elapsed: number;
  readonly nextHealthPercent: number | null;
  readonly damageToTransition: number;
  readonly timeToTransition: number | null;
  readonly phaseDps: number;
  readonly overallDps: number;
  readonly phases: readonly EncounterPhaseResult[];
}

/** One encounter clock owns health gates and downtime; all professions retain their live combat state. */
export function createEncounter(config: EncounterConfig, schedule: (at: number, generation: number) => void) {
  if (!Number.isSafeInteger(config.health) || config.health <= 0 || !config.phases.length)
    throw new TypeError('Encounter requires positive integer health and phases.');

  let previous = 100;
  for (const phase of config.phases) {
    if (phase.kind === 'boss') {
      if (
        !Number.isFinite(phase.endHealthPercent) ||
        phase.endHealthPercent < 0 ||
        phase.endHealthPercent >= previous ||
        !Number.isFinite(phase.groupDps) ||
        phase.groupDps < 0
      )
        throw new TypeError('Encounter health gates must descend and group DPS must be non-negative.');

      previous = phase.endHealthPercent;
    } else if (!Number.isFinite(phase.durationSeconds) || phase.durationSeconds < 0) {
      throw new TypeError('Split duration must be finite and non-negative.');
    }
  }

  if (previous !== 0 || config.phases.at(-1)?.kind !== 'boss')
    throw new TypeError('Encounter must end with target defeat.');

  let remaining = config.health;
  let index = 0;
  let generation = 0;
  let start: number | null = null;
  let death: number | null = null;
  const phases: EncounterPhaseResult[] = [];
  const phase = () => config.phases[index]!;
  const threshold = () => {
    const current = phase();
    return current.kind === 'boss' ? Math.floor((config.health * current.endHealthPercent) / 100) : remaining;
  };

  function enter(at: number): void {
    // Zero-length splits settle at the same boundary without delaying the next damage phase.
    while (index < config.phases.length) {
      const current = phase();
      generation += 1;
      phases.push({
        id: current.id,
        kind: current.kind,
        start: at,
        end: null,
        playerDamage: 0,
        groupDamage: 0,
        dps: 0
      });

      if (current.kind === 'split' && current.durationSeconds === 0) {
        phases.at(-1)!.end = at;
        index += 1;
        continue;
      }

      if (current.kind === 'split') schedule(canonicalTime(at + current.durationSeconds), generation);
      else if (current.groupDps > 0) schedule(canonicalTime(at + 1), generation);

      return;
    }
  }

  function begin(at: number): void {
    if (start !== null) return;

    start = at;
    enter(at);
  }

  function advance(at: number): void {
    phases.at(-1)!.end = at;

    if (remaining === 0) {
      death = at;
      generation += 1;
    } else {
      index += 1;
      enter(at);
    }
  }

  function damage(amount: number, owner: 'player' | 'group', at: number): number {
    if (start === null || death !== null || phase().kind === 'split') return 0;

    let accepted = 0;
    // Pure reporting bands do not discard overkill; an actual invulnerability gate does.
    while (remaining > 0 && phase().kind === 'boss' && accepted < amount) {
      const portion = Math.min(amount - accepted, Math.max(0, remaining - threshold()));
      remaining -= portion;
      accepted += portion;
      phases.at(-1)![owner === 'player' ? 'playerDamage' : 'groupDamage'] += portion;

      if (remaining > threshold()) break;

      const entersSplit = config.phases[index + 1]?.kind === 'split';
      advance(at);

      if (entersSplit) break;
    }

    return accepted;
  }

  return {
    begin,
    damage,
    get remainingHealth() {
      return remaining;
    },
    get damageable() {
      return death === null && phase().kind === 'boss';
    },
    get deathTime() {
      return death;
    },
    // Expired ticks cannot spill damage into a later phase when a player hit transitions early.
    wake(at: number, token: number): number {
      if (token !== generation || death !== null) return 0;

      const current = phase();

      if (current.kind === 'split') {
        advance(at);
        return 0;
      }

      const accepted = damage(current.groupDps, 'group', at);

      if (token === generation) schedule(canonicalTime(at + 1), generation);

      return accepted;
    },
    // Condition exposure excludes downtime even when a buffer sample straddles a transition.
    damageableDuration(from: number, to: number): number {
      return phases.reduce(
        (sum, entry) =>
          entry.kind === 'boss' ? sum + Math.max(0, Math.min(to, entry.end ?? to) - Math.max(from, entry.start)) : sum,
        0
      );
    },
    result(at: number): EncounterResult {
      const end = death ?? at;
      const elapsed = start === null ? 0 : Math.max(0, end - start);
      const rows = phases.map((entry) => {
        const duration = Math.max(0, (entry.end ?? end) - entry.start);
        return { ...entry, dps: duration > 0 ? entry.playerDamage / duration : 0 };
      });
      const current = phase();
      const currentRow = rows.at(-1);
      const phaseDps = currentRow?.dps ?? 0;
      const needed = Math.max(0, remaining - threshold());
      const rate = current.kind === 'boss' ? current.groupDps + phaseDps : 0;
      return {
        health: config.health,
        remainingHealth: remaining,
        phaseId: current.id,
        phaseKind: current.kind,
        defeated: death !== null,
        elapsed,
        nextHealthPercent: current.kind === 'boss' ? current.endHealthPercent : null,
        damageToTransition: needed,
        timeToTransition:
          death !== null
            ? 0
            : current.kind === 'split'
              ? Math.max(0, (currentRow?.start ?? end) + current.durationSeconds - end)
              : rate > 0
                ? needed / rate
                : null,
        phaseDps,
        overallDps: elapsed > 0 ? rows.reduce((sum, row) => sum + row.playerDamage, 0) / elapsed : 0,
        phases: rows
      };
    }
  };
}

export type EncounterController = ReturnType<typeof createEncounter>;
