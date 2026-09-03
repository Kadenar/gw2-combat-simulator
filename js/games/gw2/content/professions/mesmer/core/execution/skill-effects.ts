/**
 * Owns one-shot Core Mesmer state changes tied to individual skill completions.
 * Packet emission lives in `packet-emission.ts`; persistent systems live under `mechanics/`.
 */
import { EPSILON } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import { MESMER_CORE_CLONE_ATTACKS } from '#gw2/content/professions/mesmer/core/mechanics/definitions.js';
import { applyMesmerClarity, consumeMesmerClarity } from '#gw2/content/professions/mesmer/core/mechanics/clarity.js';
import { applyMesmerSignetReset } from '#gw2/content/professions/mesmer/core/mechanics/signets.js';
import { triggerMethodOfMadness } from '#gw2/content/professions/mesmer/core/traits/index.js';
import type { SchedulerState } from '#gw2/platform/engine/types.js';
import type {
  MesmerAddCondition,
  MesmerAddDamage,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerRuntime,
  MesmerShatter,
  MesmerInstrument
} from '#gw2/content/professions/mesmer/types.js';

import type { MesmerRuntimeState } from '#gw2/content/professions/mesmer/state/types.js';

import type { MesmerTraitDamage } from '#gw2/content/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerSkill } from '#gw2/content/professions/mesmer/data/types.js';

export interface MesmerSkillSpecialEffectController {
  consumeClarity(skill: MesmerSkill, castStart: number): boolean;
  apply(skill: MesmerSkill, at: number, castStart?: number): void;
}

interface SkillSpecialEffectControllerOptions {
  readonly state: SchedulerState<MesmerRuntimeState>;
  readonly traits: ReadonlySet<number>;
  readonly allSkills: readonly MesmerSkill[];
  readonly addEvent: MesmerAddEvent;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly addCondition: MesmerAddCondition;
  readonly addDamage: MesmerAddDamage;
  readonly traitDamage: Readonly<Record<string, MesmerTraitDamage>>;
  readonly shatters: Readonly<Record<number, MesmerShatter>>;
  readonly instruments: Readonly<Record<number, MesmerInstrument>>;
  readonly balanceProfile: MesmerRuntime['balanceProfile'];
}

export function createSkillSpecialEffectController({
  state,
  traits,
  allSkills,
  addEvent,
  addTraitProc,
  addCondition,
  addDamage,
  traitDamage,
  shatters,
  instruments,
  balanceProfile
}: SkillSpecialEffectControllerOptions): MesmerSkillSpecialEffectController {
  const consumeClarity = (skill: MesmerSkill, castStart: number): boolean =>
    consumeMesmerClarity(state, skill, castStart);

  // Resolve each supported skill's side effects at its effective timestamp while
  // keeping reset, clone, and trait-proc mutations synchronized with emitted events.
  const apply = (skill: MesmerSkill, at: number, castStart = at): void => {
    if (skill.id === ID.AXES_OF_SYMMETRY) {
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
            cloneId: clone.id,
            source: 'Clone',
            name: `${skill.name} — Clone`
          }
        );
        addCondition(
          skill.name,
          impactAt,
          { name: 'Confusion', duration: 6, stacks: 1 },
          'Clone',
          `${skill.name} — Clone`,
          { cloneId: clone.id, skillId: skill.id }
        );
      }
    }

    if (skill.id === ID.TROUBADOUR_AXES_OF_SYMMETRY) {
      // The non-Mirage variant adds one Confusion stack per cast-start clone; its declarative packet covers the player.
      const clones = professionCoreState(state).clones.filter((clone) => clone.createdAt <= castStart + EPSILON);
      if (clones.length) {
        addCondition(skill.name, at, { name: 'Confusion', duration: 6, stacks: clones.length }, 'Player', skill.name, {
          skillId: skill.id
        });
      }
    }

    applyMesmerClarity(state, balanceProfile, addEvent, skill, at);
    applyMesmerSignetReset(state, allSkills, shatters, instruments, addEvent, skill, at);

    if (skill.id === ID.MENTAL_COLLAPSE) {
      const mindTheGap = allSkills.find((candidate) => candidate.id === ID.MIND_THE_GAP);
      if (mindTheGap) {
        state.cooldowns.delete(mindTheGap.id);
        addEvent({
          type: 'marker',
          at,
          name: 'Mental Collapse',
          detail: 'Mind the Gap cooldown reset'
        });
      }
    }

    if (skill.type === 'Heal') {
      triggerMethodOfMadness({ state, traits, addDamage, addTraitProc }, skill, at, traitDamage['Lesser Chaos Storm']);
    }
  };

  return { consumeClarity, apply };
}
