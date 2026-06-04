// -- Hero Video Engine --
// Strategy:
//   1. Play video hidden at 0.22x speed (slow dreamlike)
//   2. Each frame: draw to canvas + apply contrast/sharpen via ImageData
//   3. When video nears its end (last 0.3s): freeze on that frame
//   4. Trigger CSS zoom animation on the canvas for infinite-zoom feel
//   5. After zoom settles: crossfade back to start seamlessly

(function initHeroVideo() {
  const vid    = document.getElementById('hero-vid');
  const canvas = document.getElementById('hero-canvas');
  if (!vid || !canvas) return;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let frozen   = false;
  let zooming  = false;
  let raf      = null;

  // -- Resize canvas to match hero --
  function resize() {
    const hero = canvas.parentElement;
    canvas.width  = hero.offsetWidth;
    canvas.height = hero.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // -- Sharpen kernel (unsharp mask 3x3) --
  function sharpenFrame(imageData) {
    const d  = imageData.data;
    const w  = imageData.width;
    const h  = imageData.height;
    const out = new Uint8ClampedArray(d.length);
    // Kernel: centre=5, neighbours=-1 (edge enhance)
    const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    const strength = 0.55; // blend: 0=none, 1=full sharpen
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          let val = 0;
          val += d[((y-1)*w+(x-1))*4+c] * k[0];
          val += d[((y-1)*w+ x   )*4+c] * k[1];
          val += d[((y-1)*w+(x+1))*4+c] * k[2];
          val += d[( y   *w+(x-1))*4+c] * k[3];
          val += d[( y   *w+ x   )*4+c] * k[4];
          val += d[( y   *w+(x+1))*4+c] * k[5];
          val += d[( y+1)*w+(x-1))*4+c] * k[6];
          val += d[( y+1)*w+ x   )*4+c] * k[7];
          val += d[( y+1)*w+(x+1))*4+c] * k[8];
          out[i+c] = d[i+c] * (1 - strength) + val * strength;
        }
        out[i+3] = d[i+3]; // alpha unchanged
      }
    }
    imageData.data.set(out);
    return imageData;
  }

  // -- Contrast + saturation via CSS filter on canvas context --
  function setDrawFilter() {
    ctx.filter = 'contrast(1.28) saturate(1.38) brightness(1.06)';
  }

  // -- Draw one frame --
  function drawFrame() {
    if (frozen) return;
    setDrawFilter();
    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    // Sharpen only every 3rd frame (performance)
    if (Math.round(vid.currentTime * 30) % 3 === 0) {
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        ctx.putImageData(sharpenFrame(imgData), 0, 0);
      } catch(e) {}
    }
  }

  // -- Freeze last frame + trigger zoom --
  function freezeAndZoom() {
    if (zooming) return;
    zooming = true;
    frozen  = true;
    // Draw one final enhanced frame
    setDrawFilter();
    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    vid.pause();
    // Apply zoom animation
    canvas.style.animation = 'heroZoom 3.5s ease-in-out forwards';
    // After zoom: crossfade back to beginning
    setTimeout(function() {
      canvas.style.transition = 'opacity 0.6s';
      canvas.style.opacity    = '0';
      setTimeout(function() {
        vid.currentTime = 0;
        frozen  = false;
        zooming = false;
        canvas.style.animation  = '';
        canvas.style.transform  = '';
        canvas.style.opacity    = '1';
        vid.play();
        loop();
      }, 650);
    }, 3500);
  }

  // -- Main render loop --
  function loop() {
    drawFrame();
    // Check if near end (last 0.4s of 5s video)
    if (!frozen && vid.duration && vid.currentTime >= vid.duration - 0.4) {
      freezeAndZoom();
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  vid.addEventListener('loadedmetadata', function() {
    vid.playbackRate = 0.22;
    vid.play().then(function() {
      loop();
    }).catch(function() {
      loop();
    });
  });

  vid.addEventListener('play', function() {
    if (vid.playbackRate !== 0.22) vid.playbackRate = 0.22;
  });

})();

