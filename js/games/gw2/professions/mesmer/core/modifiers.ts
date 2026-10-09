import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { createModifierHooks, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { illusionSource } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/core/profiles.js';
import {
  chaoticPersistenceAttributes,
  prepareChaoticPersistence
} from '#gw2/professions/mesmer/core/traits/chaos/index.js';
import { fencersFinesseFerocity, prepareFencersFinesse } from '#gw2/professions/mesmer/core/traits/dueling/index.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

/** Resolve immutable loadout and patched profile values once for each combat query. */
function prepareCoreAttributeFacts(context: Gw2ModifierContext) {
  const selectedSkillIds = selectedSkillIdSet(context.config?.selectedSkillIds);
  const signetOfMidnightProfile = requireBalanceProfileFromContext(context, PROFILE.signetOfMidnight);
  const signetOfDominationProfile = requireBalanceProfileFromContext(context, PROFILE.signetOfDomination);
  return {
    midnightSelected: selectedSkillIds.has(ID.SIGNET_OF_MIDNIGHT),
    dominationSelected: selectedSkillIds.has(ID.SIGNET_OF_DOMINATION),
    midnightBonus: balanceProfileNumber(signetOfMidnightProfile, 'expertiseBonus'),
    dominationBonus: balanceProfileNumber(signetOfDominationProfile, 'conditionDamageBonus'),
    chaotic: prepareChaoticPersistence(context),
    fencer: prepareFencersFinesse(context)
  };
}

const coreAttributeFacts = new WeakMap<
  NonNullable<Gw2ModifierContext['query']>,
  ReturnType<typeof prepareCoreAttributeFacts>
>();

// Reconcile build-time bonuses with live stacks and cooldowns; detached editor queries remain uncached.
export function applyMesmerCoreAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  let facts = context.query ? coreAttributeFacts.get(context.query) : undefined;
  if (!facts) {
    facts = prepareCoreAttributeFacts(context);
    if (context.query) coreAttributeFacts.set(context.query, facts);
  }

  const { midnightSelected, midnightBonus, dominationSelected, dominationBonus } = facts;
  const staticApplied = professionStaticRulesApplied(context.config);
  const chaotic = chaoticPersistenceAttributes(context, facts.chaotic);
  const midnight = midnightSelected && context.timeline?.skillOnCooldownAt(10234, context.time) ? midnightBonus : 0;
  const domination =
    dominationSelected && context.timeline?.skillOnCooldownAt(10232, context.time) ? dominationBonus : 0;
  return {
    ...attributes,
    power: attributes.power || 0,
    precision: attributes.precision || 0,
    ferocity: (attributes.ferocity || 0) + fencersFinesseFerocity(context, facts.fencer),
    conditionDamage:
      (attributes.conditionDamage || 0) + (dominationSelected && !staticApplied ? dominationBonus : 0) - domination,
    expertise:
      (attributes.expertise || 0) +
      chaotic.expertise +
      (midnightSelected && !staticApplied ? midnightBonus : 0) -
      midnight,
    concentration: (attributes.concentration || 0) + chaotic.concentration
  };
}

const modifierParameters = (values: Record<string, number>): Readonly<Record<string, number>> => Object.freeze(values);

// Explicit Core orders keep moved trait multipliers between skill rules and elite multipliers.
export const mesmerCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'mesmer.event-final-multiplier',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: modifierParameters({ fallbackFactor: 1 }),
    factor: (context, _target, parameters) => Number(context.event?.multiplier ?? parameters.fallbackFactor),
    order: 1000
  }
]);

function compileMesmerModifierRules(rules: readonly Gw2ModifierRule[]): ReturnType<typeof createModifierHooks> {
  return createModifierHooks({
    rules,
    damageBuckets: {
      strikeDamage: {
        includeSigil: (context) => !illusionSource(context)
      }
    }
  });
}

export const mesmerCoreModifiers = Object.freeze({
  modifyAttributes: applyMesmerCoreAttributes,
  modifierRules: mesmerCoreModifierRules,
  compileModifierRules: compileMesmerModifierRules
});
