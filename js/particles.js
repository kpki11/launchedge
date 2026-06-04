// LaunchEdge — Floating Particle Canvas (Global)
// Fixed full-screen canvas, gold particles drifting upward

(function initParticles() {
  const c = document.getElementById('particle-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = c.width  = innerWidth;
    H = c.height = innerHeight;
  }

  resize();
  window.addEventListener('resize', resize);

  // Build particle pool — 55 gold dots
  for (let i = 0; i < 55; i++) {
    particles.push({
      x:  Math.random() * 1920,
      y:  Math.random() * 1080,
      r:  Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.4 - 0.1,
      o:  Math.random() * 0.45 + 0.08
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x % W, ((p.y % H) + H) % H, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(196,150,58,${p.o})`;
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
    });
    requestAnimationFrame(draw);
  }

  draw();
})();
