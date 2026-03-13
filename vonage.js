// ─────────────────────────────────────────────────────────────────────────────
// vonage.js
// Sends SMS via Textbelt API.
// ─────────────────────────────────────────────────────────────────────────────

const https = require("https");
const querystring = require("querystring");

async function sendSMS(toNumber, message) {
  return new Promise((resolve) => {
    const params = querystring.stringify({
      phone:   toNumber,
      message: message,
      key:     process.env.TEXTBELT_KEY,
    });

    const options = {
      hostname: "textbelt.com",
      path:     "/text",
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
          if (json.success) {
            console.log(`[Textbelt] SMS sent to ${toNumber}`);
          } else {
            console.error(`[Textbelt] Send failed:`, json.error);
          }
        } catch (e) {
          console.error(`[Textbelt] Parse error:`, e.message);
        }
        resolve();
      });
    });

    req.on("error", (e) => {
      console.error(`[Textbelt] Request error:`, e.message);
      resolve();
    });

    req.write(params);
    req.end();
  });
}

module.exports = { sendSMS };
