const refreshButton = document.querySelector('[data-refresh]');
const freshness = document.querySelector('[data-freshness]');

if (refreshButton && freshness) {
  refreshButton.addEventListener('click', () => {
    refreshButton.disabled = true;
    refreshButton.textContent = 'Refreshing…';
    window.setTimeout(() => {
      freshness.firstChild.textContent = 'Updated just now · Arizona time ';
      refreshButton.textContent = 'Refresh Scores';
      refreshButton.disabled = false;
    }, 650);
  });
}
