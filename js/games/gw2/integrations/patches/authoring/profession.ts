import { selectionFromConfig, type PatchSelection, type ResolvedPatch } from '#gw2/integrations/patches/selection.js';
import { generatePatchOverview } from '#gw2/integrations/patches/authoring/overview-generation.js';
import {
  replaceProvisionalEffect,
  validateProvisionalCatalog,
  validateProvisionalParameters
} from '#gw2/integrations/patches/authoring/provisional-values.js';
import { buildRelevantPatch } from '#gw2/integrations/patches/authoring/build-overview.js';
import {
  balanceProfileAuthoringReference,
  balanceProfileHasAuthorableControls,
  balanceProfilePatchableNumericFields,
  skillAuthoringReference,
  skillPatchableNumericFields
} from '#gw2/integrations/patches/authoring/fields.js';
import type {
  NativePatchAuthoringContract,
  NativePatchAuthoringMetadata,
  NativePreviewModifierRuleTarget
} from '#gw2/integrations/patches/authoring/module-types.js';
import type {
  ModifierRulePatchEdit,
  PatchPreview,
  ProfessionPatchPreview
} from '#gw2/integrations/patches/authoring/patches.js';
import {
  CURRENT_PATCH_ID,
  applyBalanceProfilePatch,
  applyModifierRulePatch,
  applySkillPatch,
  professionPatchFor,
  validatePatchPreview
} from '#gw2/integrations/patches/authoring/patches.js';
import type { Gw2Build } from '#gw2/platform/builds/types.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { getNativeCatalogAssembly } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import type { ProfessionRuntimeOptions } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { AnyNativeModule, NativeProfessionContract } from '#gw2/platform/profession-definition/module-types.js';
import { defineNativeProfession as defineStableNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import type { ProfessionModuleCatalogFragment } from '#gw2/platform/profession-definition/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { CanonicalCatalog, CatalogEntity } from '#gw2/platform/skills/types.js';

function assertObject(value: object | null | undefined, label: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
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
            (module.modifiers.modifierRules ?? []).map((rule) =>
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

const PROFESSION_PATCH_FIELDS = new Set(['skills', 'balanceProfiles', 'modifierRules', 'reworks', 'provisional']);

function assertProfessionPatchShape(professionId: string, patch: ProfessionPatchPreview): void {
  assertObject(patch, `${professionId} patch`);
  validateProvisionalParameters(patch.provisional);
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

  if (
    patch.reworks !== undefined &&
    (!Array.isArray(patch.reworks) ||
      patch.reworks.some((id) => typeof id !== 'string') ||
      new Set(patch.reworks).size !== patch.reworks.length)
  ) {
    throw new TypeError(`${professionId} reworks must be unique registered names.`);
  }
}

/** Recompile registered replacements before tuning; JSON can select behavior but cannot supply executable code. */
function selectReworkedModules(
  modules: readonly AnyNativeModule[],
  variants: Readonly<Record<string, AnyNativeModule>>,
  patch: ProfessionPatchPreview | null | undefined
): readonly AnyNativeModule[] {
  const replacements = new Map<string, AnyNativeModule>();
  for (const id of patch?.reworks ?? []) {
    const replacement = Object.hasOwn(variants, id) ? variants[id] : undefined;

    if (!replacement || !modules.some((module) => module.id === replacement.id))
      throw new TypeError(`Unknown module rework ${id}.`);

    if (replacements.has(replacement.id)) throw new TypeError(`Multiple reworks replace ${replacement.id}.`);

    replacements.set(replacement.id, replacement);
  }

  return modules.map((module) => replacements.get(module.id) ?? module);
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

  const declarations = modules.flatMap((module) => [...(module.modifiers.modifierRules ?? [])]);
  const patched = applyModifierRulePatch(declarations, patch);
  const patchedById = new Map(patched.map((rule) => [rule.id, rule]));
  const ownerById = new Map<string, string>();
  const byModule = new Map<string, readonly Gw2ModifierRule[]>();
  for (const module of modules) {
    const rules = module.modifiers.modifierRules ?? [];

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

    const modifiers = Object.freeze({ ...module.modifiers, modifierRules });

    // Clone only declaration shells touched by a preview; catalog data and state factories stay shared.
    return Object.freeze({
      ...module,
      modifiers
    });
  });
}

/** Lines whose major-trait slots differ from Live; their Live positions would select different traits in the preview. */
function relaidSpecializations(
  live: Readonly<CanonicalCatalog>,
  preview: Readonly<CanonicalCatalog>
): readonly string[] {
  const layout = (specialization: CatalogEntity) =>
    JSON.stringify(
      (specialization.majorTraits as readonly (readonly CatalogEntity[])[]).map((tier) => tier.map(({ id }) => id))
    );
  const liveLayouts = new Map(
    live.specializations.map((specialization) => [specialization.name, layout(specialization)])
  );

  return Object.freeze(
    preview.specializations
      .filter((specialization) => liveLayouts.get(specialization.name) !== layout(specialization))
      .map(({ name }) => name)
  );
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
  const liveModules = definition.modules as readonly AnyNativeModule[];
  const preview = candidatePreview ? validatePatchPreview(candidatePreview) : null;
  const professionPatch = professionPatchFor(preview, definition.id);

  if (professionPatch) assertProfessionPatchShape(definition.id, professionPatch);

  // Session edits only change balance profiles; compiled module declarations stay shared.
  const editsForValues = (values: PatchSelection['values'], includeAuthored = true): ProfessionPatchPreview => {
    const edited = structuredClone(includeAuthored ? (professionPatch ?? {}) : {}) as {
      balanceProfiles?: Record<string, import('./patches.js').SkillPatchEdit>;
    };
    edited.balanceProfiles ??= {};
    for (const [id, value] of Object.entries(values ?? {})) {
      const parameter = professionPatch?.provisional?.find((entry) => entry.id === id);

      if (
        !parameter ||
        !Number.isFinite(value) ||
        value < parameter.minimum ||
        value > parameter.maximum ||
        (['charges', 'stacks'].includes(parameter.unit) && !Number.isInteger(value))
      )
        throw new TypeError(`Invalid provisional value ${id}.`);

      const old = edited.balanceProfiles[parameter.profileId] ?? {};
      edited.balanceProfiles[parameter.profileId] = {
        ...old,
        assumption: [
          professionPatch?.balanceProfiles?.[parameter.profileId]?.assumption,
          'Session values override this assumption; final balance values remain unknown.'
        ]
          .filter(Boolean)
          .join(' '),
        ...(parameter.effect
          ? { effects: replaceProvisionalEffect(old.effects ?? [], parameter, value) }
          : { fields: { ...old.fields, [parameter.field]: value } })
      };
    }

    return edited;
  };

  const modules = selectReworkedModules(liveModules, definition.moduleVariants ?? {}, professionPatch);
  const reworkedFamily = professionPatch?.reworks?.length
    ? (defineStableNativeProfession({ ...definition, modules: modules as TModules }) as NativeProfessionContract<
        TModules,
        TPresentation,
        TBuild
      >)
    : family;
  const assembly = getNativeCatalogAssembly(modules, definition.catalog);
  const modifierRules = modules.flatMap((module) => [...(module.modifiers.modifierRules ?? [])]);
  const patchAuthoring = createPatchAuthoringMetadata(definition.id, definition.name, modules, assembly.fragments);
  const previewModifierRules = preparePreviewModifierRules(modules, professionPatch?.modifierRules);
  let previewFamily: NativeProfessionContract<TModules, TPresentation, TBuild> | null = null;
  const familyForPreview = () => {
    if (!previewModifierRules.targets.length) return reworkedFamily;

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
      balanceDataContext: Object.freeze({
        professionId: definition.id,
        patchId: preview?.id ?? '<validation>',
        reworks: Object.freeze([...(professionPatch?.reworks ?? [])]),
        relaidSpecializations: relaidSpecializations(family.catalog, catalog)
      })
    });
  const validatedPreviewCatalog = (): Readonly<CanonicalCatalog> => {
    if (previewCatalog) return previewCatalog;

    const catalog = applyBalanceProfilePatch(
      applySkillPatch(previewCatalogSource(reworkedFamily.catalog), professionPatch),
      professionPatch
    );
    validateProvisionalCatalog(catalog, professionPatch?.provisional);
    previewCatalog = catalog;
    return catalog;
  };

  const runtimeOverlays = new WeakMap<object, Map<string, object>>();
  const runtimeCatalogs = new WeakMap<Readonly<CanonicalCatalog>, Map<string, Readonly<CanonicalCatalog>>>();
  const resolvedPatches = new Map<string, ResolvedPatch>();
  const assertPatchId = (patchId = CURRENT_PATCH_ID): string => {
    if (patchId === CURRENT_PATCH_ID || (preview && patchId === preview.id)) return patchId;

    throw new TypeError(
      `Unknown ${definition.name} patch ${patchId}. Expected ${CURRENT_PATCH_ID}` +
        (preview ? ` or ${preview.id}.` : '.')
    );
  };

  /** Normalize once so every consumer sees the same selection and invalid tuning fails before state changes. */
  const resolvePatch = (selection: PatchSelection = { id: CURRENT_PATCH_ID }): ResolvedPatch => {
    const id = assertPatchId(selection.id);

    if (id !== CURRENT_PATCH_ID && selection.values !== undefined) assertObject(selection.values, 'Provisional values');

    const entries =
      id === CURRENT_PATCH_ID ? [] : Object.entries(selection.values ?? {}).sort(([a], [b]) => a.localeCompare(b));
    const values = entries.length ? Object.freeze(Object.fromEntries(entries)) : undefined;
    const key = JSON.stringify([id, entries]);
    const cached = resolvedPatches.get(key);

    if (cached) return cached;

    const catalog =
      id === CURRENT_PATCH_ID
        ? family.catalog
        : values
          ? applyBalanceProfilePatch(validatedPreviewCatalog(), editsForValues(values, false))
          : validatedPreviewCatalog();
    const selectedRules =
      id === CURRENT_PATCH_ID
        ? liveModules.flatMap((module) => [...(module.modifiers.modifierRules ?? [])])
        : previewModifierRules.targets.length
          ? [...previewModifierRules.byModule.values()].flat()
          : modifierRules;
    const balanceContext = Object.freeze({
      catalog,
      modifierRulesById: new Map(selectedRules.map((rule) => [rule.id, rule]))
    });
    const patch = Object.freeze({
      id,
      ...(values ? { values } : {}),
      key,
      catalog,
      balanceContext,
      reworks: Object.freeze(id === CURRENT_PATCH_ID ? [] : [...(professionPatch?.reworks ?? [])])
    });

    // Bound experimental catalogs while retaining the two stable default selections.
    if (values && resolvedPatches.size >= 34) {
      const oldest = [...resolvedPatches].find(([, entry]) => entry.values)?.[0];

      if (oldest) resolvedPatches.delete(oldest);
    }

    resolvedPatches.set(key, patch);
    return patch;
  };

  const validatePatch = (candidate: ProfessionPatchPreview | null | undefined): true => {
    if (!candidate) return true;

    assertProfessionPatchShape(definition.id, candidate);
    const candidateModules = selectReworkedModules(liveModules, definition.moduleVariants ?? {}, candidate);
    const catalog = previewCatalogSource(getNativeCatalogAssembly(candidateModules, definition.catalog).catalog);
    const patchedCatalog = applyBalanceProfilePatch(applySkillPatch(catalog, candidate), candidate);
    applyModifierRulePatch(
      candidateModules.flatMap((module) => [...(module.modifiers.modifierRules ?? [])]),
      candidate.modifierRules
    );
    validateProvisionalCatalog(patchedCatalog, candidate.provisional);
    return true;
  };

  // Both runtime compilers use the same validated catalog overlay and selected modifier declarations.
  const overlayRuntime = <
    T extends {
      readonly catalog: Readonly<CanonicalCatalog>;
      readonly createState: (config: Gw2Config, balanceContext?: ProfessionBalanceContext) => object;
    }
  >(
    runtime: T,
    patch: ResolvedPatch
  ): T => {
    let overlays = runtimeOverlays.get(runtime);

    if (!overlays) {
      overlays = new Map();
      runtimeOverlays.set(runtime, overlays);
    }

    const cached = overlays.get(patch.key);

    if (cached) return cached as T;

    // Isolation modes can share a source catalog; retain skill identity across their equivalent overlays.
    let catalogs = runtimeCatalogs.get(runtime.catalog);

    if (!catalogs) {
      catalogs = new Map();
      runtimeCatalogs.set(runtime.catalog, catalogs);
    }

    const catalog =
      catalogs.get(patch.key) ??
      applyBalanceProfilePatch(
        applySkillPatch(previewCatalogSource(runtime.catalog), professionPatch, { unknownSkills: 'ignore' }),
        patch.values ? editsForValues(patch.values) : professionPatch,
        { unknownProfiles: 'ignore' }
      );

    if (!catalogs.has(patch.key)) {
      if (catalogs.size >= 32) catalogs.delete(catalogs.keys().next().value!);

      catalogs.set(patch.key, catalog);
    }

    // Starting resources and combat queries must observe the same captured balance selection.
    const overlay = Object.freeze({
      ...runtime,
      catalog,
      createState: (config: Gw2Config) => runtime.createState(config, patch.balanceContext)
    });

    if (overlays.size >= 32) overlays.delete(overlays.keys().next().value!);

    overlays.set(patch.key, overlay);
    return overlay;
  };

  const resolveProfession = (config: Readonly<Gw2Config> = {}) => {
    const patch = resolvePatch(selectionFromConfig(config));
    return patch.id === CURRENT_PATCH_ID
      ? family.resolveProfession(config)
      : overlayRuntime(familyForPreview().resolveProfession(config), patch);
  };

  // Preserve isolation options while reusing the compiled family for every session value set.
  const runtimeFor = (config: Readonly<Gw2Config> = {}, options?: ProfessionRuntimeOptions) => {
    const patch = resolvePatch(selectionFromConfig(config));
    return patch.id === CURRENT_PATCH_ID
      ? family.runtimeFor(config, options)
      : overlayRuntime(familyForPreview().runtimeFor(config, options), patch);
  };

  const services = {
    // Detached attribute previews carry the selected catalog even when their config has no patch id.
    attributeContributions: ((context) =>
      (context.balanceContext.catalog.balanceDataContext?.patchId === preview?.id && preview
        ? familyForPreview()
        : family
      ).attributeContributions(context)) as typeof family.attributeContributions,
    preview,
    resolvePatch,
    patchAuthoring,
    // Generate from filtered edits so similarly named skill variants cannot leak unrelated notes into a build.
    patchOverviewFor(config: Gw2Config, observedIds: readonly (string | number)[]) {
      if (!preview || !professionPatch) return [];

      const patch = resolvePatch(selectionFromConfig(config));
      const relevantPatch = buildRelevantPatch(
        patch.values ? editsForValues(patch.values) : professionPatch,
        config,
        observedIds,
        reworkedFamily.catalog,
        modules,
        patchAuthoring,
        family.weaponSkillMatchesSet
      );
      return generatePatchOverview(relevantPatch, patchAuthoring);
    },
    validatePatch,
    resolveProfession,
    runtimeFor,
    previewModifierRuleTargets: previewModifierRules.targets
  };

  // Exposed controls must be valid at load, even before a caller asks for the preview catalog.
  if (professionPatch?.provisional?.length) validatedPreviewCatalog();

  // Preserve lazy family getters: decorating a headless profession must not initialize its presentation.
  return Object.freeze(
    Object.defineProperties(
      {},
      {
        ...Object.getOwnPropertyDescriptors(family),
        ...Object.getOwnPropertyDescriptors(services)
      }
    )
  ) as NativePatchAuthoringContract<TModules, TPresentation, TBuild>;
}
