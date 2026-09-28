import { effectFirstAt } from '#gw2/platform/engine/effects/materializer.js';
import type { RuntimeProfession, SkillTaskData } from '#gw2/platform/simulation/runtime-state.js';
import type { EngineerRuntimeState } from '#gw2/professions/engineer/types.js';
import { resolveAmalgamSkillId } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import { amalgamCastAvailability } from '#gw2/professions/engineer/specializations/amalgam/mechanics/availability.js';
import { amalgamMaximumAmmo } from '#gw2/professions/engineer/specializations/amalgam/mechanics/evolved-form.js';
import {
  activateAmalgamMorph,
  scheduleThornsRetaliation,
  activatePlasmaticState,
  evolveAmalgam,
  reactToMercurialTendencies
} from '#gw2/professions/engineer/specializations/amalgam/mechanics/evolved-form.js';
import { amalgamResolverEventReactions } from '#gw2/professions/engineer/specializations/amalgam/mechanics/evolved-form-effects.js';

/** Form grants occur at their commitment timestamp; only accepted control can reduce Evolve recharge. */
export const amalgamHooks: Partial<RuntimeProfession<EngineerRuntimeState>> = {
  modifySkillId: (runtime, skillId) => resolveAmalgamSkillId(runtime.config, skillId),
  availability: amalgamCastAvailability,
  maximumAmmo: amalgamMaximumAmmo,
  sideEffectHandlers: {
    'engineer.schedule-evolve'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Evolve requires a cast trigger.');
      const { cast } = context;
      const at = cast.start + (cast.fullEnd - cast.start) * (520 / 640);
      if (at <= cast.effectiveEnd) runtime.schedule('engineer.evolve', at, undefined, undefined, -10);
    },
    'engineer.schedule-plasmatic'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Plasmatic State requires a cast trigger.');
      const { cast } = context;
      const strike = cast.skill.effects?.find((effect) => effect.type === 'strike');
      if (!strike) return;
      const at = effectFirstAt(cast.start, cast.fullEnd, strike);
      if (at <= cast.effectiveEnd) runtime.schedule('engineer.plasmatic-state', at, undefined, undefined, -10);
    },
    'engineer.thorns-retaliation'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Thorns requires a cast trigger.');
      // Core cast traits emit first; retaliation then precedes the Morph trait tail and the next completion.
      runtime.scheduleForCast('engineer.thorns-retaliation', runtime.time, context.cast, {}, undefined, -101);
    }
  },
  onCastCommit(runtime, cast) {
    if (cast.skill.categories?.includes('Morph'))
      runtime.scheduleForCast('engineer.morph-traits', runtime.time, cast, {}, undefined, -101);
  },
  tasks: {
    'engineer.evolve': evolveAmalgam,
    'engineer.plasmatic-state': activatePlasmaticState,
    'engineer.thorns-retaliation'(runtime, data) {
      scheduleThornsRetaliation(runtime, (data as SkillTaskData).cast.skill, runtime.time);
    },
    'engineer.morph-traits'(runtime, data) {
      activateAmalgamMorph(runtime, (data as SkillTaskData).cast.skill);
    }
  },
  reactions: { 'damage.resolved': amalgamResolverEventReactions.damage, 'control.resolved': reactToMercurialTendencies }
};
