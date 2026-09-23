import {
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  profileTooltip,
  profileFact,
  modifierFact,
  tooltipPercent,
  tooltipDecimal,
  tooltipNumber,
  tooltipProfile,
  simulationEffectFacts,
  type ProfessionTooltips,
  type DescribeSimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/thief/core/profiles.js';
import { DAREDEVIL_BALANCE_PROFILE_IDS as DD } from '#gw2/professions/thief/specializations/daredevil/profiles.js';
import { DEADEYE_BALANCE_PROFILE_IDS as DE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import { SPECTER_BALANCE_PROFILE_IDS as SPECTER } from '#gw2/professions/thief/specializations/specter/profiles.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as ANTIQUARY } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { spearChainStageForSkill } from '#gw2/professions/thief/data/spear-chain-stages.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';
import type { SkillEffect, TooltipFact } from '#gw2/platform/engine/skills/types.js';
import { requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';

/** Malice changes individual packets; display their base values and name the affected packet explicitly. */
const stealthAttack: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id) as ThiefSkill;
  let effects = selected.effects || [];
  const facts: TooltipFact[] = [];
  let description =
    'Requires stealth or an available stealth-attack charge. Beginning the attack consumes that access.';
  description += selected.preservesStealth
    ? ' Leaving stealth with this attack does not apply Revealed.'
    : ' Leaving stealth applies Revealed.';
  if (selected.malicious)
    description +=
      ' Snapshots malice when the cast starts. The first hit against your active mark consumes malice; Malicious Intent can then seed the next cycle.';
  if (selected.id === ID.BACKSTAB || selected.id === ID.MALICIOUS_BACKSTAB) {
    facts.push(
      modifierFact(
        balanceContext,
        selected.malicious ? 'thief.malicious-backstab-position' : 'thief.backstab-position',
        'factor',
        'Strike damage against a defiant target',
        tooltipFactorChange
      )
    );
  }

  if (selected.id === ID.MALICIOUS_BACKSTAB || selected.id === ID.MALICIOUS_DEATHS_JUDGMENT) {
    facts.push(
      modifierFact(
        balanceContext,
        'thief.malicious-stealth-attack',
        'damagePerMalice',
        'Strike damage per malice against your mark'
      )
    );
  }

  if (selected.id === ID.MALICIOUS_SNEAK_ATTACK) {
    const profile = tooltipProfile(balanceContext, DE.maliciousSneakAttack);
    // The selected scaling profile owns the independent Torment packet.
    effects = [...effects, ...(profile.effects || [])];
    facts.push(
      profileFact(
        balanceContext,
        DE.maliciousSneakAttack,
        'durationMultiplier',
        'Additional torment duration per malice',
        tooltipSeconds
      )
    );
  }

  if (selected.id === ID.MALICIOUS_HOOK_STRIKE) {
    description += ' Quickness duration scales with snapshotted malice; no malice grants no quickness.';
    effects = effects.filter((effect) => effect.type !== 'boon');
    facts.push(
      ...simulationEffectFacts(
        selected.effects?.filter((effect) => effect.type === 'boon'),
        'duration per malice'
      ).facts
    );
  }

  if (selected.id === ID.MALICIOUS_TACTICAL_STRIKE)
    description += ' Its first marked hit also restores endurance in proportion to consumed malice.';
  if (selected.id === ID.MALICIOUS_CUNNING_SALVO || selected.id === ID.MALICIOUS_SHADOWSQUALL)
    description += " Malice extends this attack's poison duration; the values below are before malice scaling.";
  if (selected.id === ID.CUNNING_SALVO || selected.id === ID.MALICIOUS_CUNNING_SALVO)
    description += ' Its landed axe enters the shared ground-axe pool.';
  if (selected.spearStealthAttack) {
    description += ' Restores initiative on completion and resets the spear chain to its lead attacks.';
    facts.push(
      profileFact(
        balanceContext,
        selected.malicious ? DE.maliciousAshenAssault : CORE.ashenAssaultRefund,
        'resourceGain',
        'Initiative restored'
      )
    );
    if (selected.malicious) {
      description +=
        ' Malice increases only the final strike coefficient. Positive malice also adds torment on completion.';
      facts.push(
        profileFact(
          balanceContext,
          DE.maliciousAshenAssault,
          'coefficientMultiplier',
          'Final strike coefficient increase per malice',
          tooltipPercent
        ),
        profileFact(
          balanceContext,
          DE.maliciousAshenAssault,
          'durationMultiplier',
          'Additional torment duration per malice',
          tooltipSeconds
        ),
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, DE.maliciousAshenAssault).effects,
          'requires positive malice; base duration before malice'
        ).facts
      );
    }
  }

  return { description, facts: [...simulationEffectFacts(effects).facts, ...facts] };
};

