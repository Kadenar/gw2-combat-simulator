export function buildCastWindow(ctx, sk, startTime = ctx.S.t) {
    const csvCastMs = Math.round((sk.castTime || 0) * 1000);
    const { castMs, scaleOff } = ctx.adjustCastTime(csvCastMs, startTime, {
        ignoreQuickness: sk.type === 'Dodge',
    });
    return {
        castMs,
        scaleOff,
        start: startTime,
        end: startTime + castMs,
    };
}

export function runConcurrentSteps(ctx, concurrents, {
    anchorTime,
    restoreTime = anchorTime,
    clampToAnchor = false,
}) {
    const { S } = ctx;
    if (!concurrents.length) return;

    const anchorRi = S._ri;
    const orderedConcurrents = [...concurrents].sort((a, b) =>
        (a.offset || 0) - (b.offset || 0) || (a._ri || 0) - (b._ri || 0)
    );
    for (const c of orderedConcurrents) {
        const fireAt = anchorTime + (c.offset || 0);
        ctx.setTime(clampToAnchor ? Math.max(fireAt, anchorTime) : fireAt);
        S._ri = c._ri;
        ctx.runStep(c.name, true, [], { interruptMs: c.interruptMs });
    }
    S._ri = anchorRi;
    ctx.setTime(restoreTime);
}
