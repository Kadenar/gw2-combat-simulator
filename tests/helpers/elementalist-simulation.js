import { observeGw2Runtime } from '#tests/helpers/live-runtime.js';
import { elementalistAppAdapter } from '#gw2/professions/elementalist/app/app-definition.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';

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

  return runElementalist({
    profession: elementalistProfession,
    rotation: commands,
    config: elementalistAppAdapter.simulationConfig(app)
  });
}

/** Family checks exercise registered native owners, including patched catalogs and timed setup. */
export function runElementalist({
  profession = elementalistProfession,
  config,
  rotation,
  observationPolicy,
  output,
  initialize = () => {},
  timeline = []
}) {
  const native = profession.liveRuntimeFor(config);
  return observeGw2Runtime({
    profession: {
      ...native,
      initialize(runtime) {
        native.initialize?.(runtime);
        initialize(runtime);
        for (const [index, entry] of timeline.entries())
          runtime.schedule('test.elementalist-check', entry.at, index, undefined, entry.priority);
      },
      tasks: { ...native.tasks, 'test.elementalist-check': (runtime, index) => timeline[index].run(runtime) }
    },
    config,
    rotation,
    observation: observationPolicy,
    output
  });
}

// Buffs are now authoritative in resolvedEvents; omit their scheduled copies to count applications once.
export function resolvedAndScheduledEvents(result) {
  return [...(result.events || []).filter((event) => event.type !== 'buff'), ...(result.resolvedEvents || [])];
}
