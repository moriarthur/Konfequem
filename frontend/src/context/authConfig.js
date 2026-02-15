// Small module to hold non-component exports for auth context
// VITE_BACKEND_URL should be set in .env (default: http://localhost:8000)
export const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export default {
  API_URL,
};
