/* =====================================================
   DAFTAR ISI
   1. Bahasa & Tema (button)
   2. Asap WebGL (efek kursor + asap saat klik)
   3. Lanyard interaktif (magnet + tarik + ketapel)
   4. Floating Theme Button (tema + bahasa)
   5. Galeri Hobi (geser / scroll kiri-kanan) + Photo Viewer
===================================================== */


/* =====================================================
   1. BAHASA & TEMA
===================================================== */

document.addEventListener("DOMContentLoaded", function () {

  // BUTTON
  const languageBtn = document.getElementById("languageBtn");
  const themeBtn = document.getElementById("themeBtn");

  // DEFAULT SETTINGS
  let currentLanguage = localStorage.getItem("language") || "id";
  let currentTheme = localStorage.getItem("theme") || "dark";

  // ----- Translate bahasa -----
  function changeLanguage() {
    document.querySelectorAll("[data-id][data-en]").forEach(element => {
      element.textContent = element.getAttribute(
        currentLanguage === "en" ? "data-en" : "data-id"
      );
    });

    // Teks tombol (hanya kalau tombolnya ada di HTML)
    if (languageBtn) {
      languageBtn.innerHTML =
        currentLanguage === "en" ? "🇮🇩 Indonesia" : "🇬🇧 English";
    }

    localStorage.setItem("language", currentLanguage);
  }

  if (languageBtn) {
    languageBtn.addEventListener("click", function () {
      currentLanguage = currentLanguage === "id" ? "en" : "id";
      changeLanguage();
    });
  }

  // ----- Light mode / dark mode -----
  function changeTheme() {
    if (currentTheme === "light") {
      document.body.classList.add("light-mode");
      if (themeBtn) themeBtn.innerHTML = "🌙 Dark";
    } else {
      document.body.classList.remove("light-mode");
      if (themeBtn) themeBtn.innerHTML = "☀️ Light";
    }

    localStorage.setItem("theme", currentTheme);
  }

  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      currentTheme = currentTheme === "dark" ? "light" : "dark";
      changeTheme();
    });
  }

  // ----- Pengaturan awal -----
  changeLanguage();
  changeTheme();
});


/* =====================================================
   2. ASAP WEBGL
===================================================== */

