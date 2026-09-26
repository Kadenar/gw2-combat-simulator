import { canonicalTime } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { effectFirstAtMs, strikeEffectCoefficient } from '#gw2/platform/engine/effects/authoring.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { gw2EffectExpiresAt, projectCastRelativeEffectTimingMs } from '#gw2/platform/skills/timing.js';
import { buildGuardianStrike } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { emitGuardianLiveBoon } from '#gw2/professions/guardian/core/live-traits.js';
import { recordGuardianTraitProc } from '#gw2/professions/guardian/core/traits/shared.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/luminary/profiles.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import {
  LUMINARY_INITIAL_LIGHT_AURA_SKILL_ID,
  LUMINARY_INITIAL_STATE_SKILL_IDS as INITIAL
} from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { GuardianRuntimeState } from '#gw2/professions/guardian/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

type Runtime = Gw2Runtime<GuardianRuntimeState>;
const AURA_GRANT = 'guardian.luminary.aura-grant';
const AURA_DETONATE = 'guardian.luminary.aura-detonate';
const EFFULGENT = 'guardian.luminary.effulgent';
const STANCE = 'guardian.luminary.stance';

/** Child packets retain their activation without copying hostile flags into self-state applications. */
export function luminaryCause(runtime: Runtime, cast: RuntimeCast): Gw2ResolverEvent {
  return {
    type: 'buff',
    at: runtime.time,
    source: 'guardian',
    sourceId: cast.skill.id,
    actorType: 'player',
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id
  };
}

/** Linked self effects follow the selected primary packet's authored impact boundary. */
export function luminaryImpactAt(cast: RuntimeCast): number {
  const effect = cast.skill.effects?.find((effect) => effect.type === 'strike' && strikeEffectCoefficient(effect) > 0);
  if (effect?.type !== 'strike') return cast.effectiveEnd;
  const atMs = effectFirstAtMs(effect);
  if (atMs == null) return cast.effectiveEnd;
  return canonicalTime(
    cast.start +
      (effect.timingScale === 'cast'
        ? projectCastRelativeEffectTimingMs(cast.skill, (cast.fullEnd - cast.start) * 1000, atMs)
        : atMs) /
        1000
  );
}

function detonator(skill: Skill): boolean {
  return (
    skill.id !== ID.GLARING_BURST &&
    Boolean(
      skill.id === ID.RADIANT_JUSTICE ||
      skill.id === ID.RADIANT_RESOLVE ||
      skill.id === ID.RADIANT_COURAGE ||
      skill.radiantForgeSkill ||
      (skill.specialization === 'Luminary' && skill.categories?.includes('Stance'))
    )
  );
}

/** Consume only an active aura with a selected detonation packet; misses still consume the self effect. */
function detonate(runtime: Runtime, event: Gw2ResolverEvent): void {
  const state = luminaryState.from(runtime);
  if (state.lightAuraUntil <= runtime.time) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.sovereignOfLight);
  const strike = requireEffect(profile, 'strike', 'Strike');
  if (!strike) return;
  state.lightAuraUntil = 0;
  runtime.emitDerived(
    event,
    buildGuardianStrike({
      at: runtime.time,
      priority: -15,
      sourceId: ID.SOVEREIGN_OF_LIGHT_DAMAGE,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: ID.SOVEREIGN_OF_LIGHT_DAMAGE,
      skillName: 'Sovereign of Light',
      name: 'Sovereign of Light',
      coefficient: effectNumber(profile, strike, 'coefficient'),
      skillWeapon: 'Unequipped',
      triggeredBy: event.skillName,
      offTarget: event.offTarget === true
    })
  );
  recordGuardianTraitProc(
    runtime,
    TRAIT.SOVEREIGN_OF_LIGHT,
    'Sovereign of Light',
    runtime.time,
    event.skillName ?? '',
    'Light aura detonated'
  );
}

