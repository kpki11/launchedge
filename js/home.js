// LaunchEdge — Homepage JS
// Footer wave particles + stat counters
// (Video engine removed — hero now uses static image layers)

// ── Footer Wave Particles ──────────────────────────────
(function initFooter() {
  const c = document.getElementById('footer-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  let W, H, t = 0;

  function resize() {
    W = c.width  = c.offsetWidth;
    H = c.height = c.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const pts = [];
  for (let i = 0; i < 80; i++) {
    pts.push({
      x:     Math.random(),
      y:     Math.random(),
      r:     Math.random() * 1.8 + 0.4,
      speed: Math.random() * 0.0008 + 0.0004,
      phase: Math.random() * Math.PI * 2,
      amp:   Math.random() * 0.08 + 0.02
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    t += 0.008;
    pts.forEach(p => {
      const px = ((p.x + t * p.speed * 0.5) % 1) * W;
      const py = (p.y + Math.sin(t * 1.2 + p.phase) * p.amp) * H;
      const alpha = 0.18 + Math.sin(t + p.phase) * 0.10;
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(196,150,58,${Math.max(0, alpha)})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

// ── Animated stat counters ────────────────────────────
function animateCounter(el, target, suffix, duration = 1600) {
  let start = null;
  function step(ts) {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(eased * target);
    el.textContent = current >= 1000
      ? (current / 1000).toFixed(0) + 'K' + suffix
      : current + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const statNums = document.querySelectorAll('.stat-num[data-target]');
const counterObs = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el     = entry.target;
      const target = parseInt(el.dataset.target);
      const suffix = el.dataset.suffix || '';
      animateCounter(el, target, suffix);
      counterObs.unobserve(el);
    }
  });
}, { threshold: 0.4 });

statNums.forEach(el => counterObs.observe(el));

// ── Scroll Reveal — .pcard, .bcard, .step, .stat-item ──
function initScrollReveal() {
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger each sibling slightly
        const siblings = Array.from(entry.target.parentElement.children);
        const idx = siblings.indexOf(entry.target);
        entry.target.style.transitionDelay = (idx * 0.08) + 's';
        entry.target.classList.add('visible');
        revealObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.pcard, .bcard, .step, .stat-item, .reveal').forEach(el => {
    revealObs.observe(el);
  });
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initScrollReveal);
} else {
  initScrollReveal();
}
