/**
 * Validates and schedules player casts, then delegates their effects.
 */
export function createCastController({
  state,
  config,
  traits,
  horizon,
  warnings,
  rules,
  cooldowns,
  actions,
}) {
  const {
    ambushAttacks,
    aristocracySkills,
    autoattackChains,
    autoattackChainPositions,
    blindSkills,
    controlSkills,
    epsilon,
    flipSkillsByParent,
    instruments,
    peithaSkills,
    shatters,
    traitDamage,
    adjustedCooldown,
    skillAvailable,
    skillsByName,
  } = rules;
  const {
    ammoMaximum,
    ensureAmmo,
    refreshAmmo,
  } = cooldowns;
  const {
    activePrimaryWeapon,
    advanceTo,
    consumeResources,
    executePlayerAmbush,
    grantMirageCloak,
    handleContinuumSplit,
    handleCrescendo,
    handleGenericSkill,
    handleInstrument,
    handleMiragePostSkill,
    handleMirageShatter,
    handleShatter,
    queueResources,
    restoreContinuum,
    addEvent,
    addDamage,
    addTraitProc,
    currentResource,
  } = actions;

  const updateAutoattackChains = (skill, baseActivation) => {
    const position = autoattackChainPositions.get(skill.name);
    if (position) {
      for (const root of state.profession.autoattackChains.keys()) {
        if (root !== position.root) state.profession.autoattackChains.delete(root);
      }
      const chain = autoattackChains[position.root];
      const next = chain[(position.index + 1) % chain.length];
      if (next === position.root) {
        state.profession.autoattackChains.delete(position.root);
      } else {
        state.profession.autoattackChains.set(position.root, next);
      }
      return;
    }
    if (skill.id === -3) {
      state.profession.autoattackChains.clear();
      return;
    }
    if (baseActivation > 0) {
      for (const root of state.profession.autoattackChains.keys()) {
        const preserveScepterChain =
          root === "Ether Bolt" && skill.type === "Weapon";
        if (!preserveScepterChain) state.profession.autoattackChains.delete(root);
      }
    }
  };

  const cast = (skill) => {
    advanceTo(state.time);
    if (!skillAvailable(skill, config)) {
      warnings.push(`${skill.name} is unavailable for this build.`);
      return false;
    }
    if (skill.ambush) {
      const activeAmbush = ambushAttacks[activePrimaryWeapon()];
      if (
        !activeAmbush
        || activeAmbush.name !== skill.name
        || !state.profession.ambushSource
        || state.profession.ambushUntil <= state.time + epsilon
      ) {
        warnings.push(
          `${skill.name} skipped at ${state.time.toFixed(2)}s: no active Mirage Cloak ambush window.`,
        );
        return false;
      }
    }

    const chainPosition = autoattackChainPositions.get(skill.name);
    if (chainPosition) {
      const expected =
        state.profession.autoattackChains.get(chainPosition.root) || chainPosition.root;
      if (skill.name !== expected) {
        warnings.push(
          `${skill.name} skipped at ${state.time.toFixed(2)}s: cast ${expected} first.`,
        );
        return false;
      }
    }

    if (skill.flipParent) {
      const activeFlip = state.profession.availableFlips.get(skill.name);
      if (!activeFlip || activeFlip.expiresAt < state.time - epsilon) {
        warnings.push(
          `${skill.name} skipped at ${state.time.toFixed(2)}s: ${skill.flipParent} is not active.`,
        );
        return false;
      }
      if (activeFlip.availableAt > state.time + epsilon) {
        if (!config.autoWaitForCooldowns) {
          warnings.push(
            `${skill.name} skipped at ${state.time.toFixed(2)}s: available at ${activeFlip.availableAt.toFixed(2)}s.`,
          );
          return false;
        }
        state.time = activeFlip.availableAt;
        advanceTo(state.time);
      }
    }

    if (shatters[skill.name]?.kind.startsWith("blade") && currentResource() < 1) {
      warnings.push(
        `${skill.name} skipped at ${state.time.toFixed(2)}s: no blades.`,
      );
      return false;
    }

    let ammo = refreshAmmo(skill, state.time);
    let readyAt = ammo && ammo.charges === 0
      ? ammo.nextRechargeAt
      : state.cooldowns.get(skill.id) || 0;
    if (readyAt > state.time + epsilon) {
      if (!config.autoWaitForCooldowns) {
        warnings.push(
          `${skill.name} skipped at ${state.time.toFixed(2)}s: ready at ${readyAt.toFixed(2)}s.`,
        );
        return false;
      }
      if (state.profession.continuum?.expiresAt < readyAt) {
        state.time = state.profession.continuum.expiresAt;
        advanceTo(state.time);
        readyAt = state.cooldowns.get(skill.id) || state.time;
      }
      state.time = Math.max(state.time, readyAt);
      advanceTo(state.time);
      ammo = refreshAmmo(skill, state.time);
    }
    if (
      skill.ambush
      && (!state.profession.ambushSource || state.profession.ambushUntil <= state.time + epsilon)
    ) {
      warnings.push(
        `${skill.name} skipped: its ambush window expired before the skill recharged.`,
      );
      return false;
    }
    if (state.time >= horizon - epsilon) return false;

    const start = state.time;
    const quickness = config.boons?.quickness ? 1.5 : 1;
    const baseActivation = Number(
      skill.activation ?? (skill.id < 0 ? 0 : 0.5),
    );
    const activation = baseActivation / quickness;
    const end = Math.min(horizon, start + Math.max(0.05, activation));
    const castEnd = activation > 0 ? end : start;
    const shatterSpent =
      shatters[skill.name] && shatters[skill.name].kind !== "continuum"
        ? consumeResources(start)
        : null;
    state.time = end;
    advanceTo(end);
    state.skillUses.set(skill.id, (state.skillUses.get(skill.id) || 0) + 1);

    const cooldown = adjustedCooldown(skill, config);
    if (ammo) {
      ammo.charges -= 1;
      if (ammo.nextRechargeAt == null) {
        ammo.nextRechargeAt = castEnd + ammo.rechargeDuration;
      }
      refreshAmmo(skill, castEnd);
    } else if (cooldown) {
      state.cooldowns.set(skill.id, castEnd + cooldown);
    }
    addEvent({
      type: "action",
      at: start,
      endsAt: end,
      name: skill.name,
      skillId: skill.id,
      rechargeReadyAt: state.cooldowns.get(skill.id) ?? null,
    });
    updateAutoattackChains(skill, baseActivation);

    if (skill.id === -3) {
      state.activeWeaponSet = state.activeWeaponSet === 1 ? 2 : 1;
      addEvent({
        type: "weapon_set",
        at: end,
        weaponSet: state.activeWeaponSet,
      });
      return true;
    }
    if (skill.id === -4) {
      if (state.profession.continuum) {
        restoreContinuum(end, "manual shift");
      } else {
        warnings.push(
          `Continuum Shift skipped at ${end.toFixed(2)}s: no active split.`,
        );
      }
      return true;
    }
    if (skill.id === -1) {
      grantMirageCloak(end, skill.name);
      if (traits.has("Deceptive Evasion")) {
        queueResources(
          end + epsilon,
          1,
          activePrimaryWeapon(),
          "Deceptive Evasion",
        );
      }
      return true;
    }

    let clarityConsumed = false;
    if (skill.ambush) {
      executePlayerAmbush(skill, end);
    } else if (skill.name === "Continuum Split") {
      handleContinuumSplit(skill, end);
    } else if (shatters[skill.name]) {
      handleShatter(skill, end, shatterSpent);
      handleMirageShatter(skill, end, shatterSpent);
    } else if (instruments[skill.name]) {
      handleInstrument(skill, end);
    } else if (skill.name === "Crescendo") {
      handleCrescendo(skill, end);
    } else {
      clarityConsumed = handleGenericSkill(skill, end, start);
      handleMiragePostSkill(skill, end);
      const armedFlip = flipSkillsByParent.get(skill.name);
      if (armedFlip && ammoMaximum(armedFlip)) {
        state.profession.availableFlips.set(armedFlip.name, {
          availableAt: end,
          expiresAt: Infinity,
        });
        state.ammo.delete(armedFlip.id);
        state.cooldowns.delete(armedFlip.id);
        ensureAmmo(armedFlip);
      } else if (armedFlip) {
        const flip = {
          availableAt: start + Number(armedFlip.flipDelay || 0),
          expiresAt: start + Number(armedFlip.flipDuration || 0),
        };
        if (flip.expiresAt >= end - epsilon) {
          state.profession.availableFlips.set(armedFlip.name, flip);
          if (armedFlip.name === "Counterspell") {
            state.profession.counterspellAvailable = true;
          }
        }
      }
      if (skill.flipParent) {
        const flipAmmo = state.ammo.get(skill.id);
        if (flipAmmo && flipAmmo.maximum) {
          if (flipAmmo.charges <= 0) {
            state.profession.availableFlips.delete(skill.name);
            state.ammo.delete(skill.id);
            state.cooldowns.delete(skill.id);
          }
        } else {
          state.profession.availableFlips.delete(skill.name);
        }
        if (skill.name === "Counterspell") {
          state.profession.counterspellAvailable = false;
        }
        if (skill.parentCooldownIncrease) {
          const parent = skillsByName.get(skill.flipParent);
          const parentReadyAt = parent
            ? state.cooldowns.get(parent.id)
            : null;
          if (parent && parentReadyAt != null) {
            state.cooldowns.set(
              parent.id,
              parentReadyAt
                + adjustedCooldown(parent, config)
                  * Number(skill.parentCooldownIncrease),
            );
          }
        }
      }
    }
    const disabled =
      controlSkills.has(skill.name)
      || (skill.name === "Mental Collapse" && clarityConsumed);
    if (disabled) {
      addEvent({ type: "control", at: end, skillName: skill.name });
      if (traits.has("Syncopate")) {
        const damage = traitDamage.Syncopate;
        addDamage(
          {
            name: "Syncopate",
            weapon: "Utility",
            blade: false,
          },
          end,
          {
            coefficient: damage.coefficient,
            hits: damage.hits,
            source: "Player",
            weapon: "utility",
          },
        );
        addTraitProc("Syncopate", end, skill.name);
      }
    }
    if (blindSkills.has(skill.name)) {
      addEvent({ type: "blind", at: end, skillName: skill.name });
    }
    if (
      aristocracySkills.has(skill.name)
      || (controlSkills.has(skill.name) && traits.has("Dazzling"))
    ) {
      addEvent({
        type: "weakness_vulnerability",
        at: end,
        skillName: skill.name,
      });
    }
    if (peithaSkills.has(skill.name)) {
      addEvent({ type: "peitha", at: end, skillName: skill.name });
    }
    return true;
  };

  return {
    cast,
  };
}
