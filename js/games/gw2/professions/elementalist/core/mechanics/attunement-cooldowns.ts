import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Attunement readiness belongs to the shared cooldown controller, including temporary recharge rates. */
export function setElementalistAttunementReadyAt(
  context: ElementalistRuntime,
  attunement: ElementalistAttunement,
  readyAt: number
): void {
  const skill = context.helpers.skillsById.get(ELEMENTALIST_ATTUNEMENT_SKILL_IDS[attunement]);

  if (!skill) throw new Error('Missing attunement skill.');

  // Keeping an existing deadline must also keep the work already earned under earlier recharge rates.
  if (context.cooldownController.readyAt(skill.id) === readyAt) return;

  if (readyAt > context.time)
    context.cooldownController.startRecharge(
      skill,
      context.time,
      (readyAt - context.time) * context.cooldownController.rate(skill)
    );
  else context.cooldownController.clear(skill.id);
}

/** Resets the actual attunement recharge pools at the shared reset boundary. */
export function resetElementalistAttunementCooldowns(context: ElementalistRuntime): void {
  for (const element of ELEMENTALIST_ATTUNEMENTS) setElementalistAttunementReadyAt(context, element, context.time);
}
