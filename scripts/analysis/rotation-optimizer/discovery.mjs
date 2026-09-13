import { setImmediate } from 'node:timers/promises';
import { createSimulationRandom } from '#kernel/core/simulation-random.js';
import { integer, rejectionReason } from './optimizer.mjs';

/** Construct rotations from live legal bars; short damage lookahead and seeded exploration choose each next action. */
export async function discoverRotation(
  encounter,
  { attempts = 1, seed = 1, maxFightSeconds = 300, maxCommands = 1000, choices = 4, signal, onProgress = () => {} } = {}
) {
  integer(attempts, 'discovery attempts', 1, 100);
  integer(seed, 'seed', 0, 0xffff_ffff);
  integer(maxCommands, 'maxCommands', 1, 5000);
  integer(choices, 'choices', 1, 50);
  if (!Number.isFinite(maxFightSeconds) || maxFightSeconds <= 0 || maxFightSeconds > 3600)
    throw new RangeError('maxFightSeconds must be greater than 0 and at most 3600.');
  const random = createSimulationRandom({ seed }).next;
  const stats = { attempts: 0, simulations: 0, completedKills: 0, rejections: {} };
  let best = null;
  let furthestDamage = 0;
  const started = performance.now();
  const simulate = (commands, output = 'score') => {
    stats.simulations++;
    return encounter.simulate(commands, output);
  };

  const record = (reason) => {
    stats.rejections[reason] = (stats.rejections[reason] || 0) + 1;
  };

  for (let attempt = 0; attempt < attempts && !signal?.aborted; attempt++) {
    stats.attempts++;
    // Scratch discovery starts combat immediately: it cannot invent training-area resets or hidden initial-state actions.
    let rotation = [{ type: 'combat-start' }];
    let state = simulate(rotation, 'detailed');
    if (state.warnings.length) throw new Error(`Discovery initial state: ${state.warnings.join(' ')}`);
    let projectedDamage = 0;
    const uses = new Map();
    while (rotation.length + 2 <= maxCommands && state.duration < maxFightSeconds) {
      await setImmediate();
      if (signal?.aborted) break;
      const available = encounter.availableSkills(rotation, state);
      // Sampling limits replay cost; always include a ready autoattack so waiting is never the only alternative to a cooldown.
      const candidates = available
        .map((skill) => ({ skill, order: random() }))
        .sort((a, b) => a.order - b.order)
        .slice(0, choices)
        .map(({ skill }) => skill);
      const autoattack = available.find((skill) => skill.slot === 'Weapon_1');
      if (autoattack && !candidates.includes(autoattack)) candidates.push(autoattack);
      const proposals = candidates.map((skill) => ({ type: 'cast', skillId: skill.id }));
      proposals.push({ type: 'wait', durationMs: 250 });
      const scored = [];
      for (const command of proposals) {
        // ponytail: replay whole prefixes with a 2-second lookahead; a resumable engine or learned value model is the speed/strategy upgrade.
        const commands = rotation.concat(command, { type: 'wait', durationMs: 2000 });
        const result = simulate(commands);
        if (result.warnings.length) {
          record(`Simulation warning: ${result.warnings.join(' ')}`);
          continue;
        }

        if (!Number.isFinite(result.totalDamage) || !Number.isFinite(result.duration))
          throw new Error('Non-finite discovery score.');
        if (result.duration > maxFightSeconds) continue;
        const gain = result.totalDamage - projectedDamage;
        const elapsed = Math.max(0.25, result.duration - 2 - state.duration);
        scored.push({ command, result, value: gain / elapsed });
        furthestDamage = Math.max(furthestDamage, result.totalDamage);
        if (!rejectionReason(result, maxFightSeconds)) {
          const verified = simulate(commands, 'detailed');
          const failure = rejectionReason(verified, maxFightSeconds);
          if (failure) throw new Error(`Discovered kill failed verification: ${failure}`);
          if (verified.dps !== result.dps) throw new Error('Discovery score changed in detailed replay.');
          if (!best || verified.dps > best.dps) best = { rotation: commands, dps: verified.dps };
        }
      }

      if (scored.some(({ result }) => !rejectionReason(result, maxFightSeconds))) {
        stats.completedKills++;
        break;
      }

      if (!scored.length) {
        record('No usable action within duration limit');
        break;
      }

      scored.sort((a, b) => b.value - a.value);
      // Occasionally try an infrequently used ready skill so setup, swaps, and resource generators can reveal later damage.
      const exploration = scored.filter(
        ({ command }) => command.type === 'cast' && (uses.get(command.skillId) || 0) < 2
      );
      const next =
        exploration.length && random() < 0.15 ? exploration[Math.floor(random() * exploration.length)] : scored[0];
      rotation = rotation.concat(next.command);
      if (next.command.type === 'cast') uses.set(next.command.skillId, (uses.get(next.command.skillId) || 0) + 1);
      state = simulate(rotation, 'detailed');
      if (state.warnings.length || state.steps.some((step) => step.invalid))
        throw new Error('Chosen discovery action failed replay.');
      projectedDamage = next.result.totalDamage;
      if (rotation.length % 10 === 0)
        onProgress({
          attempt: attempt + 1,
          commands: rotation.length,
          damage: state.totalDamage,
          seconds: state.duration,
          bestDps: best?.dps ?? null
        });
    }
  }

  return {
    rotation: best?.rotation ?? null,
    ...stats,
    furthestDamage,
    elapsedSeconds: (performance.now() - started) / 1000
  };
}
