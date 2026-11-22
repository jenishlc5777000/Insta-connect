import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { get, errorMessage } from '../services/api';

export function useDebounce(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/**
 * Fetches `url` with `params`; re-fetches when either changes.
 * Returns { data, meta, loading, error, reload, setData }.
 */
export function useFetch(url, params, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, meta: null, loading: Boolean(enabled && url), error: null });
  const key = JSON.stringify(params || {});
  const reqId = useRef(0);

  const load = useCallback(async () => {
    if (!enabled || !url) return;
    const id = ++reqId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await get(url, params);
      if (id === reqId.current) setState({ data: res.data, meta: res.meta || null, loading: false, error: null });
    } catch (err) {
      if (id === reqId.current) setState((s) => ({ ...s, loading: false, error: errorMessage(err) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  return { ...state, reload: load, setData };
}

/**
 * Table state: pagination, sorting, search and filters -> query params for list endpoints.
 */
export function useListQuery({ limit = 20, sort = '-createdAt', filters: initialFilters = {} } = {}) {
  const [page, setPage] = useState(1);
  const [sortState, setSort] = useState(sort);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const debounced = useDebounce(search);

  useEffect(() => setPage(1), [debounced, filters, sortState]);

  const params = useMemo(() => {
    const p = { page, limit, sort: sortState };
    if (debounced) p.search = debounced;
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v !== undefined && v !== null) p[k] = v;
    });
    return p;
  }, [page, limit, sortState, debounced, filters]);

  const setFilter = useCallback((k, v) => setFilters((f) => ({ ...f, [k]: v })), []);
  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
    setSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSort = useCallback((field) => setSort((s) => (s === field ? `-${field}` : s === `-${field}` ? field : `-${field}`)), []);

  return { params, page, setPage, sort: sortState, setSort, toggleSort, search, setSearch, filters, setFilter, resetFilters };
}

export function useCopy() {
  const [copied, setCopied] = useState(null);
  const copy = useCallback(async (text, key = text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }, []);
  return { copy, copied };
}

export function useDocumentTitle(title) {
  useEffect(() => {
    if (title) document.title = `${title} | JenCorps`;
  }, [title]);
}
