import type { MesmerClone } from '#gw2/content/professions/mesmer/core/mechanics/illusions/types.js';

import type { MesmerSkill } from '#gw2/content/professions/mesmer/data/types.js';

export interface MesmerMirageMirror {
  availableAt: number;
  expiresAt: number;
  source: string;
}

export interface MesmerMirageState {
  ambushUntil: number;
  ambushSource: string;
  cloneAmbushUntil: number;
  riddleOfSandReady: boolean;
  mirrors: MesmerMirageMirror[];
}

export interface MesmerMirageCloakOptions {
  readonly duration?: number;
  readonly grantCloneCloak?: boolean;
}

export interface MesmerMirageController {
  createMirrors(at: number, count: number, source: string): void;
  executeCloneAmbushes(at: number, clones?: readonly MesmerClone[]): void;
  executePlayerAmbush(skill: MesmerSkill, at: number, castStart?: number): void;
  grantMirageCloak(at: number, source: string, options?: MesmerMirageCloakOptions): void;
  handleMirageShatter(skill: MesmerSkill, at: number, spent: number): void;
  pickUpMirror(at: number, source: string): boolean;
}
