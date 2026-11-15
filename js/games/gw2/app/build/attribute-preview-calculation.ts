/** Calculates isolated conditional attributes from preview inputs without changing the saved build. */
import { attributePreviewControls, normalizeAttributePreview } from '#gw2/app/build/attribute-preview-controls.js';
import { createIsolatedPreview } from '#gw2/app/build/isolated-preview.js';
import type { AttributePreviewState } from '#gw2/app/build/types.js';
import { derivedAttribute } from '#gw2/platform/attributes/calculation.js';
import { ATTRIBUTE_KEYS, CONDITION_DURATION_KEYS } from '#gw2/platform/attributes/inputs.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import { createLiveEffects } from '#gw2/platform/combat/live-effects.js';
import { ACTOR, BOON } from '#gw2/platform/constants.js';
import { relicConditionDurationBonus } from '#gw2/platform/equipment/relics/query.js';
import { createAristocracyPreviewQueries } from '#gw2/platform/equipment/relics/runtime.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { resolveProfessionContract } from '#gw2/platform/profession-definition/compile-contract.js';
import type {
  PreviewControl,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

/** Query isolated conditional attributes; no preview inputs enter the saved build or simulation results. */
export function calculateAttributePreview(
  app: AttributePreviewState,
  input: Readonly<Record<string, unknown>> = {}
): NonNullable<AttributePreviewState['attributeData']> {
  return calculatePreview(app, input, attributePreviewControls(app));
}

function calculatePreview(
  app: AttributePreviewState,
  input: Readonly<Record<string, unknown>>,
  controls: readonly PreviewControl[]
) {
  const values = normalizeAttributePreview(controls, input);
  const playerHealth = Number(values.playerHealth ?? 100) / 100;
  const boons = Object.fromEntries(
    GW2_STANDARD_BOONS.map((key) => [key, key === BOON.MIGHT ? Number(values[key] || 0) : Boolean(values[key])])
  );
  const weaponSet = app.attributeWeaponSet === 2 ? 2 : 1;
  const { preview, context, config } = createIsolatedPreview(app, controls, values, boons, weaponSet);
  const data = structuredClone(preview.attributeData!);
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
  const addBuff = (kind: string, stacks: number, name: string): void => {
    if (!stacks) return;

    // Author one detached grant; its application is derived after profession preparation finishes.
    events.push({
      type: 'buff',
      kind,
      source: name,
      sourceId: 'stat-preview',
      actorType: ACTOR.PLAYER,
      at: 0,
      duration: 60,
      stacks,
      resolvedAudience: {
        includesSelf: true,
        includesSummons: false,
        alliedPlayerCount: 0,
        companionIds: [],
        recipientCount: 1
      }
    });
  };

  // A one-second sample avoids treating default zero-valued expiry timers as newly expired buffs.
  for (const control of controls) {
    const value = values[control.key];
    const count = Number(value) || 0;
    const field = control.field || control.key;

    if (control.kind === 'buff') addBuff(field, count, control.label);

    if (control.kind === 'condition') targetConditions[field] = count;

    // Share anonymous condition-count inputs with damage previews while keeping named conditions independent.
    if (control.kind === 'conditionCount')
      for (let index = 0; index < count; index++) targetConditions[`preview-condition-${index}`] = 1;
  }

  const queryOptions: ProfessionAttributePreviewPreparation['queryOptions'] = { conditionDurations: false };
  const previewCooldowns = new Set<SkillId>();
  app.profession.ui.prepareAttributePreview({
    ...context,
    config: queryConfig,
    professionState,
    events,
    addBuff,
    setSkillOnCooldown: (skillId) => {
      previewCooldowns.add(skillId);
    },
    targetConditions,
    queryOptions
  });

  const liveEffects = createLiveEffects(queryConfig);
  // Preview assumptions replace earlier grants; only the final prepared packet of each kind enters the controller.
  const grants = new Map<string, SimulationEvent>();
  for (const event of events) if (event.type === 'buff') grants.set((event.kind || '').toLowerCase(), event);
  for (const event of grants.values()) liveEffects.grant(event);

  const event: SimulationEvent = {
    type: 'action',
    at: 1,
    actorType: ACTOR.PLAYER,
    source: 'Player',
    sourceId: 'stat-preview',
    skillWeapon: queryOptions.skillWeapon
  };
  const query = createGw2CombatQuery({
    profession,
    config: queryConfig,
    events,
    // Owner-selected recharge states suppress passives without executing a cast or altering the saved build.
    skillOnCooldown: (skillId) => previewCooldowns.has(skillId),
    attributePreviewPlayerHealthFraction: playerHealth
  });
  // Seed an isolated active stack window so both displayed and conjure durations use the relic's combat formula.
  const relic = values.aristocracy ? createAristocracyPreviewQueries(Number(values.aristocracy)) : undefined;

  const runtime = {
    profession: professionState,
    activeWeaponSet: weaponSet,
    liveEffects,
    engagement: { startTime: 0 },
    relic
  };
  const stats = query.statsAt(1, event, runtime);
  const critical = query.critical(event, 1, runtime, stats);
  const set = (name: string, final: number): void => {
    const original = data.attributes[name] || derivedAttribute(0);
    data.attributes[name] = Object.assign({}, original, { final, conditional: final - original.final });
  };

  for (const [name, key] of Object.entries(ATTRIBUTE_KEYS)) set(name, stats[key]);

  set('Critical Chance', (critical.chanceBeforeCap ?? critical.chance) * 100);
  set('Critical Damage', critical.damage * 100);
  set(
    'Condition Duration',
    data.attributes['Condition Duration'].final +
      (stats.expertise - preview.attributeData!.attributes.Expertise.final) / 15 +
      relicConditionDurationBonus(runtime, 1) * 100
  );
  set(
    'Boon Duration',
    data.attributes['Boon Duration'].final +
      (stats.concentration - preview.attributeData!.attributes.Concentration.final) / 15
  );

  if (queryOptions.conditionDurations) {
    const duration = (query.conditionDurationMultiplier('', 1, stats, event, runtime) - 1) * 100;
    set('Condition Duration', duration);
    for (const [name, condition] of Object.entries(CONDITION_DURATION_KEYS))
      set(name, (query.conditionDurationMultiplier(condition, 1, stats, event, runtime) - 1) * 100 - duration);
  }

  return data;
}
