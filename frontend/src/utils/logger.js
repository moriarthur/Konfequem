// Small logger wrapper: in production it's a no-op, in dev prints to console.
const isProd = import.meta.env && import.meta.env.MODE === 'production';

export function error(...args) {
  if (!isProd) console.error(...args);
}

export function warn(...args) {
  if (!isProd) console.warn(...args);
}

export function info(...args) {
  if (!isProd) console.info(...args);
}

export function log(...args) {
  if (!isProd) console.log(...args);
}

export default { error, warn, info, log };