(() => {
  // ====== PENGATURAN ======
  const CFG = {
    color: [0.001, 0.001, 0.001], // warna asap (0-1). Putih = [1,1,1]
    simRes: 128,                  // resolusi simulasi gerak
    dyeRes: 1024,                 // resolusi asap (HD)
    radius: 0.005,                // ketebalan asap (kecil = tipis/wispy)
    density: 0.09,                // kepekatan tiap semburan
    force: 40,                    // dorongan dari gerakan mouse
    curl: 2,                      // pusaran/liukan
    buoyancy: 5,                 // seberapa kuat asap naik
    densityDissipation: 5,        // makin besar asap hilang makin cepat
    velocityDissipation: 3,

    // ====== ASAP SAAT KLIK ======
    clickBursts: 20,              // jumlah semburan tiap klik (makin banyak = makin tebal)
    clickDensity: 3,           // kepekatan tiap semburan
    clickForce: 10,               // kekuatan semburan menyebar
    clickRadiusMul: 1           // ukuran semburan (kali ketebalan asap normal)
  };

  // Ukuran asap menyesuaikan layar
  function updateSmokeSize() {
    if (window.innerWidth <= 600) {
      CFG.radius = 0.0025;  // HP: asap lebih kecil
    } else if (window.innerWidth <= 1024) {
      CFG.radius = 0.0035;  // Tablet: ukuran sedang
    } else {
      CFG.radius = 0.005;   // Laptop/PC: ukuran normal
    }
  }

  updateSmokeSize();
  window.addEventListener("resize", updateSmokeSize);

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.getElementById("smoke");
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false
  });
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) return; // browser tidak mendukung

  // ---------- Shader ----------
  const VS = `#version 300 es
  precision highp float;
  in vec2 aPosition;
  out vec2 vUv, vL, vR, vT, vB;
  uniform vec2 texelSize;
  void main(){
    vUv = aPosition * 0.5 + 0.5;
    vL = vUv - vec2(texelSize.x, 0.); vR = vUv + vec2(texelSize.x, 0.);
    vT = vUv + vec2(0., texelSize.y); vB = vUv - vec2(0., texelSize.y);
    gl_Position = vec4(aPosition, 0., 1.);
  }`;

  const H = `#version 300 es
  precision highp float; precision highp sampler2D;
  in vec2 vUv, vL, vR, vT, vB; out vec4 o;`;

  const FS = {
    splat: `uniform sampler2D uTarget; uniform float aspect, radius; uniform vec3 color; uniform vec2 point;
      void main(){ vec2 p = vUv - point; p.x *= aspect;
        o = vec4(texture(uTarget, vUv).xyz + exp(-dot(p,p)/radius) * color, 1.); }`,
    advect: `uniform sampler2D uVelocity, uSource; uniform vec2 texelSize; uniform float dt, dissipation;
      void main(){ vec2 c = vUv - dt * texture(uVelocity, vUv).xy * texelSize;
        o = texture(uSource, c) / (1. + dissipation * dt); }`,
    divergence: `uniform sampler2D uVelocity;
      void main(){
        float L = texture(uVelocity, vL).x, R = texture(uVelocity, vR).x, T = texture(uVelocity, vT).y, B = texture(uVelocity, vB).y;
        vec2 C = texture(uVelocity, vUv).xy;
        if (vL.x < 0.) L = -C.x; if (vR.x > 1.) R = -C.x; if (vT.y > 1.) T = -C.y; if (vB.y < 0.) B = -C.y;
        o = vec4(.5 * (R - L + T - B), 0., 0., 1.); }`,
    curl: `uniform sampler2D uVelocity;
      void main(){
        float L = texture(uVelocity, vL).y, R = texture(uVelocity, vR).y, T = texture(uVelocity, vT).x, B = texture(uVelocity, vB).x;
        o = vec4(.5 * (R - L - T + B), 0., 0., 1.); }`,
    vorticity: `uniform sampler2D uVelocity, uCurl; uniform float curl, dt;
      void main(){
        float L = texture(uCurl, vL).x, R = texture(uCurl, vR).x, T = texture(uCurl, vT).x, B = texture(uCurl, vB).x, C = texture(uCurl, vUv).x;
        vec2 f = .5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        f /= length(f) + .0001; f *= curl * C; f.y *= -1.;
        vec2 v = texture(uVelocity, vUv).xy + f * dt;
        o = vec4(clamp(v, -1000., 1000.), 0., 1.); }`,
    buoyancy: `uniform sampler2D uVelocity, uDye; uniform float k, dt;
      void main(){ vec2 v = texture(uVelocity, vUv).xy; v.y += texture(uDye, vUv).x * k * dt * 60.; o = vec4(v, 0., 1.); }`,
    clear: `uniform sampler2D uTexture; uniform float value;
      void main(){ o = value * texture(uTexture, vUv); }`,
    pressure: `uniform sampler2D uPressure, uDivergence;
      void main(){
        float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x, T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
        o = vec4((L + R + B + T - texture(uDivergence, vUv).x) * .25, 0., 0., 1.); }`,
    gradient: `uniform sampler2D uPressure, uVelocity;
      void main(){
        float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x, T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
        vec2 v = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
        o = vec4(v, 0., 1.); }`,
    display: `uniform sampler2D uTexture; uniform vec3 tint;
      void main(){ vec3 c = texture(uTexture, vUv).rgb;
        float a = 1. - exp(-max(c.r, max(c.g, c.b)) * 1.8);
        o = vec4(tint * a, a); }`
  };

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, VS);
  const P = {};

  for (const name in FS) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, H + FS[name]));
    gl.bindAttribLocation(p, 0, "aPosition");
    gl.linkProgram(p);

    const u = {};
    for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) {
      const n = gl.getActiveUniform(p, i).name;
      u[n] = gl.getUniformLocation(p, n);
    }
    P[name] = { p, u };
  }

  // Quad layar penuh
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // ---------- Framebuffer ----------
  function fbo(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);

    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    return { tex, f, w, h, tx: 1 / w, ty: 1 / h };
  }

  function dbl(w, h) {
    return {
      a: fbo(w, h), b: fbo(w, h), w, h, tx: 1 / w, ty: 1 / h,
      get read() { return this.a; },
      get write() { return this.b; },
      swap() { const t = this.a; this.a = this.b; this.b = t; }
    };
  }

  function res(size) {
    let ar = canvas.width / canvas.height;
    if (ar < 1) ar = 1 / ar;
    const mn = Math.round(size), mx = Math.round(size * ar);
    return canvas.width > canvas.height ? [mx, mn] : [mn, mx];
  }

  let vel, dye, prs, div, crl, aspect;

  function init() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    aspect = canvas.width / canvas.height;

    const [sw, sh] = res(CFG.simRes), [dw, dh] = res(CFG.dyeRes);
    vel = dbl(sw, sh);
    dye = dbl(dw, dh);
    prs = dbl(sw, sh);
    div = fbo(sw, sh);
    crl = fbo(sw, sh);
  }

  init();
  addEventListener("resize", init);

  // ---------- Jalankan satu pass ----------
  function run(pr, uni, target) {
    gl.useProgram(pr.p);
    let unit = 0;

    for (const k in uni) {
      const v = uni[k], loc = pr.u[k];
      if (loc == null) continue;

      if (typeof v === "number") {
        gl.uniform1f(loc, v);
      } else if (Array.isArray(v)) {
        v.length === 2 ? gl.uniform2f(loc, v[0], v[1]) : gl.uniform3f(loc, v[0], v[1], v[2]);
      } else {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, v.tex);
        gl.uniform1i(loc, unit++);
      }
    }

    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.f);
      gl.viewport(0, 0, target.w, target.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ---------- Simulasi ----------
  function step(dt) {
    const T = [vel.tx, vel.ty];

    run(P.curl, { texelSize: T, uVelocity: vel.read }, crl);

    run(P.vorticity, { texelSize: T, uVelocity: vel.read, uCurl: crl, curl: CFG.curl, dt }, vel.write);
    vel.swap();

    run(P.buoyancy, { texelSize: T, uVelocity: vel.read, uDye: dye.read, k: CFG.buoyancy, dt }, vel.write);
    vel.swap();

    run(P.divergence, { texelSize: T, uVelocity: vel.read }, div);

    run(P.clear, { texelSize: T, uTexture: prs.read, value: 0.8 }, prs.write);
    prs.swap();

    for (let i = 0; i < 20; i++) {
      run(P.pressure, { texelSize: T, uPressure: prs.read, uDivergence: div }, prs.write);
      prs.swap();
    }

    run(P.gradient, { texelSize: T, uPressure: prs.read, uVelocity: vel.read }, vel.write);
    vel.swap();

    run(P.advect, { texelSize: T, uVelocity: vel.read, uSource: vel.read, dt, dissipation: CFG.velocityDissipation }, vel.write);
    vel.swap();

    run(P.advect, { texelSize: T, uVelocity: vel.read, uSource: dye.read, dt, dissipation: CFG.densityDissipation }, dye.write);
    dye.swap();
  }

  // ---------- Render ----------
  function render() {
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const isLight = document.body.classList.contains("light-mode");

    const smokeColor = isLight
      ? [0.45, 0.45, 0.45]   // LIGHT MODE: abu-abu
      : [0.85, 0.85, 0.85];  // DARK MODE: putih redup

    run(P.display, {
      texelSize: [1 / canvas.width, 1 / canvas.height],
      uTexture: dye.read,
      tint: smokeColor
    }, null);
  }

  // ---------- Semburan asap ----------
  // r = ukuran semburan (default: ketebalan asap normal)
  function splat(x, y, dx, dy, amt, r = CFG.radius) {
    run(P.splat, { texelSize: [vel.tx, vel.ty], uTarget: vel.read, aspect, point: [x, y], color: [dx, dy, 0], radius: r }, vel.write);
    vel.swap();

    run(P.splat, { texelSize: [dye.tx, dye.ty], uTarget: dye.read, aspect, point: [x, y], color: [amt, amt, amt], radius: r }, dye.write);
    dye.swap();
  }

  // ---------- Input ----------
  let lx = null, ly = 0;

  // Asap mengikuti gerakan kursor
  addEventListener("pointermove", (e) => {
    const x = e.clientX / innerWidth;
    const y = 1 - e.clientY / innerHeight;

    if (lx === null) { lx = x; ly = y; return; }

    const dx = x - lx, dy = y - ly;
    const px = Math.hypot(dx * innerWidth, dy * innerHeight);
    const n = Math.min(40, Math.max(1, Math.ceil(px / 12)));

    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const head = i === n ? 2.2 : 1; // kepala asap lebih terang di posisi kursor
      splat(
        lx + dx * t, ly + dy * t,
        (dx * vel.w * CFG.force) / n, (dy * vel.h * CFG.force) / n,
        CFG.density * head
      );
    }

    lx = x; ly = y;
  }, { passive: true });

  // Asap meledak saat klik / tap
  addEventListener("pointerdown", (e) => {
    const x = e.clientX / innerWidth;
    const y = 1 - e.clientY / innerHeight;

    for (let i = 0; i < CFG.clickBursts; i++) {
      const angle = Math.random() * Math.PI * 2;
      const power = CFG.clickForce * (0.4 + Math.random() * 0.8);
      const spread = 0.004 + Math.random() * 0.006;

      splat(
        x + Math.cos(angle) * spread,
        y + Math.sin(angle) * spread,
        Math.cos(angle) * power,
        Math.sin(angle) * power,
        CFG.clickDensity,
        CFG.radius * CFG.clickRadiusMul
      );
    }

    lx = x;
    ly = y;
  }, { passive: true });

  document.addEventListener("mouseleave", () => { lx = null; });

  // ---------- Loop ----------
  let last = performance.now();

  (function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.0166);
    last = now;
    step(dt);
    render();
    requestAnimationFrame(loop);
  })(last);
})();


