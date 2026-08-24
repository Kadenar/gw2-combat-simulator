import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { isInternalCooldownReady } from '../../../platform/engine/core/clock.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { MESMER_CORE_CLONE_ATTACKS } from './mechanics.js';
import type { SchedulerState } from '../../../platform/engine/types.js';
import type {
  MesmerAddCondition,
  MesmerAddDamage,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerInstrument,
  MesmerRuntime,
  MesmerRuntimeState,
  MesmerShatter,
  MesmerSkill,
  MesmerTraitDamage
} from '../types.js';

const CLARITY_DURATION = 15;
const CLARITY_ICON = 'https://wiki.guildwars2.com/wiki/Special:FilePath/Clarity.png';
const CLARITY_CONSUMERS = new Set<number>([ID.IMAGINARY_INVERSION, ID.PHANTASMAL_LANCER, ID.MENTAL_COLLAPSE]);

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
  const consumeClarity = (skill: MesmerSkill, castStart: number): boolean => {
    const consumed = CLARITY_CONSUMERS.has(skill.id) && professionCoreState(state).clarityUntil > castStart;
    if (CLARITY_CONSUMERS.has(skill.id)) {
      professionCoreState(state).clarityUntil = 0;
    }

    return consumed;
  };

  const apply = (skill: MesmerSkill, at: number, castStart = at): void => {
    if (skill.id === ID.AXES_OF_SYMMETRY) {
      const axeClones = professionCoreState(state).clones.filter(
        (clone) => clone.weapon === 'Axe' && clone.createdAt <= castStart + 0.0001
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

    if (skill.id === ID.MIND_THE_GAP) {
      professionCoreState(state).clarityUntil =
        at + Number(balanceProfile('mesmer.core.clarity')?.durationMultiplier || CLARITY_DURATION);
      addEvent({
        type: 'proc',
        procType: 'skill',
        at,
        name: 'Clarity',
        sourceSkill: skill.name,
        detail: 'Spear skills 3-5 empowered for 15s',
        icon: CLARITY_ICON
      });
    }

    if (skill.id === ID.SIGNET_OF_THE_ETHER) {
      for (const phantasmSkill of allSkills.filter((candidate) => candidate.phantasm)) {
        state.cooldowns.delete(phantasmSkill.id);
      }

      addEvent({
        type: 'marker',
        at,
        name: 'Signet of the Ether',
        detail: 'Phantasm skill cooldowns reset'
      });
    }

    if (skill.id === ID.SIGNET_OF_ILLUSIONS) {
      for (const target of allSkills.filter(
        (candidate) =>
          Boolean(instruments[candidate.id]) ||
          Boolean(shatters[candidate.id] && shatters[candidate.id].resetBySignetOfIllusions !== false)
      )) {
        const ammo = state.ammo.get(target.id);
        if (ammo) {
          ammo.charges = Math.min(ammo.maximum, ammo.charges + 1);
          if (ammo.charges >= ammo.maximum) ammo.nextRechargeAt = null;
          state.cooldowns.delete(target.id);
        } else {
          state.cooldowns.delete(target.id);
        }
      }

      addEvent({
        type: 'marker',
        at,
        name: 'Signet of Illusions',
        detail: 'Eligible shatter and instrument cooldowns reset'
      });
    }

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

    if (skill.type !== 'Heal' || !traits.has(TRAIT.METHOD_OF_MADNESS)) return;
    const storm = traitDamage['Lesser Chaos Storm'];
    const readyAt = professionCoreState(state).traitReadyAt[TRAIT.METHOD_OF_MADNESS] || 0;
    if (!isInternalCooldownReady(at, readyAt)) return;
    const hits = Math.max(1, Math.trunc(Number(storm.hits || 1)));
    addDamage(
      {
        id: 'Lesser Chaos Storm',
        name: 'Lesser Chaos Storm',
        weapon: 'Utility',
        blade: false
      },
      at,
      {
        coefficient: Number(storm.coefficient || 0),
        hits,
        intervalMs: Math.max(0, Number(storm.intervalMs || 0)),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'Player',
        weapon: 'utility'
      }
    );
    addTraitProc('Method of Madness', at, skill.name);
    professionCoreState(state).traitReadyAt[TRAIT.METHOD_OF_MADNESS] = at + Number(storm.cooldown || 0);
  };

  return { consumeClarity, apply };
}
