import {
  fromModifier,
  fromProfile,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  skillTooltip,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipNumber,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  NECROMANCER_MINION_PROFILE_BY_SKILL_ID,
  NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE
} from '#gw2/professions/necromancer/core/profiles.js';
import {
  castLifeForceGrants,
  effectLifeForceGrants
} from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { actualNecromancerLifeForceCost } from '#gw2/professions/necromancer/core/state.js';
import { dhuumfireProjection } from '#gw2/professions/necromancer/core/traits/soul-reaping/procs.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { getActiveTraits } from '#gw2/professions/necromancer/data/traits-data.js';
import { darkBarrageEffects } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/dark-barrage.js';
import {
  HARBINGER_BALANCE_PROFILE_IDS as HARBINGER,
  HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID
} from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import {
  RITUALIST_SPIRIT_SKILL_IDS,
  spiritAttackEffects
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-projection.js';
import { RITUALIST_BALANCE_PROFILE_IDS as RITUALIST } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import { shadeDhuumfireParameters } from '#gw2/professions/necromancer/specializations/scourge/mechanics/shade-projection.js';
import { SCOURGE_BALANCE_PROFILE_IDS as SCOURGE } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';

const lifeForce = (value: number) => `${value}% life force`;

/** Base and empowered packets are alternatives; spending happens before the elixir grants fresh Blight. */
const empoweredSkill: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id);
  if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);
  const profile = tooltipProfile(balanceContext, HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(entity.id)]);
  const elixir = selected.categories?.includes('Elixir');
  const base = simulationEffectFacts(selected.effects);
  const empowered = simulationEffectFacts(profile.effects);
  return {
    description: elixir
      ? "Throw an elixir. With enough Blight, consume the required stacks and use the empowered effects instead. Gain fresh Blight after the attack. Twisted Medicine shares the elixir's boons with your party."
      : `Strike your target. With enough Blight, consume the required stacks and use the empowered effects instead.${Number(entity.id) === ID.VORACIOUS_ARC ? ' Also apply control: daze normally, or fear with Doom Approaches.' : ''}`,
    facts: [
      { name: 'Blight required and consumed', detail: String(tooltipNumber(profile, 'blightCost')) },
      ...(elixir ? [{ name: 'Blight gained afterward', detail: String(tooltipNumber(profile, 'blightGain')) }] : [])
    ],
    factTabs: [
      { label: 'Base effects', facts: base.facts },
      { label: 'Enhanced effects', facts: empowered.facts }
    ],
    incomplete: base.incomplete || empowered.incomplete
  };
};

/** Describes implemented Necromancer mechanics locally; numbers remain in selected rules and profiles. */
const barrierTooltip: DescribeSimulationTooltip = skillTooltip(
  'Apply these effects and trigger selected Scourge traits that grant boons when you apply barrier. Barrier absorption and incoming damage are outside simulation scope.'
);

const oppressiveCollapseTooltip: DescribeSimulationTooltip = skillTooltip(
  "Strike and control your target. Gain party might for each distinct condition on the target when its strike lands, up to the skill's condition limit."
);

const shadeTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const id = Number(entity.id);
  const description = (
    {
      [ID.MANIFEST_SAND_SHADE]:
        'Manifest a timed shade and strike your target. Shade skills share this strike and Torment application. Sand Savant replaces the ordinary shade limit and lifetime with its greater-shade values.',
      [ID.NEFARIOUS_FAVOR]:
        'Trigger the shared shade attack and remove an active self-condition type. Sadistic Searing adds its Burning effect.',
      [ID.SAND_CASCADE]:
        'Trigger the shared shade attack and applicable barrier traits. Barrier absorption is outside simulation scope.',
      [ID.GARISH_PILLAR]: 'Trigger the shared shade attack and fear your target.',
      [ID.DESERT_SHROUD]:
        'Trigger the shared shade attack, followed by repeated strikes and Torment. Activates applicable shroud and barrier traits.',
      [ID.SANDSTORM_SHROUD]:
        'Trigger the shared shade attack, pulse party protection and barrier traits, then detonate for damage, Torment, and a final protection grant. Activates applicable shroud traits.'
    } as Record<number, string>
  )[id];
  if (!description) throw new Error(`Unknown shade skill: ${id}`);
  const profileId = (
    {
      [ID.GARISH_PILLAR]: SCOURGE.garishPillar,
      [ID.DESERT_SHROUD]: SCOURGE.desertShroud,
      [ID.SANDSTORM_SHROUD]: SCOURGE.sandstormShroud
    } as Record<number, string>
  )[id];
  const shared = simulationEffectFacts(
    tooltipProfile(balanceContext, SCOURGE.shade).effects?.filter((effect) => effect.type !== 'buff'),
    'shared shade attack'
  );
  return {
    description,
    facts: [
      ...shared.facts,
      ...(profileId ? simulationEffectFacts(tooltipProfile(balanceContext, profileId).effects).facts : []),
      ...(id === ID.MANIFEST_SAND_SHADE
        ? [
            profileFact(balanceContext, SCOURGE.shade, 'maximumStacks', 'Maximum ordinary shades'),
            ...simulationEffectFacts(
              tooltipProfile(balanceContext, SCOURGE.shade).effects?.filter((effect) => effect.type === 'buff'),
              'ordinary shade'
            ).facts,
            profileFact(balanceContext, TRAIT.SAND_SAVANT, 'maximumStacks', 'Maximum shades with Sand Savant'),
            ...simulationEffectFacts(
              tooltipProfile(balanceContext, TRAIT.SAND_SAVANT).effects,
              'with Sand Savant; replaces ordinary shade'
            ).facts
          ]
        : [])
    ]
  };
};

const innervateTooltip: DescribeSimulationTooltip = skillTooltip(
  'Command the corresponding active spirit to apply its listed effects and restore life force. The spirit must be available for the command.'
);

