import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { elementalistAppAdapter } from '#gw2/professions/elementalist/app/app-definition.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import { elementalistProfession } from '#gw2/professions/elementalist/definition.js';

// Preserve test shorthand: numbers are waits, names are casts, and explicit commands pass through.
function canonicalRotation(rotation) {
  return rotation.map((entry) => {
    if (typeof entry === 'number') {
      return { type: 'wait', durationMs: entry };
    }

    if (entry && typeof entry === 'object') return entry;

    return {
      type: 'cast',
      skillId: elementalistCatalog.skillsByName.get(entry).id
    };
  });
}

// Build and recalculate through the native adapter so UI and simulation tests share application defaults.
export function createNativeApp({ lines, rotation = [], ...extras }) {
  const commands = canonicalRotation(rotation);
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    specializations: lines.map(([name, traits = '1-1-1']) => ({
      name,
      traits
    })),
    rotation: commands,
    ...extras
  });
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    attributeWeaponSet: 1
  };

  elementalistAppAdapter.recalculate(app);

  return { app, commands };
}

// Exercise the public simulator with the same configuration produced by the application.
export function runNative(options) {
  const { app, commands } = createNativeApp(options);

  return simulateGw2({
    profession: elementalistProfession,
    rotation: commands,
    config: elementalistAppAdapter.simulationConfig(app)
  });
}

// Include scheduled and resolved events so assertions can find effects in either simulation phase.
export function resolvedAndScheduledEvents(result) {
  return [...(result.events || []), ...(result.resolvedEvents || [])];
}
