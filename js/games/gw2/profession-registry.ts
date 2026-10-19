import { PROFESSION_IDENTITIES } from '#gw2/profession-identities.js';
import type { BuildContextModule } from '#gw2/build-context/types.js';
/**
 * Lazy profession manifest shared by browser pages, simulation workers, and tooling.
 *
 * Registry entries contain only profession metadata and explicit dynamic
 * import functions. Reading this module therefore does not eagerly load any
 * profession implementation. Engine sources, headless build contexts, and
 * browser app adapters have separate lazy entry points.
 */

import type { Gw2AppAdapter } from '#gw2/app/types.js';
import type { AnyNativeModule, NativeProfessionContract } from '#gw2/platform/profession-definition/module-types.js';

// Preserve native composition metadata so engine consumers can apply previews without loading an app adapter.
type RegisteredProfession = NativeProfessionContract<readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]]>;

/** Armor classes, ordered as navigation surfaces group professions. */
const ARMOR_WEIGHTS = ['light', 'medium', 'heavy'] as const;

export type ArmorWeight = (typeof ARMOR_WEIGHTS)[number];

export interface ProfessionRegistryEntry {
  /** Stable lowercase identifier used by builds and pages. */
  readonly id: string;
  /** Numeric profession identity encoded in GW2 build-template chat links. */
  readonly buildTemplateCode: number;
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
  readonly loadBuildContext: () => Promise<BuildContextModule>;
  readonly loadProfession: () => Promise<RegisteredProfession>;
  /** Lazy shared-shell adapter loader. */
  readonly loadAppAdapter: () => Promise<Gw2AppAdapter>;
}

