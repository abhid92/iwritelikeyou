const jwt = require("jsonwebtoken");
const secret = () => process.env.JWT_SECRET;

const sign   = (payload) => jwt.sign(payload, secret(), { expiresIn: "7d" });
const verify = (token)   => { try { return jwt.verify(token, secret()); } catch { return null; } };
const token  = (req)     => (req.headers.authorization || "").replace(/^Bearer /, "") || null;

function requireClient(req, res) {
  const p = verify(token(req));
  if (!p || p.role !== "client") { res.status(401).json({ error: "Unauthorized" }); return null; }
  return p;
}

function requireAdmin(req, res) {
  const p = verify(token(req));
  if (!p || p.role !== "admin") { res.status(401).json({ error: "Unauthorized" }); return null; }
  return p;
}

module.exports = { sign, verify, token, requireClient, requireAdmin };
