import { TRAIT_COVERAGE_STATUSES, validateTraitCoverageManifest } from '../../../platform/gw2/trait-coverage.js';
import { thiefCatalog } from '../catalog.js';
import type { CatalogEntity } from '../../../platform/engine/types.js';

const IMPLEMENTED = new Set([
  "Serpent's Touch",
  'Exposed Weakness',
  'Dagger Training',
  'Deadly Ambition',
  'Even the Odds',
  'Revealed Training',
  'Executioner',
  'Unrelenting Strikes',
  'Ferocious Strikes',
  "Assassin's Fury",
  'Signets of Power',
  'Twin Fangs',
  'Sundering Shade',
  'Practiced Tolerance',
  'Deadly Aim',
  'No Quarter',
  "Shadow's Rejuvenation",
  'Hidden Thief',
  'Kleptomaniac',
  'Preparedness',
  'Lead Attacks',
  'Quick Pockets',
  'Deadly Ambush',
  'Upper Hand',
  "Marauder's Resilience",
  'Staff Master',
  'Weakening Strikes',
  'Havoc Specialist',
  'Endurance Thief',
  "Brawler's Tenacity",
  'Physical Supremacy',
  'Lotus Training',
  'Unhindered Combatant',
  'Bounding Dodger',
  'Iron Sight',
  "Deadeye's Gaze",
  'Malicious Intent',
  'One in the Chamber',
  'Silent Scope',
  'Premeditation',
  'Maleficent Seven',
  'Be Quick or Be Killed',
  'Fire for Effect',
  'Second Opinion',
  'Specter',
  'Dark Sentry',
  'Larcenous Torment',
  'Amplified Siphoning',
  'Strength of Shadows',
  'Shadestep',
  'Card Swap',
  'Repeat Ransacker',
  'Enterprising Aristocrat',
  'Trinket Collector',
  'Prolific Plunderer',
  "Scoundrel's Luck",
  'Meticulous Custodian',
  'Exhilarating Ephemera',
  'Prodigious Pincher',
  'Possessive Hoarder',
  'Combat High'
]);
const reason =
  'This healing, barrier, ally-only, movement, incoming-hit, defensive, revival, or competitive-only effect does not change the deterministic single-target damage model.';

const manifest = thiefCatalog.traits.map((trait) => {
  const implemented = IMPLEMENTED.has(trait.name);
  const status = implemented ? TRAIT_COVERAGE_STATUSES.IMPLEMENTED : TRAIT_COVERAGE_STATUSES.OUT_OF_MODEL;
  return {
    traitId: trait.id,
    status,
    effects: [
      {
        description: String(trait.description || '').trim() || `Reviewed combat behavior for ${trait.name}.`,
        status,
        ...(implemented ? {} : { reason })
      }
    ],
    ...(implemented ? {} : { reason })
  };
});

export const THIEF_TRAIT_COVERAGE = validateTraitCoverageManifest(thiefCatalog, manifest, { professionId: 'thief' });
