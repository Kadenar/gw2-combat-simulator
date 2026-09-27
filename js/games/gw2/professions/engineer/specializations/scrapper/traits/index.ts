import { produceRuntimeCombos } from '#gw2/platform/combos/runtime.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { EngineerRuntime } from '#gw2/professions/engineer/types.js';

/** Function Gyro's blast enters the combo system with the accepted cast identity. */
export function applyScrapperCastTraits(context: EngineerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill;
  if (skill.id !== ID.FUNCTION_GYRO) return;
  // Kinetic Accelerators (GM trait): Function Gyro becomes a blast finisher.
  // The marker gives the shared combo materializer a trait-gated descriptor
  // while preserving Function Gyro as the source of the resulting combo.
  if (hasTrait(context.config, TRAIT.KINETIC_ACCELERATORS)) {
    produceRuntimeCombos(context, context.helpers, {
      type: 'action',
      endsAt: context.time,
      at: context.time,
      source: 'engineer',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Kinetic Accelerators — Function Gyro blast finisher',
      activationId: cast.id,
      comboFinishers: [
        {
          ownerId: 'engineer',
          finisherType: 'Blast',
          chance: 1,
          ambiguousFieldSelection: 'oldest'
        }
      ]
    });
  }
}
