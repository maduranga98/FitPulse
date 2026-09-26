// Ordering for the command queue.
//
// Firestore delivers an initial snapshot (and any multi-doc change) in
// document-ID order, which has nothing to do with when the commands were
// issued. For block/unblock that is a correctness bug, not a cosmetic one:
// the command applied LAST decides the state of the door, so a backlog
// replayed alphabetically can leave a member unblocked when staff last
// pressed Block.

/**
 * Sort docChanges into the order the commands were created.
 * Changes with no createdAt yet (a local write not round-tripped) sort
 * first, matching Firestore's own pending-write semantics.
 */
function orderCommandChanges(changes) {
  return [...changes].sort(
    (a, b) =>
      (a.doc.data().createdAt?.toMillis?.() || 0) -
      (b.doc.data().createdAt?.toMillis?.() || 0)
  );
}

module.exports = { orderCommandChanges };

// Statuses the relay is finished with. A pending/processing command is
// still someone's live intent and must never be cleared.
const SETTLED_STATUSES = new Set(["completed", "failed", "superseded"]);

/**
 * The command ids an unblock makes obsolete for one member.
 *
 * Once a member's door is open again their block/unblock history is noise:
 * left in place the queue grows with every member ever blocked, and the
 * relay, doctor and nightly sweep all wade through it. Everything the relay
 * has settled up to and including the unblock goes; anything issued after
 * it (staff blocked them again) is kept.
 *
 * commands: [{ id, status, createdAtMs }]
 */
function historyClearedByUnblock(commands, unblockCreatedAtMs) {
  return commands
    .filter(
      (c) =>
        SETTLED_STATUSES.has(c.status) &&
        (c.createdAtMs || 0) <= (unblockCreatedAtMs || Infinity)
    )
    .map((c) => c.id);
}

module.exports.historyClearedByUnblock = historyClearedByUnblock;
