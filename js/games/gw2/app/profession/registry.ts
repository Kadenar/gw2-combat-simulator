/**
 * Lazy application manifest for every simulator exposed by the shared UI.
 *
 * Registry entries contain only presentation metadata and explicit dynamic
 * import functions. Reading this module therefore does not eagerly load any
 * profession implementation. Every profession is bootstrapped through the
 * shared profession app adapter.
 */

import type { Gw2AppAdapter, ProfessionAppContract } from '../types.js';

/** Armor classes, ordered as navigation surfaces group professions. */
export const ARMOR_WEIGHTS = ['light', 'medium', 'heavy'] as const;

export type ArmorWeight = (typeof ARMOR_WEIGHTS)[number];

/** Display labels for each armor class group. */
export const ARMOR_WEIGHT_LABELS: Readonly<Record<ArmorWeight, string>> = {
  light: 'Light Armor',
  medium: 'Medium Armor',
  heavy: 'Heavy Armor'
};

export interface ProfessionRegistryEntry {
  /** Stable lowercase identifier used by builds and pages. */
  readonly id: string;
  /** Armor class used to group professions in navigation surfaces. */
  readonly armorWeight: ArmorWeight;
  /** Human-readable profession name. */
  readonly name: string;
  /** Official base-profession icon used by navigation surfaces. */
  readonly icon?: string;
  /** Browser route for the profession application. */
  readonly route: string;
  /** Optional class applied to the document body. */
  readonly themeClass: string;
  /** Specialization artwork used by the landing-page drill-down. */
  readonly specializationArtwork?: readonly Readonly<{ name: string; image: string }>[];
  /** Lazy profession loader. */
  readonly loadProfession: () => Promise<ProfessionAppContract>;
  /** Lazy shared-shell adapter loader. */
  readonly loadAppAdapter: () => Promise<Gw2AppAdapter>;
}

