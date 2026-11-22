import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { post } from '../services/api';

const ReferralContext = createContext({ hostInfluencer: null, attribution: null, utm: {} });
const UTM_KEY = 'jc_utm';

function readStoredUtm() {
  try {
    return JSON.parse(sessionStorage.getItem(UTM_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * Tracks the visit on first load and whenever the visitor lands on a workshop page.
 * The influencer is identified by the API from the hostname; attribution lives in an
 * HTTP-only first-party cookie, so it survives navigation and reloads.
 * UTM parameters are kept for the session so they can be submitted with the registration.
 */
export function ReferralProvider({ children }) {
  const location = useLocation();
  const [state, setState] = useState({ hostInfluencer: null, attribution: null, loaded: false });
  const [utm, setUtm] = useState(readStoredUtm);
  const tracked = useRef(new Set());

  useEffect(() => {
    // Dashboards don't generate referral traffic
    if (/^\/(admin|influencer)(\/|$)/.test(location.pathname)) {
      setState((s) => ({ ...s, loaded: true }));
      return;
    }
    const params = new URLSearchParams(location.search);
    const fromUrl = {
      source: params.get('utm_source') || undefined,
      medium: params.get('utm_medium') || undefined,
      campaign: params.get('utm_campaign') || undefined,
      content: params.get('utm_content') || undefined,
    };
    let current = utm;
    if (Object.values(fromUrl).some(Boolean)) {
      current = Object.fromEntries(Object.entries(fromUrl).filter(([, v]) => v));
      setUtm(current);
      try {
        sessionStorage.setItem(UTM_KEY, JSON.stringify(current));
      } catch {
        /* storage unavailable */
      }
    }

    const workshopSlug = /^\/(?:workshops|register)\/([a-z0-9-]+)/.exec(location.pathname)?.[1];
    const key = workshopSlug || '__root__';
    if (tracked.current.has(key)) return;
    tracked.current.add(key);

    post('/referrals/track', {
      path: location.pathname,
      workshopSlug,
      ref: params.get('ref') || undefined,
      referrer: tracked.current.size === 1 ? document.referrer || undefined : undefined,
      utm: current,
    })
      .then((res) => setState({ ...res.data, loaded: true }))
      .catch(() => setState((s) => ({ ...s, loaded: true })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const value = useMemo(() => ({ ...state, utm }), [state, utm]);
  return <ReferralContext.Provider value={value}>{children}</ReferralContext.Provider>;
}

export const useReferral = () => useContext(ReferralContext);