// Portraits are grouped by profession, with core.png for the base profession and named elite portraits.
// Names come from shared identity metadata; artwork and lazy loaders remain application registry concerns.
// Entries are ordered by armor class so navigation surfaces group
// professions Light → Medium → Heavy: the shared UI (landing card grid and
// simulator header select) renders in registry order.
const entries: readonly ProfessionRegistryEntry[] = [
  // Light armor: Elementalist, Mesmer, Necromancer.
  {
    id: 'elementalist',
    buildTemplateCode: 6,
    armorWeight: 'light',
    name: PROFESSION_IDENTITIES.elementalist.name,
    icon: 'https://render.guildwars2.com/file/BBED46EB20C80D0DDE0F99402493C7E6FFAE1530/156629.png',
    route: 'elementalist.html',
    themeClass: 'elementalist-theme',
    specializationArtwork: [
      {
        name: PROFESSION_IDENTITIES.elementalist.specializations.core,
        conceptArt: new URL('@images/professions/elementalist/core.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/2FEEkQBNxzaWIIx21vmnpc7dccL6om02MDNmNuZ1.webp'
      },
      {
        name: PROFESSION_IDENTITIES.elementalist.specializations.tempest,
        conceptArt: new URL('@images/professions/elementalist/tempest.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/DY1QuOFHqxbVsqC1jBryNm66eoZglhMgMDhrVShJ.webp'
      },
      {
        name: PROFESSION_IDENTITIES.elementalist.specializations.weaver,
        conceptArt: new URL('@images/professions/elementalist/weaver.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/79g5CiydrrztYx6qIvmNMmUobwRvdGzskIqwI5cn.webp'
      },
      {
        name: PROFESSION_IDENTITIES.elementalist.specializations.catalyst,
        conceptArt: new URL('@images/professions/elementalist/catalyst.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/uFKRbwhHh5GKyGV9Evohhx0UTd4T8YZjrW44uawP.webp'
      },
      {
        name: PROFESSION_IDENTITIES.elementalist.specializations.evoker,
        conceptArt: new URL('@images/professions/elementalist/evoker.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/7HNOxiXpl9wkAl2ykM3D2jrSFtciZfLgseLcEgpG.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('#gw2/professions/elementalist/profession.js');
      return module.elementalistProfession;
    },
    loadBuildContext: () => import('#gw2/professions/elementalist/build/context.js'),
    loadAppAdapter: async () => {
      const module = await import('#gw2/professions/elementalist/app/app-definition.js');
      return module.elementalistAppAdapter;
    }
  },
  {
    id: 'mesmer',
    buildTemplateCode: 7,
    armorWeight: 'light',
    name: PROFESSION_IDENTITIES.mesmer.name,
    icon: 'https://render.guildwars2.com/file/AF61567E16A83F145D6FB35D63BF01074A3A5AB9/156635.png',
    route: 'mesmer.html',
    themeClass: 'mesmer-theme',
    specializationArtwork: [
      {
        name: PROFESSION_IDENTITIES.mesmer.specializations.core,
        conceptArt: new URL('@images/professions/mesmer/core.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/0154d14c-1026-4ff3-951c-bc5454ca4f4e/AdKbIsuTW9tQQRRRSqOGFiU46rjSyHylChEyUq1D.jpg'
      },
      {
        name: PROFESSION_IDENTITIES.mesmer.specializations.chronomancer,
        conceptArt: new URL('@images/professions/mesmer/chronomancer.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/0154d14c-1026-4ff3-951c-bc5454ca4f4e/wYMly4iJbZEwdZPG2oWwqnCb7ly4VTvI58oBnW5K.jpg'
      },
      {
        name: PROFESSION_IDENTITIES.mesmer.specializations.mirage,
        conceptArt: new URL('@images/professions/mesmer/mirage.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/somZhFPIsB4GHxrhjqtlPy4loceNBcvW3SrZY7uQ.webp'
      },
      {
        name: PROFESSION_IDENTITIES.mesmer.specializations.virtuoso,
        conceptArt: new URL('@images/professions/mesmer/virtuoso.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/6YCwMKZA9ZT278R4F3N5fGLVGXeCU9Yls54CRuq0.webp'
      },
      {
        name: PROFESSION_IDENTITIES.mesmer.specializations.troubadour,
        conceptArt: new URL('@images/professions/mesmer/troubadour.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/JL0RMiFPQYZYr3LaxWcd92JoT98SPNniwSeTRkxj.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('#gw2/professions/mesmer/profession.js');
      return module.mesmerProfession;
    },
    loadBuildContext: () => import('#gw2/professions/mesmer/build/context.js'),
    loadAppAdapter: async () => {
      const module = await import('#gw2/professions/mesmer/app/app-definition.js');
      return module.mesmerAppAdapter;
    }
  },
  {
    id: 'necromancer',
    buildTemplateCode: 8,
    armorWeight: 'light',
    name: PROFESSION_IDENTITIES.necromancer.name,
    icon: 'https://render.guildwars2.com/file/CA5A4E96080FCF057C9DA0ED35C693477580421C/156637.png',
    route: 'necromancer.html',
    themeClass: 'necromancer-theme',
    specializationArtwork: [
      {
        name: PROFESSION_IDENTITIES.necromancer.specializations.core,
        conceptArt: new URL('@images/professions/necromancer/core.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/DDW5i9E5dyuhaXywvO2Wiqn0nQYOwjxZg9GQn6ni.webp'
      },
      {
        name: PROFESSION_IDENTITIES.necromancer.specializations.reaper,
        conceptArt: new URL('@images/professions/necromancer/reaper.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/BkrNHpfZ3rdgQvRcCSZHzh8ErnakQYRi5jpekaMt.webp'
      },
      {
        name: PROFESSION_IDENTITIES.necromancer.specializations.scourge,
        conceptArt: new URL('@images/professions/necromancer/scourge.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/DsG45NgUXhOYGI6fuQUB6pvkLQJlbjI2iQU4nvYz.webp'
      },
      {
        name: PROFESSION_IDENTITIES.necromancer.specializations.harbinger,
        conceptArt: new URL('@images/professions/necromancer/harbinger.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/5c9lVrJthmDO46fBpYEFVxQM3NJdsEpQbcfwiS6B.webp'
      },
      {
        name: PROFESSION_IDENTITIES.necromancer.specializations.ritualist,
        conceptArt: new URL('@images/professions/necromancer/ritualist.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/DEw7Kgg3cI1stZM9dboksGtGmo4r4v5uP8y5lCcp.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('#gw2/professions/necromancer/profession.js');
      return module.necromancerProfession;
    },
    loadBuildContext: () => import('#gw2/professions/necromancer/build/context.js'),
    loadAppAdapter: async () => {
      const module = await import('#gw2/professions/necromancer/app/app-definition.js');
      return module.necromancerAppAdapter;
    }
  },
  // Medium armor: Ranger, Thief, Engineer.
  {
    id: 'ranger',
    buildTemplateCode: 4,
    armorWeight: 'medium',
    name: PROFESSION_IDENTITIES.ranger.name,
    icon: 'https://render.guildwars2.com/file/49B10316B424F4E20139EB5E51ADCF24A8724E9B/156640.png',
    route: 'ranger.html',
    themeClass: 'ranger-theme',
    specializationArtwork: [
      {
        name: PROFESSION_IDENTITIES.ranger.specializations.core,
        conceptArt: new URL('@images/professions/ranger/core.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/0154d14c-1026-4ff3-951c-bc5454ca4f4e/yl95i2EFNwe4qI4F8Vo0a81LhvSnVFZ9w2evSsig.jpg'
      },
      {
        name: PROFESSION_IDENTITIES.ranger.specializations.druid,
        conceptArt: new URL('@images/professions/ranger/druid.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/YIwgxjG1E7FiKqSAaXrCiuQfh7w5eTEOYXK0Id8x.webp'
      },
      {
        name: PROFESSION_IDENTITIES.ranger.specializations.soulbeast,
        conceptArt: new URL('@images/professions/ranger/soulbeast.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/95KRcPOeigpwlQQRzh6aFVIxixWXbTgQUtNSJQZN.webp'
      },
      {
        name: PROFESSION_IDENTITIES.ranger.specializations.untamed,
        conceptArt: new URL('@images/professions/ranger/untamed.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/e5vuxTdgb41Dnjrb9jKmNF9tRYD1jVS6incDVoAY.webp'
      },
      {
        name: PROFESSION_IDENTITIES.ranger.specializations.galeshot,
        conceptArt: new URL('@images/professions/ranger/galeshot.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/dVd7Wrx57mbdUHAIfZyUmuCFv5YxdH8yQ4Vij4Em.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('#gw2/professions/ranger/profession.js');
      return module.rangerProfession;
    },
    loadBuildContext: () => import('#gw2/professions/ranger/build/context.js'),
    loadAppAdapter: async () => {
      const module = await import('#gw2/professions/ranger/app/app-definition.js');
      return module.rangerAppAdapter;
    }
  },
  {
    id: 'thief',
    buildTemplateCode: 5,
    armorWeight: 'medium',
    name: PROFESSION_IDENTITIES.thief.name,
    icon: 'https://render.guildwars2.com/file/13A2C0EF23F23FF2084875629465279DDA807E3D/103581.png',
    route: 'thief.html',
    themeClass: 'thief-theme',
    specializationArtwork: [
      {
        name: PROFESSION_IDENTITIES.thief.specializations.core,
        conceptArt: new URL('@images/professions/thief/core.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/0154d14c-1026-4ff3-951c-bc5454ca4f4e/mLAhlUPnakYgM3FwEni1Mfr16Oi8VMVZ4TpSMgZE.jpg'
      },
      {
        name: PROFESSION_IDENTITIES.thief.specializations.daredevil,
        conceptArt: new URL('@images/professions/thief/daredevil.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/Z324ofTh0ZEVH1ix916jvmBa8gy0LmBsxwBJ5MMY.webp'
      },
      {
        name: PROFESSION_IDENTITIES.thief.specializations.deadeye,
        conceptArt: new URL('@images/professions/thief/deadeye.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/n0TGLINi59LKvimT7g1Txsq618vG6weOUWASLGZc.webp'
      },
      {
        name: PROFESSION_IDENTITIES.thief.specializations.specter,
        conceptArt: new URL('@images/professions/thief/specter.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/hh7tsjXK3pWbwcX3NpOLlNuqwxPPnZ7mIMHc8J4U.webp'
      },
      {
        name: PROFESSION_IDENTITIES.thief.specializations.antiquary,
        conceptArt: new URL('@images/professions/thief/antiquary.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/vz40JTGUEZc62s7ywMA5jsC1qq9hbgpGrcIgi9Ai.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('#gw2/professions/thief/profession.js');
      return module.thiefProfession;
    },
    loadBuildContext: () => import('#gw2/professions/thief/build/context.js'),
    loadAppAdapter: async () => {
      const module = await import('#gw2/professions/thief/app/app-definition.js');
      return module.thiefAppAdapter;
    }
  },
  {
    id: 'engineer',
    buildTemplateCode: 3,
    armorWeight: 'medium',
    name: PROFESSION_IDENTITIES.engineer.name,
    icon: 'https://render.guildwars2.com/file/A94D00911BD47CDE39A104F90C7D07DE623554ED/156631.png',
    route: 'engineer.html',
    themeClass: 'engineer-theme',
    specializationArtwork: [
      {
        name: PROFESSION_IDENTITIES.engineer.specializations.core,
        conceptArt: new URL('@images/professions/engineer/core.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/0154d14c-1026-4ff3-951c-bc5454ca4f4e/emJ476M3DgTpLt6Bn19FwqRn6lOslq571PD6XUU6.jpg'
      },
      {
        name: PROFESSION_IDENTITIES.engineer.specializations.scrapper,
        conceptArt: new URL('@images/professions/engineer/scrapper.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/HBhHXtTeUoT4FYywlQRAK2vh3qSlYIKF6nprLb9N.webp'
      },
      {
        name: PROFESSION_IDENTITIES.engineer.specializations.holosmith,
        conceptArt: new URL('@images/professions/engineer/holosmith.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/nX4xZk6pSAioBVDtGNPvxMzFiLnXeh57XYDLYpwy.webp'
      },
      {
        name: PROFESSION_IDENTITIES.engineer.specializations.mechanist,
        conceptArt: new URL('@images/professions/engineer/mechanist.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/vxW0dgd4EWscl9ZnTj64PUGWnvxKvtoKzP9No71Y.webp'
      },
      {
        name: PROFESSION_IDENTITIES.engineer.specializations.amalgam,
        conceptArt: new URL('@images/professions/engineer/amalgam.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/dx0sO3S57jI2vBT2Zq60BTR8wmwVU4njs8vQKz2a.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('#gw2/professions/engineer/profession.js');
      return module.engineerProfession;
    },
    loadBuildContext: () => import('#gw2/professions/engineer/build/context.js'),
    loadAppAdapter: async () => {
      const module = await import('#gw2/professions/engineer/app/app-definition.js');
      return module.engineerAppAdapter;
    }
  },
  // Heavy armor: Guardian, Warrior, Revenant.
  {
    id: 'guardian',
    buildTemplateCode: 1,
    armorWeight: 'heavy',
    name: PROFESSION_IDENTITIES.guardian.name,
    icon: 'https://render.guildwars2.com/file/6E0D0AC6E0CE5C0C29B3D736ABEA070F4A58540E/156633.png',
    route: 'guardian.html',
    themeClass: 'guardian-theme',
    specializationArtwork: [
      {
        name: PROFESSION_IDENTITIES.guardian.specializations.core,
        conceptArt: new URL('@images/professions/guardian/core.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/OaGAg9GNDYCgR4oUSafRsSP2MpciqXbYQysSCRFO.webp'
      },
      {
        name: PROFESSION_IDENTITIES.guardian.specializations.dragonhunter,
        conceptArt: new URL('@images/professions/guardian/dragonhunter.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/y9EFXtfsvw5Zu4G79YOK5l44t1ApVxouqCl0X3sc.webp'
      },
      {
        name: PROFESSION_IDENTITIES.guardian.specializations.firebrand,
        conceptArt: new URL('@images/professions/guardian/firebrand.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/Y7P9W6bnJxXwXdYhJFZjFYorQNoTYxmX6bQNhQwp.webp'
      },
      {
        name: PROFESSION_IDENTITIES.guardian.specializations.willbender,
        conceptArt: new URL('@images/professions/guardian/willbender.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/8jddMTYX5c9ANlYyMv3mHNtfbO4k0OU9t7dtU0za.webp'
      },
      {
        name: PROFESSION_IDENTITIES.guardian.specializations.luminary,
        conceptArt: new URL('@images/professions/guardian/luminary.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/urNqWJC2Sjr9WPMLNmjB2mIPOFSbYIZC7oXZ2RIp.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('#gw2/professions/guardian/profession.js');
      return module.guardianProfession;
    },
    loadBuildContext: () => import('#gw2/professions/guardian/build/context.js'),
    loadAppAdapter: async () => {
      const module = await import('#gw2/professions/guardian/app/app-definition.js');
      return module.guardianAppAdapter;
    }
  },
  {
    id: 'warrior',
    buildTemplateCode: 2,
    armorWeight: 'heavy',
    name: PROFESSION_IDENTITIES.warrior.name,
    icon: 'https://render.guildwars2.com/file/0A97E13F29B3597A447EEC04A09BE5BD699A2250/156643.png',
    route: 'warrior.html',
    themeClass: 'warrior-theme',
    specializationArtwork: [
      {
        name: PROFESSION_IDENTITIES.warrior.specializations.core,
        conceptArt: new URL('@images/professions/warrior/core.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/0154d14c-1026-4ff3-951c-bc5454ca4f4e/BwqIcVAqPfQMWCIfONQAnADqQaZ9SCxqhE1TwbqP.jpg'
      },
      {
        name: PROFESSION_IDENTITIES.warrior.specializations.berserker,
        conceptArt: new URL('@images/professions/warrior/berserker.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/30Nm9xGdYbTK2sGTctH0NjgDZCXNpF638rNdzf21.webp'
      },
      {
        name: PROFESSION_IDENTITIES.warrior.specializations.spellbreaker,
        conceptArt: new URL('@images/professions/warrior/spellbreaker.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/BFaJz8HGGRHbqeyiRQBjFAQLSPs5I0h6cFtfYqQ5.webp'
      },
      {
        name: PROFESSION_IDENTITIES.warrior.specializations.bladesworn,
        conceptArt: new URL('@images/professions/warrior/bladesworn.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/VMJqAcWz49leISknOREwMe70o9UGtQ07411QnvUQ.webp'
      },
      {
        name: PROFESSION_IDENTITIES.warrior.specializations.paragon,
        conceptArt: new URL('@images/professions/warrior/paragon.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/Tlvlqv76IwR5gPErYmQd3hITnSdwl63uSDIoZHXG.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('#gw2/professions/warrior/profession.js');
      return module.warriorProfession;
    },
    loadBuildContext: () => import('#gw2/professions/warrior/build/context.js'),
    loadAppAdapter: async () => {
      const module = await import('#gw2/professions/warrior/app/app-definition.js');
      return module.warriorAppAdapter;
    }
  },
  {
    id: 'revenant',
    buildTemplateCode: 9,
    armorWeight: 'heavy',
    name: PROFESSION_IDENTITIES.revenant.name,
    icon: 'https://render.guildwars2.com/file/696A48DD61EE01FD1F4FBBBDB82D74611E04EA39/965717.png',
    route: 'revenant.html',
    themeClass: 'revenant-theme',
    specializationArtwork: [
      {
        name: PROFESSION_IDENTITIES.revenant.specializations.core,
        conceptArt: new URL('@images/professions/revenant/core.png', import.meta.url).href,
        image: new URL('@images/professions/revenant/core.png', import.meta.url).href
      },
      {
        name: PROFESSION_IDENTITIES.revenant.specializations.herald,
        conceptArt: new URL('@images/professions/revenant/herald.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/l0wPR2fHc2w93nRdDVXWrnclAyD5umThxEZ2SEKX.webp'
      },
      {
        name: PROFESSION_IDENTITIES.revenant.specializations.renegade,
        conceptArt: new URL('@images/professions/revenant/renegade.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/5Q6RzaTlf5rbcKnWQWvC3UsWm7k1s2OtIshJf1lL.webp'
      },
      {
        name: PROFESSION_IDENTITIES.revenant.specializations.vindicator,
        conceptArt: new URL('@images/professions/revenant/vindicator.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28054721-a151-11ec-8fcf-ca7a943c517e/NICSEOqnu3qzL2b6BTpzcSg7V9CG7UZ6HPDT4Vv7.webp'
      },
      {
        name: PROFESSION_IDENTITIES.revenant.specializations.conduit,
        conceptArt: new URL('@images/professions/revenant/conduit.png', import.meta.url).href,
        image:
          'https://assets.snowcrows.com/uploads/28056f91-a151-11ec-8fcf-ca7a943c517e/ANbyHo4hZbVvjvEEuKHomAJ4iXkccxEAXZ77IJdg.jpg'
      }
    ],
    loadProfession: async () => {
      const module = await import('#gw2/professions/revenant/profession.js');
      return module.revenantProfession;
    },
    loadBuildContext: () => import('#gw2/professions/revenant/build/context.js'),
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

/** Lists profession identities for benchmark tooling and tests without loading profession modules. */
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
