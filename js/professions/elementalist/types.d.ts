import type { SchedulerRecord } from "../../platform/engine/types.js";
import type { Gw2Build, Gw2CanonicalBuild } from "../../platform/gw2/types.js";
import type { ProfessionApplicationBuild } from "../../app/profession/types.js";

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

export interface ElementalistTrait extends SchedulerRecord {
  readonly tier: string;
  readonly name: string;
  readonly specialization: string;
  readonly position: number;
  readonly conditionDamage?: number;
  readonly ferocity?: number;
  readonly concentration?: number;
  readonly vitality?: number;
  readonly burningDuration?: number;
  readonly bleedingDuration?: number;
  readonly criticalChance?: number;
}

export interface ElementalistBuild extends Gw2Build {
  specializations?: ElementalistBuildSpecialization[];
  assumptions?: SchedulerRecord;
  sigils?: string[];
  startAttunement?: string;
  secondaryAttunement?: string;
  initialCatalystEnergy?: number;
  evokerElement?: string;
  initialEvokerCharges?: number;
  initialEvokerEmpowered?: number;
  selectedSkills?: readonly string[] | Record<string, string>;
}

export interface ElementalistCanonicalBuild extends Gw2CanonicalBuild {
  profession: "elementalist";
  assumptions: SchedulerRecord;
  startAttunement: string;
  secondaryAttunement: string;
  initialCatalystEnergy: number;
  evokerElement: string;
  initialEvokerCharges: number;
  initialEvokerEmpowered: number;
}

export interface ElementalistApplicationBuild extends ProfessionApplicationBuild {
  startAttunement: string;
  secondaryAttunement: string;
  initialCatalystEnergy: number;
  evokerElement: string;
  initialEvokerCharges: number;
  initialEvokerEmpowered: number;
}
