import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import { RotationCursor } from '#gw2/platform/execution/rotation-cursor.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeExecution } from '#gw2/platform/simulation/run-contract.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { DamageInputs, SkillDamageCastOptions } from '#gw2/platform/skill-damage/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

/** Payload provenance carries timing and selected inputs, without creating or resolving a qualifying attack. */
export function damageInputEvent(runtime: { readonly time: number }): Gw2ResolverEvent {
  return {
    type: 'proc',
    at: runtime.time,
    source: 'Damage preview',
    sourceId: 'damage:occurrence',
    actorType: 'effect',
    activationId: 'damage:occurrence',
    skillName: 'Damage preview'
  };
}

/** An isolated occurrence enters below command eligibility; this contract is never a saved simulation setting. */
export interface DamageExecutionOptions<T extends object> {
  readonly skillId?: SkillId;
  readonly cast?: Partial<SkillDamageCastOptions>;
  readonly inputs?: DamageInputs;
  readonly emit?: (runtime: Gw2Runtime<T>) => void;
  readonly accepts: (event: SimulationEventBase) => boolean;
}

/** One payload enters after environmental assumptions settle, without registering combat producers or costs. */
export function createDamageExecution<T extends object>(
  profession: RuntimeProfession<T>,
  options: DamageExecutionOptions<T>
): RuntimeExecution<T> {
  let started = false;
  return {
    acceptsEffect: options.accepts,
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
    contributions: () => ({}),
    // Authored effect reactions stay in the shared runtime; unrelated hit-triggered procs never register.
    professionReactions: Object.fromEntries(
      Object.entries(profession.reactions ?? {}).filter(([stage]) => stage !== 'damage.resolved')
    ),
    driver: {
      cursor: new RotationCursor([]),
      rotation: [],
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
