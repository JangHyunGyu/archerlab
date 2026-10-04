(() => {
  'use strict';
  if (document.getElementById('archerlab-account')) return;
  const account = 'https://account.archerlab.dev';
  const ko = document.documentElement.lang.startsWith('ko');
  const copy = ko ? { login: '로그인', member: '계정', logout: '계정 관리 · 로그아웃', unavailable: '로그인 상태를 확인하지 못했어요.' } : { login: 'Sign in', member: 'Account', logout: 'Account · sign out', unavailable: 'We could not check your sign-in.' };
  const host = document.createElement('span'); host.id = 'archerlab-account';
  const shadow = host.attachShadow({ mode: 'open' });
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/_account/widget.css'; shadow.append(css);
  css.addEventListener('load', () => { if (host.hasAttribute('data-corner')) placeCorner(); });
  const trigger = document.createElement('a'); trigger.className = 'trigger';
  const login = new URL('/_account/login', location.origin);
  login.searchParams.set('return', location.pathname + location.search + location.hash); login.searchParams.set('lang', ko ? 'ko' : 'en');
  trigger.href = login.href; trigger.title = copy.login; trigger.setAttribute('aria-label', copy.login);
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('fill', 'none'); icon.setAttribute('stroke', 'currentColor'); icon.setAttribute('stroke-width', '1.6'); icon.setAttribute('aria-hidden', 'true');
  const circle = document.createElementNS(icon.namespaceURI, 'circle'); circle.setAttribute('cx', '12'); circle.setAttribute('cy', '8'); circle.setAttribute('r', '3.5');
  const path = document.createElementNS(icon.namespaceURI, 'path'); path.setAttribute('d', 'M5 21v-2a7 7 0 0 1 14 0v2'); icon.append(circle, path);
  const label = document.createElement('span'); label.className = 'label'; label.textContent = copy.login; trigger.append(icon, label); shadow.append(trigger);
  const menu = document.createElement('div'); menu.className = 'menu'; menu.hidden = true;
  const name = document.createElement('p'); name.className = 'name'; const email = document.createElement('p'); email.className = 'email';
  const manage = document.createElement('a'); manage.href = account + '/?lang=' + (ko ? 'ko' : 'en'); manage.textContent = copy.logout;
  menu.append(name, email, manage); shadow.append(menu);
  const selectors = {
    'archerlab.dev': '.navbar', 'harem.archerlab.dev': '.app__actions', 'golf.archerlab.dev': '.site-nav',
    'itstory.archerlab.dev': '.page__nav', 'cupid.archerlab.dev': '.lang-switch', 'chat.archerlab.dev': '.sidebar-header, .setup-box',
    'karma.archerlab.dev': '.lang-select-wrap', 'chatbot.archerlab.dev': '.app__actions, .header-actions, .header-controls',
    'news.archerlab.dev': 'header nav, .header-actions, header', 'nevergrad.archerlab.dev': '.title-buttons, .title-menu',
    'game.archerlab.dev': '[data-account-slot], .header-actions, .topbar-actions, .game-header__actions'
  };
  function placeCorner() {
    if (!host.hasAttribute('data-corner')) return;
    // These two game headers reserve the right edge for their language control.
    if (location.hostname === 'game.archerlab.dev' && ['jelly-pang-2048', 'cat-tower'].includes(location.pathname.split('/')[1])) {
      host.style.left = 'auto'; host.style.right = 'calc(max(16px, env(safe-area-inset-right)) + 116px)';
      host.style.top = 'max(16px, env(safe-area-inset-top))'; host.style.bottom = 'auto';
      return;
    }
    const obstacles = [...document.querySelectorAll('button,a,input,select,h1,h2,[role="button"]')].filter(element => {
      if (element.closest('[inert], [aria-hidden="true"]')) return false;
      const r = element.getBoundingClientRect();
      if (!r.width || !r.height || r.width > 500 || r.height > 180) return false;
      return typeof element.checkVisibility !== 'function' || element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    }).map(element => element.getBoundingClientRect());
    const positions = [
      ['right', 0, 'top'], ['right', 56, 'top'], ['right', 112, 'top'],
      ['left', 0, 'top'], ['right', 0, 'bottom'], ['left', 0, 'bottom']
    ];
    for (const [side, offset, edge] of positions) {
      host.style.left = side === 'left' ? 'max(16px, env(safe-area-inset-left))' : 'auto';
      host.style.right = side === 'right' ? `calc(max(16px, env(safe-area-inset-right)) + ${offset}px)` : 'auto';
      host.style.top = edge === 'top' ? 'max(16px, env(safe-area-inset-top))' : 'auto';
      host.style.bottom = edge === 'bottom' ? 'max(16px, env(safe-area-inset-bottom))' : 'auto';
      const r = host.getBoundingClientRect();
      if (!obstacles.some(s => r.left < s.right + 6 && r.right > s.left - 6 && r.top < s.bottom + 6 && r.bottom > s.top - 6)) return;
    }
    host.style.left = 'auto'; host.style.right = 'max(16px, env(safe-area-inset-right))';
    host.style.top = 'max(16px, env(safe-area-inset-top))'; host.style.bottom = 'auto';
  }
  function mount() {
    let target = [...document.querySelectorAll(selectors[location.hostname] || 'header')].find(element => element.getBoundingClientRect().width > 0 && getComputedStyle(element).visibility !== 'hidden');
    if (target && location.hostname === 'archerlab.dev') {
      let actions = target.querySelector('[data-account-actions]');
      if (!actions) {
        actions = document.createElement('div'); actions.setAttribute('data-account-actions', '');
        actions.style.cssText = 'display:flex;align-items:center;gap:8px;flex:none';
        const language = target.querySelector('[data-lang-dropdown]');
        if (language) actions.append(language);
        target.append(actions);
      }
      target = actions;
    }
    if (target) {
      if (host.parentElement !== target) target.append(host);
      host.removeAttribute('data-corner');
      host.style.left = ''; host.style.right = ''; host.style.top = ''; host.style.bottom = '';
      // Theme comes from the site's own text color and typography.
      host.style.color = getComputedStyle(target).color;
      return true;
    }
    if (host.parentElement !== document.body) document.body.append(host);
    host.setAttribute('data-corner', 'top');
    const game = location.pathname.split('/')[1];
    const palette = { 'water-sort': ['#fffffff0', '#6b528f'], 'jelly-pang-2048': ['#fffffff0', '#705683'], 'cat-tower': ['#fffaf2ed', '#775f50'], 'lumen-shift': ['#08141bef', '#a2edf2'], 'school-zombie-defense': ['#111710ed', '#dec892'] }[game];
    if (palette) { host.style.setProperty('--account-surface', palette[0]); host.style.setProperty('--account-ink', palette[1]); }
    placeCorner();
    return false;
  }
  mount();
  // Some apps render their toolbar after the initial document loads.
  let pendingMount = false;
  let lastPlacement = 0;
  const observer = new MutationObserver(() => {
    if (pendingMount) return;
    const missing = !host.isConnected || host.getBoundingClientRect().width === 0;
    const reposition = host.hasAttribute('data-corner') && Date.now() - lastPlacement > 1000;
    if (!missing && !reposition) return;
    pendingMount = true; requestAnimationFrame(() => {
      pendingMount = false; lastPlacement = Date.now();
      if (missing) mount(); else placeCorner();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
  window.addEventListener('resize', placeCorner); document.addEventListener('fullscreenchange', placeCorner);
  let member = null;
  function render(user) {
    member = user;
    label.textContent = user ? copy.member : copy.login;
    trigger.title = user ? copy.member : copy.login; trigger.setAttribute('aria-label', trigger.title);
    if (user) { trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', 'account-menu'); menu.id = 'account-menu'; name.textContent = user.name; email.textContent = user.email; }
    else { trigger.removeAttribute('aria-expanded'); menu.hidden = true; }
    if (host.hasAttribute('data-corner')) placeCorner();
    // Consumers can read identity for display. Server permissions must use the HttpOnly session.
    window.dispatchEvent(new CustomEvent('archerlab:session', { detail: user ? { id: user.id, name: user.name } : null }));
  }
  trigger.addEventListener('click', event => {
    if (!member) return;
    event.preventDefault(); menu.hidden = !menu.hidden; trigger.setAttribute('aria-expanded', String(!menu.hidden));
    if (!menu.hidden) {
      menu.style.right = '0';
      menu.style.top = 'calc(100% + 10px)'; menu.style.bottom = 'auto';
      if (menu.getBoundingClientRect().bottom > innerHeight - 12) { menu.style.top = 'auto'; menu.style.bottom = 'calc(100% + 10px)'; }
      const bounds = menu.getBoundingClientRect();
      if (bounds.left < 12) menu.style.right = `${bounds.left - 12}px`;
      else if (bounds.right > innerWidth - 12) menu.style.right = `${bounds.right - innerWidth + 12}px`;
    }
  });
  document.addEventListener('pointerdown', event => { if (!event.composedPath().includes(host)) { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); } });
  shadow.addEventListener('keydown', event => { if (event.key === 'Escape') { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); trigger.focus(); } });
  async function api(base, path, body) {
    const response = await fetch(base + path, { credentials: 'include', cache: 'no-store',
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error('session_unavailable'); return response.json();
  }
  async function synchronize() {
    try {
      const local = await api('', '/_account/session', {});
      if (local.user) { render(local.user); return; }
      const central = await api(account, '/api/status');
      if (!central.user) { render(null); return; }
      const pending = await api('', '/_account/prepare', { csrf: local.csrf, returnPath: location.pathname + location.search + location.hash });
      const ticket = await api(account, '/api/sso', { csrf: central.csrf, request: pending.request });
      await api('', '/_account/complete', { csrf: local.csrf, request: pending.request, code: ticket.code });
      render((await api('', '/_account/session', {})).user);
    } catch { render(null); }
  }
  let checking = false;
  async function refresh() { if (checking) return; checking = true; try { await synchronize(); } finally { checking = false; } }
  void refresh();
  window.addEventListener('pageshow', event => { if (event.persisted) void refresh(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void refresh(); });
})();
