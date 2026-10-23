/* Админка «Бункер Паб».

   Читает data/site.js и data/bar.js прямо из репозитория GitHub и сохраняет
   их обратно одним коммитом (вместе с новыми фото зала). После сохранения
   GitHub сам публикует сайт за 1–2 минуты.

   Вход — по ключу доступа GitHub (fine-grained personal access token)
   с правом «Contents: Read and write» только на этот репозиторий.
   Ключ хранится только в этом браузере. */
(function () {
  "use strict";

  var REPO = { owner: "antonkravcov43-dev", name: "bunker-pub", branch: "main" };
  var API = "https://api.github.com";
  // Для проверки на компьютере: admin.html?api=http://localhost:8090 (только localhost).
  var apiParam = new URLSearchParams(location.search).get("api");
  if (apiParam && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(apiParam)) API = apiParam;

  var TOKEN_KEY = "bunker-admin-token";
  var SITE_FILE = "data/site.js";
  var BAR_FILE = "data/bar.js";
  var BAR_HEAD = "// Барное меню: то, чего нет в Яндекс Еде (разливное пиво, коктейли и т.п.).\n" +
    "// Выводится в конце меню на сайте. Удобнее всего менять через админку: /admin.html\n";

  var token = load(TOKEN_KEY);
  var state = { site: null, bar: [] };
  var saved = { site: "", bar: "" };   // как было при загрузке/последнем сохранении
  var heads = { site: "", bar: BAR_HEAD };
  var newPhotos = {};                    // путь в репозитории -> { b64, url }
  var saving = false;

  /* ---------- мелочи ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "class") n.className = attrs[k];
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function load(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function store(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* приватный режим */ } }
  function getPath(obj, path) { return path.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj); }
  function setPath(obj, path, val) {
    var keys = path.split("."), last = keys.pop();
    var o = keys.reduce(function (o, k) { if (o[k] == null) o[k] = {}; return o[k]; }, obj);
    o[last] = val;
  }

  function toB64(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function fromB64(b64) {
    var bin = atob(String(b64).replace(/\s/g, "")), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* ---------- GitHub ---------- */
  function gh(method, path, body) {
    return fetch(API + path, {
      method: method,
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    }).then(function (r) {
      if (r.status === 204) return null;
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var err = new Error(j && j.message ? j.message : "HTTP " + r.status);
          err.status = r.status;
          throw err;
        }
        return j;
      });
    });
  }
  var repoPath = "/repos/" + REPO.owner + "/" + REPO.name;

  function readFile(path) {
    return gh("GET", repoPath + "/contents/" + path + "?ref=" + REPO.branch)
      .then(function (j) { return fromB64(j.content); })
      .catch(function (e) { if (e.status === 404) return null; throw e; });
  }

  // files: [{ path, b64 }] — b64 === null значит удалить файл
  function commit(files, message, retry) {
    var head;
    return gh("GET", repoPath + "/git/ref/heads/" + REPO.branch).then(function (ref) {
      head = ref.object.sha;
      return gh("GET", repoPath + "/git/commits/" + head);
    }).then(function (c) {
      return Promise.all(files.map(function (f) {
        if (f.b64 === null) return { path: f.path, mode: "100644", type: "blob", sha: null };
        return gh("POST", repoPath + "/git/blobs", { content: f.b64, encoding: "base64" })
          .then(function (b) { return { path: f.path, mode: "100644", type: "blob", sha: b.sha }; });
      })).then(function (tree) {
        return gh("POST", repoPath + "/git/trees", { base_tree: c.tree.sha, tree: tree });
      });
    }).then(function (t) {
      return gh("POST", repoPath + "/git/commits", { message: message, tree: t.sha, parents: [head] });
    }).then(function (nc) {
      return gh("PATCH", repoPath + "/git/refs/heads/" + REPO.branch, { sha: nc.sha });
    }).catch(function (e) {
      // пока сохраняли, робот успел обновить меню — пробуем ещё раз поверх
      if ((e.status === 409 || e.status === 422) && !retry) return commit(files, message, true);
      throw e;
    });
  }

  function parseAssign(text, name) {
    var marker = "window." + name + " =";
    var i = text.indexOf(marker);
    if (i < 0) throw new Error("в файле нет " + marker);
    return { head: text.slice(0, i), value: JSON.parse(text.slice(i + marker.length).trim().replace(/;\s*$/, "")) };
  }

  /* ---------- вход ---------- */
  var loginForm = $("#login-form");
  var loginError = $("#login-error");

  function showLogin(message) {
    $("#login").hidden = false;
    $("#app").hidden = true;
    $("#savebar").hidden = true;
    $("#logout").hidden = true;
    loginError.hidden = !message;
    loginError.textContent = message || "";
  }

  function start() {
    loginError.hidden = true;
    var btn = $("button[type=submit]", loginForm);
    btn.disabled = true;
    btn.textContent = "Загружаю…";
    return Promise.all([readFile(SITE_FILE), readFile(BAR_FILE)]).then(function (res) {
      if (!res[0]) throw new Error("не найден " + SITE_FILE);
      var site = parseAssign(res[0], "SITE");
      heads.site = site.head;
      state.site = site.value;
      if (res[1]) {
        var bar = parseAssign(res[1], "BAR_MENU");
        heads.bar = bar.head;
        state.bar = bar.value;
      }
      saved.site = JSON.stringify(state.site);
      saved.bar = JSON.stringify(state.bar);
      $("#login").hidden = true;
      $("#app").hidden = false;
      $("#savebar").hidden = false;
      $("#logout").hidden = false;
      renderAll();
    }).catch(function (e) {
      if (e.status === 401 || e.status === 403) {
        store(TOKEN_KEY, "");
        token = "";
        showLogin("Ключ не подошёл или срок его действия закончился. Попросите у разработчика новый.");
      } else {
        showLogin("Не получилось загрузить данные сайта: " + e.message + ". Проверьте интернет и попробуйте ещё раз.");
      }
    }).then(function () {
      btn.disabled = false;
      btn.textContent = "Войти";
    });
  }

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    token = $("#token").value.trim();
    if (!token) return;
    store(TOKEN_KEY, token);
    start();
  });

  $("#logout").addEventListener("click", function () {
    if (isDirty() && !confirm("Есть несохранённые изменения. Выйти без сохранения?")) return;
    store(TOKEN_KEY, "");
    location.reload();
  });

  /* ---------- вкладки ---------- */
  $$("[data-tab]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      $$("[data-tab]").forEach(function (t) { t.classList.toggle("is-active", t === tab); });
      $$("[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== tab.getAttribute("data-tab"); });
      window.scrollTo(0, 0);
    });
  });

  /* ---------- простые поля ---------- */
  function phoneToDial(phone) {
    var d = String(phone || "").replace(/\D/g, "");
    if (d.length === 11 && d[0] === "8") d = "7" + d.slice(1);
    if (d.length === 10) d = "7" + d;
    return d ? "+" + d : "";
  }
  function autoHours(o, c) { return "Каждый день " + o + "–" + c; }

  $$("[data-bind]").forEach(function (input) {
    input.addEventListener("input", function () {
      var path = input.getAttribute("data-bind");
      var s = state.site;
      if ((path === "opens" || path === "closes") && s.hoursLabel === autoHours(s.opens, s.closes)) {
        setPath(s, path, input.value);
        s.hoursLabel = autoHours(s.opens, s.closes);
        $('[data-bind="hoursLabel"]').value = s.hoursLabel;
      } else {
        setPath(s, path, path === "whatsapp" ? input.value.replace(/\D/g, "") : input.value);
      }
      if (path === "phone") s.phoneDial = phoneToDial(input.value);
      if (path.indexOf("announcement") === 0) renderNoticePreview();
      changed();
    });
  });

  function fillInputs() {
    $$("[data-bind]").forEach(function (input) {
      var v = getPath(state.site, input.getAttribute("data-bind"));
      input.value = v == null ? "" : v;
    });
  }

  /* ---------- объявление ---------- */
  function renderNoticePreview() {
    var a = state.site.announcement || {};
    var p = $("#notice-preview");
    $(".notice__text", p).textContent = a.text || "Объявления нет";
    p.classList.toggle("is-empty", !a.text);
  }
  $("#notice-clear").addEventListener("click", function () {
    state.site.announcement = { text: "", link: "" };
    fillInputs();
    renderNoticePreview();
    changed();
  });

  /* ---------- трансляции: турниры ---------- */
  function renderLeagues() {
    var box = $("#leagues");
    var list = state.site.broadcast.leagues || (state.site.broadcast.leagues = []);
    box.textContent = "";
    if (!list.length) box.appendChild(el("span", { class: "adm-hint", text: "Пока пусто — на сайте эта строка не показывается." }));
    list.forEach(function (name, i) {
      box.appendChild(el("span", { class: "chip" }, [
        el("span", { text: name }),
        el("button", { type: "button", "aria-label": "Убрать " + name, text: "×", onclick: function () {
          list.splice(i, 1); renderLeagues(); changed();
        } })
      ]));
    });
  }
  $("#league-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = $("#league-input");
    var v = input.value.trim();
    if (!v) return;
    state.site.broadcast.leagues.push(v);
    input.value = "";
    renderLeagues();
    changed();
  });

  /* ---------- барное меню ---------- */
  function move(list, i, d) {
    var j = i + d;
    if (j < 0 || j >= list.length) return false;
    var t = list[i]; list[i] = list[j]; list[j] = t;
    return true;
  }
  function iconBtn(label, text, fn) {
    return el("button", { type: "button", class: "icon-btn", "aria-label": label, title: label, text: text, onclick: fn });
  }
  // двойное нажатие вместо confirm(): первое нажатие просит подтвердить
  function dangerBtn(text, fn) {
    var armed = false, timer;
    var b = el("button", { type: "button", class: "btn btn--steel btn--danger", text: text, onclick: function () {
      if (!armed) {
        armed = true; b.textContent = "Точно удалить?";
        timer = setTimeout(function () { armed = false; b.textContent = text; }, 3000);
        return;
      }
      clearTimeout(timer); fn();
    } });
    return b;
  }

  function renderBar() {
    var box = $("#bar");
    box.textContent = "";
    if (!state.bar.length) box.appendChild(el("p", { class: "adm-hint", text: "Барного меню пока нет. Добавьте раздел, например «Разливное пиво»." }));
    state.bar.forEach(function (sec, si) {
      sec.items = sec.items || [];
      var rows = el("div", { class: "bar-rows" });
      sec.items.forEach(function (it, ii) {
        rows.appendChild(el("div", { class: "bar-row" }, [
          el("input", { class: "inp bar-row__name", type: "text", placeholder: "Название", value: it.name || "", maxlength: "80",
            oninput: function (e) { it.name = e.target.value; changed(); } }),
          el("input", { class: "inp bar-row__weight", type: "text", placeholder: "0,5 л", value: it.weight || "", maxlength: "20",
            oninput: function (e) { it.weight = e.target.value; changed(); } }),
          el("input", { class: "inp bar-row__price", type: "text", inputmode: "numeric", placeholder: "Цена ₽",
            value: it.price == null ? "" : it.price, maxlength: "7",
            oninput: function (e) {
              var v = e.target.value.replace(/[^\d]/g, "");
              if (v !== e.target.value) e.target.value = v;
              if (v) it.price = Number(v); else delete it.price;
              changed();
            } }),
          el("div", { class: "bar-row__tools" }, [
            iconBtn("Выше", "↑", function () { if (move(sec.items, ii, -1)) { renderBar(); changed(); } }),
            iconBtn("Ниже", "↓", function () { if (move(sec.items, ii, 1)) { renderBar(); changed(); } }),
            iconBtn("Удалить позицию", "×", function () { sec.items.splice(ii, 1); renderBar(); changed(); })
          ])
        ]));
      });

      box.appendChild(el("div", { class: "adm-card" }, [
        el("div", { class: "adm-card__head" }, [
          el("input", { class: "inp adm-card__title", type: "text", placeholder: "Название раздела", value: sec.category || "", maxlength: "40",
            oninput: function (e) { sec.category = e.target.value; changed(); } }),
          iconBtn("Раздел выше", "↑", function () { if (move(state.bar, si, -1)) { renderBar(); changed(); } }),
          iconBtn("Раздел ниже", "↓", function () { if (move(state.bar, si, 1)) { renderBar(); changed(); } })
        ]),
        rows,
        el("div", { class: "adm-card__foot" }, [
          el("button", { type: "button", class: "btn btn--steel", text: "Добавить позицию", onclick: function () {
            sec.items.push({ name: "", weight: "" });
            renderBar();
            changed();
            var names = $$(".bar-row__name", $$("#bar .adm-card")[si]);
            names[names.length - 1].focus();
          } }),
          dangerBtn("Удалить раздел", function () { state.bar.splice(si, 1); renderBar(); changed(); })
        ])
      ]));
    });
  }
  $("#bar-add").addEventListener("click", function () {
    state.bar.push({ category: "", items: [{ name: "", weight: "" }] });
    renderBar();
    changed();
    var titles = $$(".adm-card__title");
    if (titles.length) titles[titles.length - 1].focus();
  });

  /* ---------- фото зала ---------- */
  function renderPhotos() {
    var box = $("#photos");
    var list = state.site.gallery || (state.site.gallery = []);
    box.textContent = "";
    list.forEach(function (g, i) {
      var src = newPhotos[g.photo] ? newPhotos[g.photo].url : g.photo;
      box.appendChild(el("figure", { class: "photo-card" + (i === 0 ? " is-main" : "") }, [
        el("img", { src: src, alt: g.caption || "", loading: "lazy" }),
        el("input", { class: "inp", type: "text", placeholder: "Подпись", value: g.caption || "", maxlength: "60",
          oninput: function (e) { g.caption = e.target.value; changed(); } }),
        el("div", { class: "photo-card__tools" }, [
          iconBtn("Раньше", "←", function () { if (move(list, i, -1)) { renderPhotos(); changed(); } }),
          iconBtn("Позже", "→", function () { if (move(list, i, 1)) { renderPhotos(); changed(); } }),
          iconBtn("Удалить фото", "×", function () { list.splice(i, 1); renderPhotos(); changed(); })
        ])
      ]));
    });
  }

  function resizeImage(file, max, quality) {
    var bitmap = typeof createImageBitmap === "function"
      ? createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () { return createImageBitmap(file); })
      : Promise.reject(new Error("no createImageBitmap"));
    return bitmap.catch(function () {
      return new Promise(function (res, rej) {
        var img = new Image();
        img.onload = function () { res(img); };
        img.onerror = function () { rej(new Error("не удалось открыть фото")); };
        img.src = URL.createObjectURL(file);
      });
    }).then(function (src) {
      var w = src.width, h = src.height, s = Math.min(1, max / Math.max(w, h));
      var c = document.createElement("canvas");
      c.width = Math.round(w * s);
      c.height = Math.round(h * s);
      c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(res, "image/jpeg", quality); });
    });
  }
  function blobToB64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(",")[1]); };
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  $("#photo-input").addEventListener("change", function (e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setStatus("Готовлю фото…");
    var stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    files.reduce(function (p, file, n) {
      return p.then(function () {
        return resizeImage(file, 1600, 0.82).then(function (blob) {
          return blobToB64(blob).then(function (b64) {
            var path = "images/gallery/" + stamp + "-" + (n + 1) + ".jpg";
            newPhotos[path] = { b64: b64, url: URL.createObjectURL(blob) };
            state.site.gallery.push({ photo: path, caption: "" });
          });
        });
      });
    }, Promise.resolve()).then(function () {
      renderPhotos();
      changed();
    }).catch(function (err) {
      setStatus("Не получилось добавить фото: " + err.message, true);
    });
  });

  /* ---------- сохранение ---------- */
  var saveBtn = $("#save");
  var statusEl = $("#status");

  function isDirty() {
    return state.site && (JSON.stringify(state.site) !== saved.site || JSON.stringify(state.bar) !== saved.bar);
  }
  function setStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.classList.toggle("is-error", !!isError);
  }
  function changed() {
    var dirty = isDirty();
    saveBtn.disabled = saving || !dirty;
    $("#savebar").classList.toggle("is-dirty", !!dirty);
    if (!saving) setStatus(dirty ? "Есть несохранённые изменения" : "Изменений нет");
  }

  function validate() {
    var s = state.site;
    if (!/^\d{2}:\d{2}$/.test(s.opens) || !/^\d{2}:\d{2}$/.test(s.closes)) return "Укажите время открытия и закрытия.";
    if (!phoneToDial(s.phone)) return "Укажите телефон.";
    var link = (s.announcement || {}).link;
    if (link && !/^(https?:\/\/|#|tel:)/.test(link)) return "Ссылка в объявлении должна начинаться с https://";
    for (var i = 0; i < state.bar.length; i++) {
      var sec = state.bar[i];
      if (!String(sec.category || "").trim()) return "У раздела барного меню нет названия.";
      for (var j = 0; j < sec.items.length; j++) {
        if (!String(sec.items[j].name || "").trim()) return "В разделе «" + sec.category + "» есть позиция без названия.";
      }
    }
    return "";
  }

  function cleanBar() {
    return state.bar.map(function (sec) {
      return {
        category: sec.category.trim(),
        items: sec.items.map(function (it) {
          var o = { name: it.name.trim() };
          if (String(it.weight || "").trim()) o.weight = it.weight.trim();
          if (typeof it.price === "number") o.price = it.price;
          return o;
        })
      };
    });
  }

  saveBtn.addEventListener("click", function () {
    var problem = validate();
    if (problem) { setStatus(problem, true); return; }

    var files = [];
    var site = state.site;
    if (JSON.stringify(site) !== saved.site) {
      files.push({ path: SITE_FILE, b64: toB64(heads.site + "window.SITE = " + JSON.stringify(site, null, 2) + ";\n") });
    }
    var bar = cleanBar();
    if (JSON.stringify(state.bar) !== saved.bar) {
      files.push({ path: BAR_FILE, b64: toB64(heads.bar + "window.BAR_MENU = " + JSON.stringify(bar, null, 2) + ";\n") });
    }
    // новые фото, которые остались в списке
    var now = site.gallery.map(function (g) { return g.photo; });
    now.forEach(function (p) { if (newPhotos[p]) files.push({ path: p, b64: newPhotos[p].b64 }); });
    // фото зала, которые убрали из списка, удаляем из репозитория
    JSON.parse(saved.site).gallery.forEach(function (g) {
      if (now.indexOf(g.photo) < 0 && g.photo.indexOf("images/gallery/") === 0) files.push({ path: g.photo, b64: null });
    });
    if (!files.length) return;

    saving = true;
    saveBtn.disabled = true;
    setStatus("Сохраняю…");
    commit(files, "Изменения из админки").then(function () {
      state.bar = bar;
      saved.site = JSON.stringify(state.site);
      saved.bar = JSON.stringify(state.bar);
      newPhotos = Object.keys(newPhotos).reduce(function (o, p) {
        if (now.indexOf(p) >= 0) o[p] = newPhotos[p];   // превью нужно, пока сайт не обновился
        return o;
      }, {});
      saving = false;
      renderBar();
      changed();
      setStatus("Сохранено. На сайте появится через 1–2 минуты.");
    }).catch(function (e) {
      saving = false;
      changed();
      if (e.status === 401 || e.status === 403) setStatus("Ключ не подходит для сохранения. Попросите у разработчика новый.", true);
      else setStatus("Не сохранилось: " + e.message + ". Попробуйте ещё раз.", true);
    });
  });

  window.addEventListener("beforeunload", function (e) {
    if (isDirty()) { e.preventDefault(); e.returnValue = ""; }
  });

  function renderAll() {
    fillInputs();
    renderNoticePreview();
    renderLeagues();
    renderBar();
    renderPhotos();
    changed();
  }

  if (token) start(); else showLogin();
})();
