import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';

/** Create run(rotation, overrides, options) with local defaults and shared native setup and queued observations. */
export function createProfessionSimulator(defaultProfession, createDefaults = () => ({})) {
  return (
    rotation,
    overrides = {},
    {
      profession = defaultProfession,
      initialize = () => {},
      catalog,
      extend = () => ({}),
      observation,
      output,
      combatStartTime,
      timeline = [],
      probes = []
    } = {}
  ) => {
    const config = { ...createDefaults(), ...overrides };
    const native = profession.runtimeFor(config);
    const extension = extend(native);
    return observeGw2Runtime({
      profession: {
        ...native,
        ...(catalog ? { catalog: catalog(native.catalog) } : {}),
        ...extension,
        tasks: {
          ...(extension.tasks ?? native.tasks),
          'test.timeline': (runtime, index) => timeline[index].run(runtime),
          'test.probe': (runtime, { index }) => probes[index][1](runtime),
          'test.emit': (runtime, event) => runtime.emit(event)
        },
        initialize(runtime) {
          // Extensions replace other hooks; fixture initialization always follows the native owner's setup.
          native.initialize?.(runtime);
          initialize(runtime);
          // Timeline work chooses its queue priority; probes observe after ordinary same-timestamp work.
          for (const [index, entry] of timeline.entries())
            runtime.schedule('test.timeline', entry.at, index, undefined, entry.priority);
          for (const [index, [at]] of probes.entries()) runtime.schedule('test.probe', at, { index }, undefined, 100);
        }
      },
      config,
      rotation,
      observation,
      output,
      combatStartTime
    });
  };
}
