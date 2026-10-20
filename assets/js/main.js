/* Бункер Паб — поведение страницы.
   Данные берутся из data/site.js и data/menu.js, здесь их править не нужно. */
(function () {
  "use strict";

  var S = window.SITE || {};
  var MENU = window.MENU || [];
  var PLACEHOLDER = "images/menu/placeholder.svg";
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function get(obj, path) {
    return path.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function price(p) {
    if (typeof p === "number") return p.toLocaleString("ru-RU") + " ₽";
    return p || "";
  }
  function fallbackImage(img, src) {
    img.addEventListener("error", function () { img.src = src; }, { once: true });
  }

  /* ---------- Контакты и тексты из data/site.js ---------- */
  $$("[data-site]").forEach(function (node) {
    var v = get(S, node.getAttribute("data-site"));
    if (v == null) return;
    node.textContent = v;
    node.hidden = v === "";
  });

  if (S.phoneDial) {
    $$("[data-tel]").forEach(function (a) { a.href = "tel:" + S.phoneDial; });
  }

  var links = {
    yandexOrg: S.yandexOrg,
    route: S.lat && S.lon ? "https://yandex.ru/maps/?rtext=~" + S.lat + "," + S.lon + "&rtt=auto" : "",
    vk: S.vk,
    telegram: S.telegram,
    whatsapp: S.whatsapp ? "https://wa.me/" + S.whatsapp : "",
    whatsappBook: S.whatsapp ? "https://wa.me/" + S.whatsapp + "?text=" + encodeURIComponent(S.whatsappText || "") : "",
    delivery: S.delivery
  };
  $$("[data-link]").forEach(function (a) {
    var url = links[a.getAttribute("data-link")];
    if (url) a.href = url;
    else a.hidden = true;
  });
  $$("[data-delivery]").forEach(function (n) { n.hidden = !S.delivery; });

  function setSrc(node, src) {
    if (node && src && node.getAttribute("src") !== src) node.setAttribute("src", src);
  }
  if (S.yandexOrgId && S.lat && S.lon) {
    setSrc($("#map"), "https://yandex.ru/map-widget/v1/?ll=" + S.lon + "%2C" + S.lat + "&z=17&oid=" + S.yandexOrgId + "&ol=biz");
    setSrc($("#rating"), "https://yandex.ru/sprav/widget/rating-badge/" + S.yandexOrgId + "?type=rating&theme=dark");
  }

  var year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Трансляции ---------- */
  var bc = S.broadcast || {};
  var leagues = $("#leagues");
  if (leagues && bc.leagues && bc.leagues.length) {
    bc.leagues.forEach(function (name) { leagues.appendChild(el("li", null, name)); });
    leagues.hidden = false;
  }
  setSrc($("#broadcast-photo"), bc.photo);

  /* ---------- Открыто / закрыто (московское время) ---------- */
  function toMin(hhmm) {
    var p = String(hhmm).split(":");
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }
  function moscowMinutes() {
    try {
      var parts = new Intl.DateTimeFormat("ru-RU", {
        timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
      }).formatToParts(new Date());
      var h = 0, m = 0;
      parts.forEach(function (p) {
        if (p.type === "hour") h = parseInt(p.value, 10) % 24;
        if (p.type === "minute") m = parseInt(p.value, 10);
      });
      return h * 60 + m;
    } catch (e) {
      var d = new Date();
      return (d.getUTCHours() * 60 + d.getUTCMinutes() + 180) % 1440;
    }
  }
  function statusAt(min) {
    var opens = S.opens || "12:00", closes = S.closes || "01:00";
    var o = toMin(opens), c = toMin(closes);
    var open = c > o ? (min >= o && min < c) : (min >= o || min < c);
    return { open: open, text: open ? "Открыто до " + closes : "Закрыто, откроемся в " + opens };
  }
  function renderStatus() {
    var st = statusAt(moscowMinutes());
    $$("[data-status]").forEach(function (n) {
      n.classList.toggle("is-open", st.open);
      n.classList.toggle("is-closed", !st.open);
      var t = $(".status__text", n);
      if (t) t.textContent = st.text;
    });
  }
  renderStatus();
  setInterval(renderStatus, 30000);
  // для проверки из консоли: BUNKER.statusAt("00:59")
  window.BUNKER = { statusAt: function (hhmm) { return statusAt(toMin(hhmm)); } };

  /* ---------- Шапка и мобильное меню ---------- */
  var bar = $("#bar");
  var burger = $(".bar__burger");

  function onScroll() { bar.classList.toggle("is-solid", window.scrollY > 24); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  function setNav(open) {
    bar.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Закрыть разделы" : "Открыть разделы");
  }
  burger.addEventListener("click", function () { setNav(!bar.classList.contains("is-open")); });
  $$("#nav a").forEach(function (a) { a.addEventListener("click", function () { setNav(false); }); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && bar.classList.contains("is-open")) { setNav(false); burger.focus(); }
  });
  window.matchMedia("(min-width: 1100px)").addEventListener("change", function (mq) {
    if (mq.matches) setNav(false);
  });

  /* ---------- Окна ---------- */
  function openDialog(d) {
    if (typeof d.showModal === "function") { if (!d.open) d.showModal(); }
    else d.setAttribute("open", "");
  }
  function closeDialog(d) {
    if (typeof d.close === "function") d.close();
    else d.removeAttribute("open");
  }
  $$("dialog").forEach(function (d) {
    $$("[data-close]", d).forEach(function (b) {
      b.addEventListener("click", function () { closeDialog(d); });
    });
  });

  /* ---------- Бронь стола ---------- */
  var book = $("#book-dialog");
  $$("[data-book]").forEach(function (b) {
    b.addEventListener("click", function () { setNav(false); openDialog(book); });
  });
  book.addEventListener("click", function (e) { if (e.target === book) closeDialog(book); });

  /* ---------- Меню ---------- */
  var list = $("#menu-list");
  var track = $("#cats");
  var photos = [];       // все позиции с фото подряд, для листания в просмотре
  var sections = [];
  var chips = [];

  var demo = $("#demo-note");
  if (demo) demo.hidden = !window.MENU_DEMO;

  MENU.forEach(function (cat, ci) {
    var items = cat.items || [];
    if (!items.length) return;
    var id = "cat-" + (ci + 1);

    var sec = el("section", "cat");
    sec.id = id;
    sec.setAttribute("aria-labelledby", id + "-title");
    var title = el("h3", "cat__title", cat.category);
    title.id = id + "-title";
    sec.appendChild(title);

    var withPhoto = items.filter(function (it) { return it.photo; });
    var noPhoto = items.filter(function (it) { return !it.photo; });

    if (withPhoto.length) {
      var ul = el("ul", "dishes");
      withPhoto.forEach(function (it) {
        var index = photos.push(it) - 1;
        var li = el("li");
        var btn = el("button", "dish");
        btn.type = "button";
        btn.setAttribute("aria-label", it.name + ", " + (it.weight ? it.weight + ", " : "") + price(it.price) + ". Открыть фото");

        var ph = el("span", "dish__photo");
        var img = el("img");
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        fallbackImage(img, PLACEHOLDER);
        img.src = it.photo;
        ph.appendChild(img);

        var body = el("span", "dish__body");
        body.appendChild(el("span", "dish__name", it.name));
        if (it.note) body.appendChild(el("span", "dish__note", it.note));
        var meta = el("span", "dish__meta");
        meta.appendChild(el("span", "dish__weight", it.weight || ""));
        meta.appendChild(el("span", "dish__price", price(it.price)));
        body.appendChild(meta);

        btn.appendChild(ph);
        btn.appendChild(body);
        btn.addEventListener("click", function () { openViewer(photos, index); });
        li.appendChild(btn);
        ul.appendChild(li);
      });
      sec.appendChild(ul);
    }

    if (noPhoto.length) {
      var rows = el("ul", "rows");
      noPhoto.forEach(function (it) {
        var li = el("li", "row");
        li.appendChild(el("span", "row__name", it.name));
        li.appendChild(el("span", "row__weight", it.weight || ""));
        li.appendChild(el("span", "row__price", price(it.price)));
        rows.appendChild(li);
      });
      sec.appendChild(rows);
    }

    list.appendChild(sec);
    sections.push(sec);

    var chip = el("button", "cat-btn", cat.category);
    chip.type = "button";
    chip.addEventListener("click", function () {
      sec.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
    track.appendChild(chip);
    chips.push(chip);
  });

  // подсветка текущего раздела в полосе категорий
  var catsBar = $(".cats");
  var activeIdx = -1;
  function spy() {
    if (!sections.length) return;
    var line = bar.offsetHeight + catsBar.offsetHeight + 32;
    var idx = 0;
    sections.forEach(function (s, i) { if (s.getBoundingClientRect().top - line <= 0) idx = i; });
    if (idx === activeIdx) return;
    activeIdx = idx;
    chips.forEach(function (c, i) {
      c.classList.toggle("is-active", i === idx);
      if (i === idx) c.setAttribute("aria-current", "true"); else c.removeAttribute("aria-current");
    });
    var chip = chips[idx];
    var left = chip.offsetLeft - (track.clientWidth - chip.offsetWidth) / 2;
    track.scrollTo({ left: Math.max(0, left), behavior: reducedMotion ? "auto" : "smooth" });
  }
  function updateFade() {
    track.classList.toggle("has-more", track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
  }
  track.addEventListener("scroll", updateFade, { passive: true });
  window.addEventListener("resize", updateFade);
  updateFade();

  var spyQueued = false;
  window.addEventListener("scroll", function () {
    if (spyQueued) return;
    spyQueued = true;
    requestAnimationFrame(function () { spyQueued = false; spy(); });
  }, { passive: true });
  spy();

  /* ---------- Зал ---------- */
  var gallery = $("#gallery");
  var shots = (S.gallery || []).filter(function (g) { return g.photo; });
  if (gallery && shots.length) {
    shots.forEach(function (g, i) {
      var li = el("li");
      var btn = el("button", "shot");
      btn.type = "button";
      btn.setAttribute("aria-label", "Открыть фото: " + (g.caption || "зал"));
      var frame = el("span", "shot__frame");
      var img = el("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      fallbackImage(img, PLACEHOLDER);
      img.src = g.photo;
      if (g.focus) img.style.objectPosition = g.focus;
      frame.appendChild(img);
      btn.appendChild(frame);
      btn.addEventListener("click", function () { openViewer(shots, i); });
      li.appendChild(btn);
      gallery.appendChild(li);
    });
    // последнее фото растягиваем, если в сетке остаётся пустая клетка
    var last = gallery.lastElementChild;
    if ((shots.length - 1) % 4 === 3) last.classList.add("is-wide");
    if (shots.length % 2 === 0) last.classList.add("is-wide-m");
  } else if (gallery) {
    $("#hall").hidden = true;
    $$('a[href="#hall"]').forEach(function (a) { a.hidden = true; });
  }

  /* ---------- Просмотр фото: блюда и зал ---------- */
  var viewer = $("#viewer");
  var vImg = $("#viewer-img");
  var vName = $("#viewer-name");
  var vWeight = $("#viewer-weight");
  var vPrice = $("#viewer-price");
  var vNote = $("#viewer-note");
  var vPrev = $(".viewer__nav--prev", viewer);
  var vNext = $(".viewer__nav--next", viewer);
  var viewerItems = [];
  var current = 0;

  function showDish(i) {
    if (i < 0 || i >= viewerItems.length) return;
    current = i;
    var it = viewerItems[i];
    var title = it.name || it.caption || "";
    fallbackImage(vImg, PLACEHOLDER);
    vImg.src = it.photo;
    vImg.alt = title;
    vName.textContent = title;
    vWeight.textContent = it.weight || "";
    vPrice.textContent = price(it.price);
    vNote.textContent = it.note || "";
    vPrev.disabled = i === 0;
    vNext.disabled = i === viewerItems.length - 1;
    // перезапуск короткой анимации появления
    vImg.style.animation = "none";
    void vImg.offsetWidth;
    vImg.style.animation = "";
  }
  function openViewer(items, i) {
    viewerItems = items;
    showDish(i);
    openDialog(viewer);
  }

  $$("[data-step]", viewer).forEach(function (b) {
    b.addEventListener("click", function () { showDish(current + parseInt(b.getAttribute("data-step"), 10)); });
  });
  viewer.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") { e.preventDefault(); showDish(current - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); showDish(current + 1); }
  });
  viewer.addEventListener("click", function (e) {
    if (e.target === viewer || e.target.classList.contains("viewer__fig")) closeDialog(viewer);
  });
  var touchX = null;
  viewer.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  viewer.addEventListener("touchend", function (e) {
    if (touchX == null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) showDish(current + (dx < 0 ? 1 : -1));
  });

  /* ---------- QR на Яндекс Карты ---------- */
  var qrBox = $("#qr");
  if (qrBox && window.qrcode && S.yandexOrg) {
    var qr = window.qrcode(0, "M");
    qr.addData(S.yandexOrg);
    qr.make();
    qrBox.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }
})();
