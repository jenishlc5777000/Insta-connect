import { createContext, useContext, useEffect, useState } from 'react';
import { get } from '../services/api';

const defaults = { siteName: 'JenCorps', supportEmail: '', supportPhone: '', socialLinks: {} };
const SiteContext = createContext(defaults);

export function SiteProvider({ children }) {
  const [settings, setSettings] = useState(defaults);
  useEffect(() => {
    get('/public/settings')
      .then((r) => setSettings({ ...defaults, ...r.data }))
      .catch(() => {});
  }, []);
  return <SiteContext.Provider value={settings}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);
