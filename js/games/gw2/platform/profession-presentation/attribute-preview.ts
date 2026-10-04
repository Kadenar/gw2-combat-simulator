import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export type AttributePreviewValues = Record<string, number | string>;

/** The isolated panels a preview control can drive; each panel keeps its own values. */
export type PreviewControlScope = 'attributes' | 'damage';

/** Controls describe isolated preview inputs; private runtime fields are prepared by their profession owner. */
export interface PreviewControl {
  key: string;
  label: string;
  group: string;
  description: string;
  kind: 'boon' | 'buff' | 'condition' | 'queryTrait' | 'passive' | 'special';
  field?: string;
  /** Lowest accepted value; numeric controls default to 0. */
  min?: number;
  max?: number;
  options?: readonly string[];
  initial?: number | string;
  /**
   * Panels this control appears in. Omitted means both, except `special` controls, which default to the Attribute
   * Preview because only their owner knows how to apply them to a simulation.
   */
  scope?: readonly PreviewControlScope[];
}

/** Resolves a control's panels, so both previews apply the same default rule. */
export function previewControlScopes(control: Pick<PreviewControl, 'kind' | 'scope'>): readonly PreviewControlScope[] {
  return control.scope ?? (control.kind === 'special' ? ['attributes'] : ['attributes', 'damage']);
}

export interface ProfessionAttributePreviewContext {
  readonly build: Readonly<Gw2CanonicalBuild>;
  readonly specialization: string;
  readonly catalog: Readonly<CanonicalCatalog>;
  readonly activeTraits: readonly { readonly id: SkillId; readonly name: string }[];
  readonly weapons: readonly string[];
}

export interface ProfessionAttributePreviewInput extends ProfessionAttributePreviewContext {
  readonly values: Readonly<AttributePreviewValues>;
}

/** Only detached query inputs may be mutated here; no saved build or live simulation state is supplied. */
export interface ProfessionAttributePreviewPreparation extends ProfessionAttributePreviewInput {
  readonly config: Gw2Config;
  readonly professionState: unknown;
  readonly events: SimulationEvent[];
  readonly targetConditions: Record<string, number>;
  readonly queryOptions: { conditionDurations: boolean; skillWeapon?: string };
}
