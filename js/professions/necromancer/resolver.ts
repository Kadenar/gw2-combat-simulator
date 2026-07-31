import {
  necromancerCoreResolverEventHandlers,
  necromancerCoreResolverEventReactions,
} from "./core/resolver.js";
import { harbingerResolverEventReactions } from "./specializations/harbinger/resolver.js";
import { reaperResolverEventReactions } from "./specializations/reaper/resolver.js";
import {
  handleNecromancerPainfulBond,
  handleNecromancerWeaponSpell,
} from "./specializations/ritualist/events.js";
import { ritualistResolverEventReactions } from "./specializations/ritualist/resolver.js";
import { scourgeResolverEventReactions } from "./specializations/scourge/resolver.js";

export const necromancerResolverEventHandlers = Object.freeze({
  ...necromancerCoreResolverEventHandlers,
  "necromancer.painful-bond": handleNecromancerPainfulBond,
  "necromancer.weapon-spell": handleNecromancerWeaponSpell,
});

export const necromancerResolverEventReactions = Object.freeze({
  damage: [
    necromancerCoreResolverEventReactions.damage,
    reaperResolverEventReactions.damage,
    harbingerResolverEventReactions.damage,
    ritualistResolverEventReactions.damage,
  ],
  condition: [
    necromancerCoreResolverEventReactions.condition,
    reaperResolverEventReactions.condition,
    scourgeResolverEventReactions.condition,
  ],
  blind: necromancerCoreResolverEventReactions.blind,
  control: [
    necromancerCoreResolverEventReactions.control,
    reaperResolverEventReactions.control,
  ],
});