// Project charge grants from the selected build so the skill card agrees with Wielder's Boon's runtime grant.
const weaponSpellTooltip: DescribeSimulationTooltip = (balanceContext, entity, _specialization, build) => {
  const skill = balanceContext.catalog.skillsById.get(entity.id);
  if (!skill) throw new Error(`Missing tooltip skill: ${entity.id}`);
  const empowered = getActiveTraits(build?.specializations).some(({ id }) => id === TRAIT.WIELDERS_BOON);
  const effects = (skill.effects ?? []).map((effect) => {
    if (effect.type !== 'buff' || !['nightmare-weapon', 'splinter-weapon'].includes(String(effect.kind)))
      return simulationEffectFacts([effect]);
    const personal = tooltipNumber(effect, 'stacks');
    const allied = empowered ? personal : tooltipNumber(effect, 'allyStacks');
    return simulationEffectFacts(
      [{ ...effect, allyStacks: undefined }],
      `${personal} charges on yourself · ${allied} charges on each ally`
    );
  });
  const profileId = (
    {
      [ID.NIGHTMARE_WEAPON]: RITUALIST.nightmareWeaponProc,
      [ID.SPLINTER_WEAPON]: RITUALIST.splinterWeaponProc
    } as Record<number, string>
  )[Number(entity.id)];
  return {
    description:
      'Grant weapon-spell charges to yourself and eligible party recipients. Their qualifying strikes spend charges to trigger the listed attack, with an independent interval for each recipient.' +
      (empowered ? " Wielder's Boon is selected: allies receive your full charge count." : ''),
    incomplete: effects.some((model) => model.incomplete),
    facts: [
      ...effects.flatMap((model) => model.facts),
      ...(profileId
        ? [
            ...simulationEffectFacts(tooltipProfile(balanceContext, profileId).effects, 'per charge spent').facts,
            profileFact(balanceContext, profileId, 'internalCooldown', 'Minimum interval per recipient', tooltipSeconds)
          ]
        : [])
    ]
  };
};

// Spirit owners select named attack roles; this layer formats their selected summon and command packets.
const ritualistTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id);
  if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);
  const id = Number(entity.id);
  if (id === ID.ESSENCE_BLAST)
    return skillTooltip("Strike your target. Each active spirit increases this attack's damage.", [
      fromModifier('necromancer.essence-blast-active-spirits', 'damagePerSpirit', 'Strike damage per active spirit')
    ])(balanceContext, entity);
  if (id === ID.SUMMON_SPIRITS)
    return {
      description:
        'Command available active spirits to perform their coordinated attacks. Spirits still in their opening attack cannot participate. Wanderlust also dazes; Preservation has no direct damage from this command.',
      facts: RITUALIST_SPIRIT_SKILL_IDS.flatMap((skillId) => {
        const attack = spiritAttackEffects(balanceContext, skillId)!.active;
        return attack
          ? simulationEffectFacts([attack], `requires ${balanceContext.catalog.skillsById.get(skillId)!.name}`).facts
          : [];
      })
    };
  const attacks = spiritAttackEffects(balanceContext, id)!;
  const { profile } = attacks;
  return {
    description:
      'Summon or replace this spirit, apply its opening effects, and start its autonomous attacks. Busy spirits skip recurring attack opportunities.' +
      (id === ID.ANGUISH
        ? ' Anguish opens with cripple and vulnerability; its first barrage hit applies Painful Bond for recurring damage.'
        : id === ID.WANDERLUST
          ? ' Wanderlust opens with a strike and a lingering field that successively applies chill, vulnerability, weakness, and slow.'
          : ' Preservation grants party protection and vigor.'),
    facts: [
      ...simulationEffectFacts(selected.effects, 'on summon').facts,
      ...simulationEffectFacts(
        [attacks.autoattack, attacks.initial, attacks.lingering].flatMap((effect) => (effect ? [effect] : []))
      ).facts,
      ...simulationEffectFacts(
        profile.effects?.filter((effect) => effect.type === 'condition'),
        'opening conditions'
      ).facts,
      profileFact(
        balanceContext,
        RITUALIST.resources,
        'pulseInterval',
        'Autonomous attack pulse interval',
        tooltipSeconds
      ),
      ...(id === ID.ANGUISH
        ? [
            ...simulationEffectFacts(
              tooltipProfile(balanceContext, RITUALIST.painfulBond).effects?.filter((effect) => effect.type === 'buff')
            ).facts,
            ...simulationEffectFacts(
              tooltipProfile(balanceContext, RITUALIST.painfulBond).effects?.filter(
                (effect) => effect.type === 'strike'
              ),
              'per Painful Bond pulse'
            ).facts,
            profileFact(
              balanceContext,
              RITUALIST.painfulBond,
              'pulseInterval',
              'Painful Bond pulse interval',
              tooltipSeconds
            )
          ]
        : [])
    ]
  };
};

const darkBarrageTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id);
  if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);
  const base = simulationEffectFacts(selected.effects, 'without Doom Approaches');
  const profile = tooltipProfile(balanceContext, HARBINGER.darkBarrageDoomApproaches);
  const replacement = simulationEffectFacts(
    darkBarrageEffects(profile, profile.effects ?? []),
    'with Doom Approaches; replaces base volley'
  );
  return {
    description:
      'Channel a volley of strikes, each applying Torment. Doom Approaches replaces the ordinary volley with a faster sequence. Interruption retains only the projectiles already fired.',
    facts: [...base.facts, ...replacement.facts],
    incomplete: base.incomplete || replacement.incomplete
  };
};

const conditionTransferTooltip: DescribeSimulationTooltip = skillTooltip(
  "Transfer the oldest distinct self-condition types to your target, up to this skill's transfer limit. Transfer every stack of each selected type with its remaining duration.",
  (_context, skill) => [
    { name: 'Conditions Transferred', detail: tooltipDecimal(tooltipNumber(skill, 'conditionsTransferred')) }
  ]
);

