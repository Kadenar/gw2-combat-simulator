import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { SkillDamageCastOptions } from '#gw2/platform/profession-presentation/skill-damage.js';
import type { Gw2Runtime, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { RuntimeExecution } from '#gw2/platform/simulation/execution.js';
import { RotationCursor } from '#gw2/platform/execution/rotation-cursor.js';
import type { DamageCalculationStatus, DamageInputs, DamageUnit } from '#gw2/platform/skill-damage/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

/** Payload provenance carries timing and selected inputs, without creating or resolving a qualifying attack. */
export function damageInputEvent(runtime: Gw2Runtime): Gw2ResolverEvent {
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
        runtime,
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

/** Content owns damage state independently of the combat history normally needed to reach it. */
export interface DamageEffectDefinition {
  readonly id: string;
  readonly name: string;
  readonly icon?: string;
  readonly source: 'Profession' | 'Trait';
  readonly ownerId?: SkillId;
  readonly unit: DamageUnit;
  readonly inputs?: DamageInputs;
  readonly assumptions?: readonly string[];
  readonly sourceIds: readonly SkillId[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Heterogeneous content retains the selected profession's runtime at dispatch.
  readonly emit: (runtime: Gw2Runtime<any>, inputs: DamageInputs) => void;
}

/** A failed calculation carries a product status instead of an activation denial. */
export class DamageCalculationError extends Error {
  constructor(
    readonly status: Extract<DamageCalculationStatus, 'missing-input' | 'unsupported' | 'failed'>,
    message: string
  ) {
    super(message);
  }
}
