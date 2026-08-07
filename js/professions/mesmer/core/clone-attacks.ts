import { professionCoreState } from "../../../platform/engine/profession.js";
import type {
  MesmerAddCondition,
  MesmerAddDamage,
  MesmerClone,
  MesmerCloneAttack,
  MesmerCloneAttackScheduler,
  MesmerCloneAttackStep,
  MesmerState,
} from "../types.js";

interface CloneAttackSchedulerOptions {
  readonly state: MesmerState;
  readonly cloneAttacks: Readonly<Record<string, MesmerCloneAttack>>;
  readonly epsilon: number;
  readonly addDamage: MesmerAddDamage;
  readonly addCondition: MesmerAddCondition;
  readonly scheduleTask?: ((clone: MesmerClone, at: number) => unknown) | null;
}

/** Owns task-driven periodic clone attacks and their damage packets. */
export function createCloneAttackScheduler({
  state,
  cloneAttacks,
  epsilon,
  addDamage,
  addCondition,
  scheduleTask = null,
}: CloneAttackSchedulerOptions): MesmerCloneAttackScheduler {
  const profession = "profession" in state ? professionCoreState(state) : state;
  const attackFor = (clone: MesmerClone) =>
    cloneAttacks[clone.weapon] || cloneAttacks.Sword;

  const sequenceStep = (
    clone: MesmerClone,
    attack: MesmerCloneAttack,
  ): MesmerCloneAttackStep => {
    if (!attack.sequence) return attack;
    const index =
      Number(clone.attackSequenceIndex || 0) % attack.sequence.length;
    return attack.sequence[index];
  };

  const initializeClone = (clone: MesmerClone): MesmerClone => {
    const attack = attackFor(clone);
    clone.ownerId ||= `mesmer.clone:${clone.id}`;
    clone.attackSequenceIndex = 0;
    const step = sequenceStep(clone, attack);
    clone.nextAttackAt =
      clone.createdAt + Number(attack.firstAttackDelay ?? step.interval);
    if (scheduleTask) scheduleTask(clone, clone.nextAttackAt);
    return clone;
  };

  const nextAttackAt = (): number => {
    let next = Infinity;
    for (const clone of profession.clones) {
      next = Math.min(next, clone.nextAttackAt ?? Infinity);
    }
    return next;
  };

  const scheduleAttack = (clone: MesmerClone, at: number): void => {
    const attack = attackFor(clone);
    const step = sequenceStep(clone, attack);
    const skillName = step.name || `${clone.weapon} Clone`;
    const cloneSkill = {
      id: skillName,
      name: skillName,
      weapon: clone.weapon,
      blade: false,
    };
    addDamage(
      cloneSkill,
      at,
      {
        coefficient: step.coefficient,
        hits: step.hits,
        hitOffsets: step.hitOffsets,
        source: "Clone",
        weaponStrength: attack.weaponStrength,
      },
      { cloneId: clone.id, source: "Clone" },
    );
    for (const condition of step.conditions || []) {
      addCondition(skillName, at, condition, "Clone", "", {
        cloneId: clone.id,
      });
    }
    if (Array.isArray(attack.sequence) && attack.sequence.length > 0) {
      clone.attackSequenceIndex =
        (Number(clone.attackSequenceIndex || 0) + 1) % attack.sequence.length;
    }
  };

  const scheduleAt = (at: number): void => {
    for (const clone of profession.clones) {
      if ((clone.nextAttackAt ?? Infinity) > at + epsilon) continue;
      scheduleAttack(clone, at);
      const attack = attackFor(clone);
      clone.nextAttackAt =
        Number(clone.nextAttackAt)
        + Number(sequenceStep(clone, attack).interval);
    }
  };

  const handleTask = (cloneId: number, at: number): void => {
    const clone = profession.clones.find(
      (candidate) => candidate.id === Number(cloneId),
    );
    if (!clone) return;
    scheduleAttack(clone, at);
    const attack = attackFor(clone);
    clone.nextAttackAt = at + Number(sequenceStep(clone, attack).interval);
    if (scheduleTask) scheduleTask(clone, clone.nextAttackAt);
  };

  return {
    handleTask,
    initializeClone,
    nextAttackAt,
    scheduleAt,
  };
}
