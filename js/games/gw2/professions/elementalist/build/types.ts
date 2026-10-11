import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export interface ElementalistBuildSpecialization {
  name: string;
  traits: string;
}

export interface ElementalistCanonicalBuild extends Gw2CanonicalBuild {
  profession: 'elementalist';
  startAttunement: string;
  secondaryAttunement: string;
  initialCatalystEnergy: number;
  evokerElement: string;
  initialEvokerCharges: number;
  initialEvokerEmpowered: number;
  pistolBullets: Record<'Fire' | 'Water' | 'Air' | 'Earth', boolean>;
}

export interface ElementalistConfig extends Gw2Config {
  readonly startAttunement?: string;
  readonly secondaryAttunement?: string;
  readonly initialCatalystEnergy?: number;
  readonly evokerElement?: string;
  readonly initialEvokerCharges?: number;
  readonly initialEvokerEmpowered?: number;
  readonly pistolBullets?: Readonly<Partial<Record<'Fire' | 'Water' | 'Air' | 'Earth', boolean>>>;
  /** Assumption: summon the glyph elemental at combat start. */
}
