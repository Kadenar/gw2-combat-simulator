import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { replaceThiefBuff } from '#gw2/professions/thief/core/mechanics/buffs.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';

import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { skillNumber, skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { spearChainStageForSkill } from '#gw2/professions/thief/data/spear-chain-stages.js';

import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

/** Each Ashen channel refunds only after every authored strike lands; missed and cancelled packets cannot qualify. */
export function ashenAssaultLifecycle(skillId: SkillId): RuntimeHooks<ThiefRuntimeState, ThiefSkill> {
  const channels = new WeakMap<object, Map<string, { remaining: number; refund: number }>>();
  const cleanup = `thief.ashen-channel-${skillId}`;
  const finish = (runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void => {
    if (cast.skill.id === skillId) runtime.schedule(cleanup, runtime.time, cast.id, undefined, 20);
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
      // Capture the accepted skill's refund with the channel so later impacts retain its owner.
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
    // Cleanup follows same-time impacts, so a final hit at the cancellation boundary can still earn its refund.
    tasks: {
      [cleanup]: (runtime, id) => {
        channels.get(runtime)?.delete(String(id));
      }
    }
  };
}

const SPEAR_STEALTH_SKILLS = new Set<SkillId>([ID.ASHEN_ASSAULT]);

/** Spear stages advance on committed attacks; Distracting Throw after a finisher arms its damage window. */
export function updateSpearChain(runtime: ThiefRuntime, skill: ThiefSkill): void {
  const core = runtime.profession.core;
  const stage = spearChainStageForSkill(skill.id);

  if (stage != null) {
    core.spearChainStage = (stage + 1) % 3;
    core.spearPreviousSkillId = skill.id;
    return;
  }

  // The preceding spear identity already records whether this throw earns the finisher reward.
  const followsFinisher = core.spearPreviousSkillId != null && spearChainStageForSkill(core.spearPreviousSkillId) === 2;

  if (skill.id === ID.DISTRACTING_THROW && (followsFinisher || (core.spearChainStage || 0) === 0)) {
    core.spearChainStage = 1;
    core.spearPreviousSkillId = skill.id;

    // The committed window follows the throw's own same-time packets, so it buffs subsequent damage only.
    if (followsFinisher) runtime.schedule('thief.distracting-throw-window', runtime.time, undefined, undefined, 20);

    return;
  }

  if (skill.spearStealthAttack || SPEAR_STEALTH_SKILLS.has(skill.id)) {
    core.spearChainStage = 0;
    core.spearPreviousSkillId = skill.id;
  }
}

/** Open the finisher reward after the granting throw has resolved at the commitment instant. */
export function grantDistractingThrowWindow(runtime: ThiefRuntime): void {
  replaceThiefBuff(
    runtime,
    'distracting-throw',
    skillNumberFromContext(runtime, ID.DISTRACTING_THROW, 'duration'),
    ID.DISTRACTING_THROW,
    'Distracting Throw',
    'thief'
  );
}

/**
 * Unsuspecting Strike's Bleeding adds a fresh bonus application while the target is above ninety percent health. The
 * bonus keeps the original skill identity and cannot trigger itself.
 */
export function unsuspectingStrikeBonus(runtime: ThiefRuntime, application: Gw2ResolverEvent): void {
  runtime.effects.emit({
    kind: 'packet',
    cause: application,
    event: buildResolverCondition({
      at: runtime.time,
      source: application.source,
      sourceId: application.sourceId,
      actorType: application.actorType,
      ownerActorType: application.ownerActorType,
      skillId: application.skillId,
      skillName: application.skillName,
      activationId: application.activationId,
      triggeredBy: application.triggeredBy,
      fixedDuration: application.fixedDuration,
      name: 'Unsuspecting Strike - Bonus Bleeding',
      condition: CONDITION.BLEEDING,
      duration: application.duration || 0,
      stacks: 3
    })
  });
}

/** Eligibility and commitment share the same spear chain stage policy. */
export function thiefSpearAvailability(
  runtime: MechanicQueriesOf<ThiefRuntime>,
  skill: ThiefSkill
): AvailabilityResult | null {
  const stage = spearChainStageForSkill(skill.id);
  return stage != null && (runtime.profession.core.spearChainStage || 0) !== stage
    ? denySkillCast(skill, 'thief.spear-chain', `requires spear chain stage ${stage + 1}.`)
    : null;
}
