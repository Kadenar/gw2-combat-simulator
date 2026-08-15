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

export interface ElementalistBuild extends Gw2Build {
  specializations?: ElementalistBuildSpecialization[];
  assumptions?: SchedulerRecord;
  startAttunement?: string;
  secondaryAttunement?: string;
  initialCatalystEnergy?: number;
  evokerElement?: string;
  initialEvokerCharges?: number;
  initialEvokerEmpowered?: number;
  pistolBullets?: Partial<Record<"Fire" | "Water" | "Air" | "Earth", boolean>>;
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
  pistolBullets: Record<"Fire" | "Water" | "Air" | "Earth", boolean>;
}

export interface ElementalistApplicationBuild extends ProfessionApplicationBuild {
  startAttunement: string;
  secondaryAttunement: string;
  initialCatalystEnergy: number;
  evokerElement: string;
  initialEvokerCharges: number;
  initialEvokerEmpowered: number;
  pistolBullets: Record<"Fire" | "Water" | "Air" | "Earth", boolean>;
}
