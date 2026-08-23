const { createClient } = require("@libsql/client");
const crypto = require("crypto");
function getDb() {
  return createClient({ url: process.env.TURSO_URL, authToken: process.env.TURSO_AUTH_TOKEN });
}
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Content-Type": "application/json" };
function ok(data) { return { statusCode: 200, headers: CORS, body: JSON.stringify(data) }; }
function err(msg, code) { return { statusCode: code || 400, headers: CORS, body: JSON.stringify({ error: msg }) }; }
function preflight() { return { statusCode: 200, headers: CORS, body: "" }; }
function hash(p) { return crypto.createHash("sha256").update(p+"mp_salt_2013").digest("hex"); }

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return preflight();
  if (event.httpMethod !== "POST") return err("Method not allowed", 405);
  try {
    const db = getDb();
    const d = JSON.parse(event.body);
    if (d.action === "register") {
      if (!d.email || !d.password || !d.companyName || !d.contactPerson) return err("Missing fields");
      const ex = await db.execute({ sql: "SELECT id FROM employers WHERE email=?", args: [d.email] });
      if (ex.rows.length > 0) return err("Account already exists");
      const id = "er-"+Date.now();
      await db.execute({ sql: "INSERT INTO employers (id,company_name,contact_person,email,phone,industry,password_hash,created_at) VALUES (?,?,?,?,?,?,?,?)", args: [id,d.companyName,d.contactPerson,d.email,d.phone||"",d.industry||"",hash(d.password),new Date().toISOString()] });
      return ok({ success: true, employer: { id, companyName: d.companyName, contactPerson: d.contactPerson, email: d.email } });
    } else {
      if (!d.email || !d.password) return err("Email and password required");
      const r = await db.execute({ sql: "SELECT id,company_name,contact_person,email,phone FROM employers WHERE email=? AND password_hash=?", args: [d.email, hash(d.password)] });
      if (r.rows.length === 0) return err("Incorrect email or password");
      const row = r.rows[0];
      return ok({ success: true, employer: { id: row.id, companyName: row.company_name, contactPerson: row.contact_person, email: row.email, phone: row.phone } });
    }
  } catch(e) { return err("Failed: "+e.message, 500); }
};
