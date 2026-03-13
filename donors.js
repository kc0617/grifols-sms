// ─────────────────────────────────────────────────────────────────────────────
// donors.js
// Mock donor database — replace with real database queries when going live.
// Donors are looked up by their phone number (the number they SMS from).
// ─────────────────────────────────────────────────────────────────────────────

const DONORS = {
  "+13212710684": {
    id: "GRF-10001",
    name: "Katherine Collazo",
    firstName: "Katherine",
    status: "active", // "active" | "deferred"
    centerId: 1,
    donationHistory: [
      { date: "2026-03-11", time: "5:00 PM", dayOfWeek: 3 },
      { date: "2026-03-09", time: "5:00 PM", dayOfWeek: 1 },
      { date: "2026-03-04", time: "5:00 PM", dayOfWeek: 3 },
      { date: "2026-03-02", time: "5:00 PM", dayOfWeek: 1 },
      { date: "2026-02-25", time: "5:00 PM", dayOfWeek: 3 },
      { date: "2026-02-23", time: "5:00 PM", dayOfWeek: 1 },
      { date: "2026-02-18", time: "5:00 PM", dayOfWeek: 3 },
      { date: "2026-02-16", time: "5:00 PM", dayOfWeek: 1 },
      { date: "2026-02-11", time: "5:00 PM", dayOfWeek: 3 },
      { date: "2026-02-09", time: "5:00 PM", dayOfWeek: 1 },
      { date: "2026-02-04", time: "5:00 PM", dayOfWeek: 3 },
    ],
  },
};

/**
 * Look up a donor by their phone number.
 * Handles both +13212710684 and 13212710684 formats.
 */
function getDonorByPhone(phoneNumber) {
  // Normalize — ensure it starts with +
  const normalized = phoneNumber.startsWith("+")
    ? phoneNumber
    : "+" + phoneNumber;
  return DONORS[normalized] || null;
}

module.exports = { getDonorByPhone };
