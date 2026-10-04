(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const code = params.get('code'); const request = params.get('request');
  // Remove short-lived credentials from history before loading any other page.
  history.replaceState(null, '', '/_account/callback');
  const ko = navigator.language.startsWith('ko'); document.documentElement.lang = ko ? 'ko' : 'en';
  const status = document.getElementById('status');
  status.textContent = ko ? '로그인을 연결하고 있어요.' : 'Connecting your sign-in.';
  async function post(path, body) {
    const response = await fetch(path, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error('failed'); return response.json();
  }
  async function complete() {
    try {
      if (!/^[A-Za-z0-9_-]{43}$/.test(code || '') || !/^[A-Za-z0-9_-]{43}$/.test(request || '')) throw new Error('invalid');
      const local = await post('/_account/session', {});
      const result = await post('/_account/complete', { csrf: local.csrf, request, code });
      const target = new URL(result.returnPath, location.origin);
      if (target.origin !== location.origin) throw new Error('invalid');
      location.replace(target.href);
    } catch {
      status.textContent = ko ? '로그인을 다시 시작해 주세요.' : 'Please start sign-in again.';
      const help = document.getElementById('help'); help.hidden = false;
      help.textContent = ko ? '요청이 만료됐거나 다른 브라우저에서 열렸어요. 이용하던 서비스에서 다시 로그인해 주세요.' : 'This request expired or was opened in a different browser. Start sign-in again from your service.';
    }
  }
  void complete();
})();
