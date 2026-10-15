import {
  fromProfile,
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  profileFact,
  tooltipPercent,
  simulationEffectFacts,
  type ProfessionTooltips,
  type DescribeSimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import { MECHANIST_BALANCE_PROFILE_IDS as MECHANIST } from '#gw2/professions/engineer/specializations/mechanist/profiles.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';

/** Both improved-inheritance traits read the same live mech caps and ratio. */
function improvedMechInheritanceFacts(balanceContext: ProfessionBalanceContext, id: SkillId) {
  return [
    profileFact(balanceContext, id, 'inheritanceRatio', 'Inheritance ratio', tooltipPercent),
    profileFact(balanceContext, id, 'secondaryAttributeCap', 'Cap for each attribute')
  ];
}

const overclockSignetTooltip: DescribeSimulationTooltip = skillTooltip(
  "Command the active mech to fire Jade Buster Cannon. Its basic attack loop pauses during the burst; mech quickness changes its attack rate. The signet's passive reduces other signet recharges, subject to its passive availability rules.",
  // The commanded skill owns the entire burst; the signet profile only owns its passive.
  (balanceContext) => [
    ...simulationEffectFacts(balanceContext.catalog.skillsById.get(ID.JADE_BUSTER_CANNON)!.effects, 'companion effect')
      .facts,
    profileFact(balanceContext, MECHANIST.overclock, 'rechargeMultiplier', 'Signet recharge', tooltipFactorChange)
  ]
);

/** Describe mechanist tooltips from the selected balance data. */
export const mechanistTooltips = {
  skills: { [ID.OVERCLOCK_SIGNET]: overclockSignetTooltip },
  traits: {
    [TRAIT.MECHANICAL_GENIUS]: traitTooltip(
      'Replace toolbelt skills with mech commands. The mech remains present and inherits attributes from the player.',
      [
        fromProfile(
          'engineer.mechanist.mech',
          'inheritanceRatio',
          'Base power and secondary-attribute inheritance',
          tooltipPercent
        ),
        fromProfile('engineer.mechanist.mech', 'secondaryAttributeCap', 'Base secondary-attribute cap')
      ]
    ),
    [TRAIT.MECH_FIGHTER]: traitTooltip(
      'Eligible player weapon attacks command the mech to use Rocket Punch.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'cooldown', 'Rocket Punch base recharge', tooltipSeconds),
        ...simulationEffectFacts(balanceContext.catalog.skillsById.get(ID.ROCKET_PUNCH_MECH)!.effects, 'mech effect')
          .facts
      ],
      'mech effect'
    ),
    [TRAIT.EXIGENCY_PROTOCOLS]: outsideScopeTooltip,
    [TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS]: traitTooltip(
      'Select Rolling Smash as the first mech command. Qualifying mech strikes inflict bleeding.',
      [['internalCooldown', 'Internal cooldown', tooltipSeconds]]
    ),
    [TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS]: traitTooltip(
      'Select Explosive Knuckle as the first mech command. Qualifying mech strikes grant might.',
      [['internalCooldown', 'Internal cooldown', tooltipSeconds]]
    ),
    [TRAIT.MECH_ARMS_JADE_CANNONS]: traitTooltip(
      'Select Spark Revolver as the first mech command. The mech uses ranged arm shots and gains critical-strike chance.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'criticalChance', 'Additional mech critical chance', tooltipPercent),
        ...simulationEffectFacts(balanceContext.catalog.skillsById.get(ID.JADE_ENERGY_SHOT)!.effects, 'per arm shot')
          .facts
      ],
      'per arm shot'
    ),
    [TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS]: traitTooltip(
      'Select Discharge Array as the second mech command. Improve mech condition-damage and expertise inheritance.',
      improvedMechInheritanceFacts
    ),
    [TRAIT.MECH_FRAME_CHANNELING_CONDUITS]: traitTooltip(
      'Select Crisis Zone as the second mech command. Player and mech barrier applications grant alacrity to their recipients. Improve mech concentration and healing-power inheritance.',
      (balanceContext, id) => [
        ...improvedMechInheritanceFacts(balanceContext, id),
        profileFact(balanceContext, id, 'internalCooldown', 'Alacrity cooldown per recipient', tooltipSeconds)
      ]
    ),
    [TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR]: traitTooltip(
      'Select Core Reactor Shot as the second mech command. The mech inherits player precision up to its cap.',
      [fromProfile(TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR, 'precisionCap', 'Mech precision cap')]
    ),
    [TRAIT.MECH_CORE_JADE_DYNAMO]: traitTooltip(
      'Select Jade Mortar as the third mech command. Mech commands recharge faster and grant quickness.',
      [['rechargeMultiplier', 'Command recharge duration', tooltipFactorChange]]
    ),
    // Passive cadence comes from the same profile that schedules combat barrier grants.
    [TRAIT.MECH_CORE_BARRIER_ENGINE]: traitTooltip(
      'Select Barrier Burst as the third mech command. While in combat, the mech periodically grants barrier to nearby allies.',
      [['interval', 'Barrier interval', tooltipSeconds]]
    ),
    [TRAIT.MECH_CORE_J_DRIVE]: traitTooltip(
      "Select Sky Circus as the third mech command. Supported signet passives remain active during recharge and gain their enhanced bonuses; Overclock Signet's recharge changes.",
      [fromProfile(TRAIT.MECH_CORE_J_DRIVE, 'damageIncrease', 'Force Signet strike bonus', tooltipPercent)]
    )
  }
} satisfies ProfessionTooltips;
