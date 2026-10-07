import type { ActionContext } from '#gw2/platform/effects/actions.js';
import { MAXIMUM_SPINNING_AXES } from '#gw2/professions/thief/core/state.js';
import { canonicalTime } from '#kernel/core/clock.js';

import { buildThiefCondition } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';

export const THIEF_AXE_LAND = 'thief.axe-land';

/** Committed throws create axes even off target or before combat; damage eligibility does not own the projectile pool. */
export function grantThiefGroundAxe(runtime: ThiefRuntime, context: ActionContext<ThiefSkill>): void {
  if (context.kind !== 'cast') return;
  const { cast } = context;
  const strike = cast.skill.effects?.find((effect) => effect.type === 'strike');
  if (!strike) return;
  const impact = (strike.timingAnchor === 'castStart' ? cast.start : cast.fullEnd) + (strike.atMs ?? 0) / 1000;
  for (let index = 0; index < (strike.hits ?? 1); index++) {
    const axe = {
      id: `${cast.id}:${index}`,
      skillId: context.skill.id,
      // Melee EVTC missile lifetimes: ordinary axes continue ~560ms after hitting; Salvo ~720ms.
      landsAt: canonicalTime(Math.max(runtime.time, impact + (context.skill.stealthAttack ? 0.72 : 0.56)))
    };
    runtime.profession.core.outboundAxes.push(axe);
    runtime.schedule(THIEF_AXE_LAND, axe.landsAt, { id: axe.id });
  }
}

/** Release the recalled generation before aftercast so it cannot absorb axes thrown by the following skill. */
export function scheduleThiefAxeRecall(runtime: ThiefRuntime, context: ActionContext<ThiefSkill>): void {
  if (context.kind !== 'cast' || context.cast.cancelled) return;
  const cast = context.cast;
  const at = cast.skill.interruptCommitMs == null ? cast.fullEnd : cast.start + cast.skill.interruptCommitMs / 1000;
  runtime.scheduleForCast('thief.recall-axes', canonicalTime(at), cast);
}

/** Lower-priority ground axes are replaced first; age breaks ties within a projectile type. */
function axePriority(skillId: SkillId): number {
  if (skillId === ID.CUNNING_SALVO || skillId === ID.MALICIOUS_CUNNING_SALVO) return 2;
  return skillId === ID.VENOMOUS_VOLLEY ? 1 : 0;
}

/** Only landing claims one of six slots; a recalled flight makes its queued landing a no-op. */
export function landThiefAxe(runtime: ThiefRuntime, data: unknown): void {
  const core = runtime.profession.core;
  const index = core.outboundAxes.findIndex((axe) => axe.id === (data as { id: string }).id);
  if (index < 0) return;
  const [landed] = core.outboundAxes.splice(index, 1);
  core.spinningAxes = core.spinningAxes.filter((axe) => axe.expiresAt > runtime.time);
  if (core.spinningAxes.length >= MAXIMUM_SPINNING_AXES) {
    const lowestPriority = Math.min(...core.spinningAxes.map((axe) => axePriority(axe.skillId)));
    // Fizzling leaves protected axes and their expiry times intact.
    if (lowestPriority > axePriority(landed.skillId)) return;
    const replace = core.spinningAxes.findIndex((axe) => axePriority(axe.skillId) === lowestPriority);
    core.spinningAxes.splice(replace, 1);
  }

  core.spinningAxes.push({
    skillId: landed.skillId,
    expiresAt: runtime.combatStartedAt() ? canonicalTime(runtime.time + 10) : Infinity
  });
}

/** Precombat axes remain available throughout the opener and begin aging only when combat starts. */
export function startThiefAxeExpiry(runtime: ThiefRuntime): void {
  for (const axe of runtime.profession.core.spinningAxes) {
    if (axe.expiresAt === Infinity) axe.expiresAt = canonicalTime(runtime.time + 10);
  }
}

/** Recall repeats each live projectile's base effects, without creating new axes or scaling poison by malice again. */
export function recallThiefAxes(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const axes = [
    ...runtime.profession.core.spinningAxes.filter((axe) => axe.expiresAt > runtime.time),
    ...runtime.profession.core.outboundAxes
  ];
  // Returning packets own the recalled generation; later throws start a fresh ground/flight pool.
  runtime.profession.core.spinningAxes = [];
  runtime.profession.core.outboundAxes = [];
  const torment = cast.skill.id === ID.HARROWING_STORM;
  const arrivals = axes.map((axe) => {
    const skill = runtime.helpers.skillsById.get(axe.skillId)!;
    // Both recalls launch travelling projectiles; resolving Storm instantly loses their ordering against later throws.
    const delay = skill.stealthAttack ? 0.04 : skill.id === ID.VENOMOUS_VOLLEY ? 0.48 : 0.52;
    return { skill, at: canonicalTime(runtime.time + delay) };
  });
  // The fifth arriving projectile owns immobilize, even when a later-emitted Salvo returns first.
  arrivals.sort((a, b) => a.at - b.at);
  for (const [index, { skill, at }] of arrivals.entries()) {
    const projectiles = skill.id === ID.VENOMOUS_VOLLEY ? 3 : 1;
    runtime.effects.emit({
      kind: 'profile',
      profile: skill,
      effects: skill.effects?.map((effect) => ({
        ...effect,
        // Impact refunds remain on returned packets; only casts create a new axe generation.
        ...(effect.type === 'strike'
          ? { coefficient: (Number(effect.coefficient) / projectiles) * (torment ? 1 : 1.33), hits: 1 }
          : {}),
        ...(effect.type === 'condition' ? { stacks: Number(effect.stacks) / projectiles } : {})
      })),
      skillWeaponFallback: 'Axe',
      attribution: {
        source: 'thief',
        sourceId: skill.id,
        skillId: skill.id,
        skillName: skill.name,
        actorType: 'player',
        activationId: cast.id,
        metadata: { recallSkillId: cast.skill.id }
      },
      transform: (event) => ({
        ...event,
        at,
        name: `${event.name} (Recall)`,
        offTarget: cast.command.offTarget
      })
    });
    // Recall adds its condition per returning axe; a target's condition cap can hide later applications in EVTC.
    runtime.effects.emit({
      kind: 'packet',
      event: buildThiefCondition(cast.skill, {
        at,
        activationId: cast.id,
        offTarget: cast.command.offTarget,
        condition: torment ? 'Torment' : 'Weakness',
        stacks: 1,
        duration: torment ? 2 : 1
      })
    });
    // Five returning hits trigger one immobilize; five is a threshold, not a cap on returning axes.
    if (index === 4)
      runtime.effects.emit({
        kind: 'packet',
        event: buildThiefCondition(cast.skill, {
          at,
          activationId: cast.id,
          offTarget: cast.command.offTarget,
          condition: 'Immobilized',
          stacks: 1,
          duration: 1.5
        })
      });
  }
}
