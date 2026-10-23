import { resolveSelectedSkillLoadout } from '#gw2/platform/builds/skill-loadout.js';
import { bindBuildContext } from '#gw2/build-context/create.js';
import type { BuildContextAttributeRules } from '#gw2/build-context/types.js';
import type { BuildContextProfession } from '#gw2/build-context/types.js';
import { createBuildContext, toApplicationBuild } from '#gw2/professions/engineer/build/context.js';
import { toApplicationBuild as thiefBuild } from '#gw2/professions/thief/build/context.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import type { BuildContextInput } from '#gw2/build-context/types.js';
import type { EngineerCanonicalBuild } from '#gw2/professions/engineer/types.js';

const build = toApplicationBuild({});
const input: BuildContextInput<EngineerCanonicalBuild> = {
  build,
  patch: profession.resolvePatch({ id: 'current' }),
  transitionDelays: normalizeTransitionDelays(undefined)
};
const context = createBuildContext(input);
context.attributes(1).activeTraits.map((trait) => trait.id);
context.simulationConfig();
// @ts-expect-error The bound factory requires its profession's canonical fields.
createBuildContext({ ...input, build: thiefBuild({}) });
// @ts-expect-error Patch identity is explicit.
createBuildContext({ build, transitionDelays: input.transitionDelays });
// @ts-expect-error Settings are explicit, including zero-delay callers.
createBuildContext({ build, patch: profession.resolvePatch({ id: 'current' }) });
// @ts-expect-error Contexts borrow immutable input.
input.build.initialHeat = 10;
// @ts-expect-error Only two weapon sets exist.
context.attributes(3);
// @ts-expect-error Isolated player-health controls are not simulation inputs.
createBuildContext({ ...input, playerHealth: 50 });

// Profession contributions cannot replace common configuration even when inferred from a callback result.
declare const profession: BuildContextProfession;
declare const attributeRules: BuildContextAttributeRules;
bindBuildContext<EngineerCanonicalBuild>(
  profession,
  attributeRules,
  // @ts-expect-error A profession contribution cannot replace target configuration.
  () => ({ initialResource: 1, target: { armor: 1 } }),
  { assumptionControls: [], resolveSkillLoadout: resolveSelectedSkillLoadout }
);
