/* ============================================
   冷蔵庫アシスタント / storage.js
   LocalStorage設計:
     favoriteRecipes : お気に入りレシピ（レシピオブジェクトの配列）
     shoppingList    : 買い物リスト [{id, name, checked}]
     theme           : 'light' | 'dark'
     recentSearch    : 直近の検索食材タグ（文字列配列）
   ============================================ */

const Storage = {
  _read(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.error(`[Storage] ${key} の読み込みに失敗しました`, err);
      return fallback;
    }
  },
  _write(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`[Storage] ${key} の保存に失敗しました`, err);
      return false;
    }
  },

  getFavorites() { return this._read('favoriteRecipes', []); },
  setFavorites(list) { return this._write('favoriteRecipes', list); },
  isFavorite(id) { return this.getFavorites().some((r) => r.id === id); },
  toggleFavorite(recipe) {
    const list = this.getFavorites();
    const idx = list.findIndex((r) => r.id === recipe.id);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.unshift(recipe);
    }
    this.setFavorites(list);
    return idx < 0; // true: 追加された / false: 削除された
  },

  getShoppingList() { return this._read('shoppingList', []); },
  setShoppingList(list) { return this._write('shoppingList', list); },
  addShoppingItems(names) {
    const list = this.getShoppingList();
    let added = 0;
    names.forEach((name) => {
      if (!list.some((item) => item.name === name)) {
        list.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, checked: false });
        added += 1;
      }
    });
    this.setShoppingList(list);
    return added;
  },
  toggleShoppingChecked(id) {
    const list = this.getShoppingList();
    const item = list.find((i) => i.id === id);
    if (item) item.checked = !item.checked;
    this.setShoppingList(list);
  },
  removeShoppingItem(id) {
    const list = this.getShoppingList().filter((i) => i.id !== id);
    this.setShoppingList(list);
  },
  clearCheckedShoppingItems() {
    const list = this.getShoppingList().filter((i) => !i.checked);
    this.setShoppingList(list);
  },

  getTheme() { return this._read('theme', 'light'); },
  setTheme(theme) { return this._write('theme', theme); },

  getRecentSearch() { return this._read('recentSearch', []); },
  pushRecentSearch(tags) {
    if (!tags.length) return;
    const key = tags.slice().sort().join('・');
    let list = this.getRecentSearch().filter((entry) => entry.key !== key);
    list.unshift({ key, tags });
    list = list.slice(0, 5);
    this._write('recentSearch', list);
  },
};
