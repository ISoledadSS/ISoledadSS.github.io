/* ============================================================
   main.js — comportamiento de la página
   Sin dependencias. Todo degrada con elegancia si algo falla.
   ============================================================ */

(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- Tema ---------------------------------------- */

  var KEY = 'is-tema';

  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* modo privado */ } }
  function recall(k)   { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#fbfcfb' : '#0a0c0b');
    store(KEY, t);
  }

  var saved = recall(KEY);
  if (saved) {
    setTheme(saved);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    setTheme('light');
  } else {
    setTheme('dark');
  }

  var themeBtn = $('#theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var now = document.documentElement.getAttribute('data-theme');
      setTheme(now === 'light' ? 'dark' : 'light');
    });
  }

  /* ---------- Menú móvil ---------------------------------- */

  var burger = $('#burger');
  var nav = $('#nav');

  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });
    $$('a', nav).forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Barra: sombra + barra de progreso ----------- */

  var topbar = $('#topbar');
  var progress = $('#progress');
  var ticking = false;

  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    if (topbar) topbar.classList.toggle('is-stuck', y > 8);

    if (progress) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
    }
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* ---------- Sección activa en el menú -------------------- */

  var links = $$('.nav a');
  var targets = links
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && targets.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('is-on', a.getAttribute('href') === '#' + e.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach(function (t) { spy.observe(t); });
  }

  /* ---------- Aparición al entrar en pantalla -------------- */

  var reveals = $$('.reveal');

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e, i) {
        if (!e.isIntersecting) return;
        var el = e.target;
        setTimeout(function () { el.classList.add('is-in'); }, i * 60);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Conteo de las cifras ------------------------- */

  var counters = $$('[data-count]');

  function runCount(el) {
    var end = parseInt(el.getAttribute('data-count'), 10);
    if (isNaN(end)) return;
    var t0 = null;
    var dur = 1100;

    function step(t) {
      if (t0 === null) t0 = t;
      var p = Math.min((t - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(end * eased).toLocaleString('es-MX');
      if (p < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduce && 'IntersectionObserver' in window && counters.length) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        runCount(e.target);
        co.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { co.observe(el); });
  }

  /* ---------- Pestañas de la galería ---------------------- */

  var tabs = $$('.gal__tabs button');
  var panels = $$('.gal__panel');

  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-tab');
      tabs.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', String(on));
      });
      panels.forEach(function (p) {
        p.classList.toggle('is-on', p.getAttribute('data-panel') === key);
      });
    });
  });

  /* ---------- Precarga de los paneles ocultos -------------- */
  /* Las imágenes de los paneles que no están activos son `lazy`: el navegador
     no las pide hasta que el panel se muestra, así que al cambiar de pestaña
     aparecería un hueco por un momento. Cuando el hilo principal queda libre,
     las pedimos en segundo plano para que el cambio sea instantáneo.        */

  function precargarGaleria() {
    $$('.gal__panel:not(.is-on) img').forEach(function (img) {
      var src = img.getAttribute('src');
      if (src) new Image().src = src;
    });
  }

  function alQuedarLibre(fn) {
    if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 4000 });
    else setTimeout(fn, 1500);
  }

  if (document.readyState === 'complete') alQuedarLibre(precargarGaleria);
  else window.addEventListener('load', function () { alQuedarLibre(precargarGaleria); });

  /* ---------- Lightbox ------------------------------------ */

  var lb = $('#lb');
  var lbImg = $('#lbimg');
  var lbX = $('#lbx');
  var lastFocus = null;

  function openLb(src, alt) {
    if (!lb || !lbImg) return;
    lastFocus = document.activeElement;
    lbImg.setAttribute('src', src);
    lbImg.setAttribute('alt', alt || '');
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    if (lbX) lbX.focus();
  }

  function closeLb() {
    if (!lb) return;
    lb.hidden = true;
    lbImg.setAttribute('src', '');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  $$('.shot img').forEach(function (img) {
    img.addEventListener('click', function () {
      var fig = img.closest('.shot');
      openLb(fig ? fig.getAttribute('data-full') || img.src : img.src, img.alt);
    });
  });

  if (lbX) lbX.addEventListener('click', closeLb);
  if (lb) lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && lb && !lb.hidden) closeLb();
  });

  /* ---------- Año en el pie ------------------------------- */

  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

})();
