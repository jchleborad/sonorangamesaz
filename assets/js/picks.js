(() => {
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycbw9dkf50_ofoiG4K00IYWNn_Tf61cBOst67vw26h7ZhSajNHbyT3H5oNqV_va31GpKzuw/exec';
  const API_VERSION = 'v1';
  const COMPETITION_ID = 'official_2026';
  const PLAYER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Phoenix';

  const params = new URLSearchParams(window.location.search);
  const urlPlayerToken = params.get('player') || '';
  const savedPlayerToken =
    window.SonoranPlayerAccess && typeof window.SonoranPlayerAccess.getToken === 'function'
    ? window.SonoranPlayerAccess.getToken()
    : '';

  const playerToken = urlPlayerToken || savedPlayerToken;
  const main = document.querySelector('.picks-main');
  let card = null;
  let guidanceTimer = null;
  let lastGuidedGameId = '';
  let draftDirty = false;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  })[character]);

  function apiErrorMessage(payload, fallback) {
    return payload && payload.message ? payload.message : fallback;
  }

  function createSubmissionId() {
    const cryptoApi = window.crypto;

    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
      try {
        return cryptoApi.randomUUID();
      } catch (error) {
        // Fall through to getRandomValues if randomUUID exists but cannot be used.
      }
    }

    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      cryptoApi.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
      return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
    }

    return `sg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function loadWeeklyCard() {
    const url = new URL(API_URL);
    url.searchParams.set('action', 'getWeeklyCard');
    url.searchParams.set('api_version', API_VERSION);
    url.searchParams.set('competition_id', COMPETITION_ID);
    url.searchParams.set('player_token', playerToken);
    const response = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
    if (!response.ok) throw new Error('The Sonoran Games server could not be reached.');
    const payload = await response.json();
    if (!payload.ok) throw new Error(apiErrorMessage(payload, 'Your picks could not be loaded.'));
    return payload;
  }

  async function saveWeeklyCard(payload) {
    const response = await fetch(API_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('The Sonoran Games server could not save your picks.');
    return response.json();
  }

  function formatDate(iso, options) {
    return new Intl.DateTimeFormat('en-US', { timeZone: PLAYER_TIME_ZONE, ...options }).format(new Date(iso));
  }

  function dayKey(game) {
    return formatDate(game.kickoff_utc, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function kickoffTime(game) {
    return formatDate(game.kickoff_utc, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  }

  function initials(name) {
    return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  function draftKey() {
    return `sonoran-games:picks-draft:${card.competition_id}:${card.season}:${card.week}:${card.player.player_id}`;
  }

  function formatSavedTime(iso) {
    return iso ? formatDate(iso, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  }

  function readDraft() {
    try { return JSON.parse(window.localStorage.getItem(draftKey()) || 'null'); }
    catch (error) { return null; }
  }

  function restoreNewerDraft() {
    if (!card.picks_open) return;
    const draft = readDraft();
    if (!draft || !draft.saved_at_utc) return;
    const draftTime = Date.parse(draft.saved_at_utc);
    const submittedTime = Date.parse(card.submitted_at_utc || '') || 0;
    if (!Number.isFinite(draftTime) || draftTime <= submittedTime) return;
    const draftPicks = draft.picks && typeof draft.picks === 'object' ? draft.picks : {};
    card.games.forEach(game => {
      if (!game.locked && [game.away_abbr, game.home_abbr].includes(draftPicks[String(game.game_id)])) {
        game.pick_team = draftPicks[String(game.game_id)];
      }
    });
    if (draft.tiebreaker !== '' && draft.tiebreaker !== null && draft.tiebreaker !== undefined) card.tiebreaker = draft.tiebreaker;
    draftDirty = true;
  }

  function saveDraft() {
    if (!card.picks_open) return;
    const picks = {};
    card.games.forEach(game => { if (game.pick_team) picks[String(game.game_id)] = game.pick_team; });
    try {
      window.localStorage.setItem(draftKey(), JSON.stringify({
        saved_at_utc: new Date().toISOString(),
        picks,
        tiebreaker: document.querySelector('[data-tiebreaker]').value.trim()
      }));
      draftDirty = true;
      updateSaveStatus();
    } catch (error) {
      // Draft storage must never block a player from submitting.
    }
  }

  function clearDraft() {
    try { window.localStorage.removeItem(draftKey()); } catch (error) { /* no-op */ }
    draftDirty = false;
  }

  function updateSaveStatus() {
    const status = document.querySelector('[data-save-status]');
    if (!status) return;
    if (draftDirty) {
      status.className = 'card-save-status is-draft';
      status.innerHTML = '<strong>Draft saved on this device</strong><span>Submit when your card is complete.</span>';
    } else if (card.submitted_at_utc) {
      status.className = 'card-save-status is-submitted';
      status.innerHTML = `<strong>Card submitted</strong><span>${escapeHtml(formatSavedTime(card.submitted_at_utc))} local time</span>`;
    } else {
      status.className = 'card-save-status';
      status.innerHTML = '<strong>Not submitted yet</strong><span>Your changes will be saved as a draft on this device.</span>';
    }
  }

  function renderTeam(game, side) {
    const abbreviation = game[`${side}_abbr`];
    const name = game[`${side}_team`];
    const selected = game.pick_team === abbreviation;
    const locked = game.locked || !card.picks_open;
    return `<button class="team-choice${selected ? ' is-selected' : ''}" type="button" data-team="${escapeHtml(abbreviation)}" aria-pressed="${selected}"${locked ? ' disabled' : ''}>
      <span class="team-mark">${escapeHtml(abbreviation)}</span>
      <span><strong>${escapeHtml(name)}</strong><small>${side === 'away' ? 'Away' : 'Home'}</small></span>
      ${selected ? '<span class="pick-check" aria-hidden="true">✓</span>' : ''}
    </button>`;
  }

  function renderGame(game) {
    const selected = Boolean(game.pick_team);
    const locked = game.locked || !card.picks_open;
    const lockText = game.locked ? 'Locked at kickoff' : card.picks_open ? `Locks at ${kickoffTime(game)}` : 'Picks are closed';
    return `<article class="card matchup-card${locked ? ' is-locked' : ''}${!selected ? ' needs-pick' : ''}" data-game data-game-id="${escapeHtml(game.game_id)}" data-locked="${locked}">
      <div class="matchup-meta"><span>${kickoffTime(game)}</span><strong>${lockText}</strong></div>
      <div class="team-choices" role="group" aria-label="${escapeHtml(game.away_team)} at ${escapeHtml(game.home_team)}">
        ${renderTeam(game, 'away')}<span class="matchup-at">AT</span>${renderTeam(game, 'home')}
      </div>
      ${!selected && !locked ? '<p class="pick-needed">Pick a winner</p>' : ''}
      ${locked && selected ? `<div class="locked-result"><span>Your pick: <strong>${escapeHtml(game.pick_team)}</strong></span><span class="status status-final">Locked</span></div>` : ''}
    </article>`;
  }

  function renderDay([label, games], index) {
    const open = games.filter(game => !game.locked && card.picks_open).length;
    const headingId = `pick-day-${index}`;
    return `<section class="pick-day" aria-labelledby="${headingId}">
      <div class="pick-day-heading"><div><p class="eyebrow">${escapeHtml(label)}</p><h2 class="display" id="${headingId}">${escapeHtml(label.split(' · ')[0])} Games</h2></div>
      <span class="${open ? 'open-label' : 'lock-label'}">${open ? `${open} open` : 'Locked'}</span></div>
      <div class="pick-game-list">${games.map(renderGame).join('')}</div>
    </section>`;
  }

  function groupedGames() {
    const groups = new Map();
    card.games.forEach(game => {
      const key = dayKey(game);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(game);
    });
    return [...groups.entries()];
  }

  function renderPage() {
    const playerName = card.player.display_name;
    const lockedCount = card.games.filter(game => game.locked).length;
    main.innerHTML = `
      <section class="picks-hero"><div class="container picks-hero-row"><div><p class="eyebrow">${card.season} Regular Season</p><h1 class="display picks-title">Make your Week ${card.week} picks</h1><p class="picks-intro">Choose one winner for every matchup. Each game stays open until its scheduled kickoff.</p></div><div class="player-card" aria-label="Current player"><span class="player-avatar" aria-hidden="true">${escapeHtml(initials(playerName))}</span><div><small>Picking as</small><strong>${escapeHtml(playerName)}</strong></div></div></div></section>
      <div class="container picks-layout"><div class="picks-column">
        <section class="card picks-progress-card" aria-labelledby="progress-title"><div class="picks-progress-copy"><p class="eyebrow">Your Week ${card.week} card</p><h2 class="display" id="progress-title"><span data-selected-count>0</span> of ${card.games.length} selected</h2><p data-progress-message>Loading your progress…</p></div><div class="progress-ring" data-progress-ring style="--progress:0%"><strong data-progress-percent>0%</strong><span>Complete</span></div><div class="progress-track" aria-hidden="true"><span data-progress-bar style="width:0%"></span></div></section>
        <div class="pick-notice" role="note"><span class="notice-clock" aria-hidden="true">◷</span><div><strong>Games lock individually</strong><p>${lockedCount ? `${lockedCount} game${lockedCount === 1 ? ' is' : 's are'} already locked. ` : ''}You may change every open pick until that matchup begins.</p></div></div>
        ${groupedGames().map(renderDay).join('')}
        <section class="card tiebreaker-card" data-tiebreaker-card><div><p class="eyebrow">Weekly tiebreaker</p><h2 class="display">Total combined points</h2><p>Enter the total points you predict for the final game of the week.</p></div><label class="tiebreaker-input"><span class="sr-only">Total combined points</span><input type="number" min="0" max="200" inputmode="numeric" placeholder="—" data-tiebreaker value="${escapeHtml(card.tiebreaker)}"${card.picks_open ? '' : ' disabled'}><small>Points</small></label></section>
      </div><aside class="submit-column"><section class="card submit-card" data-submit-card><p class="eyebrow">Review &amp; submit</p><h2 class="display">Your Week ${card.week} card</h2><div class="card-save-status" data-save-status></div><div class="submit-summary"><div><span>Games selected</span><strong><span data-review-count>0</span>/${card.games.length}</strong></div><div><span>Tiebreaker</span><strong data-review-tiebreaker>Not entered</strong></div></div><div class="submit-warning" data-submit-warning></div><button class="button submit-button" type="button" data-submit-picks${card.picks_open ? '' : ' disabled'}>Finish my card →</button><p class="submit-help">${card.picks_open ? 'You may return and change any unlocked pick before that game begins.' : 'Picks are currently closed by the commissioner.'}</p></section></aside></div>
      <div class="confirmation-overlay" data-confirmation hidden><section class="card confirmation-card" role="dialog" aria-modal="true" aria-labelledby="confirmation-title"><span class="confirmation-mark" aria-hidden="true">✓</span><p class="eyebrow">Touchdown</p><h2 class="display" id="confirmation-title">Week ${card.week} picks saved</h2><p>Your card has been saved. You can still update any matchup that has not locked.</p><div class="confirmation-actions"><button class="button" type="button" data-close-confirmation>Back to my picks</button><a class="text-link" href="/">Return home</a></div></section></div>`;
    bindInteractions();
    updateState();
    updateSaveStatus();
  }

  function selectedCount() {
    return card.games.filter(game => Boolean(game.pick_team)).length;
  }

  function clearGuidance() {
    window.clearTimeout(guidanceTimer);
    document.querySelectorAll('.is-guided').forEach(item => item.classList.remove('is-guided'));
    document.querySelectorAll('[data-guidance-message]').forEach(message => message.remove());
  }

  function guideTo(item, message) {
    clearGuidance();
    item.classList.add('is-guided');
    item.insertAdjacentHTML('beforeend', `<p class="pick-guidance" data-guidance-message role="status" aria-live="polite"><span class="pick-guidance-icon" aria-hidden="true">!</span><span>${escapeHtml(message)}</span></p>`);
    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    guidanceTimer = window.setTimeout(clearGuidance, 5000);
  }

  function updateState() {
    const total = card.games.length;
    const selected = selectedCount();
    const missing = Math.max(total - selected, 0);
    const tieValue = document.querySelector('[data-tiebreaker]').value.trim();
    const ready = missing === 0 && tieValue !== '';
    const percent = total ? Math.round((selected / total) * 100) : 0;
    document.querySelectorAll('[data-selected-count], [data-review-count]').forEach(element => { element.textContent = selected; });
    document.querySelector('[data-progress-percent]').textContent = `${percent}%`;
    document.querySelector('[data-progress-ring]').style.setProperty('--progress', `${percent}%`);
    document.querySelector('[data-progress-bar]').style.width = `${percent}%`;
    document.querySelector('[data-review-tiebreaker]').textContent = tieValue ? `${tieValue} points` : 'Not entered';
    document.querySelector('[data-progress-message]').textContent = missing ? `${missing} pick${missing === 1 ? '' : 's'} left.` : tieValue ? 'Your card is complete and ready to submit.' : 'All games selected. Add your tiebreaker.';
    const warning = document.querySelector('[data-submit-warning]');
    warning.classList.toggle('is-ready', ready);
    let needed = '';
    if (missing && !tieValue) needed = `${missing} game pick${missing === 1 ? '' : 's'} and your tiebreaker score.`;
    else if (missing) needed = `${missing} game pick${missing === 1 ? '' : 's'}.`;
    else if (!tieValue) needed = 'Your tiebreaker score.';
    warning.innerHTML = ready ? `<strong>Ready for kickoff</strong><p>All ${total} games and your tiebreaker are complete.</p>` : `<strong>Still needed</strong><p>${needed}</p>`;
    document.querySelector('[data-submit-picks]').textContent = ready ? 'Submit my picks →' : 'Finish my card →';
  }

  function selectTeam(gameElement, button) {
    const game = card.games.find(item => String(item.game_id) === gameElement.dataset.gameId);
    if (!game || game.locked || !card.picks_open) return;
    game.pick_team = button.dataset.team;
    gameElement.querySelectorAll('.team-choice').forEach(choice => {
      choice.classList.toggle('is-selected', choice === button);
      choice.setAttribute('aria-pressed', String(choice === button));
      choice.querySelector('.pick-check')?.remove();
    });
    button.insertAdjacentHTML('beforeend', '<span class="pick-check" aria-hidden="true">✓</span>');
    gameElement.classList.remove('needs-pick');
    gameElement.querySelector('.pick-needed')?.remove();
    clearGuidance();
    updateState();
    saveDraft();
  }

  function nextMissingGame() {
    const missing = card.games.filter(game => !game.pick_team && !game.locked);
    if (!missing.length) return null;
    const current = missing.findIndex(game => String(game.game_id) === lastGuidedGameId);
    const next = missing[current >= 0 ? (current + 1) % missing.length : 0];
    lastGuidedGameId = String(next.game_id);
    return document.querySelector(`[data-game-id="${CSS.escape(String(next.game_id))}"]`);
  }

  async function submitPicks() {
    const button = document.querySelector('[data-submit-picks]');
    const tiebreaker = document.querySelector('[data-tiebreaker]');
    const missingElement = nextMissingGame();
    if (missingElement) return guideTo(missingElement, 'This matchup still needs your pick.');
    if (!tiebreaker.value.trim()) {
      const cardElement = document.querySelector('[data-tiebreaker-card]');
      guideTo(cardElement, 'One last step—enter your tiebreaker.');
      window.setTimeout(() => tiebreaker.focus({ preventScroll: true }), 450);
      return;
    }
    button.disabled = true;
    button.textContent = 'Saving…';
    try {
      const payload = {
        action: 'savePicks', api_version: API_VERSION, competition_id: COMPETITION_ID,
        season: card.season, week: card.week, player_token: playerToken,
        submission_id: createSubmissionId(), client_submitted_at_utc: new Date().toISOString(),
        submission_type: 'CARD_SAVE', tiebreaker: Number(tiebreaker.value),
        picks: card.games.filter(game => !game.locked).map(game => ({ game_id: game.game_id, pick_team: game.pick_team }))
      };
      const result = await saveWeeklyCard(payload);
      if (!result.ok) throw new Error(apiErrorMessage(result, 'Your picks could not be saved.'));
      card.submitted_at_utc = result.server_time_utc || new Date().toISOString();
      clearDraft();
      updateSaveStatus();
      const confirmation = document.querySelector('[data-confirmation]');
      confirmation.hidden = false;
      document.body.style.overflow = 'hidden';
      confirmation.querySelector('[data-close-confirmation]').focus();
    } catch (error) {
      showInlineError(error.message, document.querySelector('[data-submit-card]'));
    } finally {
      button.disabled = !card.picks_open;
      updateState();
    }
  }

  function closeConfirmation() {
    const confirmation = document.querySelector('[data-confirmation]');
    confirmation.hidden = true;
    document.body.style.overflow = '';
    document.querySelector('[data-submit-picks]').focus();
  }

  function bindInteractions() {
    document.querySelectorAll('[data-game]').forEach(gameElement => {
      gameElement.querySelectorAll('.team-choice').forEach(button => button.addEventListener('click', () => selectTeam(gameElement, button)));
    });
    document.querySelector('[data-tiebreaker]').addEventListener('input', () => { updateState(); saveDraft(); });
    document.querySelector('[data-submit-picks]').addEventListener('click', submitPicks);
    document.querySelector('[data-close-confirmation]').addEventListener('click', closeConfirmation);
    document.querySelector('[data-confirmation]').addEventListener('click', event => { if (event.target === event.currentTarget) closeConfirmation(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !document.querySelector('[data-confirmation]').hidden) closeConfirmation(); });
  }

  function showInlineError(message, target = main) {
    target.querySelector('[data-api-error]')?.remove();
    target.insertAdjacentHTML('afterbegin', `<div class="pick-notice" data-api-error role="alert"><span class="notice-clock" aria-hidden="true">!</span><div><strong>We couldn’t complete that</strong><p>${escapeHtml(message)}</p></div></div>`);
  }

  function renderLoading() {
    main.innerHTML = '<section class="picks-hero"><div class="container"><p class="eyebrow">Sonoran Games</p><h1 class="display picks-title">Loading your picks…</h1><p class="picks-intro">We’re opening your personal Sonoran Games card.</p></div></section>';
  }

  function renderFatal(message) {
    main.innerHTML = `<section class="picks-hero"><div class="container"><p class="eyebrow">Personal player link needed</p><h1 class="display picks-title">We couldn’t open your picks card</h1><p class="picks-intro">${escapeHtml(message)}</p><p class="picks-intro">Contact the Sonoran Games Administrator for a new personal player link.</p></div></section>`;
  }

  async function initialize() {
    renderLoading();
    if (!playerToken) return renderFatal('This address does not include a player token.');
    try {
      card = await loadWeeklyCard();

      if (
        window.SonoranPlayerAccess &&
        typeof window.SonoranPlayerAccess.saveToken === 'function'
      ) {
        window.SonoranPlayerAccess.saveToken(playerToken);
      }

      restoreNewerDraft();
      renderPage();
    } catch (error) {
      renderFatal(error.message);
    }
  }

  initialize();
})();
