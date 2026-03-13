// ─────────────────────────────────────────────────────────────────────────────
// index.js
// Main server — receives inbound SMS from Vonage and drives the
// appointment scheduling conversation.
//
// Vonage will POST to /inbound every time a donor texts your number.
// ─────────────────────────────────────────────────────────────────────────────

require("dotenv").config();

const express = require("express");
const app = express();

const { getDonorByPhone } = require("./donors");
const { getCenterById, getSlotsForDate } = require("./centers");
const { getSuggestedAppointment, getAlternateDates, formatDate } = require("./scheduling");
const { sendSMS } = require("./vonage");
const { getSession, updateSession, clearSession } = require("./sessions");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Constants ────────────────────────────────────────────────────────────────

const OPT_OUT_NOTICE = "Reply STOP to cancel all messages. Msg & data rates may apply.";
const STOP_KEYWORDS = ["stop", "stop.", "unsubscribe", "cancel", "quit", "end"];

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.send("Grifols Chattanooga SMS Scheduling Server is running. ✅");
});

// ─── Inbound SMS Webhook ──────────────────────────────────────────────────────
// Vonage sends a POST request here every time a donor texts your number.

app.post("/inbound", async (req, res) => {
  // Acknowledge receipt immediately — Vonage requires a fast 200 response
  res.status(200).end();

  const from = req.body.msisdn || req.body.from;   // Donor's phone number
  const rawText = req.body.text || "";               // Their message
  const text = rawText.trim().toLowerCase();

  if (!from) {
    console.warn("[Inbound] Received message with no sender number — skipping.");
    return;
  }

  console.log(`[Inbound] SMS from ${from}: "${rawText}"`);

  const session = getSession(from);

  // ── Global STOP Handler ────────────────────────────────────────────────────
  // Must be handled before anything else, per carrier compliance rules.
  if (STOP_KEYWORDS.includes(text)) {
    updateSession(from, { optedOut: true, step: "opted_out" });
    await sendSMS(
      from,
      "You have been unsubscribed and will no longer receive SMS messages from Grifols Chattanooga Plasma Center. If this was a mistake, please call us at (423) 855-1085."
    );
    return;
  }

  // ── Block opted-out donors ─────────────────────────────────────────────────
  if (session.optedOut) {
    // Do not respond — donor has opted out
    console.log(`[Inbound] ${from} is opted out — no response sent.`);
    return;
  }

  // ── Route to correct handler based on conversation step ───────────────────
  try {
    switch (session.step) {
      case "idle":
        await handleIdle(from, text, session);
        break;
      case "suggest":
        await handleSuggest(from, text, session);
        break;
      case "alt_date":
        await handleAltDate(from, text, session);
        break;
      case "alt_time":
        await handleAltTime(from, text, session);
        break;
      case "done":
        await handleDone(from, session);
        break;
      default:
        await handleIdle(from, text, session);
    }
  } catch (err) {
    console.error(`[Error] Failed to process message from ${from}:`, err.message);
  }
});

// ─── Conversation Handlers ────────────────────────────────────────────────────

/**
 * STEP: idle
 * The donor has just texted in for the first time (or their session expired).
 * Look them up by phone number and begin the flow.
 */
async function handleIdle(phone, text, session) {
  const donor = getDonorByPhone(phone);

  // Donor not found in system
  if (!donor) {
    await sendSMS(
      phone,
      `Hi! This is Jessi at the Grifols Chattanooga Plasma Center.\n\nWe weren't able to find your number in our system. Please call us at (423) 855-1085 and we'll get you set up. Thank you! 🩸\n\n${OPT_OUT_NOTICE}`
    );
    return;
  }

  const center = getCenterById(donor.centerId);

  // Donor is deferred
  if (donor.status === "deferred") {
    const until = new Date(donor.deferralUntil + "T12:00:00").toLocaleDateString("en-US", {
      month: "long", day: "numeric",
    });
    await sendSMS(
      phone,
      `Hi ${donor.firstName}! This is Jessi at the Grifols Chattanooga Plasma Center. 👋\n\nWe appreciate your dedication to donating with us! Unfortunately your account shows a temporary deferral (${donor.deferralReason}) until ${until}.\n\nYou'll be able to schedule again after that date. Please call us at ${center.phone} with any questions.\n\n${OPT_OUT_NOTICE}`
    );
    return;
  }

  // Active donor — generate suggestion and move to "suggest" step
  const suggested = getSuggestedAppointment(donor);
  updateSession(phone, { step: "suggest", suggested, donorId: donor.id });

  await sendSMS(
    phone,
    `Hi ${donor.firstName}! 👋 This is Jessi at the Grifols Chattanooga Plasma Center — thank you for being a valued donor!\n\nBased on your donation history, we suggest your next appointment on:\n📅 ${formatDate(suggested.date)}\n⏰ ${suggested.time}\n📍 ${center.address}\n\nReply YES to confirm, or NO to choose a different date.\n\n${OPT_OUT_NOTICE}`
  );
}

