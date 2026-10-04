import type { ActionContext } from '#gw2/platform/effects/actions.js';
import { MAXIMUM_SPINNING_AXES } from '#gw2/professions/thief/core/state.js';
import { canonicalTime } from '#kernel/core/clock.js';

import { buildThiefCondition } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

export const THIEF_AXE_LAND = 'thief.axe-land';

/** A landed hit continues outward before occupying a ground slot; recall can intercept that flight. */
export function grantThiefGroundAxe(runtime: ThiefRuntime, context: ActionContext<ThiefSkill>): void {
  if (context.kind !== 'effect') return;
  const event = context.trigger.event;
  const axe = {
    id: `${event.activationId}:${event.effectReaction?.packet}`,
    skillId: context.skill.id,
    // Melee EVTC missile lifetimes: ordinary axes continue ~560ms after hitting; Salvo ~720ms.
    landsAt: canonicalTime(runtime.time + (context.skill.stealthAttack ? 0.72 : 0.56))
  };
  runtime.profession.core.outboundAxes.push(axe);
  runtime.schedule(THIEF_AXE_LAND, axe.landsAt, { id: axe.id });
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

  core.spinningAxes.push({ skillId: landed.skillId, expiresAt: canonicalTime(runtime.time + 10) });
}

/** Recall repeats each live projectile's base effects, without creating new axes or scaling poison by malice again. */
export function recallThiefAxes(runtime: ThiefRuntime, context: ActionContext<ThiefSkill>): void {
  if (context.kind !== 'cast') return;
  const axes = [
    ...runtime.profession.core.spinningAxes.filter((axe) => axe.expiresAt > runtime.time),
    ...runtime.profession.core.outboundAxes
  ];
  // Returning packets own the recalled generation; later throws start a fresh ground/flight pool.
  runtime.profession.core.spinningAxes = [];
  runtime.profession.core.outboundAxes = [];
  const torment = context.skill.id === ID.HARROWING_STORM;
  const arrivals = axes.map((axe) => {
    const skill = runtime.helpers.skillsById.get(axe.skillId)!;
    // Melee return travel differs by projectile; Harrowing Storm keeps its immediate target arrival.
    const delay = torment ? 0 : skill.stealthAttack ? 0.04 : skill.id === ID.VENOMOUS_VOLLEY ? 0.48 : 0.52;
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
        // Keep impact refunds, but returning projectiles never replenish the ground pool.
        reactions: effect.reactions?.filter(
          (reaction) => !('type' in reaction.do && reaction.do.type === 'thief.ground-axe')
        ),
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
        activationId: context.cast.id,
        metadata: { recallSkillId: context.skill.id }
      },
      transform: (event) => ({
        ...event,
        at,
        name: `${event.name} (Recall)`,
        offTarget: context.cast.command.offTarget
      })
    });
    // Recall adds its condition per returning axe; a target's condition cap can hide later applications in EVTC.
    runtime.effects.emit({
      kind: 'packet',
      event: buildThiefCondition(context.skill, {
        at,
        activationId: context.cast.id,
        offTarget: context.cast.command.offTarget,
        condition: torment ? 'Torment' : 'Weakness',
        stacks: 1,
        duration: torment ? 2 : 1
      })
    });
    // Five returning hits trigger one immobilize; five is a threshold, not a cap on returning axes.
    if (index === 4)
      runtime.effects.emit({
        kind: 'packet',
        event: buildThiefCondition(context.skill, {
          at,
          activationId: context.cast.id,
          offTarget: context.cast.command.offTarget,
          condition: 'Immobilized',
          stacks: 1,
          duration: 1.5
        })
      });
  }
}
