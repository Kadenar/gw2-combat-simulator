import type { PatchPreview } from '../platform/gw2/authoring/patches.js';

/**
 * The repository supports one preview at a time. Keep this null until an
 * upcoming patch is intentionally authored; historical notes are not data.
 */
export const activePatchPreview: PatchPreview | null = null;

export default activePatchPreview;
