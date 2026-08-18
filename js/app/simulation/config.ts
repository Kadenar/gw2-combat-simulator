import type { SkillId } from '../../platform/engine/types.js';
import type { Gw2AttributeBreakdown, Gw2Config, Gw2Stats } from '../../platform/gw2/types.js';
import { createAttributeProvenance } from '../../platform/gw2/attribute-provenance.js';
import { aggregateSigilSet, weaponSigilsForSet } from '../../platform/gw2/weapon-sigils.js';
import { assumptionControlsForSpecialization } from '../profession/assumptions.js';
import type {
  Gw2SimulationConfigOptions,
  ProfessionAttributeData,
  ProfessionBuildAssumptions
} from '../profession/types.js';
import { isSimulationRandomnessControl, simulationRandomnessFromAssumptions } from './randomness.js';

/**
 * Assembles common equipment, boon, target, weapon, and stat simulation input.
 * Profession adapters supply specialization, traits, and resource semantics.
 */
export function createGw2SimulationConfig({
  app,
  attributeData,
  attributeDataByWeaponSet,
  specialization,
  disabled = null,
  selectedTraits = [],
  selectedTraitIds = [],
  initialResource = 0,
  adjustConditionDurationBonus = (_name, bonus) => bonus
}: Gw2SimulationConfigOptions): Gw2Config {
  const assumptions = app.build.assumptions as ProfessionBuildAssumptions;
  const targetSkillActivationsPerSecond = Math.max(0, Number(assumptions.targetSkillActivationsPerSecond) || 0);
  const alliedPlayerCount = Math.max(0, Math.min(4, Math.trunc(Number(assumptions.alliedPlayerCount || 0))));
  const targetConditions = { ...(assumptions.targetConditions || {}) };
  if (disabled?.type === 'Target' && disabled.name === 'Vulnerability') {
    delete targetConditions.Vulnerability;
  }
  const sigilSets = [1, 2]
    .map((setNumber) => weaponSigilsForSet(app.build, setNumber))
    .map((names) => (disabled?.type === 'Sigil' ? names.filter((name) => name !== disabled.name) : names))
    .map(aggregateSigilSet);
  const statsFromAttributes = (data: ProfessionAttributeData): Gw2Stats => {
    const breakdown = (name: string): Partial<Gw2AttributeBreakdown> => data.attributes[name] || {};
    const attr = (name: string): number => breakdown(name).final || 0;
    const displayedConditionDuration = breakdown('Condition Duration');
    const conditionDurationBonuses: Record<string, number> = Object.fromEntries(
      ['Bleeding', 'Burning', 'Confusion', 'Poison', 'Torment']
        .map((name): [string, number] => {
          const duration = breakdown(`${name} Duration`);
          const bonus = adjustConditionDurationBonus(name, Number(duration.final || 0) - Number(duration.sigils || 0));
          return [name === 'Poison' ? 'Poisoned' : name, Math.max(0, bonus)];
        })
        .filter(([, bonus]) => bonus > 0)
    );
    const displayedBoonDuration = breakdown('Boon Duration');
    const boonDurationBonuses: Record<string, number> = Object.fromEntries(
      ['Quickness', 'Might', 'Fury']
        .map((name): [string, number] => [
          name,
          Math.max(
            0,
            Number(breakdown(`${name} Duration`).final || 0) - Number(breakdown(`${name} Duration`).sigils || 0)
          )
        ])
        .filter(([, bonus]) => bonus > 0)
    );
    return {
      power: attr('Power'),
      precision: attr('Precision'),
      ferocity: attr('Ferocity'),
      conditionDamage: attr('Condition Damage'),
      expertise: attr('Expertise'),
      concentration: attr('Concentration'),
      boonDurationBonus: Math.max(
        0,
        Number(displayedBoonDuration.final || 0) -
          attr('Concentration') / 15 -
          Number(displayedBoonDuration.sigils || 0)
      ),
      boonDurationBonuses,
      vitality: attr('Vitality'),
      criticalChanceBonus: 0,
      conditionDurationBonus: Math.max(
        0,
        Number(displayedConditionDuration.final || 0) -
          attr('Expertise') / 15 -
          Number(displayedConditionDuration.sigils || 0)
      ),
      conditionDurationBonuses
    };
  };
  const fallbackStats = statsFromAttributes(attributeData);
  const weaponSetStats =
    attributeDataByWeaponSet?.length === 2
      ? attributeDataByWeaponSet.map(statsFromAttributes)
      : [fallbackStats, fallbackStats];
  const professionAssumptionControls = assumptionControlsForSpecialization(
    app.adapter?.assumptionControls || [],
    specialization
  );
  const calculatedWeaponSet = app.build.startingWeaponSet === 2 ? 2 : 1;
  const calculatedPrimaryWeapon =
    (calculatedWeaponSet === 2 ? app.build.alternateWeapons : app.build.weapons)?.[0] || '';

  return {
    patchId: app.patchId || 'current',
    patchValues: app.profession?.patchValuesFor?.(app.patchId || 'current') || Object.freeze({}),
    specialization,
    selectedTraits,
    selectedTraitIds: selectedTraitIds as readonly SkillId[],
    selectedSkills: app.adapter?.slotLoadout
      ? app.adapter.slotLoadout
          .selectedSkillIds({
            build: app.build,
            specialization,
            professionState: app.results?.endState?.profession,
            catalog: app.activeCatalog || app.profession.catalog
          })
          .map((id) => app.skillById.get(Number(id))?.name)
          .filter((name): name is string => name != null)
      : Object.values(app.build.selectedSkills),
    primaryWeapon: app.build.weapons[0],
    secondaryWeapon: app.build.weapons[1],
    weaponSet2Primary: app.build.alternateWeapons[0],
    weaponSet2Secondary: app.build.alternateWeapons[1],
    startingWeaponSet: app.build.startingWeaponSet === 2 ? 2 : 1,
    attributeProvenance: createAttributeProvenance({
      professionStaticRulesApplied: true,
      calculatedWeaponSet,
      calculatedPrimaryWeapon
    }),
    initialResource,
    playerHealthFraction: Math.max(0, Math.min(1, Number(assumptions.playerHealthPercent ?? 100) / 100)),
    deterministicChoices: Object.fromEntries(
      professionAssumptionControls
        .filter((control) => control.type === 'select' && !isSimulationRandomnessControl(control))
        .map((control) => [control.key, assumptions[control.key]])
    ),
    randomness: simulationRandomnessFromAssumptions(assumptions),
    professionAssumptions: Object.fromEntries(
      professionAssumptionControls.map((control) => [control.key, assumptions[control.key] ?? control.defaultValue])
    ),
    stats: weaponSetStats[calculatedWeaponSet - 1] || fallbackStats,
    weaponSetStats,
    sigilSets,
    relic: disabled?.type === 'Relic' ? '' : app.build.relic,
    food: disabled?.type === 'Food' ? '' : app.build.food,
    timeOfDay: assumptions.timeOfDay === 'night' ? 'night' : 'day',
    boons: {
      might: disabled?.type === 'Boon' && disabled.name === 'Might' ? 0 : Number(assumptions.might || 0),
      fury: disabled?.type === 'Boon' && disabled.name === 'Fury' ? false : Boolean(assumptions.fury),
      quickness: Boolean(assumptions.quickness),
      alacrity: Boolean(assumptions.alacrity),
      protection: Boolean(assumptions.protection),
      resolution: disabled?.type === 'Boon' && disabled.name === 'Resolution' ? false : Boolean(assumptions.resolution),
      regeneration: Boolean(assumptions.regeneration),
      swiftness: Boolean(assumptions.swiftness),
      vigor: Boolean(assumptions.vigor),
      aegis: Boolean(assumptions.aegis)
    },
    sharePlayerBoonsWithSummons: assumptions.sharePlayerBoonsWithSummons !== false,
    allies: {
      count: alliedPlayerCount,
      strikesPerSecond: 1
    },
    target: {
      armor: app.build.targetArmor,
      health: Math.max(0, Number(app.build.targetHealth) || 0),
      count: Math.max(1, Math.trunc(Number(assumptions.targetCount) || 1)),
      // Existing professions retain the historical defiant-golem default.
      // Defiant doubles as the positional proxy: a defiant golem never rotates,
      // so flanking/behind bonuses always apply and need no separate control.
      defiant: Boolean(assumptions.targetDefiant ?? true),
      distance: Math.max(0, Number(assumptions.targetDistance ?? 130)),
      conditions: targetConditions,
      moving: Boolean(assumptions.targetMoving),
      boonless: Boolean(assumptions.targetBoonless),
      nearby: true,
      activatingSkills: targetSkillActivationsPerSecond > 0,
      confusionActivationsPerSecond: targetSkillActivationsPerSecond
    }
  };
}
