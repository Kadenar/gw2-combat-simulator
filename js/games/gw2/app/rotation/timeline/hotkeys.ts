/** Resolves timeline controls from accepted inputs, or selected skill bars while edits await simulation. */
import type { ProfessionAppResult, ProfessionAppState } from '#gw2/app/types.js';
import type { CastCommand } from '#gw2/platform/builds/rotation.js';
import { resolveSelectedSkillLoadout } from '#gw2/platform/builds/skill-loadout.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import { resolveInputControl } from '#gw2/platform/execution/input-controls.js';
import type { InputControlId, InputSkillBar } from '#gw2/platform/skills/input-controls.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export function timelineHotkeyActions(
  app: ProfessionAppState,
  build: Gw2CanonicalBuild,
  results: ProfessionAppResult | null
): (index: number, command: CastCommand, skill: Skill) => InputControlId | null {
  const recorded = new Map(
    (results?.inputTrace?.actions || []).map((action) => [action.rotationIndex, action.control])
  );
  const context = { build, catalog: app.activeCatalog, specialization: app.adapter.eliteSpecialization(build) };
  const loadout =
    app.adapter.slotLoadout?.resolve(context) ?? (build.selectedSkillIds ? resolveSelectedSkillLoadout(build) : null);
  const bars: InputSkillBar[] = (loadout?.bars || []).map((bar) => ({
    id: bar.id,
    slots: Object.fromEntries(bar.skillIds.flatMap((id, index) => (id == null ? [] : [[`slot-${index + 6}`, id]])))
  }));

  return (index, command, skill) => {
    if (recorded.has(index)) return recorded.get(index)!;

    // A skill may belong to either selected legend; only show a key when its possible slots agree.
    const controls = new Set(
      (bars.length ? bars : [undefined])
        .map((bar) => resolveInputControl(app.activeCatalog, skill, command, bar ? [bar] : []).control)
        .filter((control) => control !== null)
    );
    return controls.size === 1 ? [...controls][0] : null;
  };
}
