import {
  fromSkill,
  simulationEffectFacts,
  skillFact,
  skillTooltip,
  tooltipDecimal,
  tooltipNumber,
  tooltipPercent,
  tooltipSeconds,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { requireEffect, requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { warriorArmsTooltips } from '#gw2/professions/warrior/app/tooltips/arms.js';
import { warriorDefenseTooltips } from '#gw2/professions/warrior/app/tooltips/defense.js';
import { warriorDisciplineTooltips } from '#gw2/professions/warrior/app/tooltips/discipline.js';
import { resourceTooltip } from '#gw2/professions/warrior/app/tooltips/shared.js';
import { warriorStrengthTooltips } from '#gw2/professions/warrior/app/tooltips/strength.js';
import { warriorTacticsTooltips } from '#gw2/professions/warrior/app/tooltips/tactics.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

/** Compose core skills and trait-line tooltips from the selected balance data. */
export const warriorCoreTooltips = {
  skillFacts: (_context, entity) => [
    // Tooltips are shared across builds, so routed rewards name both destinations while direct grants keep their owner.
    ...(entity.sideEffects ?? []).flatMap(({ do: action }) => {
      if (!('amount' in action) || typeof action.amount !== 'number') return [];

      if (action.type === 'warrior.grant-combat-resource')
        return [{ name: 'Adrenaline gained (Flow for Bladesworn)', detail: tooltipDecimal(action.amount) }];

      if (action.type === 'resourceGrant' && ['adrenaline', 'flow'].includes(action.resource))
        return [
          {
            name: action.resource === 'flow' ? 'Flow gained' : 'Adrenaline gained',
            detail: tooltipDecimal(action.amount)
          }
        ];

      return [];
    }),
    ...(entity.adrenalineCost == null
      ? []
      : [
          {
            name:
              entity.primalBurst || entity.specialization === 'Spellbreaker' || entity.id === ID.BERSERK
                ? 'Adrenaline cost'
                : 'Minimum adrenaline',
            detail: tooltipDecimal(tooltipNumber(entity, 'adrenalineCost'))
          }
        ])
  ],
  skills: {
    [ID.DEFIANT_ROAR]: resourceTooltip,
    [ID.VALIANT_LEAP]: resourceTooltip,
    [ID.TACTICAL_BLOW]: resourceTooltip,
    [ID.ADRENALINE_RUSH]: resourceTooltip,
    [ID.EARTHSHAKER]: resourceTooltip,
    [ID.SKULL_CRACK]: resourceTooltip,
    [ID.BREACHING_STRIKE]: resourceTooltip,
    [ID.PATH_TO_VICTORY]: resourceTooltip,
    [ID.PATH_TO_VICTORY_ID_71932]: resourceTooltip,
    [ID.PATH_TO_VICTORY_ID_71950]: resourceTooltip,
    [ID.HARRIERS_TOSS_ID_73006]: resourceTooltip,
    [ID.HARRIERS_TOSS]: resourceTooltip,
    [ID.HARRIERS_TOSS_ID_73042]: resourceTooltip,
    [ID.COUNTERBLOW]: skillTooltip(
      'Begin a block and unlock Tactical Blow for the original block window. Tactical Blow can be used as a manual follow-up. Incoming attacks are outside simulation scope.'
    ),
    [ID.FIERCE_BLOW]: skillTooltip('Strike your target. Damage increases against a defiant target.', undefined),
    [ID.MIGHTY_THROW]: (balanceContext, entity) => {
      const selected = balanceContext.catalog.skillsById.get(entity.id);

      if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);

      const effects = simulationEffectFacts(
        selected.effects
          ?.map((effect) =>
            effect.type === 'strike' && effect.ticks
              ? {
                  ...effect,
                  ticks: effect.ticks.filter((tick) => tick.metadata?.packetKind !== 'warrior.mighty-throw-shard')
                }
              : effect
          )
          .filter((effect) => effect.metadata?.packetKind !== 'warrior.mighty-throw-shard')
      );
      return {
        ...effects,
        description:
          'Throw your spear at the primary target. Shards that only hit secondary enemies are excluded from this single-target simulation.'
      };
    },
    [ID.COMBUSTIVE_SHOT]: (balanceContext, entity) => {
      const selected = requireSkillFromContext(balanceContext, entity.id);
      // Burst tiers are alternatives; keep each field duration with its own damage and burning payload.
      return {
        description:
          'Spend adrenaline to create a fire field that repeatedly strikes and burns your target. Higher burst tiers add pulses and extend the field.',
        facts: [skillFact(balanceContext, entity.id, 'pulseInterval', 'Pulse interval', tooltipSeconds)],
        factTabs: [1, 2, 3].map((tier) => ({
          label: `Burst tier ${tier}`,
          facts: [
            ...simulationEffectFacts(selected.effects?.map((effect) => ({ ...effect, applications: tier + 1 }))).facts,
            {
              name: 'Combo field',
              detail: `Fire · ${tooltipSeconds(tier * tooltipNumber(selected, 'durationPerTier'))}`
            }
          ]
        }))
      };
    },
    [ID.DRAGONS_ROAR]: (balanceContext, entity) => ({
      description: 'Consume all available ammunition and fire one explosive strike for each round spent.',
      facts: simulationEffectFacts(requireSkillFromContext(balanceContext, entity.id).effects, 'per round spent').facts
    }),
    [SHARED_SKILL_IDS.DODGE]: skillTooltip(
      'Spend endurance to dodge and trigger applicable dodge traits. Incoming attacks are outside simulation scope.',
      () => [{ name: 'Endurance cost', detail: String(ENDURANCE.dodgeCost) }]
    ),
    [SHARED_SKILL_IDS.SWAP_WEAPONS]: skillTooltip(
      'Swap to your other weapon set and trigger applicable weapon-swap effects.'
    ),
    // Each signet owns its passive attributes and active tuning, so tooltips follow selected skill patches.
    [ID.SIGNET_OF_STAMINA]: skillTooltip(
      'Passively increases endurance regeneration while ready. Activation restores endurance and triggers signet traits.',
      [fromSkill(ID.SIGNET_OF_STAMINA, 'enduranceRegenerationBonus', 'Passive endurance regeneration', tooltipPercent)]
    ),
    [ID.SIGNET_OF_MIGHT]: skillTooltip('Passively grants power while ready. Activation grants might.', [
      fromSkill(ID.SIGNET_OF_MIGHT, 'attributeBonuses.power', 'Passive power')
    ]),
    [ID.SIGNET_OF_FURY]: skillTooltip(
      'Passively grants precision while ready. Activation grants adrenaline (Flow for Bladesworn) and temporarily increases precision and ferocity.',
      [
        fromSkill(ID.SIGNET_OF_FURY, 'attributeBonuses.precision', 'Passive precision'),
        fromSkill(ID.SIGNET_OF_FURY, 'activeAttributeBonuses.precision', 'Precision during the active buff'),
        fromSkill(ID.SIGNET_OF_FURY, 'activeAttributeBonuses.ferocity', 'Ferocity during the active buff')
      ]
    ),
    [ID.RIFLE_BUTT]: skillTooltip(
      'Strike and knock back your target. Restore ammunition to your other rifle skills and reset Kill Shot and Gun Flame.'
    ),
    [ID.TREMOR]: skillTooltip("Apply the listed effects and reset Crushing Blow's recharge."),
    [ID.BACKBREAKER]: skillTooltip("Apply the listed effects and reset Fierce Blow's recharge."),
    [ID.GUNSTINGER]: skillTooltip("Strike your target and restore Dragon's Roar ammunition.", (_c, entity) =>
      (entity.sideEffects ?? []).flatMap(({ do: action }) =>
        action.type === 'ammoRestore' && typeof action.count === 'number'
          ? [{ name: 'Ammunition restored', detail: tooltipDecimal(action.count) }]
          : []
      )
    ),
    [ID.TO_THE_LIMIT]: skillTooltip(
      'Restore endurance and gain adrenaline (Flow for Bladesworn). Healing is outside combat simulation scope.',
      (_c, entity) =>
        (entity.sideEffects ?? []).flatMap(({ do: action }) =>
          action.type === 'resourceGrant' && action.resource === 'endurance' && typeof action.amount === 'number'
            ? [{ name: 'Endurance restored', detail: tooltipDecimal(action.amount) }]
            : []
        )
    ),
    // Named tier packets keep their identity when patches remove another tier's payload.
    [ID.EVISCERATE]: (balanceContext, entity) => {
      const selected = requireSkillFromContext(balanceContext, entity.id);
      return {
        description: 'Spend available adrenaline on a burst and gain might. Its strike uses the adrenaline tier spent.',
        facts: [
          ...simulationEffectFacts(selected.effects?.filter((effect) => effect.type !== 'strike')).facts,
          ...[1, 2, 3].flatMap((tier) => {
            const effect = requireEffect(selected, 'strike', `Tier ${tier}`);
            return simulationEffectFacts(effect ? [effect] : [], `burst tier ${tier}`).facts;
          })
        ]
      };
    },
    [ID.BLOODTHIRSTER]: (balanceContext, entity) => {
      const selected = requireSkillFromContext(balanceContext, entity.id);
      return {
        description: 'Spend adrenaline to strike your target. Bleeding scales with the adrenaline tier spent.',
        facts: [
          ...simulationEffectFacts(selected.effects?.filter((effect) => effect.type !== 'condition')).facts,
          ...[1, 2, 3].flatMap((tier) => {
            const effect = requireEffect(selected, 'condition', `Tier ${tier}`);
            return simulationEffectFacts(effect ? [effect] : [], `burst tier ${tier}`).facts;
          })
        ]
      };
    },
    [ID.KILL_SHOT]: skillTooltip(
      'Fire a burst shot. The listed strike is the first-tier base; higher adrenaline tiers increase its coefficient.'
    ),
    [ID.ARCING_SLICE]: skillTooltip(
      "Deliver a burst strike and gain Fury. Higher adrenaline tiers extend Fury's duration."
    )
  },
  traits: {
    ...warriorStrengthTooltips,
    ...warriorTacticsTooltips,
    ...warriorDefenseTooltips,
    ...warriorArmsTooltips,
    ...warriorDisciplineTooltips
  }
} satisfies ProfessionTooltips;
