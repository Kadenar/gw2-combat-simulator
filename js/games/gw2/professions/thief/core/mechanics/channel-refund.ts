import { ACTOR } from '#gw2/platform/constants.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

/** Refund each activation only when all its authored strikes land; other casts and procs cannot fill missing hits. */
export function landedChannelRefundLifecycle(skillId: SkillId): RuntimeHooks<ThiefRuntimeState, ThiefSkill> {
  const channels = new WeakMap<object, Map<string, { remaining: number; refund: number }>>();
  const cleanup = `thief.channel-refund-${skillId}`;
  const finish = (runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void => {
    if (cast.skill.id !== skillId) return;

    // Fired projectiles may land after completion; release unfinished counters after their travel window.
    runtime.schedule(cleanup, runtime.time + (cast.command.impactDelayMs ?? 0) / 1000, cast.id, undefined, 20);
  };

  return {
    onCastStart(runtime, cast) {
      if (cast.skill.id !== skillId) return;

      let active = channels.get(runtime);

      if (!active) channels.set(runtime, (active = new Map()));

      const hits = (cast.skill.effects ?? []).reduce(
        (count, effect) => count + (effect.type === 'strike' ? effect.ticks?.length || effect.hits || 1 : 0),
        0
      );
      // Capture the accepted skill's refund so later impacts retain its selected tuning.
      active.set(cast.id, { remaining: hits, refund: skillNumber(cast.skill, 'initiativeRefund') });
    },
    onCastCommit: finish,
    onCastCancel: finish,
    reactions: {
      'damage.resolved'(runtime, event) {
        if (event.skillId !== skillId || event.actorType !== ACTOR.PLAYER || event.offTarget || event.procType) return;

        const active = channels.get(runtime);
        const id = String(event.activationId);
        const channel = active?.get(id);

        if (!channel || channel.remaining <= 0) return;

        if (channel.remaining > 1) {
          channel.remaining -= 1;
          return;
        }

        active!.delete(id);
        runtime.resourceController.grant('initiative', channel.refund);
      }
    },
    // Same-time impacts settle before cleanup, including a final bullet at the interruption boundary.
    tasks: {
      [cleanup]: (runtime, id) => {
        channels.get(runtime)?.delete(String(id));
      }
    }
  };
}
