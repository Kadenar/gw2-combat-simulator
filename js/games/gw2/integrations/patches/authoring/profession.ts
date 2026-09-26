import type { Gw2Build } from '#gw2/platform/builds/types.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-presentation/balance-context.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import type { ProfessionModuleCatalogFragment } from '#gw2/platform/engine/profession/types.js';
import { getNativeCatalogAssembly } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeProfession as defineStableNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import type { AnyNativeModule, NativeProfessionContract } from '#gw2/platform/profession-definition/module-types.js';
import {
  CURRENT_PATCH_ID,
  applyBalanceProfilePatch,
  applyModifierRulePatch,
  applySkillPatch,
  professionPatchFor,
  validatePatchOverview,
  validatePatchPreview
} from '#gw2/integrations/patches/authoring/patches.js';
import {
  balanceProfileAuthoringReference,
  balanceProfileHasAuthorableControls,
  balanceProfilePatchableNumericFields,
  skillAuthoringReference,
  skillPatchableNumericFields
} from '#gw2/integrations/patches/authoring/fields.js';
import type {
  NativePatchAuthoringMetadata,
  NativePatchAuthoringContract,
  NativePreviewModifierRuleTarget
} from '#gw2/integrations/patches/authoring/module-types.js';
import type {
  ModifierRulePatchEdit,
  PatchPreview,
  ProfessionPatchPreview
} from '#gw2/integrations/patches/authoring/patches.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

