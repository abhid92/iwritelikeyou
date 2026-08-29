const bcrypt = require("bcryptjs");
const { sign } = require("../lib/auth");
const { get, patch } = require("../lib/supabase");

async function handleLogin(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username and password required" });
  const { data } = await get(`client_users?username=eq.${encodeURIComponent(username)}&select=*`);
  const user = Array.isArray(data) ? data[0] : null;
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });
  await patch(`client_users?id=eq.${user.id}`, { last_login: new Date().toISOString() });
  const token = sign({ role: "client", clientId: user.client_id, username: user.username });
  return res.status(200).json({ token, clientId: user.client_id, username: user.username });
}

async function handleAdminLogin(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "password required" });
  if (password !== process.env.SUPER_ADMIN_PASSWORD) return res.status(401).json({ error: "Invalid password" });
  const token = sign({ role: "admin" });
  return res.status(200).json({ token });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const parts = new URL(req.url, "http://x").pathname.split("/").filter(Boolean);
  const action = parts[2];

  if (action === "login") return handleLogin(req, res);
  if (action === "admin") return handleAdminLogin(req, res);

  return res.status(404).json({ error: "Unknown auth action" });
};
