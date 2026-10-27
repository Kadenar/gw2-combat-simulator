import { requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { RECIPIENT } from '#gw2/platform/constants.js';
import {
  skillFact,
  simulationEffectFacts,
  skillTooltip,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipNumber,
  tooltipProfile,
  tooltipSeconds,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  castLifeForceGrants,
  effectLifeForceGrants
} from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  lifeForce,
  conditionTransferTooltip,
  flipTooltip,
  shroudTooltip
} from '#gw2/professions/necromancer/app/tooltips/shared.js';
import { necromancerSpiteTooltips } from '#gw2/professions/necromancer/app/tooltips/spite.js';
import { necromancerCursesTooltips } from '#gw2/professions/necromancer/app/tooltips/curses.js';
import { necromancerDeathMagicTooltips } from '#gw2/professions/necromancer/app/tooltips/death-magic.js';
import { necromancerBloodMagicTooltips } from '#gw2/professions/necromancer/app/tooltips/blood-magic.js';
import { necromancerSoulReapingTooltips } from '#gw2/professions/necromancer/app/tooltips/soul-reaping.js';

const oppressiveCollapseTooltip: DescribeSimulationTooltip = skillTooltip(
  "Strike and control your target. Gain party might for each distinct condition on the target when its strike lands, up to the skill's condition limit."
);

const lichTooltip: DescribeSimulationTooltip = skillTooltip(
  'Enter Lich Form to replace your weapon skills temporarily. Leaving the form restores your weapon bar and grants life force. This transform uses its own duration instead of draining life force.'
);

const summonMadnessTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id);

  if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);

  const effects = simulationEffectFacts(selected.effects, 'per horror');
  return {
    ...effects,
    description:
      'Summon temporary horrors in sequence. Each horror attacks and then explodes; the listed effects are for one horror.',
    facts: [
      { name: 'Horrors summoned', detail: String(tooltipNumber(selected, RECIPIENT.SUMMONS)) },
      { name: 'Interval between summons', detail: tooltipSeconds(tooltipNumber(selected, 'summonInterval')) },
      ...effects.facts
    ]
  };
};

const graspingDarknessTooltip: DescribeSimulationTooltip = skillTooltip(
  'Launch a delayed strike that chills and pulls your target. Gain life force when it hits. Once launched, the projectile survives a later interruption.'
);

const nightfallTooltip: DescribeSimulationTooltip = skillTooltip(
  'Create a pulsing field that strikes, blinds, and cripples your target. Each strike pulse generates life force. Committed pulses survive interruption.'
);

const chillingScytheTooltip: DescribeSimulationTooltip = skillTooltip(
  "Strike and chill your target. A committed hit resets Gravedigger's recharge."
);

const deadlySliceTooltip: DescribeSimulationTooltip = skillTooltip(
  'Strike your target and gain a Soul Shard after the attack.'
);

const sinisterStabTooltip: DescribeSimulationTooltip = skillTooltip(
  'Strike and chill your target, then gain a Soul Shard.'
);

const extirpateTooltip: DescribeSimulationTooltip = skillTooltip(
  'Strike your target, gain might, and apply weakness and the Extirpation marker. The first hit grants Soul Shards. Target boon denial is outside simulation scope.'
);

const addleTooltip: DescribeSimulationTooltip = skillTooltip(
  'Strike and daze your target, gaining Soul Shards. Having enough Soul Shards before activation also immobilizes the target. Against a defiant target or one activating skills, gain additional life force and Soul Shards.'
);

const perforateTooltip: DescribeSimulationTooltip = skillTooltip(
  'Strike repeatedly. Each hit can consume an available Soul Shard for an additional life-steal strike. Soul Shard damage increases against a low-health target.',
  (balanceContext) => [
    ...simulationEffectFacts(requireSkillFromContext(balanceContext, ID.SOUL_SHARDS).effects, 'per Soul Shard consumed')
      .facts,
    skillFact(
      balanceContext,
      ID.SOUL_SHARDS,
      'threshold',
      'Soul Shard target health threshold',
      (value) => `${tooltipDecimal(value * 100)}%`
    ),
    skillFact(
      balanceContext,
      ID.SOUL_SHARDS,
      'damageMultiplier',
      'Soul Shard damage below threshold',
      tooltipFactorChange
    )
  ]
);

const distressTooltip: DescribeSimulationTooltip = skillTooltip(
  "Consume this follow-up, reset Perforate's recharge, and gain Soul Shards. Includes the additional Soul Shards for the simulator's single target."
);

const minionTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const summon = requireSkillFromContext(balanceContext, entity.id);
  const profileId = summon.summonAttackId as import('#gw2/platform/skills/types.js').SkillId;
  const profile = requireSkillFromContext(balanceContext, profileId);
  const effects = simulationEffectFacts(profile.effects, 'per minion attack cycle');
  return {
    ...effects,
    description:
      "Summon persistent minions that attack independently and unlock their command skill. Summon recharge begins when the corresponding minions die. Attack values use the minion's own attributes." +
      (profile.alternateEvery ? ' The alternate volley replaces the normal volley at the listed cadence.' : ''),
    facts: [
      skillFact(balanceContext, entity.id, 'minionCount', 'Minions summoned'),
      skillFact(balanceContext, profileId, 'pulseInterval', 'Base attack cycle', tooltipSeconds),
      ...(profile.alternateEvery
        ? [skillFact(balanceContext, profileId, 'alternateEvery', 'Alternate volley every N cycles')]
        : []),
      ...effects.facts
    ]
  };
};

const minionCommandTooltip: DescribeSimulationTooltip = skillTooltip(
  'Command the corresponding active minion to apply these effects. A consumed minion is removed; surviving minions resume their autonomous attacks.',
  (_c, entity) =>
    entity.consumes == null
      ? []
      : [{ name: 'Minions consumed', detail: tooltipDecimal(tooltipNumber(entity, 'consumes')) }]
);

const corruptionTooltip: DescribeSimulationTooltip = skillTooltip(
  'Applies the listed target effects and self-conditions. Master of Corruption adds its listed self-condition. Expertise does not extend self-conditions; they can be transferred to the target.',
  (balanceContext, skill) =>
    simulationEffectFacts(
      tooltipProfile(balanceContext, TRAIT.MASTER_OF_CORRUPTION).effects?.filter(
        (effect) => effect.metadata?.trigger === String(skill.id)
      ),
      'with Master of Corruption'
    ).facts
);

// Ordinary templates already contribute their facts; do not repeat first-hit packets through a second reader.
const darkPactTooltip: DescribeSimulationTooltip = skillTooltip(
  'Strike and bleed your target. The first hit also immobilizes the target and makes you bleed. The simulated target has no boons to remove, so this skill generates no life force.'
);

const lifeSiphonTooltip: DescribeSimulationTooltip = skillTooltip(
  'Channel repeated strikes. The first hit makes you bleed. Healing is outside combat simulation scope.'
);

const devouringDarknessTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id);

  if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);

  return {
    description:
      'Strike your target and apply Torment for each distinct condition already on it. Count conditions before this attack applies its own Torment.',
    facts: [
      ...simulationEffectFacts(selected.effects?.filter((effect) => effect.type === 'strike')).facts,
      ...simulationEffectFacts(
        selected.effects?.filter((effect) => effect.type === 'condition'),
        'per distinct target condition'
      ).facts,
      { name: 'Condition Threshold', detail: String(tooltipNumber(selected, 'maximumConditions')) }
    ]
  };
};

const weaponSwapTooltip: DescribeSimulationTooltip = skillTooltip(
  'Swap to your other weapon set and trigger applicable weapon-swap effects.'
);

