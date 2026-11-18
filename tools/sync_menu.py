#!/usr/bin/env python3
"""Сверка меню сайта с Яндекс Едой.

Меню сайта (data/menu.js) правится в админке: разделы, позиции, фото,
описания, отметки, порядок, скрытие. Этот скрипт раз в сутки (робот GitHub,
.github/workflows/pages.yml) сверяет его с Яндекс Едой и дополняет,
не трогая правки из админки:

- у блюд из Яндекс Еды (поле "eda") обновляет цену, вес и фото — кроме блюд,
  где в админке выключено «Обновлять из Яндекс Еды» (поле "manual");
- новые блюда добавляет в конец их раздела, новый раздел — в конец меню;
- блюда, которых больше нет в Яндекс Еде, скрывает (поле "gone"),
  а когда они возвращаются — показывает снова;
- названия, описания, отметки, порядок и разделы не меняет никогда;
- блюда, удалённые в админке (список menuIgnore в data/site.js), обратно не добавляет;
- к каждому фото делает уменьшенную копию для карточек (images/menu/thumb).

Если в админке выключено «Подтягивать из Яндекс Еды» (menuSync в data/site.js),
скрипт только делает недостающие уменьшенные фото.

Если Яндекс Еда ответила ошибкой или подозрительно коротким меню, скрипт
ничего не трогает и завершается с ошибкой: сайт остаётся с прошлым меню.

Нужен Pillow: pip install pillow
"""
import io
import json
import os
import re
import sys
import urllib.request

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLACE = "bunkerpab_moskovskaya_28_22"
API = "https://eda.yandex.ru/api/v2/menu/retrieve/" + PLACE
PHOTO_URL = "https://avatars.mds.yandex.net/get-eda/{}/1440x1082"
MENU_JS = os.path.join(ROOT, "data", "menu.js")
SITE_JS = os.path.join(ROOT, "data", "site.js")
MANIFEST = os.path.join(ROOT, "data", "menu-photos.json")
PHOTO_DIR = os.path.join(ROOT, "images", "menu")
THUMB_DIR = os.path.join(PHOTO_DIR, "thumb")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json",
}
MIN_DISHES = 10  # меньше — значит, Яндекс Еда отдала что-то не то

# Полка-подборка, которая только повторяет блюда из других разделов.
SKIP = {"Выбор пользователей"}

# Вес вынесен из названий, исправлены опечатки. Применяется только к новым блюдам:
# названия уже добавленных блюд правятся в админке.
RENAME = {
    "Камамбер - бургер с брусничным соусом 300 гр": "Камамбер-бургер с брусничным соусом",
    "Сливочная паста с лисичками 340 мл": "Сливочная паста с лисичками",
    "Фермерские овощи на сковороде под сыром 230 гр": "Фермерские овощи на сковороде под сыром",
    "Крем суп Сливочно морковный с креветками 400 мл": "Крем-суп сливочно-морковный с креветками",
    "Теплый салат с телятиной и лисичками 240 гр": "Теплый салат с телятиной и лисичками",
    "Картофель По-деревенски в специях": "Картофель по-деревенски в специях",
    "Мидии По-Гваделупски": "Мидии по-гваделупски",
    "Креветки жаренные": "Креветки жареные",
    "Сыр жаренный": "Сыр жареный",
    "Жаренные свиные уши с луком фри": "Жареные свиные уши с луком фри",
    "Cola, Sprite, Fanta 0,33 л стекло": "Cola, Sprite, Fanta в стекле",
    "Морс клюквенный 1л": "Морс клюквенный",
    "Добрый лимон-лайм 0,33 ж/б": "Добрый лимон-лайм",
    "BonAqua газ/негаз 0,33 л": "BonAqua газ/негаз",
    "Рычал Су 0,5л": "Рычал Су",
    "Ж/б напиток 0,33 л (Cola, Fanta, Sprite)": "Cola, Fanta, Sprite в банке",
    "Пельмени домашние 1 кг": "Пельмени домашние",
    "Вареники картофель/грибы 1 кг": "Вареники с картофелем и грибами",
    "Борщ По - Новочеркасски": "Борщ по-новочеркасски",
    "Солянка сборная мясная По-Ростовски": "Солянка сборная мясная по-ростовски",
    "Суп лапша По- домашнему": "Суп-лапша по-домашнему",
    "Чизкейк классичекий": "Чизкейк классический",
    "Теплый салат Без осетра, но с тигровой креветкой": "Теплый салат без осетра, но с тигровой креветкой",
    "Салат греческий С акцентом": "Салат греческий с акцентом",
    "Теплый салат с лососем и авакадо": "Теплый салат с лососем и авокадо",
}

