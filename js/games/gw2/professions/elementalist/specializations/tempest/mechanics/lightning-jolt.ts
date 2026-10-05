import { STANDARD_TARGET_ARMOR } from '#gw2/platform/combat/formulas.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { elementalistStrikeRequest } from '#gw2/professions/elementalist/core/events.js';
import {
  registerElementalLifecycle,
  type ElementalStrikeBoundary
} from '#gw2/professions/elementalist/core/mechanics/elementals/lifecycle.js';
import { tempestState } from '#gw2/professions/elementalist/specializations/tempest/state.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Allied Jolt uses its own fixed damage scale, without inheriting player attributes or modifiers. */
const ELEMENTAL_LIGHTNING_JOLT_PROFILE = Object.freeze({
  weaponStrengthProfileId: 'nonweapon.unequipped',
  basePower: (2500 * STANDARD_TARGET_ARMOR) / 690.5
});

/** A represented live elemental receives one replaceable charge tied to its current lifetime. */
export function armElementalLightningJolt(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skillId: number,
  coefficient: number
): void {
  const elemental = context.profession.core.summonedElemental;
  if ((elemental.element === 'Fire' || elemental.element === 'Earth') && elemental.activeUntil > cast.effectiveEnd) {
    tempestState.from(context).pendingLightningJolt = {
      summonGeneration: elemental.summonGeneration,
      coefficient,
      skillId
    };
  }
}

/** Consume before emission so one accepted strike cannot recursively spend the same charge twice. */
function consumeElementalLightningJolt(context: ElementalistRuntime, strike: ElementalStrikeBoundary): void {
  const state = tempestState.from(context);
  const charge = state.pendingLightningJolt;
  if (!charge || charge.summonGeneration !== strike.summonGeneration) return;
  state.pendingLightningJolt = null;
  context.effects.emit(
    elementalistStrikeRequest(
      context,
      {
        activationId: `${strike.activationId}:lightning-jolt`,
        at: context.time,
        source: `${strike.element} Elemental`,
        sourceId: charge.skillId,
        actorType: 'summon',
        skillId: charge.skillId,
        skillName: 'Lightning Jolt',
        name: 'Lightning Jolt',
        coefficient: charge.coefficient,
        hits: 1,
        canCrit: false,
        skillWeapon: 'Unequipped',
        weaponStrengthProfileId: ELEMENTAL_LIGHTNING_JOLT_PROFILE.weaponStrengthProfileId,
        independentSummonStrike: true,
        summonInheritsAttributes: false,
        summonBasePower: ELEMENTAL_LIGHTNING_JOLT_PROFILE.basePower,
        summonBasePrecision: 1000,
        summonBaseFerocity: 0,
        summonUsesMight: false,
        summonUsesEquipmentModifiers: false,
        summonUsesProfessionModifiers: false,
        summonOwner: strike.companionId
      },
      strike.emissionCast
    )
  );
}

/** Tempest installs its charge policy without making Core aware of Lightning Jolt. */
export function registerTempestLightningJolt(context: ElementalistRuntime): void {
  registerElementalLifecycle(context, {
    beforeStrike: consumeElementalLightningJolt,
    retire(runtime, summonGeneration) {
      const state = tempestState.from(runtime);
      if (state.pendingLightningJolt?.summonGeneration === summonGeneration) state.pendingLightningJolt = null;
    }
  });
}
