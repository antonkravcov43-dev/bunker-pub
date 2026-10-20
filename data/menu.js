/*
  Меню «Бункер Паб».

  Как устроено:
    category — название раздела (появится кнопкой в полосе разделов)
    items    — позиции раздела:
      name   — название
      weight — вес или объём, как писать на сайте: "320 г", "0,5 л"
      price  — цена числом, без ₽
      photo  — путь к фото в папке images/menu. Нет фото — уберите строку,
               позиция покажется компактной строкой (удобно для напитков)
      note   — необязательно: одна короткая строка по факту, например "на компанию".
               Без ингредиентов и без «вкусный/сочный».

  Чтобы поменять фото: положите новый файл в images/menu с тем же именем.
  Подробно — в файле КАК_ОБНОВЛЯТЬ.md
*/

// ПРИМЕР. Пока true, на сайте над меню висит пометка «меню-пример».
// Когда впишете настоящее меню, поставьте false.
window.MENU_DEMO = true;

window.MENU = [
  {
    category: "Бургеры",
    items: [
      { name: "Чёрный бункер", weight: "380 г", price: 590, photo: "images/menu/black-bunker.jpg" },
      { name: "Ежевичная курочка", weight: "350 г", price: 540, photo: "images/menu/blackberry-chicken.jpg" },
      { name: "Двойной говяжий", weight: "460 г", price: 690, photo: "images/menu/double-beef.jpg" },
      { name: "Бургер с беконом", weight: "400 г", price: 610, photo: "images/menu/bacon-burger.jpg" }
    ]
  },
  {
    category: "Горячее",
    items: [
      { name: "Свиные рёбра", weight: "600 г", price: 890, photo: "images/menu/pork-ribs.jpg", note: "На компанию из двух-трёх человек" },
      { name: "Стейк из свиной шеи", weight: "300 г", price: 720, photo: "images/menu/pork-steak.jpg" },
      { name: "Куриные крылья", weight: "500 г", price: 560, photo: "images/menu/wings.jpg" },
      { name: "Вареники с картофелем", weight: "300 г", price: 390, photo: "images/menu/vareniki.jpg" }
    ]
  },
  {
    category: "Закуски к пиву",
    items: [
      { name: "Пивная тарелка", weight: "900 г", price: 1290, photo: "images/menu/beer-plate.jpg", note: "На компанию из четырёх человек" },
      { name: "Гренки чесночные", weight: "250 г", price: 290, photo: "images/menu/croutons.jpg" },
      { name: "Луковые кольца", weight: "200 г", price: 320, photo: "images/menu/onion-rings.jpg" },
      { name: "Картофель фри", weight: "200 г", price: 250, photo: "images/menu/fries.jpg" }
    ]
  },
  {
    category: "Пиво",
    items: [
      { name: "Светлое нефильтрованное", weight: "0,5 л", price: 260 },
      { name: "Светлое фильтрованное", weight: "0,5 л", price: 240 },
      { name: "Тёмное", weight: "0,5 л", price: 280 },
      { name: "Сидр", weight: "0,5 л", price: 300 }
    ]
  }
];
