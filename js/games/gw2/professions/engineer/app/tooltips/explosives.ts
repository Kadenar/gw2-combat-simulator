import {
  fromProfile,
  tooltipFactorChange,
  tooltipSeconds,
  traitTooltip,
  profileFact,
  tooltipPercent,
  tooltipDecimal,
  tooltipNumber,
  simulationEffectFacts,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

/** Describe explosives tooltips from the selected balance data. */
export const engineerExplosivesTooltips = {
  [TRAIT.EXPLOSIVE_ENTRANCE]: (balanceContext) => {
    // Triggered skill facts always follow the selected skill patch, including recharge and removed effects.
    const skill = balanceContext.catalog.skillsById.get(ID.EXPLOSIVE_ENTRANCE_TRAIT_SKILL)!;
    return {
      ...simulationEffectFacts(skill.effects || []),
      description:
        'Your first qualifying player strike triggers an additional explosion. Dodging rearms it without resetting the skill recharge.',
      facts: [
        { name: 'Base skill recharge', detail: tooltipSeconds(tooltipNumber(skill, 'cooldown')) },
        ...simulationEffectFacts(skill.effects || []).facts
      ]
    };
  },
  [TRAIT.STEEL_PACKED_POWDER]: traitTooltip('Explosions inflict vulnerability.'),
  [TRAIT.SHAPED_CHARGE]: traitTooltip(
    'Player-owned strikes deal increased damage for each vulnerability stack on the target.',
    [
      fromProfile(
        TRAIT.SHAPED_CHARGE,
        'damageIncreasePerStack',
        'Strike damage per vulnerability stack',
        tooltipPercent
      ),
      fromProfile(TRAIT.SHAPED_CHARGE, 'maximumStacks', 'Maximum stacks counted', tooltipDecimal)
    ]
  ),
  [TRAIT.GRENADIER]: (balanceContext) => {
    // The trait describes its triggered skill using that skill's selected patch data.
    const skill = balanceContext.catalog.skillsById.get(ID.LESSER_GRENADE_BARRAGE)!;
    const effects = skill.effects || [];
    return {
      ...simulationEffectFacts(effects),
      description: 'Using a healing skill triggers Lesser Grenade Barrage.',
      facts: [
        { name: 'Base skill recharge', detail: tooltipSeconds(tooltipNumber(skill, 'cooldown')) },
        // Show the selected preview's explosion bonus alongside Grenadier's existing proc.
        profileFact(balanceContext, TRAIT.GRENADIER, 'damageIncrease', 'Explosion strike damage', tooltipPercent),
        ...simulationEffectFacts(effects).facts
      ]
    };
  },
  [TRAIT.SHORT_FUSE]: traitTooltip('Explosions grant fury.', [
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.GLASS_CANNON]: traitTooltip(
    'Player-owned strikes deal increased damage at the full player health used by combat simulations.',
    [fromProfile(TRAIT.GLASS_CANNON, 'damageMultiplier', 'Strike damage', tooltipFactorChange)]
  ),
  [TRAIT.AIM_ASSISTED_ROCKET]: (balanceContext, entity) => ({
    description:
      'Eligible projectile hits fire a rocket. At the proc-count threshold, an Orbital Command Strike replaces the rocket.',
    facts: [
      profileFact(balanceContext, entity.id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
      profileFact(balanceContext, entity.id, 'maximumStacks', 'Procs per orbital strike'),
      ...[ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL, ID.ORBITAL_COMMAND_STRIKE].flatMap(
        (id, index) =>
          simulationEffectFacts(
            balanceContext.catalog.skillsById.get(id)!.effects || [],
            index === 0 ? 'ordinary rocket' : 'orbital strike instead'
          ).facts
      )
    ]
  }),
  [TRAIT.EXPLOSIVE_TEMPER]: traitTooltip('Explosions grant stacking ferocity.', [
    ['attributePerStack', 'Ferocity per stack'],
    ['maximumStacks', 'Maximum stacks']
  ]),
  // Build-only bonuses and imperative triggers need explicit facts alongside profile-owned packets.
  [TRAIT.BLAST_SHIELD]: traitTooltip('Gain vitality from eligible power.', [
    ['attributeConversion', 'Eligible power converted to vitality', tooltipPercent]
  ]),
  [TRAIT.GRAND_ENTRANCE]: traitTooltip(
    'Explosive Entrance opens a temporary critical-chance window and grants resistance.',
    [['criticalChance', 'Critical chance during the window', tooltipPercent]]
  ),
  [TRAIT.SHRAPNEL]: traitTooltip('Explosions can inflict bleeding and crippled.', [
    ['procChance', 'Chance per eligible explosion', tooltipPercent]
  ]),
  [TRAIT.BIG_BOOMER]: traitTooltip(
    "Player-owned strikes deal increased damage when your health percentage exceeds the target's. Player health stays full in combat simulations.",
    [fromProfile(TRAIT.BIG_BOOMER, 'damageMultiplier', 'Strike damage', tooltipFactorChange)]
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
