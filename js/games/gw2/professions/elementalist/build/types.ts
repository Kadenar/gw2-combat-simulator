import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { Gw2ApplicationBuild, Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export interface ElementalistBuildSpecialization {
  name: string;
  traits: string;
}

export interface CatalystEmpowermentPool {
  readonly power: number;
  readonly precision: number;
  readonly ferocity: number;
  readonly conditionDamage: number;
  readonly expertise: number;
  readonly concentration: number;
}

export interface ElementalistCanonicalBuild extends Gw2CanonicalBuild {
  profession: 'elementalist';
  assumptions: SchedulerRecord;
  startAttunement: string;
  secondaryAttunement: string;
  initialCatalystEnergy: number;
  evokerElement: string;
  initialEvokerCharges: number;
  initialEvokerEmpowered: number;
  pistolBullets: Record<'Fire' | 'Water' | 'Air' | 'Earth', boolean>;
}

export interface ElementalistConfig extends Gw2Config {
  readonly specialization?: string;
  readonly startAttunement?: string;
  readonly secondaryAttunement?: string;
  readonly initialCatalystEnergy?: number;
  readonly evokerElement?: string;
  readonly initialEvokerCharges?: number;
  readonly initialEvokerEmpowered?: number;
  readonly pistolBullets?: Readonly<Partial<Record<'Fire' | 'Water' | 'Air' | 'Earth', boolean>>>;
}

export interface ElementalistApplicationBuild extends Gw2ApplicationBuild {
  startAttunement: string;
  secondaryAttunement: string;
  initialCatalystEnergy: number;
  evokerElement: string;
  initialEvokerCharges: number;
  initialEvokerEmpowered: number;
  pistolBullets: Record<'Fire' | 'Water' | 'Air' | 'Earth', boolean>;
}
