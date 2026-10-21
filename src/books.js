const form = document.getElementById('booksSearchForm');
const input = document.getElementById('booksSearchInput');
const view = document.getElementById('booksView');
const status = document.getElementById('booksStatus');

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function setLoading(message) {
  status.textContent = message;
  view.innerHTML = `
    <div class="books-loading" role="status">
      <span class="books-loader" aria-hidden="true"></span>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function renderError(message, missingToken = false) {
  status.textContent = 'No se pudo completar la consulta.';
  view.innerHTML = `
    <div class="books-message-card books-message-error">
      <span class="books-message-label">${missingToken ? 'CONFIGURACIÓN PENDIENTE' : 'ALGO HA FALLADO'}</span>
      <h2>${missingToken ? 'Falta conectar Hardcover' : 'No hemos podido cargar los libros'}</h2>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function renderSearchResults(series, query) {
  status.textContent = `${series.length} ${series.length === 1 ? 'resultado' : 'resultados'} para “${query}”.`;

  if (!series.length) {
    view.innerHTML = `
      <div class="books-message-card">
        <span class="books-message-label">SIN RESULTADOS</span>
        <h2>No encontramos esa saga</h2>
        <p>Prueba con el título original, el nombre del autor o uno de los libros de la serie.</p>
      </div>
    `;
    return;
  }

  view.innerHTML = `
    <div class="books-section-heading">
      <div class="section-heading">
        <span class="eyebrow type-label">COINCIDENCIAS</span>
        <h2 class="section-heading-title">Elige la saga correcta</h2>
      </div>
      <p>Hardcover puede distinguir series con nombres parecidos o diferentes autores.</p>
    </div>
    <div class="book-series-grid">
      ${series.map((item, index) => `
        <button class="book-series-card" type="button" data-series-id="${Number(item.id)}">
          <span class="book-series-number">${String(index + 1).padStart(2, '0')}</span>
          <span class="book-series-copy">
            <strong>${escapeHtml(item.name || 'Serie sin título')}</strong>
            <small>${escapeHtml(item.author || 'Autor no disponible')}</small>
          </span>
          <span class="book-series-count">Ver saga</span>
          <span class="book-series-arrow" aria-hidden="true">→</span>
        </button>
      `).join('')}
    </div>
  `;

  view.querySelectorAll('[data-series-id]').forEach((button) => {
    button.addEventListener('click', () => loadSeries(button.dataset.seriesId));
  });
}

function bookCover(book, index) {
  if (book.coverUrl) {
    return `<img src="${escapeHtml(book.coverUrl)}" alt="Portada de ${escapeHtml(book.title)}" loading="lazy" />`;
  }

  return `
    <div class="book-cover-fallback" aria-hidden="true">
      <span>${String(index + 1).padStart(2, '0')}</span>
      <strong>${escapeHtml(book.title)}</strong>
    </div>
  `;
}

function renderSeries(series) {
  const books = series.books || [];
  status.textContent = `${series.name}: ${books.length} ${books.length === 1 ? 'libro principal' : 'libros principales'}.`;
  document.title = `${series.name} — orden de lectura | Orden para ver`;

  view.innerHTML = `
    <article class="book-detail">
      <header class="book-detail-header section-heading page-heading--center">
        <button class="books-back-button" id="booksBackButton" type="button">← Volver a resultados</button>
        <span class="eyebrow type-label">ORDEN DE LECTURA</span>
        <h2 class="section-heading-title">${escapeHtml(series.name)}</h2>
        <p class="page-heading-description">${escapeHtml(series.author || 'Autor no disponible')} · ${books.length} ${books.length === 1 ? 'entrega principal' : 'entregas principales'}</p>
      </header>

      <ol class="reading-order-list">
        ${books.map((book, index) => {
          const hasPosition = book.position !== null && book.position !== '';
          const position = hasPosition ? book.position : '—';
          const typeLabel = book.compilation
            ? 'RECOPILATORIO'
            : book.partial
              ? 'EDICIÓN PARCIAL'
              : hasPosition
                ? `LIBRO ${escapeHtml(position)}`
                : 'SIN POSICIÓN OFICIAL';

          return `
          <li class="reading-order-item">
            <div class="reading-order-position">
              <span>${escapeHtml(position)}</span>
            </div>
            <div class="reading-order-cover">${bookCover(book, index)}</div>
            <div class="reading-order-copy">
              <span class="reading-order-label">${typeLabel}</span>
              <h3>${escapeHtml(book.title)}</h3>
              <div class="reading-order-meta">
                ${book.releaseYear ? `<span>${escapeHtml(book.releaseYear)}</span>` : ''}
                ${book.pages ? `<span>${Number(book.pages)} páginas</span>` : ''}
                ${book.rating ? `<span>★ ${Number(book.rating).toFixed(1)}</span>` : ''}
              </div>
              ${book.description ? `<p>${escapeHtml(book.description)}</p>` : ''}
              ${book.slug ? `<a href="https://hardcover.app/books/${encodeURIComponent(book.slug)}" target="_blank" rel="noopener noreferrer">Ver ficha en Hardcover →</a>` : ''}
            </div>
          </li>
        `;
        }).join('')}
      </ol>

      ${books.length ? '' : `
        <div class="books-message-card">
          <h3>Esta serie todavía no tiene entregas principales disponibles.</h3>
        </div>
      `}
    </article>
  `;

  document.getElementById('booksBackButton')?.addEventListener('click', () => {
    const query = input.value.trim();
    history.pushState({}, '', query ? `/libros/?q=${encodeURIComponent(query)}` : '/libros/');
    query ? searchSeries(query) : window.location.reload();
  });
}

async function apiRequest(params) {
  const response = await fetch(`/api/hardcover?${new URLSearchParams(params)}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || 'La conexión con Hardcover no está disponible ahora mismo.');
    error.missingToken = response.status === 503 && data.code === 'TOKEN_NOT_CONFIGURED';
    throw error;
  }

  return data;
}

async function searchSeries(query, updateUrl = true) {
  setLoading(`Buscando “${query}”…`);
  if (updateUrl) history.pushState({}, '', `/libros/?q=${encodeURIComponent(query)}`);

  try {
    const data = await apiRequest({ action: 'search', q: query });
    renderSearchResults(data.series || [], query);
  } catch (error) {
    renderError(error.message, error.missingToken);
  }
}

async function loadSeries(id, updateUrl = true) {
  setLoading('Ordenando la saga libro a libro…');
  if (updateUrl) history.pushState({}, '', `/libros/?serie=${encodeURIComponent(id)}`);

  try {
    const data = await apiRequest({ action: 'series', id });
    renderSeries(data.series);
  } catch (error) {
    renderError(error.message, error.missingToken);
  }
}

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (query.length >= 2) searchSeries(query);
});

document.querySelectorAll('[data-book-query]').forEach((button) => {
  button.addEventListener('click', () => {
    input.value = button.dataset.bookQuery;
    searchSeries(input.value);
  });
});

window.addEventListener('popstate', () => window.location.reload());

const initialParams = new URLSearchParams(window.location.search);
const initialSeries = initialParams.get('serie');
const initialQuery = initialParams.get('q');

if (initialSeries) {
  loadSeries(initialSeries, false);
} else if (initialQuery) {
  input.value = initialQuery;
  searchSeries(initialQuery, false);
}
