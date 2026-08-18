import { assembleNativeApplicationCatalog } from '../../platform/gw2/native-profession.js';
import { ELEMENTALIST_NATIVE_CATALOG_OPTIONS, elementalistNativeModules } from './modules.js';

export const ELEMENTALIST_ELITE_SPECIALIZATIONS = Object.freeze(['Tempest', 'Weaver', 'Catalyst', 'Evoker']);

export const elementalistCatalog = assembleNativeApplicationCatalog(
  elementalistNativeModules,
  ELEMENTALIST_NATIVE_CATALOG_OPTIONS
);

export const ELEMENTALIST_SKILLS = elementalistCatalog.skills;
