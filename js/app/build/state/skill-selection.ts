import type { Skill } from '../../../platform/engine/types.js';
import type { ProfessionAppState } from '../../profession/types.js';

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
        professionState: app.results?.endState?.profession,
        catalog: app.activeCatalog
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
  for (const [slot, type] of Object.entries(slotTypes)) {
    const current = app.skillByName.get(app.build.selectedSkills[slot]);
    const allowed =
      current &&
      current.implemented !== false &&
      current.type === type &&
      isSlotSkillSelectable(app, current, spec) &&
      (!current.specialization || current.specialization === spec) &&
      app.adapter.isSkillAvailable(current, {
        build: app.build,
        specialization: spec
      });
    if (!allowed) {
      app.build.selectedSkills[slot] =
        app.skills.find(
          (skill) =>
            skill.implemented !== false &&
            skill.type === type &&
            isSlotSkillSelectable(app, skill, spec) &&
            (!skill.specialization || skill.specialization === spec) &&
            app.adapter.isSkillAvailable(skill, {
              build: app.build,
              specialization: spec
            })
        )?.name || '';
    }
  }
}
