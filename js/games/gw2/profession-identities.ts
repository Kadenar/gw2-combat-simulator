/** Shared identities let registries and log adapters enumerate professions without loading catalogs or artwork. */
export const PROFESSION_IDENTITIES = {
  elementalist: {
    name: 'Elementalist',
    specializations: { core: 'Core', tempest: 'Tempest', weaver: 'Weaver', catalyst: 'Catalyst', evoker: 'Evoker' }
  },
  mesmer: {
    name: 'Mesmer',
    specializations: {
      core: 'Core',
      chronomancer: 'Chronomancer',
      mirage: 'Mirage',
      virtuoso: 'Virtuoso',
      troubadour: 'Troubadour'
    }
  },
  necromancer: {
    name: 'Necromancer',
    specializations: {
      core: 'Core',
      reaper: 'Reaper',
      scourge: 'Scourge',
      harbinger: 'Harbinger',
      ritualist: 'Ritualist'
    }
  },
  ranger: {
    name: 'Ranger',
    specializations: { core: 'Core', druid: 'Druid', soulbeast: 'Soulbeast', untamed: 'Untamed', galeshot: 'Galeshot' }
  },
  thief: {
    name: 'Thief',
    specializations: {
      core: 'Core',
      daredevil: 'Daredevil',
      deadeye: 'Deadeye',
      specter: 'Specter',
      antiquary: 'Antiquary'
    }
  },
  engineer: {
    name: 'Engineer',
    specializations: {
      core: 'Core',
      scrapper: 'Scrapper',
      holosmith: 'Holosmith',
      mechanist: 'Mechanist',
      amalgam: 'Amalgam'
    }
  },
  guardian: {
    name: 'Guardian',
    specializations: {
      core: 'Core',
      dragonhunter: 'Dragonhunter',
      firebrand: 'Firebrand',
      willbender: 'Willbender',
      luminary: 'Luminary'
    }
  },
  warrior: {
    name: 'Warrior',
    specializations: {
      core: 'Core',
      berserker: 'Berserker',
      spellbreaker: 'Spellbreaker',
      bladesworn: 'Bladesworn',
      paragon: 'Paragon'
    }
  },
  revenant: {
    name: 'Revenant',
    specializations: {
      core: 'Core',
      herald: 'Herald',
      renegade: 'Renegade',
      vindicator: 'Vindicator',
      conduit: 'Conduit'
    }
  }
} as const;
