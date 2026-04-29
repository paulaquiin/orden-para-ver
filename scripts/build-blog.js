import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fm from 'front-matter';
import { marked } from 'marked';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const contentDir = path.join(rootDir, 'content', 'blog');
const blogDir = path.join(rootDir, 'blog');
const templatePath = path.join(blogDir, '_template.html');
const indexPath = path.join(blogDir, 'index.html');

// Create directories if they don't exist
if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir, { recursive: true });
if (!fs.existsSync(blogDir)) fs.mkdirSync(blogDir, { recursive: true });

// Basic markdown config
marked.use({
  gfm: true,
  breaks: true
});

function buildBlog() {
  console.log('🚀 Construyendo el blog con diseño Premium...');

  if (!fs.existsSync(templatePath)) {
    console.error('Error: No se encontró blog/_template.html');
    return;
  }

  if (!fs.existsSync(indexPath)) {
    console.error('Error: No se encontró blog/index.html');
    return;
  }

  const templateHTML = fs.readFileSync(templatePath, 'utf8');
  let indexHTML = fs.readFileSync(indexPath, 'utf8');

  // Leer todos los archivos .md
  let files = [];
  try {
    files = fs.readdirSync(contentDir).filter(file => file.endsWith('.md'));
  } catch(e) {
    console.log('No hay carpeta content/blog o está vacía.');
  }

  const allPosts = [];

  files.forEach(file => {
    const filePath = path.join(contentDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = fm(content);
    const slug = file.replace('.md', '');
    
    const postMeta = {
      slug,
      title: parsed.attributes.title || 'Sin título',
      description: parsed.attributes.description || '',
      date: parsed.attributes.date || new Date().toISOString().split('T')[0],
      displayDate: parsed.attributes.date ? new Date(parsed.attributes.date).toLocaleDateString('es-ES') : new Date().toLocaleDateString('es-ES'),
      image: parsed.attributes.image || 'https://via.placeholder.com/1200x600?text=Blog',
      category: parsed.attributes.category || 'Noticias',
      author: parsed.attributes.author || 'Paula Quintana',
      authorImg: parsed.attributes.authorImg || 'https://ui-avatars.com/api/?name=Paula+Quintana&background=ff8c5a&color=fff',
      readTime: parsed.attributes.readTime || '5 min de lectura',
      body: parsed.body
    };

    allPosts.push(postMeta);
  });

  // Ordenar posts por fecha (más recientes primero)
  allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

  // 1. Generar páginas individuales
  allPosts.forEach(post => {
    const htmlContent = marked.parse(post.body);
    
    let finalHTML = templateHTML
      .replace(/{{TITLE}}/g, post.title)
      .replace(/{{DESCRIPTION}}/g, post.description)
      .replace(/{{DATE}}/g, post.displayDate)
      .replace(/{{IMAGE}}/g, post.image)
      .replace(/{{CATEGORY}}/g, post.category)
      .replace(/{{AUTHOR}}/g, post.author)
      .replace(/{{AUTHOR_IMG}}/g, post.authorImg)
      .replace(/{{READ_TIME}}/g, post.readTime)
      .replace(/{{CONTENT}}/g, htmlContent);

    const postDir = path.join(blogDir, post.slug);
    if (!fs.existsSync(postDir)) fs.mkdirSync(postDir, { recursive: true });
    fs.writeFileSync(path.join(postDir, 'index.html'), finalHTML);
    console.log(`  ✅ Generado: blog/${post.slug}/index.html`);
  });

  // 2. Generar el INDEX con el nuevo diseño
  if (allPosts.length > 0) {
    const hero = allPosts[0];
    const rest = allPosts.slice(1);

    // Formatear el título del Hero para resaltar palabras (la última o la más larga)
    // En la imagen, "Mesías" está en naranja e itálica.
    // Haremos algo similar: envolver la última palabra en <span class="gradient-text italic">
    const titleWords = hero.title.split(' ');
    const lastWord = titleWords.pop();
    const heroTitleFormatted = `${titleWords.join(' ')} <span class="accent-italic">${lastWord}</span>`;

    const heroHTML = `
      <section class="blog-hero" data-category="${hero.category}" style="background-image: linear-gradient(to bottom, rgba(0,0,0,0.3), var(--bg-dark)), url('${hero.image}');">
        <div class="container">
          <div class="hero-content">
            <div class="hero-badges">
              <span class="badge-category">${hero.category.toUpperCase()}</span>
              <span class="badge-time">${hero.readTime}</span>
            </div>
            <h1 class="hero-title">${heroTitleFormatted}</h1>
            <p class="hero-desc">${hero.description}</p>
            <div class="hero-actions">
              <a href="/blog/${hero.slug}/" class="btn-primary">Leer artículo completo →</a>
            </div>
          </div>
        </div>
      </section>
    `;

    const gridHTML = rest.map(post => `
      <div class="blog-card" data-category="${post.category}" onclick="window.location.href='/blog/${post.slug}/'">
        <div class="card-img-wrapper">
          <img src="${post.image}" alt="${post.title}" class="card-img" loading="lazy">
          <span class="card-badge">${post.category.toUpperCase()}</span>
        </div>
        <div class="card-body">
          <h3 class="card-title">${post.title}</h3>
          <p class="card-desc">${post.description}</p>
          <div class="card-footer">
            <div class="author">
              <img src="${post.authorImg}" alt="${post.author}" class="author-img">
              <span class="author-name">${post.author}</span>
            </div>
            <span class="post-date">Hace ${calculateRelativeDate(post.date)}</span>
          </div>
        </div>
      </div>
    `).join('');

    // Inyectar Hero
    const heroRegex = /<!-- HERO_POST_START -->[\s\S]*<!-- HERO_POST_END -->/;
    if (heroRegex.test(indexHTML)) {
      indexHTML = indexHTML.replace(heroRegex, `<!-- HERO_POST_START -->\n${heroHTML}\n<!-- HERO_POST_END -->`);
    }

    // Inyectar Grid
    const gridRegex = /<!-- BLOG_POSTS_START -->[\s\S]*<!-- BLOG_POSTS_END -->/;
    if (gridRegex.test(indexHTML)) {
      const gridWrapper = `
<!-- BLOG_POSTS_START -->
<div class="blog-grid">
  <div class="empty-state" id="no-results">
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 20px; opacity: 0.6; color: var(--accent-orange);"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    <h3>Próximamente más contenido</h3>
    <p>Estamos preparando las mejores crónicas para esta categoría. ¡Vuelve pronto!</p>
  </div>
  ${gridHTML}
</div>
<!-- BLOG_POSTS_END -->`;
      indexHTML = indexHTML.replace(gridRegex, gridWrapper);
    }

    fs.writeFileSync(indexPath, indexHTML);
    console.log('  ✨ Actualizado: blog/index.html');
  }
}

function calculateRelativeDate(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `${days} días`;
  if (days < 30) return `${Math.floor(days / 7)} semanas`;
  return `${Math.floor(days / 30)} meses`;
}

buildBlog();
