/** Clone creation, periodic attacks, and retirement share one lifetime owner. */
import { ACTOR } from '#gw2/platform/constants.js';
import { mesmerCloneOwnerId } from '#gw2/professions/mesmer/core/mechanics/illusions/identity.js';
import type {
  MesmerClone,
  MesmerCloneAttack,
  MesmerCloneAttackStep
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { buildMesmerConditions, buildMesmerStrikes } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { MESMER_CORE_CLONE_ATTACKS } from '#gw2/professions/mesmer/core/skills/weapons/clone-attacks.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

export const MESMER_CLONE_ATTACK_TASK = 'mesmer.clone-attack';

function attackFor(clone: MesmerClone): MesmerCloneAttack {
  return MESMER_CORE_CLONE_ATTACKS[clone.weapon] || MESMER_CORE_CLONE_ATTACKS.Sword;
}

function sequenceStep(clone: MesmerClone, attack: MesmerCloneAttack): MesmerCloneAttackStep {
  return attack.sequence ? attack.sequence[clone.attackSequenceIndex % attack.sequence.length] : attack;
}

/** Initial and repeated wakes use the same owner and queue priority. */
function scheduleAttack(runtime: MesmerRuntime, clone: MesmerClone, at: number): void {
  runtime.schedule(MESMER_CLONE_ATTACK_TASK, at, clone.id, { id: mesmerCloneOwnerId(clone.id), generation: 0 }, -50);
}

function retireClone(runtime: MesmerRuntime, clone: MesmerClone): void {
  runtime.cancelOwner({ id: mesmerCloneOwnerId(clone.id), generation: 0 });
}

/** Create the accepted grant in order using the family resource limit, then return its creation history. */
export function createMesmerClones(
  runtime: MesmerRuntime,
  {
    at,
    count,
    weapon,
    maximum
  }: { readonly at: number; readonly count: number; readonly weapon: string; readonly maximum: number }
): MesmerClone[] {
  const state = runtime.profession.core;
  const created: MesmerClone[] = [];

  for (let index = 0; index < count; index += 1) {
    if (state.clones.length >= maximum) {
      const replaced = state.clones.shift();

      if (replaced) retireClone(runtime, replaced);
    }

    const clone: MesmerClone = { id: ++state.cloneSequence, createdAt: at, weapon, attackSequenceIndex: 0 };
    const attack = attackFor(clone);
    scheduleAttack(runtime, clone, at + (attack.firstAttackDelay ?? sequenceStep(clone, attack).interval));
    state.clones.push(clone);
    created.push(clone);
  }

  return created;
}

/** Spending retires pending clone work and clears live entities without resetting their identity sequence. */
export function consumeMesmerClones(runtime: MesmerRuntime): number {
  const state = runtime.profession.core;
  const count = state.clones.length;
  for (const clone of state.clones) retireClone(runtime, clone);
  state.clones = [];
  return count;
}

/** Only a live clone's dispatched wake emits attacks and queues its successor. */
export function dispatchMesmerCloneAttack(runtime: MesmerRuntime, cloneId: number): void {
  const clone = runtime.profession.core.clones.find((candidate) => candidate.id === cloneId);

  if (!clone) return;

  emitCloneAttack(runtime, clone, runtime.time);
  scheduleAttack(runtime, clone, runtime.time + sequenceStep(clone, attackFor(clone)).interval);
}

/** Packet ownership follows clone identity independently of display labels and triggering casts. */
function emitCloneAttack(runtime: MesmerRuntime, clone: MesmerClone, at: number): void {
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
    runtime,
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
      actorType: ACTOR.SUMMON,
      summonKind: 'clone',
      summonOwner: mesmerCloneOwnerId(clone.id)
    }
  ).forEach((packet) => {
    runtime.effects.emit({
      kind: 'packet',
      event: packet
    });
  });
  for (const condition of step.conditions || []) {
    buildMesmerConditions(runtime, skillName, impactAt, condition, 'Clone', '', {
      metadata: { cloneId: clone.id },
      skillId: step.id,
      actorType: ACTOR.SUMMON,
      summonKind: 'clone',
      summonOwner: mesmerCloneOwnerId(clone.id)
    }).forEach((packet) => {
      runtime.effects.emit({
        kind: 'packet',
        event: packet
      });
    });
  }

  if (attack.sequence) {
    clone.attackSequenceIndex = (clone.attackSequenceIndex + 1) % attack.sequence.length;
  }
}
