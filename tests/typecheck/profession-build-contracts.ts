/** Compile-time checks for closed build shapes and codec results across profession composition. */
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { toApplicationBuild as engineerApplicationBuild } from '#gw2/professions/engineer/build/build.js';
import { toApplicationBuild as elementalistApplicationBuild } from '#gw2/professions/elementalist/build/build.js';
import type { ElementalistCanonicalBuild } from '#gw2/professions/elementalist/build/types.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { normalizeProfessionBuild } from '#gw2/platform/builds/profession-contract.js';
import { composeHookContainer } from '#gw2/platform/engine/profession/module.js';
import type { Gw2Build, Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type {
  ProfessionAttributeRuleDefinition,
  ProfessionCastRuleDefinition
} from '#gw2/platform/engine/profession/types.js';
import type { ProfessionBuildDefinition } from '#gw2/platform/builds/types.js';
import type { EngineerCanonicalBuild } from '#gw2/professions/engineer/types.js';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const decorated = withActivePatchPreview(engineerProfession);
const fixture = normalizeProfessionBuild('build-contract', {
  createBuildDefaults: () => ({ counter: 1 }),
  migrateBuild: (_saved: unknown) => ({ counter: 2 })
});

export type BuildContractAssertions = [
  Assert<Equal<string extends keyof Gw2Build ? true : false, false>>,
  Assert<Equal<string extends keyof Gw2CanonicalBuild ? true : false, false>>,
  Assert<Equal<ReturnType<typeof engineerApplicationBuild>, EngineerCanonicalBuild>>,
  Assert<Equal<ReturnType<typeof elementalistApplicationBuild>, ElementalistCanonicalBuild>>,
  Assert<Equal<ReturnType<typeof engineerProfession.createBuildDefaults>, EngineerCanonicalBuild>>,
  Assert<Equal<ReturnType<typeof engineerProfession.migrateBuild>, EngineerCanonicalBuild>>,
  Assert<
    Equal<'migrateBuild' extends keyof ReturnType<typeof engineerProfession.resolveRuntime> ? true : false, false>
  >,
  Assert<Equal<ReturnType<typeof decorated.migrateBuild>, EngineerCanonicalBuild>>,
  Assert<Equal<ReturnType<typeof fixture.migrateBuild>, { counter: number }>>,
  Assert<Equal<Parameters<NonNullable<ProfessionBuildDefinition['migrateBuild']>>[0], unknown>>
];

declare const canonical: Gw2CanonicalBuild;
declare const castRules: ProfessionCastRuleDefinition;
// @ts-expect-error Build property misspellings must not be accepted as dynamic fields.
canonical.targetHeath;
// @ts-expect-error Hook names must stay closed through composition.
castRules.modifyCastDuraton;
// @ts-expect-error Rule slots accept hooks, not arbitrary saved data.
const invalidRules: ProfessionAttributeRuleDefinition = { modifyAttributes: 42 };
void invalidRules;
// @ts-expect-error Compiler output must be a hook container.
const invalidCompiler: ProfessionAttributeRuleDefinition = { compileModifierRules: () => ({ modifyStrikeDamage: 42 }) };
void invalidCompiler;

// Composition accepts executable hook names, not metadata or misspelled slots.
const composed = composeHookContainer([], 'castRules', ['availability']);
// @ts-expect-error Only requested hook slots are exposed.
composed.modifyCastDuration;
// @ts-expect-error Modifier declarations are metadata, not a callable hook slot.
composeHookContainer([], 'attributeRules', ['modifierRules']);
