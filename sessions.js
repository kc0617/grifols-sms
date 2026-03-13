// ─────────────────────────────────────────────────────────────────────────────
// sessions.js
// Tracks the conversation state for each donor mid-flow.
// Since SMS is stateless, we store each donor's current step in memory.
//
// NOTE: This is an in-memory store — it resets if the server restarts.
// For production, replace with Redis or a database-backed session store.
// ─────────────────────────────────────────────────────────────────────────────

// Map of phone number → session state
const sessions = new Map();

/**
 * Get the current session for a phone number.
 * Returns a default idle session if none exists.
 *
 * @param {string} phone
 * @returns {object} session
 */
function getSession(phone) {
  if (!sessions.has(phone)) {
    sessions.set(phone, {
      step: "idle",         // Current step in the conversation flow
      suggested: null,      // { date, time, dayName } — the suggested appointment
      alternateDates: null, // Array of alternate Date objects
      selectedDate: null,   // Date chosen by donor if they said NO to suggestion
      altSlots: null,       // Time slots for the selected alternate date
      optedOut: false,      // Whether donor has replied STOP
    });
  }
  return sessions.get(phone);
}

/**
 * Update fields on a session.
 *
 * @param {string} phone
 * @param {object} updates - Key/value pairs to merge into session
 */
function updateSession(phone, updates) {
  const session = getSession(phone);
  Object.assign(session, updates);
  sessions.set(phone, session);
}

/**
 * Clear/reset a session back to idle.
 * @param {string} phone
 */
function clearSession(phone) {
  sessions.delete(phone);
}

module.exports = { getSession, updateSession, clearSession };
