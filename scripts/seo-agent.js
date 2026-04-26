/**
 * 🤖 Agente SEO - Orden para ver
 * 
 * Genera artículos de blog optimizados para SEO automáticamente.
 * Usa datos reales de TMDB + Google Gemini para redactar contenido de calidad.
 * 
 * USO:
 *   node scripts/seo-agent.js "orden para ver Star Wars"
 *   node scripts/seo-agent.js "orden cronológico Marvel MCU"
 *   node scripts/seo-agent.js "en qué orden ver El Señor de los Anillos"
 * 
 * También acepta un segundo argumento para el tipo de búsqueda:
 *   node scripts/seo-agent.js "John Wick" collection
 *   node scripts/seo-agent.js "Stranger Things" tv
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });

const TMDB_TOKEN = process.env.VITE_TMDB_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!TMDB_TOKEN || !OPENAI_API_KEY) {
  console.error('❌ Faltan las API keys. Asegúrate de tener VITE_TMDB_TOKEN y OPENAI_API_KEY en tu .env');
  process.exit(1);
}

const TMDB_OPTIONS = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${TMDB_TOKEN}`
  }
};

// ─── TMDB Helpers ────────────────────────────────────────────────────────────

async function tmdbFetch(endpoint) {
  const url = `https://api.themoviedb.org/3${endpoint}`;
  const res = await fetch(url, TMDB_OPTIONS);
  if (!res.ok) throw new Error(`TMDB error: ${res.status} on ${endpoint}`);
  return res.json();
}

async function searchMulti(query) {
  return tmdbFetch(`/search/multi?query=${encodeURIComponent(query)}&language=es-ES&page=1`);
}

async function searchCollection(query) {
  return tmdbFetch(`/search/collection?query=${encodeURIComponent(query)}&language=es-ES&page=1`);
}

async function getCollectionDetails(id) {
  return tmdbFetch(`/collection/${id}?language=es-ES`);
}

async function getTVDetails(id) {
  return tmdbFetch(`/tv/${id}?language=es-ES`);
}

async function getMovieDetails(id) {
  return tmdbFetch(`/movie/${id}?language=es-ES`);
}

// ─── Clean Query ─────────────────────────────────────────────────────────────

function cleanQueryForTMDB(query) {
  // Strip common SEO prefixes to get the actual content name
  const prefixes = [
    /^(en qu[eé] orden ver\s+)/i,
    /^(orden (para|de|cronol[oó]gico( de| para)?)\s+(ver\s+)?)/i,
    /^(c[oó]mo ver\s+)/i,
    /^(gu[ií]a (completa )?(de|para)\s+(ver\s+)?)/i,
    /^(saga (completa )?(de\s+)?)/i,
    /^(todas las pel[ií]culas de\s+)/i,
    /^(todas las temporadas de\s+)/i,
  ];

  let cleaned = query.trim();
  for (const re of prefixes) {
    cleaned = cleaned.replace(re, '');
  }
  return cleaned.trim();
}

// ─── Gather TMDB Data ────────────────────────────────────────────────────────

async function gatherTMDBData(query, typeHint) {
  const tmdbQuery = cleanQueryForTMDB(query);
  console.log(`🔍 Buscando "${tmdbQuery}" en TMDB... (query original: "${query}")`);

  let context = { type: '', title: '', overview: '', items: [] };

  // 1. Try collection search first (or if hint says so)
  if (!typeHint || typeHint === 'collection') {
    const collResults = await searchCollection(tmdbQuery);
    if (collResults.results && collResults.results.length > 0) {
      // Score collections: prefer exact name match + most parts
      let bestColl = null;
      let bestScore = -1;
      const queryLower = tmdbQuery.toLowerCase();

      for (const coll of collResults.results.slice(0, 5)) {
        const details = await getCollectionDetails(coll.id);
        if (!details || !details.parts || details.parts.length === 0) continue;

        const nameLower = (details.name || '').toLowerCase();
        let score = details.parts.length * 10; // strongly prefer collections with more parts
        
        // Bonus for exact or near-exact name match
        if (nameLower.includes(queryLower) && !nameLower.includes('lego') && !nameLower.includes('ewok')) score += 50;
        if (nameLower.startsWith(queryLower)) score += 30;
        // Penalise spin-offs like LEGO, animated shorts, Ewoks, etc.
        if (nameLower.includes('lego') || nameLower.includes('short') || nameLower.includes('ewok')) score -= 200;

        if (score > bestScore) {
          bestScore = score;
          bestColl = details;
        }
      }

      if (bestColl && bestScore > 0) {
        context.type = 'collection';
        context.title = bestColl.name.replace(/Collection|Colección/gi, '').trim();
        context.overview = bestColl.overview || '';
        context.collectionId = bestColl.id;

        const sorted = bestColl.parts.sort((a, b) =>
          new Date(a.release_date || '9999') - new Date(b.release_date || '9999')
        );

        context.items = sorted.map(p => ({
          title: p.title,
          year: p.release_date ? p.release_date.substring(0, 4) : 'TBA',
          date: p.release_date || '',
          overview: p.overview || 'Sin descripción.',
          type: 'movie'
        }));

        console.log(`  ✅ Colección encontrada: ${context.title} (${context.items.length} películas)`);
        return context;
      }
    }
  }

  // 2. Try multi search for TV/Movie
  const multiResults = await searchMulti(tmdbQuery);
  if (!multiResults.results || multiResults.results.length === 0) {
    throw new Error(`No se encontró nada en TMDB para "${tmdbQuery}"`);
  }

  // Prefer TV shows
  const tvResult = multiResults.results.find(r => r.media_type === 'tv');
  const movieResult = multiResults.results.find(r => r.media_type === 'movie');

  if ((typeHint === 'tv' || !typeHint) && tvResult) {
    const tvData = await getTVDetails(tvResult.id);
    context.type = 'tv';
    context.title = tvData.name;
    context.overview = tvData.overview || '';
    context.tvId = tvData.id;

    const seasons = (tvData.seasons || [])
      .filter(s => s.season_number > 0)
      .sort((a, b) => new Date(a.air_date || '9999') - new Date(b.air_date || '9999'));

    context.items = seasons.map(s => ({
      title: s.name,
      year: s.air_date ? s.air_date.substring(0, 4) : 'TBA',
      date: s.air_date || '',
      overview: s.overview || `Temporada ${s.season_number}.`,
      episodeCount: s.episode_count,
      type: 'season'
    }));

    console.log(`  ✅ Serie encontrada: ${context.title} (${context.items.length} temporadas)`);
    return context;
  }

  if (movieResult) {
    const movieData = await getMovieDetails(movieResult.id);
    
    // Check if it belongs to a collection
    if (movieData.belongs_to_collection) {
      const details = await getCollectionDetails(movieData.belongs_to_collection.id);
      context.type = 'collection';
      context.title = details.name.replace(/Collection|Colección/gi, '').trim();
      context.overview = details.overview || movieData.overview || '';
      context.collectionId = details.id;

      const sorted = details.parts.sort((a, b) =>
        new Date(a.release_date || '9999') - new Date(b.release_date || '9999')
      );

      context.items = sorted.map(p => ({
        title: p.title,
        year: p.release_date ? p.release_date.substring(0, 4) : 'TBA',
        date: p.release_date || '',
        overview: p.overview || 'Sin descripción.',
        type: 'movie'
      }));

      console.log(`  ✅ Colección encontrada via película: ${context.title} (${context.items.length} películas)`);
      return context;
    }

    // Standalone movie
    context.type = 'movie';
    context.title = movieData.title;
    context.overview = movieData.overview || '';
    context.items = [{
      title: movieData.title,
      year: movieData.release_date ? movieData.release_date.substring(0, 4) : 'TBA',
      date: movieData.release_date || '',
      overview: movieData.overview || '',
      type: 'movie'
    }];

    console.log(`  ✅ Película encontrada: ${context.title}`);
    return context;
  }

  throw new Error(`No se encontró contenido relevante para "${tmdbQuery}"`);
}

// ─── Gemini AI ───────────────────────────────────────────────────────────────

async function generateArticle(tmdbData, originalQuery) {
  console.log(`\n🤖 Generando artículo SEO con Gemini...`);

  const itemsList = tmdbData.items.map((item, i) => {
    let line = `${i + 1}. "${item.title}" (${item.year})`;
    if (item.episodeCount) line += ` — ${item.episodeCount} episodios`;
    if (item.overview && item.overview.length > 10) line += ` — ${item.overview.substring(0, 150)}`;
    return line;
  }).join('\n');

  const contentType = tmdbData.type === 'tv' ? 'serie de televisión' :
                      tmdbData.type === 'collection' ? 'saga cinematográfica' : 'película';

  const prompt = `Eres un redactor SEO experto en cine y series de televisión para el blog de "Orden para ver" (ordenparaver.com), una web española que ayuda a los usuarios a descubrir el orden cronológico correcto para disfrutar sagas y series.

CONTEXTO REAL de TMDB (usa estos datos como fuente de verdad):
- Nombre: ${tmdbData.title}
- Tipo: ${contentType}
- Sinopsis general: ${tmdbData.overview || 'No disponible'}
- Contenido ordenado cronológicamente:
${itemsList}

INSTRUCCIONES:
1. Escribe un artículo de blog en ESPAÑOL de al menos 1200 palabras.
2. El artículo debe posicionar para la keyword principal: "${originalQuery}"
3. Estructura obligatoria:
   - Un título H1 atractivo y con la keyword (máx 65 caracteres)
   - Introducción enganchante (2-3 párrafos) que enganche al lector y contenga la keyword
   - Sección "## Orden cronológico completo" con cada entrada numerada, su año, y una descripción de 2-3 frases de por qué es importante en la cronología
   - Sección "## ¿Por qué ver en este orden?" explicando los beneficios
   - Sección "## Preguntas frecuentes" con 3-4 preguntas relevantes en formato ### y sus respuestas
   - Sección "## Conclusión" con un párrafo final que invite a usar la web
4. Usa negritas (**texto**) para las keywords secundarias
5. Usa citas (>) para datos curiosos o frases icónicas
6. Tono: cercano, apasionado pero profesional. Como un amigo cinéfilo que sabe mucho.
7. NO inventes datos. Usa solo la información de TMDB proporcionada.
8. Incluye enlaces internos con formato markdown: [Ver la cronología completa](/contenidos/)

FORMATO DE SALIDA:
Devuelve ÚNICAMENTE el contenido en Markdown puro (sin bloque de código, sin \`\`\`markdown). Empieza directamente con el texto del artículo (sin el título H1, que irá en el front-matter).`;

  // Modelo configurable desde .env (OPENAI_MODEL)
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  console.log(`  Usando modelo: ${model}`);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Eres un redactor SEO experto en cine y series. Escribes en español de España.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4096,
    })
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(`OpenAI error (${model}): ${data.error.message}`);
  }

  if (!data.choices || data.choices.length === 0) {
    throw new Error(`OpenAI no devolvió resultados con el modelo ${model}.`);
  }

  const rawText = data.choices[0].message.content;
  console.log(`  ✅ Artículo generado con ${model}`);
  return rawText.replace(/^```markdown\n?/i, '').replace(/\n?```$/i, '').trim();
}

// ─── Generate SEO Title & Description ────────────────────────────────────────

function generateSEOMeta(tmdbData, query) {
  const title = tmdbData.type === 'tv'
    ? `${tmdbData.title}: Orden de Temporadas y Guía Completa (${new Date().getFullYear()})`
    : `Orden para ver ${tmdbData.title} – Guía Cronológica Completa (${new Date().getFullYear()})`;

  const description = tmdbData.type === 'tv'
    ? `Descubre el orden correcto para ver ${tmdbData.title}. Guía actualizada con todas las temporadas y el orden cronológico recomendado.`
    : `¿En qué orden ver las películas de ${tmdbData.title}? Guía completa con el orden cronológico definitivo, actualizada a ${new Date().getFullYear()}.`;

  return { title: title.substring(0, 70), description: description.substring(0, 160) };
}

// ─── Save as Markdown ────────────────────────────────────────────────────────

function savePost(slug, frontMatter, content) {
  const contentDir = path.join(rootDir, 'content', 'blog');
  if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir, { recursive: true });

  const filePath = path.join(contentDir, `${slug}.md`);

  const md = `---
title: "${frontMatter.title}"
description: "${frontMatter.description}"
date: "${new Date().toISOString().split('T')[0]}"
image: "${frontMatter.image}"
---

${content}
`;

  fs.writeFileSync(filePath, md);
  console.log(`\n📝 Artículo guardado en: content/blog/${slug}.md`);
  return filePath;
}

// ─── Slug Generator ──────────────────────────────────────────────────────────

function toSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/-{2,}/g, '-');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
🤖 Agente SEO - Orden para ver
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Uso:
  node scripts/seo-agent.js "orden para ver Star Wars"
  node scripts/seo-agent.js "Stranger Things" tv
  node scripts/seo-agent.js "John Wick" collection

Argumentos:
  1. Query de búsqueda (obligatorio)
  2. Tipo de contenido: tv | collection | movie (opcional)
`);
    process.exit(0);
  }

  const query = args[0];
  const typeHint = args[1] || null;

  try {
    // 1. Buscar datos reales en TMDB
    const tmdbData = await gatherTMDBData(query, typeHint);

    // 2. Generar metadatos SEO
    const seoMeta = generateSEOMeta(tmdbData, query);

    // 3. Generar imagen de portada placeholder (usamos poster de TMDB si está)
    const posterImage = `https://image.tmdb.org/t/p/w780${tmdbData.items[0]?.posterPath || ''}`;
    // Fallback a un placeholder descriptivo
    const image = posterImage.includes('null') || posterImage.endsWith('w780')
      ? `https://via.placeholder.com/800x400/1a1a2e/ff8c5a?text=${encodeURIComponent(tmdbData.title)}`
      : posterImage;

    // 4. Llamar a Gemini para generar el artículo
    const articleContent = await generateArticle(tmdbData, query);

    // 5. Guardar como .md
    const slug = toSlug(query);
    savePost(slug, { ...seoMeta, image }, articleContent);

    // 6. Regenerar el blog
    console.log(`\n🔨 Regenerando el blog...`);
    const { execSync } = await import('child_process');
    execSync('node scripts/build-blog.js', { cwd: rootDir, stdio: 'inherit' });

    console.log(`\n✨ ¡Listo! Tu artículo está publicado.`);
    console.log(`   📄 Archivo: content/blog/${slug}.md`);
    console.log(`   🌐 URL: /blog/${slug}/`);
    
    if (tmdbData.collectionId) {
      console.log(`   🔗 Enlace a la saga: /franchise/?collection_id=${tmdbData.collectionId}`);
    } else if (tmdbData.tvId) {
      console.log(`   🔗 Enlace a la serie: /franchise/?tv_id=${tmdbData.tvId}`);
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
