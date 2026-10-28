import {
  fromSkill,
  modifierFact,
  simulationEffectFacts,
  skillFact,
  skillTooltip,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipNumber,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { thiefAcrobaticsTooltips } from '#gw2/professions/thief/app/tooltips/acrobatics.js';
import { thiefCriticalStrikesTooltips } from '#gw2/professions/thief/app/tooltips/critical-strikes.js';
import { thiefDeadlyArtsTooltips } from '#gw2/professions/thief/app/tooltips/deadly-arts.js';
import { thiefShadowArtsTooltips } from '#gw2/professions/thief/app/tooltips/shadow-arts.js';
import { stealthAttack } from '#gw2/professions/thief/app/tooltips/shared.js';
import { thiefTrickeryTooltips } from '#gw2/professions/thief/app/tooltips/trickery.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { spearChainStageForSkill } from '#gw2/professions/thief/data/spear-chain-stages.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

const weaponSwapTooltip: DescribeSimulationTooltip = skillTooltip(
  'Switch weapon sets, leave Kneel, and trigger applicable swap effects. Quick Pockets restores initiative only when swapping in combat.'
);

const dodgeTooltip: DescribeSimulationTooltip = skillTooltip(
  'Spend endurance to dodge and trigger supported dodge traits. Daredevil applies only the selected dodge package. Silent Scope can grant a stealth-attack charge when malice exceeds its threshold.',
  (balanceContext) => [
    { name: 'Endurance cost', detail: String(ENDURANCE.dodgeCost) },
    ...[TRAIT.BOUNDING_DODGER, TRAIT.LOTUS_TRAINING, TRAIT.UNHINDERED_COMBATANT].flatMap((id) => {
      const profile = tooltipProfile(balanceContext, id);
      return simulationEffectFacts(profile.effects, `alternative: ${profile.name}`).facts;
    })
  ]
);

const stealTooltip: DescribeSimulationTooltip = skillTooltip(
  'Trigger stealing traits and obtain a stolen-skill choice. Using a choice consumes the held use; Improvisation allows a second use of the same chosen skill.'
);

const stolenSkillTooltip: DescribeSimulationTooltip = skillTooltip(
  'Use the held stolen skill and consume a use. When Improvisation permits another use, it must be the same chosen skill.'
);

// Read the same grant as the simulation so charge counts and expiry cannot drift from the selected skill.
const shadowStrikeTooltip: DescribeSimulationTooltip = skillTooltip(
  'Stab your foe, then shadowstep away and shoot them. Grants Repeater charges. Each Repeater activation consumes one charge; unused charges expire together. Shadow Strike returns when all charges are consumed or expire.',
  (_context, skill) => {
    const grant = skill.sideEffects?.map(({ do: action }) => action).find((action) => action.type === 'flipArm');
    return [
      { name: 'Repeater charges', detail: tooltipDecimal(tooltipNumber(grant, 'uses')) },
      { name: 'Repeater duration', detail: tooltipSeconds(tooltipNumber(grant, 'durationSec')) }
    ];
  }
);

const prepareTrapTooltip: DescribeSimulationTooltip = skillTooltip(
  'Place a preparation. After its recharge-scaled arming delay, its trigger remains available until used. Placement starts the parent recharge independently.',
  (_c, selected) => [{ name: 'Base arming delay', detail: tooltipSeconds(tooltipNumber(selected, 'duration')) }]
);

const activateTrapTooltip: DescribeSimulationTooltip = skillTooltip(
  'Activate and consume the armed preparation. Its trigger recharge also delays the next placement if that would otherwise be ready sooner.'
);

// The ordinary venom grant and its named trigger component share one selected skill owner.
const venomTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const skill = balanceContext.catalog.skillsById.get(entity.id)!;
  return {
    description:
      'Grant independently expiring venom charges to yourself and configured allies. Each eligible strike consumes one charge from each active venom.',
    facts: [
      ...simulationEffectFacts(skill.effects, 'charge grant').facts,
      ...simulationEffectFacts(requireSkillAction(skill, 'venom').effects, 'per consumed charge').facts
    ]
  };
};

const assassinsSignetTooltip: DescribeSimulationTooltip = skillTooltip(
  'Passively grants power while ready. Activation temporarily replaces the passive bonus with the larger active bonus; the passive returns when recharge ends.',
  (_context, skill) => [
    { name: 'Passive power', detail: String(skill.attributeBonuses!.power) },
    { name: 'Active power', detail: String(skill.activePowerBonus) },
    { name: 'Active duration', detail: tooltipSeconds(tooltipNumber(skill, 'duration')) }
  ]
);

const thievesGuildTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const profile = (balanceContext.catalog.skillsById.get(entity.id) as ThiefSkill).summonAttack!;
  return {
    description:
      'Summon thieves that run their attack rotations while combat is active. The final thief depends on your specialization. Their strikes use fixed companion attributes; their conditions inherit your condition attributes. Lifetime begins when casting starts, including time before combat. Recasting replaces the previous guild.',
    facts: [
      skillFact(balanceContext, entity.id, 'duration', 'Lifetime', tooltipSeconds),
      { name: 'Companion power', detail: tooltipDecimal(profile.basePower) },
      { name: 'Companion critical chance', detail: tooltipPercent(profile.criticalChance) },
      { name: 'Companion critical damage', detail: `${tooltipDecimal(profile.criticalDamage * 100)}%` },
      ...profile.summons.flatMap((summon) =>
        (summon.attacks || []).flatMap((attack) => {
          const skill = balanceContext.catalog.skillsById.get(attack.skillId)!;
          return simulationEffectFacts(skill.effects, `${summon.name} — ${skill.name}`).facts;
        })
      )
    ]
  };
};

const kneelTooltip: DescribeSimulationTooltip = skillTooltip(
  'Kneel to replace rifle skills with their kneeling variants and increase initiative regeneration. Free Action or swapping weapons ends Kneel.',
  [fromSkill(ID.KNEEL, 'kneelingInitiativeRegenerationBonus', 'Additional initiative per second')]
);

const freeActionTooltip: DescribeSimulationTooltip = skillTooltip(
  'Stand up, ending Kneel and restoring the standing rifle skills and initiative regeneration.'
);

const spearChainTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id)!;
  const stage = spearChainStageForSkill(entity.id);
  let description =
    stage === 0
      ? 'Lead attack: advances the spear chain to follow-up attacks.'
      : stage === 1
        ? 'Requires a lead attack; advances the spear chain to finishers.'
        : stage === 2
          ? 'Requires a follow-up attack; completes the spear chain and restores lead attacks.'
          : "Apply this spear skill's supported effects.";
  const facts = [...simulationEffectFacts(selected.effects).facts];

  if (entity.id === ID.FALLING_SPIDER) {
    description += ' Following Entangling Asp empowers its strike and adds bleeding and poison stacks.';
    facts.push(
      skillFact(
        balanceContext,
        ID.FALLING_SPIDER,
        'empoweredDamageMultiplier',
        'Strike damage after Entangling Asp',
        tooltipFactorChange
      ),
      skillFact(
        balanceContext,
        ID.FALLING_SPIDER,
        'empoweredConditionStacks',
        'Additional bleeding and poison stacks after Entangling Asp'
      )
    );
  } else if (entity.id === ID.UNSUSPECTING_STRIKE)
    description += ' Applies additional bleeding against a target above the supported high-health threshold.';
  else if (entity.id === ID.DISTRACTING_THROW) {
    description =
      'At the start of a spear chain, or after a finisher, this acts as a lead attack. Following a finisher also starts a strike-damage bonus.';
    facts.push(
      skillFact(balanceContext, ID.DISTRACTING_THROW, 'duration', 'Bonus duration', tooltipSeconds),
      modifierFact(balanceContext, 'thief.distracting-throw-finisher', 'amount', 'Strike damage after a finisher')
    );
  }

  return { description, facts };
};

