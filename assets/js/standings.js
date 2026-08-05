const seasonPreviewButton = document.querySelector('[data-season-preview]');
const seasonPreviewToast = document.querySelector('[data-season-toast]');

if (seasonPreviewButton && seasonPreviewToast) {
  let toastTimer;
  seasonPreviewButton.addEventListener('click', () => {
    seasonPreviewToast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      seasonPreviewToast.hidden = true;
    }, 3200);
  });
}
