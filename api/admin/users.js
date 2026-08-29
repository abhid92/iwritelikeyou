const bcrypt = require("bcryptjs");
const { requireAdmin } = require("../../lib/auth");
const { get, post, patch } = require("../../lib/supabase");

function genPassword(len = 12) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  // GET: list users for a client
  if (req.method === "GET") {
    const params   = new URL(req.url, "http://x").searchParams;
    const clientId = params.get("client_id");
    if (!clientId) return res.status(400).json({ error: "?client_id= required" });
    const { data } = await get(`client_users?client_id=eq.${clientId}&select=id,username,created_at,last_login`);
    return res.status(200).json({ users: Array.isArray(data) ? data : [] });
  }

  // POST: create new user
  if (req.method === "POST") {
    const { client_id, username } = req.body || {};
    if (!client_id || !username) return res.status(400).json({ error: "client_id and username required" });
    const password = genPassword();
    const hash     = await bcrypt.hash(password, 10);
    const { data, ok } = await post("client_users", { client_id, username, password_hash: hash });
    if (!ok) return res.status(400).json({ error: data?.message || "Could not create user" });
    return res.status(201).json({ username, password, note: "Save this password — it won't be shown again." });
  }

  // PUT: reset password
  if (req.method === "PUT") {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: "username required" });
    const password = genPassword();
    const hash     = await bcrypt.hash(password, 10);
    const { ok, data } = await patch(`client_users?username=eq.${encodeURIComponent(username)}`, { password_hash: hash });
    if (!ok) return res.status(400).json({ error: data?.message || "Could not reset" });
    return res.status(200).json({ username, password, note: "Save this password — it won't be shown again." });
  }

  return res.status(405).end();
};
