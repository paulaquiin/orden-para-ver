const HARDCOVER_ENDPOINT = 'https://api.hardcover.app/v1/graphql';

const SEARCH_SERIES_QUERY = `
  query SearchSeries($query: String!) {
    search(query: $query, query_type: "Series", per_page: 12, page: 1) {
      ids
      results
    }
  }
`;

const VALIDATE_SERIES_QUERY = `
  query ValidateSeries($ids: [Int!]!) {
    series(where: {id: {_in: $ids}}) {
      id
      book_series(
        limit: 1
        where: {book: {canonical_id: {_is_null: true}}}
      ) {
        book_id
      }
    }
  }
`;

const GET_SERIES_QUERY = `
  query GetSeries($id: Int!) {
    series(
      limit: 1
      where: {id: {_eq: $id}, canonical_id: {_is_null: true}}
    ) {
      id
      name
      slug
      books_count
      author { name }
      book_series(
        distinct_on: position
        order_by: [{position: asc}, {book: {users_count: desc}}]
        where: {book: {canonical_id: {_is_null: true}}}
      ) {
        position
        details
        compilation
        book {
          id
          slug
          title
          is_partial_book
          description
          release_year
          pages
          rating
          cached_image
          cached_contributors
        }
      }
    }
  }
`;

function json(data, status = 200, cacheControl = 'no-store') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function parseJsonField(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function findImageUrl(value) {
  const image = parseJsonField(value, null);
  if (!image) return null;
  if (typeof image === 'string') return image.startsWith('http') ? image : null;

  return image.url || image.original || image.large || image.medium || image.small || null;
}

function findContributorName(value) {
  const contributors = parseJsonField(value, []);
  if (!Array.isArray(contributors)) return null;

  const contributor = contributors.find((item) => item?.author?.name || item?.name);
  return contributor?.author?.name || contributor?.name || null;
}

async function hardcoverRequest(token, query, variables) {
  const authorization = token.trim().toLowerCase().startsWith('bearer ')
    ? token.trim()
    : `Bearer ${token.trim()}`;

  const response = await fetch(HARDCOVER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': authorization,
      'User-Agent': 'OrdenParaVer/1.0 (book-series-search)'
    },
    body: JSON.stringify({ query, variables })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    throw new Error(response.status === 429
      ? 'Hardcover ha recibido demasiadas consultas. Inténtalo de nuevo en un minuto.'
      : 'Hardcover no ha respondido correctamente.');
  }

  if (data.errors?.length) {
    throw new Error(data.errors[0].message || 'Hardcover ha rechazado la consulta.');
  }

  return data.data;
}

async function searchSeries(token, query) {
  const data = await hardcoverRequest(token, SEARCH_SERIES_QUERY, { query });
  const search = data?.search || {};
  const ids = parseJsonField(search.ids, []);
  const rawResults = parseJsonField(search.results, []);
  const results = Array.isArray(rawResults)
    ? rawResults
    : Array.isArray(rawResults?.hits)
      ? rawResults.hits.map((hit) => hit?.document || hit)
      : Array.isArray(rawResults?.results)
        ? rawResults.results
        : [];

  const normalizedSeries = (Array.isArray(results) ? results : []).map((item, index) => ({
    id: Number(item.id || ids[index]),
    name: item.name || 'Serie sin título',
    slug: item.slug || null,
    author: item.author_name || item.author?.name || null,
    booksCount: Number(item.books_count || 0),
    primaryBooksCount: Number(item.primary_books_count || item.books_count || 0),
    readersCount: Number(item.readers_count || 0)
  })).filter((item) => Number.isInteger(item.id) && item.id > 0 && item.booksCount > 0);

  if (!normalizedSeries.length) return [];

  const validation = await hardcoverRequest(token, VALIDATE_SERIES_QUERY, {
    ids: normalizedSeries.map((item) => item.id)
  });
  const availableIds = new Set(
    (validation?.series || [])
      .filter((item) => item.book_series?.length)
      .map((item) => Number(item.id))
  );

  return normalizedSeries.filter((item) => availableIds.has(item.id));
}

async function getSeries(token, id) {
  const data = await hardcoverRequest(token, GET_SERIES_QUERY, { id });
  const series = data?.series?.[0];
  if (!series) return null;

  const entries = series.book_series || [];
  const numberedBooks = entries.filter((entry) =>
    entry.position != null && !entry.compilation && !entry.book.is_partial_book
  );
  const unnumberedBooks = entries.filter((entry) =>
    entry.position == null && !entry.compilation && !entry.book.is_partial_book
  );
  const selectedEntries = numberedBooks.length
    ? numberedBooks
    : unnumberedBooks.length
      ? unnumberedBooks
      : entries;

  return {
    id: series.id,
    name: series.name,
    slug: series.slug,
    author: series.author?.name || null,
    booksCount: Number(series.books_count || 0),
    books: selectedEntries.map((entry) => ({
      id: entry.book.id,
      position: entry.details || (entry.position == null ? null : String(entry.position)),
      compilation: Boolean(entry.compilation),
      partial: Boolean(entry.book.is_partial_book),
      title: entry.book.title,
      slug: entry.book.slug,
      description: entry.book.description,
      releaseYear: entry.book.release_year,
      pages: entry.book.pages,
      rating: entry.book.rating,
      coverUrl: findImageUrl(entry.book.cached_image),
      author: findContributorName(entry.book.cached_contributors)
    }))
  };
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return json({ error: 'Método no permitido.' }, 405);
  }

  const token = context.env.HARDCOVER_TOKEN2 || context.env.HARDCOVER_TOKEN;
  if (!token) {
    return json({
      code: 'TOKEN_NOT_CONFIGURED',
      error: 'Añade HARDCOVER_TOKEN2 a los secretos del servidor para activar la búsqueda de libros.'
    }, 503);
  }

  const url = new URL(context.request.url);
  const action = url.searchParams.get('action');

  try {
    if (action === 'search') {
      const query = (url.searchParams.get('q') || '').trim();
      if (query.length < 2 || query.length > 100) {
        return json({ error: 'La búsqueda debe tener entre 2 y 100 caracteres.' }, 400);
      }

      const series = await searchSeries(token, query);
      return json({ series }, 200, 'public, max-age=300, s-maxage=3600');
    }

    if (action === 'series') {
      const id = Number(url.searchParams.get('id'));
      if (!Number.isInteger(id) || id <= 0) {
        return json({ error: 'El identificador de la saga no es válido.' }, 400);
      }

      const series = await getSeries(token, id);
      if (!series) return json({ error: 'No se ha encontrado esa saga.' }, 404);
      return json({ series }, 200, 'public, max-age=900, s-maxage=86400');
    }

    return json({ error: 'Acción no válida.' }, 400);
  } catch (error) {
    return json({ error: error.message || 'No se pudo consultar Hardcover.' }, 502);
  }
}
