/** Registers scheduler-phase skill activations for this module. */
import { augmentSkill, replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { gw2WeaponSwapSkillHandler } from '#gw2/platform/equipment/weapons/swap.js';
import type { SkillHandlerPhase } from '#gw2/platform/engine/execution/types.js';
import type { RevenantCastContext, RevenantSimulationEvent, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { gainAncientEchoEnergy, performRevenantDodge } from '#gw2/professions/revenant/core/execution/actions.js';
import { swapRevenantLegend } from '#gw2/professions/revenant/core/mechanics/legend-swap.js';
import { activateEnchantedDaggers } from '#gw2/professions/revenant/core/mechanics/enchanted-daggers.js';
import { revenantSpearSkillHandlers } from '#gw2/professions/revenant/core/execution/spear.js';
import { toggleRevenantUpkeep, releaseRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { activateBlossomingAura, detonateBlossomingAura } from '#gw2/professions/revenant/core/execution/scepter.js';

const handlers = Object.freeze({
  'revenant.blossoming-aura': replaceSkill<RevenantCastContext>({ afterEffects: activateBlossomingAura }),
  'revenant.detonate-blossoming-aura': replaceSkill<RevenantCastContext>({ afterEffects: detonateBlossomingAura }),
  'revenant.weapon-swap': gw2WeaponSwapSkillHandler,
  'revenant.legend-swap': replaceSkill<RevenantCastContext>({
    afterEffects: swapRevenantLegend as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.dodge': replaceSkill<RevenantCastContext>({
    beforeEffects: performRevenantDodge as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.enchanted-daggers': replaceSkill<RevenantCastContext>({
    afterEffects: activateEnchantedDaggers as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.upkeep': replaceSkill<RevenantCastContext>({
    afterEffects: toggleRevenantUpkeep as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.upkeep-release': replaceSkill<RevenantCastContext>({
    afterEffects: releaseRevenantUpkeep as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.spear-recharge': augmentSkill<RevenantCastContext>({
    afterEffect: (context, skill, event) =>
      revenantSpearSkillHandlers['revenant.spear-recharge'](
        context,
        skill as RevenantSkill,
        event as RevenantSimulationEvent
      )
  }),
  'revenant.abyssal-raze': replaceSkill<RevenantCastContext>({
    beforeEffects: revenantSpearSkillHandlers['revenant.abyssal-raze'] as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.ancient-echo': augmentSkill<RevenantCastContext>({
    afterEffects: gainAncientEchoEnergy
  })
});

export const revenantCoreSkillHandlers = new Map(Object.entries(handlers));
