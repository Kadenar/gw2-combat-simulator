import type { MesmerClone } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export interface MesmerMirageCloakOptions {
  readonly duration?: number;
}

export interface MesmerMirageController {
  createMirrors(at: number, count: number, source: string): void;
  executeCloneAmbushes(at: number, clones?: readonly MesmerClone[]): void;
  acceptPlayerAmbush(skill: MesmerSkill, at: number, castStart?: number): void;
  grantMirageCloak(at: number, source: string, options?: MesmerMirageCloakOptions): void;
  handleMirageShatter(skill: MesmerSkill, at: number, spent: number): void;
  pickUpMirror(at: number, skill: MesmerSkill): boolean;
}
