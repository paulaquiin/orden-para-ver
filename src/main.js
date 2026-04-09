import { fetchTMDBDetails, getImageUrl, searchTMDB, searchCollectionTMDB, fetchCollectionDetails, fetchWatchProviders } from './tmdb.js';

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Orden para ver - App Initialized');

  // --- Dynamic Franchise Loading ---
  const urlParams = new URLSearchParams(window.location.search);
  const collectionId = urlParams.get('collection_id');
  const tvId = urlParams.get('tv_id');

  if (window.location.pathname.includes('franchise.html')) {
    let rawItems = [];
    let pageTitle = '';
    let pageSummary = '';

    const timelineContainer = document.querySelector('.timeline-container');
    
    if (timelineContainer) {
      timelineContainer.innerHTML = `
        <div class="timeline-line"></div>
        <div style="text-align:center; color: white; padding: 2rem; font-family: 'Outfit', sans-serif;">Cargando saga y plataformas desde TMDB...</div>
      `;
    }

    if (collectionId) {
      // Dynamic TMDB collection
      const collectionData = await fetchCollectionDetails(collectionId);
      if (collectionData && collectionData.id) {
        pageTitle = collectionData.name;
        pageSummary = collectionData.overview || `Explora la saga completa de ${collectionData.name}.`;
        
        let parts = collectionData.parts || [];
        // Sort parts by release date
        parts.sort((a, b) => {
          const dateA = new Date(a.release_date || '9999-12-31');
          const dateB = new Date(b.release_date || '9999-12-31');
          return dateA - dateB;
        });

        const enrichedParts = await Promise.all(parts.map(async (part) => {
          const providersData = await fetchWatchProviders('movie', part.id);
          let flatrateES = [];
          if (providersData && providersData.results && providersData.results.ES) {
            flatrateES = providersData.results.ES.flatrate || [];
          }

          return {
            title: part.title,
            releaseYear: part.release_date ? part.release_date.substring(0, 4) : '',
            description: part.overview || 'Sin descripción disponible.',
            poster: getImageUrl(part.poster_path),
            fallbackType: 'Película',
            dotColor: 'orange',
            rawDate: part.release_date || '',
            providers: flatrateES
          };
        }));
        
        rawItems = enrichedParts;
      }
    } else if (tvId) {
      // Dynamic TMDB TV Show
      const tvData = await fetchTMDBDetails('tv', tvId);
      if (tvData && tvData.id) {
        pageTitle = tvData.name;
        pageSummary = tvData.overview || `Explora todas las temporadas de ${tvData.name}.`;
        
        let seasons = tvData.seasons || [];
        seasons.sort((a, b) => {
          const dateA = new Date(a.air_date || '9999-12-31');
          const dateB = new Date(b.air_date || '9999-12-31');
          return dateA - dateB;
        });

        // Obtener providers de la serie entera, ya que no suele variar por temporada
        const providersData = await fetchWatchProviders('tv', tvData.id);
        let flatrateES = [];
        if (providersData && providersData.results && providersData.results.ES) {
          flatrateES = providersData.results.ES.flatrate || [];
        }

        rawItems = seasons.map(season => ({
          title: season.name,
          releaseYear: season.air_date ? season.air_date.substring(0, 4) : '',
          description: season.overview || 'Sin descripción disponible.',
          poster: getImageUrl(season.poster_path || tvData.poster_path),
          fallbackType: 'Temporada',
          dotColor: 'purple',
          rawDate: season.air_date || '',
          providers: flatrateES
        }));
      }
    }

    // Render Timeline if we have items
    if (rawItems.length > 0) {
      document.title = `${pageTitle} | Orden para ver`;
      const titleEl = document.querySelector('.franchise-title');
      const sumEl = document.querySelector('.franchise-summary');
      if (titleEl) titleEl.textContent = pageTitle;
      if (sumEl) sumEl.textContent = pageSummary;

      if (timelineContainer) {
        timelineContainer.innerHTML = '<div class="timeline-line"></div>';

        rawItems.forEach((item, index) => {
          const isOpposite = index % 2 !== 0;
          const oppositeClass = isOpposite ? 'opposite' : '';
          const cardClass = isOpposite ? 'left-content' : 'right-content';
          const dotClass = item.dotColor === 'purple' ? 'purple' : '';

          const providersHTML = item.providers && item.providers.length > 0 
            ? `<div class="card-providers" style="display:flex; gap:6px;">
                ${item.providers.slice(0, 4).map(p => `
                  <img src="${getImageUrl(p.logo_path, 'w92')}" title="${p.provider_name}" alt="${p.provider_name}" style="width:30px; height:30px; border-radius:6px; object-fit:cover; border: 1px solid rgba(255,255,255,0.1);"/>
                `).join('')}
              </div>`
            : '<span style="font-size: 0.75rem; opacity: 0.5;">No disp. streaming</span>';

          const itemHTML = `
            <div class="timeline-item ${oppositeClass}">
              ${isOpposite ? `<div class="item-card-wrapper ${cardClass}">
                <div class="item-card">
                  <div class="card-poster-wrapper">
                    <img src="${item.poster}" alt="${item.title}" class="card-poster" onerror="this.src='https://via.placeholder.com/220x330/1a1a1a/444444?text=Poster'"/>
                    <span class="poster-badge">${item.fallbackType}</span>
                  </div>
                  <div class="card-body">
                    <h3 class="card-item-title">${item.title}</h3>
                    <p class="card-item-year">${item.releaseYear}</p>
                    <p class="card-item-desc">${item.description}</p>
                    <div class="card-actions" style="display:flex; align-items:center; justify-content:space-between; width:100%; margin-top:1rem;">
                      <a href="#" class="action-btn-sm" style="margin:0;">Detalles</a>
                      ${providersHTML}
                    </div>
                  </div>
                </div>
              </div>
              <div class="timeline-dot ${dotClass}"></div>` 
              : 
              `<div class="timeline-dot ${dotClass}"></div>
              <div class="item-card-wrapper ${cardClass}">
                <div class="item-card">
                  <div class="card-poster-wrapper">
                    <img src="${item.poster}" alt="${item.title}" class="card-poster" onerror="this.src='https://via.placeholder.com/220x330/1a1a1a/444444?text=Poster'"/>
                    <span class="poster-badge">${item.fallbackType}</span>
                  </div>
                  <div class="card-body">
                    <h3 class="card-item-title">${item.title}</h3>
                    <p class="card-item-year">${item.releaseYear}</p>
                    <p class="card-item-desc">${item.description}</p>
                    <div class="card-actions" style="display:flex; align-items:center; justify-content:space-between; width:100%; margin-top:1rem;">
                      <a href="#" class="action-btn-sm" style="margin:0;">Detalles</a>
                      ${providersHTML}
                    </div>
                  </div>
                </div>
              </div>`
              }
            </div>
          `;
          timelineContainer.insertAdjacentHTML('beforeend', itemHTML);
        });
      }
    } else if (timelineContainer) {
      timelineContainer.innerHTML = '<h2 style="color:white; text-align:center;">Saga o Serie no encontrada en TMDB.</h2>';
    }
  }

  // Search input interaction
  const searchInput = document.querySelector('.search-input');
  const searchBtn = document.querySelector('.search-btn');

  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', async () => {
      const query = searchInput.value.trim();
      if (query) {
        const originalText = searchBtn.textContent;
        searchBtn.textContent = '...';
        
        // Buscamos directamente la colección en TMDB
        const collectionResults = await searchCollectionTMDB(query);
        if (collectionResults && collectionResults.results && collectionResults.results.length > 0) {
          const firstCollection = collectionResults.results[0];
          window.location.href = `/franchise.html?collection_id=${firstCollection.id}`;
          return;
        }

        searchBtn.textContent = originalText;
        alert('Lo sentimos, no encontramos una colección en TMDB para esa búsqueda.');
      } else {
        searchInput.focus();
      }
    });

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchBtn.click();
      }
    });
  }

  // Smooth scroll for nav links (if they had IDs)
  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      if (link.getAttribute('href').startsWith('#')) {
        e.preventDefault();
        // future navigation logic
      }
    });
  });

  // Simple card hover effect enhancement
  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      // potentially trigger animations
    });
  });
});


