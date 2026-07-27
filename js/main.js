/* ============================================
   冷蔵庫アシスタント / main.js
   ============================================ */

(() => {
  'use strict';

  /* ---------- State ---------- */
  const state = {
    tags: [],
    lastResults: [],
    activeTab: 'search',
    isLoading: false,
  };

  /* ---------- DOM refs ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const tagField = $('#tagField');
  const tagInput = $('#tagInput');
  const candidateList = $('#candidateList');
  const recentSearchEl = $('#recentSearch');
  const searchForm = $('#searchForm');
  const offlineToggle = $('#offlineToggle');
  const resultsRegion = $('#resultsRegion');
  const resultsCount = $('#resultsCount');
  const favoritesRegion = $('#favoritesRegion');
  const favoritesCount = $('#favoritesCount');
  const shoppingRegion = $('#shoppingRegion');
  const shoppingCount = $('#shoppingCount');
  const themeToggle = $('#themeToggle');
  const modalRoot = $('#modalRoot');
  const tabButtons = $$('[data-tab-target]');
  const panels = {
    search: $('#panel-search'),
    favorites: $('#panel-favorites'),
    shopping: $('#panel-shopping'),
  };

  /* ---------- Init ---------- */
  function init() {
    renderCandidates(INGREDIENT_CANDIDATES);
    renderRecentSearch();
    applyTheme(Storage.getTheme());
    bindEvents();
    renderFavorites();
    renderShoppingList();
    showHint();
  }

  function bindEvents() {
    tagInput.addEventListener('keydown', onTagInputKeydown);
    tagField.addEventListener('click', () => tagInput.focus());
    searchForm.addEventListener('submit', onSearchSubmit);
    offlineToggle.addEventListener('change', () => {
      RecipeAPI.simulateOffline = offlineToggle.checked;
    });
    themeToggle.addEventListener('click', onThemeToggle);
    tabButtons.forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tabTarget)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  /* ---------- Tag input ---------- */
  function onTagInputKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(tagInput.value);
    } else if (e.key === 'Backspace' && tagInput.value === '' && state.tags.length) {
      removeTag(state.tags[state.tags.length - 1]);
    }
  }

  function addTag(raw) {
    const value = raw.trim();
    if (!value) return;
    if (state.tags.includes(value)) {
      tagInput.value = '';
      return;
    }
    state.tags.push(value);
    tagInput.value = '';
    renderTags();
  }

  function removeTag(value) {
    state.tags = state.tags.filter((t) => t !== value);
    renderTags();
  }

  function renderTags() {
    $$('.c-tag', tagField).forEach((el) => el.remove());
    state.tags.forEach((tag) => {
      const el = document.createElement('span');
      el.className = 'c-tag';
      el.innerHTML = `${escapeHtml(tag)}<button type="button" class="c-tag__remove" aria-label="${escapeHtml(tag)}を削除">×</button>`;
      el.querySelector('.c-tag__remove').addEventListener('click', () => removeTag(tag));
      tagField.insertBefore(el, tagInput);
    });
  }

  function renderCandidates(list) {
    candidateList.innerHTML = '';
    list.forEach((name) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'c-candidate';
      btn.textContent = `+ ${name}`;
      btn.setAttribute('aria-label', `${name}をタグに追加`);
      btn.addEventListener('click', () => addTag(name));
      candidateList.appendChild(btn);
    });
  }

  function renderRecentSearch() {
    const recents = Storage.getRecentSearch();
    recentSearchEl.innerHTML = '';
    if (!recents.length) {
      recentSearchEl.classList.add('u-hidden');
      return;
    }
    recentSearchEl.classList.remove('u-hidden');
    const label = document.createElement('span');
    label.textContent = '最近の検索:';
    recentSearchEl.appendChild(label);
    recents.forEach((entry) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'c-recent__chip';
      chip.textContent = entry.tags.join('・');
      chip.addEventListener('click', () => {
        state.tags = [...entry.tags];
        renderTags();
        runSearch();
      });
      recentSearchEl.appendChild(chip);
    });
  }

  /* ---------- Search ---------- */
  function onSearchSubmit(e) {
    e.preventDefault();
    if (tagInput.value.trim()) addTag(tagInput.value);
    runSearch();
  }

  async function runSearch() {
    if (state.tags.length === 0) {
      renderMessage(resultsRegion, {
        icon: '🥕', title: '食材を1つ以上入力してください',
        desc: '上のタグ欄から食材を追加して「レシピを検索」を押してください。',
        tone: 'empty',
      });
      resultsCount.textContent = '';
      return;
    }
    state.isLoading = true;
    renderSkeleton(resultsRegion);
    resultsCount.textContent = '検索中…';

    try {
      const results = await RecipeAPI.searchRecipesByIngredients(state.tags);
      state.lastResults = results;
      Storage.pushRecentSearch(state.tags);
      renderRecentSearch();
      renderResults(results);
    } catch (err) {
      renderMessage(resultsRegion, {
        icon: '😭', title: '通信エラーです',
        desc: '時間を置いてもう一度お試しください。',
        tone: 'error',
        retry: runSearch,
      });
      resultsCount.textContent = '';
    } finally {
      state.isLoading = false;
    }
  }

  function renderSkeleton(container) {
    container.innerHTML = '';
    const loading = document.createElement('div');
    loading.className = 'c-loading';
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-live', 'polite');
    loading.innerHTML = '<span class="c-loading__dots">レシピを探しています</span>';
    container.appendChild(loading);

    const grid = document.createElement('div');
    grid.className = 'p-grid';
    for (let i = 0; i < 3; i += 1) {
      const card = document.createElement('div');
      card.className = 'c-skeleton-card';
      card.innerHTML = `
        <div style="display:flex; gap:12px; align-items:center;">
          <div class="c-skeleton-block c-skeleton-block--thumb"></div>
          <div style="flex:1;">
            <div class="c-skeleton-block c-skeleton-block--line" style="width:70%;"></div>
            <div class="c-skeleton-block c-skeleton-block--line" style="width:40%;"></div>
          </div>
        </div>
        <div class="c-skeleton-block c-skeleton-block--line" style="width:90%; margin-top:16px;"></div>
        <div class="c-skeleton-block c-skeleton-block--line" style="width:60%;"></div>
      `;
      grid.appendChild(card);
    }
    container.appendChild(grid);
  }

  function renderMessage(container, { icon, title, desc, tone, retry }) {
    container.innerHTML = '';
    const box = document.createElement('div');
    box.className = `c-status c-status--${tone}`;
    box.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    box.innerHTML = `
      <div class="c-status__icon" aria-hidden="true">${icon}</div>
      <div class="c-status__title">${escapeHtml(title)}</div>
      <div class="c-status__desc">${escapeHtml(desc)}</div>
    `;
    if (retry) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'c-button c-button--ghost u-mt-8';
      btn.textContent = 'もう一度試す';
      btn.addEventListener('click', retry);
      box.appendChild(btn);
    }
    container.appendChild(box);
  }

  function showHint() {
    renderMessage(resultsRegion, {
      icon: '🧊', title: '今日は何が作れる？',
      desc: '冷蔵庫にある食材をタグで追加して検索してみましょう。',
      tone: 'hint',
    });
  }

  function renderResults(results) {
    resultsCount.textContent = `${results.length}件`;
    resultsRegion.innerHTML = '';

    if (results.length === 0) {
      renderMessage(resultsRegion, {
        icon: '😭', title: '該当するレシピはありません',
        desc: '食材を変えてもう一度検索してみてください。',
        tone: 'empty',
      });
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'p-grid';
    results.forEach((recipe) => grid.appendChild(buildRecipeCard(recipe)));
    resultsRegion.appendChild(grid);
  }

  /* ---------- Recipe card ---------- */
  function matchNote(recipe) {
    if (recipe.matchRate >= 100) return '今ある食材だけで作れます！';
    if (recipe.missing.length === 1) return `${recipe.missing[0]}だけ買えば作れます。`;
    const shown = recipe.missing.slice(0, 2).join('・');
    const suffix = recipe.missing.length > 2 ? 'など' : '';
    return `${shown}${suffix}が必要です。`;
  }

  function matchColor(rate) {
    if (rate >= 100) return 'var(--color-success)';
    if (rate >= 50) return 'var(--color-accent)';
    return 'var(--color-warning)';
  }

  function starsHtml(rating) {
    let html = '';
    for (let i = 1; i <= 5; i += 1) {
      html += `<span class="${i <= rating ? '' : 'is-off'}">★</span>`;
    }
    return html;
  }

  function ringSvg(rate) {
    const r = 20;
    const c = 2 * Math.PI * r;
    const offset = c - (Math.min(rate, 100) / 100) * c;
    return `
      <svg class="p-card__ring" viewBox="0 0 48 48" style="--color-match:${matchColor(rate)}" role="img" aria-label="一致率${rate}%">
        <circle class="is-track" cx="24" cy="24" r="${r}" fill="none" stroke-width="5"></circle>
        <circle class="is-value" cx="24" cy="24" r="${r}" fill="none" stroke-width="5"
          stroke-dasharray="${c}" stroke-dashoffset="${offset}" transform="rotate(-90 24 24)"></circle>
      </svg>`;
  }

  function buildRecipeCard(recipe) {
    const card = document.createElement('article');
    card.className = 'p-card';
    card.style.setProperty('--thumb-bg', recipe.thumbBg || 'var(--color-accent-soft)');

    const isFav = Storage.isFavorite(recipe.id);

    card.innerHTML = `
      <div class="p-card__top">
        <div class="p-card__thumb" role="img" aria-label="${escapeHtml(recipe.title)}のイラスト">${recipe.emoji}</div>
        <div class="p-card__heading">
          <h3 class="p-card__title">${escapeHtml(recipe.title)}</h3>
          <div class="p-card__meta">
            <span class="p-card__stars" aria-label="評価${recipe.rating}/5">${starsHtml(recipe.rating)}</span>
            <span class="p-card__time">⏱ ${recipe.time}分</span>
          </div>
        </div>
        <button type="button" class="p-card__fav" aria-pressed="${isFav}" aria-label="${escapeHtml(recipe.title)}をお気に入りに${isFav ? '解除' : '登録'}">
          ${isFav ? '★' : '☆'}
        </button>
        <div class="p-card__match">
          ${ringSvg(recipe.matchRate)}
          <span class="p-card__ringtext">${recipe.matchRate}%</span>
          <span class="p-card__matchlabel">一致率</span>
        </div>
      </div>

      <div class="p-card__ingredients">
        <div>
          <div class="p-card__grouplabel">使う食材</div>
          <div class="p-card__chips">
            ${recipe.matched.map((ing) => `<span class="c-chip c-chip--have">✓ ${escapeHtml(ing)}</span>`).join('')}
          </div>
        </div>
        ${recipe.missing.length ? `
        <div>
          <div class="p-card__grouplabel">不足</div>
          <div class="p-card__chips" data-missing-chips></div>
        </div>` : ''}
      </div>

      <p class="p-card__matchnote"><strong>一致率 ${recipe.matchRate}%</strong> — ${escapeHtml(matchNote(recipe))}</p>

      <div class="p-card__actions">
        <button type="button" class="c-button c-button--primary c-button--small" data-action="detail">詳細を見る</button>
        ${recipe.missing.length ? '<button type="button" class="c-button c-button--ghost c-button--small" data-action="addall">不足食材を買い物リストへ</button>' : ''}
      </div>
    `;

    const missingChips = $('[data-missing-chips]', card);
    if (missingChips) {
      recipe.missing.forEach((ing) => {
        const chip = document.createElement('span');
        chip.className = 'c-chip c-chip--missing';
        chip.innerHTML = `${escapeHtml(ing)}<button type="button" class="c-chip__add" aria-label="${escapeHtml(ing)}を買い物リストに追加">＋</button>`;
        chip.querySelector('.c-chip__add').addEventListener('click', () => {
          Storage.addShoppingItems([ing]);
          renderShoppingList();
          flashBadge();
        });
        missingChips.appendChild(chip);
      });
    }

    $('.p-card__fav', card).addEventListener('click', () => {
      const nowFav = Storage.toggleFavorite(recipe);
      $('.p-card__fav', card).setAttribute('aria-pressed', String(nowFav));
      $('.p-card__fav', card).textContent = nowFav ? '★' : '☆';
      renderFavorites();
    });

    $('[data-action="detail"]', card).addEventListener('click', () => openDetailModal(recipe));

    const addAllBtn = $('[data-action="addall"]', card);
    if (addAllBtn) {
      addAllBtn.addEventListener('click', () => {
        const added = Storage.addShoppingItems(recipe.missing);
        renderShoppingList();
        addAllBtn.textContent = added > 0 ? '買い物リストに追加しました' : 'すでに追加済みです';
        setTimeout(() => { addAllBtn.textContent = '不足食材を買い物リストへ'; }, 1600);
      });
    }

    return card;
  }

  /* ---------- Detail modal ---------- */
  function openDetailModal(recipe) {
    const isFav = Storage.isFavorite(recipe.id);
    modalRoot.innerHTML = `
      <div class="p-modal-overlay" data-close-modal>
        <div class="p-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
          <button type="button" class="p-modal__close" data-close-modal aria-label="閉じる">×</button>
          <div class="p-modal__thumb" role="img" aria-label="${escapeHtml(recipe.title)}のイラスト">${recipe.emoji}</div>
          <h2 class="p-modal__title" id="modalTitle">${escapeHtml(recipe.title)}</h2>
          <div class="p-modal__meta">
            <span class="p-card__stars" aria-label="評価${recipe.rating}/5">${starsHtml(recipe.rating)}</span>
            <span class="p-card__time">⏱ ${recipe.time}分</span>
            <span class="p-card__time">一致率 ${recipe.matchRate}%</span>
          </div>

          <div class="p-modal__section">
            <div class="p-modal__label">使う食材</div>
            <div class="p-card__chips">
              ${recipe.matched.map((ing) => `<span class="c-chip c-chip--have">✓ ${escapeHtml(ing)}</span>`).join('')}
              ${recipe.missing.map((ing) => `<span class="c-chip c-chip--missing">${escapeHtml(ing)}</span>`).join('')}
            </div>
          </div>

          <div class="p-modal__section">
            <div class="p-modal__label">作り方</div>
            <div class="p-modal__steps">
              ${recipe.steps.map((step, i) => `
                <div class="p-modal__step">
                  <span class="p-modal__stepnum">${i + 1}</span>
                  <span>${escapeHtml(step)}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="p-modal__actions">
            <button type="button" class="c-button c-button--primary" data-modal-fav aria-pressed="${isFav}">
              ${isFav ? '★ お気に入り済み' : '☆ お気に入りに追加'}
            </button>
            ${recipe.missing.length ? '<button type="button" class="c-button c-button--ghost" data-modal-addall>不足食材を追加</button>' : ''}
          </div>
        </div>
      </div>
    `;

    $$('[data-close-modal]', modalRoot).forEach((el) => {
      el.addEventListener('click', (e) => { if (e.target === el) closeModal(); });
    });
    $('.p-modal__close', modalRoot).addEventListener('click', closeModal);

    $('[data-modal-fav]', modalRoot).addEventListener('click', (e) => {
      const nowFav = Storage.toggleFavorite(recipe);
      e.currentTarget.setAttribute('aria-pressed', String(nowFav));
      e.currentTarget.textContent = nowFav ? '★ お気に入り済み' : '☆ お気に入りに追加';
      renderFavorites();
      renderResults(state.lastResults);
    });

    const modalAddAll = $('[data-modal-addall]', modalRoot);
    if (modalAddAll) {
      modalAddAll.addEventListener('click', () => {
        Storage.addShoppingItems(recipe.missing);
        renderShoppingList();
        modalAddAll.textContent = '追加しました';
        setTimeout(() => { modalAddAll.textContent = '不足食材を追加'; }, 1600);
      });
    }

    document.body.style.overflow = 'hidden';
    $('.p-modal__close', modalRoot).focus();
  }

  function closeModal() {
    modalRoot.innerHTML = '';
    document.body.style.overflow = '';
  }

  /* ---------- Favorites ---------- */
  function renderFavorites() {
    const favs = Storage.getFavorites();
    favoritesCount.textContent = favs.length ? `${favs.length}件` : '';
    updateTabBadge('favorites', favs.length);
    favoritesRegion.innerHTML = '';

    if (!favs.length) {
      renderMessage(favoritesRegion, {
        icon: '☆', title: 'お気に入りはまだありません',
        desc: '検索結果の☆ボタンから登録できます。',
        tone: 'empty',
      });
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'p-grid';
    favs.forEach((recipe) => {
      const normalized = { ...recipe, matched: recipe.matched || recipe.ingredients, missing: recipe.missing || [], matchRate: recipe.matchRate ?? 100 };
      grid.appendChild(buildRecipeCard(normalized));
    });
    favoritesRegion.appendChild(grid);
  }

  /* ---------- Shopping list ---------- */
  function renderShoppingList() {
    const items = Storage.getShoppingList();
    shoppingCount.textContent = items.length ? `${items.length}件` : '';
    updateTabBadge('shopping', items.filter((i) => !i.checked).length);
    shoppingRegion.innerHTML = '';

    if (!items.length) {
      renderMessage(shoppingRegion, {
        icon: '🛒', title: '買い物リストは空です',
        desc: 'レシピの「不足」食材の＋ボタンから追加できます。',
        tone: 'empty',
      });
      return;
    }

    const list = document.createElement('ul');
    list.className = 'p-shoplist';
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = `p-shopitem${item.checked ? ' is-checked' : ''}`;
      li.innerHTML = `
        <button type="button" class="p-shopitem__check" role="checkbox" aria-checked="${item.checked}" aria-label="${escapeHtml(item.name)}を購入済みにする">
          ${item.checked ? '✓' : ''}
        </button>
        <span class="p-shopitem__name">${escapeHtml(item.name)}</span>
        <button type="button" class="p-shopitem__remove" aria-label="${escapeHtml(item.name)}をリストから削除">×</button>
      `;
      $('.p-shopitem__check', li).addEventListener('click', () => {
        Storage.toggleShoppingChecked(item.id);
        renderShoppingList();
      });
      $('.p-shopitem__remove', li).addEventListener('click', () => {
        Storage.removeShoppingItem(item.id);
        renderShoppingList();
      });
      list.appendChild(li);
    });
    shoppingRegion.appendChild(list);

    if (items.some((i) => i.checked)) {
      const footer = document.createElement('div');
      footer.className = 'p-shoplist__footer';
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'c-button c-button--danger-outline';
      clearBtn.textContent = 'チェック済みを削除';
      clearBtn.addEventListener('click', () => {
        Storage.clearCheckedShoppingItems();
        renderShoppingList();
      });
      footer.appendChild(clearBtn);
      shoppingRegion.appendChild(footer);
    }
  }

  function updateTabBadge(tab, count) {
    $$(`[data-tab-target="${tab}"] [data-badge]`).forEach((el) => {
      el.textContent = String(count);
      el.classList.toggle('u-hidden', count === 0);
    });
  }

  function flashBadge() {
    // 買い物リストのバッジを軽く強調（アクセシブルな視覚フィードバック）
    $$('[data-tab-target="shopping"]').forEach((btn) => {
      btn.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 260 });
    });
  }

  /* ---------- Tabs ---------- */
  function switchTab(tab) {
    state.activeTab = tab;
    Object.entries(panels).forEach(([name, panel]) => {
      panel.classList.toggle('u-hidden', name !== tab);
    });
    tabButtons.forEach((btn) => {
      const isActive = btn.dataset.tabTarget === tab;
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- Theme ---------- */
  function onThemeToggle() {
    const next = Storage.getTheme() === 'dark' ? 'light' : 'dark';
    Storage.setTheme(next);
    applyTheme(next);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    themeToggle.setAttribute('aria-label', theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え');
  }

  /* ---------- Utils ---------- */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  document.addEventListener('DOMContentLoaded', init);
})();
