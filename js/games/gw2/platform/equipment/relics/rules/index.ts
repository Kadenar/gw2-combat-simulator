/** Assembles the relic rule table from each relic's own module. */
import { director } from '#gw2/platform/equipment/relics/rules/director.js';
import { mountBalrior } from '#gw2/platform/equipment/relics/rules/mount-balrior.js';
import { akeem } from '#gw2/platform/equipment/relics/rules/akeem.js';
import { aristocracy } from '#gw2/platform/equipment/relics/rules/aristocracy.js';
import { blightbringer } from '#gw2/platform/equipment/relics/rules/blightbringer.js';
import { bloodstone } from '#gw2/platform/equipment/relics/rules/bloodstone.js';
import { brawler } from '#gw2/platform/equipment/relics/rules/brawler.js';
import { claw } from '#gw2/platform/equipment/relics/rules/claw.js';
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

export const RELIC_RULES: Readonly<Record<string, Readonly<Gw2RelicRule>>> = Object.freeze({
  Director: director,
  'Mount Balrior': mountBalrior,
  Akeem: akeem,
  Aristocracy: aristocracy,
  Blightbringer: blightbringer,
  Bloodstone: bloodstone,
  Brawler: brawler,
  Claw: claw,
  Dragonhunter: dragonhunter,
  Eagle: eagle,
  Fireworks: fireworks,
  Fractal: fractal,
  'Last Tyrant': lastTyrant,
  Mistburn: mistburn,
  'Mist Stranger': mistStranger,
  Mirage: mirage,
  Nourys: nourys,
  Peitha: peitha,
  Shackles: shackles,
  Steamshrieker: steamshrieker,
  Thief: thief,
  Visionary: visionary,
  Thorns: thorns
});
