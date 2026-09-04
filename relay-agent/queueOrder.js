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
