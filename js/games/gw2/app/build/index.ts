// The build facade keeps profession-app coupled to stable feature entry points while internal folders evolve.
export { bindPageControls } from './page-controls.js';
export { renderAssumptions } from './panels/assumptions.js';
export { renderAttributes } from './panels/attributes.js';
export { renderGear } from './panels/gear.js';
export { initBuildTemplates, updateTemplateSelection } from './panels/presets.js';
export { renderSkills } from './panels/skills.js';
export { renderTraits } from './panels/traits.js';
export { createDefaultBuild, loadBuild, saveBuild } from './state/persistence.js';
export { normalizeSelectedSkills } from './state/skill-selection.js';
