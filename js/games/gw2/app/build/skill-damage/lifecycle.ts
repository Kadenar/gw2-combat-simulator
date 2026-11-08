/** Prepares isolated damage inputs and accepts matching results without reading browser state. */
import { normalizeAttributePreview } from '#gw2/app/build/attribute-preview-controls.js';
import { calculateSkillDamageAttributes } from '#gw2/app/build/skill-damage/attributes.js';
import type { SkillDamageInput } from '#gw2/app/build/skill-damage/input.js';
import {
  clearedValues,
  createSkillDamagePlan,
  simulationConfigValues,
  skillDamageControls,
  type SkillDamagePlan
} from '#gw2/app/build/skill-damage/plan.js';
import type { SkillDamageListener, SkillDamageRunner } from '#gw2/app/build/skill-damage/runner.js';
import type { Gw2AttributeMap } from '#gw2/platform/attributes/types.js';
import type {
  AttributePreviewValues,
  PreviewControl
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type { SkillDamageEvaluation } from '#gw2/platform/skill-damage/types.js';

export interface SkillDamagePreparation {
  readonly controls: readonly PreviewControl[];
  readonly values: AttributePreviewValues;
  readonly stats: { readonly current: Gw2AttributeMap; readonly baseline: Gw2AttributeMap } | null;
  readonly statsError: string;
}

export interface SkillDamagePreviewState {
  readonly open: boolean;
  readonly preparation: SkillDamagePreparation | null;
  readonly plan: SkillDamagePlan | null;
  readonly evaluation: {
    readonly signature: string;
    readonly result: SkillDamageEvaluation;
    readonly plan: SkillDamagePlan;
  } | null;
  readonly error: string;
}

/** Tells the panel whether controls, values or measurements changed. */
export type SkillDamageChange = 'inputs' | 'values' | 'measurement';

interface SkillDamageLifecycleOptions {
  readonly open: boolean;
  readonly createRunner: (
    receive: SkillDamageListener
  ) => Pick<SkillDamageRunner, 'schedule' | 'cancel' | 'discardQueued'>;
  readonly changed: (change: SkillDamageChange) => void;
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

type CaptureSkillDamageInput = () => SkillDamageInput | null;

type BaselineStats = { readonly attributes: Gw2AttributeMap } | { readonly error: string };

interface PreparationCache {
  readonly input: SkillDamageInput;
  readonly signature: string;
  readonly baseline: BaselineStats | null;
}

/** Rotation does not affect isolated damage. Patch keys identify balance choices without serializing catalogs. */
function preparationSignature(input: SkillDamageInput): string {
  return JSON.stringify({
    gameId: input.gameId,
    contentId: input.contentId,
    build: { ...input.build, rotation: undefined },
    patch: input.patch.key,
    transitionDelays: input.simulationSettings?.transitionDelays,
    activeTraitIds: input.attributeData?.activeTraits.map((trait) => trait.id)
  });
}

/** Keeps preview choices and the last completed result across build tabs and closing the panel. */
export class SkillDamageLifecycle {
  private current: SkillDamagePreviewState;
  private cache: PreparationCache | null = null;
  private failedSignature: string | null = null;
  private readonly runner: ReturnType<SkillDamageLifecycleOptions['createRunner']>;
  private readonly changed: SkillDamageLifecycleOptions['changed'];

  constructor({ open, createRunner, changed }: SkillDamageLifecycleOptions) {
    this.current = { open, preparation: null, plan: null, evaluation: null, error: '' };
    this.changed = changed;
    this.runner = createRunner((signature, result, error) => this.receive(signature, result, error));
  }

  get state(): SkillDamagePreviewState {
    return this.current;
  }

  /** Read calculation inputs only while the preview is open. */
  refresh(captureInput: CaptureSkillDamageInput): void {
    if (!this.current.open) {
      this.runner.cancel();
      this.changed('inputs');
      return;
    }

    const input = captureInput();

    if (!input) return;

    this.prepare(input);
    this.publish('inputs');
  }

  /** Closing cancels work without reading the build; reopening retains choices and completed results. */
  setOpen(captureInput: CaptureSkillDamageInput, open: boolean): void {
    if (this.current.open === open) return;

    if (open) {
      const input = captureInput();

      if (!input) return;

      this.prepare(input);
    }

    this.current = { ...this.current, open };

    if (open) this.publish('inputs');
    else {
      this.runner.cancel();
      this.changed('inputs');
    }
  }

  /** Ignore equivalent input and blur events before copying the build or running calculations. */
  setValues(captureInput: CaptureSkillDamageInput, raw: Readonly<Record<string, unknown>>): void {
    const preparation = this.current.preparation;

    if (!this.current.open || !preparation) return;

    const values = normalizeAttributePreview(preparation.controls, raw);

    if (JSON.stringify(values) === JSON.stringify(preparation.values)) return;

    const input = captureInput();

    if (!input) return;

    this.prepare(input, values);
    this.publish('values');
  }

  /** Explicit reset actions replace preview choices with saved assumptions or cleared controls. */
  resetValues(captureInput: CaptureSkillDamageInput, source: 'saved' | 'clear'): void {
    const preparation = this.current.preparation;

    if (!this.current.open || !preparation) return;

    const input = captureInput();

    if (!input) return;

    const values =
      source === 'saved' ? simulationConfigValues(input, preparation.controls) : clearedValues(preparation.controls);
    this.prepare(input, values);
    this.publish('inputs');
  }

  private prepare(input: SkillDamageInput, requestedValues = this.current.preparation?.values ?? null): void {
    const signature = preparationSignature(input);
    const previous = this.cache;
    const sameInput =
      previous &&
      previous.signature === signature &&
      previous.input.adapter === input.adapter &&
      previous.input.profession === input.profession &&
      previous.input.activeCatalog === input.activeCatalog &&
      previous.input.weaponData === input.weaponData;
    const preparation = this.current.preparation;

    if (sameInput && JSON.stringify(requestedValues) === JSON.stringify(preparation!.values)) return;

    // Keep the previous state if control discovery or normalization throws.
    const controls = sameInput ? preparation!.controls : skillDamageControls(input);
    const values = normalizeAttributePreview(controls, requestedValues ?? simulationConfigValues(input, controls));
    let plan: SkillDamagePlan | null = null;
    let error = '';
    try {
      plan = createSkillDamagePlan(input, controls, values);
    } catch (failure) {
      this.runner.cancel();
      error = errorMessage(failure);
    }

    let stats: SkillDamagePreparation['stats'] = null;
    let statsError = '';
    let baseline = sameInput ? previous.baseline : null;

    if (plan) {
      try {
        const current = calculateSkillDamageAttributes(input, values, controls).attributes;

        // Cleared attributes depend on the build and available controls, not the selected preview values.
        if (!baseline) {
          try {
            baseline = {
              attributes: calculateSkillDamageAttributes(input, clearedValues(controls), controls).attributes
            };
          } catch (failure) {
            baseline = { error: errorMessage(failure) };
          }
        }

        if ('error' in baseline) statsError = baseline.error;
        else stats = { current, baseline: baseline.attributes };
      } catch (failure) {
        statsError = errorMessage(failure);
      }
    }

    this.cache = { input, signature, baseline };
    this.failedSignature = null;
    this.current = {
      ...this.current,
      plan,
      error,
      preparation: { controls, values, stats, statsError }
    };
  }

  /** Notify the panel before submitting work, so synchronous completion sees prepared state. */
  private publish(change: SkillDamageChange): void {
    const plan = this.current.plan;
    const completed = plan && this.current.evaluation?.signature === plan.signature;
    const requested = plan && !completed && this.failedSignature !== plan.signature;

    if (requested) this.current = { ...this.current, error: '' };

    this.changed(change);

    // A listener may close the preview or replace its plan before work starts.
    if (!this.current.open || this.current.plan !== plan) return;

    if (completed) this.runner.discardQueued();
    else if (requested) this.runner.schedule(plan);
  }

  /** Accept matching results only while open, and retain the plan that supplied their labels. */
  private receive(signature: string, result: SkillDamageEvaluation | null, error: string): void {
    const plan = this.current.plan;

    if (!this.current.open || plan?.signature !== signature) return;

    this.failedSignature = error ? signature : null;
    this.current = {
      ...this.current,
      error,
      evaluation: result ? { signature, result, plan } : this.current.evaluation
    };
    this.changed('measurement');
  }
}