/** Actual combo outcomes refresh the single aura; only Luminary sources can detonate an existing one on grant. */
export function grantLuminaryAura(runtime: Runtime, event: Gw2ResolverEvent): void {
  let duration = event.duration;
  if (duration === undefined) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.lightAura);
    const aura = requireEffect(profile, 'buff', 'light-aura');
    if (!aura) return;
    duration = effectNumber(profile, aura, 'duration');
  }

  const skill = event.skillId == null ? undefined : runtime.helpers.skillsById.get(event.skillId);
  if (skill && detonator(skill) && hasTrait(runtime, TRAIT.SOVEREIGN_OF_LIGHT)) detonate(runtime, event);
  luminaryState.from(runtime).lightAuraUntil = gw2EffectExpiresAt(runtime.time, Number(duration));
}

/** Imported boundary state is an explicit input, applied once without restoring subsequent live state. */
function initialState(runtime: Runtime, cast: RuntimeCast): void {
  const duration = Math.max(0, Number(cast.command.initialStateDurationMs ?? 0)) / 1000;
  if (!(duration > 0)) return;
  const event = { ...luminaryCause(runtime, cast), duration, stacks: 1 };
  const id = cast.skill.id;
  if (id === INITIAL.claw) {
    runtime.emit({ ...event, type: 'control', controlKind: 'initial-state', initialStateDuration: duration });
    return;
  }

  const kind =
    id === INITIAL.resolution
      ? 'resolution'
      : id === INITIAL.empoweredArmaments
        ? 'guardian-empowered-armaments'
        : id === INITIAL.radiantHammer
          ? 'guardian-radiant-armaments'
          : null;
  if (!kind) return;
  if (id === INITIAL.empoweredArmaments)
    luminaryState.from(runtime).empoweredArmamentsUntil = gw2EffectExpiresAt(runtime.time, duration);
  // Observed initial durations are already final and must not acquire boon-duration scaling a second time.
  runtime.emit({ ...event, kind, ...(id === INITIAL.radiantHammer ? { metadata: { radiantWeapon: 'hammer' } } : {}) });
}

/** Schedule finite activation effects; all state mutations happen when their boundary executes. */
export function startLuminaryEffects(runtime: Runtime, cast: RuntimeCast): void {
  initialState(runtime, cast);
  const skill = cast.skill;
  const event = luminaryCause(runtime, cast);
  const hostile = { ...event, offTarget: cast.command.offTarget === true };
  const impact = luminaryImpactAt(cast);
  const sovereign = hasTrait(runtime, TRAIT.SOVEREIGN_OF_LIGHT);
  if (sovereign && detonator(skill)) {
    const at =
      skill.radiantForgeSkill || skill.id === ID.PIERCING_STANCE || skill.id === ID.DARING_ADVANCE
        ? impact
        : cast.start;
    runtime.schedule(AURA_DETONATE, at, hostile, undefined, -20);
  }

  const justiceBlind =
    skill.categories?.includes('Virtue') && skill.slot === 'Profession_1' && hasTrait(runtime, TRAIT.JUSTICE_IS_BLIND);
  if (
    skill.id === LUMINARY_INITIAL_LIGHT_AURA_SKILL_ID ||
    skill.id === ID.EFFULGENT_STANCE ||
    skill.id === ID.RADIANT_RESOLVE ||
    (skill.id === ID.ENTER_RADIANT_FORGE && sovereign) ||
    justiceBlind
  )
    runtime.schedule(AURA_GRANT, cast.start, hostile, undefined, -10);
  if (justiceBlind) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.justiceIsBlind);
    const blind = requireEffect(profile, 'blind', 'Blind');
    if (blind)
      runtime.emit({
        ...hostile,
        type: 'blind',
        sourceId: TRAIT.JUSTICE_IS_BLIND,
        skillId: TRAIT.JUSTICE_IS_BLIND,
        actorType: 'effect',
        skillName: 'Justice is Blind',
        triggeredBy: skill.name,
        duration: effectNumber(profile, blind, 'duration')
      });
  }

  if (skill.id === ID.PIERCING_STANCE || skill.id === ID.DARING_ADVANCE)
    runtime.schedule(STANCE, impact, cast, undefined, skill.id === ID.PIERCING_STANCE ? -30 : 0);
  if (skill.id === ID.EFFULGENT_STANCE) {
    const state = luminaryState.from(runtime);
    state.effulgentActiveUntil = canonicalTime(cast.start + 4);
    state.effulgentStacks = 0;
    state.effulgentActivationId = cast.id;
    runtime.schedule(EFFULGENT, state.effulgentActiveUntil, hostile);
  }
}