/** Compose core skills and trait-line tooltips from the selected balance data. */
export const necromancerCoreTooltips = {
  skillFacts: (_c, entity) =>
    // Facts read the same accepted-effect and cast declarations that execute the resource rewards.
    [...castLifeForceGrants(entity), ...(entity.effects ?? []).flatMap(effectLifeForceGrants)]
      .flatMap((action) => [
        {
          name: action.label,
          detail: lifeForce(action.amount.parameters.percent)
        },
        ...(action.amount.parameters.perCondition
          ? [{ name: 'Life force per condition', detail: lifeForce(action.amount.parameters.perCondition.percent) }]
          : [])
      ])
      .concat(
        entity.lifeForceCost == null
          ? []
          : [
              {
                name: 'Life force spent',
                // Match whole-point in-game facts without rounding the cost used by simulation.
                detail: tooltipNumber(entity, 'lifeForceCost').toLocaleString('en-US', {
                  maximumFractionDigits: 0
                })
              }
            ]
      ),
  skills: {
    [ID.OPPRESSIVE_COLLAPSE]: oppressiveCollapseTooltip,
    [ID.PLAGUE_SIGNET]: conditionTransferTooltip,
    [ID.DEATHLY_SWARM]: conditionTransferTooltip,
    [ID.PUTRID_MARK]: conditionTransferTooltip,
    [ID.LICH_FORM]: lichTooltip,
    [ID.DARK_PATH]: flipTooltip,
    [ID.RIPPLE_OF_HORROR]: flipTooltip,
    [ID.SUMMON_MADNESS]: summonMadnessTooltip,
    [ID.GRASPING_DARKNESS]: graspingDarknessTooltip,
    [ID.NIGHTFALL]: nightfallTooltip,
    [ID.CHILLING_SCYTHE]: chillingScytheTooltip,
    [ID.DEADLY_SLICE]: deadlySliceTooltip,
    [ID.SINISTER_STAB]: sinisterStabTooltip,
    [ID.EXTIRPATE]: extirpateTooltip,
    [ID.ADDLE]: addleTooltip,
    [ID.PERFORATE]: perforateTooltip,
    [ID.DISTRESS]: distressTooltip,
    [ID.DEATH_SHROUD]: shroudTooltip,
    [ID.END_DEATH_SHROUD]: shroudTooltip,
    [ID.SUMMON_BONE_FIEND]: minionTooltip,
    [ID.SUMMON_BONE_MINIONS]: minionTooltip,
    [ID.SUMMON_BLOOD_FIEND]: minionTooltip,
    [ID.SUMMON_SHADOW_FIEND]: minionTooltip,
    [ID.SUMMON_FLESH_GOLEM]: minionTooltip,
    [ID.PUTRID_EXPLOSION]: minionCommandTooltip,
    [ID.RIGOR_MORTIS]: minionCommandTooltip,
    [ID.TASTE_OF_DEATH]: minionCommandTooltip,
    [ID.HAUNT]: minionCommandTooltip,
    [ID.CHARGE]: minionCommandTooltip,
    [ID.BLOOD_IS_POWER]: corruptionTooltip,
    [ID.CONSUME_CONDITIONS]: corruptionTooltip,
    [ID.PLAGUELANDS]: corruptionTooltip,
    [ID.CORROSIVE_POISON_CLOUD]: corruptionTooltip,
    [ID.DARK_PACT]: darkPactTooltip,
    [ID.LIFE_SIPHON]: lifeSiphonTooltip,
    [ID.DEVOURING_DARKNESS]: devouringDarknessTooltip,
    [SHARED_SKILL_IDS.SWAP_WEAPONS]: weaponSwapTooltip,
    [SHARED_SKILL_IDS.DODGE]: skillTooltip(
      'Spend 50 endurance to dodge. Mark of Evasion triggers Lesser Mark of Blood when the dodge finishes in combat.'
    ),
    [ID.LOCUST_SWARM]: skillTooltip(
      "Pulse life siphon every half second, gaining life force on each landed impact, and grant party swiftness. Banshee's Wail increases siphon base damage, pulse count, and swiftness duration."
    ),
    // Passive signet tuning is selected from the same skill as its active effects.
    [ID.SIGNET_OF_SPITE]: skillTooltip(
      'Passively grants power while its passive is available. Activate to inflict the listed conditions.',
      (context) => [skillFact(context, ID.SIGNET_OF_SPITE, 'attributeBonuses.power', 'Passive power')]
    ),
    [ID.SIGNET_OF_UNDEATH]: skillTooltip(
      'Periodically generates life force while its passive is available. Allied revival is outside combat simulation scope.',
      (context) => [
        skillFact(context, ID.SIGNET_OF_UNDEATH, 'lifeForceGain', 'Passive life force per pulse', lifeForce),
        skillFact(context, ID.SIGNET_OF_UNDEATH, 'pulseInterval', 'Passive pulse interval', tooltipSeconds)
      ]
    ),
    [ID.SIGNET_OF_VAMPIRISM]: skillTooltip(
      'Periodically siphons life while its passive is available. Activation triggers the listed active life-siphon attacks. Healing is outside combat simulation scope.',
      (balanceContext) => [
        skillFact(balanceContext, ID.SIGNET_OF_VAMPIRISM, 'pulseInterval', 'Passive pulse interval', tooltipSeconds)
      ]
    ),
    [ID.GRAVEDIGGER]: skillTooltip(
      "Deliver a heavy strike. Completing the cast below half target health resets this skill's recharge; Chilling Scythe can also reset it."
    ),
    [-4]: skillTooltip('Leave Lich Form, restore your weapon skills, and gain life force.'),
    [ID.NECROTIC_GRASP]: skillTooltip('Send a projectile through your target and generate life force on a hit.')
  },
  traits: {
    ...necromancerSpiteTooltips,
    ...necromancerCursesTooltips,
    ...necromancerDeathMagicTooltips,
    ...necromancerBloodMagicTooltips,
    ...necromancerSoulReapingTooltips
  }
} satisfies ProfessionTooltips;
