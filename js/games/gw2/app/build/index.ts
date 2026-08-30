// The build facade keeps profession-app coupled to stable feature entry points while internal folders evolve.
export { bindPageControls } from '#gw2/app/build/page-controls.js';
export { renderAssumptions } from '#gw2/app/build/panels/assumptions.js';
export { renderAttributes } from '#gw2/app/build/panels/attributes.js';
export { renderGear } from '#gw2/app/build/panels/gear.js';
export { initBuildTemplates, updateTemplateSelection } from '#gw2/app/build/panels/presets.js';
export { renderSkills } from '#gw2/app/build/panels/skills.js';
export { renderTraits } from '#gw2/app/build/panels/traits.js';
export { createDefaultBuild, loadBuild, saveBuild } from '#gw2/app/build/state/persistence.js';
export { normalizeSelectedSkills } from '#gw2/app/build/state/skill-selection.js';
