import type { SkillId } from '#gw2/platform/skills/types.js';
import { createSkillEffectController } from '#gw2/professions/mesmer/core/execution/effect-controller.js';
import type {
  MesmerPhantasmAttackTiming,
  MesmerPhantasmPolicy
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import {
  createProfessionActionController,
  mesmerShatterCompleted
} from '#gw2/professions/mesmer/core/mechanics/profession-actions.js';
import type {
  MesmerShatterDefinition,
  MesmerShatterResolution
} from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { resolveCloneShatter } from '#gw2/professions/mesmer/core/mechanics/shatters.js';
import { mesmerProfiledShatter } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_CORE_SHATTERS } from '#gw2/professions/mesmer/core/skills/profession-skills.js';
import { bountifulBladesSpawnModifiers } from '#gw2/professions/mesmer/core/traits/domination/index.js';
import {
  createMesmerIllusionRewards,
  destroyClone,
  mesmerActivePrimaryWeapon
} from '#gw2/professions/mesmer/family-resources.js';
import { mesmerResourceDefinition } from '#gw2/professions/mesmer/family-state.js';
import { MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/definitions.js';
import { MESMER_CHRONOMANCER_SHATTERS } from '#gw2/professions/mesmer/specializations/chronomancer/skills/index.js';
import { resolveBladesong } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/bladesongs.js';
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

/** Bind only shatter operations; their reservations and refunds mutate the caller's owned state. */
export function createMesmerActions(context: MesmerRuntime) {
  return createProfessionActionController({
    state: context,
    resourceDefinition: mesmerResourceDefinition(context.profession.specialization.kind, context),
    destroyClone: (clone) => destroyClone(context, clone),
    // Resolve only the requested shatter against the current catalog; no cross-run cache can retain another patch.
    shatterFor: (id) => {
      const definition = mesmerShatterDefinition(context, id);
      return definition ? mesmerProfiledShatter(context, definition) : undefined;
    },
    shatterResolvers: {
      'mesmer.core.clone-shatter': resolveCloneShatter,
      'mesmer.virtuoso.bladesong': resolveBladesong
    },
    warn: context.combat.warn
  });
}

/** Preserve specialization reaction order after the core resource transaction has committed. */
export function completeMesmerShatter(context: MesmerRuntime, resolution: MesmerShatterResolution): void {
  context.fireTrigger(mesmerShatterCompleted, { resolution });
}

/** Select phantasm content and policies for this call without storing controllers or tables on a run registry. */
export function createMesmerSkillEffects(context: MesmerRuntime) {
  const specialization = context.profession.specialization.kind;
  const policy: MesmerPhantasmPolicy = {
    spawnModifiers: bountifulBladesSpawnModifiers(context),
    conversionTiming: specialization === 'Virtuoso' ? 'blade-tick' : 'spawn'
  };
  const timings = Object.fromEntries(
    context.helpers.skills.flatMap((skill) => (skill.phantasmTiming ? [[skill.id, skill.phantasmTiming]] : []))
  ) as Record<number, MesmerPhantasmAttackTiming>;
  const overrides =
    specialization === 'Chronomancer'
      ? MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS
      : specialization === 'Virtuoso'
        ? MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS
        : {};
  for (const [id, timing] of Object.entries(overrides)) timings[Number(id)] = { ...timings[Number(id)], ...timing };
  return createSkillEffectController({
    state: context,
    resourceDefinition: mesmerResourceDefinition(specialization, context),
    phantasmAttackTimings: timings,
    phantasmPolicy: () => policy,
    activePrimaryWeapon: () => mesmerActivePrimaryWeapon(context),
    queueResources: createMesmerIllusionRewards(context).queueResources
  });
}
