import { initializeGw2Combat, simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { createSimulationRandom } from '#kernel/core/simulation-random.js';
import type { CombatAction, CombatSession } from '#gw2/platform/simulation/combat.js';
import type { Gw2SimulationOptions } from '#gw2/platform/simulation/types.js';
import type { RotationCommand } from '#gw2/platform/execution/types.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';

export interface RotationSearchOptions {
  profession: Gw2SimulationOptions['profession'];
  config: NonNullable<Gw2SimulationOptions['config']>;
  durationMs: number;
  budget: number;
  beamWidth: number;
  searchSeed: number;
  combatSeeds: number[];
  validationSeeds: number[];
  /** A scalar aspiration only; no reference rotation enters candidate generation. */
  targetDps?: number;
  onProgress?: (progress: { evaluated: number; elapsedMs: number; bestDamage: number }) => void;
  /** Optional console sink; verbose entries describe individual continuation actions. */
  onLog?: (message: string, verbose?: boolean) => void;
}

interface Candidate {
  rotation: RotationCommand[];
  damage: number;
  samples: { seed: number; damage: number; warnings: readonly string[] }[];
}

/** Static declarations bias rollouts, while only the engine computes outcomes or decides legality. */
function priority(skill: Skill): number {
  let value = 0;
  for (const effect of skill.effects ?? []) {
    if (effect.type === 'strike')
      value +=
        Number(effect.coefficient ?? 0) * Number(effect.hits ?? 1) +
        (effect.ticks ?? []).reduce((sum, tick) => sum + tick.coefficient, 0);
    if (effect.type === 'condition') value += Number(effect.stacks ?? 1) * Number(effect.duration ?? 1) * 0.15;
  }

  return 1 + value / Math.max(0.3, Number(skill.castTimeMs ?? 0) / 1000);
}

/** Beam values are full endpoint continuations, including setup and delayed damage; no partial DPS enters ranking. */
export function optimizeRotation(options: RotationSearchOptions) {
  const { profession, durationMs, budget, beamWidth, searchSeed, combatSeeds, validationSeeds } = options;
  for (const [name, value] of Object.entries({ budget, beamWidth }))
    if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${name} must be a positive integer.`);
  if (budget < 4) throw new RangeError('Budget must allow at least four candidate evaluations.');
  const { targetDps } = options;
  if (targetDps != null && (!Number.isFinite(targetDps) || targetDps <= 0))
    throw new RangeError('Target DPS must be finite and positive.');
  const seeds = [searchSeed, ...combatSeeds, ...validationSeeds];
  if (seeds.some((seed) => !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff))
    throw new RangeError('Seeds must be unsigned 32-bit integers.');
  if (
    combatSeeds.length < 2 ||
    validationSeeds.length < 2 ||
    new Set([...combatSeeds, ...validationSeeds]).size !== combatSeeds.length + validationSeeds.length
  )
    throw new RangeError('Supply at least two unique training seeds and two disjoint held-out seeds.');
  const started = performance.now();
  const random = createSimulationRandom({ seed: searchSeed });
  const config = structuredClone(options.config);
  const catalog = profession.runtimeFor(config).catalog;
  const observationPolicy = { kind: 'absolute' as const, endTimeMs: durationMs };
  const phases = { preparation: 0, execution: 0, reporting: 0, continuations: 0, cloning: 0 };
  let evaluated = 0;
  let simulations = 0;
  let invalid = 0;
  let best: Candidate | undefined;
  let bestActions: CombatAction[] = [];
  const traces = new WeakMap<CombatSession, CombatAction[]>();
  const targetDamage = targetDps == null ? undefined : targetDps * (durationMs / 1000);
  // Stop on training evidence only; held-out seeds are used once after candidate selection ends.
  const trainingTargetReached = () =>
    targetDamage != null && !!best && best.samples.every((sample) => sample.damage > targetDamage);
  const warnings = new Set<string>();
  const logAction = (phase: string, action: CombatAction, at: number, verbose = false) => {
    if (!options.onLog) return;
    const description =
      action.type === 'cast'
        ? `cast ${catalog.skillsById.get(action.skillId)?.name ?? action.skillId} (${action.skillId})${action.concurrentOffsetMs == null ? '' : ' concurrently'}`
        : `wait ${action.durationMs.toFixed(3)} ms`;
    options.onLog(`[${phase} candidate=${evaluated + 1}] t=${at.toFixed(6)}s ${description}`, verbose);
  };

  const start = () => {
    const session = initializeGw2Combat({
      profession,
      config: { ...config, randomness: { ...config.randomness, seed: combatSeeds[0] } },
      durationMs
    });
    traces.set(session, []);
    return session;
  };

  const apply = (session: CombatSession, action: CombatAction) => {
    session.apply(action);
    traces.get(session)!.push(action);
  };

  const clone = (session: CombatSession) => {
    const before = performance.now();
    const branch = session.clone();
    traces.set(branch, [...traces.get(session)!]);
    phases.cloning += performance.now() - before;
    return branch;
  };

  const replay = (rotation: RotationCommand[], seed: number) => {
    simulations++;
    return simulateGw2({
      profession,
      config: { ...config, randomness: { ...config.randomness, seed } },
      rotation,
      combatStartTime: 0,
      observationPolicy,
      output: 'score',
      onPhase: (phase, ms) => {
        phases[phase] += ms;
      }
    });
  };

  const samplesFor = (rotation: RotationCommand[], seedsToUse: number[]) =>
    seedsToUse.map((seed) => {
      const result = replay(rotation, seed);
      if (result.deathTime != null)
        throw new Error('The target died; use a target that survives the objective window.');
      return { seed, damage: result.totalDamage, warnings: result.warnings };
    });
  const evaluate = (session: CombatSession): Candidate | null => {
    const rotation = session.rotation();
    const expected = session.score().totalDamage;
    evaluated++;
    let samples: Candidate['samples'];
    try {
      samples = samplesFor(rotation, combatSeeds);
    } catch (error) {
      if (!(error instanceof RangeError) || !error.message.includes('cannot precede rotation end')) throw error;
      invalid++;
      options.onLog?.(`[candidate=${evaluated}] rejected: rotation exceeds the observation window`);
      return null;
    }

    if (samples.some((sample) => sample.warnings.length)) {
      invalid++;
      for (const sample of samples) for (const warning of sample.warnings) warnings.add(warning);
      options.onLog?.(
        `[candidate=${evaluated}] rejected: ${[...new Set(samples.flatMap((sample) => sample.warnings))].join('; ')}`
      );
      return null;
    }

    if (expected != null && samples[0].damage !== expected)
      throw new Error(`Incremental/replay mismatch: ${expected} versus ${samples[0].damage}.`);
    const candidate = {
      rotation,
      damage: samples.reduce((sum, sample) => sum + sample.damage, 0) / samples.length,
      samples
    };
    if (!best || candidate.damage > best.damage) {
      best = candidate;
      bestActions = [...traces.get(session)!];
      options.onLog?.(
        `[candidate=${evaluated}] new best: damage=${candidate.damage.toFixed(1)} fixedWindowDps=${(candidate.damage / (durationMs / 1000)).toFixed(1)}${targetDps == null ? '' : ` target=${targetDps} gapDps=${Math.max(0, targetDps - candidate.damage / (durationMs / 1000)).toFixed(1)} trainingTargetReached=${trainingTargetReached()}`}`
      );
    }

    options.onProgress?.({ evaluated, elapsedMs: performance.now() - started, bestDamage: best.damage });
    return candidate;
  };

  const rollout = (session: CombatSession, baseline = false): CombatSession => {
    const before = performance.now();
    const weights = new Map<SkillId, number>();
    for (const skill of catalog.skills) weights.set(skill.id, priority(skill) * (0.25 + random.next() * 2));
    let decisions = 0;
    while (!session.done) {
      if (++decisions > 100_000) throw new Error('Continuation exceeded its decision limit.');
      const actions = session.actions();
      const casts = actions.filter(
        (action): action is Extract<CombatAction, { type: 'cast' }> => action.type === 'cast'
      );
      let selected: CombatAction | undefined;
      if (baseline)
        selected = casts.find((action) => String(catalog.skillsById.get(action.skillId)?.slot) === 'Weapon_1');
      else {
        // Periodic random choices let low-damage setup and form transitions demonstrate their eventual value.
        selected =
          casts.length && random.next() < 0.18
            ? casts[Math.floor(random.next() * casts.length)]
            : casts.reduce<typeof selected>(
                (choice, action) =>
                  !choice ||
                  (weights.get(action.skillId) ?? 0) > (choice.type === 'cast' ? (weights.get(choice.skillId) ?? 0) : 0)
                    ? action
                    : choice,
                undefined
              );
      }

      selected ??= actions.find((action) => action.type === 'wait');
      if (!selected) throw new Error('Engine exposed no advancing decision.');
      const at = session.time;
      apply(session, selected);
      logAction(baseline ? 'baseline' : 'continuation', selected, at, true);
    }

    phases.continuations += performance.now() - before;
    return session;
  };

  options.onLog?.(`[baseline] constructing a legal auto-attack rotation through ${(durationMs / 1000).toFixed(3)}s`);
  const baselineSession = rollout(start(), true);
  const baseline = evaluate(baselineSession);
  if (!baseline) throw new Error('The legal baseline failed replay validation.');
  const root = start();
  let beam = [{ session: root, value: baseline.damage, family: 'root' }];
  let restarts = 0;
  const beamBudget = Math.max(2, Math.floor(budget * 0.5));
  options.onLog?.(`[beam] starting empty; width=${beamWidth} candidateBudget=${beamBudget - evaluated}`);
  while (evaluated < beamBudget && !trainingTargetReached()) {
    const candidates: typeof beam = [];
    // Round-robin parents prevent a large first action space from consuming the entire generation budget.
    const expansions = beam.map((parent) => {
      const choices = parent.session
        .actions()
        .map((action) => ({ action, order: random.next() }))
        .sort((a, b) => a.order - b.order);
      return { parent, choices };
    });
    for (
      let index = 0;
      expansions.some((entry) => index < entry.choices.length) && evaluated < beamBudget && !trainingTargetReached();
      index++
    ) {
      for (const { parent, choices } of expansions) {
        if (!choices[index] || evaluated >= beamBudget || trainingTargetReached()) continue;
        const child = clone(parent.session);
        const at = child.time;
        apply(child, choices[index].action);
        logAction('beam', choices[index].action, at);
        const completed = rollout(clone(child));
        const candidate = evaluate(completed);
        if (candidate) {
          const state = child.observe();
          const action = choices[index].action;
          candidates.push({
            session: child,
            value: candidate.damage,
            family: `${state.activeWeaponSet}:${action.type === 'cast' ? action.skillId : 'wait'}`
          });
        }
      }
    }

    candidates.sort((a, b) => b.value - a.value);
    const families = new Set<string>();
    beam = candidates
      .filter((candidate) => {
        if (families.has(candidate.family)) return false;
        families.add(candidate.family);
        return true;
      })
      .slice(0, beamWidth);
    if (!beam.length || beam.every((candidate) => candidate.session.done)) {
      beam = [{ session: start(), value: 0, family: 'root' }];
      restarts++;
      options.onLog?.(`[beam] restart=${restarts} from empty combat`);
    }
  }

  // Regrow a suffix of our own incumbent through legal decisions, retaining useful setup without stale cooldowns.
  options.onLog?.(`[refinement] up to ${budget - evaluated} legal suffix replacements of the best complete rotation`);
  while (evaluated < budget && !trainingTargetReached()) {
    const session = start();
    const index = random.next() < 0.15 ? 0 : Math.floor(random.next() * bestActions.length);
    for (const action of bestActions.slice(0, index)) apply(session, action);
    const previous = JSON.stringify(bestActions[index]);
    const alternatives = session.actions().filter((action) => JSON.stringify(action) !== previous);
    if (alternatives.length) {
      const action = alternatives[Math.floor(random.next() * alternatives.length)];
      logAction('refinement', action, session.time);
      apply(session, action);
    }

    if (index === 0) restarts++;
    options.onLog?.(
      `[refinement candidate=${evaluated + 1}] retainedDecisions=${index} regrowing suffix${index === 0 ? ` restart=${restarts}` : ''}`
    );
    evaluate(rollout(session));
  }

  options.onLog?.(`[validation] replaying best rotation and baseline on held-out seeds ${validationSeeds.join(',')}`);
  const heldOut = samplesFor(best!.rotation, validationSeeds);
  const baselineHeldOut = samplesFor(baseline.rotation, validationSeeds);
  if (heldOut.some((sample) => sample.warnings.length))
    throw new Error('Best rotation failed held-out replay validation.');
  const goal =
    targetDps == null
      ? null
      : {
          targetDps,
          trainingTargetReached: trainingTargetReached(),
          heldOutTargetReached: heldOut.every((sample) => sample.damage > targetDamage!),
          trainingGapDps: targetDps - best!.damage / (durationMs / 1000),
          heldOutGapDps:
            targetDps - heldOut.reduce((sum, sample) => sum + sample.damage, 0) / heldOut.length / (durationMs / 1000),
          status:
            trainingTargetReached() && heldOut.every((sample) => sample.damage > targetDamage!)
              ? 'validated-target-exceeded'
              : 'target-not-validated'
        };
  const stopReason = trainingTargetReached() ? 'training-target-exceeded' : 'budget-exhausted';
  options.onLog?.(`[search] stopped: ${stopReason}; evaluated=${evaluated}/${budget}`);
  if (goal)
    options.onLog?.(
      `[goal] ${goal.status}; target=${targetDps} trainingGapDps=${goal.trainingGapDps.toFixed(1)} heldOutGapDps=${goal.heldOutGapDps.toFixed(1)}`
    );
  return {
    label: 'best rotation found',
    rotation: best!.rotation,
    objective: {
      metric: 'total player damage',
      startMs: 0,
      endMs: durationMs,
      dpsDenominatorSeconds: durationMs / 1000
    },
    score: {
      trainingDamage: best!.damage,
      trainingDps: best!.damage / (durationMs / 1000),
      samples: best!.samples,
      heldOut
    },
    baseline: { ...baseline, heldOut: baselineHeldOut },
    goal,
    settings: { budget, beamWidth, searchSeed, combatSeeds, validationSeeds, targetDps },
    performance: {
      elapsedMs: performance.now() - started,
      evaluatedCandidates: evaluated,
      replaySimulations: simulations,
      invalidCandidates: invalid,
      restarts,
      stopReason,
      phases
    },
    warnings: [...warnings]
  };
}
