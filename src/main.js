import { fetchTMDBDetails, getImageUrl, searchTMDB, searchCollectionTMDB, fetchCollectionDetails, fetchWatchProviders } from './tmdb.js';
import './components.js';

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Orden para ver - App Initialized');

  // --- Dynamic Franchise Loading ---
  const urlParams = new URLSearchParams(window.location.search);
  const collectionId = urlParams.get('collection_id');
  const tvId = urlParams.get('tv_id');
  const isFranchisePage = window.location.pathname.includes('/franchise') || 
                         window.location.pathname.includes('franchise.html') || 
                         (/^\/contenidos\/.+$/.test(window.location.pathname) && !window.location.pathname.endsWith('index.html'));

  if (isFranchisePage) {
    let rawItems = [];
    let pageTitle = '';
    let pageSummary = '';

    // Si no hay IDs pero hay un slug en el path de contenidos, intentamos buscarlo
    if (!collectionId && !tvId && window.location.pathname.includes('/contenidos/')) {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const slug = pathParts[pathParts.length - 1];
        if (slug && slug !== 'contenidos') {
            const searchResults = await searchCollectionTMDB(slug.replace(/-/g, ' '));
            if (searchResults && searchResults.results && searchResults.results.length > 0) {
                // Redirigimos internamente usando el ID encontrado para seguir el flujo normal
                window.location.search = `?collection_id=${searchResults.results[0].id}`;
                return;
            }
        }
    }

    const timelineContainer = document.querySelector('.timeline-container');
    
    if (timelineContainer) {
      timelineContainer.innerHTML = `
        <div class="timeline-line"></div>
        <div style="text-align:center; color: white; padding: 2rem; font-family: 'Outfit', sans-serif;">Cargando saga y plataformas desde TMDB...</div>
      `;
    }

    if (collectionId) {
      // Soporte para Mega-Franquicias (Múltiples IDs separados por coma)
      const ids = collectionId.split(',');
      let allParts = [];
      
      for (const id of ids) {
        const collectionData = await fetchCollectionDetails(id);
        if (collectionData && collectionData.id) {
          if (!pageTitle) { // Toma el título y resumen de la primera colección principal
            // Si hay varias, le damos un nombre de Mega-Franquicia
            pageTitle = ids.length > 1 ? collectionData.name.replace(/Collection|Colección/gi, '').trim() + ' (Mega-Franquicia)' : collectionData.name;
            pageSummary = collectionData.overview || `Explora la saga completa de ${collectionData.name}.`;
          }
          if (collectionData.parts) {
            allParts = allParts.concat(collectionData.parts);
          }
        }
      }

      if (allParts.length > 0) {
        // Eliminar duplicados en caso de películas que existan en varias colecciones cruzadas
        const uniquePartsMap = new Map();
        allParts.forEach(part => uniquePartsMap.set(part.id, part));
        let parts = Array.from(uniquePartsMap.values());

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
            let rawProviders = providersData.results.ES.flatrate || [];
            flatrateES = rawProviders.filter(p => p.provider_name === 'Netflix' || !p.provider_name.toLowerCase().includes('netflix'));
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
          let rawProviders = providersData.results.ES.flatrate || [];
          flatrateES = rawProviders.filter(p => p.provider_name === 'Netflix' || !p.provider_name.toLowerCase().includes('netflix'));
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
      const ctxEl = document.querySelector('.context-tag');
      
      if (titleEl) titleEl.textContent = pageTitle;
      if (sumEl) {
        if (pageSummary.length > 200) {
          sumEl.innerHTML = `<span class="clamped-text" style="display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${pageSummary}</span><span onclick="this.previousElementSibling.style.webkitLineClamp = this.previousElementSibling.style.webkitLineClamp === '3' ? 'unset' : '3'; this.textContent = this.textContent === 'Leer más' ? 'Leer menos' : 'Leer más'" style="color:var(--accent-orange); font-size:0.9rem; font-weight:600; cursor:pointer; display:inline-block; margin-top:8px;">Leer más</span>`;
        } else {
          sumEl.textContent = pageSummary;
        }
      }
      if (ctxEl) ctxEl.textContent = tvId ? 'SERIE DE TELEVISIÓN' : 'CRONOLOGÍA OFICIAL';

      // --- Pretty URL Polish ---
      // Limpiamos la URL para que quede como /contenidos/nombre-saga/
      const slug = pageTitle.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const newPath = `/contenidos/${slug}/`;
      if (window.location.pathname !== newPath) {
        window.history.replaceState(null, '', newPath);
      }

      if (timelineContainer) {
        timelineContainer.innerHTML = '<div class="timeline-line"></div>';

        rawItems.forEach((item, index) => {
          const isOpposite = index % 2 !== 0;
          const oppositeClass = isOpposite ? 'opposite' : '';
          const cardClass = isOpposite ? 'left-content' : 'right-content';
          const dotClass = item.dotColor === 'purple' ? 'purple' : '';

          const providersHTML = item.providers && item.providers.length > 0 
            ? `<div class="card-providers" style="display:flex; gap:8px;">
                ${item.providers.slice(0, 4).map(p => `
                  <img src="${getImageUrl(p.logo_path, 'w92')}" title="${p.provider_name}" alt="${p.provider_name}" style="width:40px; height:40px; border-radius:8px; object-fit:cover; border: 1px solid rgba(255,255,255,0.1);"/>
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
                    <div>
                      <p class="card-item-desc">${item.description}</p>
                      ${item.description.length > 130 ? `<span onclick="this.previousElementSibling.classList.toggle('expanded'); this.textContent = this.textContent === 'Leer más' ? 'Leer menos' : 'Leer más'" style="color:var(--accent-orange); font-size:0.8rem; font-weight:600; cursor:pointer; display:inline-block; margin-bottom:15px; margin-top:2px;">Leer más</span>` : '<div style="margin-bottom:15px;"></div>'}
                    </div>
                    <div class="card-actions" style="display:flex; align-items:center; justify-content:flex-end; width:100%; margin-top:1rem;">
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
                    <div>
                      <p class="card-item-desc">${item.description}</p>
                      ${item.description.length > 130 ? `<span onclick="this.previousElementSibling.classList.toggle('expanded'); this.textContent = this.textContent === 'Leer más' ? 'Leer menos' : 'Leer más'" style="color:var(--accent-orange); font-size:0.8rem; font-weight:600; cursor:pointer; display:inline-block; margin-bottom:15px; margin-top:2px;">Leer más</span>` : '<div style="margin-bottom:15px;"></div>'}
                    </div>
                    <div class="card-actions" style="display:flex; align-items:center; justify-content:flex-end; width:100%; margin-top:1rem;">
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

  // Universal Search Function
  async function executeSearch(query, btnElement) {
    if (!query) return;
    
    const originalText = btnElement.textContent;
    btnElement.textContent = '...';
    
    // Búsqueda multi-dimensional (Colecciones de cine + Series de TV)
    const [collectionResults, multiResults] = await Promise.all([
      searchCollectionTMDB(query),
      searchTMDB(query)
    ]);

    let found = false;

    // 1. Priorizamos encontrar Colecciones y formamos Mega-Franquicias si es necesario
    if (collectionResults && collectionResults.results && collectionResults.results.length > 0) {
      // Normalizamos la búsqueda (quitando guiones o espacios) para que "spiderman" coincida con "Spider-Man"
      const normalizedKeyword = query.toLowerCase().split(' ')[0].replace(/[^a-z0-9]/g, ''); 

      // Recolectamos todas las colecciones en los primeros 5 resultados que compartan la base del nombre
      const similarCollections = collectionResults.results
         .slice(0, 5)
         .filter(c => {
             const normalizedName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
             return normalizedName.includes(normalizedKeyword);
         });

      if (similarCollections.length > 1) {
         // FUSIONAMOS LAS SAGAS!
         const mergedIds = similarCollections.map(c => c.id).join(',');
         const slug = query.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
         window.location.href = `/contenidos/${slug}/?collection_id=${mergedIds}`;
      } else {
         // O cargamos la única coincidencia exacta
         const firstColl = collectionResults.results[0];
         const slug = firstColl.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
         window.location.href = `/contenidos/${slug}/?collection_id=${firstColl.id}`;
      }
      found = true;
    } 
    // 2. Si no es colección, miramos si el mejor resultado en multi-search es una Serie de TV
    else if (multiResults && multiResults.results && multiResults.results.length > 0) {
      const firstResult = multiResults.results[0];
      
      if (firstResult.media_type === 'tv') {
        const slug = (firstResult.name || firstResult.title).toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        window.location.href = `/contenidos/${slug}/?tv_id=${firstResult.id}`;
        found = true;
      } 
      // 3. (Extra) Si es peli al azar pero forma parte de una saga que el motor de collections no indexó perfectamente
      else if (firstResult.media_type === 'movie') {
        const movieDetails = await fetchTMDBDetails('movie', firstResult.id);
        if (movieDetails && movieDetails.belongs_to_collection) {
          const slug = movieDetails.belongs_to_collection.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          window.location.href = `/contenidos/${slug}/?collection_id=${movieDetails.belongs_to_collection.id}`;
          found = true;
        }
      }
    }

    btnElement.textContent = originalText;
    
    if (!found) {
      alert('Lo sentimos, no encontramos una saga o serie en TMDB para esa búsqueda.');
    }
  }

  // Setup Big Hero Search
  const searchInput = document.querySelector('.search-input');
  const searchBtn = document.querySelector('.search-btn');

  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      const query = searchInput.value.trim();
      if (query) executeSearch(query, searchBtn);
      else searchInput.focus();
    });

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchBtn.click();
    });
  }

  // Setup Navbar Mini Search
  const navSearchInput = document.querySelector('.nav-search-input');
  const navSearchBtn = document.querySelector('.nav-search-btn');

  if (navSearchBtn && navSearchInput) {
    navSearchBtn.addEventListener('click', () => {
      const query = navSearchInput.value.trim();
      if (query) executeSearch(query, navSearchBtn);
      else navSearchInput.focus();
    });

    navSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') navSearchBtn.click();
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


