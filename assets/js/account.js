(() => {
  'use strict';

  // This entry point also works when the site's DNS does not use the gateway.
  function initialize() {
    const link = document.querySelector('[data-account-link]');
    if (!link) return;
    const label = link.querySelector('[data-account-label]');
    const korean = document.documentElement.lang.startsWith('ko');
    let checking = false;

    async function refresh() {
      if (checking || document.getElementById('archerlab-account')) return;
      checking = true;
      try {
        const response = await fetch('https://account.archerlab.dev/api/status', {
          credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(8000)
        });
        if (!response.ok) return;
        const status = await response.json();
        label.textContent = status.user ? (korean ? '내 계정' : 'My account') : (korean ? '로그인' : 'Sign in');
        link.setAttribute('aria-label', label.textContent);
      } catch {
        // The static link remains available if the status request cannot complete.
      } finally {
        checking = false;
      }
    }

    void refresh();
    window.addEventListener('pageshow', event => { if (event.persisted) void refresh(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void refresh(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
