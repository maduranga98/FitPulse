#!/usr/bin/env node
// Regression test for command ordering (see queueOrder.js).
// Reproduces the real backlog from the field: a relay started after staff
// had clicked several times, where document-ID order ends on "unblock"
// but the member was last set to blocked.

const assert = require("assert");
const { orderCommandChanges, historyClearedByUnblock } = require("./queueOrder");

const change = (id, type, createdAtMs) => ({
  type: "added",
  doc: {
    id,
    data: () => ({ type, createdAt: { toMillis: () => createdAtMs } }),
  },
});

// Ids as Firestore sorts them (uppercase before lowercase), issued order
// deliberately different: the LAST thing staff pressed was "block".
const backlog = [
  change("Dojd01VAzC3ucXKBGvVn", "unblock", 1000),
  change("QKEQpMwIUa4WOWR5yucC", "block", 3000),
  change("zXNYOrkVrxwERzQudyl2", "unblock", 2000),
  change("p9cPC1cRd6lqAbpZXcbX", "block", 4000),
];

let failures = 0;
const check = (label, fn) => {
  try {
    fn();
    console.log(`  ok  ${label}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${label}: ${err.message}`);
  }
};

const ordered = orderCommandChanges(backlog);

check("commands run in the order they were issued", () =>
  assert.deepStrictEqual(
    ordered.map((c) => c.doc.data().type),
    ["unblock", "unblock", "block", "block"]
  )
);

check("the last command issued is applied last (door ends blocked)", () =>
  assert.strictEqual(ordered[ordered.length - 1].doc.data().type, "block")
);

check("document-ID order (the old behaviour) would end on the wrong state", () => {
  const byId = [...backlog].sort((a, b) => (a.doc.id < b.doc.id ? -1 : 1));
  assert.strictEqual(byId[byId.length - 1].doc.data().type, "unblock");
});

check("input array is not mutated", () =>
  assert.strictEqual(backlog[0].doc.id, "Dojd01VAzC3ucXKBGvVn")
);

check("a missing createdAt does not throw", () =>
  assert.strictEqual(
    orderCommandChanges([
      { doc: { id: "x", data: () => ({ type: "block" }) } },
      change("y", "unblock", 5),
    ]).length,
    2
  )
);


// ── Clearing a member's history once they are unblocked ────────────
const history = [
  { id: "b1", status: "completed", createdAtMs: 1000 },
  { id: "u1", status: "failed", createdAtMs: 1500 },
  { id: "s1", status: "superseded", createdAtMs: 1800 },
  { id: "u2", status: "completed", createdAtMs: 2000 }, // the unblock itself
  { id: "b2", status: "pending", createdAtMs: 3000 }, // blocked again since
  { id: "b3", status: "completed", createdAtMs: 4000 },
];

check("settled history up to the unblock is cleared, the unblock included", () =>
  assert.deepStrictEqual(historyClearedByUnblock(history, 2000), ["b1", "u1", "s1", "u2"])
);

check("commands issued after the unblock are kept", () => {
  const cleared = historyClearedByUnblock(history, 2000);
  assert.ok(!cleared.includes("b2") && !cleared.includes("b3"));
});

check("a live (pending/processing) command is never cleared", () =>
  assert.deepStrictEqual(
    historyClearedByUnblock(
      [
        { id: "p", status: "pending", createdAtMs: 1 },
        { id: "q", status: "processing", createdAtMs: 1 },
      ],
      2000
    ),
    []
  )
);

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