/** Count only accepted strikes in the half-open window, excluding gear and summoned actors. */
export function countEffulgentHit(runtime: Runtime, event: Gw2ResolverEvent, damage: number): void {
  const state = luminaryState.from(runtime);
  if (!(damage > 0) || !(Number(event.coefficient) > 0) || runtime.time >= state.effulgentActiveUntil) return;
  if (!isGw2PlayerActorEvent(event) && !(event.source === 'guardian' && event.actorType === 'effect')) return;
  const maximum = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, PROFILE.effulgentStance),
    'maximumStacks'
  );
  state.effulgentStacks = Math.min(maximum, state.effulgentStacks + 1);
}

export const luminaryEffectTasks = {
  [AURA_GRANT]: (runtime: Runtime, data: unknown) => grantLuminaryAura(runtime, data as Gw2ResolverEvent),
  [AURA_DETONATE]: (runtime: Runtime, data: unknown) => detonate(runtime, data as Gw2ResolverEvent),
  [STANCE](runtime: Runtime, data: unknown) {
    const cast = data as RuntimeCast;
    const state = luminaryState.from(runtime);
    const piercing = cast.skill.id === ID.PIERCING_STANCE;
    const duration = 8 + (piercing ? Math.max(0, state.piercingStanceUntil - runtime.time) : 0);
    if (piercing) state.piercingStanceUntil = gw2EffectExpiresAt(runtime.time, duration);
    emitGuardianLiveBoon(runtime, {
      ...luminaryCause(runtime, cast),
      kind: piercing ? 'guardian-piercing-stance' : 'guardian-daring-advance',
      duration,
      stacks: 1,
      priority: piercing ? -20 : 0
    });
  },
  [EFFULGENT](runtime: Runtime, data: unknown) {
    const event = data as Gw2ResolverEvent;
    const state = luminaryState.from(runtime);
    if (state.effulgentActivationId !== event.activationId) return;
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.effulgentStance);
    const maximum = balanceProfileNumber(profile, 'maximumStacks');
    const stacks = Math.max(0, Math.min(maximum, state.effulgentStacks));
    state.effulgentActiveUntil = 0;
    state.effulgentStacks = 0;
    state.effulgentActivationId = null;
    const strike = requireEffect(profile, 'strike', 'Strike');
    if (strike) {
      runtime.recordProc('skill', 'Effulgent Stance', runtime.time, 'Effulgent Stance', `${stacks}/${maximum} stacks`);
      runtime.emitDerived(
        event,
        buildGuardianStrike({
          at: runtime.time,
          priority: 5,
          sourceId: ID.EFFULGENT_STANCE_DAMAGE,
          skillId: ID.EFFULGENT_STANCE_DAMAGE,
          skillName: 'Effulgent Stance',
          name: 'Effulgent Stance',
          coefficient:
            effectNumber(profile, strike, 'coefficient') +
            stacks * balanceProfileNumber(profile, 'damageIncreasePerStack'),
          weaponStrengthProfileId: 'nonweapon.unequipped',
          offTarget: event.offTarget === true
        })
      );
    }

    if (stacks === maximum && requireEffect(profile, 'control', 'Control'))
      runtime.emitDerived(event, {
        type: 'control',
        at: runtime.time,
        priority: 6,
        source: 'guardian',
        sourceId: ID.EFFULGENT_STANCE_DAMAGE,
        actorType: 'player',
        skillId: ID.EFFULGENT_STANCE_DAMAGE,
        skillName: 'Effulgent Stance',
        controlKind: 'daze',
        offTarget: event.offTarget === true
      });
  }
};
