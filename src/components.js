class AppHeader extends HTMLElement {
  connectedCallback() {
    const currentPath = window.location.pathname;
    this.innerHTML = `
      <header class="navbar">
        <div class="container">
          <div class="logo">
            <span class="logo-text">Orden<span class="gradient-text">paraver</span></span>
          </div>
          <nav class="nav-links">
            <a href="/" class="${currentPath === '/' || currentPath === '/index.html' ? 'active' : ''}">Cronologías</a>
            <a href="/star-wars.html" class="${currentPath.includes('star-wars') || currentPath.includes('franchise') ? 'active' : ''}">Franquicias</a>
            <a href="/novedades.html" class="${currentPath.includes('novedades') ? 'active' : ''}">Novedades</a>
          </nav>
          <div class="nav-actions" style="display:flex; align-items:center;">
            <div class="nav-search" style="display:flex; align-items:center; background: rgba(255,255,255,0.05); border-radius: 20px; padding: 4px 12px; border: 1px solid rgba(255,255,255,0.1);">
              <input type="text" placeholder="Buscar saga..." class="nav-search-input" style="background:transparent; border:none; color:white; outline:none; width: 140px; font-size: 0.85rem;" />
              <button class="nav-search-btn" style="background:none; border:none; cursor:pointer; color:#b0b0bc; display:flex; align-items:center; padding:2px;" onmouseover="this.style.color='#ffffff'" onmouseout="this.style.color='#b0b0bc'">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>
    `;
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
              <a href="#">Privacidad</a>
              <a href="#">Términos</a>
              <a href="#">API Documentation</a>
              <a href="#">Contacto</a>
            </div>
          </div>
          <div class="footer-bottom">
            <p>© 2024 Ordenparaver. El Curador Digital.</p>
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
