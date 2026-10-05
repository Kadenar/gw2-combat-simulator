import {
  buildMesmerStrikes,
  mesmerPacketOwner,
  buildMesmerConditions
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';

import type {
  MesmerClone,
  MesmerCloneAttack,
  MesmerCloneAttackScheduler,
  MesmerCloneAttackStep
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';

interface CloneAttackSchedulerOptions {
  readonly state: MesmerRuntime;
  readonly cloneAttacks: Readonly<Record<string, MesmerCloneAttack>>;
  readonly scheduleTask: (clone: MesmerClone, at: number) => unknown;
}

/** Owns periodic clone attacks, scheduling the next cycle only when a live clone's task is dispatched. */
export function createCloneAttackScheduler({
  state,
  cloneAttacks,
  scheduleTask
}: CloneAttackSchedulerOptions): MesmerCloneAttackScheduler {
  // Clone ownership comes from the scheduler Core slice in every caller.
  const profession = professionCoreState(state);
  const attackFor = (clone: MesmerClone) => cloneAttacks[clone.weapon] || cloneAttacks.Sword;

  const sequenceStep = (clone: MesmerClone, attack: MesmerCloneAttack): MesmerCloneAttackStep => {
    if (!attack.sequence) return attack;
    const index = (clone.attackSequenceIndex || 0) % attack.sequence.length;
    return attack.sequence[index];
  };

  const initializeClone = (clone: MesmerClone): MesmerClone => {
    const attack = attackFor(clone);
    clone.ownerId ||= `mesmer.clone:${clone.id}`;
    clone.attackSequenceIndex = 0;
    const step = sequenceStep(clone, attack);
    clone.nextAttackAt = clone.createdAt + (attack.firstAttackDelay ?? step.interval);
    scheduleTask(clone, clone.nextAttackAt);
    return clone;
  };

  // Schedule one clone-owned attack cycle with identity and generation metadata
  // so shatters or replacement clones can invalidate stale packets; ownership never depends on the source label.
  const scheduleAttack = (clone: MesmerClone, at: number): void => {
    const attack = attackFor(clone);
    const step = sequenceStep(clone, attack);
    const skillName = step.name || `${clone.weapon} Clone`;
    const cloneSkill = {
      id: step.id,
      name: skillName,
      weapon: clone.weapon,
      blade: false
    };
    const impactAt = at + (step.damageAtMs || 0) / 1000;
    buildMesmerStrikes(
      state,
      cloneSkill,
      impactAt,
      {
        ...(step.ticks?.length
          ? {
              ticks: step.ticks,
              timingAnchor: 'castStart' as const,
              timingScale: 'fixed' as const
            }
          : {
              coefficient: step.coefficient,
              hits: step.hits,
              atMs: step.atMs
            }),
        source: 'Clone',
        weaponStrength: attack.weaponStrength
      },
      {
        metadata: { cloneId: clone.id },
        source: 'Clone',
        actorType: 'summon',
        summonKind: 'clone',
        summonOwner: clone.ownerId
      }
    ).forEach((packet) => {
      state.effects.emit({
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    });
    for (const condition of step.conditions || []) {
      buildMesmerConditions(state, skillName, impactAt, condition, 'Clone', '', {
        metadata: { cloneId: clone.id },
        skillId: step.id,
        actorType: 'summon',
        summonKind: 'clone',
        summonOwner: clone.ownerId
      }).forEach((packet) => {
        state.effects.emit({
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
      });
    }

    if (Array.isArray(attack.sequence) && attack.sequence.length > 0) {
      clone.attackSequenceIndex = ((clone.attackSequenceIndex || 0) + 1) % attack.sequence.length;
    }
  };

  const handleTask = (cloneId: number, at: number): number | null => {
    const clone = profession.clones.find((candidate) => candidate.id === cloneId);
    if (!clone) return null;
    scheduleAttack(clone, at);
    const attack = attackFor(clone);
    clone.nextAttackAt = at + sequenceStep(clone, attack).interval;
    return clone.nextAttackAt;
  };

  return {
    handleTask,
    initializeClone
  };
}
