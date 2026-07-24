export const ROTATION_COMMAND_TYPES = Object.freeze({
    STEP: 'step',
    CONCURRENT_STANDALONE: 'concurrent_standalone',
});

function normalizeConcurrentOffsetMs(offset) {
    return Math.max(1, offset ?? 0);
}

export function isRawConcurrentRotationItem(item) {
    return typeof item === 'object' && item !== null && item.offset !== undefined;
}

export function buildConcurrentCommand(item, ri) {
    return {
        type: ROTATION_COMMAND_TYPES.CONCURRENT_STANDALONE,
        ri,
        name: item?.name,
        offset: normalizeConcurrentOffsetMs(item?.offset),
        interruptMs: item?.interruptMs,
    };
}

export function buildStepCommand(item, ri, concurrents = []) {
    const isObjectItem = typeof item === 'object' && item !== null;
    return {
        type: ROTATION_COMMAND_TYPES.STEP,
        ri,
        name: isObjectItem ? item.name : item,
        gapFill: !!(isObjectItem && item.gapFill),
        interruptMs: isObjectItem ? item.interruptMs : undefined,
        waitMs: isObjectItem ? item.waitMs : undefined,
        concurrents,
    };
}

export function normalizeRotationCommands(rotation = []) {
    const commands = [];
    let ri = 0;

    while (ri < rotation.length) {
        const item = rotation[ri];

        if (isRawConcurrentRotationItem(item)) {
            commands.push(buildConcurrentCommand(item, ri));
            ri++;
            continue;
        }

        const concurrents = [];
        let nextIndex = ri + 1;
        while (nextIndex < rotation.length) {
            const nextItem = rotation[nextIndex];
            if (!isRawConcurrentRotationItem(nextItem)) break;
            concurrents.push({
                name: nextItem.name,
                offset: normalizeConcurrentOffsetMs(nextItem.offset),
                interruptMs: nextItem.interruptMs,
                _ri: nextIndex,
            });
            nextIndex++;
        }

        commands.push(buildStepCommand(item, ri, concurrents));
        ri = nextIndex;
    }

    return commands;
}
