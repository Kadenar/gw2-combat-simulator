import { applyFractalAttributes } from '#gw2/build-context/fractal-buffs.js';
import { createGw2SimulationConfig } from '#gw2/build-context/simulation-config.js';
import type {
  BuildAttributes,
  BuildContextDeclarations,
  BuildContextFactory,
  BuildContextProfession,
  WeaponSetNumber
} from '#gw2/build-context/types.js';
import { calculateCommonAttributes } from '#gw2/platform/attributes/calculation.js';
import { attributeSeedFromCommon } from '#gw2/platform/attributes/inputs.js';
import type { Gw2AttributeSeed, Gw2CommonAttributeResult } from '#gw2/platform/attributes/types.js';
import { validateFractalBuffs } from '#gw2/platform/builds/fractal-buffs.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { BOON } from '#gw2/platform/constants.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import { buildAssumptionControls } from '#gw2/professions/shared/build-assumptions.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';
import { selectedTraits } from '#gw2/professions/shared/trait-data.js';

// Families own their additional fields and primary resource; shared configuration remains protected.
type ProfessionConfig<TConfig extends Gw2Config> = Partial<Omit<TConfig, keyof Gw2Config>> &
  Pick<Gw2Config, 'initialResource'> & {
    readonly [Key in Exclude<keyof Gw2Config, 'initialResource'>]?: never;
  };

// Inspect every branch of an inferred result so conditional mappings cannot hide foreign or misspelled fields.
type ExtraConfigKeys<TConfig, TResult> = TResult extends unknown ? Exclude<keyof TResult, keyof TConfig> : never;

/** Bind the family types first, then infer the complete mapping result to reject extra keys in returned objects. */
export function bindBuildContext<TBuild extends Gw2CanonicalBuild, TConfig extends Gw2Config>(
  profession: BuildContextProfession
) {
  return <TContribution extends ProfessionConfig<TConfig>>(
    professionConfig: (
      build: Readonly<TBuild>,
      specialization: string
    ) => TContribution & Record<ExtraConfigKeys<ProfessionConfig<TConfig>, TContribution>, never>,
    declarations: BuildContextDeclarations<TBuild>
  ): BuildContextFactory<TBuild> => {
    const assumptionControls = buildAssumptionControls(declarations.assumptionControls);
    return ({ build: inputBuild, patch, transitionDelays, disabledModifier: disabled }) => {
      validateFractalBuffs(inputBuild.assumptions.fractal);
      const { catalog, balanceContext } = patch;
      const eliteNames = new Set(catalog.specializations.filter((spec) => spec.elite).map((spec) => spec.name));
      const specialization = inputBuild.specializations.find((spec) => eliteNames.has(spec.name))?.name || 'Core';
      // Remove attribute-backed effects before conversions while borrowing untouched equipment and rotation data.
      let build: Readonly<TBuild> = inputBuild;

      if (disabled?.type === 'Boon') {
        const key = disabled.name.toLowerCase();
        build = { ...build, assumptions: { ...build.assumptions, [key]: key === boonKey(BOON.MIGHT) ? 0 : false } };
      } else if (disabled?.type === 'Food') build = { ...build, food: '' };
      else if (disabled?.type === 'Utility') build = { ...build, utility: '' };

      // Attribute passives use the starting bar; input tracing also needs the other selected bars after swaps.
      const loadout = declarations.resolveSkillLoadout(build, specialization);
      const selectedSkillIds = Object.freeze(
        (loadout.bars.find((bar) => bar.id === loadout.activeBarId)?.skillIds ?? [])
          .filter((id): id is SkillId => id !== null)
          .filter((id) => disabled?.type !== 'Skill' || id !== disabled.skillId)
      );
      const selectedSkills = selectedSkillIds
        .map((id) => catalog.skillsById.get(id))
        .filter((skill): skill is Skill => skill != null);
      const disabledTrait = disabled?.type === 'Trait' ? disabled.name : null;
      const traitContext = createBuildAttributeContext(
        { build, disabledTrait, balanceContext },
        catalog,
        (selections) => selectedTraits(catalog, selections)
      );
      const selectedTraitIds = traitContext.activeTraits.map((trait) => trait.id);
      // Keep equipment seeds independent of finalized previews, including when requirements request a preview first.
      const equipmentCache = new Map<WeaponSetNumber, { common: Gw2CommonAttributeResult; seed: Gw2AttributeSeed }>();
      const equipment = (weaponSet: WeaponSetNumber) => {
        let prepared = equipmentCache.get(weaponSet);

        if (!prepared) {
          const common = calculateCommonAttributes(build, {
            weaponSet,
            disabledSigil: disabled?.type === 'Sigil' ? disabled.name : null
          });
          prepared = { common, seed: attributeSeedFromCommon(common) };
          equipmentCache.set(weaponSet, prepared);
        }

        return prepared;
      };

      const cache = new Map<WeaponSetNumber, BuildAttributes>();
      const attributes = (weaponSet: WeaponSetNumber): BuildAttributes => {
        if (weaponSet !== 1 && weaponSet !== 2) throw new RangeError('Weapon set must be 1 or 2.');

        let result = cache.get(weaponSet);

        if (!result) {
          const { common, seed } = equipment(weaponSet);
          result = finalizeProfessionBuildAttributes(common, seed, traitContext, {
            build,
            selectedSkills,
            weaponSet,
            disabledTrait,
            balanceContext,
            attributeContributions: profession.attributeContributions
          }) as BuildAttributes;
          // Potions increase final stats without becoming a source for further conversions.
          result = applyFractalAttributes(result, build.assumptions.fractal);
          cache.set(weaponSet, result);
        }

        return result;
      };

      return {
        specialization,
        selectedSkillIds,
        attributes,
        simulationConfig() {
          // Config consumers may mutate their snapshot without corrupting cached seeds or the source build.
          return {
            // Preserve selected positions, including every fixed loadout, for live input-control resolution.
            skillInputBars: loadout.bars.map((bar) => ({
              id: bar.id,
              slots: Object.fromEntries(
                bar.skillIds.flatMap((id, index) => (id === null ? [] : [[`slot-${index + 6}`, id]]))
              )
            })),
            ...createGw2SimulationConfig({
              build,
              patchId: patch.id,
              transitionDelays,
              attributeSeeds: [equipment(1).seed, equipment(2).seed],
              specialization,
              disabled,
              selectedSkillIds,
              selectedTraitIds,
              assumptionControls
            }),
            ...structuredClone(professionConfig(build, specialization)),
            ...(patch.values ? { previewValues: { ...patch.values } } : {})
          };
        }
      };
    };
  };
}
