import { fetchTMDBDetails, getImageUrl, searchTMDB, searchCollectionTMDB, fetchCollectionDetails, fetchWatchProviders, fetchMovieDetails } from './tmdb.js';
import './components.js';

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Orden para ver - App Initialized');

  // --- Dynamic Franchise Loading ---
  const urlParams = new URLSearchParams(window.location.search);
  const collectionId = urlParams.get('collection_id');
  const tvId = urlParams.get('tv_id');
  const movieId = urlParams.get('movie_id');
  const isFranchisePage = window.location.pathname.includes('/franchise') ||
    window.location.pathname.includes('franchise.html') ||
    (/^\/contenidos\/.+$/.test(window.location.pathname) && !window.location.pathname.endsWith('index.html'));

  console.log('Path:', window.location.pathname);
  console.log('isFranchisePage:', isFranchisePage);
  console.log('Collection ID:', collectionId);

  if (isFranchisePage) {
    let rawItems = [];
    let pageTitle = '';
    let pageSummary = '';

    // Defensa: si por alguna razón cargamos la index.html (home) siendo una página de franquicia, ocultamos la home
    const homeSections = document.querySelectorAll('.hero, .trending');
    homeSections.forEach(s => s.style.display = 'none');

    // Si no hay IDs pero hay un slug en el path de contenidos, intentamos buscarlo
    if (!collectionId && !tvId && !movieId && window.location.pathname.includes('/contenidos/')) {
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      const slug = pathParts[pathParts.length - 1];
      
      if (slug && slug !== 'contenidos') {
        const cleanSlug = slug.replace(/-/g, ' ').replace('saga completa', '').trim();
        
        // Buscamos en colecciones y en multi-search (series/movies)
        const [collResults, multiResults] = await Promise.all([
           searchCollectionTMDB(cleanSlug),
           searchTMDB(cleanSlug)
        ]);

        if (collResults?.results?.length > 0) {
           window.location.search = `?collection_id=${collResults.results[0].id}`;
           return;
        } else if (multiResults?.results?.length > 0) {
           const tv = multiResults.results.find(r => r.media_type === 'tv');
           if (tv) {
              // Si es serie, activamos la fusión de secuelas
              const queryBase = (tv.name || tv.original_name).split(':')[0].trim();
              const fullUniverse = await searchTMDB(queryBase);
              const related = fullUniverse.results.filter(t => 
                t.media_type === 'tv' && 
                (t.name || t.original_name).toLowerCase().includes(queryBase.toLowerCase()) &&
                (!t.origin_country || !tv.origin_country || t.origin_country[0] === tv.origin_country[0])
              );
              const ids = related.length > 1 ? related.map(x => x.id).join(',') : tv.id;
              window.location.search = `?tv_id=${ids}`;
              return;
           }
           const movie = multiResults.results.find(r => r.media_type === 'movie');
           if (movie) {
              window.location.search = `?movie_id=${movie.id}`;
              return;
           }
        }
      }
    }

    let timelineContainer = document.querySelector('.timeline-container');

    if (!timelineContainer) {
      // Si estamos en una página física que no tiene container (como la home), limpiamos e inyectamos la estructura
      const mainElement = document.querySelector('main') || document.body;
      mainElement.innerHTML = `
        <section class="franchise-header">
          <div class="container" style="text-align: center; padding-top: 100px;">
            <h1 class="franchise-title" id="franchiseTitle">Cargando Saga...</h1>
            <p id="franchiseSummary" style="color: var(--text-gray);">Estamos recuperando el orden cronológico.</p>
          </div>
        </section>
        <section class="timeline-section">
          <div class="container">
            <div class="timeline-container relative">
              <div class="timeline-line"></div>
              <div style="text-align:center; color: white; padding: 2rem;">Sincronizando con TMDB...</div>
            </div>
          </div>
        </section>
      `;
      timelineContainer = document.querySelector('.timeline-container');
    } else {
      timelineContainer.innerHTML = `
        <div class="timeline-line"></div>
        <div style="text-align:center; color: white; padding: 2rem; font-family: 'Outfit', sans-serif;">Cargando saga y plataformas desde TMDB...</div>
      `;
    }

    if (movieId) {
      const movieData = await fetchMovieDetails(movieId);
      if (movieData && movieData.id) {
        // Truco: si pertenece a una colección, saltamos a la colección directamente
        if (movieData.belongs_to_collection) {
          window.location.search = `?collection_id=${movieData.belongs_to_collection.id}`;
          return;
        }

        pageTitle = movieData.title;
        pageSummary = movieData.overview || `Detalles de la película ${movieData.title}.`;

        const providersData = await fetchWatchProviders('movie', movieData.id);
        let flatrateES = [];
        if (providersData && providersData.results && providersData.results.ES) {
          let rawProviders = providersData.results.ES.flatrate || [];
          flatrateES = rawProviders.filter(p => p.provider_name === 'Netflix' || !p.provider_name.toLowerCase().includes('netflix'));
        }

        rawItems = [{
          title: movieData.title,
          releaseYear: movieData.release_date ? movieData.release_date.substring(0, 4) : '',
          description: movieData.overview || 'Sin descripción disponible.',
          poster: getImageUrl(movieData.poster_path),
          fallbackType: 'Película',
          dotColor: 'orange',
          rawDate: movieData.release_date || '',
          providers: flatrateES
        }];
      }
    } else if (collectionId) {
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
      // Dynamic TMDB TV Show - Soporte para Mega-Series (IDs separados por coma)
      const ids = tvId.split(',');
      let allSeasons = [];

      for (const id of ids) {
        const tvData = await fetchTMDBDetails('tv', id);
        if (tvData && tvData.id) {
          if (!pageTitle) {
            pageTitle = ids.length > 1 ? tvData.name.split(':')[0].trim() + ' (Saga Completa)' : tvData.name;
            pageSummary = tvData.overview || `Explora todas las temporadas de ${tvData.name}.`;
          }

          let seasons = tvData.seasons || [];
          // Marcamos cada temporada con su serie de origen si hay varias
          seasons.forEach(s => {
            s.seriesName = tvData.name;
            s.parentId = tvData.id;
          });

          allSeasons = allSeasons.concat(seasons);
        }
      }

      if (allSeasons.length > 0) {
        // Ordenamos todas las temporadas de todas las series por fecha de estreno
        allSeasons.sort((a, b) => {
          const dateA = new Date(a.air_date || '9999-12-31');
          const dateB = new Date(b.air_date || '9999-12-31');
          return dateA - dateB;
        });

        // Obtener providers de las series principales (usamos el primero para simplicidad, o extendemos)
        const providersData = await fetchWatchProviders('tv', ids[0]);
        let flatrateES = [];
        if (providersData && providersData.results && providersData.results.ES) {
          let rawProviders = providersData.results.ES.flatrate || [];
          flatrateES = rawProviders.filter(p => p.provider_name === 'Netflix' || !p.provider_name.toLowerCase().includes('netflix'));
        }

        rawItems = allSeasons
          .filter(s => s.season_number > 0) // Normalmente ignoramos especiales (E0)
          .map(season => ({
            title: ids.length > 1 ? `${season.seriesName} - ${season.name}` : season.name,
            releaseYear: season.air_date ? season.air_date.substring(0, 4) : '',
            description: season.overview || `Temporada ${season.season_number} de ${season.seriesName}.`,
            poster: getImageUrl(season.poster_path),
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
      if (ctxEl) {
        if (tvId) ctxEl.textContent = 'SERIE DE TELEVISIÓN';
        else if (movieId) ctxEl.textContent = 'PELÍCULA INDEPENDIENTE';
        else ctxEl.textContent = 'CRONOLOGÍA OFICIAL';
      }

      // --- Pretty URL Polish ---
      // Limpiamos la URL para que quede como /contenidos/nombre-saga/
      const slugSource = pageTitle
        .toLowerCase()
        .normalize('NFD')                          // descompone letras acentuadas
        .replace(/[\u0300-\u036f]/g, '')           // elimina los diacríticos (á→a, é→e, etc.)
        .replace(/\s*[-–—]\s*(colecci[oó]n|collection|saga|colección)\s*$/i, '') // quita sufijos de colección
        .replace(/\s*[-–—]\s*$/, '')               // quita guión final suelto
        .trim()
        .replace(/[\s_]+/g, '-')                   // espacios → guión
        .replace(/[^a-z0-9-]/g, '')               // elimina cualquier otro carácter raro
        .replace(/-{2,}/g, '-')                    // colapsa guiones múltiples ("---" → "-")
        .replace(/^-+|-+$/g, '');                  // quita guiones al inicio/final
      const newPath = `/contenidos/${slugSource}/`;
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

  // Helper to get image URL for results
  function getResImage(path) {
    return path ? `https://image.tmdb.org/t/p/w200${path}` : 'https://via.placeholder.com/200x300?text=Sin+Imagen';
  }

  // Render search results in the smart overlay
  async function showSmartResults(results, btnElement) {
    // Find the closest overlay relative to the container that triggered the search
    const overlay = btnElement.closest('.search-container, .nav-search, .mobile-nav-search')?.querySelector('.search-results-overlay')
                    || document.getElementById('searchResults');
    
    if (!overlay) return;

    overlay.innerHTML = '';
    overlay.classList.add('active');

    results.forEach(res => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      
      let badgeClass = 'badge-movie';
      let typeLabel = 'PELÍCULA';
      if (res.media_type === 'tv') { 
        badgeClass = 'badge-tv'; 
        typeLabel = 'SERIE TV';
      }
      if (res.isCollection) {
        badgeClass = 'badge-coll';
        typeLabel = 'SAGA / COLECCIÓN';
      }

      const year = res.release_date || res.first_air_date ? (res.release_date || res.first_air_date).substring(0, 4) : 'TBA';
      const country = res.origin_country && res.origin_country.length > 0 ? ` (${res.origin_country[0]})` : '';

      item.innerHTML = `
        <img src="${getResImage(res.poster_path)}" class="res-img" alt="${res.name || res.title}">
        <div class="res-info">
          <div class="res-title">${res.name || res.title}</div>
          <div class="res-meta">${year}${country}</div>
        </div>
        <span class="res-badge ${badgeClass}">${typeLabel}</span>
      `;

      item.onclick = async () => {
        overlay.classList.remove('active');
        if (res.isCollection) {
          window.location.href = `/franchise/?collection_id=${res.id}`;
        } else if (res.media_type === 'tv') {
          // BÚSQUEDA INTELIGENTE DE SECUELAS PARA SERIES
          const queryBase = (res.name || res.original_name).split(':')[0].trim();
          const multi = await searchTMDB(queryBase);
          const sameUniverse = multi.results.filter(t => {
            if (t.media_type !== 'tv') return false;
            const normName = (t.name || t.original_name).toLowerCase();
            const normSeed = queryBase.toLowerCase();
            const isMatch = normName.includes(normSeed);

            // Si ambos tienen país definido y son DISTINTOS, descartamos (ej: ES vs CO)
            if (res.origin_country?.length > 0 && t.origin_country?.length > 0) {
              if (res.origin_country[0] !== t.origin_country[0]) return false;
            }

            const countryMatch = res.origin_country?.[0] && t.origin_country?.includes(res.origin_country[0]);
            const langMatch = res.original_language && t.original_language === res.original_language;
            
            // Aceptamos si el nombre coincide Y (el país coincide O el idioma coincide O no tiene país definido como ADN)
            return isMatch && (countryMatch || langMatch || !t.origin_country || t.origin_country.length === 0);
          });

          if (sameUniverse.length > 1) {
            window.location.href = `/franchise/?tv_id=${sameUniverse.map(t => t.id).join(',')}`;
          } else {
            window.location.href = `/franchise/?tv_id=${res.id}`;
          }
        } else {
          const movieDetails = await fetchTMDBDetails('movie', res.id);
          if (movieDetails && movieDetails.belongs_to_collection) {
            window.location.href = `/franchise/?collection_id=${movieDetails.belongs_to_collection.id}`;
          } else {
            window.location.href = `/franchise/?movie_id=${res.id}`;
          }
        }
      };

      overlay.appendChild(item);
    });

    // Close overlay on click outside
    const closeOverlay = (e) => {
      if (!overlay.contains(e.target) && !btnElement.contains(e.target)) {
        overlay.classList.remove('active');
        document.removeEventListener('click', closeOverlay);
      }
    };
    setTimeout(() => document.addEventListener('click', closeOverlay), 10);
  }

  // --- Reactive Search Logic ---
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Universal Search Function
  async function executeSearch(query, btnElement, isReactive = false) {
    if (!query || query.length < 2) {
      const overlay = btnElement.closest('.search-container, .nav-search, .mobile-nav-search')?.querySelector('.search-results-overlay')
                      || document.getElementById('searchResults');
      if (overlay) overlay.classList.remove('active');
      return;
    }

    let originalText = '';
    if (!isReactive) {
      originalText = btnElement.textContent;
      btnElement.textContent = '...';
    } else {
      btnElement.classList.add('searching');
    }

    try {
      // Búsqueda multi-dimensional
      const [collRes, multiRes] = await Promise.all([
        searchCollectionTMDB(query),
        searchTMDB(query)
      ]);

      const allResults = [];
      if (collRes.results) { 
        collRes.results.slice(0, 3).forEach(c => allResults.push({ ...c, isCollection: true })); 
      }
      if (multiRes.results) { 
        multiRes.results.slice(0, 8).forEach(r => { 
          if (r.media_type === 'tv' || r.media_type === 'movie') { 
            if (!allResults.find(x => x.id === r.id)) { 
              allResults.push(r); 
            } 
          } 
        }); 
      }

      if (allResults.length > 0) {
        showSmartResults(allResults, btnElement);
      } else if (!isReactive) {
        alert('Lo sentimos, no encontramos nada relevante.');
      } else {
        const overlay = btnElement.closest('.search-container, .nav-search, .mobile-nav-search')?.querySelector('.search-results-overlay')
                        || document.getElementById('searchResults');
        if (overlay) overlay.classList.remove('active');
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      if (!isReactive) {
        btnElement.textContent = originalText;
      } else {
        btnElement.classList.remove('searching');
      }
    }
  }

  const debouncedSearch = debounce((query, btn) => executeSearch(query, btn, true), 300);

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

    searchInput.addEventListener('input', (e) => {
      debouncedSearch(e.target.value.trim(), searchBtn);
    });
  }

  // Setup ALL Navbar Search Inputs (desktop + mobile)
  document.querySelectorAll('.nav-search-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.closest('.nav-search, .mobile-nav-search')?.querySelector('.nav-search-input')
        || document.querySelector('.nav-search-input');
      const query = input?.value.trim();
      if (query) executeSearch(query, btn);
      else input?.focus();
    });
  });

  document.querySelectorAll('.nav-search-input').forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const btn = input.closest('.nav-search, .mobile-nav-search')?.querySelector('.nav-search-btn')
          || document.querySelector('.nav-search-btn');
        btn?.click();
      }
    });

    input.addEventListener('input', (e) => {
      const btn = input.closest('.nav-search, .mobile-nav-search')?.querySelector('.nav-search-btn')
        || document.querySelector('.nav-search-btn');
      if (btn) debouncedSearch(e.target.value.trim(), btn);
    });
  });

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

  // ── Carrusel móvil: Cronologías en Tendencia ──────────────────────────
  function initTrendingCarousel() {
    const isMobile = window.matchMedia('(max-width: 968px)').matches;
    const trendingSection = document.querySelector('.trending');
    if (!trendingSection) return;

    const grid = trendingSection.querySelector('.timeline-grid');
    const subgrid = trendingSection.querySelector('.timeline-subgrid');
    const prevBtn = trendingSection.querySelector('.nav-btn.prev');
    const nextBtn = trendingSection.querySelector('.nav-btn.next');

    if (!grid || !subgrid || !prevBtn || !nextBtn) return;

    // Limpia estado anterior si se llama de nuevo (resize)
    const existingControls = trendingSection.querySelector('.carousel-controls');
    if (existingControls) existingControls.remove();
    // Elimina el clon de promo si existía
    const existingMobilePromo = trendingSection.querySelector('.mobile-promo-fixed');
    if (existingMobilePromo) existingMobilePromo.remove();
    trendingSection.querySelectorAll('.card').forEach(c => {
      c.classList.remove('carousel-active');
      c.style.display = '';
    });
    [grid, subgrid].forEach(g => {
      g.classList.remove('mobile-carousel');
      g.style.display = '';
    });

    if (!isMobile) {
      prevBtn.style.display = '';
      nextBtn.style.display = '';
      return;
    }

    // Recopila todas las tarjetas: grid primero, luego subgrid — EXCEPTO .card-promo
    const allCards = [
      ...grid.querySelectorAll('.card'),
      ...subgrid.querySelectorAll('.card:not(.card-promo)'),
    ];

    if (allCards.length === 0) return;

    // Saca la card-promo del subgrid y la inserta como bloque fijo debajo del carrusel
    const promoCard = subgrid.querySelector('.card-promo');
    let mobilePromo = trendingSection.querySelector('.mobile-promo-fixed');
    if (promoCard && !mobilePromo) {
      mobilePromo = promoCard.cloneNode(true);
      mobilePromo.classList.add('mobile-promo-fixed');
      mobilePromo.style.display = '';
      const trendingContainer = trendingSection.querySelector('.container');
      trendingContainer.insertAdjacentElement('beforeend', mobilePromo);
    }
    // Oculta el original dentro del subgrid para no duplicarlo
    if (promoCard) promoCard.style.display = 'none';

    // Convierte ambos contenedores en carrusel
    [grid, subgrid].forEach(g => g.classList.add('mobile-carousel'));

    let current = 0;

    // Control row: [ ← ] [dots] [ → ]
    const controlsRow = document.createElement('div');
    controlsRow.className = 'carousel-controls';

    // Mueve las flechas originales al control row
    const prevClone = prevBtn.cloneNode(true);
    const nextClone = nextBtn.cloneNode(true);
    prevClone.className = 'nav-btn carousel-arrow prev';
    nextClone.className = 'nav-btn carousel-arrow next';

    // Oculta los botones originales del header en móvil
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';

    const dotsContainer = document.createElement('div');
    dotsContainer.className = 'carousel-dots';
    allCards.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', `Ir a tarjeta ${i + 1}`);
      dot.addEventListener('click', () => goTo(i));
      dotsContainer.appendChild(dot);
    });

    controlsRow.appendChild(prevClone);
    controlsRow.appendChild(dotsContainer);
    controlsRow.appendChild(nextClone);
    subgrid.insertAdjacentElement('afterend', controlsRow);

    prevClone.addEventListener('click', () => goTo(current - 1));
    nextClone.addEventListener('click', () => goTo(current + 1));

    function goTo(index) {
      const dots = dotsContainer.querySelectorAll('.carousel-dot');
      allCards[current].classList.remove('carousel-active');
      current = (index + allCards.length) % allCards.length;
      const activeCard = allCards[current];
      const activeInGrid = grid.contains(activeCard);
      grid.style.display = activeInGrid ? 'block' : 'none';
      subgrid.style.display = activeInGrid ? 'none' : 'block';
      activeCard.classList.add('carousel-active');
      dots.forEach((d, i) => d.classList.toggle('active', i === current));
    }

    // Inicializa: muestra sólo la primera tarjeta
    allCards[0].classList.add('carousel-active');
    const firstInGrid = grid.contains(allCards[0]);
    grid.style.display = firstInGrid ? 'block' : 'none';
    subgrid.style.display = firstInGrid ? 'none' : 'block';
  }

  // ── Explorar por Formato ──────────────────────────────────────────
  async function initExplorePage() {
    const isExplorePage = window.location.pathname.includes('/explorar');
    if (!isExplorePage) return;

    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type'); // 'movie', 'tv', 'animation'

    const titleEl = document.getElementById('category-title');
    const descEl = document.getElementById('category-desc');
    const viewEl = document.getElementById('explore-view');

    if (!titleEl || !viewEl) return;

    let searchType = type === 'animation' ? 'movie' : type;
    let params = {};

    if (type === 'animation') {
      titleEl.innerHTML = `Lo mejor de la <span class="gradient-text">Animación</span>`;
      descEl.textContent = 'Descubre las joyas animadas que han marcado un antes y un después.';
      params.with_genres = 16;
    } else if (type === 'tv') {
      titleEl.innerHTML = `Mejores <span class="gradient-text">Series de TV</span>`;
      descEl.textContent = 'Las series que todo el mundo debería ver al menos una vez.';
    } else {
      titleEl.innerHTML = `Mejores <span class="gradient-text">Películas</span>`;
      descEl.textContent = 'El séptimo arte en su máxima expresión. Clásicos y éxitos modernos.';
    }

    const { discoverTMDB } = await import('./tmdb.js');
    const data = await discoverTMDB(searchType, params);

    if (data && data.results) {
      viewEl.innerHTML = `
        <div class="explore-grid">
          ${data.results.map(item => `
            <div class="explore-card" onclick="window.location.href='/franchise/?${searchType === 'movie' ? 'movie_id' : 'tv_id'}=${item.id}'">
              <img src="${getImageUrl(item.poster_path)}" alt="${item.title || item.name}" class="explore-poster" loading="lazy">
              <div class="explore-info">
                <h3 class="explore-title">${item.title || item.name}</h3>
                <div class="explore-meta">
                  <span>${(item.release_date || item.first_air_date || '').substring(0, 4)}</span>
                  <span class="explore-rating">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    ${item.vote_average.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      viewEl.innerHTML = '<div class="loading-spinner">No hemos podido cargar los contenidos en este momento.</div>';
    }
  }

  initExplorePage();
  initTrendingCarousel();

  // Re-inicializa si cambia el tamaño de ventana (ej. rotación)
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      initTrendingCarousel();
    }, 200);
  });
});


