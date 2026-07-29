import {
  MESMER_SKILL_IDS as ID,
  MESMER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { isInternalCooldownReady } from "../../../../platform/engine/internal-cooldown.js";

const CLARITY_DURATION = 15;
const CLARITY_ICON =
  "https://wiki.guildwars2.com/wiki/Special:FilePath/Clarity.png";
const CLARITY_CONSUMERS = new Set([
  ID.IMAGINARY_INVERSION,
  ID.PHANTASMAL_LANCER,
  ID.MENTAL_COLLAPSE,
]);
const SIGNET_ILLUSIONS_RESET_EXCLUSIONS = new Set([
  ID.CONTINUUM_SPLIT,
  ID.CRESCENDO,
]);

/**
 * Applies a replacing handler's complete Mesmer-owned effect profile.
 */
export function createSkillEffectController({
  state,
  config,
  traits,
  resourceDefinition,
  phantasmAttackTimings,
  allSkills,
  epsilon,
  activePrimaryWeapon,
  currentResource,
  markCompounding,
  queueResources,
  addEvent,
  addTraitProc,
  addCondition,
  addDamage,
  traitDamage,
  shatters = {},
  instruments = {},
}) {
  const handleExceptionalProfile = (
    skill,
    at,
    castStart = at,
    { phantasmSummonAt = at, playerEffectEnd = Infinity } = {},
  ) => {
    const clarityConsumed =
      CLARITY_CONSUMERS.has(skill.id) &&
      state.profession.clarityUntil > castStart;
    if (CLARITY_CONSUMERS.has(skill.id)) {
      state.profession.clarityUntil = 0;
    }
    const pulseCount = Math.max(1, Math.trunc(Number(skill.pulseCount || 1)));
    const pulseTimes =
      pulseCount > 1
        ? Array.from(
            { length: pulseCount },
            (_, index) =>
              castStart + ((at - castStart) * (index + 1)) / pulseCount,
          )
        : [];
    const etherCloneAtMaximum =
      skill.id === ID.ETHER_CLONE &&
      resourceDefinition.singular === "clone" &&
      currentResource() >= resourceDefinition.maximum;
    const isPhantasm = skill.resource?.mode === "phantasm";
    const bountifulBerserker =
      skill.id === ID.PHANTASMAL_BERSERKER &&
      traits.has(TRAIT.BOUNTIFUL_BLADES);
    const bountifulBerserkerDamage = bountifulBerserker ? 0.66 : 1;
    const phantasmCount = isPhantasm
      ? Number(skill.resource?.count || 1) *
        (skill.id === ID.PHANTASMAL_LANCER && clarityConsumed ? 2 : 1) *
        (bountifulBerserker ? 2 : 1)
      : 1;
    const phantasmTiming = phantasmAttackTimings[skill.id];
    const hasChronophantasma = isPhantasm && traits.has(TRAIT.CHRONOPHANTASMA);
    const phantasmSpeed = traits.has(TRAIT.PHANTASMAL_HASTE) ? 1.5 : 1;
    const phantasmEndpoint = (atMs) => {
      const measuredCastTimeMs = Number(phantasmTiming?.castTimeMs || 0);
      const measuredPostCast = (Number(atMs) - measuredCastTimeMs) / 1000;
      const actualCastTime = phantasmSummonAt - castStart;
      return castStart + actualCastTime + measuredPostCast / phantasmSpeed;
    };
    const phantasmDamageAt = phantasmEndpoint(phantasmTiming?.damageAtMs);
    const phantasmSpawnAt = phantasmEndpoint(phantasmTiming?.spawnAtMs);
    const chronophantasmaDamageAt = phantasmEndpoint(
      phantasmTiming?.chronophantasmaDamageAtMs,
    );
    const initialPhantasmalBladeAt =
      phantasmTiming?.phantasmalBladeDelayAfterSpawnMs != null
        ? phantasmSpawnAt +
          Number(phantasmTiming.phantasmalBladeDelayAfterSpawnMs) / 1000
        : phantasmDamageAt;
    const phantasmConversionAt = hasChronophantasma
      ? phantasmEndpoint(phantasmTiming?.chronophantasmaSpawnAtMs)
      : phantasmSpawnAt;
    const virtuosoBladeHits =
      resourceDefinition.singular === "blade" &&
      !hasChronophantasma &&
      Array.isArray(phantasmTiming?.virtuosoBladeTicks)
        ? phantasmTiming.virtuosoBladeTicks
        : null;
    let chronophantasmaProc = false;
    let firstFencerTriggerAt = Infinity;

    const addFencerStacks = (hitTimes, hits) => {
      if (
        !traits.has(TRAIT.FENCERS_FINESSE) ||
        skill.weapon !== "Sword" ||
        hitTimes.length === 0
      ) {
        return;
      }
      const hitCount = Math.max(1, Math.trunc(Number(hits || 1)));
      if (hitTimes.length === hitCount) {
        for (const hitAt of hitTimes) {
          addEvent({
            type: "buff",
            at: hitAt + epsilon,
            kind: "fencer",
            stacks: 1,
            duration: 6,
          });
          firstFencerTriggerAt = Math.min(
            firstFencerTriggerAt,
            hitAt + epsilon,
          );
        }
        return;
      }
      addEvent({
        type: "buff",
        at: hitTimes[0] + epsilon,
        kind: "fencer",
        stacks: Math.min(10, hitCount),
        duration: 6,
      });
      firstFencerTriggerAt = Math.min(
        firstFencerTriggerAt,
        hitTimes[0] + epsilon,
      );
    };

    if (isPhantasm) {
      if (traits.has(TRAIT.COMPOUNDING_POWER)) {
        markCompounding(phantasmSummonAt, phantasmCount);
        addTraitProc(
          "Compounding Power",
          phantasmSummonAt,
          skill.name,
          `${phantasmCount} phantasm${phantasmCount === 1 ? "" : "s"}`,
        );
      }
      addEvent({
        type: "mesmer.phantasm-summoned",
        at: phantasmSummonAt,
        name: skill.name,
        count: phantasmCount,
      });
      addEvent({
        type: "mesmer.phantasm-attack",
        at: phantasmDamageAt,
        name: skill.name,
        count: phantasmCount,
        repeat: false,
        complete: true,
      });
      if (traits.has(TRAIT.PHANTASMAL_BLADES)) {
        const blade = traitDamage["Phantasmal Blade"];
        addDamage(
          {
            name: "Phantasmal Blade",
            weapon: skill.weapon,
            blade: true,
          },
          initialPhantasmalBladeAt,
          {
            coefficient: blade.coefficient * phantasmCount,
            hits: blade.hits * phantasmCount,
            source: "Player",
            weaponStrength: blade.weaponStrength,
          },
        );
        addTraitProc("Phantasmal Blades", initialPhantasmalBladeAt, skill.name);
      }
      if (hasChronophantasma) {
        if (traits.has(TRAIT.COMPOUNDING_POWER)) {
          markCompounding(phantasmSpawnAt, phantasmCount);
          addTraitProc(
            "Compounding Power",
            phantasmSpawnAt,
            `${skill.name} — Chronophantasma`,
            `${phantasmCount} phantasm${phantasmCount === 1 ? "" : "s"}`,
          );
        }
        addEvent({
          type: "mesmer.phantasm-resummoned",
          at: phantasmSpawnAt,
          name: skill.name,
          count: phantasmCount,
        });
        addEvent({
          type: "mesmer.phantasm-attack",
          at: chronophantasmaDamageAt,
          name: skill.name,
          count: phantasmCount,
          repeat: true,
          complete: true,
        });
        if (traits.has(TRAIT.PHANTASMAL_BLADES)) {
          const blade = traitDamage["Phantasmal Blade"];
          addDamage(
            {
              name: "Phantasmal Blade",
              weapon: skill.weapon,
              blade: true,
            },
            chronophantasmaDamageAt,
            {
              coefficient: blade.coefficient * phantasmCount,
              hits: blade.hits * phantasmCount,
              source: "Player",
              weaponStrength: blade.weaponStrength,
            },
          );
          addTraitProc(
            "Phantasmal Blades",
            chronophantasmaDamageAt,
            `${skill.name} — Chronophantasma`,
          );
        }
      }
    }

    const playerHitTimes = [];
    const strikeEffects = (skill.effects || []).filter(
      (effect) => effect.type === "strike",
    );
    for (const group of strikeEffects) {
      if (group.requiredTrait && !traits.has(group.requiredTrait)) {
        continue;
      }
      const isPhantasmStrike = group.actorType === "phantasm";
      const hitAt = isPhantasmStrike
        ? phantasmDamageAt
        : group.castProgress != null
          ? castStart + (at - castStart) * Number(group.castProgress)
          : at + Number(group.atMs || 0) / 1000;
      if (!isPhantasmStrike && hitAt > playerEffectEnd + epsilon) {
        continue;
      }
      const selectedGroup =
        skill.boonlessCoefficient && config.target?.boonless
          ? { ...group, coefficient: skill.boonlessCoefficient }
          : group;
      const sourcedGroup = {
        ...selectedGroup,
        source: isPhantasmStrike ? "Phantasm" : "Player",
      };
      const scaledGroup =
        isPhantasmStrike && phantasmCount > 1
          ? {
              ...sourcedGroup,
              coefficient:
                Number(sourcedGroup.coefficient || 0) *
                phantasmCount *
                bountifulBerserkerDamage,
              hits: Number(sourcedGroup.hits || 1) * phantasmCount,
            }
          : sourcedGroup;
      const phantasmTicks =
        isPhantasmStrike &&
        Array.isArray(phantasmTiming?.damageTicks?.[group.name])
          ? phantasmTiming.damageTicks[group.name]
          : null;
      const fixedTicks = Array.isArray(group.ticks) ? group.ticks : null;
      const interval = Number(group.intervalMs || 0) / 1000;
      const initialHitTimes = [];
      if (phantasmTicks?.length > 0 || fixedTicks?.length > 0) {
        const hits = Math.max(
          1,
          Math.trunc(Number(scaledGroup.hits || fixedTicks?.length || 1)),
        );
        const packets = phantasmTicks || fixedTicks;
        const timingAnchorAt =
          group.timingAnchor === "castStart" ? castStart : at;
        for (let index = 0; index < hits; index += 1) {
          const packet = packets[index % packets.length];
          const packetAt = phantasmTicks
            ? phantasmEndpoint(packet.atMs)
            : timingAnchorAt + Number(packet.atMs) / 1000;
          initialHitTimes.push(packetAt);
          addDamage(skill, packetAt, {
            ...scaledGroup,
            coefficient: fixedTicks
              ? Number(packet.coefficient)
              : Number(scaledGroup.coefficient || 0) / hits,
            hits: 1,
          });
        }
      } else if (interval > 0 && Number(scaledGroup.hits || 1) > 1) {
        const hits = Math.max(1, Math.trunc(Number(scaledGroup.hits || 1)));
        const timingAnchorAt =
          group.timingAnchor === "castStart" ? castStart : at;
        for (let index = 0; index < hits; index += 1) {
          const packetAt =
            timingAnchorAt + Number(group.atMs || 0) / 1000 + index * interval;
          initialHitTimes.push(packetAt);
          addDamage(skill, packetAt, {
            ...scaledGroup,
            coefficient: Number(scaledGroup.coefficient || 0) / hits,
            hits: 1,
          });
        }
      } else if (
        pulseTimes.length > 0 &&
        !isPhantasmStrike &&
        Number(scaledGroup.hits || 1) === pulseCount
      ) {
        for (const pulseAt of pulseTimes) {
          initialHitTimes.push(pulseAt);
          addDamage(skill, pulseAt, {
            ...scaledGroup,
            coefficient: Number(scaledGroup.coefficient || 0) / pulseCount,
            hits: 1,
          });
        }
      } else {
        initialHitTimes.push(hitAt);
        addDamage(skill, hitAt, scaledGroup);
      }
      if (group.actorType === "player") {
        playerHitTimes.push(...initialHitTimes);
      }
      if (isPhantasmStrike && hasChronophantasma) {
        addDamage(skill, chronophantasmaDamageAt, scaledGroup, {
          name: `${skill.name} — Chronophantasma`,
          multiplier: 1.05,
        });
        if (!chronophantasmaProc) {
          addTraitProc("Chronophantasma", phantasmSpawnAt, skill.name);
          chronophantasmaProc = true;
        }
      }
      if (group.actorType === "player" || isPhantasmStrike) {
        addFencerStacks(initialHitTimes, scaledGroup.hits);
      }
      if (isPhantasmStrike && hasChronophantasma) {
        addFencerStacks([chronophantasmaDamageAt], scaledGroup.hits);
      }
    }
    if (skill.trackedHitDamage) {
      const tracking = skill.trackedHitDamage;
      const duration = Number(tracking.duration || 0);
      let recentHits = [...(state.profession.trackedSkillHits[skill.id] || [])];
      const required = Math.max(
        1,
        Math.trunc(Number(tracking.hitsRequired || 1)),
      );
      for (const currentHitAt of playerHitTimes.sort((a, b) => a - b)) {
        const minimum = currentHitAt - duration;
        recentHits = recentHits.filter((hitAt) => hitAt > minimum + epsilon);
        recentHits.push(currentHitAt);
        while (recentHits.length >= required) {
          const triggerHits = recentHits.splice(0, required);
          const triggerAt = triggerHits[triggerHits.length - 1];
          const ticks = tracking.ticks;
          if (Array.isArray(ticks) && ticks.length > 0) {
            for (const tick of ticks) {
              addDamage(
                skill,
                triggerAt + Number(tick.atMs) / 1000,
                {
                  ...tracking,
                  coefficient: Number(tick.coefficient),
                  hits: 1,
                },
                {
                  blade: skill.blade,
                  name: tracking.name,
                  skillName: tracking.name,
                  parentSkillName: skill.name,
                  sourceId: tracking.skillId ?? skill.id,
                  skillId: tracking.skillId ?? skill.id,
                },
              );
            }
          } else {
            addDamage(skill, triggerAt, tracking, {
              blade: skill.blade,
              name: tracking.name,
              skillName: tracking.name,
              parentSkillName: skill.name,
              sourceId: tracking.skillId ?? skill.id,
              skillId: tracking.skillId ?? skill.id,
            });
          }
        }
      }
      state.profession.trackedSkillHits[skill.id] = recentHits;
    }

    const appliedConditions = etherCloneAtMaximum
      ? skill.maxCloneEffects || []
      : (skill.effects || []).filter((effect) => effect.type === "condition");
    const conditionAt = isPhantasm ? phantasmDamageAt : at;
    for (const effect of appliedConditions) {
      const condition = { ...effect, name: effect.condition };
      const scaledCondition =
        isPhantasm && phantasmCount > 1
          ? {
              ...condition,
              stacks: Number(condition.stacks || 1) * phantasmCount,
            }
          : condition;
      const conditionTicks =
        isPhantasm &&
        condition.packetLabel &&
        Array.isArray(phantasmTiming?.damageTicks?.[condition.packetLabel])
          ? phantasmTiming.damageTicks[condition.packetLabel]
          : null;
      if (conditionTicks?.length > 0) {
        const packetStacks =
          Number(scaledCondition.stacks || 1) / conditionTicks.length;
        for (const tick of conditionTicks) {
          addCondition(
            skill.name,
            phantasmEndpoint(tick.atMs),
            {
              ...scaledCondition,
              stacks: packetStacks,
            },
            "Phantasm",
          );
        }
      } else if (
        pulseTimes.length > 0 &&
        !isPhantasm &&
        Number(scaledCondition.stacks || 1) === pulseCount
      ) {
        for (const pulseAt of pulseTimes) {
          addCondition(skill.name, pulseAt, {
            ...scaledCondition,
            stacks: 1,
          });
        }
      } else {
        addCondition(
          skill.name,
          conditionAt,
          scaledCondition,
          isPhantasm ? "Phantasm" : "Player",
        );
      }
    }
    if (isPhantasm && hasChronophantasma && appliedConditions.length > 0) {
      for (const effect of appliedConditions) {
        const condition = { ...effect, name: effect.condition };
        const scaledCondition =
          phantasmCount > 1
            ? {
                ...condition,
                stacks: Number(condition.stacks || 1) * phantasmCount,
              }
            : condition;
        addCondition(
          skill.name,
          chronophantasmaDamageAt,
          scaledCondition,
          "Phantasm",
          `${skill.name} — Chronophantasma`,
        );
      }
    }

    if (skill.resource?.mode === "fill") {
      queueResources(
        at + epsilon,
        resourceDefinition.maximum,
        skill.weapon || activePrimaryWeapon(),
        skill.name,
        { kind: "skill", sourceSkillId: skill.id },
      );
    } else if (skill.resource?.mode === "add" && !etherCloneAtMaximum) {
      const resourceAt =
        skill.resource.timingAnchor === "castStart"
          ? castStart + Number(skill.resource.atMs || 0) / 1000
          : at + Number(skill.resource.atMs || 0) / 1000;
      queueResources(
        resourceAt + epsilon,
        skill.resource.count,
        skill.weapon || activePrimaryWeapon(),
        skill.name,
        { kind: "skill", sourceSkillId: skill.id },
      );
    } else if (skill.resource?.mode === "phantasm" && virtuosoBladeHits) {
      for (let index = 0; index < phantasmCount; index += 1) {
        const measuredTick =
          virtuosoBladeHits[Math.min(index, virtuosoBladeHits.length - 1)];
        queueResources(
          phantasmEndpoint(measuredTick.atMs) + epsilon,
          1,
          null,
          `${skill.name} phantasm conversion`,
          { kind: "phantasm-conversion", sourceSkillId: skill.id },
        );
      }
    } else if (skill.resource?.mode === "phantasm") {
      queueResources(
        phantasmConversionAt + epsilon,
        phantasmCount,
        null,
        `${skill.name} phantasm conversion`,
        { kind: "phantasm-conversion", sourceSkillId: skill.id },
      );
    }

    if (skill.id === ID.MIND_THE_GAP) {
      state.profession.clarityUntil = at + CLARITY_DURATION;
      addEvent({
        type: "proc",
        procType: "skill",
        at,
        name: "Clarity",
        sourceSkill: skill.name,
        detail: "Spear skills 3-5 empowered for 15s",
        icon: CLARITY_ICON,
      });
    }
    if (skill.id === ID.SIGNET_OF_THE_ETHER) {
      for (const phantasmSkill of allSkills.filter(
        (candidate) => candidate.phantasm,
      )) {
        state.cooldowns.delete(phantasmSkill.id);
      }
      addEvent({
        type: "marker",
        at,
        name: "Signet of the Ether",
        detail: "Phantasm skill cooldowns reset",
      });
    }
    if (skill.id === ID.SIGNET_OF_ILLUSIONS) {
      for (const target of allSkills.filter(
        (candidate) =>
          (shatters[candidate.id] || instruments[candidate.id]) &&
          !SIGNET_ILLUSIONS_RESET_EXCLUSIONS.has(candidate.id),
      )) {
        const ammo = state.ammo.get(target.id);
        if (ammo) {
          ammo.charges = Math.min(ammo.maximum, ammo.charges + 1);
          if (ammo.charges >= ammo.maximum) ammo.nextRechargeAt = null;
          // state.cooldowns may hold nextRechargeAt from when charges hit 0;
          // that timer no longer blocks now that we have a charge, so clear it.
          state.cooldowns.delete(target.id);
        } else {
          state.cooldowns.delete(target.id);
        }
      }
      addEvent({
        type: "marker",
        at,
        name: "Signet of Illusions",
        detail:
          "Shatter/instrument cooldowns reset (excluding Continuum Split and Crescendo)",
      });
    }
    if (skill.id === ID.MENTAL_COLLAPSE) {
      const mindTheGap = allSkills.find(
        (candidate) => candidate.id === ID.MIND_THE_GAP,
      );
      if (mindTheGap) {
        state.cooldowns.delete(mindTheGap.id);
        addEvent({
          type: "marker",
          at,
          name: "Mental Collapse",
          detail: "Mind the Gap cooldown reset",
        });
      }
    }
    if (skill.type === "Heal" && traits.has(TRAIT.METHOD_OF_MADNESS)) {
      const storm = traitDamage["Lesser Chaos Storm"];
      const readyAt =
        state.profession.traitReadyAt[TRAIT.METHOD_OF_MADNESS] || 0;
      if (isInternalCooldownReady(at, readyAt)) {
        const hits = Math.max(1, Math.trunc(Number(storm.hits || 1)));
        const interval = Math.max(0, Number(storm.interval || 0));
        for (let index = 0; index < hits; index += 1) {
          addDamage(
            {
              name: "Lesser Chaos Storm",
              weapon: "Utility",
              blade: false,
            },
            at + index * interval,
            {
              coefficient: Number(storm.coefficient || 0) / hits,
              hits: 1,
              source: "Player",
              weapon: "utility",
            },
          );
        }
        addTraitProc("Method of Madness", at, skill.name);
        state.profession.traitReadyAt[TRAIT.METHOD_OF_MADNESS] =
          at + storm.cooldown;
        if (traits.has(TRAIT.SYNCOPATE)) {
          const syncopate = traitDamage.Syncopate;
          addDamage(
            {
              name: "Syncopate",
              weapon: "Utility",
              blade: false,
            },
            at,
            {
              coefficient: syncopate.coefficient,
              hits: syncopate.hits,
              source: "Player",
              weapon: "utility",
            },
          );
          addTraitProc("Syncopate", at, "Lesser Chaos Storm");
        }
      }
    }
    if (Number.isFinite(firstFencerTriggerAt)) {
      addTraitProc("Fencer's Finesse", firstFencerTriggerAt, skill.name);
    }
    return clarityConsumed;
  };

  return {
    handleExceptionalProfile,
  };
}
