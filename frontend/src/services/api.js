import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
  timeout: 30000,
});

// Silent access-token refresh: one refresh at a time, then replay the failed request
let refreshing = null;
const NO_RETRY = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/register'];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    if (
      response?.status === 401 &&
      config &&
      !config._retry &&
      !NO_RETRY.some((p) => config.url?.includes(p))
    ) {
      config._retry = true;
      refreshing = refreshing || api.post('/auth/refresh').finally(() => (refreshing = null));
      try {
        await refreshing;
        return api(config);
      } catch {
        window.dispatchEvent(new Event('auth:expired'));
      }
    }
    return Promise.reject(error);
  }
);

/** Returns the JSON envelope { success, data, meta } */
export const get = (url, params) => api.get(url, { params }).then((r) => r.data);
export const post = (url, body, cfg) => api.post(url, body, cfg).then((r) => r.data);
export const patch = (url, body) => api.patch(url, body).then((r) => r.data);
export const put = (url, body) => api.put(url, body).then((r) => r.data);
export const del = (url) => api.delete(url).then((r) => r.data);

export function upload(url, file, fields = {}) {
  const fd = new FormData();
  if (file) fd.append('file', file);
  Object.entries(fields).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && fd.append(k, v));
  return api.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300000 }).then((r) => r.data);
}

/** Downloads a CSV/XLSX export through the authenticated session */
export async function download(url, params, fallbackName = 'export') {
  const res = await api.get(url, { params, responseType: 'blob' });
  const disposition = res.headers['content-disposition'] || '';
  const name = /filename="?([^"]+)"?/.exec(disposition)?.[1] || fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export const errorMessage = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.error?.message || (err?.code === 'ECONNABORTED' ? 'Request timed out' : err?.message) || fallback;

/** Maps API validation details to react-hook-form setError calls */
export function applyFieldErrors(err, setError) {
  const details = err?.response?.data?.error?.details;
  if (!Array.isArray(details)) return false;
  let applied = false;
  details.forEach((d) => {
    if (d.field && d.message) {
      setError(d.field, { type: 'server', message: d.message });
      applied = true;
    }
  });
  return applied;
}

export default api;
