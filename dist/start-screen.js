(function (root) {
  'use strict';
  const screen = document.getElementById('start-screen');
  const canvas = document.getElementById('forest-scene');
  const ctx = canvas.getContext('2d');
  const backdrop = document.createElement('canvas');
  const bg = backdrop.getContext('2d');
  const dialog = document.getElementById('settings-dialog');
  const speedInput = document.getElementById('default-speed');
  const motionInput = document.getElementById('ambient-motion');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const settings = { speed: 1, motion: !reducedMotion.matches };
  try {
    const saved = JSON.parse(localStorage.getItem('td-menu-settings'));
    if (saved?.speed === 1 || saved?.speed === 2) settings.speed = saved.speed;
    if (typeof saved?.motion === 'boolean') settings.motion = saved.motion;
  } catch { /* Storage can be unavailable for local files or private browsing. */ }
  speedInput.value = String(settings.speed);
  motionInput.checked = settings.motion;
  let images = null, animation = 0, running = true;
  function randomGenerator(seed) {
    return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  }
  function buildScene() {
    if (!images || !running) return;
    // Work at a low resolution, then enlarge without interpolation for crisp pixels.
    const w = Math.max(160, Math.ceil(screen.clientWidth / 3));
    const h = Math.max(100, Math.ceil(screen.clientHeight / 3));
    canvas.width = backdrop.width = w;
    canvas.height = backdrop.height = h;
    bg.imageSmoothingEnabled = ctx.imageSmoothingEnabled = false;
    const random = randomGenerator(98117);
    const sky = bg.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#425d3d'); sky.addColorStop(.42, '#849459'); sky.addColorStop(1, '#425d31');
    bg.fillStyle = sky; bg.fillRect(0, 0, w, h);
    // A sunlit opening through the trees, kept behind the title and wooden sign.
    const light = bg.createRadialGradient(w * .51, h * .24, 0, w * .5, h * .35, w * .56);
    light.addColorStop(0, '#d0c98066'); light.addColorStop(1, '#adb77500');
    bg.fillStyle = light; bg.fillRect(0, 0, w, h);
    function sprite(name, x, ground, scale, alpha = 1) {
      const img = images[name];
      if (!img) return;
      bg.globalAlpha = alpha;
      const sw = Math.round(img.naturalWidth * scale), sh = Math.round(img.naturalHeight * scale);
      bg.drawImage(img, Math.round(x - sw / 2), Math.round(ground - sh), sw, sh);
      bg.globalAlpha = 1;
    }
    // Distant forest: trunks and small crowns soften towards the clearing.
    for (let x = -10; x < w + 30; x += 13) {
      const ground = h * .42 + random() * 12;
      bg.fillStyle = '#3a513c55'; bg.fillRect(x, 0, 3 + Math.floor(random() * 3), ground);
      sprite(['pine', 'oak', 'birch'][Math.floor(random() * 3)], x, ground, .75 + random() * .35, .24);
    }
    // Pixel grass, scattered ground cover, and a winding path into the clearing.
    for (let i = 0; i < w * h / 25; i++) {
      const x = Math.floor(random() * w), y = Math.floor(h * .4 + random() * h * .6);
      bg.fillStyle = ['#a1a86433', '#304e3033', '#bbc16a22', '#69864166'][i % 4];
      bg.fillRect(x, y, 1 + Math.floor(random() * 3), 1);
    }
    for (let y = Math.floor(h * .51); y < h; y++) {
      const depth = (y / h - .51) / .49;
      const center = w * .5 + Math.sin(depth * 5) * w * .07;
      const half = 5 + depth * Math.min(w * .21, 95);
      bg.fillStyle = '#aa956055'; bg.fillRect(Math.floor(center - half - 4), y, Math.ceil(half * 2 + 8), 1);
      bg.fillStyle = '#b9a16a77'; bg.fillRect(Math.floor(center - half), y, Math.ceil(half * 2), 1);
      for (let n = 0; n < 3; n++) {
        bg.fillStyle = n % 2 ? '#dcc08355' : '#796b4655';
        bg.fillRect(Math.floor(center - half + random() * half * 2), y, 2, 1);
      }
    }
    for (let i = 0; i < Math.ceil(w / 5); i++) {
      const x = random() * w, ground = h * (.53 + random() * .48);
      if (Math.abs(x - w / 2) < w * .22) continue;
      sprite(['tuft', 'fern', 'whiteFlowers', 'pinkFlowers', 'pebble', 'grass'][i % 6], x, ground, .6 + random() * .8, .8);
    }
    // Layer full-size asset trees along both edges, leaving the menu readable.
    for (const side of [0, 1]) {
      const mirror = fraction => (side ? 1 - fraction : fraction) * w;
      sprite('pine', mirror(.27), h * .46, 1.6, .58);
      sprite('birch', mirror(.16), h * .57, 1.9, .82);
      sprite(side ? 'oak' : 'oldOak', mirror(.04), h * .72, 2.35);
      sprite(side ? 'oldOak' : 'oak', mirror(.04), h * .26, 2.7);
      sprite('roundTree', mirror(.25), h * .13, 1.9, .9);
      sprite('bush', mirror(.09), h * .83, 1.9);
      sprite(side ? 'mossRock' : 'fallenLog', mirror(.2), h * .92, 1.3);
      sprite(side ? 'flowers' : 'berryBush', mirror(.07), h * 1.02, 2);
      sprite('fern', mirror(.24), h * 1.01, 1.4);
      sprite('whiteFlowers', mirror(.32), h * .95, 1);
    }
    bg.fillStyle = '#1f38251f'; bg.fillRect(0, 0, w, h);
    render(0);
  }
  function render(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(backdrop, 0, 0);
    if (!settings.motion || reducedMotion.matches) return;
    const random = randomGenerator(912);
    for (let i = 0; i < 23; i++) {
      const x = random() * canvas.width + Math.sin(now / 3200 + i) * 4;
      const y = canvas.height * (.15 + random() * .75) + Math.cos(now / 4100 + i * 3) * 5;
      ctx.globalAlpha = .25 + (Math.sin(now / 1300 + i * 7) + 1) * .28;
      ctx.fillStyle = i % 3 ? '#eee5a1' : '#c3d97d';
      ctx.fillRect(Math.round(x), Math.round(y), i % 4 ? 1 : 2, 1);
    }
    ctx.globalAlpha = 1;
  }
  function animate(now) { render(now); animation = requestAnimationFrame(animate); }
  function syncAnimation() {
    cancelAnimationFrame(animation);
    if (!images || !running) return;
    render(0);
    if (settings.motion && !reducedMotion.matches && !document.hidden) animation = requestAnimationFrame(animate);
  }
  function save() {
    settings.speed = Number(speedInput.value) === 2 ? 2 : 1;
    settings.motion = motionInput.checked;
    try { localStorage.setItem('td-menu-settings', JSON.stringify(settings)); }
    catch { document.getElementById('settings-note').textContent = '瀏覽器無法儲存設定；本次遊戲仍會套用。'; }
    syncAnimation();
  }
  speedInput.addEventListener('change', save);
  motionInput.addEventListener('change', save);
  document.getElementById('settings-open').addEventListener('click', () => dialog.showModal());
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => document.getElementById('settings-open').focus());
  reducedMotion.addEventListener('change', syncAnimation);
  document.addEventListener('visibilitychange', syncAnimation);
  new ResizeObserver(buildScene).observe(screen);
  root.StartScreen = {
    settings,
    ready(loadedImages) { images = loadedImages; buildScene(); syncAnimation(); },
    stop() { running = false; cancelAnimationFrame(animation); },
    resume() { running = true; buildScene(); syncAnimation(); }
  };
})(window);
