import type { SkillId } from '#gw2/platform/skills/types.js';
import { createPhantasmCastScheduler } from '#gw2/professions/mesmer/core/mechanics/illusions/phantasms.js';
import type {
  MesmerPhantasmAttackTiming,
  MesmerPhantasmPolicy
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerShatterDefinition } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { MESMER_CORE_SHATTERS } from '#gw2/professions/mesmer/core/skills/profession-skills.js';
import { bountifulBladesSpawnModifiers } from '#gw2/professions/mesmer/core/traits/domination/index.js';
import { createMesmerIllusionRewards } from '#gw2/professions/mesmer/family-resources.js';
import { MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/definitions.js';
import { MESMER_CHRONOMANCER_SHATTERS } from '#gw2/professions/mesmer/specializations/chronomancer/skills/index.js';
import { MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/definitions.js';
import { MESMER_VIRTUOSO_SHATTERS } from '#gw2/professions/mesmer/specializations/virtuoso/skills/index.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Membership and resource timing read authored metadata without resolving unrelated damage profiles. */
export function mesmerShatterDefinition(context: MesmerRuntime, id: SkillId): MesmerShatterDefinition | undefined {
  const specialization = context.profession.specialization.kind;
  return (
    (specialization === 'Chronomancer'
      ? MESMER_CHRONOMANCER_SHATTERS[Number(id)]
      : specialization === 'Virtuoso'
        ? MESMER_VIRTUOSO_SHATTERS[Number(id)]
        : undefined) ?? MESMER_CORE_SHATTERS[Number(id)]
  );
}

/** Select phantasm content and policies for this call without storing controllers or tables on a run registry. */
export function createMesmerSkillEffects(context: MesmerRuntime) {
  const specialization = context.profession.specialization.kind;
  const policy: MesmerPhantasmPolicy = {
    spawnModifiers: bountifulBladesSpawnModifiers(context),
    conversionTiming: specialization === 'Virtuoso' ? 'blade-tick' : 'spawn'
  };
  const overrides =
    specialization === 'Chronomancer'
      ? MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS
      : specialization === 'Virtuoso'
        ? MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS
        : undefined;
  return createPhantasmCastScheduler({
    state: context,
    // Resolve only the requested summon from this run's catalog; elite overrides retain their field precedence.
    phantasmTimingFor: (skillId) => {
      const timing = context.helpers.skillsById.get(skillId)?.phantasmTiming;
      const override = overrides?.[skillId];
      return (override ? { ...timing, ...override } : timing) as MesmerPhantasmAttackTiming | undefined;
    },
    phantasmPolicy: () => policy,
    queueResources: createMesmerIllusionRewards(context).queueResources
  });
}
