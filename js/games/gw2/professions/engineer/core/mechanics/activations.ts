import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerResolverEvent, EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** One accepted toolbelt activation; the cause is the toolbelt action that triggered skills keep as their parent. */
export interface ToolbeltActivation {
  readonly skill: EngineerSkill;
  readonly activationId: string;
  readonly at: number;
  readonly cause: EngineerResolverEvent;
}

/**
 * Every toolbelt entry path reaches the same listeners without a queued delay. Vigor and the discharge precede Kinetic
 * Battery, whose fifth-charge package closes the activation's rewards.
 */
export const toolbeltActivated = defineTriggerPoint<ToolbeltActivation>('engineer.toolbelt-activated', [
  TRAIT.OPTIMIZED_ACTIVATION,
  TRAIT.STATIC_DISCHARGE,
  TRAIT.KINETIC_BATTERY
]);

/** An accepted dodge, fired after its packet is queued. */
export interface DodgeAcceptance {
  readonly cast: RuntimeCast<EngineerSkill>;
}

/** Dodge recharge rewards apply at acceptance; Power Wrench settles elite recharge before Adrenal Implant's toolbelt. */
export const dodgeAccepted = defineTriggerPoint<DodgeAcceptance>('engineer.dodge-accepted', [
  TRAIT.POWER_WRENCH,
  TRAIT.ADRENAL_IMPLANT
]);

/** Detects explicit specialization toolbelt skills and ordinary parent-linked toolbelt skills. */
export function isEngineerToolbeltSkill(skill: EngineerSkill | undefined): boolean {
  return skill?.countsAsToolbeltSkill ?? Boolean(skill?.toolbeltParentId);
}

/** Every toolbelt entry path fires the same point at the live clock; other skills are not toolbelt activations. */
export function notifyToolbeltActivation(runtime: EngineerRuntime, skill: EngineerSkill, activationId: string): void {
  if (!isEngineerToolbeltSkill(skill)) return;
  const at = runtime.time;
  runtime.fireTrigger(toolbeltActivated, {
    skill,
    activationId,
    at,
    cause: {
      type: 'action',
      at,
      source: 'engineer',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name
    }
  });
}