/** Artifact windows supplement the native cast; charges apply to later attacks rather than adding immediate damage. */
const artifactTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id)!;
  const facts = [...simulationEffectFacts(selected.effects).facts];
  let description = 'Use and consume this held artifact. Artifact-use traits apply.';
  const window = (kryptis = false) =>
    facts.push(
      profileFact(
        balanceContext,
        ANTIQUARY.artifactWindows,
        kryptis ? 'minimumStacks' : 'durationMultiplier',
        'Effect window',
        tooltipSeconds
      ),
      profileFact(
        balanceContext,
        ANTIQUARY.artifactWindows,
        kryptis ? 'threshold' : 'maximumStacks',
        'Effect window with Meticulous Custodian',
        tooltipSeconds
      )
    );
  if (entity.id === ID.HOLO_DANCER_DECOY) {
    description +=
      ' Adds a timed charge that reduces the recharge of the next utility cast. Repeated grants queue and consume the oldest charge first.';
    window();
    facts.push(
      profileFact(
        balanceContext,
        ANTIQUARY.artifactWindows,
        'rechargeMultiplier',
        'Next utility recharge multiplier',
        (value) => `${tooltipDecimal(value)}×`
      )
    );
  } else if (entity.id === ID.CHAK_SHIELD) {
    description +=
      ' Refunds initiative spent while its window lasts. Spending still advances initiative-spending traits. Meticulous Custodian also triggers an additional strike.';
    window();
    facts.push(
      ...simulationEffectFacts(
        tooltipProfile(balanceContext, ANTIQUARY.meticulousCustodian).effects,
        'additional strike with Meticulous Custodian'
      ).facts
    );
  } else if (entity.id === ID.SUMMON_KRYPTIS_TURRET_ID_77192) {
    description += ' Starts a temporary player strike-damage bonus.';
    window(true);
    facts.push(
      modifierFact(
        balanceContext,
        'thief.kryptis-turret-damage',
        'factor',
        'Player strike damage during window',
        tooltipFactorChange
      )
    );
  } else if (entity.id === ID.MISTBURN_MORTAR) {
    description +=
      ' Grants charges that add burning to later eligible player strikes. A new grant replaces remaining charges.';
    window();
    facts.push(
      profileFact(balanceContext, ANTIQUARY.artifactWindows, 'playerStacks', 'Charged strikes'),
      ...simulationEffectFacts(
        tooltipProfile(balanceContext, ANTIQUARY.mistburnProc).effects,
        'per later charged strike'
      ).facts
    );
  } else if (entity.id === ID.METAL_LEGION_GUITAR) {
    description += ' Grants timed charges allowing stealth attacks without entering stealth.';
    window();
    facts.push(profileFact(balanceContext, ANTIQUARY.artifactWindows, 'resourceGain', 'Stealth-attack charges'));
  } else if (entity.id === ID.ZEPHYRITE_SUN_CRYSTAL) {
    description += ' Meticulous Custodian adds burning to each eligible strike.';
    facts.push(
      ...simulationEffectFacts(
        tooltipProfile(balanceContext, ANTIQUARY.sunCrystalMeticulous).effects,
        'additional burning per strike with Meticulous Custodian'
      ).facts
    );
  }

  return { description, facts };
};

