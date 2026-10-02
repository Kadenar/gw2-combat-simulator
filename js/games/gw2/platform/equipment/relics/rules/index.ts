import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
/** Assembles the relic rule table from each relic's own module. */
import { director } from '#gw2/platform/equipment/relics/rules/director.js';
import { mountBalrior } from '#gw2/platform/equipment/relics/rules/mount-balrior.js';
import { akeem } from '#gw2/platform/equipment/relics/rules/akeem.js';
import { agony } from '#gw2/platform/equipment/relics/rules/agony.js';
import { aristocracy } from '#gw2/platform/equipment/relics/rules/aristocracy.js';
import { blightbringer } from '#gw2/platform/equipment/relics/rules/blightbringer.js';
import { bloodstone } from '#gw2/platform/equipment/relics/rules/bloodstone.js';
import { brawler } from '#gw2/platform/equipment/relics/rules/brawler.js';
import { claw } from '#gw2/platform/equipment/relics/rules/claw.js';
import { deadeye } from '#gw2/platform/equipment/relics/rules/deadeye.js';
import { dragonhunter } from '#gw2/platform/equipment/relics/rules/dragonhunter.js';
import { eagle } from '#gw2/platform/equipment/relics/rules/eagle.js';
import { fireworks } from '#gw2/platform/equipment/relics/rules/fireworks.js';
import { fractal } from '#gw2/platform/equipment/relics/rules/fractal.js';
import { lastTyrant } from '#gw2/platform/equipment/relics/rules/last-tyrant.js';
import { mistburn } from '#gw2/platform/equipment/relics/rules/mistburn.js';
import { mistStranger } from '#gw2/platform/equipment/relics/rules/mist-stranger.js';
import { mirage } from '#gw2/platform/equipment/relics/rules/mirage.js';
import { nourys } from '#gw2/platform/equipment/relics/rules/nourys.js';
import { peitha } from '#gw2/platform/equipment/relics/rules/peitha.js';
import { shackles } from '#gw2/platform/equipment/relics/rules/shackles.js';
import { steamshrieker } from '#gw2/platform/equipment/relics/rules/steamshrieker.js';
import { thief } from '#gw2/platform/equipment/relics/rules/thief.js';
import { visionary } from '#gw2/platform/equipment/relics/rules/visionary.js';
import { thorns } from '#gw2/platform/equipment/relics/rules/thorns.js';

import type { Gw2RelicRule } from '#gw2/platform/equipment/relics/types.js';

export const RELIC_RULES: Readonly<Record<number, Readonly<Gw2RelicRule>>> = Object.freeze({
  [RELIC_IDS.DIRECTOR]: director,
  [RELIC_IDS.MOUNT_BALRIOR]: mountBalrior,
  [RELIC_IDS.AGONY]: agony,
  [RELIC_IDS.AKEEM]: akeem,
  [RELIC_IDS.ARISTOCRACY]: aristocracy,
  [RELIC_IDS.BLIGHTBRINGER]: blightbringer,
  [RELIC_IDS.BLOODSTONE]: bloodstone,
  [RELIC_IDS.BRAWLER]: brawler,
  [RELIC_IDS.CLAW]: claw,
  [RELIC_IDS.DEADEYE]: deadeye,
  [RELIC_IDS.DRAGONHUNTER]: dragonhunter,
  [RELIC_IDS.EAGLE]: eagle,
  [RELIC_IDS.FIREWORKS]: fireworks,
  [RELIC_IDS.FRACTAL]: fractal,
  [RELIC_IDS.LAST_TYRANT]: lastTyrant,
  [RELIC_IDS.MISTBURN]: mistburn,
  [RELIC_IDS.MIST_STRANGER]: mistStranger,
  [RELIC_IDS.MIRAGE]: mirage,
  [RELIC_IDS.NOURYS]: nourys,
  [RELIC_IDS.PEITHA]: peitha,
  [RELIC_IDS.SHACKLES]: shackles,
  [RELIC_IDS.STEAMSHRIEKER]: steamshrieker,
  [RELIC_IDS.THIEF]: thief,
  [RELIC_IDS.VISIONARY]: visionary,
  [RELIC_IDS.THORNS]: thorns
});
