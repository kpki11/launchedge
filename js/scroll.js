// LaunchEdge — Scroll Logic
// Nav compact + scroll reveal

const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  if (nav) nav.classList.toggle('scrolled', scrollY > 40);
});

// Scroll hint fade out
const scrollHint = document.querySelector('.scroll-hint');
if (scrollHint) {
  window.addEventListener('scroll', () => {
    if (scrollY > 80) scrollHint.style.opacity = '0';
    else scrollHint.style.opacity = '';
  }, { passive: true });
}

// Scroll reveal — watches .reveal, .stat-item, .pcard, .bcard, .step, etc.
const revealTargets = document.querySelectorAll(
  '.reveal, .stat-item, .pcard, .bcard, .step, .talent-feat-card, .copilot-feat-card, .labs-feat-card'
);

const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const siblings = entry.target.parentElement
        ? [...entry.target.parentElement.children]
        : [];
      const idx = siblings.indexOf(entry.target);
      const delay = idx * 120;
      setTimeout(() => entry.target.classList.add('visible'), delay);
      revealObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });

revealTargets.forEach(el => revealObs.observe(el));

// Profile cards (Talent) — staggered reveal
const profileCards = document.querySelectorAll('.profile-card');
const cardObs = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 200 + 400);
      cardObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

profileCards.forEach(el => cardObs.observe(el));
