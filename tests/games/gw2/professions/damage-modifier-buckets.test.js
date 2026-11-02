import assert from 'node:assert/strict';
import test from 'node:test';

import { elementalistNativeModules } from '#gw2/professions/elementalist/catalog.js';
import { engineerNativeModules } from '#gw2/professions/engineer/catalog.js';
import { guardianNativeModules } from '#gw2/professions/guardian/catalog.js';
import { mesmerNativeModules } from '#gw2/professions/mesmer/catalog.js';
import { necromancerNativeModules } from '#gw2/professions/necromancer/catalog.js';
import { rangerNativeModules } from '#gw2/professions/ranger/catalog.js';
import { revenantNativeModules } from '#gw2/professions/revenant/catalog.js';
import { thiefNativeModules } from '#gw2/professions/thief/catalog.js';
import { warriorNativeModules } from '#gw2/professions/warrior/catalog.js';

// GW2 sums damage-additive bonuses into one shared outgoing-damage bucket and applies true multipliers after it.
// This table pins only which bucket each damage modifier uses. Magnitudes stay in balance data, so a balance patch
// never needs a test edit, while moving a modifier to another bucket must be done deliberately here.
const BUCKET_BY_OPERATION = { 'damage-additive': 'additive', multiply: 'multiplier' };
const DAMAGE_TARGET_LABELS = { strikeDamage: 'strike', conditionDamage: 'condition' };

/** Records the strike and condition buckets one rule contributes to under its owner. */
function recordBuckets(entries, owner, rule) {
  for (const target of [rule.target].flat()) {
    const label = DAMAGE_TARGET_LABELS[target];

    if (!label) continue;

    const entry = (entries[owner] ??= {});
    const buckets = new Set([entry[label] ?? []].flat());
    buckets.add(BUCKET_BY_OPERATION[rule.operation]);
    entry[label] = buckets.size === 1 ? [...buckets][0] : [...buckets].sort();
  }
}

/**
 * Groups trait-owned damage modifiers by trait name. Rules declared outside trait definitions (skills, mechanics, and
 * module-level trait rules) are grouped by rule id so every damage modifier has a pinned bucket.
 */
function declaredBuckets(modules) {
  const traits = {};
  const rules = {};
  const traitRuleIds = new Set();
  for (const module of modules)
    for (const trait of module.traitDefinitions ?? [])
      for (const rule of trait.modifierRules ?? []) {
        traitRuleIds.add(rule.id);
        recordBuckets(traits, trait.name ?? module.data.traits.find(({ id }) => id === trait.id).name, rule);
      }

  for (const module of modules)
    for (const rule of module.modifiers?.modifierRules ?? [])
      if (!traitRuleIds.has(rule.id)) recordBuckets(rules, rule.id, rule);
  return { traits, rules };
}