/**
 * STEP: suggest
 * Donor has received a suggested appointment and we're waiting for YES or NO.
 */
async function handleSuggest(phone, text, session) {
  const donor = getDonorByPhone(phone);
  const center = getCenterById(donor.centerId);
  const { suggested } = session;

  if (["yes", "y", "confirm", "ok", "sure"].includes(text)) {
    // Confirmed — book the suggested appointment
    updateSession(phone, { step: "done", booking: { date: suggested.date, time: suggested.time } });

    await sendSMS(
      phone,
      `✅ Perfect, ${donor.firstName}! Your appointment is confirmed:\n\n📅 ${formatDate(suggested.date)}\n⏰ ${suggested.time}\n📍 ${center.name}\n📞 ${center.phone}\n\nWe'll see you then! Thank you for saving lives. 🩸\n— Jessi\n\n${OPT_OUT_NOTICE}`
    );

  } else if (["no", "n", "different", "change"].includes(text)) {
    // Donor wants a different date — generate alternates
    const alternateDates = getAlternateDates(donor, suggested.date);
    updateSession(phone, { step: "alt_date", alternateDates });

    const dateList = alternateDates
      .map((d, i) => `${i + 1}. ${formatDate(d)}`)
      .join("\n");

    await sendSMS(
      phone,
      `No problem! Here are some other available dates at ${center.name}:\n\n${dateList}\n\nReply 1, 2, 3, or 4 to choose a date.`
    );

  } else {
    // Unrecognized reply
    await sendSMS(
      phone,
      `Please reply YES to confirm your appointment on ${formatDate(suggested.date)} at ${suggested.time}, or NO to choose a different date.`
    );
  }
}

/**
 * STEP: alt_date
 * Donor is choosing from a list of alternate dates (1–4).
 */
async function handleAltDate(phone, text, session) {
  const donor = getDonorByPhone(phone);
  const center = getCenterById(donor.centerId);
  const { alternateDates } = session;

  const idx = parseInt(text) - 1;

  if (isNaN(idx) || idx < 0 || idx >= alternateDates.length) {
    await sendSMS(
      phone,
      `Please reply with a number between 1 and ${alternateDates.length} to select a date.`
    );
    return;
  }

  const selectedDate = alternateDates[idx];
  const slots = getSlotsForDate(donor.centerId, selectedDate);
  updateSession(phone, { step: "alt_time", selectedDate, altSlots: slots });

  const slotList = slots.map((s, i) => `${i + 1}. ${s}`).join("\n");

  await sendSMS(
    phone,
    `Great — ${formatDate(selectedDate)}!\n\nAvailable times at ${center.name}:\n\n${slotList}\n\nReply with the number of your preferred time.`
  );
}

/**
 * STEP: alt_time
 * Donor is choosing a time slot from the list.
 */
async function handleAltTime(phone, text, session) {
  const donor = getDonorByPhone(phone);
  const center = getCenterById(donor.centerId);
  const { selectedDate, altSlots } = session;

  const idx = parseInt(text) - 1;

  if (isNaN(idx) || idx < 0 || idx >= altSlots.length) {
    await sendSMS(
      phone,
      `Please reply with a number between 1 and ${altSlots.length} to select a time.`
    );
    return;
  }

  const chosenTime = altSlots[idx];
  updateSession(phone, { step: "done", booking: { date: selectedDate, time: chosenTime } });

  await sendSMS(
    phone,
    `✅ Confirmed, ${donor.firstName}! Here are your appointment details:\n\n📅 ${formatDate(selectedDate)}\n⏰ ${chosenTime}\n📍 ${center.name}\n📞 ${center.phone}\n\nThank you for your donation — you're making a difference! 🩸\n— Jessi\n\n${OPT_OUT_NOTICE}`
  );
}

/**
 * STEP: done
 * Appointment is already booked. Remind donor to call if they need changes.
 */
async function handleDone(phone, session) {
  const donor = getDonorByPhone(phone);
  const center = getCenterById(donor.centerId);
  const { booking } = session;

  await sendSMS(
    phone,
    `Hi ${donor.firstName}! Your appointment is already confirmed for ${formatDate(booking.date)} at ${booking.time}.\n\nTo make any changes, please call us at ${center.phone}. See you soon! 🩸\n— Jessi`
  );
}

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Grifols SMS Scheduling Server running on port ${PORT}`);
  console.log(`   Vonage webhook URL: POST /inbound`);
});
