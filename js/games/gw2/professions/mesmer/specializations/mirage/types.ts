import type { EffectDelivery } from '#gw2/platform/simulation/effect-emission.js';
import type { MesmerClone } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export interface MesmerMirageCloakOptions {
  readonly duration?: number;
}

export interface MesmerMirageController {
  createMirrors(at: number, count: number): void;
  executeCloneAmbushes(at: number, clones?: readonly MesmerClone[], delivery?: EffectDelivery): void;
  acceptPlayerAmbush(skill: MesmerSkill, at: number, castStart?: number, delivery?: EffectDelivery): void;
  grantMirageCloak(at: number, source: string, options?: MesmerMirageCloakOptions, delivery?: EffectDelivery): void;
  handleMirageShatter(skill: MesmerSkill, at: number, spent: number, delivery?: EffectDelivery): void;
  pickUpMirror(at: number, skill: MesmerSkill): boolean;
}
