// LaunchEdge Talent — JS
// Profile card staggered reveal, map pulse

// Staggered profile card reveal on load
window.addEventListener('load', () => {
  document.querySelectorAll('.profile-card').forEach((card, i) => {
    setTimeout(() => card.classList.add('visible'), 800 + i * 250);
  });
});

// Map detail overlay — fade in after map loads
const mapDetail = document.querySelector('.talent-map-detail');
if (mapDetail) {
  setTimeout(() => {
    mapDetail.style.transition = 'opacity 1.2s ease';
    mapDetail.style.opacity    = '0.5';
  }, 1800);
}
