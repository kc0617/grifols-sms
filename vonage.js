// ─────────────────────────────────────────────────────────────────────────────
// vonage.js
// Sends SMS via Vonage REST API directly (no SDK dependency).
// ─────────────────────────────────────────────────────────────────────────────

const https = require("https");
const querystring = require("querystring");

const FROM_NUMBER = process.env.VONAGE_FROM_NUMBER;

async function sendSMS(toNumber, message) {
  return new Promise((resolve, reject) => {
    const params = querystring.stringify({
      api_key:    process.env.VONAGE_API_KEY,
      api_secret: process.env.VONAGE_API_SECRET,
      to:         toNumber.replace(/\D/g, ""),
      from:       FROM_NUMBER,
      text:       message,
    });

    const options = {
      hostname: "rest.nexmo.com",
      path:     "/sms/json",
      method:   "POST",
      headers: {
        "Content-Type":   "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(params),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const msg = json.messages && json.messages[0];
          if (msg && msg.status === "0") {
            console.log(`[Vonage] SMS sent to ${toNumber}`);
            resolve();
          } else {
            console.error(`[Vonage] Send failed:`, JSON.stringify(msg));
            resolve(); // Don't crash the server on SMS failure
          }
        } catch (e) {
          console.error(`[Vonage] Parse error:`, e.message);
          resolve();
        }
      });
    });

    req.on("error", (e) => {
      console.error(`[Vonage] Request error:`, e.message);
      resolve(); // Don't crash the server on network error
    });

    req.write(params);
    req.end();
  });
}

module.exports = { sendSMS };
