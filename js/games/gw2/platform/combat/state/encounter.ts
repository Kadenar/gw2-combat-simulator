import { canonicalTime } from '#kernel/core/clock.js';

export interface EncounterPhaseTarget {
  readonly id: string;
  readonly name: string;
  readonly maximumHealth: number;
  readonly armor: number;
  readonly groupDps: number;
  readonly endHealthPercent: number;
  /** Null preserves this target's live health; a value starts a replacement bar or explicit transformation. */
  readonly startHealthPercent: number | null;
  readonly entryHealthLossPercent: number;
}

export type EncounterPhase =
  | {
      readonly id: string;
      readonly kind: 'boss';
      readonly playerTargetId: string;
      readonly targets: readonly EncounterPhaseTarget[];
      readonly durationSeconds: number | null;
    }
  | { readonly id: string; readonly kind: 'split' | 'intermission'; readonly durationSeconds: number };

export interface EncounterConfig {
  readonly phases: readonly EncounterPhase[];
  /** Only time-driven cycles repeat; health-gated encounters finish after their final damage phase. */
  readonly repeatFrom: string | null;
}

export interface EncounterPhaseResult {
  readonly id: string;
  readonly kind: 'boss' | 'split' | 'intermission';
  readonly start: number;
  end: number | null;
  playerDamage: number;
  groupDamage: number;
  dps: number;
}

export interface EncounterTargetResult {
  readonly id: string;
  readonly name: string;
  readonly maximumHealth: number;
  readonly armor: number;
  readonly remainingHealth: number;
}

export interface EncounterResult {
  readonly health: number;
  readonly remainingHealth: number;
  readonly targetName: string;
  readonly armor: number;
  readonly targets: readonly EncounterTargetResult[];
  readonly phaseId: string;
  readonly phaseKind: 'boss' | 'split' | 'intermission';
  readonly defeated: boolean;
  readonly elapsed: number;
  readonly nextHealthPercent: number | null;
  readonly damageToTransition: number;
  readonly timeToTransition: number | null;
  readonly windowRemaining: number | null;
  readonly overallDps: number;
  readonly phases: readonly EncounterPhaseResult[];
}

/** Seed the shared resolver from the first real target, never the sum of unrelated boss health pools. */
export function initialEncounterTarget(config: EncounterConfig): EncounterPhaseTarget {
  const first = config.phases.find((phase) => phase.kind === 'boss');

  const target = first?.targets.find((entry) => entry.id === first.playerTargetId);

  if (!target) throw new TypeError('Encounter requires a selected damageable target.');

  return target;
}

