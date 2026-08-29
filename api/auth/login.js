const bcrypt = require("bcryptjs");
const { sign } = require("../../lib/auth");
const { get, patch } = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username and password required" });

  const { data } = await get(`client_users?username=eq.${encodeURIComponent(username)}&select=*`);
  const user = Array.isArray(data) ? data[0] : null;
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  // Update last_login
  await patch(`client_users?id=eq.${user.id}`, { last_login: new Date().toISOString() });

  const token = sign({ role: "client", clientId: user.client_id, username: user.username });
  return res.status(200).json({ token, clientId: user.client_id, username: user.username });
};