/** Compose core skills and trait-line tooltips from the selected balance data. */
export const thiefCoreTooltips = {
  skillFacts: (_c, entity) => [
    ...[
      ['initiativeCost', 'Initiative cost'],
      ['resourceGain', 'Endurance restored']
    ].flatMap(([field, name]) =>
      typeof entity[field] === 'number' && entity[field] > 0
        ? [{ name, detail: tooltipDecimal(tooltipNumber(entity, field)) }]
        : []
    ),
    ...(entity.flipDuration == null
      ? []
      : [{ name: 'Follow-up window', detail: tooltipSeconds(tooltipNumber(entity, 'flipDuration')) }])
  ],
  skills: {
    [SHARED_SKILL_IDS.SWAP_WEAPONS]: weaponSwapTooltip,
    [SHARED_SKILL_IDS.DODGE]: dodgeTooltip,
    [ID.STEAL]: stealTooltip,
    [ID.SHADOW_STRIKE]: shadowStrikeTooltip,
    [ID.REPEATER_ID_59526]: skillTooltip(
      'Fire a volley using one Repeater charge granted by Shadow Strike. The charge is consumed on activation, even if the volley is interrupted. Remaining charges retain their original expiry.'
    ),
    ...Object.fromEntries(
      [ID.SOUL_STONE_VENOM, ID.DETONATE_PLASMA, ID.THROW_MAGNETIC_BOMB].map((id) => [id, stolenSkillTooltip])
    ),
    ...Object.fromEntries(
      [
        ID.SNEAK_ATTACK,
        ID.SURPRISE_SHOT,
        ID.HOOK_STRIKE,
        ID.SHADOWSQUALL,
        ID.DEATHS_JUDGMENT,
        ID.BACKSTAB,
        ID.TACTICAL_STRIKE,
        ID.CUNNING_SALVO
      ].map((id) => [id, stealthAttack])
    ),
    [ID.ASHEN_ASSAULT]: stealthAttack,
    ...Object.fromEntries([ID.PREPARE_THOUSAND_NEEDLES, ID.PREPARE_PITFALL].map((id) => [id, prepareTrapTooltip])),
    ...Object.fromEntries([ID.PITFALL, ID.THOUSAND_NEEDLES].map((id) => [id, activateTrapTooltip])),
    ...Object.fromEntries([ID.SPIDER_VENOM, ID.SKALE_VENOM, ID.DEVOURER_VENOM].map((id) => [id, venomTooltip])),
    [ID.ASSASSINS_SIGNET]: assassinsSignetTooltip,
    [ID.THIEVES_GUILD]: thievesGuildTooltip,
    [ID.KNEEL]: kneelTooltip,
    [ID.FREE_ACTION]: freeActionTooltip,
    ...Object.fromEntries(
      [
        ID.ENTANGLING_ASP,
        ID.DISTRACTING_THROW,
        ID.UNSUSPECTING_STRIKE,
        ID.MANTIS_STING,
        ID.VAMPIRIC_SLASH,
        ID.BARBED_SPEAR,
        ID.SHATTERING_ASSAULT,
        ID.FALLING_SPIDER
      ].map((id) => [id, spearChainTooltip])
    ),
    [ID.UNLOAD]: skillTooltip(
      'Fire the volley. Restore initiative only if the final bullet is reached and the attack is not cancelled.',
      [fromSkill(ID.UNLOAD, 'initiativeRefund', 'Initiative restored after the volley')]
    ),
    [ID.INFILTRATORS_SIGNET]: skillTooltip(
      'Passively regenerates additional initiative while ready. Activation shadowsteps and pauses the passive until recharge completes.'
    ),
    [ID.SIGNET_OF_AGILITY]: skillTooltip(
      "Passively grants precision while ready. Activation restores endurance, capped by the specialization's endurance pool.",
      (context, skill) => [
        { name: 'Passive precision', detail: String(skill.attributeBonuses!.precision) },
        skillFact(context, skill.id, 'enduranceGain', 'Endurance restored on activation')
      ]
    ),
    [ID.HARROWING_STORM]: skillTooltip(
      'Shadowstep and recall live axes, repeating their damage and conditions with two seconds of Torment per axe. Five returning hits immobilize once for 1.5 seconds.'
    ),
    [ID.ORCHESTRATED_ASSAULT]: skillTooltip(
      "Recall live axes with 33% increased strike damage and one second of Weakness per axe. Reapply each axe's conditions. Five returning hits immobilize once for 1.5 seconds."
    ),
    [ID.RECALL_AXES]: skillTooltip(
      "Recall live axes with 33% increased strike damage and one second of Weakness per axe. Reapply each axe's conditions. Five returning hits immobilize once for 1.5 seconds."
    ),
    [ID.SPINNING_AXE]: skillTooltip(
      'Throw an axe. Landed axes remain in the shared ground-axe pool until recalled or expired.'
    ),
    [ID.SPINNING_AXE_ID_71967]: skillTooltip(
      'Throw an axe. Landed axes remain in the shared ground-axe pool until recalled or expired.'
    ),
    [ID.VENOMOUS_VOLLEY]: skillTooltip(
      'Throw a volley of axes. Each landed axe enters the shared ground-axe pool until recalled or expired.'
    )
  },
  traits: {
    ...thiefShadowArtsTooltips,
    ...thiefDeadlyArtsTooltips,
    ...thiefCriticalStrikesTooltips,
    ...thiefTrickeryTooltips,
    ...thiefAcrobaticsTooltips
  }
} satisfies ProfessionTooltips;
