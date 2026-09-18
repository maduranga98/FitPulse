/**
 * Pure rules for reading the door-command queue.
 *
 * Kept free of Firestore so they can be tested directly. The question these
 * answer — "is this command still in flight, or did nobody ever consume it?"
 * — decides whether an overdue member gets blocked on a re-run, so getting
 * it wrong is how a gym ends up believing everyone is settled while unpaid
 * members walk straight in.
 *
 * Background: the terminal is only reachable on the gym's LAN, so the app
 * and the nightly sweep queue commands and an on-prem relay agent executes
 * them. When that relay is not running, commands sit at `pending` forever.
 * Treating those as "already queued" made every later sweep skip the member
 * and report nothing to do — the outage was invisible and self-perpetuating.
 */

/**
 * How long a command may sit unclaimed before it counts as abandoned rather
 * than in-flight. A running relay heartbeats every 30s and drains the queue
 * the moment a command is written, so anything still untouched after this
 * long means nothing is consuming the queue.
 */
export const STALE_COMMAND_MS = 15 * 60 * 1000;

/** Statuses that mean the relay has not finished with a command. */
export const WAITING_STATUSES = ["pending", "processing"];

/** Is this command still waiting on the relay? */
export function isWaiting(command) {
  return WAITING_STATUSES.includes(command?.status);
}

/**
 * Split a member's waiting commands into the ones the relay may still be
 * working on and the ones it clearly never picked up.
 *
 * `commands` is `{ id, status, queuedAt }` objects — `queuedAt` being when
 * the relay claimed it (processingStartedAt) or, failing that, when it was
 * written (createdAt). A command with no timestamp at all was written
 * seconds ago and the server stamp has not landed yet, so it counts as
 * in-flight: never abandon a command on missing data.
 *
 * Returns { active, stale, oldestWaitingAt }.
 *   active — true when at least one command could still be applied
 *   stale  — the abandoned ones, to supersede before re-queueing
 */
export function classifyWaitingCommands(commands, now, staleMs = STALE_COMMAND_MS) {
  const waiting = (commands || []).filter(isWaiting);

  const stale = [];
  let active = false;
  let oldestWaitingAt = null;

  for (const command of waiting) {
    const queuedAt = command.queuedAt || null;

    if (queuedAt && (!oldestWaitingAt || queuedAt < oldestWaitingAt)) {
      oldestWaitingAt = queuedAt;
    }

    if (queuedAt && now - queuedAt.getTime() > staleMs) {
      stale.push(command);
    } else {
      active = true;
    }
  }

  return { active, stale, oldestWaitingAt };
}

/**
 * Is the gym's relay agent alive? Two missed 30s heartbeats, matching
 * RELAY_STALE_MS in the app so both sides agree on "offline".
 */
export const RELAY_STALE_MS = 90000;

export function isRelayOnline(lastSeenAt, now) {
  if (!lastSeenAt) return false;
  return now - lastSeenAt.getTime() < RELAY_STALE_MS;
}
