/**
 * Lazy application manifest for every simulator exposed by the shared UI.
 *
 * Registry entries contain only presentation metadata and explicit dynamic
 * import functions. Reading this module therefore does not eagerly load any
 * profession implementation. Every profession is bootstrapped through the
 * shared profession app adapter.
 */

import type { Gw2AppAdapter, ProfessionAppContract } from '#gw2/app/types.js';
import type { AnyNativeModule, NativeProfessionContract } from '#gw2/platform/profession-definition/module-types.js';

// Preserve native composition metadata so engine consumers can apply previews without loading an app adapter.
type RegisteredProfession = ProfessionAppContract &
  NativeProfessionContract<readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]]>;

/** Armor classes, ordered as navigation surfaces group professions. */
export const ARMOR_WEIGHTS = ['light', 'medium', 'heavy'] as const;

export type ArmorWeight = (typeof ARMOR_WEIGHTS)[number];

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
  /** Landing-card artwork plus bundled transparent portraits for optimizer character previews. */
  readonly specializationArtwork?: readonly Readonly<{ name: string; image: string; conceptArt?: string }>[];
  /** Lazy profession loader. */
  readonly loadProfession: () => Promise<RegisteredProfession>;
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
        name: 'Core',
        conceptArt: new URL('@images/professions/elementalist.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/2FEEkQBNxzaWIIx21vmnpc7dccL6om02MDNmNuZ1.webp'
      },
      {
        name: 'Tempest',
        conceptArt: new URL('@images/professions/tempest.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/DY1QuOFHqxbVsqC1jBryNm66eoZglhMgMDhrVShJ.webp'
      },
      {
        name: 'Weaver',
        conceptArt: new URL('@images/professions/weaver.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/79g5CiydrrztYx6qIvmNMmUobwRvdGzskIqwI5cn.webp'
      },
      {
        name: 'Catalyst',
        conceptArt: new URL('@images/professions/catalyst.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/uFKRbwhHh5GKyGV9Evohhx0UTd4T8YZjrW44uawP.webp'
      },
      {
        name: 'Evoker',
        conceptArt: new URL('@images/professions/evoker.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/7HNOxiXpl9wkAl2ykM3D2jrSFtciZfLgseLcEgpG.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('#gw2/professions/elementalist/definition.js');
      return module.elementalistProfession;
    },
    loadAppAdapter: async () => {
      const module = await import('#gw2/professions/elementalist/app/app-definition.js');
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
        name: 'Core',
        conceptArt: new URL('@images/professions/mesmer.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/0154d14c-1026-4ff3-951c-bc5454ca4f4e/AdKbIsuTW9tQQRRRSqOGFiU46rjSyHylChEyUq1D.jpg'
      },
      {
        name: 'Chronomancer',
        conceptArt: new URL('@images/professions/chronomancer.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/0154d14c-1026-4ff3-951c-bc5454ca4f4e/wYMly4iJbZEwdZPG2oWwqnCb7ly4VTvI58oBnW5K.jpg'
      },
      {
        name: 'Mirage',
        conceptArt: new URL('@images/professions/mirage.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/somZhFPIsB4GHxrhjqtlPy4loceNBcvW3SrZY7uQ.webp'
      },
      {
        name: 'Virtuoso',
        conceptArt: new URL('@images/professions/virtuoso.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/6YCwMKZA9ZT278R4F3N5fGLVGXeCU9Yls54CRuq0.webp'
      },
      {
        name: 'Troubadour',
        conceptArt: new URL('@images/professions/troubadour.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/JL0RMiFPQYZYr3LaxWcd92JoT98SPNniwSeTRkxj.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('#gw2/professions/mesmer/definition.js');
      return module.mesmerProfession;
    },
    loadAppAdapter: async () => {
      const module = await import('#gw2/professions/mesmer/app/app-definition.js');
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
        name: 'Core',
        conceptArt: new URL('@images/professions/necromancer.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/DDW5i9E5dyuhaXywvO2Wiqn0nQYOwjxZg9GQn6ni.webp'
      },
      {
        name: 'Reaper',
        conceptArt: new URL('@images/professions/reaper.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/BkrNHpfZ3rdgQvRcCSZHzh8ErnakQYRi5jpekaMt.webp'
      },
      {
        name: 'Scourge',
        conceptArt: new URL('@images/professions/scourge.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/DsG45NgUXhOYGI6fuQUB6pvkLQJlbjI2iQU4nvYz.webp'
      },
      {
        name: 'Harbinger',
        conceptArt: new URL('@images/professions/harbinger.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/5c9lVrJthmDO46fBpYEFVxQM3NJdsEpQbcfwiS6B.webp'
      },
      {
        name: 'Ritualist',
        conceptArt: new URL('@images/professions/ritualist.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/DEw7Kgg3cI1stZM9dboksGtGmo4r4v5uP8y5lCcp.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('#gw2/professions/necromancer/definition.js');
      return module.necromancerProfession;
    },
    loadAppAdapter: async () => {
      const module = await import('#gw2/professions/necromancer/app/app-definition.js');
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
        name: 'Core',
        conceptArt: new URL('@images/professions/ranger.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/0154d14c-1026-4ff3-951c-bc5454ca4f4e/yl95i2EFNwe4qI4F8Vo0a81LhvSnVFZ9w2evSsig.jpg'
      },
      {
        name: 'Druid',
        conceptArt: new URL('@images/professions/druid.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/YIwgxjG1E7FiKqSAaXrCiuQfh7w5eTEOYXK0Id8x.webp'
      },
      {
        name: 'Soulbeast',
        conceptArt: new URL('@images/professions/soulbeast.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/95KRcPOeigpwlQQRzh6aFVIxixWXbTgQUtNSJQZN.webp'
      },
      {
        name: 'Untamed',
        conceptArt: new URL('@images/professions/untamed.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/e5vuxTdgb41Dnjrb9jKmNF9tRYD1jVS6incDVoAY.webp'
      },
      {
        name: 'Galeshot',
        conceptArt: new URL('@images/professions/galeshot.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/dVd7Wrx57mbdUHAIfZyUmuCFv5YxdH8yQ4Vij4Em.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('#gw2/professions/ranger/definition.js');
      return module.rangerProfession;
    },
    loadAppAdapter: async () => {
      const module = await import('#gw2/professions/ranger/app/app-definition.js');
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
        name: 'Core',
        conceptArt: new URL('@images/professions/thief.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/0154d14c-1026-4ff3-951c-bc5454ca4f4e/mLAhlUPnakYgM3FwEni1Mfr16Oi8VMVZ4TpSMgZE.jpg'
      },
      {
        name: 'Daredevil',
        conceptArt: new URL('@images/professions/daredevil.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/Z324ofTh0ZEVH1ix916jvmBa8gy0LmBsxwBJ5MMY.webp'
      },
      {
        name: 'Deadeye',
        conceptArt: new URL('@images/professions/deadeye.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/n0TGLINi59LKvimT7g1Txsq618vG6weOUWASLGZc.webp'
      },
      {
        name: 'Specter',
        conceptArt: new URL('@images/professions/specter.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/hh7tsjXK3pWbwcX3NpOLlNuqwxPPnZ7mIMHc8J4U.webp'
      },
      {
        name: 'Antiquary',
        conceptArt: new URL('@images/professions/antiquary.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/vz40JTGUEZc62s7ywMA5jsC1qq9hbgpGrcIgi9Ai.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('#gw2/professions/thief/definition.js');
      return module.thiefProfession;
    },
    loadAppAdapter: async () => {
      const module = await import('#gw2/professions/thief/app/app-definition.js');
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
        name: 'Core',
        conceptArt: new URL('@images/professions/engineer.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/0154d14c-1026-4ff3-951c-bc5454ca4f4e/emJ476M3DgTpLt6Bn19FwqRn6lOslq571PD6XUU6.jpg'
      },
      {
        name: 'Scrapper',
        conceptArt: new URL('@images/professions/scrapper.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/HBhHXtTeUoT4FYywlQRAK2vh3qSlYIKF6nprLb9N.webp'
      },
      {
        name: 'Holosmith',
        conceptArt: new URL('@images/professions/holosmith.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/nX4xZk6pSAioBVDtGNPvxMzFiLnXeh57XYDLYpwy.webp'
      },
      {
        name: 'Mechanist',
        conceptArt: new URL('@images/professions/mechanist.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/vxW0dgd4EWscl9ZnTj64PUGWnvxKvtoKzP9No71Y.webp'
      },
      {
        name: 'Amalgam',
        conceptArt: new URL('@images/professions/amalgam.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/dx0sO3S57jI2vBT2Zq60BTR8wmwVU4njs8vQKz2a.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('#gw2/professions/engineer/definition.js');
      return module.engineerProfession;
    },
    loadAppAdapter: async () => {
      const module = await import('#gw2/professions/engineer/app/app-definition.js');
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
        name: 'Core',
        conceptArt: new URL('@images/professions/guardian.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/OaGAg9GNDYCgR4oUSafRsSP2MpciqXbYQysSCRFO.webp'
      },
      {
        name: 'Dragonhunter',
        conceptArt: new URL('@images/professions/dragonhunter.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/y9EFXtfsvw5Zu4G79YOK5l44t1ApVxouqCl0X3sc.webp'
      },
      {
        name: 'Firebrand',
        conceptArt: new URL('@images/professions/firebrand.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/Y7P9W6bnJxXwXdYhJFZjFYorQNoTYxmX6bQNhQwp.webp'
      },
      {
        name: 'Willbender',
        conceptArt: new URL('@images/professions/willbender.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/8jddMTYX5c9ANlYyMv3mHNtfbO4k0OU9t7dtU0za.webp'
      },
      {
        name: 'Luminary',
        conceptArt: new URL('@images/professions/luminary.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/urNqWJC2Sjr9WPMLNmjB2mIPOFSbYIZC7oXZ2RIp.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('#gw2/professions/guardian/definition.js');
      return module.guardianProfession;
    },
    loadAppAdapter: async () => {
      const module = await import('#gw2/professions/guardian/app/app-definition.js');
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
        name: 'Core',
        conceptArt: new URL('@images/professions/warrior.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/0154d14c-1026-4ff3-951c-bc5454ca4f4e/BwqIcVAqPfQMWCIfONQAnADqQaZ9SCxqhE1TwbqP.jpg'
      },
      {
        name: 'Berserker',
        conceptArt: new URL('@images/professions/berserker.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/30Nm9xGdYbTK2sGTctH0NjgDZCXNpF638rNdzf21.webp'
      },
      {
        name: 'Spellbreaker',
        conceptArt: new URL('@images/professions/spellbreaker.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/BFaJz8HGGRHbqeyiRQBjFAQLSPs5I0h6cFtfYqQ5.webp'
      },
      {
        name: 'Bladesworn',
        conceptArt: new URL('@images/professions/bladesworn.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/VMJqAcWz49leISknOREwMe70o9UGtQ07411QnvUQ.webp'
      },
      {
        name: 'Paragon',
        conceptArt: new URL('@images/professions/paragon.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/Tlvlqv76IwR5gPErYmQd3hITnSdwl63uSDIoZHXG.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('#gw2/professions/warrior/definition.js');
      return module.warriorProfession;
    },
    loadAppAdapter: async () => {
      const module = await import('#gw2/professions/warrior/app/app-definition.js');
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
        name: 'Core',
        conceptArt: new URL('@images/professions/revenant.png', import.meta.url).href,
        image: new URL('@images/professions/revenant.png', import.meta.url).href
      },
      {
        name: 'Herald',
        conceptArt: new URL('@images/professions/herald.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/l0wPR2fHc2w93nRdDVXWrnclAyD5umThxEZ2SEKX.webp'
      },
      {
        name: 'Renegade',
        conceptArt: new URL('@images/professions/renegade.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/5Q6RzaTlf5rbcKnWQWvC3UsWm7k1s2OtIshJf1lL.webp'
      },
      {
        name: 'Vindicator',
        conceptArt: new URL('@images/professions/vindicator.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/NICSEOqnu3qzL2b6BTpzcSg7V9CG7UZ6HPDT4Vv7.webp'
      },
      {
        name: 'Conduit',
        conceptArt: new URL('@images/professions/conduit.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/ANbyHo4hZbVvjvEEuKHomAJ4iXkccxEAXZ77IJdg.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('#gw2/professions/revenant/definition.js');
      return module.revenantProfession;
    },
    loadAppAdapter: async () => {
      const module = await import('#gw2/professions/revenant/app/app-definition.js');
      return module.revenantAppAdapter;
    }
  }
];

export const professionRegistry: readonly ProfessionRegistryEntry[] = entries;

/**
 * Registry entries partitioned by armor class in `ARMOR_WEIGHTS` order, for
 * the landing-page columns. Empty groups are omitted.
 */
export const professionGroups: readonly (readonly ProfessionRegistryEntry[])[] = ARMOR_WEIGHTS.map((weight) =>
  professionRegistry.filter((entry) => entry.armorWeight === weight)
).filter((group) => group.length > 0);

const byId = new Map<string, ProfessionRegistryEntry>(professionRegistry.map((entry) => [entry.id, entry]));

export interface ProfessionOption {
  readonly id: string;
  readonly name: string;
}

export const professionOptions: readonly ProfessionOption[] = professionRegistry.map(({ id, name }) => ({ id, name }));

/**
 * Returns the registered entry for a profession ID, or `null` for an unknown ID.
 */
export function getProfessionEntry(professionId: string): ProfessionRegistryEntry | null {
  return byId.get(professionId) || null;
}

/**
 * Lazily loads a profession contract, or `null` for an unknown ID.
 */
export async function loadProfession(professionId: string): Promise<RegisteredProfession | null> {
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
