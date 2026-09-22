import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  tooltipNumber,
  tooltipDecimal,
  type DescribeSimulationTooltip,
  profileFact,
  modifierFact,
  tooltipPercent,
  tooltipProfile,
  simulationEffectFacts,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import {
  NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE,
  NECROMANCER_CORRUPTION_PROFILE_IDS,
  NECROMANCER_MINION_PROFILE_BY_SKILL_ID
} from '#gw2/professions/necromancer/core/profiles.js';
import {
  HARBINGER_BALANCE_PROFILE_IDS as HARBINGER,
  HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID
} from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import { SCOURGE_BALANCE_PROFILE_IDS as SCOURGE } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';
import {
  RITUALIST_BALANCE_PROFILE_IDS as RITUALIST,
  RITUALIST_SPIRIT_PROFILE_BY_SKILL_ID
} from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import { actualNecromancerLifeForceCost } from '#gw2/professions/necromancer/core/state.js';

const lifeForce = (value: number) => `${value}% life force`;

/** Base and empowered packets are alternatives; spending happens before the elixir grants fresh Blight. */
const empoweredSkill: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id);
  if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);
  const profile = tooltipProfile(balanceContext, HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(entity.id)]);
  const elixir = selected.handlerId === 'necromancer.elixir';
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
export const necromancerTooltips: ProfessionTooltips = {
  skillFacts: (_c, entity) =>
    Object.entries({
      lifeForceGain: 'Life force on cast completion',
      lifeForcePerCondition: 'Life force per condition',
      lifeForcePerHit: 'Life force per hit',
      lifeForcePerPulse: 'Life force per pulse',
      lifeForceOnHit: 'Life force on hit',
      innervateLifeForceGain: 'Life force on innervate'
    })
      .flatMap(([field, name]) =>
        entity[field] == null ? [] : [{ name, detail: lifeForce(tooltipNumber(entity, field)) }]
      )
      .concat(
        entity.lifeForceCost == null
          ? []
          : [
              {
                name: 'Life force spent',
                detail: tooltipDecimal(actualNecromancerLifeForceCost(tooltipNumber(entity, 'lifeForceCost')))
              }
            ]
      ),
  handlers: {
    'necromancer.barrier': skillTooltip(
      'Apply these effects and trigger selected Scourge traits that grant boons when you apply barrier. Barrier absorption and incoming damage are outside simulation scope.'
    ),
    'necromancer.oppressive-collapse': skillTooltip(
      "Strike and control your target. Gain party might for each distinct condition on the target at cast completion, up to the skill's condition limit."
    ),
    'necromancer.shade': (balanceContext, entity) => {
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
                profileFact(balanceContext, SCOURGE.sandSavant, 'maximumStacks', 'Maximum shades with Sand Savant'),
                ...simulationEffectFacts(
                  tooltipProfile(balanceContext, SCOURGE.sandSavant).effects,
                  'with Sand Savant; replaces ordinary shade'
                ).facts
              ]
            : [])
        ]
      };
    },
    'necromancer.innervate': skillTooltip(
      'Command the corresponding active spirit to apply its listed effects and restore life force. The spirit must be available for the command.'
    ),
    'necromancer.weapon-spell': skillTooltip(
      "Grant weapon-spell charges to yourself and eligible party recipients. Their qualifying strikes spend charges to trigger the listed attack, with an independent interval for each recipient. Wielder's Boon grants allies your full charge count.",
      (balanceContext, entity) => {
        const profileId = (
          {
            [ID.NIGHTMARE_WEAPON]: RITUALIST.nightmareWeaponProc,
            [ID.SPLINTER_WEAPON]: RITUALIST.splinterWeaponProc
          } as Record<number, string>
        )[Number(entity.id)];
        return profileId
          ? [
              ...simulationEffectFacts(tooltipProfile(balanceContext, profileId).effects, 'per charge spent').facts,
              profileFact(
                balanceContext,
                profileId,
                'internalCooldown',
                'Minimum interval per recipient',
                tooltipSeconds
              )
            ]
          : [];
      }
    ),
    'necromancer.ritualist': (balanceContext, entity) => {
      const selected = balanceContext.catalog.skillsById.get(entity.id);
      if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);
      const id = Number(entity.id);
      if (id === ID.ESSENCE_BLAST)
        return skillTooltip("Strike your target. Each active spirit increases this attack's damage.", (context) => [
          modifierFact(
            context,
            'necromancer.essence-blast-active-spirits',
            'damagePerSpirit',
            'Strike damage per active spirit'
          )
        ])(balanceContext, entity);
      if (id === ID.SUMMON_SPIRITS)
        return {
          description:
            'Command available active spirits to perform their coordinated attacks. Spirits still in their opening attack cannot participate. Wanderlust also dazes; Preservation has no direct damage from this command.',
          facts: [
            ...simulationEffectFacts(
              tooltipProfile(balanceContext, RITUALIST.anguish).effects?.slice(2, 3),
              'requires Anguish'
            ).facts,
            ...simulationEffectFacts(
              tooltipProfile(balanceContext, RITUALIST.wanderlust).effects?.slice(3, 4),
              'requires Wanderlust'
            ).facts
          ]
        };
      const profile = tooltipProfile(balanceContext, RITUALIST_SPIRIT_PROFILE_BY_SKILL_ID[id]);
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
          ...simulationEffectFacts(profile.effects?.slice(0, id === ID.WANDERLUST ? 3 : 2)).facts,
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
                  tooltipProfile(balanceContext, RITUALIST.painfulBond).effects?.filter(
                    (effect) => effect.type === 'buff'
                  )
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
    },
    'necromancer.dark-barrage': (balanceContext, entity) => {
      const selected = balanceContext.catalog.skillsById.get(entity.id);
      if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);
      const base = simulationEffectFacts(selected.effects, 'without Doom Approaches');
      const profile = tooltipProfile(balanceContext, HARBINGER.darkBarrageDoomApproaches);
      const replacement = simulationEffectFacts(
        profile.effects?.map((effect) => ({ ...effect, applications: tooltipNumber(profile, 'pulseCount') })),
        'with Doom Approaches; per projectile, replaces base volley'
      );
      return {
        description:
          'Channel a volley of strikes, each applying Torment. Doom Approaches replaces the ordinary volley with a faster sequence. Interruption retains only the projectiles already fired.',
        facts: [...base.facts, ...replacement.facts],
        incomplete: base.incomplete || replacement.incomplete
      };
    },
    'necromancer.condition-transfer': skillTooltip(
      "Transfer the oldest distinct self-condition types to your target, up to this skill's transfer limit. Transfer every stack of each selected type with its remaining duration.",
      (_context, skill) => [
        { name: 'Conditions Transferred', detail: tooltipDecimal(tooltipNumber(skill, 'conditionsTransferred')) }
      ]
    ),
    'necromancer.lich': skillTooltip(
      'Enter Lich Form to replace your weapon skills temporarily. Leaving the form restores your weapon bar and grants life force. This transform uses its own duration instead of draining life force.'
    ),
    'necromancer.flip': skillTooltip(
      'Apply these effects and unlock the corresponding temporary follow-up. Using a follow-up consumes its availability.'
    ),
    'necromancer.summon-madness': (balanceContext, entity) => {
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
    },
    'necromancer.grasping-darkness': skillTooltip(
      'Launch a delayed strike that chills and pulls your target. Gain life force when it hits. Once launched, the projectile survives a later interruption.'
    ),
    'necromancer.nightfall': skillTooltip(
      'Create a pulsing field that strikes, blinds, and cripples your target. Each strike pulse generates life force. Committed pulses survive interruption.'
    ),
    'necromancer.chilling-scythe': skillTooltip(
      "Strike and chill your target. A committed hit resets Gravedigger's recharge."
    ),
    'necromancer.deadly-slice': skillTooltip('Strike your target and gain a Soul Shard after the attack.'),
    'necromancer.sinister-stab': skillTooltip('Strike and chill your target, then gain a Soul Shard.'),
    'necromancer.extirpate': skillTooltip(
      'Strike your target, gain might, and apply weakness and the Extirpation marker. The first hit grants Soul Shards. Target boon denial is outside simulation scope.'
    ),
    'necromancer.addle': skillTooltip(
      'Strike and daze your target, gaining Soul Shards. Having enough Soul Shards before activation also immobilizes the target. Against a defiant target or one activating skills, gain additional life force and Soul Shards.'
    ),
    'necromancer.perforate': skillTooltip(
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
    ),
    'necromancer.distress': skillTooltip(
      "Consume this follow-up, reset Perforate's recharge, and gain Soul Shards. Includes the additional Soul Shards for the simulator's single target."
    ),
    'necromancer.elixir': empoweredSkill,
    'necromancer.blight-skill': empoweredSkill,
    'necromancer.shroud': (balanceContext, entity) => {
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
    },
    'necromancer.minion': (balanceContext, entity) => {
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
    },
    'necromancer.minion-command': skillTooltip(
      'Command the corresponding active minion to apply these effects. A consumed minion is removed; surviving minions resume their autonomous attacks.',
      (_c, entity) =>
        entity.consumes == null
          ? []
          : [{ name: 'Minions consumed', detail: tooltipDecimal(tooltipNumber(entity, 'consumes')) }]
    ),
    'necromancer.corruption': skillTooltip(
      'Applies the listed target effects and self-conditions. Master of Corruption adds its listed self-condition. Expertise does not extend self-conditions; they can be transferred to the target.',
      (balanceContext, entity) => {
        const profileId = NECROMANCER_CORRUPTION_PROFILE_IDS[entity.id];
        return profileId ? simulationEffectFacts(tooltipProfile(balanceContext, profileId).effects).facts : [];
      }
    ),
    'necromancer.dark-pact': skillTooltip(
      'Strike and bleed your target. The first hit also immobilizes the target and makes you bleed. The simulated target has no boons to remove, so this skill generates no life force.',
      (balanceContext) =>
        simulationEffectFacts(tooltipProfile(balanceContext, PROFILE.darkPactOnHit).effects, 'on the first hit').facts
    ),
    'necromancer.life-siphon': skillTooltip(
      'Channel repeated strikes. The first hit makes you bleed. Healing is outside combat simulation scope.',
      (balanceContext) =>
        simulationEffectFacts(tooltipProfile(balanceContext, PROFILE.lifeSiphonOnHit).effects, 'on the first hit').facts
    ),
    'necromancer.devouring-darkness': (balanceContext, entity) => {
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
    },
    'necromancer.weapon-swap': skillTooltip('Swap to your other weapon set and trigger applicable weapon-swap effects.')
  },
  skills: {
    // Passive signet packets have separate profile IDs and must accompany the active skill facts.
    [ID.SIGNET_OF_SPITE]: skillTooltip(
      'Passively grants power while its passive is available. Activate to inflict the listed conditions.',
      (balanceContext) => [profileFact(balanceContext, PROFILE.signetOfSpite, 'attributeBonus', 'Passive power')]
    ),
    [ID.SIGNET_OF_UNDEATH]: skillTooltip(
      'Periodically generates life force while its passive is available. Allied revival is outside combat simulation scope.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          PROFILE.signetOfUndeathPassive,
          'lifeForceGain',
          'Passive life force per pulse',
          lifeForce
        ),
        profileFact(
          balanceContext,
          PROFILE.signetOfUndeathPassive,
          'pulseInterval',
          'Passive pulse interval',
          tooltipSeconds
        )
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
    [TRAIT.AWAKEN_THE_PAIN]: traitTooltip(
      'Might grants additional power. Entering shroud grants might.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'attributePerStack', 'Power per stack of might')]
    ),
    [TRAIT.SIPHONED_POWER]: traitTooltip(
      'Striking a low-health target grants might.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'cooldown', 'Internal cooldown', tooltipSeconds)],
      'against a low-health target'
    ),
    [TRAIT.SPITEFUL_TALISMAN]: traitTooltip('Increases strike damage.', (balanceContext) => [
      modifierFact(balanceContext, 'necromancer.spiteful-talisman', 'factor', 'Strike damage', tooltipFactorChange)
    ]),
    [TRAIT.MALICIOUS_SWARM]: traitTooltip(
      'Using a healing skill triggers a Lesser Signet of the Locust strike.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.BITTER_CHILL]: traitTooltip('Applying chill also applies vulnerability.'),
    [TRAIT.CHILL_OF_DEATH]: traitTooltip(
      'Striking a low-health target triggers Lesser Spinal Shivers. Its strike applies chill; target boon removal is not simulated.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'cooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.SPITEFUL_FORTITUDE]: traitTooltip(
      'Gain vitality from power. Player strikes against a low-health target generate life force.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeConversion', 'Power converted to vitality', tooltipPercent),
        profileFact(balanceContext, id, 'lifeForceGain', 'Life force gained', lifeForce)
      ]
    ),
    [TRAIT.SIGNETS_OF_SUFFERING]: traitTooltip(
      'Activating a signet deals life-steal damage. Signet passives remain active while recharging in shroud.'
    ),
    [TRAIT.DREAD]: traitTooltip('Fear briefly increases your strike damage.', (balanceContext) => [
      modifierFact(balanceContext, 'necromancer.dread', 'amount', 'Strike damage')
    ]),
    [TRAIT.CLOSE_TO_DEATH]: traitTooltip('Deal increased strike damage to low-health targets.', (balanceContext) => [
      modifierFact(balanceContext, 'necromancer.close-to-death', 'factor', 'Strike damage', tooltipFactorChange)
    ]),
    [TRAIT.SPITEFUL_SPIRIT]: traitTooltip('Entering shroud triggers a strike.'),
    [TRAIT.BARBED_PRECISION]: traitTooltip(
      'Eligible critical hits can inflict bleeding. Your bleeding lasts longer.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'criticalChance', 'Chance on critical hit', tooltipPercent),
        profileFact(
          balanceContext,
          TRAIT.BARBED_PRECISION,
          'conditionDurationMultiplier',
          'Bleeding duration',
          tooltipFactorChange
        )
      ],
      'on eligible critical hits'
    ),
    [TRAIT.FURIOUS_DEMISE]: traitTooltip('Gain precision. Entering shroud grants fury.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'attributeBonus', 'Precision')
    ]),
    [TRAIT.TARGET_THE_WEAK]: traitTooltip(
      'Gain condition damage from precision and critical-strike chance for each condition on the target.',
      (balanceContext, id) => [
        profileFact(
          balanceContext,
          id,
          'attributeConversion',
          'Precision converted to condition damage',
          tooltipPercent
        ),
        profileFact(
          balanceContext,
          TRAIT.TARGET_THE_WEAK,
          'criticalChancePerCondition',
          'Critical chance per target condition',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.INSIDIOUS_DISRUPTION]: traitTooltip('Applying a control effect inflicts torment.', undefined, 'on control'),
    [TRAIT.PLAGUE_SENDING]: traitTooltip(
      'Entering shroud or using the supported shade trigger arms a transfer of self-applied conditions on the qualifying hit.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'maximumConditions', 'Maximum self-condition applications transferred')
      ]
    ),
    [TRAIT.CHILLING_DARKNESS]: traitTooltip(
      'Applying blind also inflicts chill.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'cooldown', 'Internal cooldown', tooltipSeconds)],
      'on blind'
    ),
    [TRAIT.MASTER_OF_CORRUPTION]: traitTooltip(
      'Corruption skills recharge faster and apply additional self-conditions that can be transferred.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Corruption recharge reduction', (value) =>
          tooltipPercent(1 - value)
        ),
        ...Object.entries(NECROMANCER_CORRUPTION_PROFILE_IDS).flatMap(
          ([skillId, profileId]) =>
            simulationEffectFacts(
              tooltipProfile(balanceContext, profileId).effects?.filter(
                (effect) => effect.requiredTrait === TRAIT.MASTER_OF_CORRUPTION
              ),
              balanceContext.catalog.skillsById.get(Number(skillId))!.name
            ).facts
        )
      ]
    ),
    [TRAIT.PATH_OF_CORRUPTION]: outsideScopeTooltip,
    [TRAIT.PARASITIC_CONTAGION]: outsideScopeTooltip,
    [TRAIT.WEAKENING_SHROUD]: traitTooltip(
      'Entering shroud strikes and inflicts bleeding and weakness with Lesser Enfeeble.'
    ),
    [TRAIT.TERROR]: traitTooltip("Fear applications also apply the simulator's damaging Fear condition."),
    [TRAIT.LINGERING_CURSE]: traitTooltip(
      'Gain condition damage, extend scepter conditions, and replace Feast of Corruption with Devouring Darkness.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Condition damage'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Scepter condition duration', tooltipFactorChange)
      ]
    ),
    [TRAIT.ARMORED_SHROUD]: traitTooltip('Entering shroud grants carapace.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'resourceGain', 'Carapace on shroud entry'),
      profileFact(balanceContext, id, 'duration', 'Carapace duration', tooltipSeconds)
    ]),
    [TRAIT.SOUL_COMPREHENSION]: traitTooltip(
      'Entering shroud generates life force for each carapace stack already active before entry grants.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'lifeForcePerStack', 'Life force per current carapace stack', lifeForce),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum carapace stacks counted')
      ]
    ),
    [TRAIT.BEYOND_THE_VEIL]: outsideScopeTooltip,
    [TRAIT.FLESH_OF_THE_MASTER]: traitTooltip('Your minions grant carapace stacks.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'resourceGain', 'Carapace per minion'),
      profileFact(balanceContext, id, 'maximumStacks', 'Maximum carapace')
    ]),
    [TRAIT.PUTRID_DEFENSE]: traitTooltip('Poison deals increased damage.', (balanceContext) => [
      modifierFact(balanceContext, 'necromancer.putrid-defense', 'factor', 'Poison damage', tooltipFactorChange)
    ]),
    [TRAIT.SHROUDED_REMOVAL]: traitTooltip(
      'Entering shroud removes active self-condition applications. Successful removal grants carapace.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'resourceGain', 'Carapace per successful removal'),
        profileFact(balanceContext, id, 'duration', 'Carapace duration', tooltipSeconds),
        profileFact(balanceContext, id, 'maximumConditions', 'Maximum self-condition applications removed')
      ]
    ),
    [TRAIT.NECROMANTIC_CORRUPTION]: traitTooltip('Your minions deal increased strike damage.', (balanceContext) => [
      modifierFact(
        balanceContext,
        'necromancer.necromantic-corruption',
        'factor',
        'Minion strike damage',
        tooltipFactorChange
      )
    ]),
    [TRAIT.DARK_DEFENSE]: traitTooltip(
      'Using a healing skill grants carapace and protection.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'resourceGain', 'Carapace'),
        profileFact(balanceContext, id, 'duration', 'Carapace duration', tooltipSeconds),
        profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.DEADLY_STRENGTH]: traitTooltip('Carapace grants power and condition damage.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'attributePerStack', 'Power and condition damage per carapace')
    ]),
    [TRAIT.DEATH_NOVA]: outsideScopeTooltip,
    [TRAIT.CORRUPTERS_FERVOR]: traitTooltip(
      'Qualifying non-summon condition applications grant carapace.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'resourceGain', 'Carapace per qualifying condition application'),
        profileFact(balanceContext, id, 'duration', 'Carapace duration', tooltipSeconds)
      ]
    ),
    [TRAIT.UNHOLY_SANCTUARY]: outsideScopeTooltip,
    [TRAIT.MARK_OF_EVASION]: outsideScopeTooltip,
    [TRAIT.VAMPIRIC]: traitTooltip(
      'Eligible player and creature attacks trigger life-steal damage. Healing is outside simulation scope.'
    ),
    [TRAIT.LAST_RITES]: outsideScopeTooltip,
    [TRAIT.RITUAL_OF_LIFE]: outsideScopeTooltip,
    [TRAIT.OVERFLOWING_THIRST]: traitTooltip(
      'Dagger skills grant Taste for Blood. Each recipient consumes their own stacks on eligible hits to deal life-steal damage.'
    ),
    [TRAIT.BLOOD_RENEWAL]: outsideScopeTooltip,
    [TRAIT.LIFE_FROM_DEATH]: outsideScopeTooltip,
    [TRAIT.BANSHEES_WAIL]: outsideScopeTooltip,
    [TRAIT.VAMPIRIC_PRESENCE]: traitTooltip(
      'Eligible player, creature, and configured allied hits trigger life-steal damage. The stronger payload applies in shroud.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'cooldown', 'Internal cooldown per recipient', tooltipSeconds)
      ]
    ),
    [TRAIT.BLOOD_BANK]: outsideScopeTooltip,
    [TRAIT.UNHOLY_MARTYR]: outsideScopeTooltip,
    [TRAIT.TRANSFUSION]: traitTooltip(
      'Shroud skill 4 triggers Lesser Chilblains. Allied revival and healing are outside simulation scope.'
    ),
    [TRAIT.GLUTTONY]: traitTooltip('Life force gains are increased.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'lifeForceGainMultiplier', 'Life-force gains', tooltipFactorChange)
    ]),
    [TRAIT.SINISTER_SHROUD]: traitTooltip('Shroud and shade skills recharge faster.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'rechargeMultiplier', 'Shroud and shade recharge reduction', (value) =>
        tooltipPercent(1 - value)
      )
    ]),
    [TRAIT.SOUL_BATTERY]: traitTooltip('Increases maximum life force.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'lifeForceCapacityMultiplier', 'Maximum life-force capacity', tooltipFactorChange)
    ]),
    [TRAIT.UNYIELDING_BLAST]: traitTooltip(
      'The first hit of shroud skill 1 inflicts vulnerability.',
      undefined,
      'on shroud skill 1'
    ),
    [TRAIT.SOUL_MARKS]: traitTooltip('Mark skills generate additional life force.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'lifeForceGain', 'Life force per completed mark', lifeForce)
    ]),
    [TRAIT.SPEED_OF_SHADOWS]: traitTooltip('Entering shroud grants swiftness.'),
    [TRAIT.SOUL_BARBS]: traitTooltip(
      'Entering or leaving shroud briefly increases strike and condition damage.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'necromancer.soul-barbs', 'amount', 'Strike and condition damage'),
        profileFact(balanceContext, id, 'duration', 'Damage bonus duration', tooltipSeconds)
      ]
    ),
    [TRAIT.VITAL_PERSISTENCE]: traitTooltip('Gain vitality.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'attributeBonus', 'Vitality')
    ]),
    [TRAIT.FEAR_OF_DEATH]: traitTooltip(
      'Completing a fear-producing cast generates life force, subject to its internal cooldown.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'lifeForceGain', 'Life force gained', lifeForce),
        profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.ETERNAL_LIFE]: traitTooltip(
      "Regenerate life force below the trait's threshold while outside shroud. Entering shroud grants protection.",
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'lifeForceGain', 'Life force regenerated per pulse outside shroud', lifeForce),
        profileFact(balanceContext, id, 'pulseInterval', 'Life-force pulse interval', tooltipSeconds),
        profileFact(
          balanceContext,
          id,
          'threshold',
          'Life-force threshold (below)',
          (value) => `${tooltipDecimal(value * 100)}%`
        )
      ]
    ),
    [TRAIT.DEATH_PERCEPTION]: traitTooltip(
      'Gain critical-strike chance. Critical strikes deal more damage while in shroud.',
      (balanceContext) => [
        profileFact(balanceContext, TRAIT.DEATH_PERCEPTION, 'criticalChance', 'Critical chance', tooltipPercent),
        profileFact(
          balanceContext,
          TRAIT.DEATH_PERCEPTION,
          'criticalDamage',
          'Critical damage while in shroud',
          tooltipFactorChange
        )
      ]
    ),
    // Match the selected specialization's combat override instead of always showing the core duration.
    [TRAIT.DHUUMFIRE]: (context, entity, specialization) => {
      const scourge = specialization === 'Scourge';
      const source = scourge
        ? tooltipProfile(context, SCOURGE.shade)
        : specialization === 'Harbinger'
          ? context.catalog.skillsById.get(ID.TAINTED_BOLTS)
          : undefined;
      const profile = tooltipProfile(context, entity.id);
      const effects = simulationEffectFacts(
        profile.effects?.map((effect) =>
          effect.type === 'condition' && (scourge || specialization === 'Harbinger')
            ? { ...effect, duration: tooltipNumber(source, 'dhuumfireDuration') }
            : effect
        ),
        scourge ? 'on shade strikes' : 'on shroud skill 1'
      );
      return {
        ...effects,
        description: scourge ? 'Shade strikes inflict burning.' : 'Shroud skill 1 inflicts burning.',
        facts: [
          ...effects.facts,
          ...(scourge
            ? [profileFact(context, SCOURGE.shade, 'dhuumfireInterval', 'Internal cooldown', tooltipSeconds)]
            : [])
        ]
      };
    },
    [TRAIT.SHROUD_KNIGHT]: traitTooltip("This specialization uses Reaper's Shroud and its melee shroud skills."),
    [TRAIT.SHIVERS_OF_DREAD]: traitTooltip('Applying fear also inflicts chill.', undefined, 'on fear'),
    [TRAIT.COLD_SHOULDER]: traitTooltip('Deal increased strike damage to chilled targets.', (balanceContext) => [
      modifierFact(
        balanceContext,
        'necromancer.cold-shoulder',
        'factor',
        'Strike damage against chilled targets',
        tooltipFactorChange
      )
    ]),
    [TRAIT.AUGURY_OF_DEATH]: traitTooltip(
      'Shouts trigger life-steal damage and have reduced recharge.',
      undefined,
      'on shout'
    ),
    [TRAIT.CHILLING_NOVA]: traitTooltip(
      'Critical hits against chilled targets trigger an explosion and chill.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'cooldown', 'Internal cooldown', tooltipSeconds)],
      'on eligible critical hit'
    ),
    [TRAIT.RELENTLESS_PURSUIT]: outsideScopeTooltip,
    [TRAIT.SOUL_EATER]: traitTooltip(
      'Deal increased strike damage while near your target. Healing is outside simulation scope.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'necromancer.soul-eater',
          'factor',
          'Strike damage near target',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.CHILLING_VICTORY]: traitTooltip('Striking chilled targets generates life force.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'lifeForceGain', 'Life force gained', lifeForce),
      profileFact(balanceContext, id, 'cooldown', 'Internal cooldown', tooltipSeconds)
    ]),
    [TRAIT.DECIMATE_DEFENSES]: traitTooltip(
      'Gain critical-strike chance for vulnerability on the target.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          TRAIT.DECIMATE_DEFENSES,
          'criticalChancePerStack',
          'Critical chance per vulnerability stack',
          tooltipPercent
        ),
        profileFact(balanceContext, TRAIT.DECIMATE_DEFENSES, 'maximumStacks', 'Maximum counted stacks', String)
      ]
    ),
    [TRAIT.BLIGHTERS_BOON]: traitTooltip('Gaining boons generates life force.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'lifeForceGain', 'Life force gained', lifeForce)
    ]),
    [TRAIT.DEATHLY_CHILL]: traitTooltip('Applying chill also inflicts bleeding.', undefined, 'on chill'),
    [TRAIT.REAPERS_ONSLAUGHT]: traitTooltip(
      "Gain ferocity in Reaper's Shroud. Completing the shroud autoattack chain reduces shroud skill recharge.",
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Ferocity in shroud'),
        profileFact(balanceContext, id, 'rechargeReduction', 'Recharge reduction', tooltipSeconds)
      ]
    ),
    [TRAIT.MANTLE_OF_SAND]: traitTooltip('This specialization replaces shroud with sand shade skills.'),
    [TRAIT.SAND_SAGE]: traitTooltip(
      'Gain expertise and concentration while a sand shade is active.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'attributeBonus', 'Expertise and concentration')]
    ),
    [TRAIT.BLOOD_AS_SAND]: outsideScopeTooltip,
    [TRAIT.ABRASIVE_GRIT]: traitTooltip(
      'Supported barrier applications grant might to recipients.',
      undefined,
      'on barrier application'
    ),
    [TRAIT.FELL_BEACON]: traitTooltip(
      'Gain expertise from power and increase burning damage.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeConversion', 'Power converted to expertise', tooltipPercent),
        modifierFact(balanceContext, 'necromancer.fell-beacon', 'factor', 'Burning damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.NOURISHING_ASHES]: traitTooltip(
      'Condition applications generate life force, subject to an internal cooldown.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'lifeForceGain', 'Life force gained', lifeForce),
        profileFact(balanceContext, id, 'cooldown', 'Internal cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.FEED_FROM_CORRUPTION]: outsideScopeTooltip,
    [TRAIT.SADISTIC_SEARING]: traitTooltip(
      'Punishment skills empower a subsequent shade manifestation to inflict burning.'
    ),
    [TRAIT.HERALD_OF_SORROW]: traitTooltip('Replaces Desert Shroud with Sandstorm Shroud and its barrier pulses.'),
    [TRAIT.SAND_SAVANT]: traitTooltip(
      'Use a single greater sand shade with adjusted shade recharge.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum shades'),
        profileFact(balanceContext, id, 'rechargePenalty', 'Shade recharge multiplier', (value) => `${value}×`)
      ]
    ),
    [TRAIT.DEMONIC_LORE]: traitTooltip(
      'Torment deals increased damage and can trigger burning.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'cooldown', 'Internal cooldown', tooltipSeconds),
        modifierFact(balanceContext, 'necromancer.demonic-lore', 'factor', 'Torment damage', tooltipFactorChange)
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
    [TRAIT.ALCHEMIC_VIGOR]: traitTooltip('Gain vitality.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'attributeBonus', 'Vitality')
    ]),
    [TRAIT.CORRUPTED_TALENT]: traitTooltip('Entering Harbinger Shroud generates life force.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'lifeForceGain', 'Life force gained', lifeForce)
    ]),
    [TRAIT.WICKED_CORRUPTION]: traitTooltip(
      'Blight increases strike damage. Critical strikes deal more damage to targets with torment.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'necromancer.wicked-corruption-blight',
          'damagePerStack',
          'Strike damage per blight'
        ),
        profileFact(
          balanceContext,
          TRAIT.WICKED_CORRUPTION,
          'criticalDamage',
          'Critical damage against tormented targets',
          tooltipFactorChange
        )
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
          modifierFact(
            balanceContext,
            'necromancer.septic-corruption-blight',
            'damagePerStack',
            'Condition damage per blight'
          ),
          ...effects.facts
        ]
      };
    },
    [TRAIT.IMPLACABLE_FOE]: traitTooltip(
      'Gain ferocity from vitality. Entering Harbinger Shroud grants stability and the Implacable Foe buff.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeConversion', 'Vitality converted to ferocity', tooltipPercent)
      ]
    ),
    [TRAIT.TWISTED_MEDICINE]: traitTooltip(
      'Gain concentration from vitality. Elixir boons are shared with allies.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeConversion', 'Vitality converted to concentration', tooltipPercent)
      ]
    ),
    [TRAIT.DARK_GUNSLINGER]: traitTooltip(
      'Gain expertise from vitality. Pistol skills recharge faster.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeConversion', 'Vitality converted to expertise', tooltipPercent),
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Pistol recharge reduction', (value) =>
          tooltipPercent(1 - value)
        )
      ]
    ),
    [TRAIT.CASCADING_CORRUPTION]: traitTooltip(
      'Consuming enough blight triggers Meltdown, strike damage, and torment. Meltdown increases strike and condition damage.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'minimumStacks', 'Blight consumed per trigger'),
        modifierFact(balanceContext, 'necromancer.cascading-corruption', 'amount', 'Damage during Meltdown')
      ]
    ),
    [TRAIT.DEATHLY_HASTE]: traitTooltip(
      'Entering Harbinger Shroud and casting Dark Barrage grant quickness and fury to the party.'
    ),
    [TRAIT.DOOM_APPROACHES]: traitTooltip(
      'Gain additional blight in Harbinger Shroud. Tainted Bolts inflicts vulnerability, and Dark Barrage uses its alternate sequence.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'blightGain', 'Blight gained per pulse')]
    ),
    [TRAIT.SPAWNING_POWER]: traitTooltip(
      'This specialization summons spirits and uses soul shards and Innervate commands.'
    ),
    [TRAIT.BOON_OF_CREATION]: traitTooltip(
      'Gain concentration. Summoning a creature generates life force.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Concentration'),
        profileFact(balanceContext, id, 'lifeForceGain', 'Life force per creature summoned', lifeForce)
      ]
    ),
    [TRAIT.CHARGED_SOULS]: outsideScopeTooltip,
    [TRAIT.WANDERING_SPIRITS]: outsideScopeTooltip,
    [TRAIT.SPIRITS_GIFT]: outsideScopeTooltip,
    [TRAIT.EXPLOSIVE_GROWTH]: traitTooltip(
      'Summoning a creature triggers a strike. The corresponding creature strike multiplier is increased.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'coefficientMultiplier', 'Creature strike multiplier', (value) => `${value}×`)
      ]
    ),
    [TRAIT.SPIRITS_REMEDY]: outsideScopeTooltip,
    [TRAIT.EMPOWERING_SPIRITS]: traitTooltip('Spirit interactions grant the modeled party boons.'),
    [TRAIT.SPIRITS_STRENGTH]: traitTooltip(
      'Increase autonomous creature damage. Innervate attacks are excluded.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'necromancer.spirits-strength',
          'factor',
          'Creature strike damage',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.WIELDERS_BOON]: traitTooltip('Weapon spells grant allied recipients the same stack count as the player.'),
    [TRAIT.LINGERING_SPIRITS]: traitTooltip(
      'Spirits persist through the modeled shroud transition. Active Anguish increases strike damage.',
      (balanceContext) => [
        modifierFact(balanceContext, 'necromancer.lingering-spirits', 'amount', 'Strike damage with Anguish active')
      ]
    ),
    [TRAIT.SOUL_TWISTING]: traitTooltip(
      'Consume spirits through the Soul Twisting mechanic to adjust the next spirit summon.'
    )
  }
};
