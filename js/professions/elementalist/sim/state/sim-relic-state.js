export function createRelicState() {
    return {
        buffUntil: 0,
        aristocracyStacks: 0,
        aristocracyUntil: 0,
        aristocracyLastTrigger: null,
        blightbringerCount: 0,
        blightbringerTrackedCasts: new Set(),
        thiefStacks: 0,
        thiefUntil: 0,
        nourysStacks: 0,
        nourysActiveUntil: 0,
        bloodstoneStacks: 0,
        bloodstoneStacksUntil: 0,
        bloodstoneExplosionUntil: 0,
        thornsStacks: 0,
        thornsReadyAt: 0,
    };
}

export function getRelicState(S) {
    if (!S.relicState) {
        S.relicState = {
            buffUntil: S.relicBuffUntil ?? 0,
            aristocracyStacks: S.relicAristocracyStacks ?? 0,
            aristocracyUntil: S.relicAristocracyUntil ?? 0,
            aristocracyLastTrigger: S.relicAristocracyLastTrigger ?? null,
            blightbringerCount: S.relicBlightbringerCount ?? 0,
            blightbringerTrackedCasts: S.relicBlightbringerTrackedCasts ?? new Set(),
            thiefStacks: S.relicThiefStacks ?? 0,
            thiefUntil: S.relicThiefUntil ?? 0,
            nourysStacks: S.relicNourysStacks ?? 0,
            nourysActiveUntil: S.relicNourysActiveUntil ?? 0,
            bloodstoneStacks: S.relicBloodstoneStacks ?? 0,
            bloodstoneStacksUntil: S.relicBloodstoneStacksUntil ?? 0,
            bloodstoneExplosionUntil: S.relicBloodstoneExplosionUntil ?? 0,
            thornsStacks: S.relicThornsStacks ?? 0,
            thornsReadyAt: S.relicThornsReadyAt ?? 0,
        };
    }
    return S.relicState;
}
