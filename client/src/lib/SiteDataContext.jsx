import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { fetchAll } from "./site-data";

const SiteDataContext = createContext({ data: null, loading: true, error: null });

export function useSiteData() {
  return useContext(SiteDataContext);
}

export function SiteDataProvider({ children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAll();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return <SiteDataContext.Provider value={{ data, loading, error, reload: load }}>{children}</SiteDataContext.Provider>;
}