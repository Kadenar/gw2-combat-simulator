import { bootstrapGameApp } from '#app/bootstrap.js';

// Starts the game and playable content declared by the simulator page after its shared markup is ready.
window.addEventListener('DOMContentLoaded', () => {
  const retryKey = `simulator-startup-retry:${window.location.pathname}`;
  const deadline = Date.now() + 30_000;
  let settled = false;
  const timeout = window.setTimeout(checkStartup, 30_000);
  window.addEventListener('pageshow', checkStartup);
  document.addEventListener('visibilitychange', checkStartup);

  // Background timers may be suspended; check wall-clock time when an unfinished page becomes visible again.
  function checkStartup(): void {
    if (document.visibilityState !== 'hidden' && Date.now() >= deadline) {
      failStartup(new Error('Simulator startup timed out.'));
    }
  }

  function stopWatching(): void {
    settled = true;
    window.clearTimeout(timeout);
    window.removeEventListener('pageshow', checkStartup);
    document.removeEventListener('visibilitychange', checkStartup);
  }

  function clearRetry(): void {
    try {
      sessionStorage.removeItem(retryKey);
    } catch {
      // Recovery remains manual when session storage is unavailable.
    }
  }

  function failStartup(error: unknown): void {
    if (settled) return;
    stopWatching();
    console.error('Simulator startup failed:', error);

    // Reload once to discard failed module caches and partial mounts; persist the limit to prevent reload loops.
    try {
      if (!sessionStorage.getItem(retryKey)) {
        sessionStorage.setItem(retryKey, '1');
        window.location.reload();
        return;
      }
    } catch {
      // Without a durable retry limit, show the manual recovery action instead.
    }

    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;

    const content = document.createElement('div');
    content.className = 'loader-content';
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    message.textContent = 'Unable to start the simulator. Reload to try again.';
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.textContent = 'Reload';
    reload.addEventListener('click', () => {
      clearRetry();
      window.location.reload();
    });
    content.append(message, reload);
    overlay.replaceChildren(content);
    overlay.classList.remove('hidden');
    reload.focus();
  }

  bootstrapGameApp().then(() => {
    stopWatching();
    clearRetry();
  }, failStartup);
});
