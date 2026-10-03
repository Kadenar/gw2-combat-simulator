import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export type AttributePreviewValues = Record<string, number | string>;

/** Controls describe isolated preview inputs; private runtime fields are prepared by their profession owner. */
export interface AttributeEffectControl {
  key: string;
  label: string;
  group: string;
  description: string;
  kind: 'boon' | 'buff' | 'condition' | 'queryTrait' | 'passive' | 'special';
  field?: string;
  max?: number;
  options?: readonly string[];
  initial?: number | string;
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
