export function createCatalystState(eliteSpec, catalystEnergyMax) {
    return {
        energy: eliteSpec === 'Catalyst' ? catalystEnergyMax : null,
        sphereActiveUntil: 0,
        sphereWindows: [],
        sphereExpiry: { Fire: 0, Water: 0, Air: 0, Earth: 0 },
    };
}

export function createEvokerState(
    eliteSpec,
    startEvokerElement,
    startEvokerCharges = 6,
    startEvokerEmpowered = 0,
) {
    return {
        element: (eliteSpec === 'Evoker' && startEvokerElement) ? startEvokerElement : null,
        charges: eliteSpec === 'Evoker' ? Math.max(0, Math.min(6, startEvokerCharges)) : 0,
        empowered: eliteSpec === 'Evoker' ? Math.max(0, Math.min(3, startEvokerEmpowered)) : 0,
        igniteStep: 0,
        igniteLastUse: -Infinity,
        elemBalanceCount: 0,
        elemBalanceActive: false,
        elemBalanceExpiry: 0,
        elemBalanceActivatedAt: -Infinity,
    };
}

export function getCatalystState(S) {
    if (!S.catalystState) {
        S.catalystState = {
            energy: S.energy ?? null,
            sphereActiveUntil: S.sphereActiveUntil ?? 0,
            sphereWindows: S.sphereWindows ?? [],
            sphereExpiry: S.sphereExpiry ?? { Fire: 0, Water: 0, Air: 0, Earth: 0 },
        };
    }
    return S.catalystState;
}

export function getEvokerState(S) {
    if (!S.evokerState) {
        S.evokerState = {
            element: S.evokerElement ?? null,
            charges: S.evokerCharges ?? 0,
            empowered: S.evokerEmpowered ?? 0,
            igniteStep: S.igniteStep ?? 0,
            igniteLastUse: S.igniteLastUse ?? -Infinity,
            elemBalanceCount: S.elemBalanceCount ?? 0,
            elemBalanceActive: S.elemBalanceActive ?? false,
            elemBalanceExpiry: S.elemBalanceExpiry ?? 0,
            elemBalanceActivatedAt: S.elemBalanceActivatedAt ?? -Infinity,
        };
    }
    return S.evokerState;
}

export function addCatalystEnergy(S, amount, maxEnergy) {
    const catalystState = getCatalystState(S);
    if (catalystState.energy === null) return null;
    catalystState.energy = Math.min(maxEnergy, catalystState.energy + amount);
    return catalystState.energy;
}

export function spendCatalystEnergy(S, amount) {
    const catalystState = getCatalystState(S);
    if (catalystState.energy === null) return null;
    catalystState.energy = Math.max(0, catalystState.energy - amount);
    return catalystState.energy;
}

export function activateCatalystSphere(S, attunement, startTime, durationMs) {
    const catalystState = getCatalystState(S);
    catalystState.sphereActiveUntil = Math.max(catalystState.sphereActiveUntil, startTime + durationMs);
    catalystState.sphereExpiry[attunement] = Math.max(catalystState.sphereExpiry[attunement] || 0, startTime + durationMs);
    catalystState.sphereWindows.push({ start: startTime, end: startTime + durationMs });
    return catalystState.sphereActiveUntil;
}

export function incrementEvokerElemBalance(S, time, {
    activateEvery = 2,
    durationMs = 5000,
} = {}) {
    const evokerState = getEvokerState(S);
    if (evokerState.elemBalanceExpiry <= time) {
        evokerState.elemBalanceActive = false;
    }
    evokerState.elemBalanceCount++;
    let activated = false;
    if (evokerState.elemBalanceCount % activateEvery === 0) {
        evokerState.elemBalanceActive = true;
        evokerState.elemBalanceExpiry = time + durationMs;
        evokerState.elemBalanceActivatedAt = time;
        activated = true;
    }
    return {
        count: evokerState.elemBalanceCount,
        activated,
    };
}

export function consumeEvokerElemBalance(S) {
    const evokerState = getEvokerState(S);
    evokerState.elemBalanceActive = false;
    evokerState.elemBalanceExpiry = 0;
    evokerState.elemBalanceActivatedAt = -Infinity;
    return false;
}

export function addEvokerCharges(S, amount, maxCharges) {
    const evokerState = getEvokerState(S);
    evokerState.charges = Math.min(maxCharges, evokerState.charges + amount);
    return evokerState.charges;
}

export function setEvokerCharges(S, charges) {
    const evokerState = getEvokerState(S);
    evokerState.charges = charges;
    return evokerState.charges;
}

export function addEvokerEmpowered(S, amount, maxEmpowered = Infinity) {
    const evokerState = getEvokerState(S);
    evokerState.empowered = Math.min(maxEmpowered, evokerState.empowered + amount);
    return evokerState.empowered;
}

export function setEvokerEmpowered(S, empowered) {
    const evokerState = getEvokerState(S);
    evokerState.empowered = empowered;
    return evokerState.empowered;
}

export function consumeEvokerIgniteTier(S, time, {
    staleAfterMs = 15000,
    maxTier = 3,
} = {}) {
    const evokerState = getEvokerState(S);
    if (time - evokerState.igniteLastUse > staleAfterMs) evokerState.igniteStep = 0;
    const tier = Math.min(evokerState.igniteStep, maxTier);
    evokerState.igniteStep = Math.min(tier + 1, maxTier);
    evokerState.igniteLastUse = time;
    return tier;
}