/* =====================================================
   3. LANYARD INTERAKTIF
===================================================== */

(() => {
  /* =====================================================
     LANYARD INTERAKTIF
     Auto Swing + Magnet + Tarik + Lepas
  ===================================================== */

  /* ====== PENGATURAN ====== */
  const LCFG = {
    gravity: 0.55,
    damping: 0.992,
    elastic: 0.7,
    magnetBase: 120,
    magnetPower: 0.18,
    iterations: 14,

    // AUTO SWING
    swingSpeed: 0.0008,      // Kecepatan ayunan
    swingAmplitude: 14       // Lebar ayunan dalam pixel
  };

  const PHOTO = "card2.jpg";

  const cv = document.getElementById("c");
  if (!cv) return;

  const ctx = cv.getContext("2d");
  const img = new Image();

  let W, Hh, DPR, scale = 1;
  let K = 7, pts = [], seg, cardLen, cw, ch;
  let hook = 18, ax, ay = -10;
  let magnetRadius = LCFG.magnetBase;

  // AUTO SWING VARIABLES
  let swingTime = 0;
  let previousSwingOffset = 0;
  let swingAmplitude = LCFG.swingAmplitude;

  const mouse = { x: -999, y: -999, in: false };

  let grab = null;
  let grabOff = { x: 0, y: 0 };
  let magnet = 0;

  /* =====================================================
     SETUP UKURAN & POSISI
  ===================================================== */

  function setup() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);

    W = innerWidth;
    Hh = innerHeight;

    cv.width = W * DPR;
    cv.height = Hh * DPR;

    // Skala responsif
    if (W <= 480) scale = 0.55;
    else if (W <= 768) scale = 0.68;
    else if (W <= 1024) scale = 0.8;
    else scale = 1;

    // Ukuran kartu
    ch = Math.max(150, Math.min(Hh * 0.5, 440)) * scale;
    cw = ch * img.naturalWidth / img.naturalHeight;

    // Ukuran pengait
    hook = 18 * scale;

    // Panjang tali
    const strapLen = Math.max(90, Math.min(Hh * 0.28, 250)) * scale;

    seg = strapLen / K;
    cardLen = hook + ch;

    // Posisi gantungan
    ax = W * 0.88;
    ay = -10;

    // Reset titik tali
    pts = [];

    for (let i = 0; i <= K + 1; i++) {
      const y = ay + (i <= K ? i * seg : K * seg + cardLen);

      const x = ax + (i === K + 1 ? 90 * scale : i > 3 ? 30 * scale : 0);

      pts.push({
        x,
        y: y - 250 * scale,
        ox: x,
        oy: y - 250 * scale
      });
    }

    // Jangkauan magnet
    magnetRadius = LCFG.magnetBase * scale;

    // Skala ayunan
    swingAmplitude = LCFG.swingAmplitude * scale;

    // Reset posisi ayunan
    previousSwingOffset = 0;
  }

  /* =====================================================
     FISIKA
  ===================================================== */

  function physics(deltaTime) {

    // =================================
    // AUTO SWING KANAN KIRI
    // =================================

    swingTime += deltaTime * LCFG.swingSpeed;

    const currentSwingOffset =
      Math.sin(swingTime) * swingAmplitude;

    const swingDelta =
      currentSwingOffset - previousSwingOffset;

    // Ayunan tetap aktif selama kartu tidak ditarik
    if (!grab) {

      for (let i = 1; i <= K + 1; i++) {

        const p = pts[i];
        const strength = i / (K + 1);

        const movement = swingDelta * strength;

        // Geser posisi tanpa menambahkan momentum palsu
        p.x += movement;
        p.ox += movement;
      }
    }

    previousSwingOffset = currentSwingOffset;

    // =================================
    // MAGNET CURSOR
    // =================================

    magnet = 0;

    if (mouse.in && !grab) {

      const R = magnetRadius;

      const cx = (pts[K].x + pts[K + 1].x) / 2;
      const cy = (pts[K].y + pts[K + 1].y) / 2;

      for (let i = 1; i <= K + 1; i++) {

        const p = pts[i];

        const d = i >= K
          ? Math.hypot(mouse.x - cx, mouse.y - cy) - ch * 0.35
          : Math.hypot(mouse.x - p.x, mouse.y - p.y);

        if (d < R) {

          const f = Math.pow(
            1 - Math.max(d, 0) / R,
            2
          );

          magnet = Math.max(magnet, f);

          p.x += (mouse.x - p.x) * f * LCFG.magnetPower;
          p.y += (mouse.y - p.y) * f * LCFG.magnetPower;
        }
      }
    }

    // =================================
    // VERLET PHYSICS
    // =================================

    for (let i = 1; i < pts.length; i++) {

      const p = pts[i];

      if (p === grab) continue;

      const vx = (p.x - p.ox) * LCFG.damping;
      const vy = (p.y - p.oy) * LCFG.damping;

      p.ox = p.x;
      p.oy = p.y;

      p.x += vx;
      p.y += vy + LCFG.gravity;
    }

    // =================================
    // TITIK YANG DITARIK
    // =================================

    if (grab) {

      grab.ox = grab.x;
      grab.oy = grab.y;

      grab.x += (mouse.x + grabOff.x - grab.x) * 0.6;
      grab.y += (mouse.y + grabOff.y - grab.y) * 0.6;
    }

    // =================================
    // TITIK GANTUNGAN TERKUNCI
    // =================================

    pts[0].x = ax;
    pts[0].y = ay;

    pts[0].ox = ax;
    pts[0].oy = ay;

    // =================================
    // CONSTRAINT PANJANG TALI
    // =================================

    for (let it = 0; it < LCFG.iterations; it++) {

      for (let i = 0; i <= K; i++) {

        const a = pts[i];
        const b = pts[i + 1];

        const isLast = i === K;

        const rest = isLast ? cardLen : seg;
        const k = isLast ? 1 : LCFG.elastic;

        const wa = (i === 0 || a === grab) ? 0 : 1;
        const wb = b === grab ? 0 : (isLast ? 0.35 : 1);

        const t = wa + wb;

        if (!t) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;

        const d = Math.hypot(dx, dy) || 0.0001;

        const diff = (d - rest) / d * k;

        a.x += dx * diff * wa / t;
        a.y += dy * diff * wa / t;

        b.x -= dx * diff * wb / t;
        b.y -= dy * diff * wb / t;
      }
    }
  }

  /* =====================================================
     GAMBAR
  ===================================================== */

  function rr(x, y, w, h, r) {

    ctx.beginPath();

    ctx.roundRect
      ? ctx.roundRect(x, y, w, h, r)
      : ctx.rect(x, y, w, h);
  }

  /* =====================================================
     GAMBAR TALI
  ===================================================== */

  function drawStrap() {

    let len = 0;
    const cum = [0];

    for (let i = 1; i <= K; i++) {

      len += Math.hypot(
        pts[i].x - pts[i - 1].x,
        pts[i].y - pts[i - 1].y
      );

      cum.push(len);
    }

    const stretch = Math.max(
      0.55,
      Math.min(1, (seg * K) / len)
    );

    const sw = 24 * stretch;

    const path = () => {

      ctx.beginPath();

      ctx.moveTo(pts[0].x, pts[0].y);

      for (let i = 1; i < K; i++) {

        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;

        ctx.quadraticCurveTo(
          pts[i].x,
          pts[i].y,
          mx,
          my
        );
      }

      ctx.lineTo(pts[K].x, pts[K].y);
    };

    ctx.lineCap = "butt";
    ctx.lineJoin = "round";

    ctx.strokeStyle = "#4a4a4f";
    ctx.lineWidth = sw + 2;

    path();
    ctx.stroke();

    ctx.strokeStyle = "#3d9ad4";
    ctx.lineWidth = sw;

    path();
    ctx.stroke();

    // Teks mengikuti lengkungan tali
    const at = s => {

      let i = 1;

      while (i < K && cum[i] < s) i++;

      const t = (s - cum[i - 1]) /
        ((cum[i] - cum[i - 1]) || 1);

      const a = pts[i - 1];
      const b = pts[i];

      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        r: Math.atan2(
          b.y - a.y,
          b.x - a.x
        )
      };
    };

    const txt = "RAMZI RAZIDSKY";
    const gap = 11.5 * stretch;

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font =
      "800 " + (13 * stretch) +
      'px "Plus Jakarta Sans",system-ui,sans-serif';

    let s = 24;

    for (const c of txt) {

      if (s > len - 8) break;

      const q = at(s);

      ctx.save();

      ctx.translate(q.x, q.y);
      ctx.rotate(q.r + Math.PI / 2);

      ctx.fillText(c, 0, 0);

      ctx.restore();

      s += gap;
    }
  }

  /* =====================================================
     GAMBAR KARTU
  ===================================================== */

  function drawCard() {

    const k = pts[K];
    const b = pts[K + 1];

    const ang = Math.atan2(
      b.y - k.y,
      b.x - k.x
    ) - Math.PI / 2;

    ctx.save();

    ctx.translate(k.x, k.y);
    ctx.rotate(ang);

    // Kait
    ctx.strokeStyle = "#73bbd3";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    ctx.beginPath();

    ctx.moveTo(0, 8);
    ctx.lineTo(0, hook + ch * 0.045);

    ctx.stroke();

    // Bayangan + dasar kartu
    ctx.save();

    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;

    rr(-cw / 2, hook, cw, ch, 16);

    ctx.fillStyle = "#05060a";
    ctx.fill();

    ctx.restore();

    // Foto kartu
    rr(-cw / 2, hook, cw, ch, 16);

    ctx.save();

    ctx.clip();

    ctx.drawImage(
      img,
      -cw / 2,
      hook,
      cw,
      ch
    );

    ctx.restore();

    // Garis tepi kartu
    rr(-cw / 2, hook, cw, ch, 16);

    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = 1;

    ctx.stroke();

    // Klip logam
    const g = ctx.createLinearGradient(-18, 0, 18, 0);

    g.addColorStop(0, "#6d6f77");
    g.addColorStop(0.5, "#e4e5ea");
    g.addColorStop(1, "#6d6f77");

    rr(-18, -10, 36, 22, 6);

    ctx.fillStyle = g;
    ctx.fill();

    ctx.strokeStyle = "#2a2b30";
    ctx.lineWidth = 1.5;

    ctx.stroke();

    ctx.restore();
  }

  /* =====================================================
     ANIMATION FRAME
  ===================================================== */

  let lastFrame = 0;

  function frame(timestamp) {

    // Hitung delta waktu agar animasi konsisten
    const deltaTime = lastFrame
      ? Math.min(timestamp - lastFrame, 32)
      : 16;

    lastFrame = timestamp;

    physics(deltaTime);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    ctx.clearRect(0, 0, W, Hh);

    // Cahaya magnet di cursor
    if (magnet > 0.01 || grab) {

      const R = magnetRadius;

      const g = ctx.createRadialGradient(
        mouse.x,
        mouse.y,
        0,
        mouse.x,
        mouse.y,
        R
      );

      g.addColorStop(
        0,
        "rgba(160,190,255," +
        (grab ? 0.22 : 0.08 + magnet * 0.3) +
        ")"
      );

      g.addColorStop(1, "rgba(160,190,255,0)");

      ctx.fillStyle = g;

      ctx.fillRect(
        mouse.x - R,
        mouse.y - R,
        R * 2,
        R * 2
      );
    }

    drawStrap();
    drawCard();

    document.body.style.cursor = grab
      ? "grabbing"
      : (magnet > 0.05 ? "grab" : "");

    requestAnimationFrame(frame);
  }

  /* =====================================================
     INTERAKSI
  ===================================================== */

  function pick(p) {

    const cx = (pts[K].x + pts[K + 1].x) / 2;
    const cy = (pts[K].y + pts[K + 1].y) / 2;

    // Klik kartu
    if (Math.hypot(p.x - cx, p.y - cy) < ch * 0.6) {
      return pts[K + 1];
    }

    // Klik tali
    let best = null;
    let bd = 1e9;

    for (let i = 1; i <= K; i++) {

      const d = Math.hypot(
        p.x - pts[i].x,
        p.y - pts[i].y
      );

      if (d < bd) {
        bd = d;
        best = pts[i];
      }
    }

    return bd < magnetRadius * 0.7 ? best : null;
  }

  // Gerakan cursor
  addEventListener("pointermove", e => {

    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.in = true;

  });

  // Cursor keluar layar
  document.documentElement.addEventListener("mouseleave", () => {

    if (!grab) mouse.in = false;

  });

  // Tarik lanyard
  addEventListener("pointerdown", e => {

    if (!pts.length) return;

    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.in = true;

    const best = pick(mouse);

    if (best) {

      grab = best;

      grabOff.x = best.x - mouse.x;
      grabOff.y = best.y - mouse.y;

      e.preventDefault();
    }

  });

  // Lepaskan lanyard
  const release = e => {

    if (grab) {

      grab = null;

      if (e.pointerType !== "mouse") {
        mouse.in = false;
      }
    }
  };

  addEventListener("pointerup", release);
  addEventListener("pointercancel", release);

  // HP: blok scroll hanya saat menyentuh lanyard
  addEventListener("touchstart", e => {

    if (!pts.length) return;

    const t = e.touches[0];

    if (pick({
      x: t.clientX,
      y: t.clientY
    })) {
      e.preventDefault();
    }

  }, { passive: false });

  addEventListener("touchmove", e => {

    if (grab) e.preventDefault();

  }, { passive: false });

  // Responsif ketika ukuran layar berubah
  addEventListener("resize", () => {

    if (img.naturalWidth) {
      setup();
    }

  });

  /* =====================================================
     START
  ===================================================== */

  img.onload = () => {

    setup();

    lastFrame = 0;

    requestAnimationFrame(frame);
  };

  img.src = PHOTO;

})();


