(() => {
  const totalGames = 16;
  const games = [...document.querySelectorAll('[data-game]')];
  const tiebreaker = document.querySelector('[data-tiebreaker]');
  const confirmation = document.querySelector('[data-confirmation]');
  const submitButton = document.querySelector('[data-submit-picks]');
  const hiddenSelected = 8;
  let lastGuidedGame = null;
  let guidanceTimer;
  const selectedCount = () => hiddenSelected + games.filter(game => game.querySelector('.team-choice.is-selected')).length;

  function clearGuidance() {
    window.clearTimeout(guidanceTimer);
    document.querySelectorAll('.is-guided').forEach(item => item.classList.remove('is-guided'));
    document.querySelectorAll('[data-guidance-message]').forEach(message => message.remove());
  }

  function guideTo(item, message) {
    clearGuidance();
    item.classList.add('is-guided');
    item.insertAdjacentHTML('beforeend', `<p class="pick-guidance" data-guidance-message role="status" aria-live="polite"><span class="pick-guidance-icon" aria-hidden="true">!</span><span>${message}</span></p>`);
    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    guidanceTimer = window.setTimeout(clearGuidance, 5000);
  }

  function updateState() {
    const selected = selectedCount();
    const missing = Math.max(totalGames - selected, 0);
    const percent = Math.round((selected / totalGames) * 100);
    const tieValue = tiebreaker.value.trim();
    const ready = missing === 0 && tieValue !== '';
    document.querySelectorAll('[data-selected-count], [data-review-count]').forEach(el => { el.textContent = selected; });
    document.querySelector('[data-progress-percent]').textContent = `${percent}%`;
    document.querySelector('[data-progress-ring]').style.setProperty('--progress', `${percent}%`);
    document.querySelector('[data-progress-bar]').style.width = `${percent}%`;
    document.querySelector('[data-review-tiebreaker]').textContent = tieValue ? `${tieValue} points` : 'Not entered';
    document.querySelector('[data-progress-message]').textContent = missing ? `${missing} pick${missing === 1 ? '' : 's'} left. Plenty of time—Sunday games remain open.` : tieValue ? 'Your card is complete and ready to review.' : 'All games selected. Add your Monday night tiebreaker.';
    const warning = document.querySelector('[data-submit-warning]');
    warning.classList.toggle('is-ready', ready);
    let neededMessage = '';
    if (missing > 0 && !tieValue) neededMessage = `${missing} game pick${missing === 1 ? '' : 's'} and your tiebreaker score.`;
    else if (missing > 0) neededMessage = `${missing} game pick${missing === 1 ? '' : 's'}.`;
    else if (!tieValue) neededMessage = 'Your tiebreaker score.';
    warning.innerHTML = ready
      ? '<strong>Ready for kickoff</strong><p>All 16 games and your tiebreaker are complete.</p>'
      : `<strong>Still needed</strong><p>${neededMessage}</p>`;
    submitButton.textContent = ready ? 'Review my picks →' : 'Finish my card →';
  }

  games.forEach(game => {
    if (game.dataset.locked === 'true') return;
    game.querySelectorAll('.team-choice').forEach(button => button.addEventListener('click', () => {
      game.querySelectorAll('.team-choice').forEach(choice => { choice.classList.remove('is-selected'); choice.setAttribute('aria-pressed', 'false'); choice.querySelector('.pick-check')?.remove(); });
      button.classList.add('is-selected'); button.setAttribute('aria-pressed', 'true'); button.insertAdjacentHTML('beforeend', '<span class="pick-check" aria-hidden="true">✓</span>');
      clearGuidance(); game.classList.remove('needs-pick'); game.querySelector('.pick-needed')?.remove(); updateState();
    }));
  });
  tiebreaker.addEventListener('input', updateState);
  submitButton.addEventListener('click', () => {
    const missing = totalGames - selectedCount();
    if (missing > 0) {
      const unfinishedGames = games.filter(game => game.classList.contains('needs-pick'));
      const previousIndex = unfinishedGames.indexOf(lastGuidedGame);
      const nextIndex = previousIndex >= 0 ? (previousIndex + 1) % unfinishedGames.length : 0;
      lastGuidedGame = unfinishedGames[nextIndex];
      guideTo(lastGuidedGame, 'This matchup still needs your pick.');
      return;
    }
    if (!tiebreaker.value.trim()) {
      lastGuidedGame = null;
      const tiebreakerCard = document.querySelector('[data-tiebreaker-card]');
      guideTo(tiebreakerCard, 'One last step—enter your tiebreaker.');
      window.setTimeout(() => tiebreaker.focus({ preventScroll: true }), 450);
      return;
    }
    confirmation.hidden = false; document.body.style.overflow = 'hidden'; confirmation.querySelector('[data-close-confirmation]').focus();
  });
  function closeConfirmation() { confirmation.hidden = true; document.body.style.overflow = ''; submitButton.focus(); }
  document.querySelector('[data-close-confirmation]').addEventListener('click', closeConfirmation);
  confirmation.addEventListener('click', event => { if (event.target === confirmation) closeConfirmation(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !confirmation.hidden) closeConfirmation(); });
  document.querySelector('[data-player-change]').addEventListener('click', () => window.alert('Player selection will connect to the Sonoran Games player list during backend integration.'));
  updateState();
})();
