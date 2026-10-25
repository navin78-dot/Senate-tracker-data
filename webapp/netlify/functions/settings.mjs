// /api/settings — site switches. Today there is one: showClaude, whether friends may see Claude's call.
// Anyone signed in may GET; only the admin emails in ../lib/rules.mjs may POST. Stored in the board's blob store under "settings".
import { getUser } from "@netlify/identity";
import { store } from "../lib/store.mjs";
import { ADMIN_EMAILS } from "../lib/rules.mjs";

export const DEFAULTS = { showClaude: false };
export async function readSettings(s) { const v = await s.get("settings", { type: "json" }); return { ...DEFAULTS, ...(v || {}) }; }

export default async (req) => {
  const user = await getUser();
  if (!user) return Response.json({ error: "sign in first" }, { status: 401 });
  const s = store();
  const isAdmin = ADMIN_EMAILS.includes((user.email || "").toLowerCase());
  if (req.method === "GET") return Response.json({ ...(await readSettings(s)), admin: isAdmin });
  if (req.method === "POST") {
    if (!isAdmin) return Response.json({ error: "only Navin can change site settings" }, { status: 403 });
    let body; try { body = await req.json(); } catch { return Response.json({ error: "bad JSON" }, { status: 400 }); }
    const cur = await readSettings(s);
    const next = { ...cur, showClaude: body.showClaude === true, updatedAt: new Date().toISOString(), by: user.email };
    await s.setJSON("settings", next);
    return Response.json({ saved: true, ...next });
  }
  return Response.json({ error: "method" }, { status: 405 });
};
export const config = { path: "/api/settings", method: ["GET", "POST"] };