/* =====================================================
   4. FLOATING THEME BUTTON (tema + bahasa)
===================================================== */

const themeWidget = document.getElementById("themeWidget");
const themeFab = document.getElementById("themeFab");
const themeMenu = document.getElementById("themeMenu");
const themeIcon = document.getElementById("themeIcon");

let currentTheme = localStorage.getItem("theme") || "dark";
let currentLang = localStorage.getItem("language") || "id";
let isDragging = false;
let moved = false;

let startX = 0;
let startY = 0;
let initialX = 0;
let initialY = 0;

// ====== PENGATURAN IKON GANTI-GANTI ======
const LANG_ICON = "🌐";     // ikon bahasa
const SWAP_INTERVAL = 1000; // ganti ikon tiap berapa ms (1000 = 1 detik)
let showLangIcon = false;

// ----- Ikon tombol bulat -----
function renderFabIcon() {
  themeIcon.textContent = showLangIcon
    ? LANG_ICON
    : (currentTheme === "light" ? "☀️" : "🌙");
}

function swapFabIcon() {
  themeIcon.classList.add("swap");

  setTimeout(() => {
    showLangIcon = !showLangIcon;
    renderFabIcon();
    themeIcon.classList.remove("swap");
  }, 200);
}

// Berhenti ganti-ganti kalau pengguna mengaktifkan "reduce motion"
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  setInterval(swapFabIcon, SWAP_INTERVAL);
}

