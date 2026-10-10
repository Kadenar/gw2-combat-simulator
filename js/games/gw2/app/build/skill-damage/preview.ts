import { CANONICAL_TARGET_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import { createIsolatedPreview } from '#gw2/app/build/isolated-preview.js';
import { normalizeAttributePreview } from '#gw2/app/build/attribute-effects.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import type { PreviewControl } from '#gw2/platform/profession-presentation/attribute-preview.js';
import type { Gw2Config, Gw2InitialBuff } from '#gw2/platform/simulation/config.js';

const PREVIEW_BUFF_SECONDS = 3600;

/**
 * Builds the detached preview configuration: the saved build with this panel's boons, target conditions, held
 * buffs, and profession fields applied; deterministic runs average critical damage, and the target cannot die.
 */
export function createSkillDamagePreview(
  app: ProfessionAppState,
  controls: readonly PreviewControl[],
  input: Readonly<Record<string, unknown>>
) {
  const values = normalizeAttributePreview(controls, input);
  const boons = Object.fromEntries(
    GW2_STANDARD_BOONS.map((kind) => [kind, kind === 'might' ? Number(values[kind] || 0) : Boolean(values[kind])])
  );
  const isolated = createIsolatedPreview(
    app,
    controls,
    values,
    boons,
    Number(app.build.startingWeaponSet) === 2 ? 2 : 1
  );
  const { config, context } = isolated;
  // Only this panel's explicit values become assumptions; hidden saved conditions cannot leak into Clear buffs.
  const conditions: Record<string, unknown> = {};
  for (const control of controls) {
    if (control.kind !== 'condition') continue;
    const stacks = Number(values[control.key]) || 0;
    if (stacks > 0) conditions[control.field ?? control.key] = control.max ? stacks : true;
    else delete conditions[control.field ?? control.key];
  }

  // Anonymous types exercise count bonuses without activating named effects or exceeding the condition cap.
  for (const control of controls.filter((control) => control.kind === 'conditionCount')) {
    const count = Math.min(
      Number(values[control.key]),
      CANONICAL_TARGET_CONDITIONS.length - Object.keys(conditions).length
    );
    for (let index = 0; index < count; index++) conditions[`preview-condition-${index}`] = true;
  }

  const disabledTraitIds = new Set(
    controls
      .filter((control) => control.kind === 'queryTrait' && !values[control.key])
      .map((control) => context.activeTraits.find((trait) => trait.name === control.field)?.id)
  );
  const initialBuffs: Gw2InitialBuff[] = controls
    .filter((control) => control.kind === 'buff' && Number(values[control.key]) > 0)
    .map((control) => ({
      kind: control.field || control.key,
      stacks: Number(values[control.key]),
      duration: PREVIEW_BUFF_SECONDS,
      name: control.label
    }));
  const targetHealth = values.targetHealth == null ? null : Number(values.targetHealth) / 100;
  const patch = app.profession.ui.prepareSkillDamagePreview(context);
  const queryConfig: Gw2Config = {
    ...config,
    ...patch,
    // Explicit preview toggles take precedence over boons enforced by normal simulation configuration.
    boons: {
      ...config.boons,
      ...Object.fromEntries(
        controls.filter((control) => control.kind === 'boon').map((control) => [control.key, boons[control.key]])
      )
    },
    randomness: { ...config.randomness, mode: 'deterministic' } as Gw2Config['randomness'],
    criticalDamageMode: 'averaged',
    fixedBoonCount: Number(values.boonCount) || 0,
    ...(values.thornsStacks == null ? {} : { initialThornsStacks: Number(values.thornsStacks) }),
    selectedTraitIds: config.selectedTraitIds?.filter((id) => !disabledTraitIds.has(id)),
    // Owners may expand a single control into several native buff windows, such as Perfect Weave.
    initialBuffs: [...((patch.initialBuffs ?? []) as readonly Gw2InitialBuff[]), ...initialBuffs],
    target: {
      ...config.target,
      // An unbounded target keeps every occurrence on the supported target-health path without dying mid-measurement.
      health: 0,
      fixedHealthFraction: targetHealth ?? config.target?.startingHealthFraction ?? 1,
      ...(targetHealth == null ? {} : { startingHealthFraction: targetHealth }),
      ...(values.targetMoving == null ? {} : { moving: Boolean(values.targetMoving) }),
      conditions: conditions as NonNullable<Gw2Config['target']>['conditions']
    }
  };
  return { ...isolated, config: queryConfig, inputs: values };
}
