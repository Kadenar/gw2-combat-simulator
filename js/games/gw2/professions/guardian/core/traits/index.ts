import { guardianHonorTraits } from '#gw2/professions/guardian/core/traits/honor.js';
import { guardianRadianceTraits } from '#gw2/professions/guardian/core/traits/radiance.js';
import { guardianValorTraits } from '#gw2/professions/guardian/core/traits/valor.js';
import { guardianVirtuesTraits } from '#gw2/professions/guardian/core/traits/virtues.js';
import { guardianZealTraits } from '#gw2/professions/guardian/core/traits/zeal.js';

/** Register each implemented Core trait once; explicit rules and mechanic calls preserve execution order. */
export const guardianCoreTraits = [
  ...guardianZealTraits,
  ...guardianRadianceTraits,
  ...guardianValorTraits,
  ...guardianHonorTraits,
  ...guardianVirtuesTraits
];
