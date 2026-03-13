// ─────────────────────────────────────────────────────────────────────────────
// centers.js
// Plasma center information and available appointment slots.
// Add more centers here as the trial expands.
// ─────────────────────────────────────────────────────────────────────────────

const CENTERS = {
  1: {
    id: 1,
    name: "Grifols Chattanooga Plasma Center",
    address: "5744 Brainerd Rd, Chattanooga, TN 37411",
    phone: "(423) 855-1085",
    agent: "Jessi",
    // Center is closed on Sundays (day 0)
    hours: {
      weekday: "Mon – Fri: 7:00 AM – 6:00 PM",
      saturday: "Sat: 7:00 AM – 4:00 PM",
      sunday: "Closed",
    },
    // Available appointment slots per day type
    slots: {
      // Monday–Friday (days 1–5)
      weekday: [
        "7:00 AM","7:30 AM","8:00 AM","8:30 AM","9:00 AM","9:30 AM",
        "10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM",
        "1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM",
        "4:00 PM","4:30 PM","5:00 PM","5:30 PM",
      ],
      // Saturday (day 6)
      saturday: [
        "7:00 AM","7:30 AM","8:00 AM","8:30 AM","9:00 AM","9:30 AM",
        "10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM",
        "1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM",
      ],
    },
  },
};

/**
 * Get a center by its ID.
 * @param {number} centerId
 * @returns {object|null}
 */
function getCenterById(centerId) {
  return CENTERS[centerId] || null;
}

/**
 * Get available time slots for a center on a specific date.
 * Returns empty array if the center is closed (Sunday).
 * @param {number} centerId
 * @param {Date} date
 * @returns {string[]}
 */
function getSlotsForDate(centerId, date) {
  const center = CENTERS[centerId];
  if (!center) return [];
  const day = date.getDay();
  if (day === 0) return [];           // Sunday — closed
  if (day === 6) return center.slots.saturday;
  return center.slots.weekday;
}

module.exports = { getCenterById, getSlotsForDate };
