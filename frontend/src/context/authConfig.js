// Small module to hold non-component exports for auth context
export const API_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

export default {
  API_URL,
};
