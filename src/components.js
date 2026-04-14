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
            <a href="/novedades/" class="${currentPath.includes('novedades') ? 'active' : ''}">Novedades</a>
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
            </div>
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
          <a href="/novedades/" class="${currentPath.includes('novedades') ? 'active' : ''}">Novedades</a>
          <div class="mobile-nav-search">
            <input type="text" placeholder="Buscar saga..." class="nav-search-input mobile-search-input" />
            <button class="nav-search-btn mobile-search-btn" aria-label="Buscar">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
        </div>
      </header>
    `;

    const btn = this.querySelector('#hamburgerBtn');
    const mobileNav = this.querySelector('#mobileNav');
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
