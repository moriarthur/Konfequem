const isProd = import.meta.env?.MODE === "production";

export function error(...args: unknown[]) {
  if (!isProd) console.error(...args);
}

export function warn(...args: unknown[]) {
  if (!isProd) console.warn(...args);
}

export function info(...args: unknown[]) {
  if (!isProd) console.info(...args);
}

export function log(...args: unknown[]) {
  if (!isProd) console.log(...args);
}

export default { error, warn, info, log };
