const API_BASE_URL = 'http://localhost:8080';

function buildUrl(path) {
  if (!path) return API_BASE_URL;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

export async function apiRequest(path, options = {}) {
  const url = buildUrl(path);
  return fetch(url, options);
}

export { API_BASE_URL };
