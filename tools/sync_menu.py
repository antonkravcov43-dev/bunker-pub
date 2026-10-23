#!/usr/bin/env python3
"""Синхронизация меню сайта с Яндекс Едой.

Запускается роботом GitHub (.github/workflows/pages.yml) раз в сутки
и вручную кнопкой «Run workflow». Берёт меню заведения из Яндекс Еды,
обновляет data/menu.js и фото блюд в images/menu.

Если меню не изменилось, файлы остаются как были. Если Яндекс Еда
ответила ошибкой или подозрительно коротким меню, скрипт ничего
не трогает и завершается с ошибкой: сайт остаётся с прошлым меню.

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
MANIFEST = os.path.join(ROOT, "data", "menu-photos.json")
PHOTO_DIR = os.path.join(ROOT, "images", "menu")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json",
}
MIN_DISHES = 10  # меньше — значит, Яндекс Еда отдала что-то не то

# Полка-подборка, которая только повторяет блюда из других разделов.
SKIP = {"Выбор пользователей"}

# Порядок разделов на сайте. Новые разделы из Яндекс Еды встанут в конец.
ORDER = [
    "Бургеры", "Осеннее меню", "Горячие закуски", "Закуски к пиву", "На компанию",
    "Холодные закуски", "Салаты", "Первые блюда", "Вторые блюда", "Пицца", "Паста",
    "Гарниры", "Десерты", "Напитки", "Домашние заготовки",
]

# Вес вынесен из названий, исправлены опечатки.
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

# Только факты о размере, без составов и эпитетов.
NOTES = {
    "Пицца Гриль": "30 см",
    "Пицца с телятиной": "30 см, острая",
    "Пицца Дары моря": "30 см",
    "Пицца Четыре сыра": "30 см",
}

# Для новых блюд: вес в конце названия ("… 300 гр", "… 0,5л") убираем,
# он и так выводится отдельно.
TAIL_WEIGHT = re.compile(r"\s+\d+(?:[.,]\d+)?\s*(?:гр|г|мл|л|кг)\.?$", re.IGNORECASE)

HEADER = """/*
  Меню «Бункер Паб».

  ОБНОВЛЯЕТСЯ АВТОМАТИЧЕСКИ раз в сутки из Яндекс Еды (eda.yandex.ru/r/bunkerpab).
  Правки в этом файле руками будут перезаписаны: меняйте блюда, цены и фото
  в кабинете Яндекс Еды, сайт подтянет их сам.

  Барное меню (то, чего нет в Яндекс Еде) — в data/bar.js, правится через админку /admin.html.
*/

window.MENU_DEMO = false;

window.MENU = [
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


def save_photo(data, path):
    img = Image.open(io.BytesIO(data))
    img = ImageOps.exif_transpose(img).convert("RGB")
    img.thumbnail((1000, 1000), Image.LANCZOS)
    img.save(path, "JPEG", quality=80, optimize=True, progressive=True)


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


def main():
    payload = json.loads(fetch(API).decode("utf-8"))["payload"]
    sections = [c for c in payload["categories"] if c.get("name") not in SKIP]
    dishes = sum(len(c.get("items") or []) for c in sections)
    if dishes < MIN_DISHES:
        sys.exit(f"Яндекс Еда отдала всего {dishes} блюд — меню не трогаю.")

    order = [n for n in ORDER if any(c["name"] == n for c in sections)]
    order += [c["name"] for c in sections if c["name"] not in ORDER]
    by_name = {c["name"]: c for c in sections}

    manifest = json.loads(read(MANIFEST, "{}"))
    taken = set(manifest.values())
    used, downloaded, blocks, count = {}, 0, [], 0

    for cname in order:
        rows = []
        for it in by_name[cname].get("items") or []:
            orig = it["name"]
            weight = (it.get("weight") or "").strip()
            name = clean_name(orig, weight)
            price = it.get("price")
            fields = [f"name: {json.dumps(name, ensure_ascii=False)}"]
            if weight:
                fields.append(f"weight: {json.dumps(weight, ensure_ascii=False)}")
            if price is not None:
                fields.append(f"price: {int(price) if float(price).is_integer() else price}")

            ident = (it.get("picture") or {}).get("avatarnica_identity")
            if ident:
                fn = manifest.get(ident)
                if not fn or not os.path.exists(os.path.join(PHOTO_DIR, fn + ".jpg")):
                    if not fn:
                        base, fn, k = slug(name), slug(name), 2
                        while fn in taken:
                            fn, k = f"{base}-{k}", k + 1
                        taken.add(fn)
                    save_photo(fetch(PHOTO_URL.format(ident)), os.path.join(PHOTO_DIR, fn + ".jpg"))
                    downloaded += 1
                used[ident] = fn
                fields.append(f'photo: "images/menu/{fn}.jpg"')

            if orig in NOTES:
                fields.append(f"note: {json.dumps(NOTES[orig], ensure_ascii=False)}")
            rows.append("      { " + ", ".join(fields) + " }")
            count += 1
        if rows:
            blocks.append("  {\n"
                          f"    category: {json.dumps(cname, ensure_ascii=False)},\n"
                          "    items: [\n" + ",\n".join(rows) + "\n    ]\n  }")

    # Фото блюд, которых больше нет в меню, удаляем. Трогаем только файлы,
    # которые сами скачали (они есть в manifest), остальное в папке не трогаем.
    removed = 0
    for ident, fn in manifest.items():
        if ident not in used and fn not in used.values():
            path = os.path.join(PHOTO_DIR, fn + ".jpg")
            if os.path.exists(path):
                os.remove(path)
                removed += 1

    menu_changed = write_if_changed(MENU_JS, HEADER + ",\n".join(blocks) + "\n];\n")
    write_if_changed(MANIFEST, json.dumps(dict(sorted(used.items())), ensure_ascii=False, indent=2) + "\n")
    print(f"Разделов: {len(blocks)}, блюд: {count}. Новых фото: {downloaded}, удалено фото: {removed}. "
          f"Меню {'обновлено' if menu_changed else 'не изменилось'}.")


if __name__ == "__main__":
    main()
