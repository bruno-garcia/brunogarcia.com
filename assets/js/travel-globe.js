// The small spinning globe in the landing page's row of social icons; it links to the full map at /travel/.
// Land is painted once into an equirectangular mask and each frame samples it per pixel through an inverse
// orthographic projection, so the horizon needs no polygon clipping. Visited places are drawn as dots on top.
(function () {
  const link = document.querySelector(".travel-globe");
  const canvas = link && link.querySelector("canvas");
  if (!canvas) return;

  const TILT = 20 * Math.PI / 180; // view from a little north of the equator
  const SPEED = 6; // degrees per second
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Follows the site's light/dark toggle, in the map's own colors: ocean, land, dots.
  const PALETTES = {
    dark: { ocean: [11, 15, 20], land: [40, 52, 68], dot: "#ffb03b" },
    light: { ocean: [223, 231, 240], land: [184, 196, 211], dot: "#d9541e" },
  };
  const palette = () => PALETTES[document.documentElement.dataset.theme === "light" ? "light" : "dark"];

  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let size, radius, image, lat, dlon, mask, points = [];
  const MASK_W = 1024, MASK_H = 512;

  function layout() {
    const css = canvas.clientWidth;
    size = Math.round(css * dpr);
    canvas.width = canvas.height = size;
    radius = size / 2 - dpr;
    image = ctx.createImageData(size, size);
    // Per pixel, the latitude and the longitude offset from the centre meridian; rotation only adds to the latter.
    lat = new Float32Array(size * size).fill(NaN);
    dlon = new Float32Array(size * size);
    const sinT = Math.sin(TILT), cosT = Math.cos(TILT);
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const x = (px + 0.5 - size / 2) / radius, y = (size / 2 - py - 0.5) / radius;
        const rho = Math.hypot(x, y);
        if (rho > 1) continue;
        const c = Math.asin(rho), sinC = Math.sin(c), cosC = Math.cos(c);
        const i = py * size + px;
        lat[i] = rho === 0 ? TILT : Math.asin(cosC * sinT + (y * sinC * cosT) / rho);
        dlon[i] = Math.atan2(x * sinC, rho * cosC * cosT - y * sinC * sinT);
      }
    }
  }

  function paintMask(land) {
    const off = document.createElement("canvas");
    off.width = MASK_W; off.height = MASK_H;
    const o = off.getContext("2d");
    o.fillStyle = "#000";
    const lx = (lon) => (lon + 180) / 360 * MASK_W, ly = (la) => (90 - la) / 180 * MASK_H;
    for (const f of land.features) {
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of polys) {
        // A ring crossing the antimeridian (Fiji, Chukotka) would smear across the whole mask, so unwrap its
        // longitudes into one continuous run and draw it again a world to either side.
        for (const shift of [-360, 0, 360]) {
          o.beginPath();
          for (const ring of poly) {
            let prev;
            ring.forEach(([lo, la], k) => {
              if (k) lo += Math.round((prev - lo) / 360) * 360;
              prev = lo;
              k ? o.lineTo(lx(lo + shift), ly(la)) : o.moveTo(lx(lo + shift), ly(la));
            });
          }
          o.fill("evenodd");
        }
      }
    }
    const data = o.getImageData(0, 0, MASK_W, MASK_H).data;
    mask = new Uint8Array(MASK_W * MASK_H);
    for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 127 ? 1 : 0;
  }

  function draw(rotation) {
    const px = image.data, n = size * size, { ocean, land, dot } = palette();
    for (let i = 0; i < n; i++) {
      const la = lat[i], j = i * 4;
      if (la !== la) { px[j + 3] = 0; continue; } // NaN: outside the disc
      let lo = dlon[i] + rotation;
      lo = ((lo + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); // 0..2π from -180°
      const mx = Math.min(MASK_W - 1, (lo / (2 * Math.PI) * MASK_W) | 0);
      const my = Math.min(MASK_H - 1, ((Math.PI / 2 - la) / Math.PI * MASK_H) | 0);
      const isLand = mask && mask[my * MASK_W + mx];
      const rgb = isLand ? land : ocean;
      px[j] = rgb[0]; px[j + 1] = rgb[1]; px[j + 2] = rgb[2]; px[j + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);

    // Dots, brighter towards the middle of the disc.
    const sinT = Math.sin(TILT), cosT = Math.cos(TILT), c = size / 2;
    // Dots scale with the globe: about a pixel across on a 120px globe, never smaller than half that.
    const dotRadius = Math.max(0.5, radius / dpr / 55) * dpr;
    ctx.fillStyle = dot;
    for (let k = 0; k < points.length; k += 2) {
      const la = points[k] * Math.PI / 180, lo = points[k + 1] * Math.PI / 180 - rotation;
      const cosLa = Math.cos(la), cosLo = Math.cos(lo);
      const depth = sinT * Math.sin(la) + cosT * cosLa * cosLo;
      if (depth <= 0) continue;
      ctx.globalAlpha = 0.35 + 0.65 * depth;
      ctx.beginPath();
      ctx.arc(c + radius * cosLa * Math.sin(lo), c - radius * (cosT * Math.sin(la) - sinT * cosLa * cosLo), dotRadius, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Rotation is the centre meridian; it falls over time so the surface moves west to east, as the Earth turns.
  let rotation = -40 * Math.PI / 180, last = 0, running = false;
  function frame(now) {
    if (last) rotation -= (now - last) / 1000 * SPEED * Math.PI / 180;
    last = now;
    draw(rotation);
    if (document.hidden) { running = false; last = 0; return; }
    requestAnimationFrame(frame);
  }
  function start() {
    if (running || reduceMotion) return;
    running = true;
    requestAnimationFrame(frame);
  }

  layout();
  draw(rotation);
  Promise.all([fetch("/travel/mini/land.json").then((r) => r.json()), fetch("/travel/mini/points.json").then((r) => r.json())])
    .then(([land, pts]) => {
      paintMask(land);
      points = pts;
      draw(rotation);
      start();
    })
    .catch(() => link.remove());

  document.addEventListener("visibilitychange", () => { if (!document.hidden) start(); });
  // Repaint on a theme change; when it spins, the next frame does that anyway.
  new MutationObserver(() => draw(rotation)).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
