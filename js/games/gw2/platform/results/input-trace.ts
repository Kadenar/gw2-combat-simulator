import type { InputControlId } from '#gw2/platform/skills/input-controls.js';
import type { CastCommand } from '#gw2/platform/execution/rotation.js';
import { isAutoattackSkill } from '#gw2/platform/skills/autoattack-chain-index.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';
import { inputControlForSkillSlot } from '#gw2/platform/skills/input-controls.js';

export interface InputSkillBar {
  readonly id: string;
  readonly slots: Readonly<Partial<Record<InputControlId, SkillId>>>;
}

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

export interface InputTrace {
  readonly version: 1;
  readonly start: number;
  readonly end: number;
  readonly actions: readonly InputAction[];
}

/** Both reports exclude reconstructed state and automatic attacks using the same canonical classification. */
export function activationInputKind(catalog: CanonicalCatalog, skill: Skill, command: CastCommand) {
  if (command.initialStateDurationMs != null || skill.initialStateOnly) return 'excluded';
  return isAutoattackSkill(catalog, skill) ? 'autoattack' : 'manual';
}

/** Follow declared replacements within the selected bar, never a global skill-to-utility-slot map. */
export function controlOnSkillBar(catalog: CanonicalCatalog, skill: Skill, bar: InputSkillBar): InputControlId | null {
  const ancestors = new Set<SkillId>();
  const visit = (id: SkillId | null | undefined): void => {
    if (id == null || ancestors.has(id)) return;
    ancestors.add(id);
    const candidate = catalog.skillsById.get(id);
    if (!candidate) return;
    visit(candidate.flipParentId);
    visit(candidate.parentId);
    visit(candidate.loadoutSkillId);
    visit(candidate.weaponVariantRootId);
  };

  visit(skill.id);
  for (const [control, id] of Object.entries(bar.slots)) {
    if (ancestors.has(id)) return control as InputControlId;
    const parent = catalog.skillsById.get(id);
    if (parent?.flipSkillId === skill.id || (parent?.loadoutSkillId != null && ancestors.has(parent.loadoutSkillId)))
      return control as InputControlId;
  }

  return null;
}

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

/** Detach accepted inputs and clip to APM's combat/rotation boundaries, excluding observation tails. */
export function projectInputTrace(actions: readonly InputAction[], start: number, end: number): InputTrace {
  const seen = new Set<string>();
  return {
    version: 1,
    start,
    end,
    actions: actions
      .filter((action) => {
        if (action.at < start || action.at > end || seen.has(action.activationId)) return false;
        seen.add(action.activationId);
        return true;
      })
      .map((action) => ({ ...action }))
  };
}
