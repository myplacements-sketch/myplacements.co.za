const { createClient } = require("@libsql/client");
function getDb() {
  return createClient({ url: process.env.TURSO_URL, authToken: process.env.TURSO_AUTH_TOKEN });
}
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
  if (event.httpMethod !== "POST") return { statusCode: 200, body: "OK" };
  try {
    const db = getDb();
    const data = Object.fromEntries(new URLSearchParams(event.body).entries());
    const { payment_status, m_payment_id, amount_gross, email_address, pf_payment_id } = data;
    if (!m_payment_id) return { statusCode: 200, body: "OK" };
    const now = new Date().toISOString();
    const amount = parseFloat(amount_gross || 0);
    await db.execute({
      sql: "INSERT OR REPLACE INTO payments (id,order_id,type,payer_id,amount,status,payfast_id,created_at,confirmed_at) VALUES (?,?,?,?,?,?,?,?,?)",
      args: ["pay-"+Date.now(), m_payment_id, m_payment_id.startsWith("MP-W-")?"worker":"employer", email_address, amount, payment_status==="COMPLETE"?"confirmed":"failed", pf_payment_id, now, payment_status==="COMPLETE"?now:null]
    });
    if (payment_status === "COMPLETE") {
      await telegram("💰 *Payment Received*\nOrder: "+m_payment_id+"\nAmount: R"+amount+"\nFrom: "+email_address);
      if (!m_payment_id.startsWith("MP-W-")) {
        const parts = m_payment_id.split("-");
        const profileId = parts.slice(2).join("-");
        const empId = parts[1];
        if (profileId && empId) {
          await db.execute({ sql: "INSERT OR IGNORE INTO unlocks (id,employer_id,profile_id,unlocked_at) VALUES (?,?,?,?)", args: ["ul-"+Date.now(), empId, profileId, now] });
        }
      }
    }
    return { statusCode: 200, body: "OK" };
  } catch(e) { return { statusCode: 200, body: "OK" }; }
};
