/**
 * Minimal console-based logger for the Cloudflare Worker runtime.
 *
 * The Express version used pino + pino-http + pino-pretty for structured
 * logging. pino's transports rely on Node worker_threads / file descriptors
 * that don't exist in Workers, and Workers logs are consumed via
 * `wrangler tail` / the dashboard as plain console output anyway, so we swap
 * to a tiny console wrapper that preserves the same call signature used
 * throughout the codebase: logger.info(obj, msg) / logger.info(msg).
 */
type LogFn = (objOrMsg: unknown, msg?: string) => void;

function makeLogFn(level: "info" | "warn" | "error" | "debug"): LogFn {
  const consoleFn =
    level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  return (objOrMsg, msg) => {
    if (typeof objOrMsg === "string") {
      consoleFn(`[${level}] ${objOrMsg}`);
    } else {
      consoleFn(`[${level}] ${msg ?? ""}`, objOrMsg);
    }
  };
}

export const logger = {
  info: makeLogFn("info"),
  warn: makeLogFn("warn"),
  error: makeLogFn("error"),
  debug: makeLogFn("debug"),
};