// ----- Set tema -----
function setTheme(theme) {
  currentTheme = theme;

  document.body.classList.toggle(
    "light-mode",
    theme === "light"
  );

  localStorage.setItem("theme", theme);

  document.querySelectorAll(".theme-option[data-theme]").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.theme === theme);
  });

  renderFabIcon();
}

// ----- Set bahasa -----
function setLanguage(lang) {
  currentLang = lang;

  document.querySelectorAll("[data-id][data-en]").forEach(element => {
    element.textContent = element.getAttribute(
      lang === "en" ? "data-en" : "data-id"
    );
  });

  document.documentElement.lang = lang;

  localStorage.setItem("language", lang);

  document.querySelectorAll(".theme-option[data-lang]").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.lang === lang);
  });
}

// Pengaturan awal
setTheme(currentTheme);
setLanguage(currentLang);

// ----- Buka / tutup menu -----
themeFab.addEventListener("click", () => {
  if (moved) return;

  themeMenu.classList.toggle("active");
});

// ----- Pilih tema -----
document.querySelectorAll(".theme-option[data-theme]").forEach(option => {
  option.addEventListener("click", () => {
    setTheme(option.dataset.theme);
    themeMenu.classList.remove("active");
  });
});

// ----- Pilih bahasa -----
document.querySelectorAll(".theme-option[data-lang]").forEach(option => {
  option.addEventListener("click", () => {
    setLanguage(option.dataset.lang);
    themeMenu.classList.remove("active");
  });
});

