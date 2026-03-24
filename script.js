/* ═══════════════════════════════════════════════════════════
   WANDERLENS — script.js
   Premium Travel Image Gallery · Vanilla JS
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ─── CONFIG ─────────────────────────────────────────────────
// Replace with your Unsplash Access Key from https://unsplash.com/developers
const UNSPLASH_ACCESS_KEY = 'UeZHP4Ua1ugbkH5yt4fcozTu7N8r9-kp1Ep0I0SKqmk';
const UNSPLASH_BASE = 'https://api.unsplash.com';
const RESULTS_PER_PAGE = 15;
const MAX_HISTORY = 10;

// ─── STATE ──────────────────────────────────────────────────
let state = {
  images: [],          // [{id, url, thumb, alt, credit, creditLink, downloadLink}]
  currentIndex: 0,     // active gallery index
  query: '',           // current search query
  favorites: [],       // [{query, thumb, images[]}]
  history: [],         // string[]
  theme: 'dark',       // 'dark' | 'light'
};

// ─── DOM REFS ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const dom = {
  html:           document.documentElement,
  searchInput:    $('searchInput'),
  searchBtn:      $('searchBtn'),
  themeToggle:    $('themeToggle'),
  heroSection:    $('heroSection'),
  spinner:        $('spinner'),
  errorMsg:       $('errorMsg'),
  gallerySection: $('gallerySection'),
  galleryTitle:   $('galleryTitle'),
  mainImage:      $('mainImage'),
  imageOverlay:   $('imageOverlay'),
  creditText:     $('creditText'),
  copyImgBtn:     $('copyImgBtn'),
  prevBtn:        $('prevBtn'),
  nextBtn:        $('nextBtn'),
  thumbStrip:     $('thumbStrip'),
  favBtn:         $('favBtn'),
  favIcon:        $('favIcon'),
  copyLocationBtn:$('copyLocationBtn'),
  recentSection:  $('recentSection'),
  recentTags:     $('recentTags'),
  clearHistoryBtn:$('clearHistoryBtn'),
  favSection:     $('favSection'),
  favGrid:        $('favGrid'),
  toast:          $('toast'),
};

// ─── INIT ────────────────────────────────────────────────────
function init() {
  loadFromStorage();
  applyTheme(state.theme);
  renderRecentSearches();
  renderFavorites();
  bindEvents();
}

// ─── STORAGE ─────────────────────────────────────────────────
function loadFromStorage() {
  try {
    state.theme     = localStorage.getItem('wl_theme') || 'dark';
    state.favorites = JSON.parse(localStorage.getItem('wl_favorites') || '[]');
    state.history   = JSON.parse(localStorage.getItem('wl_history') || '[]');
  } catch (e) {
    console.warn('Storage read error', e);
  }
}

function saveToStorage() {
  try {
    localStorage.setItem('wl_theme',     state.theme);
    localStorage.setItem('wl_favorites', JSON.stringify(state.favorites));
    localStorage.setItem('wl_history',   JSON.stringify(state.history));
  } catch (e) {
    console.warn('Storage write error', e);
  }
}

// ─── THEME ───────────────────────────────────────────────────
function applyTheme(theme) {
  state.theme = theme;
  dom.html.setAttribute('data-theme', theme);
  saveToStorage();
}

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

// ─── API ─────────────────────────────────────────────────────
async function fetchImages(query) {
  const url = `${UNSPLASH_BASE}/search/photos?query=${encodeURIComponent(query)}&per_page=${RESULTS_PER_PAGE}&orientation=landscape`;
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.results.map(photo => ({
    id:           photo.id,
    url:          photo.urls.regular,
    fullUrl:      photo.urls.full,
    thumb:        photo.urls.thumb,
    alt:          photo.alt_description || query,
    credit:       `Photo by ${photo.user.name}`,
    creditLink:   photo.user.links.html,
    downloadLink: photo.links.html,
  }));
}

// ─── SEARCH FLOW ─────────────────────────────────────────────
async function handleSearch() {
  const query = dom.searchInput.value.trim();
  if (!query) return;
  await searchDestination(query);
}

async function searchDestination(query) {
  state.query = query;
  dom.searchInput.value = query;

  showUI('loading');

  try {
    const images = await fetchImages(query);

    if (!images.length) {
      showUI('error', `No images found for "<em>${escapeHtml(query)}</em>". Try another destination.`);
      return;
    }

    state.images = images;
    state.currentIndex = 0;

    // Save to history
    addToHistory(query);

    showUI('gallery');
    renderGallery();

  } catch (err) {
    console.error(err);
    if (err.message.includes('401') || err.message.includes('403')) {
      showUI('error', 'Invalid API key. Please add your Unsplash Access Key in script.js.');
    } else {
      showUI('error', 'Something went wrong. Please try again later.');
    }
  }
}

// ─── RENDER GALLERY ──────────────────────────────────────────
function renderGallery() {
  const { images, currentIndex, query } = state;

  // Title
  dom.galleryTitle.textContent = query.charAt(0).toUpperCase() + query.slice(1);

  // Set main image with fade
  setMainImage(currentIndex, false);

  // Render thumbnails
  dom.thumbStrip.innerHTML = '';
  images.forEach((img, i) => {
    const thumb = document.createElement('div');
    thumb.className = `thumb-item${i === currentIndex ? ' active' : ''}`;
    thumb.dataset.index = i;
    thumb.innerHTML = `<img src="${img.thumb}" alt="${escapeHtml(img.alt)}" loading="lazy" />`;
    thumb.addEventListener('click', () => goToIndex(i));
    dom.thumbStrip.appendChild(thumb);
  });

  // Sync favorite button state
  updateFavButton();
}

function setMainImage(index, animate = true) {
  const img = state.images[index];
  if (!img) return;
  state.currentIndex = index;

  if (animate) {
    dom.mainImage.classList.add('fading');
    setTimeout(() => {
      dom.mainImage.src   = img.url;
      dom.mainImage.alt   = img.alt;
      dom.mainImage.classList.remove('fading');
    }, 220);
  } else {
    dom.mainImage.src = img.url;
    dom.mainImage.alt = img.alt;
  }

  // Credit
  dom.creditText.innerHTML = `${img.credit} on <a href="${img.downloadLink}" target="_blank" rel="noopener" style="text-decoration:underline;color:inherit">Unsplash</a>`;

  // Sync active thumbnail
  updateActiveThumbnail(index);
}

function goToIndex(index) {
  if (index < 0) index = state.images.length - 1;
  if (index >= state.images.length) index = 0;
  setMainImage(index, true);
}

function updateActiveThumbnail(index) {
  document.querySelectorAll('.thumb-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
  // Scroll thumbnail into view
  const activeThumb = dom.thumbStrip.querySelector('.thumb-item.active');
  if (activeThumb) {
    activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }
}

// ─── NAVIGATION ──────────────────────────────────────────────
function prevImage() { goToIndex(state.currentIndex - 1); }
function nextImage() { goToIndex(state.currentIndex + 1); }

// ─── HISTORY ─────────────────────────────────────────────────
function addToHistory(query) {
  // Remove if exists, then prepend
  state.history = [query, ...state.history.filter(h => h.toLowerCase() !== query.toLowerCase())];
  if (state.history.length > MAX_HISTORY) state.history = state.history.slice(0, MAX_HISTORY);
  saveToStorage();
  renderRecentSearches();
}

function renderRecentSearches() {
  if (!state.history.length) {
    dom.recentSection.classList.add('hidden');
    return;
  }
  dom.recentSection.classList.remove('hidden');
  dom.recentTags.innerHTML = '';
  state.history.forEach(q => {
    const tag = document.createElement('button');
    tag.className = 'tag-item';
    tag.textContent = q;
    tag.addEventListener('click', () => searchDestination(q));
    dom.recentTags.appendChild(tag);
  });
}

function clearHistory() {
  state.history = [];
  saveToStorage();
  renderRecentSearches();
}

// ─── FAVORITES ───────────────────────────────────────────────
function isFavorited() {
  return state.favorites.some(f => f.query.toLowerCase() === state.query.toLowerCase());
}

function updateFavButton() {
  const faved = isFavorited();
  dom.favBtn.classList.toggle('active', faved);
  dom.favIcon.textContent = faved ? '♥' : '♡';
}

function toggleFavorite() {
  if (!state.query || !state.images.length) return;

  if (isFavorited()) {
    removeFavorite(state.query);
  } else {
    addFavorite();
  }
  updateFavButton();
  renderFavorites();
  saveToStorage();
}

function addFavorite() {
  state.favorites.unshift({
    query:  state.query,
    thumb:  state.images[0]?.thumb || '',
    // store minimal image data for reload
    images: state.images,
  });
}

function removeFavorite(query) {
  state.favorites = state.favorites.filter(f => f.query.toLowerCase() !== query.toLowerCase());
}

function renderFavorites() {
  if (!state.favorites.length) {
    dom.favSection.classList.add('hidden');
    return;
  }
  dom.favSection.classList.remove('hidden');
  dom.favGrid.innerHTML = '';

  state.favorites.forEach(fav => {
    const card = document.createElement('div');
    card.className = 'fav-card';

    card.innerHTML = `
      <img class="fav-card-img" src="${fav.thumb}" alt="${escapeHtml(fav.query)}" loading="lazy" />
      <div class="fav-card-body">
        <span class="fav-card-name">${escapeHtml(fav.query)}</span>
        <button class="fav-remove-btn" data-query="${escapeHtml(fav.query)}" title="Remove">✕</button>
      </div>
    `;

    // Click card body to reload gallery (not remove button)
    card.addEventListener('click', e => {
      if (e.target.classList.contains('fav-remove-btn')) return;
      // Load the cached images
      state.images = fav.images;
      state.query  = fav.query;
      state.currentIndex = 0;
      dom.searchInput.value = fav.query;
      showUI('gallery');
      renderGallery();
    });

    card.querySelector('.fav-remove-btn').addEventListener('click', e => {
      e.stopPropagation();
      removeFavorite(fav.query);
      renderFavorites();
      saveToStorage();
      updateFavButton();
    });

    dom.favGrid.appendChild(card);
  });
}

// ─── COPY ────────────────────────────────────────────────────
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Copied!')).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied!');
  });
}

function copyImageLink() {
  const img = state.images[state.currentIndex];
  if (img) copyToClipboard(img.url);
}

function copyLocationName() {
  if (state.query) copyToClipboard(state.query);
}

// ─── TOAST ───────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg = 'Copied!') {
  dom.toast.textContent = msg;
  dom.toast.classList.remove('hidden');
  requestAnimationFrame(() => dom.toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    dom.toast.classList.remove('show');
    setTimeout(() => dom.toast.classList.add('hidden'), 300);
  }, 2000);
}

// ─── UI STATE ────────────────────────────────────────────────
function showUI(state) {
  dom.heroSection.classList.add('hidden');
  dom.spinner.classList.add('hidden');
  dom.errorMsg.classList.add('hidden');
  dom.gallerySection.classList.add('hidden');

  switch (state) {
    case 'loading':
      dom.spinner.classList.remove('hidden');
      break;
    case 'error':
      break; // handled separately
    case 'gallery':
      dom.gallerySection.classList.remove('hidden');
      break;
    case 'hero':
      dom.heroSection.classList.remove('hidden');
      break;
  }
}

// Override to allow error message
function showUI(view, errorText) {
  dom.heroSection.classList.add('hidden');
  dom.spinner.classList.add('hidden');
  dom.errorMsg.classList.add('hidden');
  dom.gallerySection.classList.add('hidden');

  if (view === 'loading') {
    dom.spinner.classList.remove('hidden');
  } else if (view === 'gallery') {
    dom.gallerySection.classList.remove('hidden');
  } else if (view === 'error') {
    dom.errorMsg.innerHTML = errorText || 'Something went wrong.';
    dom.errorMsg.classList.remove('hidden');
  } else {
    dom.heroSection.classList.remove('hidden');
  }
}

// ─── EVENTS ──────────────────────────────────────────────────
function bindEvents() {
  // Search
  dom.searchBtn.addEventListener('click', handleSearch);
  dom.searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSearch();
  });

  // Theme toggle
  dom.themeToggle.addEventListener('click', toggleTheme);

  // Nav buttons
  dom.prevBtn.addEventListener('click', prevImage);
  dom.nextBtn.addEventListener('click', nextImage);

  // Keyboard navigation
  document.addEventListener('keydown', e => {
    if (state.images.length && !isInputFocused()) {
      if (e.key === 'ArrowLeft')  prevImage();
      if (e.key === 'ArrowRight') nextImage();
    }
  });

  // Favorite
  dom.favBtn.addEventListener('click', toggleFavorite);

  // Copy buttons
  dom.copyImgBtn.addEventListener('click', e => { e.stopPropagation(); copyImageLink(); });
  dom.copyLocationBtn.addEventListener('click', copyLocationName);

  // Clear history
  dom.clearHistoryBtn.addEventListener('click', clearHistory);
}

function isInputFocused() {
  return document.activeElement === dom.searchInput;
}

// ─── UTILS ───────────────────────────────────────────────────
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

// ─── START ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);