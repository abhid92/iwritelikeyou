const { createCipheriv, createDecipheriv, randomBytes } = require("crypto");
const key = () => Buffer.from(process.env.ENCRYPTION_KEY || "0".repeat(64), "hex");

function encrypt(text) {
  const iv  = randomBytes(12);
  const c   = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decrypt(data) {
  const buf = Buffer.from(data, "base64");
  const iv  = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const d   = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

module.exports = { encrypt, decrypt };
