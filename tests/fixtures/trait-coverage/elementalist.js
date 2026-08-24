import { TRAIT_COVERAGE_STATUSES, validateTraitCoverageManifest } from '../../helpers/trait-coverage.js';
import { elementalistCatalog } from '../../../js/professions/elementalist/catalog.js';

const IMPLEMENTED = new Set([
  'Empowering Flame',
  'Burning Precision',
  'Conjurer',
  'Sunspot',
  'Burning Rage',
  'Smothering Auras',
  'Power Overwhelming',
  "Pyromancer's Training",
  'Persisting Flames',
  "Pyromancer's Puissance",
  'Inferno',
  "Zephyr's Speed",
  "Zephyr's Boon",
  'One with Air',
  'Ferocious Winds',
  'Electric Discharge',
  'Inscription',
  'Raging Storm',
  'Stormsoul',
  "Aeromancer's Training",
  'Bolt to the Heart',
  'Fresh Air',
  'Lightning Rod',
  "Earth's Embrace",
  'Serrated Stones',
  'Elemental Shielding',
  'Earthen Blast',
  'Strength of Stone',
  'Rock Solid',
  "Geomancer's Training",
  'Written in Stone',
  'Soothing Ice',
  'Piercing Shards',
  'Flow like Water',
  "Aquamancer's Training",
  'Soothing Power',
  'Arcane Prowess',
  'Arcane Precision',
  'Renewing Stamina',
  'Elemental Attunement',
  'Elemental Lockdown',
  'Elemental Enchantment',
  'Evasive Arcana',
  'Arcane Lightning',
  'Bountiful Power',
  'Singularity',
  'Gale Song',
  'Latent Stamina',
  'Unstable Conduit',
  'Gathered Focus',
  'Hardy Conduit',
  'Tempestuous Aria',
  'Harmonious Conduit',
  'Invigorating Torrents',
  'Transcendent Tempest',
  'Lucid Singularity',
  'Elemental Bastion',
  'Weaver',
  'Superior Elements',
  'Elemental Pursuit',
  "Weaver's Prowess",
  'Swift Revenge',
  'Bolstered Elements',
  'Elemental Polyphony',
  'Elemental Refreshment',
  'Elements of Rage',
  'Flow State',
  'Depth of Elements',
  'Vicious Empowerment',
  'Energized Elements',
  'Elemental Empowerment',
  'Empowering Auras',
  'Spectacular Sphere',
  'Elemental Epitome',
  'Elemental Synergy',
  'Empowered Empowerment',
  'Sphere Specialist',
  'Evocation',
  'Fiery Might',
  'Enhanced Potency',
  "Familiar's Focus",
  "Familiar's Blessing",
  'Elemental Dynamo',
  'Altruistic Aspect',
  "Familiar's Prowess",
  'Galvanic Enchantment',
  'Elemental Balance',
  'Specialized Elements'
]);

function outOfModelReason(trait) {
  const description = String(trait.description || '').toLowerCase();

  if (/ally|allies|share|revive/.test(description)) {
    return "This allied or revival payload cannot change the simulator's deterministic single-target damage output.";
  }

  if (/heal|barrier|incoming damage|damage reduction|health/.test(description)) {
    return 'This healing, barrier, health, or incoming-damage payload is outside the deterministic outgoing-damage model.';
  }

  if (/cleanse|remove.*condition|condition.*remove|blind/.test(description)) {
    return 'This defensive condition-management payload has no represented incoming-condition state or deterministic damage output.';
  }

  if (/movement|superspeed|swiftness|dodge/.test(description)) {
    return 'This movement or defensive-evasion payload has no effect in the stationary deterministic target model.';
  }

  return 'This catalog effect has no deterministic single-target damage, boon-uptime, recharge, or resource consequence in the native model.';
}

const manifest = elementalistCatalog.traits.map((trait) => {
  const implemented = IMPLEMENTED.has(trait.name);
  const status = implemented ? TRAIT_COVERAGE_STATUSES.IMPLEMENTED : TRAIT_COVERAGE_STATUSES.OUT_OF_MODEL;
  const reason = implemented ? '' : outOfModelReason(trait);
  return {
    traitId: trait.id,
    status,
    effects: [
      {
        description:
          String(trait.description || '').trim() || `Reviewed deterministic combat behavior for ${trait.name}.`,
        status,
        ...(implemented ? {} : { reason })
      }
    ],
    ...(implemented ? {} : { reason })
  };
});

export const ELEMENTALIST_TRAIT_COVERAGE = validateTraitCoverageManifest(elementalistCatalog, manifest, {
  professionId: 'elementalist'
});
