import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';
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

  app.attributeData = elementalistAppAdapter
    .createBuildContext({
      build: app.build,
      patchId: app.patchId ?? 'current',
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays)
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);

  return { app, commands };
}

// Exercise the public simulator with the same configuration produced by the application.
export function runNative(options) {
  const { app, commands } = createNativeApp(options);

  return runElementalist(
    commands,
    elementalistAppAdapter
      .createBuildContext({
        build: app.build,
        patchId: app.patchId ?? 'current',
        transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays)
      })
      .simulationConfig(),
    {
      profession: elementalistProfession
    }
  );
}

/** Prepared application configs run through the same native initialization and observation setup. */
export const runElementalist = createProfessionSimulator(elementalistProfession);

// Buffs are now authoritative in resolvedEvents; omit their scheduled copies to count applications once.
export function resolvedAndScheduledEvents(result) {
  return [...(result.events || []).filter((event) => event.type !== 'buff'), ...(result.resolvedEvents || [])];
}