# Только факты о размере, без составов и эпитетов. Тоже только для новых блюд.
NOTES = {
    "Пицца Гриль": "30 см",
    "Пицца с телятиной": "30 см, острая",
    "Пицца Дары моря": "30 см",
    "Пицца Четыре сыра": "30 см",
}

# Для новых блюд: вес в конце названия ("… 300 гр", "… 0,5л") убираем,
# он и так выводится отдельно.
TAIL_WEIGHT = re.compile(r"\s+\d+(?:[.,]\d+)?\s*(?:гр|г|мл|л|кг)\.?$", re.IGNORECASE)

HEADER = """// Меню «Бункер Паб»: разделы и позиции. Удобнее всего менять через админку: /admin.html
// Блюда из Яндекс Еды (поле "eda") робот каждое утро сверяет с Яндекс Едой: цены, вес, фото, новые блюда.
// Руками тоже можно, но это строгий JSON: ключи и строки только в двойных кавычках.
"""

TR = dict(zip("абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
              ["a", "b", "v", "g", "d", "e", "e", "zh", "z", "i", "y", "k", "l", "m", "n", "o", "p",
               "r", "s", "t", "u", "f", "h", "ts", "ch", "sh", "sch", "", "y", "", "e", "yu", "ya"]))


def slug(name):
    s = "".join(TR.get(ch, ch) for ch in name.lower())
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:48].strip("-") or "dish"


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def save_jpeg(img, path, size, quality):
    img = img.copy()
    img.thumbnail((size, size), Image.LANCZOS)
    img.save(path, "JPEG", quality=quality, optimize=True, progressive=True)


def save_photo(data, path):
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    save_jpeg(img, path, 1000, 80)


def clean_name(orig, weight):
    if orig in RENAME:
        return RENAME[orig]
    name = orig.strip()
    if weight:
        name = TAIL_WEIGHT.sub("", name)
    return re.sub(r"\s{2,}", " ", name)


def read(path, default=""):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return default


def write_if_changed(path, text):
    if read(path) == text:
        return False
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    return True


def load_assign(path, name):
    """window.NAME = <строгий JSON>; — тот же формат, что пишет админка."""
    text = read(path)
    marker = f"window.{name} ="
    i = text.find(marker)
    if i < 0:
        sys.exit(f"В {path} нет {marker} — меню не трогаю.")
    return json.loads(text[i + len(marker):].strip().rstrip(";"))


def photo_name(path):
    return os.path.splitext(os.path.basename(path or ""))[0]


def all_items(menu):
    for cat in menu:
        for it in cat.get("items") or []:
            yield cat, it


