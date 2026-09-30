(() => {
  const grid = document.getElementById('news-grid');
  if (!grid) return;

  let cachedNews = null;
  let rendering = false;

  const escapeHTML = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function createSlug(article) {
    return `${article.date || ''}-${article.title || ''}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function formatDate(value) {
    if (!value) return '';
    const [year, month, day] = String(value).split('-').map(Number);
    if (!year || !month || !day) return String(value);
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric'
    }).format(new Date(year, month - 1, day)).replaceAll('.', '').toUpperCase();
  }

  function excerpt(value, maxLength) {
    const clean = String(value || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLength) return clean;
    const clipped = clean.slice(0, maxLength + 1);
    const lastSpace = clipped.lastIndexOf(' ');
    return `${clipped.slice(0, lastSpace > maxLength * .72 ? lastSpace : maxLength).trim()}…`;
  }

  function imageBlock(article) {
    const image = String(article.image || '').trim();
    if (!image) {
      return '<div class="home-news-media"><div class="home-news-placeholder">HYPERDRIVE</div></div>';
    }
    return `
      <div class="home-news-media">
        <img src="${escapeHTML(image)}" alt="${escapeHTML(article.title)}" loading="lazy" onerror="this.remove();this.parentElement.innerHTML='<div class=&quot;home-news-placeholder&quot;>HYPERDRIVE</div>'">
      </div>`;
  }

  function card(article, index) {
    const featured = index === 0;
    const url = `noticia.html?slug=${encodeURIComponent(createSlug(article))}`;
    return `
      <a class="home-news-card ${featured ? 'home-news-card--featured' : 'home-news-card--secondary'}" href="${url}">
        ${imageBlock(article)}
        <div class="home-news-content">
          <div class="home-news-meta">
            <span class="home-news-category">${escapeHTML(article.category || 'HYPERDRIVE')}</span>
            <span class="home-news-date">${escapeHTML(formatDate(article.date))}</span>
          </div>
          <h3>${escapeHTML(article.title || 'Noticia HyperDrive')}</h3>
          <p class="home-news-excerpt">${escapeHTML(excerpt(article.summary, featured ? 260 : 125))}</p>
          <div class="home-news-footer">
            <span class="home-news-read">LEER NOTICIA</span>
            <span class="home-news-arrow">→</span>
          </div>
        </div>
      </a>`;
  }

  function render(news) {
    if (!Array.isArray(news) || !news.length) return;
    rendering = true;
    grid.classList.add('home-news-editorial');
    grid.innerHTML = `<span data-home-news-editorial-marker hidden></span>${news.slice(0, 3).map(card).join('')}`;
    rendering = false;
  }

  async function load() {
    try {
      const response = await fetch('data/news.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`News ${response.status}`);
      const data = await response.json();
      cachedNews = Array.isArray(data.news) ? data.news : [];
      if (cachedNews.length) render(cachedNews);
    } catch (error) {
      console.error('Homepage editorial news error:', error);
    }
  }

  const observer = new MutationObserver(() => {
    if (rendering || !cachedNews?.length) return;
    if (!grid.querySelector('[data-home-news-editorial-marker]')) render(cachedNews);
  });
  observer.observe(grid, { childList: true, subtree: false });

  load();
})();