function assertObject(value: object | null | undefined, label: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

function nativeModuleModifierRules(module: AnyNativeModule): readonly Gw2ModifierRule[] {
  const modifiers = module.modifiers;
  if (Array.isArray(modifiers)) {
    return modifiers as readonly Gw2ModifierRule[];
  }

  if (!modifiers || typeof modifiers !== 'object') return [];
  const rules = (modifiers as { readonly modifierRules?: unknown }).modifierRules;
  if (rules == null) return [];
  if (!Array.isArray(rules)) {
    throw new TypeError(`${module.id} modifierRules must be an array.`);
  }

  return rules as readonly Gw2ModifierRule[];
}

function modifierAuthoringValue(value: Gw2ModifierRule['amount'] | Gw2ModifierRule['factor']): {
  readonly kind: 'static' | 'resolver' | 'absent';
  readonly value?: number;
} {
  if (typeof value === 'number') {
    return Object.freeze({ kind: 'static', value });
  }

  return Object.freeze({
    kind: typeof value === 'function' ? 'resolver' : 'absent'
  });
}

function createPatchAuthoringMetadata(
  professionId: string,
  professionName: string,
  modules: readonly AnyNativeModule[],
  fragments: ReadonlyMap<string, Readonly<ProfessionModuleCatalogFragment>>
): NativePatchAuthoringMetadata {
  return Object.freeze({
    professionId,
    professionName,
    modules: Object.freeze(
      modules.map((module) => {
        const fragment = fragments.get(module.id)!;
        const authoringBalanceProfiles = (fragment.balanceProfiles || []).map((profile) =>
          Object.freeze({
            id: profile.id,
            name: profile.name,
            moduleId: module.id,
            profile: balanceProfileAuthoringReference(profile),
            patchableFields: balanceProfilePatchableNumericFields(profile)
          })
        );
        return Object.freeze({
          id: module.id,
          traits: Object.freeze([...(fragment.traits || [])]),
          skills: Object.freeze(
            (fragment.skills || [])
              .filter((skill) => skill.patchAuthoringExcluded !== true)
              .map((skill) =>
                Object.freeze({
                  id: skill.id,
                  name: skill.name,
                  moduleId: module.id,
                  skill: skillAuthoringReference(skill),
                  patchableFields: skillPatchableNumericFields(skill)
                })
              )
          ),
          balanceProfiles: Object.freeze(
            authoringBalanceProfiles.filter(
              (entry) =>
                entry.profile.profileKind !== 'skill-variant' && balanceProfileHasAuthorableControls(entry.profile)
            )
          ),
          skillVariants: Object.freeze(
            authoringBalanceProfiles.filter(
              (entry) =>
                entry.profile.profileKind === 'skill-variant' && balanceProfileHasAuthorableControls(entry.profile)
            )
          ),
          modifierRules: Object.freeze(
            nativeModuleModifierRules(module).map((rule) =>
              Object.freeze({
                id: rule.id,
                label: rule.label || null,
                moduleId: module.id,
                targets: Object.freeze(Array.isArray(rule.target) ? [...rule.target] : [rule.target]),
                operation: rule.operation,
                amount: modifierAuthoringValue(rule.amount),
                factor: modifierAuthoringValue(rule.factor),
                parameters: Object.freeze({ ...(rule.parameters || {}) }),
                conditional: typeof rule.when === 'function',
                order: Number(rule.order || 0)
              })
            )
          )
        });
      })
    )
  });
}

const PROFESSION_PATCH_FIELDS = new Set(['skills', 'balanceProfiles', 'modifierRules', 'overview']);

function assertProfessionPatchShape(professionId: string, patch: ProfessionPatchPreview): void {
  assertObject(patch, `${professionId} patch`);
  for (const field of Object.keys(patch)) {
    if (!PROFESSION_PATCH_FIELDS.has(field)) {
      throw new TypeError(`${professionId} patch has unsupported field ${field}.`);
    }
  }

  for (const field of ['skills', 'balanceProfiles', 'modifierRules'] as const) {
    if (patch[field] != null) {
      assertObject(patch[field], `${professionId} patch ${field}`);
    }
  }

  if (patch.overview != null && !Array.isArray(patch.overview)) {
    throw new TypeError(`${professionId} patch overview must be an array.`);
  }

  validatePatchOverview(patch.overview, `${professionId} patch overview`);
}

function modifierPatchFields(edit: ModifierRulePatchEdit): readonly string[] {
  return Object.freeze([
    ...(Object.hasOwn(edit, 'amount') ? ['amount'] : []),
    ...(Object.hasOwn(edit, 'factor') ? ['factor'] : []),
    ...Object.keys(edit.parameters || {}).map((name) => `parameters.${name}`)
  ]);
}

function preparePreviewModifierRules(
  modules: readonly AnyNativeModule[],
  patch: Readonly<Record<string, ModifierRulePatchEdit>> | null | undefined
): {
  readonly byModule: ReadonlyMap<string, readonly Gw2ModifierRule[]>;
  readonly targets: readonly NativePreviewModifierRuleTarget[];
} {
  const entries = Object.entries(patch || {});
  if (!entries.length) {
    return { byModule: new Map(), targets: Object.freeze([]) };
  }

  const declarations = modules.flatMap((module) => [...nativeModuleModifierRules(module)]);
  const patched = applyModifierRulePatch(declarations, patch);
  const patchedById = new Map(patched.map((rule) => [rule.id, rule]));
  const ownerById = new Map<string, string>();
  const byModule = new Map<string, readonly Gw2ModifierRule[]>();
  for (const module of modules) {
    const rules = nativeModuleModifierRules(module);
    if (!rules.length) continue;
    for (const rule of rules) ownerById.set(rule.id, module.id);
    byModule.set(module.id, Object.freeze(rules.map((rule) => patchedById.get(rule.id) || rule)));
  }

  const targets = entries.map(([id, edit]) =>
    Object.freeze({
      id,
      moduleId: ownerById.get(id)!,
      fields: modifierPatchFields(edit)
    })
  );
  return {
    byModule,
    targets: Object.freeze(targets)
  };
}

function modulesWithModifierRules(
  modules: readonly AnyNativeModule[],
  modifierRulesByModule: ReadonlyMap<string, readonly Gw2ModifierRule[]>
): readonly AnyNativeModule[] {
  return modules.map((module) => {
    const modifierRules = modifierRulesByModule.get(module.id);
    if (!modifierRules) return module;
    const existing = module.modifiers;
    const modifiers = Array.isArray(existing)
      ? modifierRules
      : Object.freeze({ ...((existing || {}) as object), modifierRules });

    // Clone only declaration shells touched by a preview; catalog data and state factories stay shared.
    return Object.freeze({
      ...module,
      modifiers
    });
  });
}

/** Adds patch validation, metadata, and lazy runtime overlays to an already-compiled neutral profession family. */
export function withPatchPreview<
  const TModules extends readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]],
  TPresentation extends object = object,
  TBuild extends Gw2Build = Gw2Build