/** Local wording distinguishes conditional packets from simultaneous effects and reads numbers from their owners. */
export const thiefTooltips: ProfessionTooltips = {
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
  handlers: {
    'thief.weapon-swap': skillTooltip(
      'Switch weapon sets, leave Kneel, and trigger applicable swap effects. Quick Pockets restores initiative only when swapping in combat.'
    ),
    'thief.dodge': skillTooltip(
      'Spend endurance to dodge and trigger supported dodge traits. Daredevil applies only the selected dodge package. Silent Scope can grant a stealth-attack charge when malice exceeds its threshold.',
      (balanceContext) => [
        profileFact(balanceContext, CORE.resources, 'resourceCost', 'Endurance cost'),
        ...[DD.boundingDodger, DD.lotusTraining, DD.unhinderedCombatant].flatMap((id) => {
          const profile = tooltipProfile(balanceContext, id);
          return simulationEffectFacts(profile.effects, `alternative: ${profile.name}`).facts;
        })
      ]
    ),
    'thief.steal': skillTooltip(
      'Trigger stealing traits and obtain a stolen-skill choice. Using a choice consumes the held use; Improvisation allows a second use of the same chosen skill.'
    ),
    'thief.stolen-skill': skillTooltip(
      'Use the held stolen skill and consume a use. When Improvisation permits another use, it must be the same chosen skill.'
    ),
    'thief.stealth-attack': stealthAttack,
    'thief.deadeye-stealth-attack': stealthAttack,
    'thief.spear-stealth-attack': stealthAttack,
    'thief.deadeye-spear-stealth-attack': stealthAttack,
    'thief.prepare-trap': skillTooltip(
      'Place a preparation. After its recharge-scaled arming delay, its trigger remains available until used. Placement starts the parent recharge independently.',
      (_c, selected) => [
        { name: 'Base arming delay', detail: tooltipSeconds(tooltipNumber(selected, 'durationMultiplier')) }
      ]
    ),
    'thief.activate-trap': skillTooltip(
      'Activate and consume the armed preparation. Its trigger recharge also delays the next placement if that would otherwise be ready sooner.'
    ),
    'thief.venom': (balanceContext, entity) => {
      const id =
        entity.id === ID.SPIDER_VENOM
          ? CORE.spiderVenomProc
          : entity.id === ID.SKALE_VENOM
            ? CORE.skaleVenomProc
            : CORE.devourerVenomProc;
      return profileTooltip(
        id,
        'Grant venom charges to yourself and configured allies. Each eligible player strike consumes one charge from each active venom. Recasts add independently expiring charges; allied applications follow the configured venom assumptions.',
        (_c, profileId) => [
          profileFact(balanceContext, profileId, 'maximumStacks', 'Charges granted per recipient'),
          profileFact(balanceContext, profileId, 'durationMultiplier', 'Charge lifetime', tooltipSeconds)
        ],
        'per consumed charge'
      )(balanceContext, entity);
    },
    'thief.assassins-signet': profileTooltip(
      CORE.assassinsSignet,
      'Passively grants power while ready. Activation temporarily replaces the passive bonus with the larger active bonus; the passive returns when recharge ends.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Passive power'),
        profileFact(balanceContext, id, 'attributePerStack', 'Active power'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Active duration', tooltipSeconds)
      ]
    ),
    'thief.thieves-guild': (balanceContext, entity) => {
      const profile = (balanceContext.catalog.skillsById.get(entity.id) as ThiefSkill).summonAttack!;
      return {
        description:
          'Summon thieves that run their attack rotations while combat is active. The final thief depends on your specialization. Their strikes use fixed companion attributes; their conditions inherit your condition attributes. Lifetime begins when casting starts, including time before combat. Recasting replaces the previous guild.',
        facts: [
          { name: 'Lifetime', detail: tooltipSeconds(profile.duration) },
          { name: 'Companion power', detail: tooltipDecimal(profile.basePower) },
          { name: 'Companion critical chance', detail: tooltipPercent(profile.criticalChance) },
          { name: 'Companion critical damage', detail: `${tooltipDecimal(profile.criticalDamage * 100)}%` },
          ...profile.summons.flatMap((summon) =>
            (summon.attacks || profile.fallbackAttacks || []).flatMap(
              (attack) =>
                simulationEffectFacts(
                  [
                    {
                      type: 'strike',
                      actorType: 'summon',
                      coefficient: attack.coefficientPerHit * (attack.hits ?? 1),
                      hits: attack.hits ?? 1
                    },
                    ...(attack.conditions || []).map((condition): SkillEffect => ({
                      ...condition,
                      type: 'condition',
                      actorType: 'summon'
                    }))
                  ],
                  `${summon.name}${summon.variant ? ': core alternative' : ''} · ${attack.name}, per attack`
                ).facts
            )
          )
        ]
      };
    },
    'thief.kneel': skillTooltip(
      'Kneel to replace rifle skills with their kneeling variants and increase initiative regeneration. Free Action or swapping weapons ends Kneel.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          CORE.resources,
          'kneelingInitiativeRegenerationBonus',
          'Additional initiative per second'
        )
      ]
    ),
    'thief.free-action': skillTooltip(
      'Stand up, ending Kneel and restoring the standing rifle skills and initiative regeneration.'
    ),
    'thief.deadeyes-mark': skillTooltip(
      'Mark the target, trigger stealing traits, and grant the configured Deadeye stolen skill. Marked initiative attacks build malice on their first hit, with additional gain from critical hits. Remarking preserves existing malice; Malicious Intent adds its grant.',
      (balanceContext) => [
        profileFact(balanceContext, DE.resources, 'durationMultiplier', 'Mark duration', tooltipSeconds),
        profileFact(balanceContext, DE.resources, 'maximumStacks', 'Maximum malice'),
        profileFact(balanceContext, DE.resources, 'minimumStacks', 'Maximum malice with Maleficent Seven'),
        profileFact(balanceContext, DE.resources, 'resourceGain', 'Malice per initiative attack'),
        profileFact(balanceContext, DE.resources, 'playerStacks', 'Additional malice from a critical hit')
      ]
    ),
    'thief.deadeye-mercy': profileTooltip(
      DE.mercy,
      "Consume current malice, restore initiative, and recharge Deadeye's Mark. Clears the Maleficent Seven cycle so it can trigger again.",
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'resourceGain', 'Base initiative restored'),
        profileFact(balanceContext, id, 'attributePerStack', 'Additional initiative per malice')
      ]
    ),
    'thief.deadeye-shadow-flare': skillTooltip(
      'Create a damaging field and temporarily unlock Shadow Swap. Its strikes deal increased damage against your active mark.',
      (balanceContext) => [
        profileFact(balanceContext, DE.shadowFlare, 'durationMultiplier', 'Shadow Swap window', tooltipSeconds),
        modifierFact(
          balanceContext,
          'thief.shadow-flare-marked',
          'factor',
          'Strike damage against your mark',
          tooltipFactorChange
        )
      ]
    ),
    'thief.deadeye-shadow-swap': skillTooltip(
      'Consume the Shadow Flare follow-up and shadowstep to the field. Its strike deals increased damage against your active mark.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'thief.shadow-flare-marked',
          'factor',
          'Strike damage against your mark',
          tooltipFactorChange
        )
      ]
    ),
    'thief.deadeye-shadow-meld': skillTooltip(
      'Remove Revealed when activation begins, then grant stealth. Cantrip-use traits apply.'
    ),
    'thief.deadeye-stolen-skill': (balanceContext, entity) => ({
      description:
        'Consume the held Deadeye stolen skill. Its boons affect the party. Having enough malice also grants stealth; this does not consume malice. Stolen-skill traits apply.',
      facts: simulationEffectFacts(
        balanceContext.catalog.skillsById
          .get(entity.id)!
          .effects?.map((effect): SkillEffect =>
            effect.type === 'boon' ? { ...effect, audience: { recipients: 'party' } } : effect
          )
          .filter((effect) => !(effect.type === 'buff' && effect.kind === 'stealth'))
      ).facts
    }),
    'thief.spear-chain': (balanceContext, entity) => {
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
          profileFact(
            balanceContext,
            CORE.fallingSpiderEmpowered,
            'damageMultiplier',
            'Strike damage after Entangling Asp',
            tooltipFactorChange
          ),
          profileFact(
            balanceContext,
            CORE.fallingSpiderEmpowered,
            'resourceGain',
            'Additional bleeding and poison stacks after Entangling Asp'
          )
        );
      } else if (entity.id === ID.UNSUSPECTING_STRIKE)
        description += ' Applies additional bleeding against a target above the supported high-health threshold.';
      else if (entity.id === ID.DISTRACTING_THROW) {
        description =
          'At the start of a spear chain, or after a finisher, this acts as a lead attack. Following a finisher also starts a strike-damage bonus.';
        facts.push(
          profileFact(balanceContext, CORE.distractingThrow, 'durationMultiplier', 'Bonus duration', tooltipSeconds),
          modifierFact(balanceContext, 'thief.distracting-throw-finisher', 'amount', 'Strike damage after a finisher')
        );
      }

      return { description, facts };
    },
    'thief.siphon': skillTooltip(
      'Siphon the target, trigger stealing traits, and gain Shadow Force. Replaces the held stolen-skill pool without granting a stolen skill.',
      (balanceContext) => [
        profileFact(balanceContext, SPECTER.resources, 'lifeForceGain', 'Shadow Force gained'),
        profileFact(
          balanceContext,
          SPECTER.amplifiedSiphoning,
          'resourceGain',
          'Additional Shadow Force with Amplified Siphoning'
        )
      ]
    ),
    'thief.shadow-shroud-enter': (balanceContext) => {
      const profile = tooltipProfile(balanceContext, SPECTER.enterShadowShroud);
      return {
        description:
          'Enter Shadow Shroud and replace the skill bar. Shadow Force drains continuously; depletion exits shroud automatically. Grant barrier to the tethered ally, enabling supported barrier traits. Manual exit has a brief initial lockout.',
        facts: [
          profileFact(balanceContext, SPECTER.resources, 'maximumStacks', 'Maximum Shadow Force'),
          profileFact(
            balanceContext,
            SPECTER.resources,
            'lifeForceDrain',
            'Maximum Shadow Force drained per second',
            (value) => `${tooltipDecimal(value * 100)}%`
          ),
          ...simulationEffectFacts(
            profile.effects?.map((effect) => ({
              ...effect,
              audience: {
                recipients: 'party',
                affectsSelf: false,
                maximumRecipients: tooltipNumber(profile, 'maximumTargets')
              }
            }))
          ).facts
        ]
      };
    },
    'thief.shadow-shroud-exit': skillTooltip(
      'Leave Shadow Shroud, stop its Shadow Force drain, and restore the weapon bar. Supported shroud-exit and swap effects apply.'
    ),
    'thief.shadow-shroud-skill': (balanceContext, entity) => {
      const facts = [...simulationEffectFacts(balanceContext.catalog.skillsById.get(entity.id)!.effects).facts];
      // Tooltips retain the same skill-to-boon identity as execution after a packet is removed.
      const boonName =
        entity.id === ID.GRASPING_SHADOWS
          ? 'alacrity'
          : entity.id === ID.DAWNS_REPOSE
            ? 'protection'
            : entity.id === ID.MIND_SHOCK
              ? 'aegis'
              : null;
      if (boonName) {
        const profile = tooltipProfile(balanceContext, SPECTER.shadeStep);
        const boon = requireEffect(profile, 'boon', boonName);
        if (boon) facts.push(...simulationEffectFacts([boon], 'party; requires Shadestep and a completed cast').facts);
      }
      if (entity.id === ID.DAWNS_REPOSE) {
        const profile = tooltipProfile(balanceContext, SPECTER.dawnsReposeBarrier);
        facts.push(
          ...simulationEffectFacts(
            profile.effects?.map((effect) => ({
              ...effect,
              audience: {
                recipients: 'party',
                affectsSelf: false,
                maximumRecipients: tooltipNumber(profile, 'maximumTargets')
              }
            }))
          ).facts
        );
      }

      return {
        description:
          'Use this skill while in Shadow Shroud. Qualifying completed casts also apply their Shadestep boon; interrupted casts do not receive that completion bonus.',
        facts
      };
    },
    'thief.artifact': artifactTooltip,
    'thief.reshuffle': skillTooltip(
      'Replace the available artifact choices. Retains the number of artifact uses remaining.'
    ),
    'thief.skritt-swipe': skillTooltip(
      'Trigger stealing traits and replace held artifacts with a new choice pool. Grants the base artifact use plus supported Skritt Swipe bonuses; resets the initiative-spending counter.',
      (balanceContext) => [
        profileFact(balanceContext, ANTIQUARY.resources, 'maximumStacks', 'Base artifact uses'),
        profileFact(
          balanceContext,
          ANTIQUARY.prolificPlunderer,
          'resourceGain',
          'Additional uses with Prolific Plunderer'
        ),
        profileFact(balanceContext, CORE.improvisation, 'resourceGain', 'Additional uses with Improvisation')
      ]
    ),
    'thief.skritt-scuffle': profileTooltip(
      ANTIQUARY.scuffle,
      'Summon an assistant that immediately pilfers artifacts and repeats while active. Each pilfer replaces artifact choices and resets base uses. Multiple assistants run independently.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'durationMultiplier', 'Assistant duration', tooltipSeconds),
        profileFact(balanceContext, id, 'pulseInterval', 'Pilfer interval', tooltipSeconds)
      ]
    ),
    'thief.forged-surfer': (balanceContext) => ({
      description:
        'Consume the artifact and schedule its dash followed by bombs. The configured bomb-hit assumption determines how many bombs connect. Recasting replaces the previous sequence. Meticulous Custodian substitutes its enhanced packets.',
      facts: [
        profileFact(balanceContext, ANTIQUARY.forgedSurfer, 'initialDelay', 'Dash delay', tooltipSeconds),
        profileFact(balanceContext, ANTIQUARY.forgedSurfer, 'pulseInterval', 'Bomb interval', tooltipSeconds),
        profileFact(balanceContext, ANTIQUARY.forgedSurfer, 'maximumStacks', 'Maximum bomb hits'),
        ...[ANTIQUARY.forgedSurfer, ANTIQUARY.forgedSurferMeticulous].flatMap((id) =>
          tooltipProfile(balanceContext, id).effects!.flatMap(
            (effect) =>
              simulationEffectFacts(
                [effect],
                `${id === ANTIQUARY.forgedSurfer ? 'base' : 'with Meticulous Custodian'} · ${effect.name === 'Dash' ? 'dash' : 'per bomb'}`
              ).facts
          )
        )
      ]
    }),
    'thief.double-edge': (balanceContext, entity) => {
      const description =
        "Succeeds when ready. Reusing during recharge takes the configured success or backfire outcome; Scoundrel's Luck guarantees a risky success and consumes its charge. Backfire locks further reuse until recharge ends.";
      if (entity.id === ID.STONE_SUMMIT_CANNON) {
        const success = tooltipProfile(balanceContext, ANTIQUARY.cannonSuccess);
        return {
          description,
          facts: [
            ...simulationEffectFacts(success.effects, 'success').facts,
            ...simulationEffectFacts(tooltipProfile(balanceContext, ANTIQUARY.cannonBackfire).effects, 'backfire')
              .facts,
            profileFact(balanceContext, ANTIQUARY.cannonBackfire, 'initialDelay', 'Backfire delay', tooltipSeconds)
          ]
        };
      }

      if (entity.id === ID.CANACH_COIN_TOSS_ID_77230)
        return {
          description: `${description} Coin tosses follow a deterministic alternating sequence. Heads restores more initiative than tails; backfire reduces the initiative returned.`,
          facts: []
        };
      return {
        description: `${description} Antivenom's healing and self-damage do not vary player health in combat simulation.`,
        facts: simulationEffectFacts(balanceContext.catalog.skillsById.get(entity.id)!.effects, 'success only').facts
      };
    }
  },
  skills: {
    [ID.UNLOAD]: skillTooltip(
      'Fire the volley. Restore initiative only if the final bullet is reached and the attack is not cancelled.',
      (balanceContext) => [
        profileFact(balanceContext, CORE.unloadRefund, 'resourceGain', 'Initiative restored after the volley')
      ]
    ),
    [ID.FIST_FLURRY]: skillTooltip(
      'Land the completed flurry to unlock Palm Strike for a limited window.',
      (balanceContext) => [
        profileFact(balanceContext, DD.palmStrike, 'durationMultiplier', 'Palm Strike window', tooltipSeconds)
      ]
    ),
    [ID.PALM_STRIKE]: skillTooltip('Consume the follow-up unlocked by a completed Fist Flurry.'),
    [ID.INFILTRATORS_SIGNET]: skillTooltip(
      'Passively regenerates additional initiative while ready. Activation shadowsteps and pauses the passive until recharge completes.'
    ),
    [ID.SIGNET_OF_AGILITY]: skillTooltip(
      "Passively grants precision while ready. Activation restores endurance, capped by the specialization's endurance pool.",
      (balanceContext) => [
        profileFact(balanceContext, CORE.signetOfAgility, 'attributeBonus', 'Passive precision'),
        profileFact(balanceContext, CORE.signetOfAgility, 'resourceGain', 'Endurance restored on activation')
      ]
    ),
    [ID.HARROWING_STORM]: skillTooltip(
      'Recall and consume the shared ground-axe pool when the cast completes. Apply the authored recall packets.'
    ),
    [ID.ORCHESTRATED_ASSAULT]: skillTooltip(
      'Recall and consume the shared ground-axe pool when the cast completes. Apply the authored recall packets.'
    ),
    [ID.RECALL_AXES]: skillTooltip(
      'Recall and consume the shared ground-axe pool when the cast completes. Apply the authored recall packets.'
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
    [TRAIT.MERCIFUL_AMBUSH]: outsideScopeTooltip,
    [TRAIT.MELD_WITH_SHADOWS]: outsideScopeTooltip,
    [TRAIT.SHADOW_SIPHONING]: traitTooltip(
      'Stealth attacks trigger an additional strike that cannot critically strike.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.SHIELDING_RESTORATION]: outsideScopeTooltip,
    [TRAIT.SHADOWS_EMBRACE]: outsideScopeTooltip,
    [TRAIT.HIDDEN_THIEF]: traitTooltip('Stealing inflicts blindness and weakness.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)
    ]),
    [TRAIT.SHADOW_SAVIOR]: outsideScopeTooltip,
    [TRAIT.LEECHING_VENOMS]: traitTooltip(
      'Entering or breaking stealth grants Spider Venom charges. Your venom applications also siphon life; life siphons bypass armor and cannot critically strike.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'resourceGain', 'Spider Venom charges on breaking stealth'),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum charges'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Charge duration', tooltipSeconds)
      ],
      'life siphon per venom application'
    ),
    [TRAIT.CLOAKED_IN_SHADOW]: traitTooltip(
      'Entering stealth inflicts blindness. Applying blindness triggers a strike that cannot critically strike.'
    ),
    [TRAIT.COVER_OF_SHADOW]: outsideScopeTooltip,
    [TRAIT.SHADOWS_REJUVENATION]: traitTooltip(
      'Entering and breaking stealth restore initiative.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Initiative on breaking stealth')]
    ),
    [TRAIT.RENDING_SHADE]: outsideScopeTooltip,
    [TRAIT.SERPENTS_TOUCH]: traitTooltip(
      'Stealing poisons the target. Potent Poison replaces the base application with more stacks.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'playerStacks', 'Poison stacks with Potent Poison')],
      'base application'
    ),
    [TRAIT.LOTUS_POISON]: traitTooltip(
      'Applying your own poison grants might and weakens the target.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.EXPOSED_WEAKNESS]: traitTooltip(
      'Deal increased strike damage for each different condition on the target.',
      (balanceContext) => [
        modifierFact(balanceContext, 'thief.exposed-weakness', 'damagePerCondition', 'Strike damage per condition')
      ]
    ),
    // State the full weapon-dependent bonus so build-only attributes are not hidden by empty profiles.
    [TRAIT.DAGGER_TRAINING]: traitTooltip(
      'Gain power and additional power while wielding a dagger.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Power'),
        profileFact(balanceContext, id, 'weaponAttributeBonus', 'Total power while wielding a dagger')
      ]
    ),
    [TRAIT.MUG]: traitTooltip(
      'Stealing deals an additional strike that cannot critically strike. Healing is outside combat simulation scope.'
    ),
    [TRAIT.DEADLY_AMBITION]: traitTooltip(
      'Gain condition damage. The first landed player strike of a dual attack poisons the target. Potent Poison replaces the base application with more stacks.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Condition damage'),
        profileFact(balanceContext, id, 'playerStacks', 'Poison stacks with Potent Poison')
      ],
      'base application'
    ),
    [TRAIT.EVEN_THE_ODDS]: traitTooltip('Stealing inflicts vulnerability.'),
    [TRAIT.PANIC_STRIKE]: traitTooltip(
      'A strike against a target with enough different conditions immobilizes it. Your immobilize applications also poison the target; Potent Poison increases the poison stack count.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'threshold', 'Different conditions required'),
        profileFact(balanceContext, id, 'internalCooldown', 'Immobilize cooldown', tooltipSeconds),
        profileFact(balanceContext, id, 'playerStacks', 'Poison stacks with Potent Poison')
      ]
    ),
    [TRAIT.REVEALED_TRAINING]: traitTooltip('Gain power and additional power while revealed.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'attributeBonus', 'Power'),
      profileFact(balanceContext, id, 'attributePerStack', 'Additional power while revealed')
    ]),
    [TRAIT.POTENT_POISON]: traitTooltip(
      "Poison deals increased damage and lasts longer. Serpent's Touch, Deadly Ambition, and Panic Strike apply additional poison stacks.",
      (balanceContext) => [
        modifierFact(balanceContext, 'thief.potent-poison-damage', 'factor', 'Poison damage', tooltipFactorChange),
        profileFact(balanceContext, TRAIT.POTENT_POISON, 'conditionDurationBonus', 'Poison duration', tooltipPercent)
      ]
    ),
    [TRAIT.IMPROVISATION]: traitTooltip(
      'Use the same stolen skill more than once. Increase Shadow Force gained from Siphon, including Amplified Siphoning. Skritt Swipe grants an additional artifact use, stacking with Prolific Plunderer, and reduces the active cooldowns of selected utility skills.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'maximumStacks', 'Stolen skill uses'),
        profileFact(balanceContext, id, 'resourceGain', 'Additional artifact use from Skritt Swipe'),
        profileFact(balanceContext, id, 'lifeForceGain', 'Additional Shadow Force gain from Siphon', tooltipPercent),
        profileFact(
          balanceContext,
          id,
          'rechargeMultiplier',
          'Utility recharge removed, as a fraction of base recharge',
          (value) => tooltipPercent(1 - value)
        ),
        profileFact(balanceContext, id, 'internalCooldown', 'Utility reduction cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.EXECUTIONER]: traitTooltip(
      'Deal increased strike damage against targets below half health.',
      (balanceContext) => [
        modifierFact(balanceContext, 'thief.executioner', 'factor', 'Strike damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.KEEN_OBSERVER]: traitTooltip(
      'Gain critical-strike chance. The full-health bonus applies in combat simulation.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'criticalChance', 'Critical chance at full player health', tooltipPercent)
      ]
    ),
    [TRAIT.UNRELENTING_STRIKES]: traitTooltip(
      'Eligible critical hits grant fury to the party.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)
      ],
      'party'
    ),
    [TRAIT.FEROCIOUS_STRIKES]: traitTooltip(
      'Critical strikes deal increased damage against targets above half health.',
      (balanceContext) => [
        profileFact(balanceContext, TRAIT.FEROCIOUS_STRIKES, 'criticalDamage', 'Critical damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.ASSASSINS_FURY]: traitTooltip('Receiving fury on yourself grants might.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)
    ]),
    [TRAIT.SIGNETS_OF_POWER]: traitTooltip('Activating a signet restores initiative.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'resourceGain', 'Initiative restored')
    ]),
    [TRAIT.TWIN_FANGS]: traitTooltip(
      'Gain critical-strike damage, with the full-health bonus active in combat. Gain critical-strike chance against defiant targets.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          TRAIT.TWIN_FANGS,
          'criticalDamage',
          'Critical damage at full health',
          tooltipFactorChange
        ),
        profileFact(
          balanceContext,
          TRAIT.TWIN_FANGS,
          'criticalChance',
          'Critical chance against defiant targets',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.SUNDERING_SHADE]: traitTooltip('Completing a stealth attack inflicts vulnerability.'),
    [TRAIT.PRACTICED_TOLERANCE]: traitTooltip('Gain ferocity from eligible precision.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'attributeConversion', 'Eligible precision converted to ferocity', tooltipPercent)
    ]),
    [TRAIT.DEADLY_AIM]: traitTooltip('Pistol strikes deal increased damage.', (balanceContext) => [
      modifierFact(balanceContext, 'thief.deadly-aim', 'factor', 'Pistol strike damage', tooltipFactorChange)
    ]),
    [TRAIT.NO_QUARTER]: (balanceContext, entity) => ({
      description:
        'Gain ferocity while you have fury. Eligible critical hits extend fury only if it was already active before the hit.',
      facts: [
        profileFact(balanceContext, entity.id, 'attributeBonus', 'Ferocity with fury'),
        profileFact(balanceContext, entity.id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
        ...simulationEffectFacts(tooltipProfile(balanceContext, entity.id).effects, 'extension of existing fury').facts
      ]
    }),
    [TRAIT.HIDDEN_KILLER]: traitTooltip(
      'Gain critical-strike chance during stealth and briefly after leaving it.',
      (balanceContext, id) => [
        profileFact(balanceContext, TRAIT.HIDDEN_KILLER, 'criticalChance', 'Critical chance', tooltipPercent),
        profileFact(balanceContext, id, 'duration', 'Bonus duration after leaving stealth', tooltipSeconds)
      ]
    ),
    [TRAIT.INVIGORATING_PRECISION]: outsideScopeTooltip,
    [TRAIT.KLEPTOMANIAC]: traitTooltip('Stealing restores initiative.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'resourceGain', 'Initiative restored')
    ]),
    [TRAIT.PREPAREDNESS]: traitTooltip('Increase maximum initiative and gain expertise.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'attributeBonus', 'Expertise'),
      profileFact(balanceContext, CORE.resources, 'minimumStacks', 'Maximum initiative with Preparedness'),
      profileFact(balanceContext, CORE.resources, 'maximumStacks', 'Maximum initiative without Preparedness')
    ]),
    [TRAIT.LEAD_ATTACKS]: traitTooltip(
      'Spending initiative grants temporary damage stacks. Steal recharges faster.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'thief.lead-attacks', 'damagePerStack', 'Strike damage per stack'),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum stacks'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Stack duration', tooltipSeconds),
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Steal recharge', tooltipFactorChange)
      ]
    ),
    [TRAIT.UNCATCHABLE]: traitTooltip(
      'Dodging drops Lesser Caltrops, repeatedly inflicting bleeding and cripple.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'pulseInterval', 'Pulse interval', tooltipSeconds)]
    ),
    [TRAIT.BURST_OF_AGILITY]: outsideScopeTooltip,
    [TRAIT.THRILL_OF_THE_CRIME]: traitTooltip('Stealing grants fury, might, and swiftness to yourself.'),
    [TRAIT.BOUNTIFUL_THEFT]: traitTooltip(
      'Stealing grants vigor and might to yourself. The simulated target has no boons to steal.'
    ),
    [TRAIT.TRICKSTER]: outsideScopeTooltip,
    [TRAIT.PRESSURE_STRIKING]: outsideScopeTooltip,
    [TRAIT.QUICK_POCKETS]: traitTooltip('Weapon swapping restores initiative.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'resourceGain', 'Initiative restored'),
      profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)
    ]),
    [TRAIT.SLEIGHT_OF_HAND]: traitTooltip('Stealing dazes the target and recharges faster.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'rechargeMultiplier', 'Steal recharge', tooltipFactorChange)
    ]),
    [TRAIT.DEADLY_AMBUSH]: traitTooltip(
      'Stealing inflicts bleeding. Bleeding deals increased damage.',
      (balanceContext) => [
        modifierFact(balanceContext, 'thief.deadly-ambush-bleeding', 'factor', 'Bleeding damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.EXPEDITIOUS_DODGER]: outsideScopeTooltip,
    [TRAIT.FELINE_GRACE]: outsideScopeTooltip,
    [TRAIT.FLUID_STRIKES]: traitTooltip(
      'Completing a movement skill temporarily increases strike damage.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'thief.fluid-strikes', 'amount', 'Strike damage'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Bonus duration', tooltipSeconds)
      ]
    ),
    [TRAIT.INSTANT_REFLEXES]: outsideScopeTooltip,
    [TRAIT.PUMPING_UP]: outsideScopeTooltip,
    [TRAIT.PAIN_RESPONSE]: outsideScopeTooltip,
    [TRAIT.GUARDED_INITIATION]: outsideScopeTooltip,
    [TRAIT.SWINDLERS_EQUILIBRIUM]: traitTooltip(
      'Gain power and additional power while wielding a sword.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Power'),
        profileFact(balanceContext, id, 'weaponAttributeBonus', 'Total power while wielding a sword')
      ]
    ),
    [TRAIT.HARD_TO_CATCH]: traitTooltip('Completing a movement skill restores endurance.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'resourceGain', 'Endurance restored')
    ]),
    [TRAIT.ASSASSINS_REWARD]: outsideScopeTooltip,
    [TRAIT.UPPER_HAND]: traitTooltip('Completing a dodge restores initiative.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'resourceGain', 'Initiative restored'),
      profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)
    ]),
    [TRAIT.DONT_STOP]: outsideScopeTooltip,
    [TRAIT.PHYSICAL_SUPREMACY]: traitTooltip(
      'Unlock Daredevil, staff, physical skills, and an increased endurance capacity.'
    ),
    [TRAIT.WEAKENING_STRIKES]: traitTooltip(
      'After dodging, your next landed player strike inflicts weakness. Deal increased strike damage to weakened targets.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'durationMultiplier', 'Time to land the strike', tooltipSeconds),
        modifierFact(
          balanceContext,
          'thief.weakening-strikes',
          'factor',
          'Strike damage against weakened targets',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.ENDURANCE_THIEF]: traitTooltip('Stealing restores endurance.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'resourceGain', 'Endurance restored')
    ]),
    [TRAIT.MARAUDERS_RESILIENCE]: traitTooltip(
      'Gain vitality from eligible power. Incoming damage is outside combat simulation scope.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeConversion', 'Eligible power converted to vitality', tooltipPercent)
      ]
    ),
    [TRAIT.ESCAPISTS_FORTITUDE]: outsideScopeTooltip,
    [TRAIT.BRAWLERS_TENACITY]: traitTooltip(
      'Using an eligible physical utility or healing skill restores endurance.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Endurance restored')]
    ),
    [TRAIT.STAFF_MASTER]: traitTooltip(
      'Gain power and additional power while wielding a staff. Spending initiative on staff skills restores endurance.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Power'),
        profileFact(balanceContext, id, 'weaponAttributeBonus', 'Total power while wielding a staff'),
        profileFact(balanceContext, id, 'resourceGain', 'Endurance per initiative spent')
      ]
    ),
    [TRAIT.HAVOC_SPECIALIST]: traitTooltip(
      'Deal increased strike damage while endurance is below maximum.',
      (balanceContext) => [
        modifierFact(balanceContext, 'thief.havoc-specialist', 'factor', 'Strike damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.IMPACTING_DISRUPTION]: outsideScopeTooltip,
    [TRAIT.LOTUS_TRAINING]: traitTooltip(
      'Replace your dodge with Impaling Lotus, striking and applying conditions. Completing the dodge temporarily increases condition damage.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'thief.lotus-training', 'amount', 'Condition damage'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Bonus duration', tooltipSeconds)
      ]
    ),
    [TRAIT.UNHINDERED_COMBATANT]: traitTooltip(
      'Replace your dodge with Unhindered Combatant. Completing the dodge grants swiftness.'
    ),
    [TRAIT.BOUNDING_DODGER]: traitTooltip(
      'Replace your dodge with Bound, striking the target. Completing the dodge temporarily increases strike damage.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'thief.bounding-dodger', 'amount', 'Strike damage'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Bonus duration', tooltipSeconds)
      ]
    ),
    [TRAIT.DEADEYES_GAZE]: traitTooltip(
      "Unlock Deadeye, rifle, cantrips, and Deadeye's Mark. Initiative attacks build malice against the marked target; malicious attacks consume it."
    ),
    [TRAIT.RENEWING_GAZE]: outsideScopeTooltip,
    [TRAIT.IRON_SIGHT]: traitTooltip('Deal increased strike damage to the marked target.', (balanceContext) => [
      modifierFact(balanceContext, 'thief.iron-sight', 'factor', 'Strike damage', tooltipFactorChange)
    ]),
    [TRAIT.MALICIOUS_INTENT]: traitTooltip(
      'Gain malice when marking a target and after a malicious attack spends malice.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Malice gained')]
    ),
    [TRAIT.COLLATERAL_DAMAGE]: outsideScopeTooltip,
    [TRAIT.ONE_IN_THE_CHAMBER]: traitTooltip(
      'Cantrips grant a new stolen skill choice, replacing the stored choice. Stolen skills deal increased strike damage.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'thief.one-in-the-chamber',
          'factor',
          'Stolen skill strike damage',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.SILENT_SCOPE]: traitTooltip(
      'Gain precision. Dodging above the malice threshold grants one temporary stealth-attack use without entering stealth.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Precision'),
        profileFact(balanceContext, id, 'threshold', 'Malice must exceed'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Attack availability', tooltipSeconds)
      ]
    ),
    [TRAIT.PAYBACK]: outsideScopeTooltip,
    [TRAIT.PREMEDITATION]: traitTooltip(
      'Gain concentration and increased strike damage for each different boon on you.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Concentration'),
        modifierFact(balanceContext, 'thief.premeditation', 'damagePerBoon', 'Strike damage per boon')
      ]
    ),
    [TRAIT.MALEFICENT_SEVEN]: traitTooltip(
      'Increase maximum malice. Reaching maximum malice grants initiative and boons once until a malicious attack spends malice.',
      (balanceContext, id) => [
        profileFact(balanceContext, 'thief.deadeye.resources', 'minimumStacks', 'Maximum malice'),
        profileFact(balanceContext, id, 'resourceGain', 'Initiative restored')
      ]
    ),
    [TRAIT.BE_QUICK_OR_BE_KILLED]: traitTooltip(
      'Marking a target grants quickness. Gain power and precision while quickness is active.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'attributeBonus', 'Power and precision with quickness')]
    ),
    [TRAIT.FIRE_FOR_EFFECT]: traitTooltip(
      'Replace stolen skill choices with Steal Time. Using a stolen skill grants might and fury to the party.',
      () => [],
      'party'
    ),
    [TRAIT.SPECTER]: traitTooltip(
      'Unlock Specter, scepter, wells, Siphon, and Shadow Shroud. Siphon and initiative spending generate shadow force.'
    ),
    [TRAIT.DARK_SENTRY]: traitTooltip(
      "Barrier grants from Enter Shadow Shroud and Dawn's Repose give eligible allies Rot Wallow Venom. Their next strike within the venom window inflicts torment.",
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Cooldown per ally', tooltipSeconds)
      ],
      'allied venom'
    ),
    [TRAIT.PANAKUS_AMBITION]: outsideScopeTooltip,
    [TRAIT.SECOND_OPINION]: traitTooltip(
      'Gain condition damage, with an additional bonus while wielding a scepter. Gain healing power from condition damage.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Condition damage'),
        profileFact(balanceContext, id, 'attributePerStack', 'Additional condition damage with scepter'),
        profileFact(
          balanceContext,
          id,
          'attributeConversion',
          'Condition damage converted to healing power',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.SHALLOW_GRAVE]: outsideScopeTooltip,
    [TRAIT.CONSUME_SHADOWS]: outsideScopeTooltip,
    [TRAIT.LARCENOUS_TORMENT]: traitTooltip(
      'Each stack of torment you apply siphons life and generates shadow force while outside Shadow Shroud. Life siphons bypass armor and cannot critically strike.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Shadow force per torment stack')],
      'per torment stack'
    ),
    [TRAIT.AMPLIFIED_SIPHONING]: traitTooltip(
      'Increase the shadow force generated by Siphon.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Additional Shadow Force from Siphon')]
    ),
    [TRAIT.TRAVERSING_DUSK]: outsideScopeTooltip,
    [TRAIT.STRENGTH_OF_SHADOWS]: traitTooltip(
      'Gain expertise from vitality. Torment lasts longer.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeConversion', 'Vitality converted to expertise', tooltipPercent),
        modifierFact(balanceContext, 'thief.strength-of-shadows', 'amount', 'Torment duration')
      ]
    ),
    [TRAIT.HUNGERING_DARKNESS]: outsideScopeTooltip,
    [TRAIT.SHADESTEP]: (balanceContext, entity) => ({
      description: 'Completing a supported Shadow Shroud skill grants its corresponding boon to the party.',
      facts: (tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
        (effect, index) =>
          simulationEffectFacts(
            [effect],
            ['Grasping Shadows · party', "Dawn's Repose · party", 'Mind Shock · party'][index]
          ).facts
      )
    }),
    [TRAIT.TRINKET_COLLECTOR]: traitTooltip(
      'Unlock Antiquary, artifacts, Skritt Swipe, and double-edge skills. Pilfering replaces held artifacts; each artifact use consumes its selected slot.'
    ),
    [TRAIT.MAGPIES_DEFENSE]: outsideScopeTooltip,
    [TRAIT.ENTERPRISING_ARISTOCRAT]: traitTooltip('Using an artifact restores initiative.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'resourceGain', 'Initiative restored')
    ]),
    [TRAIT.CARD_SWAP]: outsideScopeTooltip,
    [TRAIT.REPEAT_RANSACKER]: traitTooltip(
      'Using an artifact reduces the active recharge of Skritt Swipe.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'rechargeReduction', 'Recharge removed', tooltipSeconds)]
    ),
    [TRAIT.PROLIFIC_PLUNDERER]: traitTooltip(
      'Skritt Swipe grants an additional artifact use.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Additional artifact uses')]
    ),
    [TRAIT.SCOUNDRELS_LUCK]: traitTooltip(
      "Skritt Swipe grants Scoundrel's Luck, making a risky double-edge cast succeed. New grants replace the charge instead of accumulating.",
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'maximumStacks', 'Charges'),
        profileFact(balanceContext, id, 'internalCooldown', 'Grant cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.METICULOUS_CUSTODIAN]: traitTooltip(
      'Enhance artifacts: extend their special-effect windows, improve eligible strikes and burning, and add a strike to Chak Shield.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'thief.meticulous-custodian-artifact-strike',
          'guitarFactor',
          'Guitar strike damage',
          tooltipFactorChange
        ),
        modifierFact(
          balanceContext,
          'thief.meticulous-custodian-artifact-strike',
          'guitarFinalFactor',
          'Guitar final strike damage',
          tooltipFactorChange
        ),
        modifierFact(
          balanceContext,
          'thief.meticulous-custodian-artifact-strike',
          'mortarFactor',
          'Mortar strike damage',
          tooltipFactorChange
        ),
        modifierFact(
          balanceContext,
          'thief.meticulous-custodian-artifact-strike',
          'holoFactor',
          'Holo Dancer strike damage',
          tooltipFactorChange
        ),
        modifierFact(
          balanceContext,
          'thief.meticulous-custodian-artifact-strike',
          'kryptisFactor',
          'Kryptis Turret strike damage',
          tooltipFactorChange
        ),
        modifierFact(
          balanceContext,
          'thief.meticulous-custodian-mortar-burning',
          'factor',
          'Mortar burning duration',
          tooltipFactorChange
        ),
        modifierFact(
          balanceContext,
          'thief.meticulous-custodian-sun-crystal-burning',
          'factor',
          'Sun Crystal burning duration',
          tooltipFactorChange
        )
      ],
      'additional Chak Shield strike'
    ),
    [TRAIT.EXHILARATING_EPHEMERA]: traitTooltip(
      'Using an artifact extends a temporary strike-damage bonus, up to the maximum remaining duration.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'thief.antiquary-artifact-momentum', 'amount', 'Strike damage'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Duration added', tooltipSeconds),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum remaining duration', tooltipSeconds)
      ]
    ),
    [TRAIT.PRODIGIOUS_PINCHER]: traitTooltip(
      'Spending enough initiative in combat pilfers a new set of artifacts and resets the spending counter.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'threshold', 'Initiative spent to pilfer')]
    ),
    [TRAIT.POSSESSIVE_HOARDER]: (balanceContext, entity) => ({
      description:
        'Using an artifact grants alacrity. Offensive artifacts also grant might; defensive artifacts grant protection instead.',
      facts: (tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
        (effect, index) =>
          simulationEffectFacts([effect], ['offensive artifact', 'defensive artifact', 'any artifact'][index]).facts
      )
    }),
    [TRAIT.COMBAT_HIGH]: traitTooltip(
      'Skritt Swipe grants a full set of damage-bonus stacks, replacing earlier stacks. Stacks expire one at a time.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'thief.combat-high-strike', 'damagePerStack', 'Strike damage per stack'),
        modifierFact(balanceContext, 'thief.combat-high-condition', 'damagePerStack', 'Condition damage per stack'),
        profileFact(balanceContext, id, 'maximumStacks', 'Initial stacks'),
        profileFact(balanceContext, id, 'pulseInterval', 'Time between stack expirations', tooltipSeconds),
        profileFact(balanceContext, id, 'durationMultiplier', 'Final stack duration', tooltipSeconds)
      ]
    )
  }
};
