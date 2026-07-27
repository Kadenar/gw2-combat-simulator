import { MESMER_TRAIT_IDS as TRAIT } from "../data/ids.js";
import {
  isInternalCooldownReady,
} from "../../../platform/engine/internal-cooldown.js";

const CLARITY_DURATION = 15;
const CLARITY_ICON =
  "https://wiki.guildwars2.com/wiki/Special:FilePath/Clarity.png";
const CLARITY_CONSUMERS = new Set([
  "Imaginary Inversion",
  "Phantasmal Lancer",
  "Mental Collapse",
]);
const SIGNET_ILLUSIONS_RESET_EXCLUSIONS = new Set([
  "Continuum Split",
  "Crescendo",
]);

/**
 * Applies Mesmer-owned ordinary and phantasm skill effects.
 */
export function createSkillEffectController({
  state,
  config,
  traits,
  resourceDefinition,
  phantasmNameBySkill,
  phantasmAttackTimings,
  allSkills,
  skillsByName,
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
  const handleGenericSkill = (
    skill,
    at,
    castStart = at,
    {
      phantasmSummonAt = at,
      playerEffectEnd = Infinity,
    } = {},
  ) => {
    const clarityConsumed =
      CLARITY_CONSUMERS.has(skill.name)
      && state.profession.clarityUntil > castStart;
    if (CLARITY_CONSUMERS.has(skill.name)) {
      state.profession.clarityUntil = 0;
    }
    const pulseCount = Math.max(
      1,
      Math.trunc(Number(skill.pulseCount || 1)),
    );
    const pulseTimes =
      pulseCount > 1
        ? Array.from(
            { length: pulseCount },
            (_, index) =>
              castStart + ((at - castStart) * (index + 1)) / pulseCount,
          )
        : [];
    const etherCloneAtMaximum =
      skill.name === "Ether Clone"
      && resourceDefinition.singular === "clone"
      && currentResource() >= resourceDefinition.maximum;
    const isPhantasm = skill.resource?.mode === "phantasm";
    const bountifulBerserker =
      skill.name === "Phantasmal Berserker"
      && traits.has(TRAIT.BOUNTIFUL_BLADES);
    const bountifulBerserkerDamage = bountifulBerserker ? 0.66 : 1;
    const phantasmCount = isPhantasm
      ? Number(skill.resource?.count || 1)
        * (skill.name === "Phantasmal Lancer" && clarityConsumed ? 2 : 1)
        * (bountifulBerserker ? 2 : 1)
      : 1;
    const phantasmName = phantasmNameBySkill[skill.name] || skill.name;
    const phantasmTiming = phantasmAttackTimings[phantasmName];
    const hasChronophantasma =
      isPhantasm && traits.has(TRAIT.CHRONOPHANTASMA);
    const phantasmSpeed = traits.has(TRAIT.PHANTASMAL_HASTE) ? 1.5 : 1;
    const phantasmEndpoint = (offset) => {
      const measuredCastTime = Number(phantasmTiming?.castTime || 0);
      const measuredPostCast = Number(offset) - measuredCastTime;
      const actualCastTime = phantasmSummonAt - castStart;
      return castStart + actualCastTime + measuredPostCast / phantasmSpeed;
    };
    const phantasmDamageAt = phantasmEndpoint(phantasmTiming?.damage);
    const phantasmSpawnAt = phantasmEndpoint(phantasmTiming?.spawn);
    const chronophantasmaDamageAt = phantasmEndpoint(
      phantasmTiming?.chronophantasmaDamage,
    );
    const initialPhantasmalBladeAt =
      phantasmTiming?.phantasmalBladeDelayAfterSpawn != null
        ? phantasmSpawnAt
          + Number(phantasmTiming.phantasmalBladeDelayAfterSpawn)
        : phantasmDamageAt;
    const phantasmConversionAt = hasChronophantasma
      ? phantasmEndpoint(phantasmTiming?.chronophantasmaSpawn)
      : phantasmSpawnAt;
    const virtuosoBladeHits =
      resourceDefinition.singular === "blade"
      && !hasChronophantasma
      && Array.isArray(phantasmTiming?.virtuosoBladeHits)
        ? phantasmTiming.virtuosoBladeHits
        : null;
    let chronophantasmaProc = false;
    let firstFencerTriggerAt = Infinity;

    const addFencerStacks = (hitTimes, hits) => {
      if (
        !traits.has(TRAIT.FENCERS_FINESSE)
        || skill.weapon !== "Sword"
        || hitTimes.length === 0
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
    for (const group of skill.damage || []) {
      if (group.requiredTrait && !traits.has(group.requiredTrait)) {
        continue;
      }
      const hitAt = group.source === "Phantasm"
        ? phantasmDamageAt
        : group.castProgress != null
          ? castStart + (at - castStart) * Number(group.castProgress)
          : at + Number(group.delay || 0);
      if (
        group.source !== "Phantasm"
        && hitAt > playerEffectEnd + epsilon
      ) {
        continue;
      }
      const selectedGroup =
        skill.boonlessCoefficient && config.target?.boonless
          ? { ...group, coefficient: skill.boonlessCoefficient }
          : group;
      const scaledGroup =
        group.source === "Phantasm" && phantasmCount > 1
          ? {
              ...selectedGroup,
              coefficient:
                Number(selectedGroup.coefficient || 0)
                * phantasmCount
                * bountifulBerserkerDamage,
              hits: Number(selectedGroup.hits || 1) * phantasmCount,
            }
          : selectedGroup;
      const phantasmPacketOffsets =
        group.source === "Phantasm"
        && Array.isArray(phantasmTiming?.damagePackets?.[group.label])
          ? phantasmTiming.damagePackets[group.label]
          : null;
      const fixedPacketOffsets = Array.isArray(group.packetOffsets)
        ? group.packetOffsets
        : null;
      const interval = Number(group.interval || 0);
      const initialHitTimes = [];
      if (
        phantasmPacketOffsets?.length > 0
        || fixedPacketOffsets?.length > 0
      ) {
        const hits = Math.max(
          1,
          Math.trunc(Number(scaledGroup.hits || 1)),
        );
        const packetOffsets = phantasmPacketOffsets || fixedPacketOffsets;
        const timingOrigin =
          group.timingOrigin === "castStart" ? castStart : at;
        for (let index = 0; index < hits; index += 1) {
          const offset = packetOffsets[index % packetOffsets.length];
          const packetAt = phantasmPacketOffsets
            ? phantasmEndpoint(offset)
            : timingOrigin + Number(offset);
          initialHitTimes.push(packetAt);
          addDamage(
            skill,
            packetAt,
            {
              ...scaledGroup,
              coefficient: Number(scaledGroup.coefficient || 0) / hits,
              hits: 1,
            },
          );
        }
      } else if (
        interval > 0
        && Number(scaledGroup.hits || 1) > 1
      ) {
        const hits = Math.max(
          1,
          Math.trunc(Number(scaledGroup.hits || 1)),
        );
        const timingOrigin =
          group.timingOrigin === "castStart" ? castStart : at;
        for (let index = 0; index < hits; index += 1) {
          const packetAt =
            timingOrigin + Number(group.firstDelay || 0) + index * interval;
          initialHitTimes.push(packetAt);
          addDamage(
            skill,
            packetAt,
            {
              ...scaledGroup,
              coefficient: Number(scaledGroup.coefficient || 0) / hits,
              hits: 1,
            },
          );
        }
      } else if (
        pulseTimes.length > 0
        && group.source !== "Phantasm"
        && Number(scaledGroup.hits || 1) === pulseCount
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
      if (group.source === "Player") {
        playerHitTimes.push(...initialHitTimes);
      }
      if (group.source === "Phantasm" && hasChronophantasma) {
        addDamage(skill, chronophantasmaDamageAt, scaledGroup, {
          name: `${skill.name} — Chronophantasma`,
          multiplier: 1.05,
        });
        if (!chronophantasmaProc) {
          addTraitProc("Chronophantasma", phantasmSpawnAt, skill.name);
          chronophantasmaProc = true;
        }
      }
      if (group.source === "Player" || group.source === "Phantasm") {
        addFencerStacks(initialHitTimes, scaledGroup.hits);
      }
      if (group.source === "Phantasm" && hasChronophantasma) {
        addFencerStacks(
          [chronophantasmaDamageAt],
          scaledGroup.hits,
        );
      }
    }
    if (skill.trackedHitDamage) {
      const tracking = skill.trackedHitDamage;
      const duration = Number(tracking.duration || 0);
      let recentHits = [
        ...(state.profession.trackedSkillHits.get(skill.id) || []),
      ];
      const required = Math.max(
        1,
        Math.trunc(Number(tracking.hitsRequired || 1)),
      );
      for (const currentHitAt of playerHitTimes.sort((a, b) => a - b)) {
        const minimum = currentHitAt - duration;
        recentHits = recentHits.filter(
          hitAt => hitAt > minimum + epsilon,
        );
        recentHits.push(currentHitAt);
        while (recentHits.length >= required) {
          const triggerHits = recentHits.splice(0, required);
          const triggerAt = triggerHits[triggerHits.length - 1];
          const packetOffsets = tracking.packetOffsets;
          if (Array.isArray(packetOffsets) && packetOffsets.length > 0) {
            const hits = packetOffsets.length;
            for (const offset of packetOffsets) {
              addDamage(
                skill,
                triggerAt + Number(offset),
                {
                  ...tracking.damage,
                  coefficient:
                    Number(tracking.damage.coefficient || 0) / hits,
                  hits: 1,
                },
                {
                  blade: skill.blade,
                  name: tracking.damage.label,
                  skillName: tracking.damage.label,
                  parentSkillName: skill.name,
                  sourceId: tracking.skillId ?? skill.id,
                  skillId: tracking.skillId ?? skill.id,
                },
              );
            }
          } else {
            addDamage(skill, triggerAt, tracking.damage, {
              blade: skill.blade,
              name: tracking.damage.label,
              skillName: tracking.damage.label,
              parentSkillName: skill.name,
              sourceId: tracking.skillId ?? skill.id,
              skillId: tracking.skillId ?? skill.id,
            });
          }
        }
      }
      state.profession.trackedSkillHits.set(skill.id, recentHits);
    }

    const appliedConditions = etherCloneAtMaximum
      ? skill.maxCloneConditions || []
      : skill.conditions || [];
    const conditionAt = isPhantasm ? phantasmDamageAt : at;
    for (const condition of appliedConditions) {
      const scaledCondition =
        isPhantasm && phantasmCount > 1
          ? {
              ...condition,
              stacks: Number(condition.stacks || 1) * phantasmCount,
          }
          : condition;
      const conditionPacketOffsets =
        isPhantasm
        && condition.packetLabel
        && Array.isArray(
          phantasmTiming?.damagePackets?.[condition.packetLabel],
        )
          ? phantasmTiming.damagePackets[condition.packetLabel]
          : null;
      if (
        conditionPacketOffsets?.length > 0
      ) {
        const packetStacks =
          Number(scaledCondition.stacks || 1)
          / conditionPacketOffsets.length;
        for (const offset of conditionPacketOffsets) {
          addCondition(
            skill.name,
            phantasmEndpoint(offset),
            {
              ...scaledCondition,
              stacks: packetStacks,
            },
            "Phantasm",
          );
        }
      } else if (
        pulseTimes.length > 0
        && !isPhantasm
        && Number(scaledCondition.stacks || 1) === pulseCount
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
      for (const condition of appliedConditions) {
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
      );
    } else if (skill.resource?.mode === "add" && !etherCloneAtMaximum) {
      const resourceAt =
        skill.resource.timingOrigin === "castStart"
          ? castStart + Number(skill.resource.delay || 0)
          : at + Number(skill.resource.delay || 0);
      queueResources(
        resourceAt + epsilon,
        skill.resource.count,
        skill.weapon || activePrimaryWeapon(),
        skill.name,
      );
    } else if (skill.resource?.mode === "phantasm" && virtuosoBladeHits) {
      for (let index = 0; index < phantasmCount; index += 1) {
        const measuredOffset =
          virtuosoBladeHits[Math.min(index, virtuosoBladeHits.length - 1)];
        queueResources(
          phantasmEndpoint(measuredOffset) + epsilon,
          1,
          null,
          `${skill.name} phantasm conversion`,
        );
      }
    } else if (skill.resource?.mode === "phantasm") {
      queueResources(
        phantasmConversionAt + epsilon,
        phantasmCount,
        null,
        `${skill.name} phantasm conversion`,
      );
    }

    if (skill.name === "Mind the Gap") {
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
    if (skill.name === "Signet of the Ether") {
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
    if (skill.name === "Signet of Illusions") {
      for (
        const target of allSkills.filter(candidate =>
          (shatters[candidate.name] || instruments[candidate.name])
          && !SIGNET_ILLUSIONS_RESET_EXCLUSIONS.has(candidate.name))
      ) {
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
        detail: "Shatter/instrument cooldowns reset (excluding Continuum Split and Crescendo)",
      });
    }
    if (skill.name === "Mental Collapse") {
      const mindTheGap = skillsByName.get("Mind the Gap");
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
        state.profession.traitReadyAt.get("Method of Madness") || 0;
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
        state.profession.traitReadyAt.set(
          "Method of Madness",
          at + storm.cooldown,
        );
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
    handleGenericSkill,
  };
}
