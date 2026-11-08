/** Queries and repairs slot selections, then derives attributes from the normalized build for edits and tab restoration. */
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';

export interface SlotSelectionState {
  readonly build: ProfessionAppState['build'];
  readonly activeCatalog: ProfessionAppState['activeCatalog'];
  readonly profession: Pick<ProfessionAppState['profession'], 'ui'>;
  readonly adapter: Pick<ProfessionAppState['adapter'], 'eliteSpecialization' | 'slotLoadout' | 'isSkillAvailable'>;
  readonly analysis: { readonly state: Pick<ProfessionAppState['analysis']['state'], 'results'> };
}

export function isSlotSkillSelectable(
  app: Pick<SlotSelectionState, 'build' | 'activeCatalog' | 'profession'>,
  skill: Skill | null | undefined,
  specialization: string
): boolean {
  // Follow-up identity comes from the canonical parent ID, independent of display names.
  if (!skill || skill.flipParentId != null || skill.slotSelectable === false) {
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

/** Lists the legal, deduplicated choices for a heal, utility, or elite slot. */
export function availableSlotSkills(
  app: Pick<SlotSelectionState, 'build' | 'activeCatalog' | 'profession' | 'adapter'>,
  type: string
): Skill[] {
  const spec = app.adapter.eliteSpecialization(app.build);
  const byLoadoutId = new Map<Skill['id'], Skill>();
  for (const skill of app.activeCatalog.skills) {
    if (
      skill.type !== type ||
      !isSlotSkillSelectable(app, skill, spec) ||
      (skill.specialization && skill.specialization !== spec) ||
      !app.adapter.isSkillAvailable(skill, {
        catalog: app.activeCatalog,
        build: app.build,
        specialization: spec
      })
    ) {
      continue;
    }

    // Collapse authored attunement variants while retaining distinct skills with identical labels.
    const loadoutId = skill.paletteTileId ?? skill.id;

    if (!byLoadoutId.has(loadoutId)) byLoadoutId.set(loadoutId, skill);
  }

  return [...byLoadoutId.values()];
}

function samePlacement(left: Skill | undefined, right: Skill): boolean {
  return Boolean(
    left && left.type === right.type && left.slot === right.slot && (left.weapon || '') === (right.weapon || '')
  );
}

/** Project reciprocal role swaps into a private selection map without changing the displayed build. */
export function buildWithPatchSkillSelections(
  app: Pick<ProfessionAppState, 'build' | 'activeCatalog'>,
  nextCatalog: Readonly<CanonicalCatalog>
): Gw2CanonicalBuild {
  const build = { ...app.build, selectedSkillIds: { ...app.build.selectedSkillIds } };
  swapSelectedSkillsForPatch({ build, activeCatalog: app.activeCatalog }, nextCatalog);
  return build;
}

/** Preserve the selected slot across reciprocal patch role swaps before ordinary loadout validation repairs it. */
export function swapSelectedSkillsForPatch(
  app: Pick<ProfessionAppState, 'build' | 'activeCatalog'>,
  nextCatalog: Readonly<CanonicalCatalog>
): void {
  for (const [slot, id] of Object.entries(app.build.selectedSkillIds)) {
    if (id == null) continue;

    const previous = app.activeCatalog.skillsById.get(id);
    const next = nextCatalog.skillsById.get(id);

    if (!previous || !next || previous.type === next.type) continue;

    const replacements = nextCatalog.skills.filter(
      (candidate) =>
        samePlacement(candidate, previous) && samePlacement(app.activeCatalog.skillsById.get(candidate.id), next)
    );

    // Only an unambiguous reciprocal swap identifies the intended replacement.
    if (replacements.length === 1) app.build.selectedSkillIds[slot] = replacements[0]!.id;
  }
}

export function normalizeSelectedSkills(app: SlotSelectionState): void {
  const spec = app.adapter.eliteSpecialization(app.build);

  if (app.adapter.slotLoadout) {
    Object.assign(
      app.build,
      app.adapter.slotLoadout.normalizeBuild(app.build, {
        build: app.build,
        specialization: spec,
        professionState: app.analysis.state.results?.planningState?.profession
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

    const current = app.activeCatalog.skillsById.get(app.build.selectedSkillIds[slot]!);
    const allowed =
      current &&
      !selected.has(current.id) &&
      current.type === type &&
      isSlotSkillSelectable(app, current, spec) &&
      (!current.specialization || current.specialization === spec) &&
      app.adapter.isSkillAvailable(current, {
        catalog: app.activeCatalog,
        build: app.build,
        specialization: spec
      });

    if (!allowed) {
      app.build.selectedSkillIds[slot] =
        app.activeCatalog.skills.find(
          (skill) =>
            skill.type === type &&
            !Object.values(app.build.selectedSkillIds).includes(skill.id) &&
            isSlotSkillSelectable(app, skill, spec) &&
            (!skill.specialization || skill.specialization === spec) &&
            app.adapter.isSkillAvailable(skill, {
              catalog: app.activeCatalog,
              build: app.build,
              specialization: spec
            })
        )?.id ?? null;
    }

    selected.add(app.build.selectedSkillIds[slot]);
  }
}

/** Repairs build inputs before deriving attributes so edits and restored tabs use the same assumptions. */
export function normalizeSelectedSkillsAndAttributes(
  state: Pick<
    ProfessionAppState,
    | 'build'
    | 'patch'
    | 'profession'
    | 'adapter'
    | 'analysis'
    | 'simulationSettings'
    | 'attributeWeaponSet'
    | 'attributeData'
    | 'workspace'
  >
): void {
  // Imported builds and restored encounter tabs cannot apply fractal bonuses to boss previews or simulations.
  if (state.workspace?.scenario) delete state.build.assumptions.fractal;

  normalizeSelectedSkills({
    build: state.build,
    activeCatalog: state.patch.catalog,
    profession: state.profession,
    adapter: state.adapter,
    analysis: state.analysis
  });
  state.attributeData = state.adapter
    .createBuildContext({
      build: state.build,
      patch: state.patch,
      transitionDelays: normalizeTransitionDelays(state.simulationSettings?.transitionDelays)
    })
    .attributes(state.attributeWeaponSet === 2 ? 2 : 1);
}
