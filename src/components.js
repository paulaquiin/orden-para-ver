const THEME_STORAGE_KEY = 'ordenparaver-theme';

function getInitialTheme() {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark';
  } catch {
    return 'dark';
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  document.querySelectorAll('.theme-toggle').forEach((button) => {
    const isLight = theme === 'light';
    button.setAttribute('aria-label', isLight ? 'Activar tema oscuro' : 'Activar tema claro');
    button.setAttribute('title', isLight ? 'Tema oscuro' : 'Tema claro');
    button.setAttribute('aria-pressed', String(isLight));
    button.innerHTML = isLight
      ? `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z"/></svg>`
      : `<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>`;
  });
}

applyTheme(getInitialTheme());

class AppHeader extends HTMLElement {
  connectedCallback() {
    const currentPath = window.location.pathname;
    this.innerHTML = `
      <header class="navbar">
        <div class="container">
          <div class="logo">
            <a href="/" style="text-decoration:none; color:inherit;">
              <span class="logo-text">Orden<span class="gradient-text">paraver</span></span>
            </a>
          </div>
          <nav class="nav-links" id="navLinks">
            <a href="/" class="${currentPath === '/' || currentPath === '/index.html' ? 'active' : ''}">Cronologías</a>
            <a href="/contenidos/" class="${currentPath.includes('contenidos') ? 'active' : ''}">Contenido</a>
            <a href="/libros/" class="${currentPath.includes('libros') ? 'active' : ''}">Libros</a>
            <a href="/novedades/" class="${currentPath.includes('novedades') ? 'active' : ''}">Novedades</a>
            <a href="/blog/" class="${currentPath.includes('blog') ? 'active' : ''}">Blog</a>
          </nav>
          <div class="nav-actions">
            <div class="nav-search">
              <input type="text" placeholder="Buscar saga..." class="nav-search-input" />
              <button class="nav-search-btn" aria-label="Buscar">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>
              <div class="search-results-overlay"></div>
            </div>
            <button class="theme-toggle" type="button" aria-label="Activar tema claro" title="Tema claro" aria-pressed="false"></button>
            <button class="hamburger-btn" id="hamburgerBtn" aria-label="Abrir menú" aria-expanded="false">
              <svg id="hamburgerIcon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="mobile-nav" id="mobileNav">
          <a href="/" class="${currentPath === '/' || currentPath === '/index.html' ? 'active' : ''}">Cronologías</a>
          <a href="/contenidos/" class="${currentPath.includes('contenidos') ? 'active' : ''}">Contenido</a>
          <a href="/libros/" class="${currentPath.includes('libros') ? 'active' : ''}">Libros</a>
          <a href="/novedades/" class="${currentPath.includes('novedades') ? 'active' : ''}">Novedades</a>
          <a href="/blog/" class="${currentPath.includes('blog') ? 'active' : ''}">Blog</a>
          <div class="mobile-nav-search">
            <input type="text" placeholder="Buscar saga..." class="nav-search-input mobile-search-input" />
            <button class="nav-search-btn mobile-search-btn" aria-label="Buscar">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
            <div class="search-results-overlay"></div>
          </div>
        </div>
      </header>
    `;

    const btn = this.querySelector('#hamburgerBtn');
    const mobileNav = this.querySelector('#mobileNav');
    const themeToggle = this.querySelector('.theme-toggle');

    applyTheme(document.documentElement.dataset.theme || getInitialTheme());
    themeToggle?.addEventListener('click', () => {
      const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      } catch {
        // The visual preference still applies for this visit if storage is unavailable.
      }
      applyTheme(nextTheme);
    });

    btn?.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen);
      btn.innerHTML = isOpen
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
    });

    // Wire mobile search to the same handler as desktop (main.js picks up .nav-search-input)
    const mobileInput = this.querySelector('.mobile-search-input');
    const mobileSearchBtn = this.querySelector('.mobile-search-btn');
    mobileInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') mobileSearchBtn?.click();
    });
  }
}
customElements.define('app-header', AppHeader);

class AppFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <footer class="main-footer">
        <div class="container">
          <div class="footer-top">
            <div class="footer-logo">Orden<span class="gradient-text">paraver</span></div>
            <div class="footer-links">
              <a href="/privacidad/">Privacidad</a>
              <a href="/terminos/">Términos</a>
              <a href="https://developer.themoviedb.org/docs" target="_blank" rel="noopener noreferrer">Documentación API</a>
            </div>
          </div>
          <div class="footer-bottom">
            <p>© 2024 Ordenparaver. Paula Quintana González.</p>
            <div class="footer-socials">
              <a href="https://www.linkedin.com/in/paula-quintana-36856b204/" target="_blank" rel="noopener noreferrer" style="text-decoration: none; color: inherit;">
                <div class="social-icon">In</div>
              </a>
            </div>
          </div>
        </div>
      </footer>
    `;
  }
}
customElements.define('app-footer', AppFooter);
 
class AppModal extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="modal-overlay" id="appModalOverlay">
        <div class="modal-content">
          <div class="modal-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h2 class="modal-title" id="modalTitle">Atención</h2>
          <p class="modal-message" id="modalMessage">Mensaje del sistema.</p>
          <button class="modal-btn" id="modalClose">Entendido</button>
        </div>
      </div>
    `;

    this.querySelector('#modalClose').addEventListener('click', () => {
      this.querySelector('#appModalOverlay').classList.remove('active');
    });
  }
}
customElements.define('app-modal', AppModal);

class AppResultsNotice extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <p class="results-notice" role="note">La información es orientativa: puede contener errores u omisiones y está sujeta a cambios. Comprueba el orden y los datos con fuentes oficiales.</p>
    `;
  }
}
customElements.define('app-results-notice', AppResultsNotice);

// Global Helper
window.showAlert = function(title, message) {
  const modal = document.querySelector('app-modal');
  if (modal) {
    modal.querySelector('#modalTitle').textContent = title;
    modal.querySelector('#modalMessage').textContent = message;
    modal.querySelector('#appModalOverlay').classList.add('active');
  } else {
    // Fallback if component is not in the page
    alert(`${title}: ${message}`);
  }
};
