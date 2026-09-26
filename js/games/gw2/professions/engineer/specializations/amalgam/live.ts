import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { effectFirstAt } from '#gw2/platform/engine/effects/materializer.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { EngineerRuntimeState } from '#gw2/professions/engineer/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { resolveAmalgamSkillId } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import { amalgamCastAvailability } from '#gw2/professions/engineer/specializations/amalgam/mechanics/availability.js';
import { amalgamMaximumAmmo } from '#gw2/professions/engineer/specializations/amalgam/mechanics/evolved-form-rules.js';
import {
  activateAmalgamMorph,
  activatePlasmaticState,
  evolveAmalgam,
  reactToMercurialTendencies
} from '#gw2/professions/engineer/specializations/amalgam/mechanics/evolved-form.js';
import { amalgamResolverEventReactions } from '#gw2/professions/engineer/specializations/amalgam/mechanics/evolved-form-effects.js';

/** Form grants occur at their commitment timestamp; only accepted control can reduce Evolve recharge. */
export const amalgamLive: Partial<RuntimeProfession<EngineerRuntimeState>> = {
  modifySkillId: (runtime, skillId) => resolveAmalgamSkillId(runtime.config, skillId),
  availability: amalgamCastAvailability,
  maximumAmmo: amalgamMaximumAmmo,
  onCastStart(runtime, cast) {
    if (cast.skill.id === ID.EVOLVE_BASE || cast.skill.id === ID.EVOLVE_DOUBLE_HELIX) {
      const at = cast.start + (cast.fullEnd - cast.start) * (520 / 640);
      if (at <= cast.effectiveEnd) runtime.schedule('engineer.evolve', at, undefined, undefined, -10);
    }

    if (cast.skill.id === ID.PLASMATIC_STATE) {
      const strike = cast.skill.effects?.find((effect) => effect.type === 'strike');
      if (!strike) return;
      const at = effectFirstAt(cast.start, cast.fullEnd, strike);
      if (at <= cast.effectiveEnd) runtime.schedule('engineer.plasmatic-state', at, undefined, undefined, -10);
    }
  },
  onCastComplete(runtime, cast) {
    if (!castWasInterrupted(cast) && cast.skill.categories?.includes('Morph'))
      activateAmalgamMorph(runtime, cast.skill);
  },
  tasks: { 'engineer.evolve': evolveAmalgam, 'engineer.plasmatic-state': activatePlasmaticState },
  reactions: { 'damage.resolved': amalgamResolverEventReactions.damage, 'control.resolved': reactToMercurialTendencies }
};