const lichTooltip: DescribeSimulationTooltip = skillTooltip(
  'Enter Lich Form to replace your weapon skills temporarily. Leaving the form restores your weapon bar and grants life force. This transform uses its own duration instead of draining life force.'
);

const flipTooltip: DescribeSimulationTooltip = skillTooltip(
  'Apply these effects and unlock the corresponding temporary follow-up. Using a follow-up consumes its availability.'
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
      { name: 'Horrors summoned', detail: String(tooltipNumber(selected, 'summons')) },
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
    ...simulationEffectFacts(tooltipProfile(balanceContext, PROFILE.soulShards).effects, 'per Soul Shard consumed')
      .facts,
    profileFact(
      balanceContext,
      PROFILE.soulShards,
      'threshold',
      'Soul Shard target health threshold',
      (value) => `${tooltipDecimal(value * 100)}%`
    ),
    profileFact(
      balanceContext,
      PROFILE.soulShards,
      'damageMultiplier',
      'Soul Shard damage below threshold',
      tooltipFactorChange
    )
  ]
);

const distressTooltip: DescribeSimulationTooltip = skillTooltip(
  "Consume this follow-up, reset Perforate's recharge, and gain Soul Shards. Includes the additional Soul Shards for the simulator's single target."
);

const elixirTooltip: DescribeSimulationTooltip = empoweredSkill;

const blightSkillTooltip: DescribeSimulationTooltip = empoweredSkill;

const shroudTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id);
  if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);
  if (selected.shroudExit)
    return {
      description:
        'Leave shroud, restore your weapon skills, and begin the shroud-entry recharge. Triggers applicable shroud-exit traits.',
      facts: []
    };
  const profileId = String(selected.shroudProfileId);
  return {
    description: `Enter shroud, replace your weapon skills, and trigger applicable shroud-entry traits. Life force drains while shroud is active.${selected.shroudEntry === 'harbinger' ? " Gain Blight on the shroud's recurring resource pulse." : ''}`,
    facts: [
      {
        name: 'Minimum life force to enter',
        detail: lifeForce(tooltipNumber(selected, 'minimumShroudLifeForcePercent'))
      },
      profileFact(balanceContext, profileId, 'lifeForceDrain', 'Life force drained per second', lifeForce),
      ...(selected.shroudEntry === 'harbinger'
        ? [
            profileFact(balanceContext, profileId, 'blightGain', 'Blight per pulse'),
            profileFact(balanceContext, profileId, 'pulseInterval', 'Blight pulse interval', tooltipSeconds)
          ]
        : [])
    ]
  };
};

const minionTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const profileId = NECROMANCER_MINION_PROFILE_BY_SKILL_ID[Number(entity.id)];
  const profile = tooltipProfile(balanceContext, profileId);
  const effects = simulationEffectFacts(profile.effects, 'per minion attack cycle');
  return {
    ...effects,
    description:
      "Summon persistent minions that attack independently and unlock their command skill. Summon recharge begins when the corresponding minions die. Attack values use the minion's own attributes." +
      (profile.alternateEvery ? ' The alternate volley replaces the normal volley at the listed cadence.' : ''),
    facts: [
      profileFact(balanceContext, profileId, 'minionCount', 'Minions summoned'),
      profileFact(balanceContext, profileId, 'pulseInterval', 'Base attack cycle', tooltipSeconds),
      ...(profile.alternateEvery
        ? [profileFact(balanceContext, profileId, 'alternateEvery', 'Alternate volley every N cycles')]
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

const darkPactTooltip: DescribeSimulationTooltip = skillTooltip(
  'Strike and bleed your target. The first hit also immobilizes the target and makes you bleed. The simulated target has no boons to remove, so this skill generates no life force.',
  (balanceContext) =>
    simulationEffectFacts(tooltipProfile(balanceContext, PROFILE.darkPactOnHit).effects, 'on the first hit').facts
);

const lifeSiphonTooltip: DescribeSimulationTooltip = skillTooltip(
  'Channel repeated strikes. The first hit makes you bleed. Healing is outside combat simulation scope.',
  (balanceContext) =>
    simulationEffectFacts(tooltipProfile(balanceContext, PROFILE.lifeSiphonOnHit).effects, 'on the first hit').facts
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

export const necromancerTooltips: ProfessionTooltips = {
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
                detail: actualNecromancerLifeForceCost(tooltipNumber(entity, 'lifeForceCost')).toLocaleString('en-US', {
                  maximumFractionDigits: 0
                })
              }
            ]
      ),
  skills: {
    // Custom descriptions bind to canonical skill IDs independently of execution registration.
    [ID.SERPENT_SIPHON]: barrierTooltip,
    [ID.SAND_FLARE]: barrierTooltip,
    [ID.OPPRESSIVE_COLLAPSE]: oppressiveCollapseTooltip,
    [ID.NEFARIOUS_FAVOR]: shadeTooltip,
    [ID.SAND_CASCADE]: shadeTooltip,
    [ID.GARISH_PILLAR]: shadeTooltip,
    [ID.DESERT_SHROUD]: shadeTooltip,
    [ID.MANIFEST_SAND_SHADE]: shadeTooltip,
    [ID.SANDSTORM_SHROUD]: shadeTooltip,
    [ID.INNERVATE_PRESERVATION]: innervateTooltip,
    [ID.INNERVATE_WANDERLUST]: innervateTooltip,
    [ID.INNERVATE_ANGUISH]: innervateTooltip,
    [ID.NIGHTMARE_WEAPON]: weaponSpellTooltip,
    [ID.SPLINTER_WEAPON]: weaponSpellTooltip,
    [ID.SUMMON_SPIRITS]: ritualistTooltip,
    [ID.PRESERVATION]: ritualistTooltip,
    [ID.ANGUISH]: ritualistTooltip,
    [ID.WANDERLUST]: ritualistTooltip,
    [ID.ESSENCE_BLAST]: ritualistTooltip,
    [ID.DARK_BARRAGE]: darkBarrageTooltip,
    [ID.PLAGUE_SIGNET]: conditionTransferTooltip,
    [ID.DEATHLY_SWARM]: conditionTransferTooltip,
    [ID.PUTRID_MARK]: conditionTransferTooltip,
    [ID.SUFFER]: conditionTransferTooltip,
    [ID.LICH_FORM]: lichTooltip,
    [ID.DARK_PATH]: flipTooltip,
    [ID.RIPPLE_OF_HORROR]: flipTooltip,
    [ID.INFUSING_TERROR]: flipTooltip,
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
    [ID.ELIXIR_OF_BLISS]: elixirTooltip,
    [ID.ELIXIR_OF_RISK]: elixirTooltip,
    [ID.ELIXIR_OF_IGNORANCE]: elixirTooltip,
    [ID.ELIXIR_OF_AMBITION]: elixirTooltip,
    [ID.ELIXIR_OF_ANGUISH]: elixirTooltip,
    [ID.ELIXIR_OF_PROMISE]: elixirTooltip,
    [ID.VORACIOUS_ARC]: blightSkillTooltip,
    [ID.DEVOURING_CUT]: blightSkillTooltip,
    [ID.DEATH_SHROUD]: shroudTooltip,
    [ID.END_DEATH_SHROUD]: shroudTooltip,
    [ID.EXIT_HARBINGER_SHROUD]: shroudTooltip,
    [ID.HARBINGER_SHROUD]: shroudTooltip,
    [ID.REAPERS_SHROUD]: shroudTooltip,
    [ID.EXIT_REAPERS_SHROUD]: shroudTooltip,
    [ID.EXIT_RITUALISTS_SHROUD]: shroudTooltip,
    [ID.RITUALISTS_SHROUD]: shroudTooltip,
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
    // Passive signet packets have separate profile IDs and must accompany the active skill facts.
    [ID.SIGNET_OF_SPITE]: skillTooltip(
      'Passively grants power while its passive is available. Activate to inflict the listed conditions.',
      [fromProfile(PROFILE.signetOfSpite, 'attributeBonus', 'Passive power')]
    ),
    [ID.SIGNET_OF_UNDEATH]: skillTooltip(
      'Periodically generates life force while its passive is available. Allied revival is outside combat simulation scope.',
      [
        fromProfile(PROFILE.signetOfUndeathPassive, 'lifeForceGain', 'Passive life force per pulse', lifeForce),
        fromProfile(PROFILE.signetOfUndeathPassive, 'pulseInterval', 'Passive pulse interval', tooltipSeconds)
      ]
    ),
    [ID.SIGNET_OF_VAMPIRISM]: skillTooltip(
      'Periodically siphons life while its passive is available. Activation triggers the listed active life-siphon attacks. Healing is outside combat simulation scope.',
      (balanceContext) => [
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, PROFILE.signetOfVampirismPassive).effects,
          'per passive pulse'
        ).facts,
        profileFact(
          balanceContext,
          PROFILE.signetOfVampirismPassive,
          'pulseInterval',
          'Passive pulse interval',
          tooltipSeconds
        )
      ]
    ),
    [ID.RESILIENT_WEAPON]: skillTooltip(
      "Grant Resilient Weapon charges to yourself and eligible party recipients. Wielder's Boon grants allies your full charge count. Its defensive effects add no damage within simulation scope."
    ),
    [ID.GRAVEDIGGER]: skillTooltip(
      "Deliver a heavy strike. Completing the cast below half target health resets this skill's recharge; Chilling Scythe can also reset it."
    ),
    [ID.DEATHS_CHARGE]: skillTooltip('Charge through your target, striking repeatedly and applying blindness.'),
    [-4]: skillTooltip('Leave Lich Form, restore your weapon skills, and gain life force.'),
    [ID.NECROTIC_GRASP]: skillTooltip('Send a projectile through your target and generate life force on a hit.')
  },
  traits: {
    [TRAIT.REAPERS_MIGHT]: traitTooltip(
      'The first hit of shroud skill 1 grants might.',
      undefined,
      'on shroud skill 1'
    ),
    // Shroud-entry boons and imperative procs are not included in the automatic trait-profile facts.
    [TRAIT.AWAKEN_THE_PAIN]: traitTooltip('Might grants additional power. Entering shroud grants might.', [
      ['attributePerStack', 'Power per stack of might']
    ]),
    [TRAIT.SIPHONED_POWER]: traitTooltip(
      'Striking a low-health target grants might.',
      [
        ['cooldown', 'Internal cooldown', tooltipSeconds],
        ['threshold', 'Target health below', tooltipPercent]
      ],
      'against a low-health target'
    ),
    [TRAIT.SPITEFUL_TALISMAN]: traitTooltip('Increases strike damage.', [
      fromProfile(TRAIT.SPITEFUL_TALISMAN, 'damageMultiplier', 'Strike damage', tooltipFactorChange)
    ]),
    [TRAIT.MALICIOUS_SWARM]: traitTooltip('Using a healing skill triggers a Lesser Signet of the Locust strike.', [
      ['cooldown', 'Base skill recharge', tooltipSeconds]
    ]),
    [TRAIT.BITTER_CHILL]: traitTooltip('Applying chill also applies vulnerability.'),
    [TRAIT.CHILL_OF_DEATH]: traitTooltip(
      'Striking a low-health target triggers Lesser Spinal Shivers. Its strike applies chill; target boon removal is not simulated.',
      [
        ['cooldown', 'Internal cooldown', tooltipSeconds],
        ['threshold', 'Target health below', tooltipPercent]
      ]
    ),
    [TRAIT.SPITEFUL_FORTITUDE]: traitTooltip(
      'Gain vitality from power. Player strikes against a low-health target generate life force.',
      [
        ['attributeConversion', 'Power converted to vitality', tooltipPercent],
        ['threshold', 'Life force target health threshold', tooltipPercent],
        ['lifeForceGain', 'Life force gained', lifeForce]
      ]
    ),
    [TRAIT.SIGNETS_OF_SUFFERING]: traitTooltip(
      'Activating a signet deals life-steal damage. Signet passives remain active while recharging in shroud.'
    ),
    [TRAIT.DREAD]: traitTooltip('Fear briefly increases your strike damage.', [
      ['duration', 'Damage bonus duration', tooltipSeconds],
      fromProfile(TRAIT.DREAD, 'damageIncrease', 'Strike damage', tooltipPercent)
    ]),
    [TRAIT.CLOSE_TO_DEATH]: traitTooltip('Deal increased strike damage to low-health targets.', [
      ['threshold', 'Target health below', tooltipPercent],
      fromProfile(TRAIT.CLOSE_TO_DEATH, 'damageMultiplier', 'Strike damage', tooltipFactorChange)
    ]),
    [TRAIT.SPITEFUL_SPIRIT]: traitTooltip('Entering shroud triggers a strike.'),
    [TRAIT.BARBED_PRECISION]: traitTooltip(
      'Eligible critical hits can inflict bleeding. Your bleeding lasts longer.',
      [
        ['criticalChance', 'Chance on critical hit', tooltipPercent],
        ['conditionDurationMultiplier', 'Bleeding duration', tooltipFactorChange]
      ],
      'on eligible critical hits'
    ),
    [TRAIT.FURIOUS_DEMISE]: traitTooltip('Gain precision. Entering shroud grants fury.', [
      ['attributeBonus', 'Precision']
    ]),
    [TRAIT.TARGET_THE_WEAK]: traitTooltip(
      'Gain condition damage from precision and critical-strike chance for each condition on the target.',
      [
        ['attributeConversion', 'Precision converted to condition damage', tooltipPercent],
        ['criticalChancePerCondition', 'Critical chance per target condition', tooltipPercent],
        // The selected profile exposes its condition cap alongside the per-condition critical chance.
        ['maximumConditions', 'Maximum conditions counted']
      ]
    ),
    [TRAIT.INSIDIOUS_DISRUPTION]: traitTooltip('Applying a control effect inflicts torment.', undefined, 'on control'),
    [TRAIT.PLAGUE_SENDING]: traitTooltip(
      'Entering shroud or using the supported shade trigger arms a transfer of self-applied conditions on the qualifying hit.',
      [['maximumConditions', 'Maximum self-condition applications transferred']]
    ),
    [TRAIT.CHILLING_DARKNESS]: traitTooltip(
      'Applying blind also inflicts chill.',
      [['cooldown', 'Internal cooldown', tooltipSeconds]],
      'on blind'
    ),
    [TRAIT.MASTER_OF_CORRUPTION]: traitTooltip(
      'Corruption skills recharge faster and apply additional self-conditions that can be transferred.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Corruption recharge reduction', (value) =>
          tooltipPercent(1 - value)
        )
      ]
    ),
    [TRAIT.PATH_OF_CORRUPTION]: outsideScopeTooltip,
    [TRAIT.PARASITIC_CONTAGION]: outsideScopeTooltip,
    [TRAIT.WEAKENING_SHROUD]: traitTooltip(
      'Entering shroud strikes and inflicts bleeding and weakness with Lesser Enfeeble.'
    ),
    [TRAIT.TERROR]: traitTooltip("Fear applications also apply the simulator's damaging Fear condition.", [
      ['conditionBaseDamage', 'Base damage'],
      ['conditionDamageScaling', 'Condition damage scaling']
    ]),
    [TRAIT.LINGERING_CURSE]: traitTooltip(
      'Gain condition damage, extend scepter conditions, and replace Feast of Corruption with Devouring Darkness.',
      [
        ['attributeBonus', 'Condition damage'],
        ['durationMultiplier', 'Scepter condition duration', tooltipFactorChange]
      ]
    ),
    [TRAIT.ARMORED_SHROUD]: traitTooltip('Entering shroud grants carapace.', [
      ['resourceGain', 'Carapace on shroud entry'],
      ['duration', 'Carapace duration', tooltipSeconds]
    ]),
    [TRAIT.SOUL_COMPREHENSION]: traitTooltip(
      'Entering shroud generates life force for each carapace stack already active before entry grants.',
      [
        ['lifeForcePerStack', 'Life force per current carapace stack', lifeForce],
        ['maximumStacks', 'Maximum carapace stacks counted']
      ]
    ),
    [TRAIT.BEYOND_THE_VEIL]: outsideScopeTooltip,
    [TRAIT.FLESH_OF_THE_MASTER]: traitTooltip('Your minions grant carapace stacks.', [
      ['resourceGain', 'Carapace per minion'],
      ['maximumStacks', 'Maximum carapace']
    ]),
    [TRAIT.PUTRID_DEFENSE]: traitTooltip('Poison deals increased damage.', [
      fromProfile(TRAIT.PUTRID_DEFENSE, 'conditionDamageMultiplier', 'Poison damage', tooltipFactorChange)
    ]),
    [TRAIT.SHROUDED_REMOVAL]: traitTooltip(
      'Entering shroud removes active self-condition applications. Successful removal grants carapace.',
      [
        ['resourceGain', 'Carapace per successful removal'],
        ['duration', 'Carapace duration', tooltipSeconds],
        ['maximumConditions', 'Maximum self-condition applications removed']
      ]
    ),
    [TRAIT.NECROMANTIC_CORRUPTION]: traitTooltip('Your minions deal increased strike damage.', [
      ['damageMultiplier', 'Minion strike damage', tooltipFactorChange]
    ]),
    [TRAIT.DARK_DEFENSE]: traitTooltip('Using a healing skill grants carapace and protection.', [
      ['resourceGain', 'Carapace'],
      ['duration', 'Carapace duration', tooltipSeconds],
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.DEADLY_STRENGTH]: traitTooltip('Carapace grants power and condition damage.', [
      ['attributePerStack', 'Power and condition damage per carapace']
    ]),
    [TRAIT.DEATH_NOVA]: outsideScopeTooltip,
    [TRAIT.CORRUPTERS_FERVOR]: traitTooltip('Qualifying non-summon condition applications grant carapace.', [
      ['resourceGain', 'Carapace per qualifying condition application'],
      ['duration', 'Carapace duration', tooltipSeconds]
    ]),
    [TRAIT.UNHOLY_SANCTUARY]: outsideScopeTooltip,
    [TRAIT.MARK_OF_EVASION]: traitTooltip(
      'Completing a dodge in combat triggers Lesser Mark of Blood, striking and bleeding the target and granting party regeneration.'
    ),
    [TRAIT.VAMPIRIC]: traitTooltip(
      'Eligible player and creature attacks trigger life-steal damage. Healing is outside simulation scope.'
    ),
    [TRAIT.LAST_RITES]: traitTooltip('Gain healing power at full player health.', [
      ['attributeBonus', 'Healing power']
    ]),
    [TRAIT.RITUAL_OF_LIFE]: outsideScopeTooltip,
    [TRAIT.OVERFLOWING_THIRST]: traitTooltip(
      'Dagger skills grant Taste for Blood. Each recipient consumes their own stacks on eligible hits to deal life-steal damage.',
      [['minimumStacks', 'Necrotic Bite stacks']]
    ),
    [TRAIT.BLOOD_RENEWAL]: outsideScopeTooltip,
    [TRAIT.LIFE_FROM_DEATH]: outsideScopeTooltip,
    [TRAIT.BANSHEES_WAIL]: traitTooltip(
      'Increase Locust Swarm siphon base damage, pulse count, and swiftness duration. Power scaling is unchanged.',
      [
        ['durationMultiplier', 'Effectiveness', tooltipFactorChange],
        ['pulseInterval', 'Extended pulse interval', tooltipSeconds]
      ]
    ),
    [TRAIT.VAMPIRIC_PRESENCE]: traitTooltip(
      'Eligible player, creature, and configured allied hits trigger life-steal damage once Vampiric Aura is up; the first aura pulse is assumed half an interval after combat starts. The stronger payload applies to every recipient while you are in shroud.',
      [
        ['cooldown', 'Internal cooldown per recipient', tooltipSeconds],
        ['auraPulseInterval', 'Vampiric Aura pulse interval', tooltipSeconds]
      ]
    ),
    [TRAIT.BLOOD_BANK]: outsideScopeTooltip,
    [TRAIT.UNHOLY_MARTYR]: outsideScopeTooltip,
    [TRAIT.TRANSFUSION]: traitTooltip(
      'Shroud skill 4 triggers Lesser Chilblains. Allied revival and healing are outside simulation scope.'
    ),
    [TRAIT.GLUTTONY]: traitTooltip('Life force gains are increased.', [
      ['lifeForceGainMultiplier', 'Life-force gains', tooltipFactorChange]
    ]),
    [TRAIT.SINISTER_SHROUD]: traitTooltip('Shroud and shade skills recharge faster.', [
      ['rechargeMultiplier', 'Shroud and shade recharge reduction', (value) => tooltipPercent(1 - value)]
    ]),
    [TRAIT.SOUL_BATTERY]: traitTooltip('Increases maximum life force.', [
      ['lifeForceCapacityMultiplier', 'Maximum life-force capacity', tooltipFactorChange]
    ]),
    [TRAIT.UNYIELDING_BLAST]: traitTooltip(
      'The first hit of shroud skill 1 inflicts vulnerability.',
      undefined,
      'on shroud skill 1'
    ),
    [TRAIT.SOUL_MARKS]: traitTooltip('Mark skills generate additional life force.', [
      ['lifeForceGain', 'Life force per landed mark', lifeForce]
    ]),
    [TRAIT.SPEED_OF_SHADOWS]: traitTooltip('Entering shroud grants swiftness.'),
    [TRAIT.SOUL_BARBS]: traitTooltip('Entering or leaving shroud briefly increases strike and condition damage.', [
      fromProfile(TRAIT.SOUL_BARBS, 'damageIncrease', 'Strike and siphon damage', tooltipPercent),
      fromProfile(TRAIT.SOUL_BARBS, 'conditionDamageIncrease', 'Condition damage', tooltipPercent),
      ['duration', 'Damage bonus duration', tooltipSeconds]
    ]),
    [TRAIT.VITAL_PERSISTENCE]: traitTooltip('Gain vitality.', [['attributeBonus', 'Vitality']]),
    [TRAIT.FEAR_OF_DEATH]: traitTooltip(
      'Landing fear from a non-summon source generates life force, subject to its internal cooldown.',
      [
        ['lifeForceGain', 'Life force gained', lifeForce],
        ['internalCooldown', 'Internal cooldown', tooltipSeconds]
      ]
    ),
    [TRAIT.ETERNAL_LIFE]: traitTooltip(
      "Regenerate life force below the trait's threshold while outside shroud. Entering shroud grants protection.",
      [
        ['lifeForceGain', 'Life force regenerated per pulse outside shroud', lifeForce],
        ['pulseInterval', 'Life-force pulse interval', tooltipSeconds],
        ['threshold', 'Life-force threshold (below)', (value) => `${tooltipDecimal(value * 100)}%`]
      ]
    ),
    [TRAIT.DEATH_PERCEPTION]: traitTooltip(
      'Gain critical-strike chance. Critical strikes deal more damage while in shroud.',
      [
        ['criticalChance', 'Critical chance', tooltipPercent],
        ['criticalDamage', 'Critical damage while in shroud', tooltipFactorChange]
      ]
    ),
    // Compose owner-provided overrides with Core's same named Burning projection used by hit reactions.
    [TRAIT.DHUUMFIRE]: (context, _entity, specialization) => {
      const scourge = specialization === 'Scourge';
      const { effect, interval } = dhuumfireProjection(
        context,
        scourge ? shadeDhuumfireParameters(tooltipProfile(context, SCOURGE.shade)) : undefined,
        specialization === 'Harbinger' ? context.catalog.skillsById.get(ID.TAINTED_BOLTS)?.dhuumfireDuration : undefined
      );
      const effects = simulationEffectFacts(effect ? [effect] : [], scourge ? 'on shade strikes' : 'on shroud skill 1');
      return {
        ...effects,
        description: scourge ? 'Shade strikes inflict burning.' : 'Shroud skill 1 inflicts burning.',
        facts: [...effects.facts, ...(scourge ? [{ name: 'Internal cooldown', detail: tooltipSeconds(interval) }] : [])]
      };
    },
    [TRAIT.SHROUD_KNIGHT]: traitTooltip("This specialization uses Reaper's Shroud and its melee shroud skills."),
    [TRAIT.SHIVERS_OF_DREAD]: traitTooltip('Applying fear also inflicts chill.', undefined, 'on fear'),
    [TRAIT.COLD_SHOULDER]: traitTooltip('Deal increased strike damage to chilled targets.', [
      fromProfile(TRAIT.COLD_SHOULDER, 'damageMultiplier', 'Strike damage against chilled targets', tooltipFactorChange)
    ]),
    [TRAIT.AUGURY_OF_DEATH]: traitTooltip(
      'Shouts trigger life-steal damage. The simulator assumes melee range, including the doubled siphon damage.',
      undefined,
      'on shout'
    ),
    [TRAIT.CHILLING_NOVA]: traitTooltip(
      'Critical hits against chilled targets trigger an explosion and chill.',
      [['cooldown', 'Internal cooldown', tooltipSeconds]],
      'on eligible critical hit'
    ),
    [TRAIT.RELENTLESS_PURSUIT]: outsideScopeTooltip,
    [TRAIT.SOUL_EATER]: traitTooltip(
      'Deal increased strike damage; the simulator always assumes a nearby target. Healing is outside simulation scope.',
      [fromProfile(TRAIT.SOUL_EATER, 'damageMultiplier', 'Strike damage near target', tooltipFactorChange)]
    ),
    [TRAIT.CHILLING_VICTORY]: traitTooltip('Striking chilled targets generates life force.', [
      ['lifeForceGain', 'Life force gained', lifeForce],
      ['cooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.DECIMATE_DEFENSES]: traitTooltip('Gain critical-strike chance for vulnerability on the target.', [
      ['criticalChancePerStack', 'Critical chance per vulnerability stack', tooltipPercent],
      ['maximumStacks', 'Maximum counted stacks', String]
    ]),
    [TRAIT.BLIGHTERS_BOON]: traitTooltip('Gaining boons generates life force.', [
      ['lifeForceGain', 'Life force gained', lifeForce]
    ]),
    [TRAIT.DEATHLY_CHILL]: traitTooltip('Applying chill also inflicts bleeding.', undefined, 'on chill'),
    [TRAIT.REAPERS_ONSLAUGHT]: traitTooltip(
      "Gain ferocity in Reaper's Shroud. Completing the shroud autoattack chain reduces shroud skill recharge.",
      [
        ['attributeBonus', 'Ferocity in shroud'],
        ['rechargeReduction', 'Recharge reduction', tooltipSeconds]
      ]
    ),
    [TRAIT.MANTLE_OF_SAND]: traitTooltip('This specialization replaces shroud with sand shade skills.'),
    [TRAIT.SAND_SAGE]: traitTooltip('Gain expertise and concentration while a sand shade is active.', [
      ['attributeBonus', 'Expertise and concentration']
    ]),
    [TRAIT.BLOOD_AS_SAND]: outsideScopeTooltip,
    [TRAIT.ABRASIVE_GRIT]: traitTooltip(
      'Supported barrier applications grant might to recipients.',
      undefined,
      'on barrier application'
    ),
    [TRAIT.FELL_BEACON]: traitTooltip('Gain expertise from condition damage and increase burning damage.', [
      ['attributeConversion', 'Condition damage converted to expertise', tooltipPercent],
      fromProfile(TRAIT.FELL_BEACON, 'conditionDamageMultiplier', 'Burning damage', tooltipFactorChange)
    ]),
    [TRAIT.NOURISHING_ASHES]: traitTooltip(
      'Burning applications generate life force, subject to an internal cooldown.',
      [
        ['lifeForceGain', 'Life force gained', lifeForce],
        ['cooldown', 'Internal cooldown', tooltipSeconds]
      ]
    ),
    [TRAIT.FEED_FROM_CORRUPTION]: outsideScopeTooltip,
    [TRAIT.SADISTIC_SEARING]: traitTooltip('Nefarious Favor inflicts burning.'),
    [TRAIT.HERALD_OF_SORROW]: traitTooltip('Replaces Desert Shroud with Sandstorm Shroud and its barrier pulses.'),
    [TRAIT.SAND_SAVANT]: traitTooltip('Use a single greater sand shade with adjusted shade recharge.', [
      ['maximumStacks', 'Maximum shades'],
      ['rechargePenalty', 'Shade recharge multiplier', (value) => `${value}×`]
    ]),
    [TRAIT.DEMONIC_LORE]: traitTooltip(
      'Torment deals increased damage and can trigger burning.',
      [
        ['cooldown', 'Internal cooldown', tooltipSeconds],
        fromProfile(TRAIT.DEMONIC_LORE, 'conditionDamageMultiplier', 'Torment damage', tooltipFactorChange)
      ],
      'on torment'
    ),
    [TRAIT.DESERT_EMPOWERMENT]: traitTooltip(
      'Supported barrier applications grant alacrity to recipients.',
      undefined,
      'on barrier application'
    ),
    [TRAIT.DARK_DISCIPLE]: traitTooltip(
      'This specialization uses Harbinger Shroud and accumulates blight. Variable player health is not simulated.'
    ),
    [TRAIT.ALCHEMIC_VIGOR]: traitTooltip('Gain vitality.', [['attributeBonus', 'Vitality']]),
    [TRAIT.CORRUPTED_TALENT]: traitTooltip('Entering Harbinger Shroud generates life force.', [
      ['lifeForceGain', 'Life force gained', lifeForce]
    ]),
    [TRAIT.WICKED_CORRUPTION]: traitTooltip(
      'Blight increases strike damage. Critical strikes deal more damage to targets with torment.',
      [
        fromProfile(TRAIT.WICKED_CORRUPTION, 'damageIncreasePerStack', 'Strike damage per blight', tooltipPercent),
        ['criticalDamage', 'Critical damage against tormented targets', tooltipFactorChange]
      ]
    ),
    [TRAIT.BOLSTERING_BREW]: traitTooltip('Elixirs grant protection.', undefined, 'on elixir'),
    [TRAIT.SEPTIC_CORRUPTION]: (balanceContext, entity) => {
      const profile = tooltipProfile(balanceContext, entity.id);
      const effects = simulationEffectFacts(profile.effects, 'on shroud skill 2');
      return {
        ...effects,
        description:
          'Blight increases condition damage.' +
          (profile.effects?.some((effect) => effect.type === 'condition' && effect.condition === 'Poisoned')
            ? ' Shroud skill 2 also inflicts poison.'
            : ''),
        facts: [
          profileFact(
            balanceContext,
            TRAIT.SEPTIC_CORRUPTION,
            'conditionDamageIncreasePerStack',
            'Condition damage per blight',
            tooltipPercent
          ),
          ...effects.facts
        ]
      };
    },
    [TRAIT.IMPLACABLE_FOE]: traitTooltip(
      'Gain ferocity from vitality. Entering Harbinger Shroud grants stability and the Implacable Foe buff.',
      [['attributeConversion', 'Vitality converted to ferocity', tooltipPercent]]
    ),
    [TRAIT.TWISTED_MEDICINE]: traitTooltip('Gain concentration from vitality. Elixir boons are shared with allies.', [
      ['attributeConversion', 'Vitality converted to concentration', tooltipPercent]
    ]),
    [TRAIT.DARK_GUNSLINGER]: traitTooltip('Gain expertise from vitality. Pistol skills recharge faster.', [
      ['attributeConversion', 'Vitality converted to expertise', tooltipPercent],
      ['rechargeMultiplier', 'Pistol recharge reduction', (value) => tooltipPercent(1 - value)]
    ]),
    [TRAIT.CASCADING_CORRUPTION]: traitTooltip(
      'Consuming enough blight triggers Meltdown, strike damage, and torment. Meltdown increases strike and condition damage.',
      [
        ['minimumStacks', 'Blight consumed per trigger'],
        fromProfile(TRAIT.CASCADING_CORRUPTION, 'damageIncrease', 'Strike damage during Meltdown', tooltipPercent),
        fromProfile(
          TRAIT.CASCADING_CORRUPTION,
          'conditionDamageIncrease',
          'Condition damage during Meltdown',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.DEATHLY_HASTE]: traitTooltip(
      'Entering Harbinger Shroud and casting Dark Barrage grant quickness and fury to the party.'
    ),
    [TRAIT.DOOM_APPROACHES]: traitTooltip(
      'Gain additional blight in Harbinger Shroud. Tainted Bolts inflicts vulnerability, and Dark Barrage uses its alternate sequence.',
      [['blightGain', 'Blight gained per pulse']]
    ),
    [TRAIT.SPAWNING_POWER]: traitTooltip(
      'This specialization summons spirits and uses soul shards and Innervate commands.'
    ),
    [TRAIT.BOON_OF_CREATION]: traitTooltip('Gain concentration. Summoning a creature generates life force.', [
      ['attributeBonus', 'Concentration'],
      ['lifeForceGain', 'Life force per creature summoned', lifeForce]
    ]),
    [TRAIT.CHARGED_SOULS]: traitTooltip(
      'Unlock Innervate skills that command your active spirits. Each Innervate restores life force.'
    ),
    [TRAIT.WANDERING_SPIRITS]: outsideScopeTooltip,
    [TRAIT.SPIRITS_GIFT]: outsideScopeTooltip,
    [TRAIT.EXPLOSIVE_GROWTH]: traitTooltip('Summoning a creature triggers a strike.'),
    [TRAIT.SPIRITS_REMEDY]: outsideScopeTooltip,
    [TRAIT.EMPOWERING_SPIRITS]: traitTooltip('Spirit interactions grant the modeled party boons.'),
    [TRAIT.SPIRITS_STRENGTH]: traitTooltip('Increase autonomous creature damage. Innervate attacks are excluded.', [
      ['damageMultiplier', 'Creature strike damage', tooltipFactorChange]
    ]),
    [TRAIT.WIELDERS_BOON]: traitTooltip(
      'Nightmare Weapon and Splinter Weapon grant each eligible ally as many charges as you receive, replacing their reduced ally charge count. Your own charge count stays the same.',
      // Read both counts from the selected skills so the explanation also follows balance previews.
      (context) =>
        [ID.NIGHTMARE_WEAPON, ID.SPLINTER_WEAPON].flatMap((id) => {
          const skill = context.catalog.skillsById.get(id)!;
          return (skill.effects ?? [])
            .filter((effect) => effect.type === 'buff')
            .map((effect) => ({
              name: skill.name,
              icon: skill.icon,
              detail: `${tooltipNumber(effect, 'allyStacks')} → ${tooltipNumber(effect, 'stacks')} charges per ally`
            }));
        })
    ),
    [TRAIT.LINGERING_SPIRITS]: traitTooltip(
      'Spirits persist through the modeled shroud transition. Active Anguish increases strike damage.',
      [fromProfile(TRAIT.LINGERING_SPIRITS, 'damageIncrease', 'Strike damage with Anguish active', tooltipPercent)]
    ),
    [TRAIT.SOUL_TWISTING]: traitTooltip(
      "Entering Ritualist's Shroud causes your next spirit summon to clear its own cooldown."
    )
  }
};
