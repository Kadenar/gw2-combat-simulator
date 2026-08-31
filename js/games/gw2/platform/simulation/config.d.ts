/** Owns the simulation/config.d.ts contracts so type dependencies follow their runtime feature boundaries. */
import type { SchedulerRecord, SimulationRandomnessConfig } from '#gw2/platform/engine/types.js';
import type { Gw2AttributeProvenance } from '#gw2/platform/builds/types.js';
import type { Gw2SelectedSkillLoadout } from '#gw2/platform/builds/selected-skills.js';
import type { Gw2TargetConfig } from '#gw2/platform/combat/state/types.js';
import type { Gw2SigilSet, Gw2Stats } from '#gw2/platform/equipment/types.js';

export interface Gw2Config extends SchedulerRecord {
  readonly patchId?: string;
  readonly patchValues?: Readonly<Record<string, import('#gw2/integrations/patches/authoring/patch-types.js').NumEdit>>;
  readonly stats?: Gw2Stats;
  readonly weaponSetStats?: readonly Gw2Stats[];
  readonly attributes?: Gw2Stats;
  readonly boons?: Readonly<Record<string, boolean | number>>;
  readonly sharePlayerBoonsWithSummons?: boolean;
  readonly startingWeaponSet?: number;
  readonly primaryWeapon?: string;
  readonly secondaryWeapon?: string;
  readonly weaponSet2Primary?: string;
  readonly weaponSet2Secondary?: string;
  readonly sigilSets?: readonly Gw2SigilSet[];
  readonly selectedTraitIds?: readonly (string | number)[];
  readonly selectedSkills?: Gw2SelectedSkillLoadout;
  readonly relic?: string;
  readonly food?: string;
  readonly timeOfDay?: 'day' | 'night';
  readonly randomness?: SimulationRandomnessConfig;
  readonly attributeProvenance?: Partial<Gw2AttributeProvenance>;
  readonly alacrityRechargeRate?: number;
  readonly target?: Gw2TargetConfig;
  readonly modifiers?: {
    readonly strike?: number;
    readonly condition?: number;
  };
}