/** Separate target state survives phases; one clock schedules squad ticks, timed windows, and authored splits. */
export function createEncounter(config: EncounterConfig, schedule: (at: number, generation: number) => void) {
  initialEncounterTarget(config);
  const phaseIds = new Set(config.phases.map((phase) => phase.id));

  if (phaseIds.size !== config.phases.length || (config.repeatFrom !== null && !phaseIds.has(config.repeatFrom)))
    throw new TypeError('Encounter phase IDs and repeat destination must be valid.');

  for (const phase of config.phases) {
    if (phase.kind === 'boss') {
      if (
        !phase.targets.some((target) => target.id === phase.playerTargetId) ||
        !phase.targets.length ||
        new Set(phase.targets.map((target) => target.id)).size !== phase.targets.length
      )
        throw new TypeError('Boss phases require unique targets and non-negative group DPS.');

      for (const target of phase.targets) {
        if (
          !Number.isFinite(target.groupDps) ||
          target.groupDps < 0 ||
          !Number.isSafeInteger(target.armor) ||
          target.armor <= 0 ||
          !Number.isSafeInteger(target.maximumHealth) ||
          target.maximumHealth <= 0 ||
          !Number.isFinite(target.endHealthPercent) ||
          target.endHealthPercent < 0 ||
          target.endHealthPercent >= 100 ||
          (target.startHealthPercent !== null &&
            (!Number.isFinite(target.startHealthPercent) ||
              target.startHealthPercent <= target.endHealthPercent ||
              target.startHealthPercent > 100)) ||
          !Number.isFinite(target.entryHealthLossPercent) ||
          target.entryHealthLossPercent < 0 ||
          target.entryHealthLossPercent > 100
        )
          throw new TypeError('Encounter target health and gates must be valid.');
      }
    }

    if (
      phase.durationSeconds !== null &&
      (!Number.isFinite(phase.durationSeconds) ||
        phase.durationSeconds < 0 ||
        (phase.kind === 'boss' && phase.durationSeconds === 0))
    )
      throw new TypeError('Phase duration must be finite and non-negative; damage windows must be positive.');
  }

  if (
    config.repeatFrom !== null &&
    !config.phases.some((phase) => phase.kind === 'boss' && phase.durationSeconds !== null)
  )
    throw new TypeError('Repeating encounters need a timed damage window.');

  const targets = new Map<
    string,
    { id: string; name: string; maximumHealth: number; armor: number; remainingHealth: number; revision: number }
  >();
  for (const phase of config.phases)
    if (phase.kind === 'boss')
      for (const target of phase.targets) {
        if (!targets.has(target.id))
          targets.set(target.id, {
            id: target.id,
            name: target.name,
            maximumHealth: target.maximumHealth,
            armor: target.armor,
            revision: 0,
            remainingHealth: (target.maximumHealth * (target.startHealthPercent ?? 100)) / 100
          });
      }

  let index = 0;
  let generation = 0;
  let start: number | null = null;
  let death: number | null = null;
  let deadline: number | null = null;
  let nextTick: number | null = null;
  let selected = initialEncounterTarget(config).id;
  const phases: EncounterPhaseResult[] = [];
  const targetWindows: { key: string; start: number; end: number | null }[] = [];
  let queryTarget: string | null = null;
  const targetKey = (id: string) => `${id}:${targets.get(id)!.revision}`;
  const closeWindows = (at: number, key?: string) => {
    for (const window of targetWindows)
      if (window.end === null && (key === undefined || window.key === key)) window.end = at;
  };

  const phase = () => config.phases[index]!;
  const gate = (target: EncounterPhaseTarget) => Math.floor((target.maximumHealth * target.endHealthPercent) / 100);
  const available = () => {
    const current = phase();
    return current.kind === 'boss'
      ? current.targets.filter((target) => targets.get(target.id)!.remainingHealth > gate(target))
      : [];
  };

  // Player attacks stay on the authored target; phasing it does not teleport the player to another platform.
  const chooseTarget = () => targets.get(selected)!;
  function enqueue(): void {
    const at = Math.min(deadline ?? Infinity, nextTick ?? Infinity);

    if (Number.isFinite(at)) schedule(at, generation);
  }

  function enter(at: number): void {
    // Zero-length splits settle immediately without resetting player resources or cooldowns.
    for (let guard = 0; guard <= config.phases.length; guard++) {
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
      deadline = current.durationSeconds === null ? null : canonicalTime(at + current.durationSeconds);
      nextTick =
        current.kind === 'boss' && current.targets.some((target) => target.groupDps > 0) ? canonicalTime(at + 1) : null;

      if (current.kind === 'boss') {
        selected = current.playerTargetId;
        for (const definition of current.targets) {
          const target = targets.get(definition.id)!;

          if (target.maximumHealth !== definition.maximumHealth && definition.startHealthPercent === null)
            throw new TypeError('A replacement health bar requires an explicit starting percentage.');

          target.maximumHealth = definition.maximumHealth;
          target.armor = definition.armor;

          if (definition.startHealthPercent !== null) {
            target.revision += 1;
            target.remainingHealth = (definition.maximumHealth * definition.startHealthPercent) / 100;
          }

          if (definition.entryHealthLossPercent > 0)
            target.remainingHealth -= Math.min(
              Math.max(0, target.remainingHealth - gate(definition)),
              (definition.maximumHealth * definition.entryHealthLossPercent) / 100
            );
        }

        for (const target of available()) targetWindows.push({ key: targetKey(target.id), start: at, end: null });

        if (available().length) {
          enqueue();
          return;
        }
      } else if (current.durationSeconds > 0) {
        enqueue();
        return;
      }

      phases.at(-1)!.end = at;

      if (!move(at)) return;
    }

    throw new TypeError('Encounter contains a zero-time phase cycle.');
  }

  function move(at: number): boolean {
    if (index + 1 < config.phases.length) {
      index += 1;
      return true;
    }

    if (config.repeatFrom !== null && [...targets.values()].some((target) => target.remainingHealth > 0)) {
      index = config.phases.findIndex((entry) => entry.id === config.repeatFrom);
      return true;
    }

    death = at;
    generation += 1;
    deadline = null;
    nextTick = null;
    return false;
  }

  function advance(at: number): void {
    closeWindows(at);
    phases.at(-1)!.end = at;

    if (move(at)) enter(at);
  }

  function completeIfReady(at: number): void {
    if (phase().kind !== 'boss' || available().length) return;

    // A repeating cycle ends on target defeat instead of forcing one final downtime interval.
    if (config.repeatFrom !== null && [...targets.values()].every((target) => target.remainingHealth <= 0)) {
      phases.at(-1)!.end = at;
      death = at;
      generation += 1;
    } else advance(at);
  }

  function apply(amount: number, owner: 'player' | 'group', target: EncounterPhaseTarget, at: number): number {
    const state = targets.get(target.id)!;
    const accepted = Math.min(amount, Math.max(0, state.remainingHealth - gate(target)));
    state.remainingHealth -= accepted;

    if (state.remainingHealth <= gate(target)) closeWindows(at, targetKey(target.id));

    phases.at(-1)![owner === 'player' ? 'playerDamage' : 'groupDamage'] += accepted;
    return accepted;
  }

  const defeated = () => death !== null;
  function damage(amount: number, owner: 'player' | 'group', at: number, key?: string): number {
    if (start === null || death !== null || phase().kind !== 'boss') return 0;

    let accepted = 0;
    while (accepted < amount && !defeated() && phase().kind === 'boss') {
      const target = available().find((entry) =>
        key === undefined ? entry.id === selected : targetKey(entry.id) === key
      );

      if (!target) break;

      accepted += apply(amount - accepted, owner, target, at);
      const previousKey = targetKey(target.id);
      const nextIsDowntime = config.phases[index + 1] !== undefined && config.phases[index + 1]!.kind !== 'boss';
      const oldIndex = index;
      completeIfReady(at);

      // Splits and intermissions block all damage, including overkill carried across a transition.
      if (nextIsDowntime || index === oldIndex || selected !== target.id || targetKey(target.id) !== previousKey) break;
    }

    return accepted;
  }

  return {
    begin(at: number): void {
      if (start === null) {
        start = at;
        enter(at);
      }
    },
    damage,
    get remainingHealth() {
      return chooseTarget().remainingHealth;
    },
    // Strike resolution samples the selected target on every hit, including after a phase target change.
    get armor() {
      return chooseTarget().armor;
    },
    get remainingHealthFraction() {
      const target = queryTarget === null ? chooseTarget() : targets.get(queryTarget)!;
      return target.remainingHealth / target.maximumHealth;
    },
    get activeTargetKey() {
      return targetKey(queryTarget ?? chooseTarget().id);
    },
    /** Condition samples query their own target while the player's selected target stays unchanged. */
    withTarget<T>(key: string, operation: () => T): T {
      const target = [...targets.values()].find((entry) => targetKey(entry.id) === key);
      const previous = queryTarget;
      queryTarget = target?.id ?? null;
      try {
        return operation();
      } finally {
        queryTarget = previous;
      }
    },
    get damageable() {
      return death === null && phase().kind === 'boss' && available().some((target) => target.id === selected);
    },
    // Only intermissions hold authored commands; ordinary splits remain available for preparation skills.
    get rotationResumeAt() {
      return start !== null && death === null && phase().kind === 'intermission' ? deadline : null;
    },
    get deathTime() {
      return death;
    },
    // Generation tokens cancel ticks owned by an earlier phase; timeouts win ties at window boundaries.
    wake(at: number, token: number): number {
      if (token !== generation || death !== null) return 0;

      if (deadline !== null && at >= deadline) {
        advance(at);
        return 0;
      }

      const current = phase();

      if (current.kind !== 'boss' || nextTick === null || at < nextTick) return 0;

      const active = available();
      let accepted = 0;
      for (const target of active) accepted += apply(target.groupDps, 'group', target, at);
      completeIfReady(at);

      if (token === generation) {
        nextTick = canonicalTime(at + 1);
        enqueue();
      }

      return accepted;
    },
    damageableDuration(from: number, to: number, key?: string): number {
      if (key !== undefined)
        return targetWindows.reduce(
          (sum, window) =>
            window.key === key ? sum + Math.max(0, Math.min(to, window.end ?? to) - Math.max(from, window.start)) : sum,
          0
        );

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
      const target = chooseTarget();
      const phaseDps = rows.at(-1)?.dps ?? 0;
      const active = available();
      const needed = active.reduce((sum, entry) => sum + targets.get(entry.id)!.remainingHealth - gate(entry), 0);
      const timed = deadline === null ? Infinity : Math.max(0, deadline - end);
      const healthEstimate =
        current.kind === 'boss'
          ? Math.max(
              0,
              ...active.map((entry) => {
                const targetRate = entry.groupDps + (entry.id === selected ? phaseDps : 0);
                return targetRate > 0 ? (targets.get(entry.id)!.remainingHealth - gate(entry)) / targetRate : Infinity;
              })
            )
          : Infinity;
      const estimate = Math.min(timed, healthEstimate);
      return {
        health: target.maximumHealth,
        remainingHealth: target.remainingHealth,
        targetName: target.name,
        armor: target.armor,
        // Target revisions are internal condition ownership; results expose only target health and identity.
        targets: [...targets.values()].map(({ revision: _revision, ...entry }) => entry),
        phaseId: current.id,
        phaseKind: current.kind,
        defeated: death !== null,
        elapsed,
        nextHealthPercent:
          current.kind === 'boss'
            ? (current.targets.find((entry) => entry.id === selected)?.endHealthPercent ?? null)
            : null,
        windowRemaining: deadline === null ? null : Math.max(0, deadline - end),
        damageToTransition: needed,
        timeToTransition: death !== null ? 0 : Number.isFinite(estimate) ? estimate : null,
        overallDps: elapsed > 0 ? rows.reduce((sum, row) => sum + row.playerDamage, 0) / elapsed : 0,
        phases: rows
      };
    }
  };
}

export type EncounterController = ReturnType<typeof createEncounter>;
