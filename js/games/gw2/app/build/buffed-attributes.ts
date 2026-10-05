import type {
  ProfessionAttributePreviewPreparation,
  PreviewControl
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createSkillDamagePreview } from '#gw2/app/build/skill-damage/preview.js';
import { queryDamagePreview } from '#gw2/platform/skill-damage/preview-state.js';
import type { Gw2ModifierContribution } from '#gw2/platform/combat/modifiers.js';
import { derivedAttribute, PRIMARY_ATTRIBUTES } from '#gw2/platform/builds/attributes.js';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import { createRelicRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import { relicConditionDurationBonus } from '#gw2/platform/equipment/relics/query.js';
import { resolveProfessionContract } from '#gw2/platform/profession-definition/compiler/compile-contract.js';
import { attributeEffectControls, normalizeAttributePreview } from '#gw2/app/build/attribute-effects.js';
import { createIsolatedPreview } from '#gw2/app/build/isolated-preview.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { Gw2TimedBuffApplication } from '#gw2/platform/combat/boons.js';
import type { Gw2NumericStatKey } from '#gw2/platform/combat/query/combat-query.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

/** Query isolated conditional attributes; no preview inputs enter the saved build or simulation results. */
export function calculateBuffedAttributes(
  app: ProfessionAppState,
  input: Readonly<Record<string, unknown>> = {}
): NonNullable<ProfessionAppState['attributeData']> {
  return calculatePreview(app, input, attributeEffectControls(app));
}

/** The damage strip queries the same prepared runtime as its rows, at full player health and without a skill override. */
export function calculateSkillDamageAttributes(
  app: ProfessionAppState,
  input: Readonly<Record<string, unknown>>,
  controls: readonly PreviewControl[]
) {
  const { preview, config, inputs } = createSkillDamagePreview(app, controls, input);
  const attributes = structuredClone(preview.attributeData!.attributes);
  return queryDamagePreview(app.profession, config, inputs, (runtime) => {
    const at = runtime.time;
    const event: SimulationEvent = {
      type: 'action',
      at,
      actorType: 'player',
      source: 'Player',
      sourceId: 'stat-preview'
    };
    const query = runtime.query;
    const stats = query.statsAt(at, event, runtime);
    const critical = query.critical(event, at, runtime);
    const set = (name: string, final: number): void => {
      const original = attributes[name] || derivedAttribute(0);
      attributes[name] = Object.assign({}, original, { final, conditional: final - original.final });
    };

    for (const name of PRIMARY_ATTRIBUTES)
      set(name, Number(stats[(name[0].toLowerCase() + name.slice(1).replaceAll(' ', '')) as Gw2NumericStatKey]));
    set('Critical Chance', (critical.chanceBeforeCap ?? critical.chance) * 100);
    set('Critical Damage', critical.damage * 100);
    set(
      'Boon Duration',
      attributes['Boon Duration'].final +
        (stats.concentration - preview.attributeData!.attributes.Concentration.final) / 15
    );
    set('Condition Duration', (query.conditionDurationMultiplier('', at, stats, event, runtime) - 1) * 100);
    for (const name of ['Burning', 'Bleeding', 'Torment', 'Confusion', 'Poison'])
      set(
        name + ' Duration',
        (query.conditionDurationMultiplier(name === 'Poison' ? 'Poisoned' : name, at, stats, event, runtime) - 1) * 100
      );
    // The strip reports generic player factors; occurrence diagnostics retain skill-specific modifiers.
    const contributors: Gw2ModifierContribution[] = [];
    set('Strike Multiplier', query.strikeMultiplier(event, at, runtime, contributors));
    set('Condition Multiplier', query.conditionMultiplier('', at, event, runtime, undefined, contributors));
    set('Target Armor', Number(config.target?.armor) || 2597);
    return {
      attributes,
      alwaysApplied: [...new Set(contributors.filter((entry) => entry.unconditional).map((entry) => entry.label))]
    };
  });
}

function calculatePreview(
  app: ProfessionAppState,
  input: Readonly<Record<string, unknown>>,
  controls: readonly PreviewControl[]
) {
  const values = normalizeAttributePreview(controls, input);
  const playerHealth = Number(values.playerHealth ?? 100) / 100;
  const boons = Object.fromEntries(
    GW2_STANDARD_BOONS.map((key) => [key, key === 'might' ? Number(values[key] || 0) : Boolean(values[key])])
  );
  const weaponSet = app.attributeWeaponSet === 2 ? 2 : 1;
  const { preview, context, config } = createIsolatedPreview(app, controls, values, boons, weaponSet);
  const data = structuredClone(preview.attributeData!);
  // Supply defensive primaries omitted by the damage configuration so all-attribute effects preserve them.
  const primaries = Object.fromEntries(
    PRIMARY_ATTRIBUTES.map((name) => [
      name[0].toLowerCase() + name.slice(1).replaceAll(' ', ''),
      data.attributes[name].final
    ])
  );
  const activeStats = { ...config.weaponSetStats?.[weaponSet - 1], ...primaries };
  const disabledTraits = new Set(
    controls
      .filter((control) => control.kind === 'queryTrait' && !values[control.key])
      .map((control) => app.attributeData!.activeTraits.find((trait) => trait.name === control.field)?.id)
  );
  const targetHealth = Number(values.targetHealth ?? 100) / 100;
  const targetConditions: Record<string, number> = {};
  const queryConfig: Gw2Config = {
    ...config,
    startingWeaponSet: weaponSet,
    stats: { ...config.stats, ...activeStats },
    weaponSetStats: [activeStats, activeStats],
    boons,
    selectedTraitIds: config.selectedTraitIds?.filter((id) => !disabledTraits.has(id)),
    target: {
      ...config.target,
      health: 100,
      startingHealthFraction: targetHealth,
      defiant: Boolean(values.defiant ?? values.flanking),
      conditions: targetConditions
    }
  };
  const profession = resolveProfessionContract(app.profession, queryConfig);
  const professionState = profession.createState(queryConfig);
  const events: SimulationEvent[] = [];
  const previewBoons = new Map<string, Gw2TimedBuffApplication[]>();
  const addBuff = (kind: string, stacks: number, name: string): void => {
    if (!stacks) return;
    const application = {
      at: 0,
      duration: 60,
      expiresAt: 60,
      stacks,
      resolvedAudience: {
        includesSelf: true,
        includesSummons: false,
        alliedPlayerCount: 0,
        companionIds: [],
        recipientCount: 1
      }
    };
    previewBoons.set(kind, [application]);
    // Preview events obey the same explicit player-ownership contract as simulated buffs.
    events.push({ ...application, type: 'buff', kind, source: name, sourceId: 'stat-preview', actorType: 'player' });
  };

  // A one-second sample avoids treating default zero-valued expiry timers as newly expired buffs.
  for (const control of controls) {
    const value = values[control.key];
    const count = Number(value) || 0;
    const field = control.field || control.key;
    if (control.kind === 'buff') addBuff(field, count, control.label);
    if (control.kind === 'condition') targetConditions[field] = count;
  }

  const queryOptions: ProfessionAttributePreviewPreparation['queryOptions'] = { conditionDurations: false };
  app.profession.ui.prepareAttributePreview({
    ...context,
    config: queryConfig,
    professionState,
    events,
    targetConditions,
    queryOptions
  });

  const event: SimulationEvent = {
    type: 'action',
    at: 1,
    actorType: 'player',
    source: 'Player',
    sourceId: 'stat-preview',
    skillWeapon: queryOptions.skillWeapon
  };
  const query = createGw2CombatQuery({
    profession,
    config: queryConfig,
    events,
    attributePreviewPlayerHealthFraction: playerHealth
  });
  // Seed an isolated active stack window so both displayed and conjure durations use the relic's combat formula.
  const relic = values.aristocracy ? createRelicRuntime('Aristocracy') : undefined;
  if (relic) relic.state.activations = [{ at: 0, expiresAt: 60, stacks: Number(values.aristocracy) }];
  const runtime = {
    profession: professionState,
    activeWeaponSet: weaponSet,
    boons: previewBoons,
    combatStartTime: 0,
    relic
  };
  const stats = query.statsAt(1, event, runtime);
  const critical = query.critical(event, 1, runtime);
  const set = (name: string, final: number): void => {
    const original = data.attributes[name] || derivedAttribute(0);
    data.attributes[name] = Object.assign({}, original, { final, conditional: final - original.final });
  };

  for (const name of PRIMARY_ATTRIBUTES) {
    set(name, Number(stats[(name[0].toLowerCase() + name.slice(1).replaceAll(' ', '')) as Gw2NumericStatKey]));
  }

  set('Critical Chance', (critical.chanceBeforeCap ?? critical.chance) * 100);
  set('Critical Damage', critical.damage * 100);
  set(
    'Condition Duration',
    data.attributes['Condition Duration'].final +
      (stats.expertise - primaries.expertise) / 15 +
      relicConditionDurationBonus(runtime, 1) * 100
  );
  set('Boon Duration', data.attributes['Boon Duration'].final + (stats.concentration - primaries.concentration) / 15);
  if (queryOptions.conditionDurations) {
    const duration = (query.conditionDurationMultiplier('', 1, stats, event, runtime) - 1) * 100;
    set('Condition Duration', duration);
    for (const name of ['Burning', 'Bleeding', 'Torment', 'Confusion', 'Poison'])
      set(
        `${name} Duration`,
        (query.conditionDurationMultiplier(name === 'Poison' ? 'Poisoned' : name, 1, stats, event, runtime) - 1) * 100 -
          duration
      );
  }

  return data;
}