// ----- Tutup menu saat klik di luar -----
document.addEventListener("click", (e) => {
  if (!themeWidget.contains(e.target)) {
    themeMenu.classList.remove("active");
  }
});

// ----- Drag button -----
themeFab.addEventListener("pointerdown", (e) => {
  isDragging = true;
  moved = false;

  startX = e.clientX;
  startY = e.clientY;

  const rect = themeWidget.getBoundingClientRect();

  initialX = rect.left;
  initialY = rect.top;

  themeFab.setPointerCapture(e.pointerId);
});

themeFab.addEventListener("pointermove", (e) => {
  if (!isDragging) return;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
    moved = true;
  }

  if (!moved) return;

  const maxX = window.innerWidth - themeWidget.offsetWidth;
  const maxY = window.innerHeight - themeWidget.offsetHeight;

  const newX = Math.max(0, Math.min(maxX, initialX + dx));
  const newY = Math.max(0, Math.min(maxY, initialY + dy));

  themeWidget.style.left = newX + "px";
  themeWidget.style.top = newY + "px";
});

themeFab.addEventListener("pointerup", () => {
  isDragging = false;

  // Supaya klik setelah drag tidak membuka menu
  if (moved) {
    setTimeout(() => {
      moved = false;
    }, 100);
  }
});

