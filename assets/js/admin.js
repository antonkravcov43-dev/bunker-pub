/* Админка «Бункер Паб».

   Читает data/site.js и data/menu.js прямо из репозитория GitHub и сохраняет
   их обратно одним коммитом (вместе с новыми фото зала и блюд). После сохранения
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
  var MENU_FILE = "data/menu.js";
  var PREVIEW_KEY = "bunker-preview";

  var token = load(TOKEN_KEY);
  var state = { site: null, menu: [] };
  var saved = { site: "", menu: "" };  // как было при загрузке/последнем сохранении
  var heads = { site: "", menu: "" };
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

  // files: [{ path, b64 }] — b64 === null значит удалить файл; пустой список — коммит без изменений
  function commit(files, message, retry) {
    var head;
    return gh("GET", repoPath + "/git/ref/heads/" + REPO.branch).then(function (ref) {
      head = ref.object.sha;
      return gh("GET", repoPath + "/git/commits/" + head);
    }).then(function (c) {
      if (!files.length) return c.tree;
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
    return Promise.all([readFile(SITE_FILE), readFile(MENU_FILE)]).then(function (res) {
      if (!res[0]) throw new Error("не найден " + SITE_FILE);
      if (!res[1]) throw new Error("не найден " + MENU_FILE);
      var site = parseAssign(res[0], "SITE");
      heads.site = site.head;
      state.site = site.value;
      var menu = parseAssign(res[1], "MENU");
      heads.menu = menu.head;
      state.menu = menu.value;
      saved.site = JSON.stringify(state.site);
      saved.menu = JSON.stringify(state.menu);
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
  var tabsBar = $(".adm-tabs");
  function tabsFade() {
    tabsBar.classList.toggle("has-more", tabsBar.scrollLeft + tabsBar.clientWidth < tabsBar.scrollWidth - 4);
  }
  tabsBar.addEventListener("scroll", tabsFade, { passive: true });
  window.addEventListener("resize", tabsFade);
  $$("[data-tab]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      $$("[data-tab]").forEach(function (t) { t.classList.toggle("is-active", t === tab); });
      $$("[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== tab.getAttribute("data-tab"); });
      // на телефоне выбранная вкладка доезжает в видимую часть полосы
      tabsBar.scrollTo({ left: Math.max(0, tab.offsetLeft - (tabsBar.clientWidth - tab.offsetWidth) / 2), behavior: "smooth" });
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

  /* ---------- акции ---------- */
  function field(label, input) {
    return el("label", { class: "fld" }, [el("span", { text: label }), input]);
  }
  function renderPromos() {
    var box = $("#promos");
    var list = state.site.promos || [];
    box.textContent = "";
    if (!list.length) box.appendChild(el("p", { class: "adm-hint", text: "Акций нет — раздел на сайте скрыт." }));
    list.forEach(function (p, i) {
      box.appendChild(el("div", { class: "adm-card promo-card" }, [
        el("div", { class: "promo-card__top" }, [
          field("Метка", el("input", { class: "inp", type: "text", placeholder: "−10%", value: p.badge || "", maxlength: "14",
            oninput: function (e) { p.badge = e.target.value; changed(); } })),
          field("Название", el("input", { class: "inp promo-card__title", type: "text", placeholder: "На вынос", value: p.title || "", maxlength: "50",
            oninput: function (e) { p.title = e.target.value; changed(); } }))
        ]),
        field("Пояснение (необязательно)", el("textarea", { class: "inp", rows: "2", maxlength: "160", text: p.text || "",
          oninput: function (e) { p.text = e.target.value; changed(); } })),
        el("div", { class: "adm-card__foot" }, [
          el("div", { class: "tools-row" }, [
            iconBtn("Выше", "↑", function () { if (move(list, i, -1)) { renderPromos(); changed(); } }),
            iconBtn("Ниже", "↓", function () { if (move(list, i, 1)) { renderPromos(); changed(); } })
          ]),
          dangerBtn("Удалить акцию", function () { list.splice(i, 1); renderPromos(); changed(); })
        ])
      ]));
    });
  }
  $("#promo-add").addEventListener("click", function () {
    if (!state.site.promos) state.site.promos = [];
    state.site.promos.push({ badge: "", title: "", text: "" });
    renderPromos();
    changed();
    var titles = $$("#promos .promo-card__title");
    titles[titles.length - 1].focus();
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

  /* ---------- меню: разделы и позиции ---------- */
  var BADGES = ["Новинка", "Хит", "Сезонное"];
  var openCats = new Set();   // раскрытые разделы
  var menuQuery = "";
  var uploads = 0;
  var dlg = $("#item-dialog");

  function srcOf(path) { return path && newPhotos[path] ? newPhotos[path].url : path; }
  function priceText(p) { return typeof p === "number" ? p.toLocaleString("ru-RU") + " ₽" : ""; }
  function plural(n, one, few, many) {
    var a = n % 10, b = n % 100;
    return n + " " + (a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many);
  }
  function check(label, on, fn) {
    var input = el("input", { type: "checkbox", onchange: function () { fn(input.checked); } });
    input.checked = !!on;
    return el("label", { class: "chk" }, [input, el("span", { text: label })]);
  }
  function catOf(it) {
    for (var i = 0; i < state.menu.length; i++) if (state.menu[i].items.indexOf(it) >= 0) return state.menu[i];
    return null;
  }
  // удалённое в админке блюдо из Яндекс Еды робот не должен добавить обратно
  function ignoreEda(id) {
    var list = state.site.menuIgnore || (state.site.menuIgnore = []);
    if (list.indexOf(id) < 0) list.push(id);
  }
  function menuPhotos(menu) {
    var out = [];
    menu.forEach(function (c) {
      (c.items || []).forEach(function (it) { if (it.photo) out.push(it.photo); if (it.thumb) out.push(it.thumb); });
    });
    return out;
  }

  function itemRow(cat, it) {
    var thumb = srcOf(it.thumb || it.photo);
    var meta = [it.weight, priceText(it.price)].filter(Boolean).join(" · ");
    var tags = [];
    if (it.badge) tags.push(el("span", { class: "mi-tag", text: it.badge }));
    if (it.hidden) tags.push(el("span", { class: "mi-tag mi-tag--off", text: it.gone ? "Нет в Яндекс Еде" : "Скрыто" }));
    return el("div", { class: "mi" + (it.hidden ? " is-off" : "") }, [
      el("button", { type: "button", class: "mi-main", onclick: function () { openItem(it); } }, [
        thumb ? el("img", { class: "mi-thumb", src: thumb, alt: "", loading: "lazy" })
              : el("span", { class: "mi-thumb mi-thumb--none", text: "без фото" }),
        el("span", { class: "mi-body" }, [
          el("span", { class: "mi-name", text: it.name || "Без названия" }),
          el("span", { class: "mi-meta" }, [meta ? el("span", { text: meta }) : null].concat(tags))
        ])
      ]),
      el("div", { class: "mi-tools" }, [
        iconBtn("Выше", "↑", function () { if (move(cat.items, cat.items.indexOf(it), -1)) { renderMenu(); changed(); } }),
        iconBtn("Ниже", "↓", function () { if (move(cat.items, cat.items.indexOf(it), 1)) { renderMenu(); changed(); } })
      ])
    ]);
  }

  function renderMenu() {
    var box = $("#menu-cats");
    var q = menuQuery.trim().toLowerCase();
    box.textContent = "";
    if (!state.menu.length) box.appendChild(el("p", { class: "adm-hint", text: "В меню пока нет разделов." }));
    state.menu.forEach(function (cat, ci) {
      cat.items = cat.items || [];
      var catHit = q && String(cat.category || "").toLowerCase().indexOf(q) >= 0;
      var items = q && !catHit
        ? cat.items.filter(function (it) { return String(it.name || "").toLowerCase().indexOf(q) >= 0; })
        : cat.items;
      if (q && !catHit && !items.length) return;
      var open = !!q || openCats.has(cat);
      var off = cat.items.filter(function (it) { return it.hidden; }).length;
      var name = el("span", { class: "mc-name", text: cat.category || "Без названия" });
      var card = el("div", { class: "adm-card mc" + (cat.hidden ? " is-off" : "") }, [
        el("div", { class: "mc-head" }, [
          el("button", { type: "button", class: "mc-toggle", "aria-expanded": String(open), onclick: function () {
            if (openCats.has(cat)) openCats.delete(cat); else openCats.add(cat);
            renderMenu();
          } }, [
            name,
            el("span", { class: "mc-count", text: plural(cat.items.length, "позиция", "позиции", "позиций") +
              (off ? ", скрыто " + off : "") + (cat.hidden ? " · раздел скрыт" : "") })
          ]),
          iconBtn("Раздел выше", "↑", function () { if (move(state.menu, ci, -1)) { renderMenu(); changed(); } }),
          iconBtn("Раздел ниже", "↓", function () { if (move(state.menu, ci, 1)) { renderMenu(); changed(); } })
        ])
      ]);
      if (open) {
        card.appendChild(field("Название раздела", el("input", { class: "inp mc-title", type: "text", value: cat.category || "", maxlength: "40",
          oninput: function (e) { cat.category = e.target.value; name.textContent = cat.category || "Без названия"; changed(); } })));
        card.appendChild(check("Скрыть весь раздел с сайта", cat.hidden, function (on) {
          if (on) cat.hidden = true; else delete cat.hidden;
          renderMenu();
          changed();
        }));
        var list = el("div", { class: "mi-list" });
        items.forEach(function (it) { list.appendChild(itemRow(cat, it)); });
        if (!cat.items.length) list.appendChild(el("p", { class: "adm-hint", text: "В разделе пока нет позиций." }));
        card.appendChild(list);
        card.appendChild(el("div", { class: "adm-card__foot" }, [
          el("button", { type: "button", class: "btn btn--steel", text: "Добавить позицию", onclick: function () {
            var it = { name: "" };
            cat.items.push(it);
            renderMenu();
            changed();
            openItem(it);
          } }),
          dangerBtn("Удалить раздел", function () {
            cat.items.forEach(function (it) { if (it.eda) ignoreEda(it.eda); });
            state.menu.splice(state.menu.indexOf(cat), 1);
            renderMenu();
            changed();
          })
        ]));
      }
      box.appendChild(card);
    });

    var ignored = (state.site.menuIgnore || []).length;
    var note = $("#menu-ignored");
    note.hidden = !ignored;
    note.textContent = "";
    if (ignored) {
      note.appendChild(document.createTextNode("Удалено блюд из Яндекс Еды: " + ignored + ". Робот не возвращает их на сайт. "));
      note.appendChild(el("button", { type: "button", class: "link-btn", text: "Вернуть при следующей сверке", onclick: function () {
        state.site.menuIgnore = [];
        renderMenu();
        changed();
      } }));
    }
  }

  // карточка позиции: все правки сразу попадают в данные, «Сохранить» — внизу экрана
  function openItem(it) {
    var box = $("#item-box");
    box.textContent = "";
    var syncInput = null;
    var hint = el("p", { class: "adm-hint item-hint", text: it.gone ? "Этого блюда сейчас нет в Яндекс Еде, поэтому оно скрыто. Вернётся в Яндекс Еду — снова появится на сайте." : "" });
    function touch() { renderMenu(); changed(); }
    // правка цены, веса или фото у блюда из Яндекс Еды: дальше его ведёт админка, робот это не перезапишет
    function takeOver() {
      if (!it.eda || it.manual) return;
      it.manual = true;
      if (syncInput) syncInput.checked = false;
      hint.textContent = "Блюдо изменено вручную: робот больше не обновляет его цену, вес и фото из Яндекс Еды.";
    }

    var img = el("img", { class: "item-photo__img", alt: "" });
    var none = el("div", { class: "item-photo__none", text: "Без фото — на сайте позиция будет строкой" });
    var pickText = el("span");
    var delPhoto = el("button", { type: "button", class: "btn btn--steel", text: "Убрать фото", onclick: function () {
      delete it.photo;
      delete it.thumb;
      takeOver();
      showPhoto();
      touch();
    } });
    function showPhoto() {
      var s = srcOf(it.photo);
      img.hidden = !s;
      none.hidden = !!s;
      delPhoto.hidden = !s;
      pickText.textContent = s ? "Заменить фото" : "Добавить фото";
      if (s) img.src = s;
    }
    var file = el("input", { type: "file", accept: "image/*", onchange: function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f) return;
      setStatus("Готовлю фото…");
      var name = "u-" + new Date().toISOString().replace(/\D/g, "").slice(0, 14) + "-" + (++uploads) + ".jpg";
      var photo = "images/menu/" + name, thumb = "images/menu/thumb/" + name;
      Promise.all([resizeImage(f, 1000, 0.8), resizeImage(f, 480, 0.76)]).then(function (blobs) {
        return Promise.all(blobs.map(blobToB64)).then(function (b64) {
          newPhotos[photo] = { b64: b64[0], url: URL.createObjectURL(blobs[0]) };
          newPhotos[thumb] = { b64: b64[1], url: URL.createObjectURL(blobs[1]) };
          it.photo = photo;
          it.thumb = thumb;
          takeOver();
          showPhoto();
          touch();
        });
      }).catch(function (err) { setStatus("Не получилось добавить фото: " + err.message, true); });
    } });

    var nameInput = el("input", { class: "inp", type: "text", value: it.name || "", maxlength: "80", placeholder: "Бургер Секач",
      oninput: function (e) { it.name = e.target.value; touch(); } });
    var weight = el("input", { class: "inp", type: "text", value: it.weight || "", maxlength: "20", placeholder: "320 г или 0,5 л",
      oninput: function (e) { it.weight = e.target.value; takeOver(); touch(); } });
    var price = el("input", { class: "inp", type: "text", inputmode: "numeric", maxlength: "7", value: it.price == null ? "" : it.price,
      oninput: function (e) {
        var v = e.target.value.replace(/[^\d]/g, "");
        if (v !== e.target.value) e.target.value = v;
        if (v) it.price = Number(v); else delete it.price;
        takeOver();
        touch();
      } });

    var seg = el("div", { class: "seg", role: "group", "aria-label": "Отметка" });
    function renderSeg() {
      seg.textContent = "";
      [""].concat(BADGES).forEach(function (b) {
        seg.appendChild(el("button", { type: "button", class: "seg__btn", "aria-pressed": String((it.badge || "") === b), text: b || "Нет",
          onclick: function () { if (b) it.badge = b; else delete it.badge; renderSeg(); touch(); } }));
      });
    }
    renderSeg();

    var sel = el("select", { class: "inp", onchange: function () {
      var from = catOf(it), to = state.menu[Number(sel.value)];
      if (!from || !to || from === to) return;
      from.items.splice(from.items.indexOf(it), 1);
      to.items.push(it);
      openCats.add(to);
      touch();
    } });
    state.menu.forEach(function (c, i) {
      var o = el("option", { value: String(i), text: c.category || "Без названия" });
      if (c === catOf(it)) o.selected = true;
      sel.appendChild(o);
    });

    var syncRow = null;
    if (it.eda) {
      syncRow = check("Обновлять цену, вес и фото из Яндекс Еды", !it.manual, function (on) {
        if (on) delete it.manual; else it.manual = true;
        hint.textContent = "";
        touch();
      });
      syncInput = $("input", syncRow);
    }

    box.appendChild(el("div", { class: "adm-dialog__head" }, [
      el("h2", { class: "adm-h", id: "item-title", text: it.name ? "Позиция" : "Новая позиция" }),
      iconBtn("Закрыть", "×", function () { dlg.close(); })
    ]));
    box.appendChild(el("div", { class: "item-photo" }, [img, none, el("div", { class: "item-photo__btns" }, [
      el("label", { class: "btn btn--steel adm-file" }, [file, pickText]),
      delPhoto
    ])]));
    box.appendChild(field("Название", nameInput));
    box.appendChild(el("div", { class: "row2" }, [field("Вес или объём", weight), field("Цена, ₽", price)]));
    box.appendChild(field("Описание (необязательно)", el("textarea", { class: "inp", rows: "2", maxlength: "200", text: it.note || "",
      placeholder: "Коротко и по делу: например, «30 см» или «на компанию из 4 человек»",
      oninput: function (e) { it.note = e.target.value; touch(); } })));
    box.appendChild(el("div", { class: "fld" }, [el("span", { text: "Отметка на карточке" }), seg]));
    box.appendChild(field("Раздел", sel));
    box.appendChild(check("Скрыть с сайта — например, если временно нет в наличии", it.hidden, function (on) {
      if (on) it.hidden = true; else { delete it.hidden; delete it.gone; }
      touch();
    }));
    if (syncRow) box.appendChild(syncRow);
    box.appendChild(hint);
    box.appendChild(el("div", { class: "adm-dialog__foot" }, [
      el("button", { type: "button", class: "btn btn--red", text: "Готово", onclick: function () { dlg.close(); } }),
      dangerBtn("Удалить позицию", function () {
        var c = catOf(it);
        if (it.eda) ignoreEda(it.eda);
        if (c) c.items.splice(c.items.indexOf(it), 1);
        dlg.close();
        touch();
      })
    ]));
    showPhoto();
    if (!dlg.open) dlg.showModal();
    box.scrollTop = 0;
    if (!it.name) nameInput.focus();
  }
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });

  $("#menu-search").addEventListener("input", function (e) { menuQuery = e.target.value; renderMenu(); });
  $("#cat-add").addEventListener("click", function () {
    var cat = { category: "", items: [] };
    state.menu.push(cat);
    openCats.add(cat);
    menuQuery = "";
    $("#menu-search").value = "";
    renderMenu();
    changed();
    var titles = $$("#menu-cats .mc-title");
    titles[titles.length - 1].focus();
  });
  $("#menu-sync").addEventListener("change", function (e) { state.site.menuSync = e.target.checked; changed(); });
  // пустой коммит с пометкой [menu] запускает робота (.github/workflows/pages.yml)
  $("#menu-robot").addEventListener("click", function () {
    var b = $("#menu-robot");
    if (isDirty()) { setStatus("Сначала сохраните изменения, потом запускайте сверку.", true); return; }
    b.disabled = true;
    setStatus("Запускаю сверку…");
    commit([], "Сверить меню с Яндекс Едой [menu]").then(function () {
      setStatus("Сверка запущена: через 2–3 минуты меню на сайте обновится. Чтобы увидеть изменения здесь, обновите страницу админки.");
    }).catch(function (e) {
      b.disabled = false;
      setStatus("Не получилось запустить сверку: " + e.message, true);
    });
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
    return state.site && (JSON.stringify(state.site) !== saved.site || JSON.stringify(state.menu) !== saved.menu);
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
    var promos = s.promos || [];
    for (var k = 0; k < promos.length; k++) {
      if (!String(promos[k].title || "").trim()) return "У акции нет названия: заполните его или удалите акцию.";
    }
    for (var i = 0; i < state.menu.length; i++) {
      var sec = state.menu[i];
      if (!String(sec.category || "").trim()) return "У раздела меню нет названия.";
      for (var j = 0; j < sec.items.length; j++) {
        if (!String(sec.items[j].name || "").trim()) return "В разделе «" + sec.category + "» есть позиция без названия.";
      }
    }
    return "";
  }

  // лишние пробелы и пустые необязательные поля убираем прямо в данных
  function cleanMenu() {
    state.menu.forEach(function (sec) {
      sec.category = String(sec.category || "").trim();
      sec.items.forEach(function (it) {
        ["name", "weight", "note"].forEach(function (k) {
          if (it[k] == null) return;
          it[k] = String(it[k]).trim();
          if (!it[k] && k !== "name") delete it[k];
        });
      });
    });
  }

  saveBtn.addEventListener("click", function () {
    var problem = validate();
    if (problem) { setStatus(problem, true); return; }

    cleanMenu();
    var files = [];
    var site = state.site;
    if (JSON.stringify(site) !== saved.site) {
      files.push({ path: SITE_FILE, b64: toB64(heads.site + "window.SITE = " + JSON.stringify(site, null, 2) + ";\n") });
    }
    if (JSON.stringify(state.menu) !== saved.menu) {
      files.push({ path: MENU_FILE, b64: toB64(heads.menu + "window.MENU = " + JSON.stringify(state.menu, null, 2) + ";\n") });
    }
    // новые фото зала и блюд, которые остались в данных и ещё не отправлены
    var now = site.gallery.map(function (g) { return g.photo; }).concat(menuPhotos(state.menu));
    var listed = {};
    Object.keys(newPhotos).forEach(function (p) {
      if (now.indexOf(p) >= 0 && !newPhotos[p].sent && !listed[p]) { listed[p] = 1; files.push({ path: p, b64: newPhotos[p].b64 }); }
    });
    // убранные фото удаляем из репозитория: фото зала и загруженные в админке фото блюд
    // (фото из Яндекс Еды убирает сам робот, когда на них больше ничего не ссылается)
    JSON.parse(saved.site).gallery.map(function (g) { return g.photo; })
      .filter(function (p) { return p.indexOf("images/gallery/") === 0; })
      .concat(menuPhotos(JSON.parse(saved.menu)).filter(function (p) { return /^images\/menu\/(thumb\/)?u-/.test(p); }))
      .forEach(function (p) {
        if (now.indexOf(p) < 0 && !listed[p]) { listed[p] = 1; files.push({ path: p, b64: null }); }
      });
    if (!files.length) return;

    saving = true;
    saveBtn.disabled = true;
    setStatus("Сохраняю…");
    commit(files, "Изменения из админки").then(function () {
      saved.site = JSON.stringify(state.site);
      saved.menu = JSON.stringify(state.menu);
      newPhotos = Object.keys(newPhotos).reduce(function (o, p) {
        // превью нужно, пока сайт не обновился; повторно не отправляем
        if (now.indexOf(p) >= 0) { o[p] = newPhotos[p]; o[p].sent = true; }
        return o;
      }, {});
      saving = false;
      renderMenu();
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

  /* ---------- предпросмотр: сайт с несохранёнными правками в окне поверх админки ---------- */
  var previewDlg = $("#preview-dialog");
  var previewFrame = $("#preview-frame");
  $("#preview-close").addEventListener("click", function () { previewDlg.close(); });
  previewDlg.addEventListener("close", function () { previewFrame.src = "about:blank"; });
  $("#preview").addEventListener("click", function () {
    var site = JSON.parse(JSON.stringify(state.site));
    var menu = JSON.parse(JSON.stringify(state.menu));
    // новые фото ещё не на сайте: показываем их из памяти браузера
    (site.gallery || []).forEach(function (g) { g.photo = srcOf(g.photo); });
    menu.forEach(function (c) {
      (c.items || []).forEach(function (it) {
        if (it.photo) it.photo = srcOf(it.photo);
        if (it.thumb) it.thumb = srcOf(it.thumb);
      });
    });
    try {
      localStorage.setItem(PREVIEW_KEY, JSON.stringify({ site: site, menu: menu }));
    } catch (e) {
      setStatus("Не получилось открыть предпросмотр: в браузере не хватило места.", true);
      return;
    }
    previewFrame.src = "./?preview&t=" + Date.now();
    previewDlg.showModal();
  });

  function renderAll() {
    fillInputs();
    $("#menu-sync").checked = state.site.menuSync !== false;
    renderNoticePreview();
    renderPromos();
    renderLeagues();
    renderMenu();
    renderPhotos();
    changed();
    tabsFade();
  }

  if (token) start(); else showLogin();
})();
