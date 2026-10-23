/*
  Меню «Бункер Паб».

  ОБНОВЛЯЕТСЯ АВТОМАТИЧЕСКИ раз в сутки из Яндекс Еды (eda.yandex.ru/r/bunkerpab).
  Правки в этом файле руками будут перезаписаны: меняйте блюда, цены и фото
  в кабинете Яндекс Еды, сайт подтянет их сам.

  Барное меню (то, чего нет в Яндекс Еде) — в data/bar.js, правится через админку /admin.html.
*/

window.MENU_DEMO = false;

window.MENU = [
  {
    category: "Бургеры",
    items: [
      { name: "Бургер Черный Бункер", weight: "510 г", price: 910, photo: "images/menu/burger-chernyy-bunker.jpg" },
      { name: "Бургер ПаБ", weight: "325 г", price: 630, photo: "images/menu/burger-pab.jpg" },
      { name: "Бургер Секач", weight: "360 г", price: 750, photo: "images/menu/burger-sekach.jpg" },
      { name: "Бургер Ежевичная курочка", weight: "330 г", price: 650, photo: "images/menu/burger-ezhevichnaya-kurochka.jpg" },
      { name: "Бургер Секач мини", weight: "220 г", price: 400, photo: "images/menu/burger-sekach-mini.jpg" },
      { name: "Бургер Черный Бункер мини", weight: "220 г", price: 540, photo: "images/menu/burger-chernyy-bunker-mini.jpg" },
      { name: "Бургер ПаБ мини", weight: "190 г", price: 350, photo: "images/menu/burger-pab-mini.jpg" },
      { name: "Бургер, который ты хотел", weight: "600 г", price: 990, photo: "images/menu/burger-kotoryy-ty-hotel.jpg" },
      { name: "Бургер Ежевичная курочка мини", weight: "190 г", price: 370, photo: "images/menu/burger-ezhevichnaya-kurochka-mini.jpg" },
      { name: "ГрибБургер", weight: "310 г", price: 580, photo: "images/menu/gribburger.jpg" },
      { name: "Креветка Бургер", weight: "260 г", price: 600, photo: "images/menu/krevetka-burger.jpg" }
    ]
  },
  {
    category: "Осеннее меню",
    items: [
      { name: "Камамбер-бургер с брусничным соусом", weight: "300 г", price: 890, photo: "images/menu/kamamber-burger-s-brusnichnym-sousom.jpg" },
      { name: "Сливочная паста с лисичками", weight: "340 г", price: 660, photo: "images/menu/slivochnaya-pasta-s-lisichkami.jpg" },
      { name: "Фермерские овощи на сковороде под сыром", weight: "230 г", price: 350, photo: "images/menu/fermerskie-ovoschi-na-skovorode-pod-syrom.jpg" },
      { name: "Крем-суп сливочно-морковный с креветками", weight: "400 г", price: 550, photo: "images/menu/krem-sup-slivochno-morkovnyy-s-krevetkami.jpg" },
      { name: "Теплый салат с телятиной и лисичками", weight: "240 г", price: 890, photo: "images/menu/teplyy-salat-s-telyatinoy-i-lisichkami.jpg" }
    ]
  },
  {
    category: "Горячие закуски",
    items: [
      { name: "Мидии по-гваделупски", weight: "350 г", price: 780, photo: "images/menu/midii-po-gvadelupski.jpg" },
      { name: "Креветки жареные", weight: "210 г", price: 900, photo: "images/menu/krevetki-zharenye.jpg" },
      { name: "Креветки отварные", weight: "210 г", price: 880, photo: "images/menu/krevetki-otvarnye.jpg" },
      { name: "Не барабуля, но тоже вкусно", weight: "210 г", price: 500, photo: "images/menu/ne-barabulya-no-tozhe-vkusno.jpg" },
      { name: "Жареные пряные мидии", weight: "240 г", price: 770, photo: "images/menu/zharenye-pryanye-midii.jpg" },
      { name: "Мидии в сливочном соусе", weight: "260 г", price: 780, photo: "images/menu/midii-v-slivochnom-souse.jpg" },
      { name: "Острые куриные крылья", weight: "250 г", price: 650, photo: "images/menu/ostrye-kurinye-krylya.jpg" },
      { name: "Жареные пельмени с сыром Чеддер", weight: "240 г", price: 580, photo: "images/menu/zharenye-pelmeni-s-syrom-chedder.jpg" },
      { name: "Сыр жареный", weight: "200 г", price: 600, photo: "images/menu/syr-zharenyy.jpg" },
      { name: "Шеф мидии", weight: "380 г", price: 850, photo: "images/menu/shef-midii.jpg" },
      { name: "Куриные крылья в соусе Терияки", weight: "280 г", price: 630, photo: "images/menu/kurinye-krylya-v-souse-teriyaki.jpg" },
      { name: "Жареные свиные уши с луком фри", weight: "125 г", price: 350, photo: "images/menu/zharenye-svinye-ushi-s-lukom-fri.jpg" }
    ]
  },
  {
    category: "Закуски к пиву",
    items: [
      { name: "Гренки чесночные", weight: "190 г", price: 320, photo: "images/menu/grenki-chesnochnye.jpg" },
      { name: "Арахис", weight: "100 г", price: 190, photo: "images/menu/arahis.jpg" },
      { name: "Фисташки", weight: "100 г", price: 530, photo: "images/menu/fistashki.jpg" },
      { name: "Арахис копченый", weight: "100 г", price: 250, photo: "images/menu/arahis-kopchenyy.jpg" }
    ]
  },
  {
    category: "На компанию",
    items: [
      { name: "Гриль сет", weight: "569 г", price: 1250, photo: "images/menu/gril-set.jpg" },
      { name: "Харин сет", weight: "2,12 кг", price: 5550, photo: "images/menu/harin-set.jpg" },
      { name: "Ассорти к пиву", weight: "570 г", price: 750, photo: "images/menu/assorti-k-pivu.jpg" },
      { name: "Баварский сет", weight: "759 г", price: 2300, photo: "images/menu/bavarskiy-set.jpg" },
      { name: "Сет Сытный Егерь", weight: "1,35 кг", price: 3100, photo: "images/menu/set-sytnyy-eger.jpg" }
    ]
  },
  {
    category: "Холодные закуски",
    items: [
      { name: "Деревенский набор", weight: "430 г", price: 1090, photo: "images/menu/derevenskiy-nabor.jpg" },
      { name: "Ассорти под водочку и не только", weight: "345 г", price: 640, photo: "images/menu/assorti-pod-vodochku-i-ne-tolko.jpg" },
      { name: "Ассорти солений из бочки", weight: "460 г", price: 550, photo: "images/menu/assorti-soleniy-iz-bochki.jpg" }
    ]
  },
  {
    category: "Салаты",
    items: [
      { name: "Теплый салат без осетра, но с тигровой креветкой", weight: "260 г", price: 870, photo: "images/menu/teplyy-salat-bez-osetra-no-s-tigrovoy-krevetkoy.jpg" },
      { name: "Теплый салат Платовский фирменный", weight: "275 г", price: 850, photo: "images/menu/teplyy-salat-platovskiy-firmennyy.jpg" },
      { name: "Салат Томяк", weight: "250 г", price: 620, photo: "images/menu/salat-tomyak.jpg" },
      { name: "Салат греческий с акцентом", weight: "310 г", price: 660, photo: "images/menu/salat-grecheskiy-s-aktsentom.jpg" },
      { name: "Салат с морепродуктами", weight: "300 г", price: 870, photo: "images/menu/salat-s-moreproduktami.jpg" },
      { name: "Салат Цезарь с креветкой", weight: "285 г", price: 820, photo: "images/menu/salat-tsezar-s-krevetkoy.jpg" },
      { name: "Теплый салат с лососем и авокадо", weight: "300 г", price: 850, photo: "images/menu/teplyy-salat-s-lososem-i-avokado.jpg" },
      { name: "Салат Цезарь с курицей", weight: "285 г", price: 690, photo: "images/menu/salat-tsezar-s-kuritsey.jpg" }
    ]
  },
  {
    category: "Первые блюда",
    items: [
      { name: "Борщ по-новочеркасски", weight: "500 г", price: 550, photo: "images/menu/borsch-po-novocherkasski.jpg" },
      { name: "Солянка сборная мясная по-ростовски", weight: "380 г", price: 530, photo: "images/menu/solyanka-sbornaya-myasnaya-po-rostovski.jpg" },
      { name: "Суп с лососем и креветкой", weight: "420 г", price: 670, photo: "images/menu/sup-s-lososem-i-krevetkoy.jpg" },
      { name: "Суп-лапша по-домашнему", weight: "400 г", price: 390, photo: "images/menu/sup-lapsha-po-domashnemu.jpg" }
    ]
  },
  {
    category: "Вторые блюда",
    items: [
      { name: "Филе Шато", weight: "350 г", price: 1990, photo: "images/menu/file-shato.jpg" },
      { name: "Жаркое из свинины", weight: "450 г", price: 800, photo: "images/menu/zharkoe-iz-svininy.jpg" },
      { name: "Жаркое с говядиной на сковороде", weight: "250 г", price: 920, photo: "images/menu/zharkoe-s-govyadinoy-na-skovorode.jpg" },
      { name: "Крута из индейки с грибами в сливочном соусе", weight: "320 г", price: 890, photo: "images/menu/kruta-iz-indeyki-s-gribami-v-slivochnom-souse.jpg" },
      { name: "Стейк Пьяного Кабанчика", weight: "320 г", price: 970, photo: "images/menu/steyk-pyanogo-kabanchika.jpg" },
      { name: "Сочные миньоны из фермерской телятины", weight: "290 г", price: 1860, photo: "images/menu/sochnye-minony-iz-fermerskoy-telyatiny.jpg" },
      { name: "Колбаса по-баварски", weight: "470 г", price: 690, photo: "images/menu/kolbasa-po-bavarski.jpg" },
      { name: "Королевский стейк лосося", weight: "340 г", price: 2300, photo: "images/menu/korolevskiy-steyk-lososya.jpg" }
    ]
  },
  {
    category: "Пицца",
    items: [
      { name: "Пицца Гриль", weight: "600 г", price: 890, photo: "images/menu/pitstsa-gril.jpg", note: "30 см" },
      { name: "Пицца с телятиной", weight: "550 г", price: 940, photo: "images/menu/pitstsa-s-telyatinoy.jpg", note: "30 см, острая" },
      { name: "Пицца Дары моря", weight: "600 г", price: 990, photo: "images/menu/pitstsa-dary-morya.jpg", note: "30 см" },
      { name: "Пицца Четыре сыра", weight: "500 г", price: 840, photo: "images/menu/pitstsa-chetyre-syra.jpg", note: "30 см" }
    ]
  },
  {
    category: "Паста",
    items: [
      { name: "Паста Карбонара", weight: "300 г", price: 660, photo: "images/menu/pasta-karbonara.jpg" },
      { name: "Паста сливочная с тигровыми креветками", weight: "340 г", price: 860, photo: "images/menu/pasta-slivochnaya-s-tigrovymi-krevetkami.jpg" }
    ]
  },
  {
    category: "Гарниры",
    items: [
      { name: "Картофель фри", weight: "150 г", price: 300, photo: "images/menu/kartofel-fri.jpg" },
      { name: "Картофель по-деревенски в специях", weight: "150 г", price: 310, photo: "images/menu/kartofel-po-derevenski-v-spetsiyah.jpg" },
      { name: "Хлебная корзина", weight: "120 г", price: 300, photo: "images/menu/hlebnaya-korzina.jpg" },
      { name: "Овощи гриль", weight: "170 г", price: 580, photo: "images/menu/ovoschi-gril.jpg" }
    ]
  },
  {
    category: "Десерты",
    items: [
      { name: "Чизкейк шоколадный", weight: "170 г", price: 450, photo: "images/menu/chizkeyk-shokoladnyy.jpg" },
      { name: "Чизкейк клубничный", weight: "170 г", price: 450, photo: "images/menu/chizkeyk-klubnichnyy.jpg" },
      { name: "Штрудель", weight: "220 г", price: 580, photo: "images/menu/shtrudel.jpg" },
      { name: "Чизкейк классический", weight: "170 г", price: 450, photo: "images/menu/chizkeyk-klassicheskiy.jpg" },
      { name: "Шоколадный фондан", weight: "150 г", price: 400, photo: "images/menu/shokoladnyy-fondan.jpg" }
    ]
  },
  {
    category: "Напитки",
    items: [
      { name: "Cola, Sprite, Fanta в стекле", weight: "330 мл", price: 290, photo: "images/menu/cola-sprite-fanta-v-stekle.jpg" },
      { name: "Морс клюквенный", weight: "1 л", price: 400, photo: "images/menu/mors-klyukvennyy.jpg" },
      { name: "Добрый лимон-лайм", weight: "330 мл", price: 240, photo: "images/menu/dobryy-limon-laym.jpg" },
      { name: "BonAqua газ/негаз", weight: "330 мл", price: 270, photo: "images/menu/bonaqua-gaz-negaz.jpg" },
      { name: "Рычал Су", weight: "500 мл", price: 340, photo: "images/menu/rychal-su.jpg" },
      { name: "Cola, Fanta, Sprite в банке", weight: "330 мл", price: 290, photo: "images/menu/cola-fanta-sprite-v-banke.jpg" }
    ]
  },
  {
    category: "Домашние заготовки",
    items: [
      { name: "Пельмени домашние", weight: "1 кг", price: 800, photo: "images/menu/pelmeni-domashnie.jpg" },
      { name: "Вареники с картофелем и грибами", weight: "1 кг", price: 690, photo: "images/menu/vareniki-s-kartofelem-i-gribami.jpg" }
    ]
  }
];
