export const ACCOUNT = 'https://account.archerlab.dev';
export const SESSIONS = 'https://sessions.archerlab.dev';

// Only projects linked from the hub. Separate domains and unlisted games stay out.
export const SERVICES = Object.freeze({
  'archerlab.dev': 'ArcherLab',
  'game.archerlab.dev': 'ArcherLab Games',
  'nevergrad.archerlab.dev': 'Nevergrad',
  'karma.archerlab.dev': 'Karma',
  'harem.archerlab.dev': 'Harem Mate',
  'cupid.archerlab.dev': 'Cupid',
  'chatbot.archerlab.dev': 'Mate',
  'golf.archerlab.dev': 'Golf Swing Master',
  'itstory.archerlab.dev': 'IT Story',
  'news.archerlab.dev': 'HN Top 10',
  'chat.archerlab.dev': 'Chat'
});
export const GAMES = Object.freeze([
  'water-sort', 'lumen-shift', 'jelly-pang-2048', 'school-zombie-defense',
  'jewelria', 'parking-escape', 'cat-tower', 'slimevolley', 'blockpang', 'solo-leveling'
]);

/** @param {URL} url */
export function registered(url) {
  return url.protocol === 'https:' && !url.port && Object.hasOwn(SERVICES, url.hostname);
}
/** @param {URL} url */
export function linkedPage(url) {
  if (!registered(url)) return false;
  if (url.hostname !== 'game.archerlab.dev') return true;
  return GAMES.some(game => url.pathname.startsWith(`/${game}/`) || url.pathname === `/${game}`);
}
/** @param {string} path @param {string} origin */
export function returnPath(path, origin) {
  if (/[\\\x00-\x1f\x7f]/.test(path)) throw new Error('invalid_return');
  const url = new URL(path, origin);
  if (url.origin !== origin || !linkedPage(url) || url.pathname.startsWith('/_account/')) {
    throw new Error('invalid_return');
  }
  // The stored path is never interpreted as a second URL during the redirect.
  return url.pathname + url.search + url.hash;
}
