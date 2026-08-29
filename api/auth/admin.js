const { sign } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "password required" });
  if (password !== process.env.SUPER_ADMIN_PASSWORD) return res.status(401).json({ error: "Invalid password" });

  const token = sign({ role: "admin" });
  return res.status(200).json({ token });
};
