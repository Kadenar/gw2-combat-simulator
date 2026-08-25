/** Owns the simulation/config.d.ts contracts so type dependencies follow their runtime feature boundaries. */
import type { SchedulerRecord, SimulationRandomnessConfig } from '../../engine/types.js';
import type { Gw2AttributeProvenance } from '../builds/types.js';
import type { Gw2TargetConfig } from '../combat/state/types.js';
import type { Gw2SigilSet, Gw2Stats } from '../equipment/types.js';

export interface Gw2Config extends SchedulerRecord {
  readonly patchId?: string;
  readonly patchValues?: Readonly<Record<string, import('../authoring/patch-types.js').NumEdit>>;
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
  readonly traitIds?: readonly (string | number)[];
  readonly selectedTraitIds?: readonly (string | number)[];
  readonly selectedTraits?: readonly (string | number)[];
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
