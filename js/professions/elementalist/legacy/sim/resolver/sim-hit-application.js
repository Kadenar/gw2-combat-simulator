import { strikeDamage } from "../../../../../platform/gw2/damage.js";
import {
  addPerSkillStrike,
  addPerSkillHit,
  recordPerSkillCast,
} from "../state/sim-reporting-state.js";

function isFlatStrikeEvent(ev) {
  return (
    Number.isFinite(ev?.flatStrikeBase) ||
    Number.isFinite(ev?.flatStrikePowerCoeff)
  );
}

function getMistStrangerFlatDamage(ctx, ev) {
  const { S } = ctx;
  if (S.activeRelic !== "Mist Stranger") return 0;
  if (ev.isSigilProc || ev.isRelicProc || ev.isTraitProc || ev.isFoodProc)
    return 0;
  return ctx.getRelicProc("Mist Stranger")?.flatDamage || 0;
}

function applyStrikeDamage(ctx, ev, power, critMult, strikeMul) {
  const { S } = ctx;
  const mistStrangerFlat = getMistStrangerFlatDamage(ctx, ev);
  let baseStrike = 0;
  if (isFlatStrikeEvent(ev)) {
    baseStrike =
      (ev.flatStrikeBase || 0) + (ev.flatStrikePowerCoeff || 0) * power;
    const strike = baseStrike + mistStrangerFlat;
    S.totalStrike += strike;
    return { strike, baseStrike, mistStrangerFlat };
  }

  if (!(ev.dmg > 0 && ev.ws > 0)) {
    S.totalStrike += mistStrangerFlat;
    return { strike: mistStrangerFlat, baseStrike: 0, mistStrangerFlat };
  }

  baseStrike = strikeDamage(ev.dmg, ev.ws, power) * critMult * strikeMul;
  const strike = baseStrike + mistStrangerFlat;
  S.totalStrike += strike;

  // Catalyst energy is intentionally NOT credited here. Energy is accounted for entirely by
  // the scheduler (flushPendingEnergy at each sphere cast plus a final catch-up at the end of
  // the rotation), so the displayed end-of-rotation energy stays consistent with the energy
  // model that gates sphere casts. Crediting again during resolution would double-count
  // reactive proc strikes that the scheduler never saw, inflating the bar past the log value.

  return { strike, baseStrike, mistStrangerFlat };
}

function recordStrikeContribution(ctx, skillName, strike) {
  ctx.ensurePerSkill(skillName);
  addPerSkillStrike(ctx.S, skillName, strike);
  addPerSkillHit(ctx.S, skillName);
}

function applyPayloadEffects(ctx, ev) {
  const { S, boons, damagingConditions, fireFieldSkills } = ctx;
  if (!ev.conds) return;

  const sphereDoubleBoons =
    S._hasSphereSpecialist && ev.skill.startsWith("Deploy Jade Sphere");
  const frostBowCondDur = ev.conjure === "Frost Bow" ? 20 : 0;

  for (const [cond, val] of Object.entries(ev.conds)) {
    if (!val || val.stacks <= 0 || val.duration <= 0) continue;

    if (cond === "Boon Extension") {
      ctx.applyBoonExtension(val.duration, ev.time);
      ctx.log({
        t: ev.time,
        type: "apply",
        effect: "Boon Extension",
        dur: val.duration,
        skill: ev.skill,
      });
      continue;
    }

    const dur =
      sphereDoubleBoons && boons.has(cond) ? val.duration * 2 : val.duration;
    if (damagingConditions.has(cond)) {
      ctx.applyCondition(
        cond,
        val.stacks,
        dur,
        ev.time,
        ev.skill,
        ev.castStart,
        frostBowCondDur,
      );
    } else {
      ctx.trackEffect(cond, val.stacks, dur, ev.time);
    }

    ctx.log({
      t: ev.time,
      type: "apply",
      effect: cond,
      stacks: val.stacks,
      dur: val.duration,
      skill: ev.skill,
    });
  }

  if (S._hasPersistingFlames && ev.isField && fireFieldSkills.has(ev.skill)) {
    ctx.grantPersistingFlames(ev.time);
  }
}

function logAppliedHit(ctx, ev, strike) {
  ctx.log({
    t: ev.time,
    type: "hit",
    skill: ev.skill,
    hit: ev.hitIdx,
    sub: ev.sub,
    totalSubs: ev.totalSubs,
    strike: Math.round(strike),
    coeff: ev.dmg,
    isField: ev.isField,
    cc: ev.cc,
    finisher: ev.finType,
    att: ev.att,
    flatStrike: isFlatStrikeEvent(ev),
    mistStrangerFlatDamage: getMistStrangerFlatDamage(ctx, ev),
  });
}

export function procHit(ctx, ev, power, condDmg, critMult, strikeMul, condMul) {
  const { strike, baseStrike, mistStrangerFlat } = applyStrikeDamage(
    ctx,
    ev,
    power,
    critMult,
    strikeMul,
  );
  recordStrikeContribution(ctx, ev.skill, baseStrike);
  if (mistStrangerFlat > 0) {
    recordStrikeContribution(ctx, "Relic of Mist Stranger", mistStrangerFlat);
    recordPerSkillCast(ctx.S, "Relic of Mist Stranger", 0);
  }
  applyPayloadEffects(ctx, ev, condDmg, condMul);
  logAppliedHit(ctx, ev, strike);
}
