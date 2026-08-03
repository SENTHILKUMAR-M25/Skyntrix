import axios from "axios";
import { API_URL } from "../config/site";

export const TOKEN_KEY = "skyntrix_admin_token";
export const API_BASE = API_URL.length ? API_URL.replace(/\/$/, "") : "/api";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (error) => {
    const status = error.response?.status;
    const isLogin = error.config?.url?.includes("/auth/login");
    if (status === 401 && !isLogin) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname.startsWith("/admin") && !window.location.pathname.endsWith("/login")) {
        window.location.href = "/admin/login";
      }
    }
    const msg = error.response?.data?.message || error.message || "Request failed.";
    return Promise.reject(new Error(msg));
  }
);

// Bound helpers that keep callers tidy.
export const adminGet = (url, params) => api.get(url, { params });

const withHeaders = (data, extra = {}) => {
  const isForm = typeof FormData !== "undefined" && data instanceof FormData;
  return {
    ...(isForm ? { "Content-Type": "multipart/form-data" } : {}),
    ...extra,
  };
};

export const adminPost = (url, data) => api.post(url, data, { headers: withHeaders(data) });
export const adminPut = (url, data) => api.put(url, data, { headers: withHeaders(data) });
export const adminDelete = (url) => api.delete(url);

// Send takeoverable FormData for multipart-capable routes.
export const submitForm = async (url, { values, files = [], method = "post" }) => {
  const fd = new FormData();
  Object.entries(values || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) {
      v.forEach((item) => fd.append(k, item));
    } else if (typeof v === "object") {
      fd.append(k, JSON.stringify(v));
    } else {
      fd.append(k, v);
    }
  });
  files.forEach(({ field, value }) => {
    if (value) fd.append(field, value);
  });
  const opts = { headers: { "Content-Type": "multipart/form-data" } };
  return method === "put" ? api.put(url, fd, opts) : api.post(url, fd, opts);
};

export default api;