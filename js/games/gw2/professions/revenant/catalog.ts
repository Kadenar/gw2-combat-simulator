import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { revenantCoreModule } from '#gw2/professions/revenant/core/module.js';
import { conduitModule } from '#gw2/professions/revenant/specializations/conduit/module.js';
import { heraldModule } from '#gw2/professions/revenant/specializations/herald/module.js';
import { renegadeModule } from '#gw2/professions/revenant/specializations/renegade/module.js';
import { vindicatorModule } from '#gw2/professions/revenant/specializations/vindicator/module.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

// Kept apart from profession.ts because build/ reads the catalog while profession.ts imports build/.
export const revenantNativeModules = Object.freeze([
  // Shared actions acquire elite behavior through the active module's lifecycle hooks.
  revenantCoreModule,
  heraldModule,
  renegadeModule,
  vindicatorModule,
  conduitModule
] as const);

/**
 * Rejects a numeric Energy payment time outside the authored cast. A cast that ends before its payment time pays at
 * cast start. Only casts that a mechanic shortens at runtime, such as instant Band Together summons, should take that
 * path, so an authored time past the cast end is a typo.
 */
export function assertRevenantEnergyPaymentTimes(skills: readonly RevenantSkill[]): void {
  for (const skill of skills) {
    const paidAt = skill.energyPaidAt;

    if (paidAt === undefined || paidAt === 'castCommit') continue;

    const castTimeMs = skill.castTimeMs ?? 0;

    if (!Number.isFinite(paidAt) || paidAt <= 0 || paidAt > castTimeMs)
      throw new TypeError(`Skill ${skill.id} pays Energy at ${paidAt} ms, outside its ${castTimeMs} ms cast.`);
  }
}

export const revenantCatalog = assembleNativeApplicationCatalog(revenantNativeModules);
assertRevenantEnergyPaymentTimes(revenantCatalog.skills);
