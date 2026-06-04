// LaunchEdge — Mouse Parallax
// Applies subtle 3D tilt to a target element on mousemove

function initParallax(targetSelector, maxRot = 10) {
  const target = document.querySelector(targetSelector);
  if (!target) return;

  let tX = 0, tY = 0, cX = 0, cY = 0;

  document.addEventListener('mousemove', e => {
    tX = (e.clientX / innerWidth  - 0.5) * maxRot * 2;
    tY = (e.clientY / innerHeight - 0.5) * maxRot * 1.5;
  });

  (function lerp() {
    cX += (tX - cX) * 0.06;
    cY += (tY - cY) * 0.06;
    target.style.transform = `rotateY(${cX}deg) rotateX(${-cY}deg)`;
    requestAnimationFrame(lerp);
  })();
}

// Export for use
window.initParallax = initParallax;
