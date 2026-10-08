import {
  empoweringMight,
  forceOfWill,
  honorableStaff,
  invigoratedBulwark,
  protectorsRestoration,
  writOfPersistence
} from '#gw2/professions/guardian/core/traits/honor/index.js';
import {
  amplifiedWrath,
  healersResolution,
  innerFire,
  justiceIsBlind,
  perfectInscriptions,
  radiantFire,
  radiantPower,
  retribution,
  righteousInstincts,
  rightHandStrength
} from '#gw2/professions/guardian/core/traits/radiance/index.js';
import { focusMastery, stalwartDefender } from '#gw2/professions/guardian/core/traits/valor/index.js';
import {
  battlePresence,
  glacialHeart,
  indomitableCourage,
  inspiredVirtue,
  inspiringVirtue,
  masterOfConsecrations,
  permeatingWrath,
  powerOfTheVirtuous,
  unscathedContender,
  virtueOfResolution
} from '#gw2/professions/guardian/core/traits/virtues/index.js';
import {
  eternalArmory,
  fieryWrath,
  furiousFocus,
  kindledZeal,
  symbolicAvenger,
  symbolicExposure,
  zealotsResolution,
  zealousBlade
} from '#gw2/professions/guardian/core/traits/zeal/index.js';

/** Register each Core trait directly, preserving the execution order of its rules. */
export const guardianCoreTraits = [
  fieryWrath,
  furiousFocus,
  symbolicExposure,
  symbolicAvenger,
  zealotsResolution,
  zealousBlade,
  kindledZeal,
  eternalArmory,
  innerFire,
  healersResolution,
  righteousInstincts,
  rightHandStrength,
  radiantPower,
  radiantFire,
  amplifiedWrath,
  perfectInscriptions,
  justiceIsBlind,
  retribution,
  focusMastery,
  stalwartDefender,
  invigoratedBulwark,
  empoweringMight,
  protectorsRestoration,
  writOfPersistence,
  forceOfWill,
  honorableStaff,
  battlePresence,
  permeatingWrath,
  inspiredVirtue,
  virtueOfResolution,
  inspiringVirtue,
  indomitableCourage,
  masterOfConsecrations,
  powerOfTheVirtuous,
  unscathedContender,
  glacialHeart
];
