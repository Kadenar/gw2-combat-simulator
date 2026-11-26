import { CONDITION } from '#gw2/platform/constants.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { replaceThiefBuff } from '#gw2/professions/thief/core/mechanics/buffs.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { spearChainStageForSkill } from '#gw2/professions/thief/data/spear-chain-stages.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

const SPEAR_STEALTH_SKILLS = new Set<SkillId>([ID.ASHEN_ASSAULT]);

/** Spear stages advance on committed attacks; Distracting Throw after a finisher arms its damage window. */
export function updateSpearChain(runtime: ThiefRuntime, skill: ThiefSkill): void {
  const core = runtime.profession.core;
  const stage = spearChainStageForSkill(skill);

  if (stage != null) {
    core.spearChainStage = (stage + 1) % 3;
    core.spearPreviousSkillId = skill.id;
    return;
  }

  if (skill.id === ID.DISTRACTING_THROW) {
    const followsFinisher =
      core.spearPreviousSkillId != null &&
      spearChainStageForSkill(requireSkill(runtime.helpers, core.spearPreviousSkillId)) === 2;

    if (!followsFinisher && core.spearChainStage !== 0) return;

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
    skillNumber(requireSkill(runtime.helpers, ID.DISTRACTING_THROW), 'duration'),
    ID.DISTRACTING_THROW,
    'Distracting Throw',
    'thief'
  );
}

/** Immobilize, Fear and Taunt are the target conditions that qualify Falling Spider at impact. */
export function fallingSpiderTargetControlled(hasCondition: (condition: string) => boolean): boolean {
  return [CONDITION.IMMOBILIZED, CONDITION.FEAR, CONDITION.TAUNT].some(hasCondition);
}

/** Add the finisher bonus once per qualifying condition packet, including independently timed ticks. */
export function applyFallingSpiderBonus(runtime: ThiefRuntime, event: Gw2ResolverEvent, stackIndex: number): void {
  if (
    stackIndex !== 1 ||
    event.triggeredBy === 'Falling Spider' ||
    (event.condition !== CONDITION.BLEEDING && event.condition !== CONDITION.POISONED) ||
    !fallingSpiderTargetControlled((condition) => runtime.combat.targetHasCondition(condition, event.at))
  )
    return;

  const skill = requireSkill(runtime.helpers, ID.FALLING_SPIDER);
  emitSpearBonusCondition(runtime, event, skillNumber(skill, 'empoweredConditionStacks'), 'Falling Spider');
}

/** Bonus stacks inherit the base packet's duration and attribution when its target requirement is met. */
export function emitSpearBonusCondition(
  runtime: ThiefRuntime,
  application: Gw2ResolverEvent,
  stacks: number,
  triggeredBy = application.triggeredBy
): void {
  if (!application.condition) return;

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
      triggeredBy,
      fixedDuration: application.fixedDuration,
      name: `${application.skillName} - Bonus ${application.condition}`,
      condition: application.condition,
      duration: application.duration || 0,
      stacks
    })
  });
}

/** Eligibility and commitment share the same spear chain stage policy. */
export function thiefSpearAvailability(
  runtime: MechanicQueriesOf<ThiefRuntime>,
  skill: ThiefSkill
): AvailabilityResult | null {
  const stage = spearChainStageForSkill(skill);
  return stage != null && (runtime.profession.core.spearChainStage || 0) !== stage
    ? denySkillCast(skill, 'thief.spear-chain', `requires spear chain stage ${stage + 1}.`)
    : null;
}
