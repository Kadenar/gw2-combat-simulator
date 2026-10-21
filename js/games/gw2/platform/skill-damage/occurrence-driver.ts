import { COMBO_RANDOM_STREAM_PREFIX } from '#gw2/platform/combos/resolution.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import { RotationCursor } from '#gw2/platform/execution/rotation-cursor.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { isTraitEffect } from '#gw2/platform/profession-definition/trait-emission.js';
import type { RuntimeExecution } from '#gw2/platform/simulation/run-contract.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { DamageInputs, SkillDamageCastOptions } from '#gw2/platform/skill-damage/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { SimulationRandom } from '#kernel/core/simulation-random.js';

/** An isolated occurrence enters below command eligibility; this contract is never a saved simulation setting. */
export interface DamageExecutionOptions<T extends object> {
  readonly skillId?: SkillId;
  readonly includeTraitProcs?: boolean;
  readonly random?: Readonly<SimulationRandom>;
  readonly cast?: Partial<SkillDamageCastOptions>;
  readonly inputs?: DamageInputs;
  readonly emit?: (runtime: Gw2Runtime<T>) => void;
  readonly accepts: (event: SimulationEventBase) => boolean;
}

/**
 * Included trait procs are only those that always trigger: only certain rolls succeed, so a proc gated by a chance or a
 * critical hit appears only when that chance is 100%. Averaged critical damage never reads the sampled outcome, so the
 * skill's own damage is unchanged. Combo finisher rolls keep the seeded outcome because they are not trait behavior.
 */
export function certainTraitRandom(base: Readonly<SimulationRandom>): Readonly<SimulationRandom> {
  return Object.freeze({
    ...base,
    roll: (probability: number, stream = 'default') =>
      stream.startsWith(COMBO_RANDOM_STREAM_PREFIX) ? base.roll(probability, stream) : probability >= 1
  });
}

/** One payload enters after environmental assumptions settle, without registering combat producers or costs. */
export function createDamageExecution<T extends object>(
  profession: RuntimeProfession<T>,
  options: DamageExecutionOptions<T>
): RuntimeExecution<T> {
  let started = false;
  // Reactions to setup or held assumption packets keep their mechanics but cannot fire trait listeners.
  let held = 0;
  return {
    acceptsEffect: (event) =>
      // Initial profession setup cannot contribute trait damage before the measured activation.
      (started || !isTraitEffect(event)) && options.accepts(event),
    random: options.random,
    admitsTriggers: () => started && held === 0,
    // Stat queries and measured payloads enter the same prepared state before environmental effects settle.
    initialize(runtime) {
      profession.prepareDamageState?.(
        runtime.mechanics,
        options.skillId == null ? undefined : profession.catalog.skillsById.get(options.skillId),
        {
          ...options.inputs,
          ...(options.cast?.releaseAtCharges == null ? {} : { charges: options.cast.releaseAtCharges })
        }
      );
    },
    bindProducers: () => ({ contributions: {} }),
    // Without trait procs the skill is measured alone, so per-hit reactions stay unregistered; trait procs need them.
    professionReactions: Object.fromEntries(
      Object.entries(profession.reactions ?? {})
        .filter(([stage]) => options.includeTraitProcs || stage !== 'damage.resolved')
        .map(([stage, handler]) => [
          stage,
          (runtime, event, details) => {
            const holds = !started || String(event.sourceId).startsWith('assumption.');
            held += Number(holds);
            try {
              return handler(runtime, event, details);
            } finally {
              held -= Number(holds);
            }
          }
        ])
    ),
    driver: {
      cursor: new RotationCursor([]),
      advance({ runtime, acceptCast }) {
        if (started) return Infinity;

        started = true;

        if (options.skillId != null) {
          const skill = profession.catalog.skillsById.get(options.skillId);

          if (!skill) throw new TypeError(`Unknown damage skill ${options.skillId}.`);

          acceptCast(skill, { type: 'cast', skillId: skill.id, ...options.cast });
        } else options.emit?.(runtime);

        return 'handled';
      }
    }
  };
}
