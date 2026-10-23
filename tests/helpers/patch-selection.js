/** Give small presentation fixtures a complete resolved selection without loading a profession runtime. */
export function patchSelectionFixture(catalog = {}, { id = 'current', values } = {}) {
  return {
    id,
    ...(id !== 'current' && values ? { values } : {}),
    key: JSON.stringify([id, values ?? {}]),
    catalog,
    balanceContext: { catalog, modifierRulesById: new Map() },
    reworks: []
  };
}

/** Give fake apps the inputs `resolveEntrySkill` reads for trait-selected skill identities; no trait replaces any ID. */
export function withoutTraitSkillVariants(app) {
  return Object.assign(app, {
    patch: app.patch ?? patchSelectionFixture(app.activeCatalog),
    build: app.build ?? {},
    adapter: { ...app.adapter, createBuildContext: () => ({ simulationConfig: () => ({ selectedTraitIds: [] }) }) },
    profession: { ...app.profession, runtimeFor: () => ({}) }
  });
}
