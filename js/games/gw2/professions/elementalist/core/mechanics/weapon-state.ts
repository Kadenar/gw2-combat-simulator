/**
 * Weapon- and attunement-facing cast state for Core Elementalist.
 *
 * Slot-skill selection across attunement variants, weapon-skill attunement gating,
 * and autoattack chain carryover across attunement swaps.
 */
import { denySkillCast as unavailable } from '#gw2/platform/execution/availability.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { ReadonlyMechanicState } from '#gw2/platform/profession-definition/runtime-context.js';
import { isAutoattackSkill } from '#gw2/platform/skills/autoattack-chain-index.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { elementalistLoadoutIdentity } from '#gw2/professions/elementalist/core/mechanics/selection-policy.js';
import type { ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { elementalistAttunementPolicy } from '#gw2/professions/elementalist/family-state.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Only the next earned autoattack can be cast outside its attunement. A chain reset restores the root. */
export function isCarriedAutoattack(
  skill: ElementalistSkill,
  primaryAttunement: string,
  readChain: (root: SkillId) => SkillId | undefined
): boolean {
  return (
    isAutoattackSkill(skill) &&
    !!skill.attunement &&
    skill.attunement !== primaryAttunement &&
    skill.chainRoot != null &&
    skill.id !== skill.chainRoot &&
    skill.id === readChain(skill.chainRoot)
  );
}

function ready(): AvailabilityResult {
  return { ready: true };
}

// Attunement variants share one magazine, or copy an ordinary timer when the utility has no magazine.
export function shareAttunementVariantRecharge(context: ElementalistRuntime, skill: ElementalistSkill): void {
  if (!['Heal', 'Utility', 'Elite'].includes(String(skill.type)) || !skill.attunement) {
    return;
  }

  const identity = elementalistLoadoutIdentity(skill.id, context.helpers);
  const readyAt = context.cooldownController.readyAt(skill.id);
  const ammo = context.cooldownController.readAmmo(skill.id);

  if (readyAt == null && !ammo) return;

  for (const candidate of context.helpers.skills) {
    if (candidate.type === skill.type && elementalistLoadoutIdentity(candidate.id, context.helpers) === identity) {
      if (ammo) context.cooldownController.linkAmmo(skill.id, candidate.id);
      else context.cooldownController.copy(skill.id, candidate.id);
    }
  }
}

/**
 * Allows weapon skills only in their attuned element. A denial is permanent for the command.
 * Changing attunement can make the skill usable; waiting cannot.
 */
export function weaponAttunementAvailable(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: ElementalistSkill,
  state: ReadonlyMechanicState<ElementalistCoreState>
): AvailabilityResult {
  const attunement = skill.attunement || '';

  if (!attunement) return ready();

  // The selected Weaver owns weapon-hand eligibility, regardless of incidental state fields.
  if (elementalistAttunementPolicy(context).weaponGate === 'elite') return ready();

  if (isCarriedAutoattack(skill, state.primaryAttunement, context.autoattackController.read)) return ready();

  const required = attunement.split('+');
  return required.length === 1 && required[0] === state.primaryAttunement
    ? ready()
    : unavailable(skill, 'elementalist.attunement', `requires ${attunement} attunement.`);
}
