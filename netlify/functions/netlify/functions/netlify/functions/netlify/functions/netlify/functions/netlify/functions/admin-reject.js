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
  if (event.headers["x-admin-key"] !== process.env.ADMIN_KEY) return err("Unauthorised", 401);
  try {
    const db = getDb();
    const { profileId, reason } = JSON.parse(event.body);
    const now = new Date().toISOString();
    const r = reason || "Documents could not be verified. Please resubmit.";
    await db.execute({ sql: "UPDATE profiles SET status='rejected', verified=0, rejection_reason=? WHERE id=?", args: [r, profileId] });
    await db.execute({ sql: "INSERT INTO admin_log (action,profile_id,note,created_at) VALUES ('rejected',?,?,?)", args: [profileId, "Rejected: "+r, now] });
    await telegram("❌ *Profile Rejected*\nID: "+profileId+"\nReason: "+r);
    return ok({ success: true, message: "Profile rejected." });
  } catch(e) { return err("Failed: "+e.message, 500); }
};
