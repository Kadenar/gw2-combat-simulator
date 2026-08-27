import { TRAIT_COVERAGE_STATUSES, validateTraitCoverageManifest } from '../../helpers/trait-coverage.js';
import { warriorCatalog } from '../../../js/games/gw2/content/professions/warrior/catalog.js';

const IMPLEMENTED = new Set([
  'Reckless Dodge',
  'Brave Stride',
  'Peak Performance',
  'Building Momentum',
  'Body Blow',
  'Pinnacle of Strength',
  'Forceful Greatsword',
  'Great Fortitude',
  "Berserker's Power",
  'Aggressive Onslaught',
  'Marching Orders',
  'Leg Specialist',
  "Soldier's Comfort",
  'Roaring Reveille',
  'Empowered',
  "Warrior's Cunning",
  'Empower Allies',
  'Martial Cadence',
  'Vigorous Shouts',
  'Phalanx Strength',
  'Thick Skin',
  'Cull the Weak',
  'Merciless Hammer',
  'Stalwart Strength',
  'Furious Burst',
  'Deep Strikes',
  'Bloodlust',
  'Wounding Precision',
  'Signet Mastery',
  'Opportunist',
  'Unsuspecting Foe',
  'Sundering Burst',
  'Blademaster',
  'Burst Precision',
  'Furious',
  'Dual Wielding',
  'Versatile Rage',
  'Versatile Power',
  "Warrior's Sprint",
  'Destruction of the Empowered',
  'Axe Mastery',
  'Burst Mastery',
  'Smash Brawler',
  'Last Blaze',
  'Blood Reaction',
  'Bloody Roar',
  'King of Fires',
  "Spellbreaker's Conviction",
  "Attacker's Insight",
  'Pure Strike',
  'No Escape',
  'Sun and Moon Style',
  'Magebane Tether',
  'Guns and Glory',
  'Gun X Sword',
  'Unseen Sword',
  'Sharp as the Wind',
  "River's Flow",
  'Dragonscale Defense',
  'Fierce as Fire',
  'Lush Forest',
  'Unyielding Dragon',
  'Daring Dragon',
  'Rally the Valiant',
  'Call to Action',
  'Inspiring Implements',
  'Strengthening Stanzas',
  'Reverberation',
  'Feverish Pulse',
  'Brisk Pacing',
  'Enduring Refrain'
]);

const REASONS = Object.freeze({
  defensive:
    'Incoming damage, blocking, healing, barrier, revival, and condition cleansing are outside the outgoing single-target damage model.',
  ally: 'Ally-only boon, healing, and group-support effects are outside the single-player target model.',
  movement: 'Movement, dodge, and positioning effects are not represented by the stationary target model.',
  missing: 'The public skill data does not provide enough deterministic numeric detail for this effect.'
});

function outOfModelReason(trait) {
  const description = String(trait.description || '').toLowerCase();

  if (/ally|allies|nearby|reviv/.test(description)) return REASONS.ally;

  if (/heal|barrier|incoming|block|condition.*remove|damage.*reduced/.test(description)) return REASONS.defensive;

  if (/movement|dodge|endurance/.test(description)) return REASONS.movement;
  return REASONS.missing;
}

const manifest = warriorCatalog.traits.map((trait) => {
  const implemented = IMPLEMENTED.has(trait.name);
  const status = implemented ? TRAIT_COVERAGE_STATUSES.IMPLEMENTED : TRAIT_COVERAGE_STATUSES.OUT_OF_MODEL;
  const reason = outOfModelReason(trait);
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

export const WARRIOR_TRAIT_COVERAGE = validateTraitCoverageManifest(warriorCatalog, manifest, {
  professionId: 'warrior'
});