>(
  family: NativeProfessionContract<TModules, TPresentation, TBuild>,
  candidatePreview: PatchPreview | null | undefined
): NativePatchAuthoringContract<TModules, TPresentation, TBuild> {
  const definition = family.nativeDefinition;
  const modules = definition.modules as readonly AnyNativeModule[];
  const preview = candidatePreview ? validatePatchPreview(candidatePreview) : null;
  const professionPatch = professionPatchFor(preview, definition.id);
  const assembly = getNativeCatalogAssembly(modules, definition.catalog);
  const modifierRules = modules.flatMap((module) => [...nativeModuleModifierRules(module)]);
  const patchAuthoring = createPatchAuthoringMetadata(definition.id, definition.name, modules, assembly.fragments);
  const previewModifierRules = preparePreviewModifierRules(modules, professionPatch?.modifierRules);
  let previewFamily: NativeProfessionContract<TModules, TPresentation, TBuild> | null = null;
  const familyForPreview = () => {
    if (!previewModifierRules.targets.length) return family;
    previewFamily ||= defineStableNativeProfession({
      ...definition,
      modules: modulesWithModifierRules(modules, previewModifierRules.byModule) as TModules
    }) as NativeProfessionContract<TModules, TPresentation, TBuild>;
    return previewFamily;
  };

  let previewCatalog: Readonly<CanonicalCatalog> | null = null;
  // Both full previews and selected runtimes carry the same patch identity through validation and lookups.
  const previewCatalogSource = (catalog: Readonly<CanonicalCatalog>): Readonly<CanonicalCatalog> =>
    Object.freeze({
      ...catalog,
      balanceDataContext: Object.freeze({ professionId: definition.id, patchId: preview?.id ?? '<validation>' })
    });
  const validatedPreviewCatalog = (): Readonly<CanonicalCatalog> => {
    previewCatalog ||= applyBalanceProfilePatch(
      applySkillPatch(previewCatalogSource(family.catalog), professionPatch),
      professionPatch
    );
    return previewCatalog;
  };

  // Cache patched runtime catalogs so repeated preview simulations reuse the same immutable overlay.
  const runtimeCatalogs = new WeakMap<Readonly<CanonicalCatalog>, Readonly<CanonicalCatalog>>();
  const runtimeOverlays = new WeakMap<object, object>();
  const assertPatchId = (patchId = CURRENT_PATCH_ID): string => {
    if (patchId === CURRENT_PATCH_ID) return patchId;
    if (preview && patchId === preview.id) return patchId;
    throw new TypeError(
      `Unknown ${definition.name} patch ${patchId}. Expected ${CURRENT_PATCH_ID}` +
        (preview ? ` or ${preview.id}.` : '.')
    );
  };

  const catalogFor = (patchId = CURRENT_PATCH_ID): Readonly<CanonicalCatalog> => {
    if (assertPatchId(patchId) === CURRENT_PATCH_ID) return family.catalog;
    return validatedPreviewCatalog();
  };

  // Reuse the selected declarations used by runtime compilation so tooltip and attribute values cannot mix patches.
  const balanceContexts = new Map<string, ProfessionBalanceContext>();
  const balanceContextFor = (patchId = CURRENT_PATCH_ID): ProfessionBalanceContext => {
    const catalog = catalogFor(patchId);
    let context = balanceContexts.get(patchId);
    if (!context) {
      const selectedRules =
        patchId === CURRENT_PATCH_ID || !previewModifierRules.targets.length
          ? modifierRules
          : [...previewModifierRules.byModule.values()].flat();
      context = Object.freeze({ catalog, modifierRulesById: new Map(selectedRules.map((rule) => [rule.id, rule])) });
      balanceContexts.set(patchId, context);
    }

    return context;
  };

  const validatePatch = (candidate: ProfessionPatchPreview | null | undefined): true => {
    if (!candidate) return true;
    assertProfessionPatchShape(definition.id, candidate);
    const catalog = previewCatalogSource(family.catalog);
    applySkillPatch(catalog, candidate);
    applyBalanceProfilePatch(catalog, candidate);
    applyModifierRulePatch(modifierRules, candidate.modifierRules);
    return true;
  };

  // Both runtime compilers use the same validated catalog overlay and selected modifier declarations.
  const overlayRuntime = <T extends { readonly catalog: Readonly<CanonicalCatalog> }>(runtime: T): T => {
    validatedPreviewCatalog();
    const cachedRuntime = runtimeOverlays.get(runtime);
    if (cachedRuntime) return cachedRuntime as typeof runtime;
    const cached = runtimeCatalogs.get(runtime.catalog);
    const catalog =
      cached ||
      applyBalanceProfilePatch(
        applySkillPatch(previewCatalogSource(runtime.catalog), professionPatch, {
          unknownSkills: 'ignore'
        }),
        professionPatch,
        { unknownProfiles: 'ignore' }
      );
    if (!cached) runtimeCatalogs.set(runtime.catalog, catalog);
    if (catalog === runtime.catalog) return runtime;
    const overlay = Object.freeze({ ...runtime, catalog });
    runtimeOverlays.set(runtime, overlay);
    return overlay;
  };

  const resolveProfession = (config: Readonly<Gw2Config> = {}) => {
    const patchId = assertPatchId(String(config.patchId || CURRENT_PATCH_ID));
    return patchId === CURRENT_PATCH_ID
      ? family.resolveProfession(config)
      : overlayRuntime(familyForPreview().resolveProfession(config));
  };

  const runtimeFor = (config: Readonly<Gw2Config> = {}) => {
    const patchId = assertPatchId(String(config.patchId || CURRENT_PATCH_ID));
    return patchId === CURRENT_PATCH_ID
      ? family.runtimeFor(config)
      : overlayRuntime(familyForPreview().runtimeFor(config));
  };

  return Object.freeze({
    ...family,
    preview,
    catalogFor,
    balanceContextFor,
    patchAuthoring,
    validatePatch,
    resolveProfession,
    runtimeFor,
    previewModifierRuleTargets: previewModifierRules.targets
  }) as NativePatchAuthoringContract<TModules, TPresentation, TBuild>;
}
