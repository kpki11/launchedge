/* LaunchEdge Labs JS
   Hero particles + floating nodes + SVG connector lines
   v6 — Darker lines, edge-originating dots, draggable nodes
*/

// ── 1. Hero canvas particles ──────────────────────────
(function initLabsParticles() {
  const c = document.getElementById('labs-hero-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  let W, H, t = 0;
  const pts = [];

  function resize() {
    W = c.width  = c.offsetWidth;
    H = c.height = c.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 48; i++) {
    pts.push({
      x:    Math.random(),
      y:    Math.random(),
      r:    Math.random() * 1.8 + 0.4,
      speed: Math.random() * 0.0005 + 0.0002,
      phase: Math.random() * Math.PI * 2,
      amp:   Math.random() * 0.055 + 0.012
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    t += 0.006;
    pts.forEach(p => {
      const px = ((p.x + t * p.speed) % 1) * W;
      const py = (p.y + Math.sin(t * 1.1 + p.phase) * p.amp) * H;
      const alpha = Math.max(0.04, 0.18 + Math.sin(t * 0.9 + p.phase) * 0.10);
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(196,150,58,${alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

// ── 2. Floating product nodes + SVG connector lines ──
(function initProductNodes() {
  const svg   = document.getElementById('hero-connectors');
  const nodes = Array.from(document.querySelectorAll('#lhero-nodes .lnode'));
  if (!svg || !nodes.length) return;

  // Make nodes pointer-events-active for dragging
  const nodesWrap = document.getElementById('lhero-nodes');
  if (nodesWrap) nodesWrap.style.pointerEvents = 'none';
  nodes.forEach(n => { n.style.pointerEvents = 'auto'; });

  // Stagger nodes in
  nodes.forEach((n, i) => {
    setTimeout(() => n.classList.add('lnode-visible'), 500 + i * 160);
  });

  // ── DRAG SUPPORT ────────────────────────────────────
  nodes.forEach(node => {
    node.style.cursor = 'grab';
    let dragging = false, ox = 0, oy = 0, startX = 0, startY = 0;

    node.addEventListener('mousedown', e => {
      dragging = true;
      node.style.cursor = 'grabbing';
      node.style.transition = 'box-shadow 0.2s, border-color 0.2s';
      node.style.boxShadow = '0 16px 48px rgba(0,0,0,0.22), 0 0 0 2px rgba(196,150,58,0.5)';
      node.style.zIndex = '999';

      const rect = node.getBoundingClientRect();
      const parent = node.parentElement.getBoundingClientRect();
      ox = rect.left - parent.left;
      oy = rect.top  - parent.top;
      startX = e.clientX;
      startY = e.clientY;
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      node.style.left  = (ox + dx) + 'px';
      node.style.top   = (oy + dy) + 'px';
      node.style.right = 'auto';
      // Rebuild connector lines while dragging
      buildLines();
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      node.style.cursor = 'grab';
      node.style.zIndex = '';
      node.style.boxShadow = '';
    });

    // Touch support
    node.addEventListener('touchstart', e => {
      dragging = true;
      const rect = node.getBoundingClientRect();
      const parent = node.parentElement.getBoundingClientRect();
      ox = rect.left - parent.left;
      oy = rect.top  - parent.top;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      node.style.zIndex = '999';
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', e => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      node.style.left  = (ox + dx) + 'px';
      node.style.top   = (oy + dy) + 'px';
      node.style.right = 'auto';
      buildLines();
    }, { passive: true });

    document.addEventListener('touchend', () => {
      dragging = false;
      node.style.zIndex = '';
    });
  });

  const NS = 'http://www.w3.org/2000/svg';

  function getBox(node) {
    const svgR  = svg.getBoundingClientRect();
    const nodeR = node.getBoundingClientRect();
    const l = nodeR.left   - svgR.left;
    const t = nodeR.top    - svgR.top;
    const r = nodeR.right  - svgR.left;
    const b = nodeR.bottom - svgR.top;
    return { l, t, r, b, cx: (l+r)/2, cy: (t+b)/2, w: r-l, h: b-t };
  }

  // Find the point on the EDGE of box A facing box B
  function edgePt(A, B) {
    const dx = B.cx - A.cx;
    const dy = B.cy - A.cy;
    if (dx === 0 && dy === 0) return { x: A.cx, y: A.cy };
    const hw = A.w / 2;
    const hh = A.h / 2;
    const tX = Math.abs(dx) > 0.001 ? hw / Math.abs(dx) : Infinity;
    const tY = Math.abs(dy) > 0.001 ? hh / Math.abs(dy) : Infinity;
    const sc = Math.min(tX, tY);
    return {
      x: Math.max(A.l, Math.min(A.r,  A.cx + dx * sc)),
      y: Math.max(A.t, Math.min(A.b,  A.cy + dy * sc))
    };
  }

  function pathD(pA, pB) {
    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;
    const pull = Math.min(Math.abs(dx), Math.abs(dy)) * 0.5 + 30;
    const cx1 = pA.x + (Math.abs(dx) > Math.abs(dy) ? pull : 0) * Math.sign(dx);
    const cy1 = pA.y + (Math.abs(dy) >= Math.abs(dx) ? pull : 0) * Math.sign(dy);
    const cx2 = pB.x - (Math.abs(dx) > Math.abs(dy) ? pull : 0) * Math.sign(dx);
    const cy2 = pB.y - (Math.abs(dy) >= Math.abs(dx) ? pull : 0) * Math.sign(dy);
    return `M${pA.x.toFixed(1)},${pA.y.toFixed(1)} C${cx1.toFixed(1)},${cy1.toFixed(1)} ${cx2.toFixed(1)},${cy2.toFixed(1)} ${pB.x.toFixed(1)},${pB.y.toFixed(1)}`;
  }

  const lineStates = [];

  function buildLines() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    lineStates.length = 0;

    const animPairs   = [[0,1],[0,2],[0,3]];
    const dottedPairs = [[1,2],[1,3],[2,3]];

    // MUCH darker/stronger colors
    const animColors = [
      { base: 'rgba(10,10,8,0.80)', glow: 'rgba(10,10,8,1.0)',  dot: 'rgba(10,10,8,0.90)' },
      { base: 'rgba(10,10,8,0.80)',  glow: 'rgba(10,10,8,1.0)',   dot: 'rgba(10,10,8,0.90)'  },
      { base: 'rgba(10,10,8,0.80)', glow: 'rgba(10,10,8,1.0)',  dot: 'rgba(10,10,8,0.90)' },
    ];

    // ── Dotted lines between SOON nodes ──
    dottedPairs.forEach(([a, b]) => {
      const bA = getBox(nodes[a]);
      const bB = getBox(nodes[b]);
      const pA = edgePt(bA, bB);
      const pB = edgePt(bB, bA);

      const line = document.createElementNS(NS, 'path');
      line.setAttribute('d', pathD(pA, pB));
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', 'rgba(20,20,15,0.75)');
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('stroke-dasharray', '4 8');
      svg.appendChild(line);

      // Single dot at EACH endpoint (from card edge)
      [pA, pB].forEach(p => {
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', p.x.toFixed(1));
        dot.setAttribute('cy', p.y.toFixed(1));
        dot.setAttribute('r', '3');
        dot.setAttribute('fill', 'rgba(20,18,14,0.80)');
        svg.appendChild(dot);
      });
    });

    // ── Animated lines from Labs ──
    animPairs.forEach(([a, b], i) => {
      const bA  = getBox(nodes[a]);
      const bB  = getBox(nodes[b]);
      const pA  = edgePt(bA, bB);
      const pB  = edgePt(bB, bA);
      const d   = pathD(pA, pB);
      const col = animColors[i];

      // Static dashed base — much thicker and darker
      const base = document.createElementNS(NS, 'path');
      base.setAttribute('d', d);
      base.setAttribute('fill', 'none');
      base.setAttribute('stroke', col.base);
      base.setAttribute('stroke-width', '2');
      base.setAttribute('stroke-dasharray', '6 9');
      svg.appendChild(base);

      // Travelling glow dash
      const glow = document.createElementNS(NS, 'path');
      glow.setAttribute('d', d);
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke', col.glow);
      glow.setAttribute('stroke-width', '3');
      glow.setAttribute('stroke-dasharray', '24 800');
      glow.setAttribute('stroke-linecap', 'round');
      svg.appendChild(glow);
      lineStates.push({ el: glow, offset: -(i * 130), speed: 0.75 + i * 0.08 });

      // ONE dot per endpoint coming from the edge of the card
      [pA, pB].forEach(p => {
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', p.x.toFixed(1));
        dot.setAttribute('cy', p.y.toFixed(1));
        dot.setAttribute('r', '4');
        dot.setAttribute('fill', col.dot);
        svg.appendChild(dot);

        const ring = document.createElementNS(NS, 'circle');
        ring.setAttribute('cx', p.x.toFixed(1));
        ring.setAttribute('cy', p.y.toFixed(1));
        ring.setAttribute('r', '7.5');
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', col.dot);
        ring.setAttribute('stroke-width', '1.2');
        ring.setAttribute('opacity', '0.45');
        svg.appendChild(ring);
      });
    });
  }

  function animateLines() {
    lineStates.forEach(s => {
      s.offset -= s.speed;
      s.el.setAttribute('stroke-dashoffset', s.offset.toFixed(1));
    });
    requestAnimationFrame(animateLines);
  }

  setTimeout(() => {
    buildLines();
    animateLines();
  }, 1000);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildLines, 200);
  });
})();

// ── 3. Smooth scroll ─────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth' });
  });
});

