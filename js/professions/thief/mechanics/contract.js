import { thiefCastAvailability } from "./availability.js";
import {
  handleSkrittScuffle,
} from "./specific/artifacts.js";
import {
  advanceThiefResources,
  spendThiefResources,
} from "./specific/resources.js";
import {
  handleThievesGuildAttack,
} from "./specific/skills.js";
import {
  updateThiefTraitCastState,
} from "./specific/traits.js";
import {
  updateThiefWeaponState,
} from "./specific/weapon-state.js";

export const thiefCastRules = Object.freeze({
  availability: {
    id: "thief.availability",
    order: 10,
    handler: thiefCastAvailability,
  },
});

export const thiefSchedulerHooks = Object.freeze({
  advance: advanceThiefResources,
  onCastStart: spendThiefResources,
  afterCast: Object.freeze([
    {
      id: "thief.weapon-state",
      order: 10,
      handler: updateThiefWeaponState,
    },
    {
      id: "thief.traits",
      order: 20,
      handler: updateThiefTraitCastState,
    },
  ]),
  taskHandlers: Object.freeze({
    "thief.thieves-guild-attack": handleThievesGuildAttack,
    "thief.skritt-scuffle": handleSkrittScuffle,
  }),
});
