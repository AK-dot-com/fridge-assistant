/* ============================================
   冷蔵庫アシスタント / api.js
   ------------------------------------------------
   レシピ検索を担当するレイヤー。

   注記:
   楽天レシピAPI（カテゴリ別ランキング取得API）は「持っている食材から
   横断検索する」用途には対応していないため（カテゴリ指定のみ対応）、
   このデモでは同一階層の recipes.json を fetch() で取得し、実際に
   ネットワーク（またはローカルファイル）越しにレシピデータを読み込む
   構成にしている。ローディング表示・エラーハンドリングも本物の
   fetch() の失敗（オフライン・HTTPエラー・JSON破損）に対して動作する。

   実際の外部API（例: 食材横断検索に対応したAPI）に差し替える場合は、
   RECIPES_JSON_URL を実APIのエンドポイントに変更し、_loadRecipes() の
   レスポンス形式の読み替え部分だけ書き換えればよい。
   ============================================ */

// standalone(単一HTML)プレビューでは RECIPES_JSON_URL_OVERRIDE を
// 別途注入することで、同じコードのまま Blob URL 経由の fetch() に切り替えられる。
const RECIPES_JSON_URL = (typeof RECIPES_JSON_URL_OVERRIDE !== 'undefined')
  ? RECIPES_JSON_URL_OVERRIDE
  : 'data/recipes.json';

const RecipeAPI = {
  /** デモ用: 強制的に通信エラーを発生させるフラグ（UIのトグルから制御） */
  simulateOffline: false,

  /**
   * recipes.json を fetch() して取得する。
   * @returns {Promise<Array>}
   */
  async _loadRecipes() {
    let response;
    try {
      response = await fetch(RECIPES_JSON_URL, { cache: 'no-store' });
    } catch (err) {
      // ネットワーク未接続・DNS失敗など、fetch自体が失敗するケース
      throw new ApiError('NETWORK_ERROR', '通信エラーです');
    }

    if (!response.ok) {
      throw new ApiError('HTTP_ERROR', `通信エラーです（status: ${response.status}）`);
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      throw new ApiError('PARSE_ERROR', 'データの解析に失敗しました');
    }

    if (!data || !Array.isArray(data.recipes)) {
      throw new ApiError('FORMAT_ERROR', 'データの形式が正しくありません');
    }

    return data.recipes;
  },

  /**
   * 食材タグ配列から、作れる/近いレシピを検索する。
   * @param {string[]} ingredientTags
   * @returns {Promise<Array>} レシピ情報 + 一致率などを付与した配列
   */
  async searchRecipesByIngredients(ingredientTags) {
    // 検索中であることが分かるよう、体感できる程度のディレイを入れる
    await wait(500 + Math.random() * 500);

    if (this.simulateOffline || !navigator.onLine) {
      throw new ApiError('NETWORK_ERROR', '通信エラーです');
    }

    const recipes = await this._loadRecipes();

    const normalizedTags = ingredientTags.map((t) => t.trim()).filter(Boolean);

    const scored = recipes
      .map((recipe) => {
        const matched = recipe.ingredients.filter((ing) => normalizedTags.includes(ing));
        const missing = recipe.ingredients.filter((ing) => !normalizedTags.includes(ing));
        const matchRate = Math.round((matched.length / recipe.ingredients.length) * 100);
        return { ...recipe, matched, missing, matchRate };
      })
      .filter((recipe) => recipe.matched.length > 0)
      .sort((a, b) => b.matchRate - a.matchRate || b.rating - a.rating);

    return scored;
  },
};

class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function wait(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}
