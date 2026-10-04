import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

export function isSlotSkillSelectable(
  app: ProfessionAppState,
  skill: Skill | null | undefined,
  specialization: string
): boolean {
  if (!skill || skill.flipParent || skill.flipParentId != null || skill.slotSelectable === false) {
    return false;
  }

  return (
    app.profession.ui.isSlotSkillSelectable?.(
      {
        build: app.build,
        specialization,
        catalog: app.activeCatalog
      },
      skill
    ) !== false
  );
}

export function normalizeSelectedSkills(app: ProfessionAppState): void {
  const spec = app.adapter.eliteSpecialization(app.build);
  if (app.adapter.slotLoadout) {
    Object.assign(
      app.build,
      app.adapter.slotLoadout.normalizeBuild(app.build, {
        build: app.build,
        specialization: spec,
        professionState: app.results?.planningState?.profession
      })
    );
    return;
  }

  const slotTypes = {
    Heal: 'Heal',
    Utility1: 'Utility',
    Utility2: 'Utility',
    Utility3: 'Utility',
    Elite: 'Elite'
  };
  // Repair duplicate picks and keep fallback choices from displacing skills equipped in later slots.
  const selected = new Set<SkillId | null>();
  for (const [slot, type] of Object.entries(slotTypes)) {
    if (app.build.selectedSkillIds[slot] === null) continue;
    const current = app.skillById.get(app.build.selectedSkillIds[slot]!);
    const allowed =
      current &&
      !selected.has(current.id) &&
      current.type === type &&
      isSlotSkillSelectable(app, current, spec) &&
      (!current.specialization || current.specialization === spec) &&
      app.adapter.isSkillAvailable(current, {
        build: app.build,
        specialization: spec
      });
    if (!allowed) {
      app.build.selectedSkillIds[slot] =
        app.skills.find(
          (skill) =>
            skill.type === type &&
            !Object.values(app.build.selectedSkillIds).includes(skill.id) &&
            isSlotSkillSelectable(app, skill, spec) &&
            (!skill.specialization || skill.specialization === spec) &&
            app.adapter.isSkillAvailable(skill, {
              build: app.build,
              specialization: spec
            })
        )?.id ?? null;
    }

    selected.add(app.build.selectedSkillIds[slot]);
  }
}