// Entries are ordered by armor class so navigation surfaces group
// professions Light → Medium → Heavy: the shared UI (landing card grid and
// simulator header select) renders in registry order.
const entries: readonly ProfessionRegistryEntry[] = [
  // Light armor: Elementalist, Mesmer, Necromancer.
  {
    id: 'elementalist',
    armorWeight: 'light',
    name: 'Elementalist',
    icon: 'https://render.guildwars2.com/file/BBED46EB20C80D0DDE0F99402493C7E6FFAE1530/156629.png',
    route: 'elementalist.html',
    themeClass: 'elementalist-theme',
    specializationArtwork: [
      {
        name: 'Tempest',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/DY1QuOFHqxbVsqC1jBryNm66eoZglhMgMDhrVShJ.webp'
      },
      {
        name: 'Weaver',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/79g5CiydrrztYx6qIvmNMmUobwRvdGzskIqwI5cn.webp'
      },
      {
        name: 'Catalyst',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/uFKRbwhHh5GKyGV9Evohhx0UTd4T8YZjrW44uawP.webp'
      },
      {
        name: 'Evoker',
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/7HNOxiXpl9wkAl2ykM3D2jrSFtciZfLgseLcEgpG.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('../../content/professions/elementalist/definition.js');
      return module.elementalistProfession;
    },
    loadAppAdapter: async () => {
      const module = await import('../../content/professions/elementalist/app/app-definition.js');
      return module.elementalistAppAdapter;
    }
  },
  {
    id: 'mesmer',
    armorWeight: 'light',
    name: 'Mesmer',
    icon: 'https://render.guildwars2.com/file/AF61567E16A83F145D6FB35D63BF01074A3A5AB9/156635.png',
    route: 'mesmer.html',
    themeClass: 'mesmer-theme',
    specializationArtwork: [
      {
        name: 'Chronomancer',
        image:
          'https://assets.snowcrows.com/uploads/0154d14c-1026-4ff3-951c-bc5454ca4f4e/wYMly4iJbZEwdZPG2oWwqnCb7ly4VTvI58oBnW5K.jpg'
      },
      {
        name: 'Mirage',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/somZhFPIsB4GHxrhjqtlPy4loceNBcvW3SrZY7uQ.webp'
      },
      {
        name: 'Virtuoso',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/6YCwMKZA9ZT278R4F3N5fGLVGXeCU9Yls54CRuq0.webp'
      },
      {
        name: 'Troubadour',
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/JL0RMiFPQYZYr3LaxWcd92JoT98SPNniwSeTRkxj.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('../../content/professions/mesmer/definition.js');
      return module.mesmerProfession;
    },
    loadAppAdapter: async () => {
      const module = await import('../../content/professions/mesmer/app/app-definition.js');
      return module.mesmerAppAdapter;
    }
  },
  {
    id: 'necromancer',
    armorWeight: 'light',
    name: 'Necromancer',
    icon: 'https://render.guildwars2.com/file/CA5A4E96080FCF057C9DA0ED35C693477580421C/156637.png',
    route: 'necromancer.html',
    themeClass: 'necromancer-theme',
    specializationArtwork: [
      {
        name: 'Reaper',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/BkrNHpfZ3rdgQvRcCSZHzh8ErnakQYRi5jpekaMt.webp'
      },
      {
        name: 'Scourge',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/DsG45NgUXhOYGI6fuQUB6pvkLQJlbjI2iQU4nvYz.webp'
      },
      {
        name: 'Harbinger',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/5c9lVrJthmDO46fBpYEFVxQM3NJdsEpQbcfwiS6B.webp'
      },
      {
        name: 'Ritualist',
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/DEw7Kgg3cI1stZM9dboksGtGmo4r4v5uP8y5lCcp.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('../../content/professions/necromancer/definition.js');
      return module.necromancerProfession;
    },
    loadAppAdapter: async () => {
      const module = await import('../../content/professions/necromancer/app/app-definition.js');
      return module.necromancerAppAdapter;
    }
  },
  // Medium armor: Ranger, Thief, Engineer.
  {
    id: 'ranger',
    armorWeight: 'medium',
    name: 'Ranger',
    icon: 'https://render.guildwars2.com/file/49B10316B424F4E20139EB5E51ADCF24A8724E9B/156640.png',
    route: 'ranger.html',
    themeClass: 'ranger-theme',
    specializationArtwork: [
      {
        name: 'Druid',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/YIwgxjG1E7FiKqSAaXrCiuQfh7w5eTEOYXK0Id8x.webp'
      },
      {
        name: 'Soulbeast',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/95KRcPOeigpwlQQRzh6aFVIxixWXbTgQUtNSJQZN.webp'
      },
      {
        name: 'Untamed',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/e5vuxTdgb41Dnjrb9jKmNF9tRYD1jVS6incDVoAY.webp'
      },
      {
        name: 'Galeshot',
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/dVd7Wrx57mbdUHAIfZyUmuCFv5YxdH8yQ4Vij4Em.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('../../content/professions/ranger/definition.js');
      return module.rangerProfession;
    },
    loadAppAdapter: async () => {
      const module = await import('../../content/professions/ranger/app/app-definition.js');
      return module.rangerAppAdapter;
    }
  },
  {
    id: 'thief',
    armorWeight: 'medium',
    name: 'Thief',
    icon: 'https://render.guildwars2.com/file/13A2C0EF23F23FF2084875629465279DDA807E3D/103581.png',
    route: 'thief.html',
    themeClass: 'thief-theme',
    specializationArtwork: [
      {
        name: 'Daredevil',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/Z324ofTh0ZEVH1ix916jvmBa8gy0LmBsxwBJ5MMY.webp'
      },
      {
        name: 'Deadeye',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/n0TGLINi59LKvimT7g1Txsq618vG6weOUWASLGZc.webp'
      },
      {
        name: 'Specter',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/hh7tsjXK3pWbwcX3NpOLlNuqwxPPnZ7mIMHc8J4U.webp'
      },
      {
        name: 'Antiquary',
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/vz40JTGUEZc62s7ywMA5jsC1qq9hbgpGrcIgi9Ai.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('../../content/professions/thief/definition.js');
      return module.thiefProfession;
    },
    loadAppAdapter: async () => {
      const module = await import('../../content/professions/thief/app/app-definition.js');
      return module.thiefAppAdapter;
    }
  },
  {
    id: 'engineer',
    armorWeight: 'medium',
    name: 'Engineer',
    icon: 'https://render.guildwars2.com/file/A94D00911BD47CDE39A104F90C7D07DE623554ED/156631.png',
    route: 'engineer.html',
    themeClass: 'engineer-theme',
    specializationArtwork: [
      {
        name: 'Scrapper',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/HBhHXtTeUoT4FYywlQRAK2vh3qSlYIKF6nprLb9N.webp'
      },
      {
        name: 'Holosmith',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/nX4xZk6pSAioBVDtGNPvxMzFiLnXeh57XYDLYpwy.webp'
      },
      {
        name: 'Mechanist',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/vxW0dgd4EWscl9ZnTj64PUGWnvxKvtoKzP9No71Y.webp'
      },
      {
        name: 'Amalgam',
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/dx0sO3S57jI2vBT2Zq60BTR8wmwVU4njs8vQKz2a.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('../../content/professions/engineer/definition.js');
      return module.engineerProfession;
    },
    loadAppAdapter: async () => {
      const module = await import('../../content/professions/engineer/app/app-definition.js');
      return module.engineerAppAdapter;
    }
  },
  // Heavy armor: Guardian, Warrior, Revenant.
  {
    id: 'guardian',
    armorWeight: 'heavy',
    name: 'Guardian',
    icon: 'https://render.guildwars2.com/file/6E0D0AC6E0CE5C0C29B3D736ABEA070F4A58540E/156633.png',
    route: 'guardian.html',
    themeClass: 'guardian-theme',
    specializationArtwork: [
      {
        name: 'Dragonhunter',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/y9EFXtfsvw5Zu4G79YOK5l44t1ApVxouqCl0X3sc.webp'
      },
      {
        name: 'Firebrand',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/Y7P9W6bnJxXwXdYhJFZjFYorQNoTYxmX6bQNhQwp.webp'
      },
      {
        name: 'Willbender',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/8jddMTYX5c9ANlYyMv3mHNtfbO4k0OU9t7dtU0za.webp'
      },
      {
        name: 'Luminary',
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/urNqWJC2Sjr9WPMLNmjB2mIPOFSbYIZC7oXZ2RIp.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('../../content/professions/guardian/definition.js');
      return module.guardianProfession;
    },
    loadAppAdapter: async () => {
      const module = await import('../../content/professions/guardian/app/app-definition.js');
      return module.guardianAppAdapter;
    }
  },
  {
    id: 'warrior',
    armorWeight: 'heavy',
    name: 'Warrior',
    icon: 'https://render.guildwars2.com/file/0A97E13F29B3597A447EEC04A09BE5BD699A2250/156643.png',
    route: 'warrior.html',
    themeClass: 'warrior-theme',
    specializationArtwork: [
      {
        name: 'Berserker',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/30Nm9xGdYbTK2sGTctH0NjgDZCXNpF638rNdzf21.webp'
      },
      {
        name: 'Spellbreaker',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/BFaJz8HGGRHbqeyiRQBjFAQLSPs5I0h6cFtfYqQ5.webp'
      },
      {
        name: 'Bladesworn',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/VMJqAcWz49leISknOREwMe70o9UGtQ07411QnvUQ.webp'
      },
      {
        name: 'Paragon',
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/Tlvlqv76IwR5gPErYmQd3hITnSdwl63uSDIoZHXG.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('../../content/professions/warrior/definition.js');
      return module.warriorProfession;
    },
    loadAppAdapter: async () => {
      const module = await import('../../content/professions/warrior/app/app-definition.js');
      return module.warriorAppAdapter;
    }
  },
  {
    id: 'revenant',
    armorWeight: 'heavy',
    name: 'Revenant',
    icon: 'https://render.guildwars2.com/file/696A48DD61EE01FD1F4FBBBDB82D74611E04EA39/965717.png',
    route: 'revenant.html',
    themeClass: 'revenant-theme',
    specializationArtwork: [
      {
        name: 'Herald',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/l0wPR2fHc2w93nRdDVXWrnclAyD5umThxEZ2SEKX.webp'
      },
      {
        name: 'Renegade',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/5Q6RzaTlf5rbcKnWQWvC3UsWm7k1s2OtIshJf1lL.webp'
      },
      {
        name: 'Vindicator',
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/NICSEOqnu3qzL2b6BTpzcSg7V9CG7UZ6HPDT4Vv7.webp'
      },
      {
        name: 'Conduit',
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/ANbyHo4hZbVvjvEEuKHomAJ4iXkccxEAXZ77IJdg.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('../../content/professions/revenant/definition.js');
      return module.revenantProfession;
    },
    loadAppAdapter: async () => {
      const module = await import('../../content/professions/revenant/app/app-definition.js');
      return module.revenantAppAdapter;
    }
  }
];

export const professionRegistry: readonly ProfessionRegistryEntry[] = entries;

export interface ProfessionArmorGroup {
  readonly weight: ArmorWeight;
  readonly label: string;
  readonly entries: readonly ProfessionRegistryEntry[];
}

/**
 * Registry entries partitioned by armor class in `ARMOR_WEIGHTS` order, for
 * navigation surfaces that render grouped headers. Empty groups are omitted.
 */
export const professionGroups: readonly ProfessionArmorGroup[] = ARMOR_WEIGHTS.map((weight) => ({
  weight,
  label: ARMOR_WEIGHT_LABELS[weight],
  entries: professionRegistry.filter((entry) => entry.armorWeight === weight)
})).filter((group) => group.entries.length > 0);

const byId = new Map<string, ProfessionRegistryEntry>(professionRegistry.map((entry) => [entry.id, entry]));

export interface ProfessionOption {
  readonly id: string;
  readonly name: string;
}

export const professionOptions: readonly ProfessionOption[] = professionRegistry.map(({ id, name }) => ({ id, name }));

export const PROFESSION_ROUTES: Readonly<Record<string, string>> = Object.fromEntries(
  professionRegistry.map(({ id, route }) => [id, route])
);

/**
 * Returns the registered entry for a profession ID, or `null` for an unknown ID.
 */
export function getProfessionEntry(professionId: string): ProfessionRegistryEntry | null {
  return byId.get(professionId) || null;
}

/**
 * Resolves a profession ID to its page, falling back to the landing page.
 */
export function professionRoute(professionId: string): string {
  return getProfessionEntry(professionId)?.route || 'index.html';
}

/**
 * Lazily loads a profession contract, or `null` for an unknown ID.
 */
export async function loadProfession(professionId: string): Promise<ProfessionAppContract | null> {
  const entry = getProfessionEntry(professionId);
  return entry ? entry.loadProfession() : null;
}

/**
 * Lazily loads a profession's shared-shell adapter, or `null` for an unknown ID.
 */
export async function loadProfessionAppAdapter(professionId: string): Promise<Gw2AppAdapter | null> {
  const entry = getProfessionEntry(professionId);
  return entry ? entry.loadAppAdapter() : null;
}
