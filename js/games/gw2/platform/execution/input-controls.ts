import {
  controlOnSkillBar,
  inputControlForSkillSlot,
  type InputControlId,
  type InputSkillBar
} from '#gw2/platform/skills/input-controls.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { CastCommand } from '#gw2/platform/execution/rotation.js';

/** Execution resolves logical controls and records accepted activations for downstream observers. */
export type InputControl =
  | { readonly control: InputControlId; readonly unresolvedReason?: never }
  | { readonly control: null; readonly unresolvedReason: string };

export type InputAction = InputControl & {
  readonly activationId: string;
  readonly rotationIndex: number;
  readonly at: number;
  readonly order: number;
  readonly skillId: SkillId;
  readonly skillName: string;
};

/** Accepted weapon/replacement slots are authoritative; utility positions require the selected live bar. */
export function resolveInputControl(
  catalog: CanonicalCatalog,
  skill: Skill,
  command: CastCommand,
  bars: readonly InputSkillBar[] = []
): InputControl {
  if (command.skillId === SHARED_SKILL_IDS.SWAP_WEAPONS || skill.inputCategory === 'weapon-swap')
    return { control: 'weapon-swap' };

  if (skill.inputControl) return { control: skill.inputControl };

  const slot = inputControlForSkillSlot(skill.slot);

  if (slot) return { control: slot };

  const control = bars.length === 1 ? controlOnSkillBar(catalog, skill, bars[0]) : null;

  if (control) return { control };

  return { control: null, unresolvedReason: 'No control resolved on the active skill bar.' };
}