const EXPECTED = {
  elementalist: {
    traits: {
      'Bolt to the Heart': { strike: 'multiplier' },
      'Bountiful Power': { strike: 'additive' },
      'Elements of Rage': { strike: 'additive', condition: 'additive' },
      'Empowering Auras': { strike: 'additive', condition: 'additive' },
      "Familiar's Prowess": { strike: 'additive', condition: 'additive' },
      'Fiery Might': { strike: 'multiplier' },
      'Flow like Water': { strike: 'multiplier' },
      'Persisting Flames': { strike: 'additive' },
      'Piercing Shards': { strike: 'multiplier' },
      "Pyromancer's Training": { strike: 'multiplier' },
      'Serrated Stones': { strike: 'multiplier' },
      Stormsoul: { strike: 'multiplier' },
      'Tempestuous Aria': { strike: 'additive', condition: 'additive' },
      'Transcendent Tempest': { strike: 'additive', condition: 'additive' }
    },
    rules: {
      'elementalist.hammer-fire-orb-strike': { strike: 'additive' },
      'elementalist.hammer-fire-orb-condition': { condition: 'additive' },
      'elementalist.meteor-center-impact': { strike: 'multiplier' },
      'elementalist.relentless-fire': { strike: 'additive' },
      'elementalist.relentless-fire-condition': { condition: 'additive' },
      'elementalist.weave-self-air': { strike: 'additive' },
      'elementalist.weave-self-fire': { condition: 'additive' },
      'elementalist.zap': { strike: 'multiplier' }
    }
  },
  engineer: {
    traits: {
      'Big Boomer': { strike: 'multiplier' },
      'Excessive Energy': { strike: 'additive' },
      'Glass Cannon': { strike: 'multiplier' },
      Grenadier: { strike: 'multiplier' },
      'Kinetic Battery': { strike: 'additive' },
      "Laser's Edge": { strike: 'multiplier' },
      'Modified Ammunition': { strike: 'multiplier' },
      'Object in Motion': { strike: 'multiplier' },
      'Photon Projector': { strike: 'multiplier' },
      'Shaped Charge': { strike: 'multiplier' },
      'Solar Focusing Lens': { strike: 'additive' },
      'Symbiotic Synergy': { strike: 'multiplier' },
      'Takedown Round': { strike: 'additive' },
      'Thermal Vision': { condition: 'additive' },
      'Willing Host': { strike: 'additive', condition: 'additive' }
    },
    rules: {
      'engineer.flame-jet-burning-target': { strike: 'additive' },
      'engineer.force-signet': { strike: 'additive' },
      'engineer.plasmatic-state-strike': { strike: 'additive' },
      'engineer.plasmatic-state-condition': { condition: 'additive' },
      'engineer.superconducting-signet': { condition: 'additive' }
    }
  },
  guardian: {
    traits: {
      'Amplified Wrath': { condition: 'multiplier' },
      'Big Game Hunter': { strike: 'multiplier' },
      'Empowered Armaments': { strike: 'additive' },
      'Fiery Wrath': { strike: 'multiplier' },
      'Furious Focus': { strike: 'additive' },
      'Heavy Light': { strike: 'multiplier' },
      'Inspired Virtue': { strike: 'multiplier' },
      'Inspiring Virtue': { strike: 'additive' },
      'Lethal Tempo': { strike: 'additive', condition: 'additive' },
      'Power for Power': { strike: 'multiplier' },
      'Pure of Sight': { strike: 'multiplier' },
      'Radiant Armaments': { strike: 'additive' },
      Retribution: { strike: 'additive' },
      'Symbolic Avenger': { strike: 'additive' },
      'Symbolic Exposure': { strike: 'multiplier' },
      'Unscathed Contender': { strike: ['additive', 'multiplier'] },
      "Zealot's Aggression": { strike: 'multiplier' }
    },
    rules: {
      'guardian.daring-advance': { strike: 'multiplier' },
      'guardian.glaring-burst-hammer': { strike: 'multiplier' },
      'guardian.gleaming-blade': { strike: 'multiplier' },
      'guardian.piercing-stance': { strike: 'additive' },
      'guardian.shining-spin': { strike: 'multiplier' }
    }
  },
  mesmer: {
    traits: {
      'Altered Chord': { strike: 'additive' },
      Bloodsong: { condition: 'multiplier' },
      Chronophantasma: { strike: 'multiplier' },
      'Bountiful Blades': { strike: 'multiplier' },
      'Compounding Power': { strike: 'additive', condition: 'additive' },
      'Deadly Blades': { strike: 'additive', condition: 'additive' },
      Egotism: { strike: 'multiplier' },
      'Empowered Illusions': { strike: 'multiplier' },
      Fragility: { strike: 'multiplier' },
      'Illusionary Membrane': { condition: 'additive' },
      'Infinite Forge': { strike: 'multiplier' },
      'Mental Anguish': { strike: 'multiplier' },
      'Mental Focus': { strike: 'multiplier' },
      "Nomad's Endurance": { strike: 'additive', condition: 'additive' },
      'Phantasmal Force': { strike: 'multiplier' },
      'Phantom Pain': { strike: 'additive', condition: 'additive' },
      Shredding: { strike: 'additive', condition: 'additive' },
      'Symphonic Resonance': { strike: 'additive', condition: 'additive' },
      'Time Bomb': { strike: 'multiplier' },
      'Time Catches Up': { strike: 'multiplier' },
      'Vicious Expression': { strike: 'multiplier' }
    },
    rules: {
      'mesmer.crescendo-instruments': { strike: 'multiplier' },
      'mesmer.mind-stab-vulnerability': { strike: 'multiplier' }
    }
  },
  necromancer: {
    traits: {
      'Cascading Corruption': { strike: 'additive', condition: 'additive' },
      'Close to Death': { strike: 'multiplier' },
      'Cold Shoulder': { strike: 'multiplier' },
      'Demonic Lore': { condition: 'multiplier' },
      Dread: { strike: 'additive' },
      'Fell Beacon': { condition: 'multiplier' },
      'Lingering Spirits': { strike: 'additive' },
      'Necromantic Corruption': { strike: 'multiplier' },
      'Putrid Defense': { condition: 'multiplier' },
      'Septic Corruption': { condition: 'additive' },
      'Soul Barbs': { strike: 'additive', condition: 'additive' },
      'Soul Eater': { strike: 'multiplier' },
      "Spirit's Strength": { strike: 'multiplier' },
      'Spiteful Talisman': { strike: 'multiplier' },
      'Wicked Corruption': { strike: 'additive' }
    },
    rules: {
      'necromancer.anguish-conditional-damage': { strike: 'additive' },
      // Active spirits scale Essence Blast independently of additive outgoing damage bonuses.
      'necromancer.essence-blast-active-spirits': { strike: 'multiplier' },
      'necromancer.ghastly-claws-vulnerability': { strike: 'multiplier' },
      'necromancer.life-siphon-bleeding-target': { strike: 'multiplier' },
      'necromancer.you-are-all-weaklings-melee': { strike: 'multiplier' },
      'necromancer.nothing-can-save-you-melee': { strike: 'multiplier' },
      'necromancer.chilled-to-the-bone-melee': { strike: 'multiplier' },
      'necromancer.your-soul-is-mine-melee': { strike: 'multiplier' },
      'necromancer.suffer-melee': { strike: 'multiplier' },
      'necromancer.rise-melee': { strike: 'multiplier' }
    }
  },
  ranger: {
    traits: {
      'Bird of Prey': { strike: 'multiplier' },
      'Blinding Outburst': { strike: 'multiplier' },
      'Bountiful Hunter': { strike: 'multiplier' },
      Farsighted: { strike: 'multiplier' },
      'Ferocious Symbiosis': { strike: 'additive' },
      'Flock Together': { strike: 'multiplier' },
      'Furious Strength': { strike: 'additive' },
      'Gale Force': { strike: 'additive' },
      'Go for the Throat': { strike: 'multiplier' },
      'Hidden Barbs': { condition: 'multiplier' },
      "Hunter's Tactics": { strike: 'multiplier' },
      'Light on your Feet': { strike: 'multiplier' },
      'Loud Whistle': { strike: 'multiplier' },
      'Natural Balance': { condition: 'additive' },
      'Oppressive Superiority': { strike: 'multiplier' },
      'Poison Master': { condition: 'multiplier' },
      "Predator's Onslaught": { strike: 'multiplier' },
      Remorseless: { strike: 'multiplier' },
      'Survival Instincts': { strike: 'additive' },
      'Twice as Vicious': { strike: 'additive', condition: 'additive' },
      'Vow of the Untamed': { strike: 'additive' },
      Wolfsong: { strike: 'multiplier' }
    },
    rules: {
      'ranger.attack-of-opportunity': { strike: 'multiplier' },
      'ranger.condition-count-skill-bonus': { strike: 'multiplier' },
      'ranger.consuming-bite-condition-count': { strike: 'multiplier' },
      'ranger.unleashed-wild-swing-defiant': { strike: 'multiplier' },
      'ranger.unleashed-savage-shock-wave-defiant': { strike: 'multiplier' },
      'ranger.falcons-stoop-disabled': { strike: 'multiplier' },
      'ranger.force-of-nature': { strike: 'multiplier' },
      'ranger.piercing-gales-vulnerability': { strike: 'multiplier' },
      'ranger.pounce-defiant': { strike: 'multiplier' },
      'ranger.sic-em-pet': { strike: 'multiplier' },
      'ranger.sic-em-player': { strike: 'multiplier' },
      'ranger.stalkers-strike-movement-impaired': { strike: 'multiplier' }
    }
  },
  revenant: {
    traits: {
      "Reaver's Curse": { strike: 'multiplier' },
      'Acolyte of Torment': { condition: 'multiplier' },
      'Destructive Impulses': { strike: 'additive', condition: 'additive' },
      'Draconic Echo': { strike: 'multiplier', condition: 'multiplier' },
      'Dwarven Battle Training': { strike: 'multiplier' },
      'Ferocious Aggression': { strike: 'additive', condition: 'additive' },
      'Forceful Persistence': { strike: 'additive' },
      'Forerunner of Death': { strike: 'additive' },
      Heartpiercer: { strike: 'multiplier', condition: 'multiplier' },
      'Lasting Legacy': { strike: 'additive', condition: 'additive' },
      'Leviathan Strength': { strike: 'multiplier' },
      'Numinous Gift': { strike: 'multiplier' },
      'Reinforced Potency': { strike: 'multiplier' },
      'Rising Tide': { strike: 'multiplier' },
      'Swift Termination': { strike: 'multiplier' },
      'Targeted Destruction': { strike: 'multiplier' },
      'Unsuspecting Strikes': { strike: 'multiplier' },
      'Vicious Reprisal': { strike: 'additive', condition: 'additive' }
    },
    rules: {
      'revenant.beguiling-haze-assassin-resonance': { strike: 'multiplier' },
      'revenant.burst-of-strength-condition': { condition: 'additive' },
      'revenant.burst-of-strength-strike': { strike: 'additive' },
      'revenant.release-assassin-affinity': { strike: 'multiplier' },
      'revenant.release-dervish-affinity': { strike: 'multiplier' },
      'revenant.release-warrior-affinity': { strike: 'multiplier' },
      'revenant.twin-moon-assassin-resonance': { strike: 'multiplier' }
    }
  },
  thief: {
    traits: {
      'Bounding Dodger': { strike: 'additive' },
      'Combat High': { strike: 'additive', condition: 'additive' },
      'Deadly Aim': { strike: 'multiplier' },
      'Deadly Ambush': { condition: 'multiplier' },
      Executioner: { strike: 'multiplier' },
      'Exhilarating Ephemera': { strike: 'additive' },
      'Exposed Weakness': { strike: 'multiplier' },
      'Fluid Strikes': { strike: 'additive' },
      'Havoc Specialist': { strike: 'multiplier' },
      'Iron Sight': { strike: 'multiplier' },
      'Lead Attacks': { strike: 'additive', condition: 'additive' },
      'Lotus Training': { condition: 'additive' },
      'Meticulous Custodian': { strike: 'multiplier' },
      'One in the Chamber': { strike: 'multiplier' },
      'Potent Poison': { condition: 'multiplier' },
      Premeditation: { strike: 'multiplier' },
      'Strength of Shadows': { condition: 'multiplier' },
      'Weakening Strikes': { strike: 'multiplier' }
    },
    rules: {
      'thief.malicious-ashen-assault-malice': { strike: 'multiplier' },
      'thief.backstab-defiant': { strike: 'multiplier' },
      'thief.larcenous-strike': { strike: 'multiplier' },
      'thief.falling-spider-empowered': { strike: 'multiplier' },
      'thief.distracting-throw-finisher-strike': { strike: 'additive' },
      'thief.distracting-throw-finisher-condition': { condition: 'additive' },
      'thief.kryptis-turret-damage': { strike: 'multiplier' },
      'thief.malicious-backstab-position': { strike: 'multiplier' },
      'thief.malicious-backstab-malice': { strike: 'multiplier' },
      'thief.malicious-deaths-judgment-malice': { strike: 'multiplier' },
      'thief.shadow-flare-marked': { strike: 'multiplier' },
      'thief.shadow-swap-marked': { strike: 'multiplier' }
    }
  },
  warrior: {
    traits: {
      "Berserker's Power": { strike: 'additive' },
      'Bloody Roar': { strike: 'multiplier' },
      'Brisk Pacing': { strike: 'additive', condition: 'additive' },
      'Burst Mastery': { strike: 'multiplier' },
      'Crack Shot': { strike: 'multiplier' },
      'Cull the Weak': { strike: 'multiplier' },
      Empowered: { strike: 'multiplier' },
      'Fierce as Fire': { strike: 'additive', condition: 'additive' },
      'Leg Specialist': { strike: 'multiplier' },
      'Magebane Tether': { strike: 'multiplier' },
      'Merciless Hammer': { strike: 'multiplier' },
      'Peak Performance': { strike: 'additive' },
      'Stalwart Strength': { strike: 'multiplier' },
      'Strengthening Stanzas': { strike: 'additive', condition: 'additive' },
      'Sun and Moon Style': { strike: 'multiplier' },
      "Warrior's Cunning": { strike: 'multiplier' },
      "Warrior's Sprint": { strike: 'additive' }
    },
    rules: {
      'warrior.fierce-blow-defiant': { strike: 'multiplier' },
      'warrior.breaching-strike-boonless': { strike: 'multiplier' },
      'warrior.kill-shot-threshold': { strike: 'multiplier' },
      'warrior.maiming-spear-epicenter': { strike: 'multiplier' },
      'warrior.overcharged-cartridges': { strike: 'multiplier' },
      'warrior.slicing-maelstrom-boonless': { strike: 'multiplier' },
      'warrior.wastrels-ruin-defiant': { strike: 'multiplier' }
    }
  }
};

const MODULES = {
  elementalist: elementalistNativeModules,
  engineer: engineerNativeModules,
  guardian: guardianNativeModules,
  mesmer: mesmerNativeModules,
  necromancer: necromancerNativeModules,
  ranger: rangerNativeModules,
  revenant: revenantNativeModules,
  thief: thiefNativeModules,
  warrior: warriorNativeModules
};

for (const [professionId, modules] of Object.entries(MODULES)) {
  test(`${professionId} damage modifiers declare their GW2 buckets`, () => {
    assert.deepEqual(declaredBuckets(modules), EXPECTED[professionId]);
  });
}