def sync(menu, manifest, ignore):
    """Сверка с Яндекс Едой. Меняет menu и manifest на месте, возвращает строку-отчёт."""
    payload = json.loads(fetch(API).decode("utf-8"))["payload"]
    sections = [c for c in payload["categories"] if c.get("name") not in SKIP]
    dishes = sum(len(c.get("items") or []) for c in sections)
    if dishes < MIN_DISHES:
        sys.exit(f"Яндекс Еда отдала всего {dishes} блюд — меню не трогаю.")

    by_eda = {it["eda"]: (cat, it) for cat, it in all_items(menu) if "eda" in it}
    eda_files = set(manifest.values())
    taken = eda_files | {photo_name(f) for f in os.listdir(PHOTO_DIR)}
    seen, added, downloaded = set(), 0, 0

    def eda_photo(ident, name):
        nonlocal downloaded
        fn = manifest.get(ident)
        if not fn:
            base, fn, k = slug(name), slug(name), 2
            while fn in taken:
                fn, k = f"{base}-{k}", k + 1
            taken.add(fn)
            manifest[ident] = fn
        path = os.path.join(PHOTO_DIR, fn + ".jpg")
        if not os.path.exists(path):
            save_photo(fetch(PHOTO_URL.format(ident)), path)
            downloaded += 1
        return f"images/menu/{fn}.jpg"

    for sec in sections:
        # раздел на сайте, где уже лежат блюда этого раздела Яндекс Еды (его могли переименовать в админке)
        home = next((by_eda[e["id"]][0] for e in sec.get("items") or [] if e["id"] in by_eda), None)
        for e in sec.get("items") or []:
            eid = e["id"]
            if eid in seen or eid in ignore:
                continue
            seen.add(eid)
            weight = (e.get("weight") or "").strip()
            price = e.get("price")
            if price is not None:
                price = int(price) if float(price).is_integer() else price
            ident = (e.get("picture") or {}).get("avatarnica_identity")

            if eid in by_eda:
                it = by_eda[eid][1]
                if it.pop("gone", None):
                    it.pop("hidden", None)
                if it.get("manual"):
                    continue
            else:
                name = clean_name(e["name"], weight)
                it = {"name": name}
                if home is None:
                    home = next((c for c in menu if c.get("category") == sec["name"]), None)
                if home is None:
                    home = {"category": sec["name"], "items": []}
                    menu.append(home)
                home.setdefault("items", []).append(it)
                added += 1

            if weight:
                it["weight"] = weight
            else:
                it.pop("weight", None)
            if price is not None:
                it["price"] = price
            # фото из Яндекс Еды ставим, если своего фото из админки нет
            if ident and (not it.get("photo") or photo_name(it["photo"]) in eda_files or "eda" not in it):
                it["photo"] = eda_photo(ident, it["name"])
            if e["name"] in NOTES and "eda" not in it:
                it["note"] = NOTES[e["name"]]
            it["eda"] = eid

    gone = 0
    for _, it in all_items(menu):
        if "eda" in it and it["eda"] not in seen and not it.get("manual") and not it.get("hidden"):
            it["hidden"] = True
            it["gone"] = True
            gone += 1
    return f"В Яндекс Еде блюд: {len(seen)}. Новых: {added}, скрыто пропавших: {gone}, скачано фото: {downloaded}."


def thumbs(menu):
    """Уменьшенные фото для карточек: images/menu/thumb/<то же имя>.jpg."""
    os.makedirs(THUMB_DIR, exist_ok=True)
    made = 0
    for _, it in all_items(menu):
        photo = it.get("photo") or ""
        if not photo.startswith("images/menu/") or photo.startswith("images/menu/thumb/"):
            it.pop("thumb", None)
            continue
        src = os.path.join(ROOT, photo)
        thumb = "images/menu/thumb/" + os.path.basename(photo)
        dst = os.path.join(ROOT, thumb)
        if not os.path.exists(src):
            continue
        if not os.path.exists(dst):
            save_jpeg(ImageOps.exif_transpose(Image.open(src)).convert("RGB"), dst, 480, 76)
            made += 1
        it["thumb"] = thumb
    return made


def cleanup(menu, manifest):
    """Удаляет фото из Яндекс Еды, на которые больше ничего не ссылается, и лишние уменьшенные копии.
    Фото, загруженные в админке, не трогает: их удаляет сама админка."""
    used = {it.get("photo") for _, it in all_items(menu)} | {it.get("thumb") for _, it in all_items(menu)}
    removed = 0
    for ident, fn in list(manifest.items()):
        if f"images/menu/{fn}.jpg" not in used:
            del manifest[ident]
            for path in (os.path.join(PHOTO_DIR, fn + ".jpg"), os.path.join(THUMB_DIR, fn + ".jpg")):
                if os.path.exists(path):
                    os.remove(path)
                    removed += 1
    for f in os.listdir(THUMB_DIR):
        if f"images/menu/thumb/{f}" not in used:
            os.remove(os.path.join(THUMB_DIR, f))
            removed += 1
    return removed


def main():
    site = load_assign(SITE_JS, "SITE")
    menu = load_assign(MENU_JS, "MENU")
    manifest = json.loads(read(MANIFEST, "{}"))

    if site.get("menuSync", True):
        report = sync(menu, manifest, set(site.get("menuIgnore") or []))
    else:
        report = "Сверка с Яндекс Едой выключена в админке."
    made = thumbs(menu)
    removed = cleanup(menu, manifest)

    text = HEADER + "window.MENU = " + json.dumps(menu, ensure_ascii=False, indent=2) + ";\n"
    changed = write_if_changed(MENU_JS, text)
    write_if_changed(MANIFEST, json.dumps(dict(sorted(manifest.items())), ensure_ascii=False, indent=2) + "\n")
    print(f"{report} Уменьшенных фото сделано: {made}, удалено файлов: {removed}. "
          f"Меню {'обновлено' if changed else 'не изменилось'}.")


if __name__ == "__main__":
    main()
