import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { EPSILON } from '#kernel/core/clock.js';
/**
 * Owns one-shot Core Mesmer state changes tied to individual skill completions.
 * Packet emission lives in `packet-emission.ts`; persistent systems live under `mechanics/`.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { MESMER_CORE_CLONE_ATTACKS } from '#gw2/professions/mesmer/core/mechanics/definitions.js';
import { consumeMesmerClarity } from '#gw2/professions/mesmer/core/mechanics/clarity.js';
import { triggerMethodOfMadness } from '#gw2/professions/mesmer/core/traits/index.js';
import type { MesmerAddCondition, MesmerAddDamage, MesmerAddTraitProc } from '#gw2/professions/mesmer/types.js';

import type { MesmerTraitDamage } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

interface MesmerSkillSpecialEffectController {
  consumeClarity(skill: MesmerSkill, castStart: number): boolean;
  schedule(skill: MesmerSkill, at: number, castStart?: number): void;
  apply(skill: MesmerSkill, at: number, castStart?: number): void;
}

interface SkillSpecialEffectControllerOptions {
  readonly state: MesmerRuntime;
  readonly traits: ReadonlySet<number>;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly addCondition: MesmerAddCondition;
  readonly addDamage: MesmerAddDamage;
  readonly traitDamage: Readonly<Record<string, MesmerTraitDamage>>;
}

export function createSkillSpecialEffectController({
  state,
  traits,
  addTraitProc,
  addCondition,
  addDamage,
  traitDamage
}: SkillSpecialEffectControllerOptions): MesmerSkillSpecialEffectController {
  const consumeClarity = (skill: MesmerSkill, castStart: number): boolean =>
    consumeMesmerClarity(state, skill, castStart);

  // Snapshot explicitly clone-owned Axes packets when the cast is registered so earlier impacts are observable immediately.
  const schedule = (skill: MesmerSkill, at: number, castStart = at): void => {
    if (skill.id !== ID.AXES_OF_SYMMETRY) return;
    const axeClones = professionCoreState(state).clones.filter(
      (clone) => clone.weapon === 'Axe' && clone.createdAt <= castStart + EPSILON
    );
    for (const clone of axeClones) {
      const impactAt = at - 0.04;
      addDamage(
        {
          id: ID.AXES_OF_SYMMETRY,
          name: `${skill.name} — Clone`,
          weapon: 'Axe',
          blade: false
        },
        impactAt,
        {
          coefficient: 1.75,
          hits: 1,
          source: 'Clone',
          weaponStrength: MESMER_CORE_CLONE_ATTACKS.Axe.weaponStrength
        },
        {
          metadata: { cloneId: clone.id },
          source: 'Clone',
          actorType: 'summon',
          summonKind: 'clone',
          name: `${skill.name} — Clone`
        }
      );
      addCondition(
        skill.name,
        impactAt,
        { name: 'Confusion', duration: 6, stacks: 1 },
        'Clone',
        `${skill.name} — Clone`,
        { metadata: { cloneId: clone.id }, skillId: skill.id, actorType: 'summon', summonKind: 'clone' }
      );
    }
  };

  // Resolve each supported skill's side effects at its effective timestamp while
  // keeping clone and trait-proc mutations synchronized with emitted events.
  const apply = (skill: MesmerSkill, at: number, castStart = at): void => {
    if (skill.id === ID.VIRTUOSO_TROUBADOUR_AXES_OF_SYMMETRY) {
      // The non-Mirage variant adds one Confusion stack per cast-start clone; its declarative packet covers the player.
      const clones = professionCoreState(state).clones.filter((clone) => clone.createdAt <= castStart + EPSILON);
      if (clones.length) {
        addCondition(skill.name, at, { name: 'Confusion', duration: 6, stacks: clones.length }, 'Player', skill.name, {
          skillId: skill.id
        });
      }
    }

    if (skill.type === 'Heal') {
      triggerMethodOfMadness({ state, traits, addDamage, addTraitProc }, skill, at, traitDamage['Lesser Chaos Storm']);
    }
  };

  return { consumeClarity, schedule, apply };
}
