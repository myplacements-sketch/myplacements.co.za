const { createClient } = require("@libsql/client");
function getDb() {
  return createClient({ url: process.env.TURSO_URL, authToken: process.env.TURSO_AUTH_TOKEN });
}
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Content-Type": "application/json" };
function ok(data) { return { statusCode: 200, headers: CORS, body: JSON.stringify(data) }; }
function err(msg, code) { return { statusCode: code || 400, headers: CORS, body: JSON.stringify({ error: msg }) }; }
function preflight() { return { statusCode: 200, headers: CORS, body: "" }; }
async function telegram(msg) {
  try {
    const t = process.env.TELEGRAM_BOT_TOKEN, c = process.env.TELEGRAM_CHAT_ID;
    if (!t || !c) return;
    await fetch("https://api.telegram.org/bot" + t + "/sendMessage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: c, text: msg, parse_mode: "Markdown" })
    });
  } catch(e) { console.error("Telegram:", e.message); }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return preflight();
  if (event.httpMethod !== "POST") return err("Method not allowed", 405);
  try {
    const db = getDb();
    const d = JSON.parse(event.body);
    if (!d.firstName || !d.email || !d.category) return err("Missing required fields");
    const id = "p-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    const now = new Date().toISOString();
    const expiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    await db.execute({
      sql: "INSERT INTO profiles (id, first_name, role, category, years_exp, about, skills, education, availability, email, phone, has_cv, has_clearance, clearance_date, cv_url, clearance_url, photo_url, consent_no_guarantee, consent_popia, consent_date, status, upload_date, expiry_date, next_billing_date, price, monthly_fee, verified) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending_review',?,?,?,99,20,0)",
      args: [id, d.firstName, d.category, d.category, d.yearsExp||0, d.about||"", JSON.stringify(d.skills||[]), d.education||"", d.availability||"Immediately", d.email, d.phone||"", d.hasCv?1:0, d.hasClearance?1:0, d.clearanceDate||null, d.cvUrl||null, d.clearanceUrl||null, d.photoUrl||null, d.consentNoGuarantee?1:0, d.consentPopia?1:0, now, now, expiry, new Date(Date.now()+30*24*60*60*1000).toISOString()]
    });
    await db.execute({ sql: "INSERT INTO admin_log (action, profile_id, note, created_at) VALUES ('new_registration',?,?,?)", args: [id, "New: "+d.firstName+" ("+d.category+")", now] });
    await telegram("🆕 *New Registration*\n\n👤 "+d.firstName+"\n💼 "+d.category+"\n📧 "+d.email+"\n📱 "+(d.phone||"N/A")+"\n📄 CV: "+(d.cvUrl?"✅":"❌")+"\n🔍 Clearance: "+(d.clearanceUrl?"✅":"❌")+"\n\n👉 Log in to admin panel to review.");
    return ok({ success: true, profileId: id, message: "Profile saved. Pending review.", expiryDate: expiry });
  } catch(e) { return err("Failed: "+e.message, 500); }
};