themeFab.addEventListener("pointercancel", () => {
  isDragging = false;
  moved = false;
});


/* =====================================================
   5. GALERI HOBI (geser / scroll kiri-kanan)
===================================================== */

// ----- Photo viewer (dipakai oleh onclick di HTML) -----
if (typeof window.openPhoto !== "function") {
  window.openPhoto = function (el) {
    const viewer = document.getElementById("photoViewer");
    const big = document.getElementById("expandedPhoto");
    if (!viewer || !big) return;

    big.src = el.currentSrc || el.src;
    big.alt = el.alt || "";
    viewer.classList.add("active");
  };
}

if (typeof window.closePhoto !== "function") {
  window.closePhoto = function () {
    const viewer = document.getElementById("photoViewer");
    if (viewer) viewer.classList.remove("active");
  };
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.closePhoto();
});


(() => {
  const gallery = document.getElementById("hobbyGallery");
  if (!gallery) return;

  const cards = Array.from(gallery.querySelectorAll(".hobby-card"));
  const total = cards.length;
  if (!total) return;

  /* ====== PENGATURAN ====== */
  const HCFG = {
    spacing: 1.12,    // jarak antar kartu (kali lebar kartu)
    tilt: 5.5,        // kemiringan tiap kartu (derajat)
    curve: 9,         // lengkungan: makin besar, kartu pinggir makin turun
    scaleDrop: 0.05,  // kartu pinggir mengecil sedikit
    ease: 0.14,       // kehalusan gerak (0.05 = lambat, 0.3 = cepat)
    throw: 220        // seberapa jauh kartu meluncur saat di-swipe
  };

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // Mulai dari kartu tengah
  let pos = Math.floor((total - 1) / 2);
  let target = pos;

  let dragging = false;
  let dragged = false;
  let startX = 0;
  let startPos = 0;
  let lastX = 0;
  let lastT = 0;
  let vx = 0;
  let downCard = null;
  let pointerId = null;
  let raf = 0;

  const stepPx = () => (cards[0].offsetWidth || 150) * HCFG.spacing;

  /* ----- Gambar posisi semua kartu ----- */
  function render() {
    const sp = stepPx();

    cards.forEach((card, i) => {
      const off = i - pos;
      const a = Math.abs(off);

      const x = off * sp;
      const y = off * off * HCFG.curve;
      const rot = off * HCFG.tilt;
      const scale = 1 - Math.min(a, 3) * HCFG.scaleDrop;
      const opacity = clamp(1 - (a - 1.5) / 1.7, 0, 1);

      card.style.transform =
        "translate(calc(-50% + " + x + "px), " + y + "px) " +
        "rotate(" + rot + "deg) scale(" + scale + ")";

      card.style.opacity = opacity;
      card.style.zIndex = 100 - Math.round(a * 10);
      card.style.pointerEvents = opacity < 0.05 ? "none" : "auto";
    });
  }

  /* ----- Animasi menuju target ----- */
  function tick() {
    raf = 0;

    if (!dragging) {
      const diff = target - pos;

      if (reduce || Math.abs(diff) < 0.001) {
        pos = target;
      } else {
        pos += diff * HCFG.ease;
      }
    }

    render();

    if (dragging || Math.abs(target - pos) > 0.001) {
      raf = requestAnimationFrame(tick);
    }
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function go(i) {
    target = clamp(Math.round(i), 0, total - 1);
    kick();
  }

  /* ----- Geser dengan mouse / jari ----- */
  gallery.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    dragging = true;
    dragged = false;

    startX = lastX = e.clientX;
    startPos = pos;
    lastT = performance.now();
    vx = 0;

    downCard = e.target.closest(".hobby-card");
    pointerId = e.pointerId;

    gallery.setPointerCapture(pointerId);
    gallery.classList.add("dragging");

    kick();
  });

  gallery.addEventListener("pointermove", (e) => {
    if (!dragging) return;

    const dx = e.clientX - startX;

    if (Math.abs(dx) > 6) dragged = true;

    const now = performance.now();
    const dt = now - lastT;

    if (dt > 0) {
      vx = vx * 0.8 + ((e.clientX - lastX) / dt) * 0.2;
    }

    lastX = e.clientX;
    lastT = now;

    pos = clamp(startPos - dx / stepPx(), -0.35, total - 1 + 0.35);
  });

  function release(cancelled) {
    if (!dragging) return;

    dragging = false;
    gallery.classList.remove("dragging");

    try { gallery.releasePointerCapture(pointerId); } catch (err) {}

    // Cuma klik (tidak digeser)
    if (!dragged && !cancelled && downCard) {
      const i = cards.indexOf(downCard);

      if (i === Math.round(pos)) {
        const img = downCard.querySelector("img");
        if (img) window.openPhoto(img);
        go(i);
      } else {
        go(i);
      }

      return;
    }

    // Meluncur sesuai kecepatan swipe, lalu berhenti di kartu terdekat
    if (performance.now() - lastT > 80) vx = 0;

    go(pos + (-vx / stepPx()) * HCFG.throw);
  }

  gallery.addEventListener("pointerup", () => release(false));
  gallery.addEventListener("pointercancel", () => release(true));

  /* ----- Scroll kiri-kanan (trackpad / Shift + scroll mouse) ----- */
  let wheelTimer;

  gallery.addEventListener("wheel", (e) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY)
      ? e.deltaX
      : (e.shiftKey ? e.deltaY : 0);

    // Scroll atas-bawah biasa tetap menggulung halaman
    if (!d) return;

    e.preventDefault();

    target = clamp(target + d / (stepPx() * 1.4), 0, total - 1);
    kick();

    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => go(target), 140);
  }, { passive: false });

  /* ----- Keyboard & tombol panah ----- */
  gallery.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(Math.round(target) - 1);
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(Math.round(target) + 1);
    }
  });

  const prevBtn = document.getElementById("hobbyPrev");
  const nextBtn = document.getElementById("hobbyNext");

  if (prevBtn) prevBtn.addEventListener("click", () => go(Math.round(target) - 1));
  if (nextBtn) nextBtn.addEventListener("click", () => go(Math.round(target) + 1));

  addEventListener("resize", render);

  render();
})();