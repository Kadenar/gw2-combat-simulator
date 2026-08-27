const GW2_RENDER_HOST = 'render.guildwars2.com';
const BACKUP_ICON_BASE_URL = 'https://www.qjv.dev.br/armory/data/icons';

export const GW2_ICON_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" ' +
  'height="64"%3E%3Crect width="64" height="64" fill="%23232632"/%3E' +
  '%3Cpath d="M17 46L32 13l15 33z" fill="%23a38ad5"/%3E%3C/svg%3E';

export type Gw2IconFallbackStage = 'backup' | 'placeholder';

export interface Gw2IconFallback {
  readonly source: string;
  readonly stage: Gw2IconFallbackStage;
}

/** Returns the backup URL for an ArenaNet render icon, when one can be derived. */
export function gw2BackupIconUrl(source: string): string {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return '';
  }

  if (url.protocol !== 'https:' || url.hostname !== GW2_RENDER_HOST) return '';

  const match = /^\/file\/[^/]+\/(\d+)\.[^/.]+$/i.exec(url.pathname);
  return match ? `${BACKUP_ICON_BASE_URL}/${match[1]}.webp` : '';
}

/** Selects the backup source, followed by the local placeholder. */
export function nextGw2IconFallback(source: string, stage?: Gw2IconFallbackStage): Gw2IconFallback | null {
  if (stage === 'backup') {
    return { source: GW2_ICON_PLACEHOLDER, stage: 'placeholder' };
  }

  if (stage === 'placeholder') return null;

  const backup = gw2BackupIconUrl(source);
  return backup ? { source: backup, stage: 'backup' } : null;
}

const mountedDocuments = new WeakSet<Document>();

/**
 * Retries failed ArenaNet icons through the backup host, then renders a local
 * placeholder. Image errors do not bubble, so this listener uses capture.
 */
export function mountGw2IconFallback(root: Document = document): void {
  if (mountedDocuments.has(root)) return;
  mountedDocuments.add(root);
  root.addEventListener(
    'error',
    (event) => {
      if (typeof HTMLImageElement === 'undefined' || !(event.target instanceof HTMLImageElement)) {
        return;
      }

      const image = event.target;
      const currentStage = image.dataset.gw2IconFallbackStage;
      const stage = currentStage === 'backup' || currentStage === 'placeholder' ? currentStage : undefined;
      const fallback = nextGw2IconFallback(image.currentSrc || image.src, stage);

      if (!fallback) return;

      // Existing target-level error handlers should run only after this chain
      // is exhausted, rather than removing the image after its first failure.
      event.stopPropagation();
      image.dataset.gw2IconFallbackStage = fallback.stage;
      image.src = fallback.source;
    },
    true
  );
}
