// File I/O utilities for import/export of builds and rotations.

/**
 * Downloads a value as pretty-printed JSON using a temporary object URL.
 *
 * @param {string} filename Name assigned to the downloaded file.
 * @param {*} payload JSON-serializable value to download.
 * @returns {void}
 */
export function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

/**
 * Reads a browser `File` as text and parses it as JSON.
 *
 * @param {File} file File selected from an input element.
 * @returns {Promise<*>} Parsed JSON value.
 * @throws {Error} Rejects when the file cannot be read or contains invalid JSON.
 */
export function readJsonFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                resolve(JSON.parse(reader.result));
            } catch (error) {
                reject(new Error(`Invalid JSON: ${error.message}`));
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

/**
 * Fetches and parses a JSON asset, bypassing the browser cache.
 *
 * @param {string} path Asset URL.
 * @param {Object} [options]
 * @param {boolean} [options.optional=false] Return `null` instead of throwing
 * when the server responds with a non-success status.
 * @returns {Promise<* | null>} Parsed JSON, or `null` for a missing optional asset.
 * @throws {Error} When a required asset cannot be loaded or the response is not
 * valid JSON.
 */
export async function fetchJsonAsset(path, { optional = false } = {}) {
    const response = await fetch(`${path}?t=${Date.now()}`);
    if (!response.ok) {
        if (optional) return null;
        throw new Error(`Could not load ${path}`);
    }
    return response.json();
}

/**
 * Extracts rotation items from either a bare array or a wrapped rotation payload.
 *
 * @param {*[] | {rotation?: *[]} | null | undefined} payload Imported rotation data.
 * @returns {*[] | undefined} Rotation items when present.
 */
export function getRotationItems(payload) {
    return Array.isArray(payload) ? payload : payload?.rotation;
}

/**
 * Creates an exportable build payload without its rotation.
 *
 * @param {Object} build Build state to export.
 * @returns {Object} Shallow copy of the build without the `rotation` property.
 */
export function getBuildExportPayload(build) {
    const { rotation: _rotation, ...payload } = build;
    return payload;
}

/**
 * Loads a preset's required build and optional rotation assets.
 *
 * A missing optional rotation or a rotation payload without an array is ignored.
 * Other loading and parsing failures are propagated.
 *
 * @param {{build: string, rotation?: string}} preset Preset asset paths.
 * @returns {Promise<{buildData: *, rotationItems: (*[] | undefined)}>} Loaded
 * build data and any valid rotation items.
 */
export async function loadPresetBundle(preset) {
    const buildData = await fetchJsonAsset(preset.build);
    let rotationItems;
    if (preset.rotation) {
        const rotationData = await fetchJsonAsset(preset.rotation, { optional: true });
        const items = getRotationItems(rotationData);
        if (Array.isArray(items)) rotationItems = items;
    }
    return { buildData, rotationItems };
}
