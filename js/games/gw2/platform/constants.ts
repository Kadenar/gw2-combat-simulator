/** Shared vocabularies keep effect declarations, domain validation, and presentation aligned. */
export const BOON = Object.freeze({
  AEGIS: 'Aegis',
  ALACRITY: 'Alacrity',
  FURY: 'Fury',
  MIGHT: 'Might',
  PROTECTION: 'Protection',
  QUICKNESS: 'Quickness',
  REGENERATION: 'Regeneration',
  RESISTANCE: 'Resistance',
  RESOLUTION: 'Resolution',
  STABILITY: 'Stability',
  SWIFTNESS: 'Swiftness',
  VIGOR: 'Vigor'
});

export const CONDITION = Object.freeze({
  BLEEDING: 'Bleeding',
  BLINDNESS: 'Blindness',
  BURNING: 'Burning',
  CHILLED: 'Chilled',
  CONFUSION: 'Confusion',
  CRIPPLED: 'Crippled',
  FEAR: 'Fear',
  IMMOBILIZED: 'Immobilized',
  POISONED: 'Poisoned',
  SLOW: 'Slow',
  TAUNT: 'Taunt',
  TORMENT: 'Torment',
  VULNERABILITY: 'Vulnerability',
  WEAKNESS: 'Weakness'
});

export const AURA = Object.freeze({
  CHAOS: 'Chaos Aura',
  DARK: 'Dark Aura',
  FIRE: 'Fire Aura',
  FROST: 'Frost Aura',
  LIGHT: 'Light Aura',
  MAGNETIC: 'Magnetic Aura',
  SHOCKING: 'Shocking Aura'
});

/** Named control effects shared by skill declarations and disable-triggered reactions. */
export const CONTROL = Object.freeze({
  DAZE: 'daze',
  FEAR: 'fear',
  FLOAT: 'float',
  KNOCKBACK: 'knockback',
  KNOCKDOWN: 'knockdown',
  LAUNCH: 'launch',
  PULL: 'pull',
  PUSH: 'push',
  SINK: 'sink',
  STUN: 'stun',
  TAUNT: 'taunt'
});

export const COMBO_FIELD = Object.freeze({
  DARK: 'Dark',
  ETHEREAL: 'Ethereal',
  FIRE: 'Fire',
  ICE: 'Ice',
  LIGHT: 'Light',
  LIGHTNING: 'Lightning',
  POISON: 'Poison',
  SMOKE: 'Smoke',
  WATER: 'Water'
});

export const COMBO_FINISHER = Object.freeze({
  BLAST: 'Blast',
  LEAP: 'Leap',
  PROJECTILE: 'Projectile',
  WHIRL: 'Whirl'
});

/** Actor ownership determines eligibility for player-only procs independently of display labels. */
export const ACTOR = Object.freeze({
  PLAYER: 'player',
  SUMMON: 'summon',
  EFFECT: 'effect',
  ENVIRONMENT: 'environment',
  UNKNOWN: 'unknown'
});

export const RECIPIENT = Object.freeze({
  SELF: 'self',
  PARTY: 'party',
  SUMMONS: 'summons'
});

export const WEAPON = Object.freeze({
  AXE: 'Axe',
  DAGGER: 'Dagger',
  FOCUS: 'Focus',
  GREATSWORD: 'Greatsword',
  HAMMER: 'Hammer',
  LONGBOW: 'Longbow',
  MACE: 'Mace',
  PISTOL: 'Pistol',
  RIFLE: 'Rifle',
  SCEPTER: 'Scepter',
  SHIELD: 'Shield',
  SHORTBOW: 'Shortbow',
  SPEAR: 'Spear',
  STAFF: 'Staff',
  SWORD: 'Sword',
  TORCH: 'Torch',
  WARHORN: 'Warhorn'
});

export const STATUS = Object.freeze({
  STEALTH: 'stealth',
  SUPERSPEED: 'superspeed'
});

type ValueOf<T> = T[keyof T];

export type BoonName = ValueOf<typeof BOON>;

export type AuraName = ValueOf<typeof AURA>;

export type ControlKind = ValueOf<typeof CONTROL>;

export type ComboFieldType = ValueOf<typeof COMBO_FIELD>;

export type ComboFinisherType = ValueOf<typeof COMBO_FINISHER>;

export type SimulationActorType = ValueOf<typeof ACTOR>;

export type EffectRecipientScope = ValueOf<typeof RECIPIENT>;
