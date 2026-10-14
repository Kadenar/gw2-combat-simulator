import type { ThiefConfig } from '#gw2/professions/thief/types.js';
import type { RevenantConfig } from '#gw2/professions/revenant/types.js';
import type { RangerConfig } from '#gw2/professions/ranger/types.js';
import type { NecromancerConfig } from '#gw2/professions/necromancer/types.js';
import type { GuardianConfig } from '#gw2/professions/guardian/types.js';
import type { EngineerConfig } from '#gw2/professions/engineer/types.js';
import type { ElementalistConfig } from '#gw2/professions/elementalist/build/types.js';
import type { Gw2CalculateAttributes, Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type {
  BuildAttributes,
  BuildContextFactory,
  BuildContextProfession,
  BuildContextDeclarations,
  WeaponSet
} from '#gw2/build-context/types.js';
import { createGw2SimulationConfig } from '#gw2/build-context/simulation-config.js';
import { buildAssumptionControls } from '#gw2/professions/shared/build-assumptions.js';

// Common equipment, target, patch, and assumption fields cannot be replaced by a profession contribution.
type ProfessionConfigFields = Pick<
  Gw2Config &
    ElementalistConfig &
    EngineerConfig &
    GuardianConfig &
    NecromancerConfig &
    RangerConfig &
    RevenantConfig &
    ThiefConfig,
  | 'initialResource'
  | 'startAttunement'
  | 'secondaryAttunement'
  | 'initialCatalystEnergy'
  | 'evokerElement'
  | 'initialEvokerCharges'
  | 'initialEvokerEmpowered'
  | 'pistolBullets'
  | 'initialHeat'
  | 'selectedMorphSkillIds'
  | 'initialTomePages'
  | 'initialBlight'
  | 'initialCascadingCorruptionStacks'
  | 'initialAstralForce'
  | 'initialArrows'
  | 'selectedPet'
  | 'selectedPet2'
  | 'selectedHammerSkillIds'
  | 'initialUntamedState'
  | 'initialEnergy'
  | 'selectedLegends'
  | 'startingLegend'
  | 'initialInitiative'
  | 'initialSpinningAxes'
  | 'initialPreSteal'
  | 'initialShadowForce'
  | 'selectedDodge'
>;
// Even structurally typed callbacks cannot overwrite common config fields such as patch, target, or boons.
type ProfessionConfig = Partial<ProfessionConfigFields> & {
  readonly [Key in Exclude<keyof Gw2Config, keyof ProfessionConfigFields>]?: never;
};

/** Bind native profession declarations once; each call owns only its two lazy attribute results. */
export function bindBuildContext<TBuild extends Gw2CanonicalBuild>(
  profession: BuildContextProfession,
  calculateAttributes: Gw2CalculateAttributes,
  professionConfig: (build: Readonly<TBuild>, specialization: string) => ProfessionConfig,
  declarations: BuildContextDeclarations<TBuild>
): BuildContextFactory<TBuild> {
  const eliteNames = new Set(profession.catalog.specializations.filter((spec) => spec.elite).map((spec) => spec.name));
  const assumptionControls = buildAssumptionControls(declarations.assumptionControls);
  return ({ build: inputBuild, patchId, transitionDelays, disabledModifier: disabled }) => {
    if (patchId !== 'current' && (!profession.preview || patchId !== profession.preview.id)) {
      throw new TypeError(`Unknown patch: ${patchId}`);
    }

    const specialization = inputBuild.specializations.find((spec) => eliteNames.has(spec.name))?.name || 'Core';
    const catalog = profession.catalogFor?.(patchId) ?? profession.catalog;
    const balanceContext = profession.balanceContextFor(patchId);
    // Remove attribute-backed effects before conversions while borrowing untouched equipment and rotation data.
    let build: Readonly<TBuild> = inputBuild;
    if (disabled?.type === 'Boon') {
      const key = disabled.name.toLowerCase();
      build = { ...build, assumptions: { ...build.assumptions, [key]: key === 'might' ? 0 : false } };
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
    const cache = new Map<WeaponSet, BuildAttributes>();
    const attributes = (weaponSet: WeaponSet): BuildAttributes => {
      if (weaponSet !== 1 && weaponSet !== 2) throw new RangeError('Weapon set must be 1 or 2.');
      let result = cache.get(weaponSet);
      if (!result) {
        result = calculateAttributes(
          build,
          selectedSkills,
          weaponSet,
          disabled?.type === 'Trait' ? disabled.name : null,
          disabled?.type === 'Sigil' ? disabled.name : null,
          balanceContext
        ) as BuildAttributes;
        cache.set(weaponSet, result);
      }

      return result;
    };

    return {
      profession,
      specialization,
      selectedSkillIds,
      attributes,
      simulationConfig() {
        const sets = [attributes(1), attributes(2)] as const;
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
            patchId,
            transitionDelays,
            attributeDataByWeaponSet: sets,
            specialization,
            disabled,
            selectedSkillIds,
            selectedTraitIds: sets[0].activeTraits.map((trait) => trait.id).filter((id): id is SkillId => id != null),
            assumptionControls
          }),
          ...structuredClone(professionConfig(build, specialization))
        };
      }
    };
  };
}
