import { bindBuildContext } from '#gw2/build-context/create.js';
import type { BuildContextInput, BuildContextProfession } from '#gw2/build-context/types.js';
import { resolveSelectedSkillLoadout } from '#gw2/platform/builds/skill-loadout.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { createBuildContext, toApplicationBuild } from '#gw2/professions/engineer/build/context.js';
import type { EngineerCanonicalBuild, EngineerConfig } from '#gw2/professions/engineer/types.js';
import { toApplicationBuild as thiefBuild } from '#gw2/professions/thief/build/context.js';

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
const bindEngineerContext = bindBuildContext<EngineerCanonicalBuild, EngineerConfig>(profession);
const declarations = { assumptionControls: [], resolveSkillLoadout: resolveSelectedSkillLoadout };
bindEngineerContext(
  // @ts-expect-error A profession contribution cannot replace target configuration.
  () => ({ initialResource: 1, target: { armor: 1 } }),
  declarations
);

// Engineer mappings accept Engineer config fields and the shared initialResource field.
bindEngineerContext(
  (build) => ({
    initialHeat: build.initialHeat,
    selectedMorphSkillIds: build.selectedMorphSkillIds,
    initialResource: 1
  }),
  declarations
);
bindEngineerContext(() => ({}), declarations);
bindEngineerContext(
  (build, specialization) => (specialization === 'Holosmith' ? { initialHeat: build.initialHeat } : {}),
  declarations
);
bindEngineerContext(
  // @ts-expect-error initialHeat requires a number.
  () => ({ initialHeat: 'hot' }),
  declarations
);
bindEngineerContext(
  // @ts-expect-error selectedPet belongs to Ranger config, not Engineer config.
  () => ({ initialHeat: 1, selectedPet: 'Tiger' }),
  declarations
);
bindEngineerContext(
  // @ts-expect-error A valid initialHeat field does not permit an unknown typoField.
  () => ({ initialHeat: 1, typoField: 2 }),
  declarations
);
const inferredContribution = () => ({ initialHeat: 1, typoField: 2 });
// @ts-expect-error Check unknown keys even when the callback is defined separately.
bindEngineerContext(inferredContribution, declarations);
bindEngineerContext(
  // @ts-expect-error Check unknown keys in every conditional return branch.
  (build, specialization) => (specialization === 'Holosmith' ? { initialHeat: build.initialHeat } : { typoField: 2 }),
  declarations
);

// Extending the profession's config type must allow the new field in its mapper.
interface ExtendedEngineerConfig extends EngineerConfig {
  localStartingResource?: number;
}
bindBuildContext<EngineerCanonicalBuild, ExtendedEngineerConfig>(profession)(
  () => ({ localStartingResource: 1 }),
  declarations
);

// A build-context profession must own its attribute calculator.
declare const withoutCalculator: Omit<BuildContextProfession, 'attributeContributions'>;
bindBuildContext<EngineerCanonicalBuild, EngineerConfig>(
  // @ts-expect-error Attribute previews require the bound profession's calculator.
  withoutCalculator
)(() => ({}), declarations);
