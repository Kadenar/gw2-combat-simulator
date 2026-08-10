import {
  reactToSpellbreakerBoonRemoval,
  reactToSpellbreakerControl,
  reactToSpellbreakerDamage,
} from "./traits.js";

export {
  reactToSpellbreakerBoonRemoval,
  reactToSpellbreakerControl,
  reactToSpellbreakerDamage,
};

export const spellbreakerResolverEventHandlers = Object.freeze({
  "warrior.boon-removal": reactToSpellbreakerBoonRemoval,
});
