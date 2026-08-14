(() => {
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycbw9dkf50_ofoiG4K00IYWNn_Tf61cBOst67vw26h7ZhSajNHbyT3H5oNqV_va31GpKzuw/exec';
  const API_VERSION = 'v1';
  const COMPETITION_ID = 'official_2026';
  const DEFAULT_SEASON = 2026;
  const DEFAULT_WEEK = 1;
  const MIN_WEEK = 1;
  const MAX_WEEK = 18;

  const params = new URLSearchParams(window.location.search);
  let currentSeason = positiveInteger(params.get('season')) || DEFAULT_SEASON;
  let currentWeek = clampWeek(positiveInteger(params.get('week')) || DEFAULT_WEEK);
  let scoreboard = null;
  let whoPickedWho = null;
  let loading = false;

  const seasonLabel = document.querySelector('[data-scoreboard-season]');
  const title = document.querySelector('[data-scoreboard-title]');
  const prevButton = document.querySelector('[data-week-prev]');
  const currentWeekButton = document.querySelector('[data-week-current]');
  const nextButton = document.querySelector('[data-week-next]');
  const refreshButton = document.querySelector('[data-refresh]');
  const freshness = document.querySelector('[data-freshness]');
  const message = document.querySelector('[data-scoreboard-message]');

  const summaryElements = {
    live: document.querySelector('[data-summary-live]'),
    upcoming: document.querySelector('[data-summary-upcoming]'),
    final: document.querySelector('[data-summary-final]')
  };

  const sectionElements = {
    live: document.querySelector('[data-score-section="live"]'),
    upcoming: document.querySelector('[data-score-section="upcoming"]'),
    final: document.querySelector('[data-score-section="final"]')
  };

  const countElements = {
    live: document.querySelector('[data-section-count="live"]'),
    upcoming: document.querySelector('[data-section-count="upcoming"]'),
    final: document.querySelector('[data-section-count="final"]')
  };

  const gridElements = {
    live: document.querySelector('[data-score-grid="live"]'),
    upcoming: document.querySelector('[data-score-grid="upcoming"]'),
    final: document.querySelector('[data-score-grid="final"]')
  };

  function positiveInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
  }

  function clampWeek(week) {
    return Math.min(MAX_WEEK, Math.max(MIN_WEEK, week));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  function setBrowserWeek(week) {
    const url = new URL(window.location.href);
    url.searchParams.set('season', String(currentSeason));
    url.searchParams.set('week', String(week));
    window.history.replaceState({}, '', url);
  }

  function buildApiUrl(action, week) {
    const url = new URL(API_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('api_version', API_VERSION);
    url.searchParams.set('competition_id', COMPETITION_ID);
    url.searchParams.set('season', String(currentSeason));
    url.searchParams.set('week', String(week));
    return url.toString();
  }

  async function fetchJson(action, week) {
    const response = await fetch(buildApiUrl(action, week), {
      method: 'GET',
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`${action} request failed with HTTP ${response.status}.`);
    }

    return response.json();
  }

  async function fetchScoreboard(week) {
    const payload = await fetchJson('getScoreboard', week);

    if (!payload || payload.ok !== true || !Array.isArray(payload.games)) {
      throw new Error(
        payload && payload.message
          ? payload.message
          : 'The scoreboard returned an invalid response.'
      );
    }

    return payload;
  }

  async function fetchWhoPickedWho(week) {
    const payload = await fetchJson('getWhoPickedWho', week);

    if (!payload || payload.ok !== true || !Array.isArray(payload.games)) {
      throw new Error(
        payload && payload.message
          ? payload.message
          : 'Who Picked Who returned an invalid response.'
      );
    }

    return payload;
  }

  function setLoading(isLoading) {
    loading = isLoading;

    if (refreshButton) {
      refreshButton.disabled = isLoading;
      refreshButton.textContent = isLoading ? 'Refreshing…' : 'Refresh Scores';
    }

    if (isLoading && freshness) {
      const textNode = freshness.firstChild;
      if (textNode) {
        textNode.textContent = 'Loading scores… ';
      }
    }

    if (prevButton) prevButton.disabled = isLoading || currentWeek <= MIN_WEEK;
    if (nextButton) nextButton.disabled = isLoading || currentWeek >= MAX_WEEK;
  }

  function showMessage(text) {
    if (!message) return;
    message.textContent = text;
    message.hidden = false;
  }

  function hideMessage() {
    if (!message) return;
    message.textContent = '';
    message.hidden = true;
  }

  function formatKickoff(isoValue) {
    if (!isoValue) return '';

    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  }

  function formatKickoffDate(isoValue) {
    if (!isoValue) return '';

    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }).format(date);
  }

  function formatQuarter(value) {
    const quarter = Number(value);

    if (!Number.isInteger(quarter) || quarter < 1) return '';
    if (quarter === 1) return '1st';
    if (quarter === 2) return '2nd';
    if (quarter === 3) return '3rd';
    if (quarter === 4) return '4th';
    return 'OT';
  }

  function formatSyncStatus(isoValue) {
    if (!isoValue) {
      return { text: 'Score sync time unavailable', stale: true };
    }

    const date = new Date(isoValue);

    if (Number.isNaN(date.getTime())) {
      return { text: 'Score sync time unavailable', stale: true };
    }

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);

    if (elapsedMinutes < 1) {
      return { text: 'Scores synced just now', stale: false };
    }

    if (elapsedMinutes <= 10) {
      return {
        text: `Scores synced ${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'} ago`,
        stale: false
      };
    }

    return {
      text: `Score updates delayed · last synced ${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'} ago`,
      stale: true
    };
  }

  function phaseKey(game) {
    return String(game.phase || '').trim().toLowerCase();
  }

  function sortGames(games) {
    return [...games].sort((a, b) => Number(a.week_sort || 0) - Number(b.week_sort || 0));
  }

  function teamRowHtml(game, side, options = {}) {
    const abbreviation = escapeHtml(game[`${side}_abbr`] || '');
    const teamName = escapeHtml(game[`${side}_team`] || '');
    const score = game[`${side}_score`];
    const hasScore = options.showScore && score !== '' && score !== null && score !== undefined;
    const winnerClass =
      options.winner &&
      String(game.winner || '').toUpperCase() === String(game[`${side}_abbr`] || '').toUpperCase()
        ? ' winner'
        : '';

    return `
      <div class="team-row${winnerClass}">
        <span class="team-mark">${abbreviation}</span>
        <div class="team-name"><strong>${teamName}</strong></div>
        ${hasScore ? `<strong class="team-score">${escapeHtml(score)}</strong>` : ''}
      </div>
    `;
  }

  function whoGameFor(gameId) {
    if (!whoPickedWho || !Array.isArray(whoPickedWho.games)) return null;
    return whoPickedWho.games.find(game => String(game.game_id) === String(gameId)) || null;
  }

  function pickMarkHtml(pick) {
    if (!pick || pick.game_final !== true) return '';
    return pick.pick_correct === true
      ? '<span class="wph-mark is-correct" aria-label="Correct pick">✓</span>'
      : '<span class="wph-mark is-incorrect" aria-label="Incorrect pick">×</span>';
  }

  function pickNameHtml(pick) {
    return `<span class="wph-player">${escapeHtml(pick.player_name)}${pickMarkHtml(pick)}</span>`;
  }

  function whoPickedWhoHtml(game) {
    const revealGame = whoGameFor(game.game_id);

    // Security belt-and-suspenders:
    // no reveal flag = no frontend pick markup, even if the scoreboard says LIVE/FINAL.
    if (!revealGame || revealGame.revealed !== true || !Array.isArray(revealGame.picks)) {
      return '';
    }

    const awayAbbr = String(game.away_abbr || '').toUpperCase();
    const homeAbbr = String(game.home_abbr || '').toUpperCase();
    const awayPicks = revealGame.picks.filter(pick => String(pick.pick_team || '').toUpperCase() === awayAbbr);
    const homePicks = revealGame.picks.filter(pick => String(pick.pick_team || '').toUpperCase() === homeAbbr);
    const total = awayPicks.length + homePicks.length;

    if (total === 0) {
      return `
        <div class="wph" data-wph>
          <div class="wph-heading">
            <span>Who Picked Who</span>
            <span>0 picks</span>
          </div>
          <p class="wph-empty">No player picks were recorded for this game.</p>
        </div>
      `;
    }

    const awayPct = Math.round((awayPicks.length / total) * 100);
    const homePct = 100 - awayPct;
    const finalGraded = revealGame.picks.some(pick => pick.game_final === true);

    const row = (abbr, picks, side) => `
      <div class="wph-pick-row">
        <span class="wph-team-key is-${side}"><span></span>${escapeHtml(abbr)}</span>
        <div class="wph-scroll-shell">
          <div class="wph-overflow-cue" data-overflow-cue hidden></div>
          <div class="wph-player-scroll" data-player-scroll tabindex="0">
            <div class="wph-player-line">${picks.map(pickNameHtml).join('<span class="wph-separator">·</span>')}</div>
          </div>
        </div>
      </div>
    `;

    return `
      <div class="wph" data-wph>
        <div class="wph-heading">
          <span>Who Picked Who</span>
          <span>${total} pick${total === 1 ? '' : 's'}</span>
        </div>

        <div class="wph-pool-bar" aria-label="${awayPct}% ${escapeHtml(awayAbbr)}, ${homePct}% ${escapeHtml(homeAbbr)}">
          <span class="wph-pool-away" style="width:${awayPct}%"></span>
          <span class="wph-pool-home" style="width:${homePct}%"></span>
        </div>

        <div class="wph-team-split">
          <div class="wph-team-box">
            <span class="team-mark">${escapeHtml(awayAbbr)}</span>
            <div><strong>${escapeHtml(awayAbbr)}</strong><small>${awayPct}% of pool</small></div>
            <b>${awayPicks.length}</b>
          </div>
          <div class="wph-team-box">
            <span class="team-mark wph-home-mark">${escapeHtml(homeAbbr)}</span>
            <div><strong>${escapeHtml(homeAbbr)}</strong><small>${homePct}% of pool</small></div>
            <b>${homePicks.length}</b>
          </div>
        </div>

        <button class="wph-toggle" type="button" data-wph-toggle aria-expanded="false">
          <span>View all ${total} player pick${total === 1 ? '' : 's'}</span>
          <span aria-hidden="true">↓</span>
        </button>

        <div class="wph-picks" data-wph-picks hidden>
          ${row(awayAbbr, awayPicks, 'away')}
          ${row(homeAbbr, homePicks, 'home')}
          ${finalGraded ? '<p class="wph-legend">Final game: ✓ correct pick · × incorrect pick</p>' : ''}
        </div>
      </div>
    `;
  }

  function liveCardHtml(game) {
    const quarter = formatQuarter(game.quarter);
    const statusText = quarter ? `Live · ${quarter}` : 'Live';
    const clockText = game.clock && game.clock !== '0:00'
      ? `${escapeHtml(game.clock)} remaining`
      : 'Live';

    return `
      <article class="card game-card game-card-live" data-game-id="${escapeHtml(game.game_id)}">
        <div class="game-card-top">
          <span class="status status-live">${statusText}</span>
          <span class="game-clock">${clockText}</span>
        </div>
        ${teamRowHtml(game, 'away', { showScore: true })}
        ${teamRowHtml(game, 'home', { showScore: true })}
        ${whoPickedWhoHtml(game)}
      </article>
    `;
  }

  function upcomingCardHtml(game) {
    const kickoffText = formatKickoff(game.kickoff_utc);
    const dateText = formatKickoffDate(game.kickoff_utc);
    const networkText = String(game.network || '').trim();
    const detailParts = [dateText, networkText].filter(Boolean);

    return `
      <article class="card game-card" data-game-id="${escapeHtml(game.game_id)}">
        <div class="game-card-top">
          <span class="status status-upcoming">Upcoming</span>
          <span class="game-clock">${escapeHtml(kickoffText)}</span>
        </div>
        ${teamRowHtml(game, 'away')}
        ${teamRowHtml(game, 'home')}
        ${detailParts.length ? `<p class="game-detail">${escapeHtml(detailParts.join(' · '))}</p>` : ''}
      </article>
    `;
  }

  function finalCardHtml(game) {
    const statusText = String(game.status || '').toUpperCase().includes('OT') ? 'Final / OT' : 'Final';

    return `
      <article class="card game-card" data-game-id="${escapeHtml(game.game_id)}">
        <div class="game-card-top">
          <span class="status status-final">${statusText}</span>
          <span class="game-clock"></span>
        </div>
        ${teamRowHtml(game, 'away', { showScore: true, winner: true })}
        ${teamRowHtml(game, 'home', { showScore: true, winner: true })}
        ${whoPickedWhoHtml(game)}
      </article>
    `;
  }

  function renderSection(key, games) {
    const section = sectionElements[key];
    const grid = gridElements[key];
    const count = countElements[key];

    if (!section || !grid || !count) return;

    const sorted = sortGames(games);
    const total = sorted.length;

    count.textContent = `${total} game${total === 1 ? '' : 's'}`;
    section.hidden = total === 0;

    if (total === 0) {
      grid.innerHTML = '';
      return;
    }

    if (key === 'live') grid.innerHTML = sorted.map(liveCardHtml).join('');
    else if (key === 'upcoming') grid.innerHTML = sorted.map(upcomingCardHtml).join('');
    else grid.innerHTML = sorted.map(finalCardHtml).join('');
  }

  function renderHeader(payload) {
    if (seasonLabel) seasonLabel.textContent = `${payload.season} Regular Season`;
    if (title) title.textContent = `Week ${payload.week} scoreboard`;
    if (currentWeekButton) currentWeekButton.textContent = `Week ${payload.week}`;

    if (prevButton) {
      prevButton.textContent = payload.week > MIN_WEEK ? `‹ Week ${payload.week - 1}` : '‹ Previous';
      prevButton.disabled = payload.week <= MIN_WEEK || loading;
    }

    if (nextButton) {
      nextButton.textContent = payload.week < MAX_WEEK ? `Week ${payload.week + 1} ›` : 'Next ›';
      nextButton.disabled = payload.week >= MAX_WEEK || loading;
    }
  }

  function renderSummary(payload) {
    const summary = payload.summary || {};
    for (const key of ['live', 'upcoming', 'final']) {
      if (summaryElements[key]) summaryElements[key].textContent = String(Number(summary[key] || 0));
    }
  }

  function renderFreshness(payload) {
    if (!freshness) return;

    const syncStatus = formatSyncStatus(payload.last_updated_utc);
    let textNode = freshness.firstChild;

    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
      textNode = document.createTextNode('');
      freshness.insertBefore(textNode, freshness.firstChild);
    }

    textNode.textContent = `${syncStatus.text} `;
    freshness.classList.toggle('is-stale', syncStatus.stale);
  }

  function renderScoreboard(payload) {
    scoreboard = payload;
    currentSeason = Number(payload.season) || currentSeason;
    currentWeek = clampWeek(Number(payload.week) || currentWeek);

    const games = Array.isArray(payload.games) ? payload.games : [];

    renderHeader(payload);
    renderSummary(payload);
    renderFreshness(payload);
    renderSection('live', games.filter(game => phaseKey(game) === 'live'));
    renderSection('upcoming', games.filter(game => phaseKey(game) === 'upcoming'));
    renderSection('final', games.filter(game => phaseKey(game) === 'final'));

    hideMessage();
    setBrowserWeek(currentWeek);
  }

  function overflowCueText() {
    return window.matchMedia('(max-width: 620px)').matches
      ? 'Swipe to see all names →'
      : 'Scroll to see all names →';
  }

  function updateOverflowCues(scope = document) {
    scope.querySelectorAll('[data-player-scroll]').forEach(scroll => {
      const shell = scroll.closest('.wph-scroll-shell');
      const cue = shell ? shell.querySelector('[data-overflow-cue]') : null;
      if (!cue) return;

      const overflows = scroll.scrollWidth > scroll.clientWidth + 2;
      cue.textContent = overflowCueText();
      cue.hidden = !overflows;
    });
  }

  async function loadScoreboard(targetWeek = currentWeek, options = {}) {
    if (loading) return;

    const priorWeek = currentWeek;
    const priorScoreboard = scoreboard;
    const priorWhoPickedWho = whoPickedWho;

    setLoading(true);
    hideMessage();

    try {
      const [scorePayload, whoResult] = await Promise.all([
        fetchScoreboard(targetWeek),
        fetchWhoPickedWho(targetWeek).catch(error => {
          console.warn('Who Picked Who load failed:', error);
          return null;
        })
      ]);

      whoPickedWho = whoResult;
      renderScoreboard(scorePayload);
    } catch (error) {
      console.error('Sonoran Games scoreboard load failed:', error);

      currentWeek = priorWeek;
      scoreboard = priorScoreboard;
      whoPickedWho = priorWhoPickedWho;
      setBrowserWeek(currentWeek);

      if (scoreboard) {
        renderHeader(scoreboard);
        renderFreshness(scoreboard);
      }

      if (targetWeek !== priorWeek) {
        showMessage(`Week ${targetWeek} scoreboard is not available yet.`);
      } else {
        showMessage('Scores are temporarily unavailable. Please try Refresh Scores again.');
      }
    } finally {
      setLoading(false);
      if (scoreboard) renderHeader(scoreboard);
    }
  }

  function changeWeek(offset) {
    if (loading) return;

    const targetWeek = clampWeek(currentWeek + offset);
    if (targetWeek === currentWeek) return;

    loadScoreboard(targetWeek);
  }

  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-wph-toggle]');
    if (!toggle) return;

    const wph = toggle.closest('[data-wph]');
    const picks = wph ? wph.querySelector('[data-wph-picks]') : null;
    if (!picks) return;

    const opening = picks.hidden;
    picks.hidden = !opening;
    toggle.setAttribute('aria-expanded', opening ? 'true' : 'false');

    const label = toggle.querySelector('span:first-child');
    const arrow = toggle.querySelector('span:last-child');

    if (label) {
      const totalText = toggle.dataset.totalLabel || label.textContent.replace(/^View all /, '');
      toggle.dataset.totalLabel = totalText;
      label.textContent = opening ? 'Hide player picks' : `View all ${totalText}`;
    }

    if (arrow) arrow.textContent = opening ? '↑' : '↓';

    if (opening) {
      requestAnimationFrame(() => updateOverflowCues(wph));
    }
  });

  window.addEventListener('resize', () => updateOverflowCues());

  if (prevButton) prevButton.addEventListener('click', () => changeWeek(-1));
  if (nextButton) nextButton.addEventListener('click', () => changeWeek(1));
  if (refreshButton) refreshButton.addEventListener('click', () => loadScoreboard(currentWeek, { refresh: true }));

  loadScoreboard(currentWeek);
})();
