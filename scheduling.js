// ─────────────────────────────────────────────────────────────────────────────
// scheduling.js
// All donation eligibility and appointment suggestion logic.
//
// Rules:
//   - Minimum 1 day gap between donations
//   - Maximum 2 donations per 7-day period
//   - Center is closed on Sundays
// ─────────────────────────────────────────────────────────────────────────────

const { getSlotsForDate } = require("./centers");

const FULL_DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/**
 * Get the most recent donation date for a donor.
 */
function getLastDonationDate(donor) {
  if (!donor.donationHistory || donor.donationHistory.length === 0) return null;
  return new Date(donor.donationHistory[0].date + "T12:00:00");
}

/**
 * Calculate the earliest date a donor is eligible to donate again.
 * - Must be at least 1 day after their last donation
 * - Must not be a Sunday (center closed)
 */
function getNextEligibleDate(donor) {
  const last = getLastDonationDate(donor);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!last) return today;

  const next = new Date(last);
  next.setDate(last.getDate() + 1); // 1 day minimum gap

  // Skip Sundays
  while (next.getDay() === 0) next.setDate(next.getDate() + 1);

  return next < today ? today : next;
}

/**
 * Analyze a donor's history to find their most frequent donation day and time.
 */
function getUsualPattern(donor) {
  const dayFreq = {};
  const timeFreq = {};

  donor.donationHistory.forEach(({ dayOfWeek, time }) => {
    // Exclude Sunday (0) — center is closed
    if (dayOfWeek !== 0) {
      dayFreq[dayOfWeek] = (dayFreq[dayOfWeek] || 0) + 1;
    }
    timeFreq[time] = (timeFreq[time] || 0) + 1;
  });

  const usualDay = parseInt(
    Object.entries(dayFreq).sort((a, b) => b[1] - a[1])[0][0]
  );
  const usualTime = Object.entries(timeFreq).sort((a, b) => b[1] - a[1])[0][0];

  return { usualDay, usualTime };
}

/**
 * Check how many times a donor has donated within the 7-day window
 * that contains the given date.
 */
function getDonationsInWeek(donor, date) {
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay()); // Sunday start
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return donor.donationHistory.filter(({ date: d }) => {
    const dd = new Date(d + "T12:00:00");
    return dd >= weekStart && dd <= weekEnd;
  }).length;
}

/**
 * Suggest the best next appointment for a donor based on their history.
 * Finds the next occurrence of their usual day of the week on or after
 * their eligibility date, respecting the 2-per-week cap.
 *
 * @param {object} donor
 * @returns {{ date: Date, time: string, dayName: string }}
 */
function getSuggestedAppointment(donor) {
  const eligible = getNextEligibleDate(donor);
  const { usualDay, usualTime } = getUsualPattern(donor);

  // Walk forward from eligible date to find next occurrence of their usual day
  const suggested = new Date(eligible);
  let attempts = 0;
  while (suggested.getDay() !== usualDay && attempts < 14) {
    suggested.setDate(suggested.getDate() + 1);
    if (suggested.getDay() === 0) suggested.setDate(suggested.getDate() + 1);
    attempts++;
  }

  // If they've already donated twice this week, push to the following week
  if (getDonationsInWeek(donor, suggested) >= 2) {
    suggested.setDate(suggested.getDate() + 7);
    if (suggested.getDay() === 0) suggested.setDate(suggested.getDate() + 1);
  }

  // Match their usual time to an available slot, fall back to first slot
  const slots = getSlotsForDate(donor.centerId, suggested);
  const time = slots.includes(usualTime) ? usualTime : slots[0];

  return {
    date: suggested,
    time,
    dayName: FULL_DAY_NAMES[suggested.getDay()],
  };
}

/**
 * Generate 4 alternate available dates starting after the suggested date.
 * Skips Sundays automatically.
 *
 * @param {object} donor
 * @param {Date} suggestedDate
 * @returns {Date[]}
 */
function getAlternateDates(donor, suggestedDate) {
  const eligible = getNextEligibleDate(donor);
  const alts = [];
  let offset = 1;

  while (alts.length < 4) {
    const d = new Date(suggestedDate);
    d.setDate(d.getDate() + offset);
    if (d.getDay() !== 0 && d >= eligible) {
      alts.push(new Date(d));
    }
    offset++;
  }

  return alts;
}

/**
 * Format a Date object into a human-friendly string.
 * e.g. "Tuesday, March 17"
 */
function formatDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

module.exports = {
  getSuggestedAppointment,
  getAlternateDates,
  getSlotsForDate,
  formatDate,
};
