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
  console.log('Construyendo el blog...');

  // Asegurar que existe _template.html
  if (!fs.existsSync(templatePath)) {
    console.error('Error: No se encontró blog/_template.html');
    return;
  }

  // Asegurar que existe index.html
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

  const posts = [];

  files.forEach(file => {
    const filePath = path.join(contentDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Parsear front-matter y markdown
    const parsed = fm(content);
    const htmlContent = marked.parse(parsed.body);
    const slug = file.replace('.md', '');
    
    // Preparar metadatos del post
    const postMeta = {
      slug,
      title: parsed.attributes.title || 'Sin título',
      description: parsed.attributes.description || '',
      date: parsed.attributes.date ? new Date(parsed.attributes.date).toLocaleDateString('es-ES') : new Date().toLocaleDateString('es-ES'),
      image: parsed.attributes.image || 'https://via.placeholder.com/600x400?text=Blog',
    };

    posts.push(postMeta);

    // Reemplazar marcadores en el template
    let finalHTML = templateHTML
      .replace(/{{TITLE}}/g, postMeta.title)
      .replace(/{{DESCRIPTION}}/g, postMeta.description)
      .replace(/{{DATE}}/g, postMeta.date)
      .replace(/{{IMAGE}}/g, postMeta.image)
      .replace(/{{CONTENT}}/g, htmlContent);

    // Guardar el post en blog/mi-post/index.html
    const postDir = path.join(blogDir, slug);
    if (!fs.existsSync(postDir)) fs.mkdirSync(postDir, { recursive: true });
    fs.writeFileSync(path.join(postDir, 'index.html'), finalHTML);

    console.log(`Generado: blog/${slug}/index.html`);
  });

  // Ordenar posts por fecha (más recientes primero) asumiendo formato YYYY-MM-DD o parseable
  // Si no, lo dejamos en el orden en que se leen. Para un blog simple es suficiente por ahora.

  // Generar HTML para la lista de posts en el index
  const postsListHTML = posts.map(post => `
    <div class="blog-card" onclick="window.location.href='/blog/${post.slug}/'">
      <img src="${post.image}" alt="${post.title}" class="blog-poster" loading="lazy">
      <div class="blog-info" style="padding: 1.5rem;">
        <div style="font-size: 0.8rem; color: var(--accent-orange); margin-bottom: 0.5rem; font-weight: 600;">${post.date}</div>
        <h3 class="blog-title" style="margin-bottom: 0.5rem; font-size: 1.25rem;">${post.title}</h3>
        <p class="blog-desc" style="color: var(--text-gray); font-size: 0.95rem; line-height: 1.5;">${post.description}</p>
      </div>
    </div>
  `).join('');

  // Inyectar en index.html
  // Buscamos el bloque <!-- BLOG_POSTS_START --> ... <!-- BLOG_POSTS_END -->
  const regex = /<!-- BLOG_POSTS_START -->[\s\S]*<!-- BLOG_POSTS_END -->/;
  if (regex.test(indexHTML)) {
    indexHTML = indexHTML.replace(regex, `<!-- BLOG_POSTS_START -->\n<div class="explore-grid" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">\n${postsListHTML}\n</div>\n<!-- BLOG_POSTS_END -->`);
    fs.writeFileSync(indexPath, indexHTML);
    console.log('Actualizado: blog/index.html');
  } else {
    console.log('No se encontró el marcador <!-- BLOG_POSTS_START --> en blog/index.html');
  }
}

buildBlog();
