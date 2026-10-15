import { traitSkillTooltip } from '#gw2/app/shared/simulation-tooltip.js';
import {
  fromProfile,
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  profileFact,
  tooltipPercent,
  tooltipProfile,
  simulationEffectFacts,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/engineer/core/profiles.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

/** Describe tools tooltips from the selected balance data. */
export const engineerToolsTooltips = {
  [TRAIT.OPTIMIZED_ACTIVATION]: traitTooltip('Completing a toolbelt skill grants vigor.'),
  [TRAIT.MECHANIZED_DEPLOYMENT]: traitTooltip('Toolbelt skills recharge faster.', [
    ['rechargeMultiplier', 'Toolbelt recharge reduction', (value) => tooltipPercent(1 - value)]
  ]),
  [TRAIT.EXCESSIVE_ENERGY]: traitTooltip('Player-owned strikes deal increased damage while you have vigor.', [
    fromProfile(TRAIT.EXCESSIVE_ENERGY, 'damageIncrease', 'Strike damage with vigor', tooltipPercent)
  ]),
  [TRAIT.STATIC_DISCHARGE]: (balanceContext, entity) => ({
    description:
      'Completing a toolbelt skill fires an additional strike. Static Discharge has its own critical-damage multiplier.',
    facts: [
      profileFact(balanceContext, entity.id, 'criticalDamage', 'Static Discharge critical damage', tooltipFactorChange),
      ...simulationEffectFacts(balanceContext.catalog.skillsById.get(ID.STATIC_DISCHARGE_TRAIT_SKILL)!.effects || [])
        .facts
    ]
  }),
  [TRAIT.REACTIVE_LENSES]: outsideScopeTooltip,
  [TRAIT.POWER_WRENCH]: traitTooltip('Dodging reduces active elite-skill cooldowns.', [
    ['rechargeReduction', 'Elite recharge reduction per dodge', tooltipSeconds]
  ]),
  [TRAIT.STREAMLINED_KITS]: (balanceContext, entity) => ({
    description: 'Equipping a kit grants swiftness. Equipping Grenade Kit also drops a mine.',
    facts: [
      profileFact(balanceContext, entity.id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
      ...(tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
        (effect) => simulationEffectFacts([effect], effect.type === 'strike' ? 'Grenade Kit only' : 'any kit').facts
      )
    ]
  }),
  [TRAIT.LOCK_ON]: traitSkillTooltip(
    [ID.CONTROLLED_ANALYSIS],
    'Disabling a foe invokes Controlled Analysis, granting fury and applying vulnerability.'
  ),
  [TRAIT.TAKEDOWN_ROUND]: traitTooltip(
    'Player-owned strikes deal increased damage while endurance is below its maximum.',
    [fromProfile(TRAIT.TAKEDOWN_ROUND, 'damageIncrease', 'Strike damage below full endurance', tooltipPercent)]
  ),
  [TRAIT.KINETIC_BATTERY]: traitTooltip(
    'Toolbelt activations build charge. Reaching the charge threshold grants quickness, superspeed, and a temporary strike-damage bonus.',
    [
      ['maximumStacks', 'Activations per trigger'],
      fromProfile(TRAIT.KINETIC_BATTERY, 'damageIncrease', 'Strike damage during the bonus', tooltipPercent)
    ]
  ),
  [TRAIT.ADRENAL_IMPLANT]: traitTooltip('Endurance regenerates faster. Dodging reduces active toolbelt cooldowns.', [
    fromProfile(CORE.resources, 'coefficientMultiplier', 'Endurance regeneration', tooltipFactorChange),
    ['rechargeReduction', 'Toolbelt recharge reduction per dodge', tooltipSeconds]
  ]),
  [TRAIT.GADGETEER]: traitTooltip('Gadget skills recharge faster.', [
    ['rechargeMultiplier', 'Gadget recharge reduction', (value) => tooltipPercent(1 - value)]
  ])
} satisfies NonNullable<ProfessionTooltips['traits']>;
