import { derivedAttribute, PRIMARY_ATTRIBUTES } from '#gw2/platform/builds/attributes.js';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/state/boons.js';
import { resolveProfessionRuntime } from '#gw2/platform/engine/profession/family.js';
import { readProfessionCoreState, readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { attributeEffectControls, normalizeAttributePreview } from '#gw2/app/build/attribute-effects.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import type { Gw2TimedBuffApplication } from '#gw2/platform/combat/state/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

/** Query isolated conditional attributes; no preview inputs enter the saved build or simulation results. */
export function calculateBuffedAttributes(
  app: ProfessionAppState,
  input: Readonly<Record<string, unknown>> = {}
): NonNullable<ProfessionAppState['attributeData']> {
  const controls = attributeEffectControls(app);
  const values = normalizeAttributePreview(controls, input);
  const boons = Object.fromEntries(
    GW2_STANDARD_BOONS.map((key) => [key, key === 'might' ? Number(values[key] || 0) : Boolean(values[key])])
  );
  const playerHealth = Number(values.playerHealth ?? 100) / 100;
  const preview = {
    ...app,
    build: {
      ...structuredClone(app.build),
      startingWeaponSet: app.attributeWeaponSet,
      assumptions: {
        ...app.build.assumptions,
        ...boons,
        playerHealthPercent: playerHealth * 100,
        playerHealthFraction: playerHealth
      }
    },
    results: null
  } as ProfessionAppState;
  // Removing a disabled passive before recalculation also updates conversions that use the passive's attributes.
  for (const control of controls) {
    if (control.kind !== 'passive' || values[control.key]) continue;
    for (const [slot, name] of Object.entries(preview.build.selectedSkills)) {
      if (name === control.field) preview.build.selectedSkills[slot] = '';
    }
  }

  app.adapter.recalculate(preview);
  const data = structuredClone(preview.attributeData!);
  const config = app.adapter.simulationConfig(preview);
  const weaponSet = app.attributeWeaponSet === 2 ? 2 : 1;
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
    playerHealthFraction: playerHealth,
    targetHealthFraction: targetHealth,
    target: {
      ...config.target,
      health: 100,
      startingHealthFraction: targetHealth,
      defiant: Boolean(values.flanking),
      disabled: Boolean(values.controlled),
      controlled: Boolean(values.controlled),
      boonless: Boolean(values.boonless),
      conditions: targetConditions
    }
  };
  const profession = resolveProfessionRuntime(app.profession, queryConfig);
  const professionState = profession.createProfessionState(queryConfig);
  const core = readProfessionCoreState(professionState);
  // Opening Strike is a single-hit bonus and is excluded from the attribute preview.
  if ('playerOpeningStrikeReady' in core) core.playerOpeningStrikeReady = false;
  const specialization = app.adapter.eliteSpecialization(preview.build);
  const spec = readProfessionSpecializationState(professionState, specialization) || {};
  const events: SimulationEvent[] = [];
  const liveBoons = new Map<string, Gw2TimedBuffApplication[]>();
  const event: SimulationEvent = {
    type: 'action',
    at: 1,
    actorType: 'player',
    source: 'Player',
    sourceId: 'stat-preview',
    ...(values.conjure && values.conjure !== 'None' ? { skillWeapon: values.conjure } : {})
  };
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
    liveBoons.set(kind, [application]);
    // Preview events obey the same explicit player-ownership contract as simulated buffs.
    events.push({ ...application, type: 'buff', kind, source: name, sourceId: 'stat-preview', actorType: 'player' });
  };

  // A one-second sample avoids treating default zero-valued expiry timers as newly expired buffs.
  for (const control of controls) {
    const value = values[control.key];
    const count = Number(value) || 0;
    const field = control.field || control.key;
    if (control.kind === 'buff') addBuff(field, count, control.label);
    if (control.kind === 'coreTimer') core[field] = count ? 60 : 0;
    if (control.kind === 'specTimer') spec[field] = count ? 60 : 0;
    if (control.kind === 'coreStacks') core[field] = Array(count).fill(60);
    if (control.kind === 'specStacks') spec[field] = Array(count).fill(60);
    if (control.kind === 'specFlag') spec[field] = Boolean(count);
    if (control.kind === 'condition') targetConditions[field] = count;
  }

  // Anonymous types count for Target the Weak without activating separate condition-specific traits.
  for (let index = 0; index < Number(values.targetTheWeak || 0); index++) {
    targetConditions[`preview-condition-${index}`] = 1;
  }

  if ('attunement' in values) core.primaryAttunement = values.attunement;
  if ('secondaryAttunement' in values) spec.secondaryAttunement = values.secondaryAttunement;
  if ('evokerElement' in values) queryConfig.evokerElement = values.evokerElement;
  if ('shroud' in values)
    core.activeShroud = values.shroud
      ? ['Reaper', 'Harbinger', 'Ritualist'].includes(specialization)
        ? specialization.toLowerCase()
        : 'death'
      : '';
  if ('fullEndurance' in values) core.endurance = values.fullEndurance ? Number(core.maximumEndurance || 100) : 0;
  for (let index = 0; index < Number(values.instruments || 0); index++) {
    events.push({
      type: 'mesmer.instrument',
      at: 0,
      expiresAt: 60,
      instrument: ['Lute', 'Flute', 'Harp', 'Drum'][index],
      source: 'Fortissimo',
      actorType: 'player',
      sourceId: 'stat-preview'
    });
  }

  const query = createGw2CombatQuery({ profession, config: queryConfig, events });
  const runtime = { profession: professionState, activeWeaponSet: weaponSet, boons: liveBoons, combatStartTime: 0 };
  const stats = query.statsAt(1, event, runtime);
  const critical = query.critical(event, 1, runtime);
  const set = (name: string, final: number): void => {
    const original = data.attributes[name] || derivedAttribute(0);
    data.attributes[name] = Object.assign({}, original, { final, conditional: final - original.final });
  };

  for (const name of PRIMARY_ATTRIBUTES) {
    set(name, Number(stats[name[0].toLowerCase() + name.slice(1).replaceAll(' ', '')]));
  }

  set('Critical Chance', (critical.chanceBeforeCap ?? critical.chance) * 100);
  set('Critical Damage', critical.damage * 100);
  set('Condition Duration', data.attributes['Condition Duration'].final + (stats.expertise - primaries.expertise) / 15);
  set('Boon Duration', data.attributes['Boon Duration'].final + (stats.concentration - primaries.concentration) / 15);
  if (values.conjure === 'Frost Bow') {
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
