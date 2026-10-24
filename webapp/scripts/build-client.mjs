// Bundles the browser copy of @netlify/identity into public/identity.js so index.html can import it without a framework.
import { build } from "esbuild";
await build({ entryPoints: ["src/identity-entry.js"], bundle: true, format: "esm", platform: "browser", target: "es2020", minify: true, outfile: "public/identity.js", logLevel: "info" });
