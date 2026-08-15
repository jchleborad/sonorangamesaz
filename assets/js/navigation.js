const PLAYER_TOKEN_STORAGE_KEY = 'sonoran-games:player-token';

function getSavedPlayerToken() {
  try {
    return window.localStorage.getItem(PLAYER_TOKEN_STORAGE_KEY) || '';
  } catch (error) {
    return '';
  }
}

function updatePicksLinks(playerToken = getSavedPlayerToken()) {
  if (!playerToken) return;

  document.querySelectorAll('a[href="/picks.html"], a[href^="/picks.html?"]').forEach(link => {
    const url = new URL(link.href, window.location.origin);
    url.searchParams.set('player', playerToken);
    link.href = `${url.pathname}${url.search}`;
  });
}

window.SonoranPlayerAccess = {
  saveToken(playerToken) {
    if (!playerToken) return;

    try {
      window.localStorage.setItem(PLAYER_TOKEN_STORAGE_KEY, playerToken);
    } catch (error) {
      // Token persistence is a convenience feature.
      // A storage failure must never prevent Picks from working.
    }

    updatePicksLinks(playerToken);
  },

  getToken() {
    return getSavedPlayerToken();
  },

  clearToken() {
    try {
      window.localStorage.removeItem(PLAYER_TOKEN_STORAGE_KEY);
    } catch (error) {
      // No action required.
    }
  },

  updatePicksLinks
};

updatePicksLinks();

const navToggle = document.querySelector('[data-nav-toggle]');
const navLinks = document.querySelector('[data-nav-links]');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
}