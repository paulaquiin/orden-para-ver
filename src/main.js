import { franchises } from './data.js';

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  console.log('Orden para ver - App Initialized');

  // --- Dynamic Franchise Loading ---
  const urlParams = new URLSearchParams(window.location.search);
  const franchiseId = urlParams.get('id');

  if (window.location.pathname.includes('franchise.html') && franchiseId) {
    const data = franchises[franchiseId];

    if (data) {
      // 1. Update Headings
      document.title = `${data.title} | Orden para ver`;
      const titleEl = document.querySelector('.franchise-title');
      const sumEl = document.querySelector('.franchise-summary');
      if (titleEl) titleEl.textContent = data.title;
      if (sumEl) sumEl.textContent = data.summary;

      // 2. Render Timeline
      const timelineContainer = document.querySelector('.timeline-container');
      if (timelineContainer) {
        // Clear out loading skeleton or previous data
        timelineContainer.innerHTML = '<div class="timeline-line"></div>';

        data.items.forEach((item, index) => {
          // Calculate class toggles based on alternate grid
          const isOpposite = index % 2 !== 0;
          const oppositeClass = isOpposite ? 'opposite' : '';
          const cardClass = isOpposite ? 'left-content' : 'right-content';
          const dotClass = item.dotColor === 'purple' ? 'purple' : '';

          const itemHTML = `
            <div class="timeline-item ${oppositeClass}">
              ${isOpposite ? `<div class="item-card-wrapper ${cardClass}">
                <div class="item-card">
                  <div class="card-poster-wrapper">
                    <img src="${item.poster}" alt="${item.title}" class="card-poster" onerror="this.src='https://via.placeholder.com/220x330/1a1a1a/444444?text=Poster'"/>
                    <span class="poster-badge">${item.type}</span>
                  </div>
                  <div class="card-body">
                    <h3 class="card-item-title">${item.title}</h3>
                    <p class="card-item-year">${item.releaseYear}</p>
                    <p class="card-item-desc">${item.description}</p>
                    <div class="card-actions">
                      <a href="#" class="action-btn-sm">Detalles</a>
                      <a href="#" class="trailer-link"><span>▶</span> Ver Tráiler</a>
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
                    <span class="poster-badge">${item.type}</span>
                  </div>
                  <div class="card-body">
                    <h3 class="card-item-title">${item.title}</h3>
                    <p class="card-item-year">${item.releaseYear}</p>
                    <p class="card-item-desc">${item.description}</p>
                    <div class="card-actions">
                      <a href="#" class="action-btn-sm">Detalles</a>
                      <a href="#" class="trailer-link"><span>▶</span> Ver Tráiler</a>
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
    } else {
      const container = document.querySelector('.timeline-container');
      if(container) container.innerHTML = '<h2 style="color:white; text-align:center;">Franquicia no encontrada.</h2>';
    }
  }

  // Search input interaction
  const searchInput = document.querySelector('.search-input');
  const searchBtn = document.querySelector('.search-btn');

  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      const query = searchInput.value.trim();
      if (query) {
        alert(`Buscando cronología para: ${query}... (Esta es una demo)`);
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

  // Simple card hover effect enhancement (already handled by CSS, but could add JS triggers)
  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      // potentially trigger animations
    });
  });
});
