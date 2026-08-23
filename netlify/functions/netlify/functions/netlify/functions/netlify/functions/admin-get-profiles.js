const { createClient } = require("@libsql/client");
function getDb() {
  return createClient({ url: process.env.TURSO_URL, authToken: process.env.TURSO_AUTH_TOKEN });
}
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Content-Type": "application/json" };
function ok(data) { return { statusCode: 200, headers: CORS, body: JSON.stringify(data) }; }
function err(msg, code) { return { statusCode: code || 400, headers: CORS, body: JSON.stringify({ error: msg }) }; }
function preflight() { return { statusCode: 200, headers: CORS, body: "" }; }

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return preflight();
  if (event.headers["x-admin-key"] !== process.env.ADMIN_KEY) return err("Unauthorised", 401);
  try {
    const db = getDb();
    const result = await db.execute("SELECT * FROM profiles ORDER BY CASE status WHEN 'pending_review' THEN 1 WHEN 'active' THEN 2 WHEN 'rejected' THEN 3 ELSE 4 END, upload_date DESC");
    const profiles = result.rows.map(r => ({ id: r.id, firstName: r.first_name, role: r.role, category: r.category, yearsExp: r.years_exp, about: r.about, skills: JSON.parse(r.skills||"[]"), education: r.education, availability: r.availability, email: r.email, phone: r.phone, hasCv: r.has_cv===1, hasCriminalRecord: r.has_clearance===1, criminalClearanceDate: r.clearance_date, cvUrl: r.cv_url, clearanceUrl: r.clearance_url, photoDataUrl: r.photo_url, status: r.status, uploadDate: r.upload_date, expiryDate: r.expiry_date, verified: r.verified===1, rejectionReason: r.rejection_reason, price: r.price, monthlyFee: r.monthly_fee }));
    return ok({ profiles, count: profiles.length });
  } catch(e) { return err("Failed: "+e.message, 500); }
};
