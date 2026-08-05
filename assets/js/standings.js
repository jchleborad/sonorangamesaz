const standingsTabs = [...document.querySelectorAll('[data-standings-tab]')];
const standingsPanels = [...document.querySelectorAll('[data-standings-panel]')];
const weeklyTableScroll = document.querySelector('[data-weekly-table-scroll]');
const weeklyTableScrollCue = document.querySelector('[data-table-scroll-cue]');

if (weeklyTableScroll && weeklyTableScrollCue) {
  const playerCount = weeklyTableScroll.querySelectorAll('tbody tr').length;

  if (playerCount > 20) {
    weeklyTableScroll.classList.add('is-vertically-scrollable');
    weeklyTableScrollCue.textContent = `Scroll to see all ${playerCount} players.`;
    weeklyTableScrollCue.hidden = false;
  }
}

function showStandingsView(view) {
  standingsTabs.forEach((tab) => {
    const active = tab.dataset.standingsTab === view;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });

  standingsPanels.forEach((panel) => {
    panel.hidden = panel.dataset.standingsPanel !== view;
  });
}

standingsTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => showStandingsView(tab.dataset.standingsTab));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + direction + standingsTabs.length) % standingsTabs.length;
    standingsTabs[nextIndex].focus();
    showStandingsView(standingsTabs[nextIndex].dataset.standingsTab);
  });
});

if (standingsTabs.length && standingsPanels.length) {
  showStandingsView('weekly');
}
