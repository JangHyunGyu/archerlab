(() => {
  'use strict';
  const copy = {
    ko: { login: '로그인', description: '구글 계정이나 이메일로 시작하세요.', google: 'Google로 계속하기', or: '또는 이메일로', email: '이메일', send: '인증번호 받기', passwordless: '비밀번호 없이, 이메일로 받은 번호를 입력하면 돼요.', code: '인증번호', verify: '로그인하기', changeEmail: '다른 이메일 사용', resend: '다시 받기', expires: '인증번호는 10분 동안 유효해요.', continue: '서비스로 돌아가기', logout: '모든 서비스에서 로그아웃', guest: '로그인 없이 계속하기 ↗', privacy: '계정 개인정보 안내', help: '도움이 필요하신가요?', unavailable: '로그인을 준비하고 있어요. 잠시 후 다시 방문해 주세요.', pending: '계정을 연결하려면 이 이메일로 인증번호를 받아 주세요.', sent: '이메일을 확인해 주세요. 메일이 보이지 않으면 스팸함도 확인해 주세요.', waiting: '잠시만 기다려 주세요.', invalid_email: '이메일 주소를 확인해 주세요.', code_invalid: '인증번호가 올바르지 않거나 만료됐어요. 다시 확인해 주세요.', rate_limited: '요청이 많아요. 잠시 후 다시 시도해 주세요.', email_unavailable: '인증메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.', google_unavailable: '지금은 구글 로그인을 사용할 수 없어요.', google_invalid: '구글 로그인 확인을 마치지 못했어요. 다시 시도해 주세요.', google_cancelled: '구글 로그인을 취소했어요.', request_expired: '로그인 요청이 만료됐어요. 이용하던 서비스에서 다시 로그인해 주세요.', generic: '연결을 확인한 뒤 다시 시도해 주세요.', loggedOut: '연결된 서비스에서 로그아웃했어요.' },
    en: { login: 'Sign in', description: 'Start with Google or your email address.', google: 'Continue with Google', or: 'or use your email', email: 'Email', send: 'Send a login code', passwordless: 'No password needed. Enter the code sent to your email.', code: 'Login code', verify: 'Sign in', changeEmail: 'Use another email', resend: 'Send again', expires: 'Your code is valid for 10 minutes.', continue: 'Back to your service', logout: 'Sign out of all services', guest: 'Continue as a guest ↗', privacy: 'Account privacy', help: 'Need a hand?', unavailable: 'Sign-in will be available soon. Please check back later.', pending: 'Verify this email address to connect your account.', sent: 'Check your inbox. If the email is missing, check your spam folder.', waiting: 'Please wait.', invalid_email: 'Check your email address.', code_invalid: 'This code is incorrect or has expired. Please check it again.', rate_limited: 'Too many requests. Please try again later.', email_unavailable: 'We could not send your code. Please try again later.', google_unavailable: 'Google sign-in is currently unavailable.', google_invalid: 'We could not verify your Google sign-in. Please try again.', google_cancelled: 'Google sign-in was cancelled.', request_expired: 'This request has expired. Start sign-in again from your service.', generic: 'Check your connection and try again.', loggedOut: 'You are signed out of the connected services.' }
  };
  const $ = id => document.getElementById(id);
  const accountCopy = {
    ko: { title: '내 계정', description: 'ArcherLab에서 사용 중인 계정이에요.' },
    en: { title: 'My account', description: 'Your account for ArcherLab services.' }
  };
  const params = new URLSearchParams(location.search);
  let language = params.get('lang') || (navigator.language.startsWith('ko') ? 'ko' : 'en');
  if (!Object.hasOwn(copy, language)) language = 'en';
  let state; let challenge; let resendAt = 0; let busy = false;
  function translate() {
    document.documentElement.lang = language;
    for (const element of document.querySelectorAll('[data-i18n]')) {
      const value = copy[language][element.dataset.i18n];
      element.textContent = value;
    }
    $('language').textContent = language === 'ko' ? 'EN' : '한국어';
    if (state?.user) {
      $('form-title').textContent = accountCopy[language].title;
      document.querySelector('.form-description').textContent = accountCopy[language].description;
    }
  }
  function notice(text, error = false) {
    $('notice').textContent = text; $('notice').hidden = !text;
    $('notice').toggleAttribute('data-error', error);
  }
  async function api(path, body) {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store',
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, csrf: state.csrf }) } : {}) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'generic');
    return result;
  }
  async function action(callback) {
    if (busy) return;
    busy = true; document.querySelector('.form-panel').setAttribute('aria-busy', 'true');
    const active = document.activeElement;
    try { await callback(); }
    catch (error) { notice(copy[language][error.message] || copy[language].generic, true); }
    finally { busy = false; document.querySelector('.form-panel').removeAttribute('aria-busy'); if (active?.isConnected) active.focus(); }
  }
  function go(url) {
    const target = new URL(url);
    const approved = target.origin === 'https://account.archerlab.dev' || target.origin === 'https://accounts.google.com' ||
      state?.target?.origin === target.origin;
    if (!approved) throw new Error('generic');
    location.assign(target.href);
  }
  async function load() {
    state = await api('/api/status' + (params.get('request') ? '?request=' + encodeURIComponent(params.get('request')) : ''));
    $('google').disabled = !state.providers.google;
    $('send').disabled = !state.providers.email;
    $('email').disabled = !state.providers.email;
    $('signed-in').hidden = !state.user; $('sign-in').hidden = Boolean(state.user);
    if (state.user) { $('member-name').textContent = state.user.name; $('member-email').textContent = state.user.email; }
    if (state.target) { $('service-name').textContent = state.target.name; $('guest').href = state.target.returnUrl; }
    if (state.pendingEmail) { $('email').value = state.pendingEmail; notice(copy[language].pending); }
    else if (!state.user && !state.providers.google && !state.providers.email) notice(copy[language].unavailable);
    translate();
  }
  async function send() {
    if (Date.now() < resendAt) return;
    const result = await api('/api/email/start', { email: $('email').value, request: params.get('request'), lang: language });
    challenge = result.challenge; resendAt = Date.now() + 60000;
    $('email-form').hidden = true; $('code-form').hidden = false;
    $('sent-to').textContent = $('email').value; $('code').value = ''; $('code').focus();
    notice(copy[language].sent);
  }
  $('language').addEventListener('click', () => { language = language === 'ko' ? 'en' : 'ko'; translate(); });
  $('email-form').addEventListener('submit', event => { event.preventDefault(); void action(send); });
  $('resend').addEventListener('click', () => void action(send));
  $('change-email').addEventListener('click', () => { $('email-form').hidden = false; $('code-form').hidden = true; challenge = null; notice(''); $('email').focus(); });
  $('code-form').addEventListener('submit', event => { event.preventDefault(); void action(async () => go((await api('/api/email/verify', { code: $('code').value, challenge })).redirect)); });
  $('google').addEventListener('click', () => void action(async () => go((await api('/auth/google/start', { request: params.get('request') })).redirect)));
  $('logout').addEventListener('click', () => void action(async () => { await api('/api/logout', {}); await load(); notice(copy[language].loggedOut); }));
  $('continue').addEventListener('click', () => location.assign(state?.target?.returnUrl || 'https://archerlab.dev/'));
  setInterval(() => { const remaining = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)); $('resend').disabled = busy || remaining > 0; $('resend').textContent = copy[language].resend + (remaining ? ` (${remaining}s)` : ''); }, 1000);
  translate(); void action(async () => { await load(); if (params.get('error')) notice(copy[language][params.get('error')] || copy[language].generic, true); });
})();
