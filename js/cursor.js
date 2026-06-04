// LaunchEdge — Custom Cursor
const cursor = document.getElementById('cursor');
const ring   = document.getElementById('cursor-ring');
let mx = 0, my = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cursor.style.left = mx + 'px';
  cursor.style.top  = my + 'px';
});

(function animRing() {
  rx += (mx - rx) * 0.12;
  ry += (my - ry) * 0.12;
  ring.style.left = rx + 'px';
  ring.style.top  = ry + 'px';
  requestAnimationFrame(animRing);
})();

const interactives = 'button, a, .hero-card, .pcard, .bcard, .prompt-card, .profile-card, .social-btn, .talent-feat-card, .copilot-feat-card';

document.querySelectorAll(interactives).forEach(el => {
  el.addEventListener('mouseenter', () => {
    ring.style.width  = '54px';
    ring.style.height = '54px';
    ring.style.borderColor = 'rgba(196,150,58,0.8)';
  });
  el.addEventListener('mouseleave', () => {
    ring.style.width  = '36px';
    ring.style.height = '36px';
    ring.style.borderColor = 'rgba(196,150,58,0.5)';
  });
});
