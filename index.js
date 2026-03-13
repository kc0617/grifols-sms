// ─────────────────────────────────────────────────────────────────────────────
// index.js
// Main server — receives inbound SMS from Vonage and drives the
// appointment scheduling conversation.
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
// Vonage may send GET or POST — we handle both.

async function handleInbound(req, res) {
  res.status(200).end();

  const params = Object.assign({}, req.query, req.body);

  const from = params.msisdn || params.from;
  const rawText = params.text || "";
  const text = rawText.trim().toLowerCase();

  console.log(`[Inbound] Raw params:`, JSON.stringify(params));

  if (!from) {
    console.warn("[Inbound] Received message with no sender number — skipping.");
    return;
  }

  console.log(`[Inbound] SMS from ${from}: "${rawText}"`);

  const session = getSession(from);

  if (STOP_KEYWORDS.includes(text)) {
    updateSession(from, { optedOut: true, step: "opted_out" });
    await sendSMS(
      from,
      "You have been unsubscribed and will no longer receive SMS messages from Grifols Chattanooga Plasma Center. If this was a mistake, please call us at (423) 855-1085."
    );
    return;
  }

  if (session.optedOut) {
    console.log(`[Inbound] ${from} is opted out — no response sent.`);
    return;
  }

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
}

app.get("/inbound", handleInbound);
app.post("/inbound", handleInbound);

// ─── Conversation Handlers ────────────────────────────────────────────────────

async function handleIdle(phone, text, session) {
  const donor = getDonorByPhone(phone);

  if (!donor) {
    await sendSMS(
      phone,
      `Hi! This is Jessi at the Grifols Chattanooga Plasma Center.\n\nWe weren't able to find your number in our system. Please call us at (423) 855-1085 and we'll get you set up. Thank you! 🩸\n\n${OPT_OUT_NOTICE}`
    );
    return;
  }

  const center = getCenterById(donor.centerId);

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

  const suggested = getSuggestedAppointment(donor);
  updateSession(phone, { step: "suggest", suggested, donorId: donor.id });

  await sendSMS(
    phone,
    `Hi ${donor.firstName}! 👋 This is Jessi at the Grifols Chattanooga Plasma Center — thank you for being a valued donor!\n\nBased on your donation history, we suggest your next appointment on:\n📅 ${formatDate(suggested.date)}\n⏰ ${suggested.time}\n📍 ${center.address}\n\nReply YES to confirm, or NO to choose a different date.\n\n${OPT_OUT_NOTICE}`
  );
}

async function handleSuggest(phone, text, session) {
  const donor = getDonorByPhone(phone);
  const center = getCenterById(donor.centerId);
  const { suggested } = session;

  if (["yes", "y", "confirm", "ok", "sure"].includes(text)) {
    updateSession(phone, { step: "done", booking: { date: suggested.date, time: suggested.time } });

    await sendSMS(
      phone,
      `✅ Perfect, ${donor.firstName}! Your appointment is confirmed:\n\n📅 ${formatDate(suggested.date)}\n⏰ ${suggested.time}\n📍 ${center.name}\n📞 ${center.phone}\n\nWe'll see you then! Thank you for saving lives. 🩸\n— Jessi\n\n${OPT_OUT_NOTICE}`
    );

  } else if (["no", "n", "different", "change"].includes(text)) {
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
    await sendSMS(
      phone,
      `Please reply YES to confirm your appointment on ${formatDate(suggested.date)} at ${suggested.time}, or NO to choose a different date.`
    );
  }
}

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
  console.log(`   Vonage webhook URL: GET or POST /inbound`);
});
