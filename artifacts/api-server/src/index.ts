// Cloudflare Worker entry point. Hono's default export already implements the
// Worker `fetch` handler contract, so there's no listen()/PORT handling here
// (that was Express/Node-specific — see wrangler.toml for the Workers-side
// port/routing configuration instead).
import app from "./app";

export default app;
