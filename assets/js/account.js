(() => {
  'use strict';

  function initials(name) {
    const graphemes = text => typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), part => part.segment)
      : Array.from(text);
    const words = name.trim().split(/\s+/u);
    const first = graphemes(words[0])[0] || 'A';
    const last = words.length > 1 ? graphemes(words.at(-1))[0] : '';
    const letters = /^\p{Script=Latin}\p{Mark}*$/u;
    const text = first + (letters.test(first) && letters.test(last) ? last : '');
    return graphemes(text.toLocaleUpperCase()).slice(0, 2).join('');
  }

  // This entry point also works when the site's DNS does not use the gateway.
  function initialize() {
    const link = document.querySelector('[data-account-link]');
    if (!link) return;
    const label = link.querySelector('[data-account-label]');
    const avatar = link.querySelector('[data-account-avatar]');
    const korean = document.documentElement.lang.startsWith('ko');
    let checking = false;

    async function refresh() {
      if (checking) return;
      checking = true;
      try {
        const response = await fetch('https://account.archerlab.dev/api/status', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
          credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(8000)
        });
        if (!response.ok) return;
        const status = await response.json();
        const accountLabel = status.user ? (korean ? '내 계정' : 'My account') : (korean ? '로그인' : 'Sign in');
        const name = status.user?.name?.trim() || 'ArcherLab';
        label.textContent = accountLabel;
        link.setAttribute('aria-label', accountLabel);
        link.title = status.user ? `${accountLabel} · ${name}` : accountLabel;
        link.dataset.accountState = status.user ? 'member' : 'guest';
        if (avatar) {
          avatar.textContent = status.user ? initials(name) : '';
          avatar.hidden = !status.user;
        }
        window.dispatchEvent(new CustomEvent('archerlab:session', {
          detail: status.user ? { id: status.user.id, name: status.user.name } : null
        }));
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
