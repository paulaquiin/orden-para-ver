const TMDB_TOKEN = import.meta.env.VITE_TMDB_TOKEN;

const OPTIONS = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${TMDB_TOKEN}`
  }
};

export async function fetchTMDBDetails(type, id) {
  try {
    const url = `https://api.themoviedb.org/3/${type}/${id}?language=es-ES`;
    const response = await fetch(url, OPTIONS);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error("Error fetching TMDB data:", error);
    return null;
  }
}

export async function fetchMovieDetails(id) {
  return fetchTMDBDetails('movie', id);
}

export async function searchTMDB(query) {
  try {
    const url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&language=es-ES&page=1`;
    const response = await fetch(url, OPTIONS);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error("Error searching TMDB:", error);
    return null;
  }
}

export async function searchCollectionTMDB(query) {
  try {
    const url = `https://api.themoviedb.org/3/search/collection?query=${encodeURIComponent(query)}&language=es-ES&page=1`;
    const response = await fetch(url, OPTIONS);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error("Error searching collection in TMDB:", error);
    return null;
  }
}

export async function fetchCollectionDetails(collectionId) {
  try {
    const url = `https://api.themoviedb.org/3/collection/${collectionId}?language=es-ES`;
    const response = await fetch(url, OPTIONS);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error("Error fetching collection TMDB:", error);
    return null;
  }
}

export async function fetchWatchProviders(type, id) {
  try {
    const url = `https://api.themoviedb.org/3/${type}/${id}/watch/providers`;
    const response = await fetch(url, OPTIONS);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error("Error fetching watch providers TMDB:", error);
    return null;
  }
}

export async function fetchTVCredits(id) {
  try {
    const url = `https://api.themoviedb.org/3/tv/${id}/aggregate_credits?language=es-ES`;
    const response = await fetch(url, OPTIONS);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error("Error fetching TV credits:", error);
    return null;
  }
}

export async function fetchMovieCredits(id) {
  try {
    const url = `https://api.themoviedb.org/3/movie/${id}/credits?language=es-ES`;
    const response = await fetch(url, OPTIONS);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error("Error fetching Movie credits:", error);
    return null;
  }
}

export async function discoverTMDB(type, params = {}) {
  try {
    const queryParams = new URLSearchParams({
      language: 'es-ES',
      sort_by: 'popularity.desc',
      'vote_count.gte': 100,
      ...params
    });
    const url = `https://api.themoviedb.org/3/discover/${type}?${queryParams.toString()}`;
    const response = await fetch(url, OPTIONS);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error("Error discovering TMDB:", error);
    return null;
  }
}

export function getImageUrl(path, size = 'w500') {
  if (!path) return 'https://via.placeholder.com/220x330/1a1a1a/444444?text=No+Poster';
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
