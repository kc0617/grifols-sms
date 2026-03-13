// ─────────────────────────────────────────────────────────────────────────────
// vonage.js
// Handles sending outbound SMS messages via the Vonage Messages API.
// Your Vonage API key, secret, and virtual number are loaded from .env
// ─────────────────────────────────────────────────────────────────────────────

const { Vonage } = require("@vonage/server-sdk");

// Initialize Vonage client using credentials from your .env file
const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
});

const FROM_NUMBER = process.env.VONAGE_FROM_NUMBER; // Your Vonage virtual number

/**
 * Send an SMS message to a donor.
 *
 * @param {string} toNumber - Donor's phone number in E.164 format (e.g. "+14235551234")
 * @param {string} message  - The text message to send
 * @returns {Promise<void>}
 */
async function sendSMS(toNumber, message) {
  try {
    await vonage.sms.send({
      to: toNumber,
      from: FROM_NUMBER,
      text: message,
    });
    console.log(`[Vonage] SMS sent to ${toNumber}`);
  } catch (error) {
    console.error(`[Vonage] Failed to send SMS to ${toNumber}:`, error.message);
    throw error;
  }
}

module.exports = { sendSMS };
