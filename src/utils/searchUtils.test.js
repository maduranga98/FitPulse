#!/usr/bin/env node
// Rules test for the shared search helpers (utils/searchUtils.js).
//
//   node src/utils/searchUtils.test.js
//
// Every search box in the app runs through matchesSearch, so what this file
// asserts is what a user can type and still find their member/exercise.

import assert from "assert";
import { matchesSearch, normalizeText, digitsOnly } from "./searchUtils.js";

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

const member = {
  name: "Kamal Perera",
  email: "Kamal.Perera@Example.COM",
  mobile: "+94 77-123 4567",
  memberCode: "GYM001",
};
const find = (query) =>
  matchesSearch(query, member.name, member.mobile, member.email, member.memberCode);

// ── case never matters ───────────────────────────────────────────────
check("lowercase query matches a capitalised name", () => assert.ok(find("kamal")));
check("uppercase query matches a capitalised name", () => assert.ok(find("KAMAL")));
check("mixed case matches", () => assert.ok(find("KaMaL pErErA")));
check("uppercase query matches a lowercase field", () => assert.ok(find("EXAMPLE.COM")));
check("a member code matches in either case", () => assert.ok(find("gym001")));

// ── typing is forgiving ──────────────────────────────────────────────
check("a partial name matches", () => assert.ok(find("per")));
check("surrounding whitespace is ignored", () => assert.ok(find("  kamal  ")));
check("extra spaces between words are ignored", () => assert.ok(find("kamal    perera")));
check("tokens may be typed out of order", () => assert.ok(find("perera kamal")));
check("an empty query matches everything", () => assert.ok(find("")));
check("accents are ignored both ways", () =>
  assert.ok(matchesSearch("jose", "José Díaz") && matchesSearch("josé", "Jose Diaz"))
);

// ── phone numbers ────────────────────────────────────────────────────
check("a phone matches however it is punctuated", () => assert.ok(find("0771234567")));
check("part of a phone matches", () => assert.ok(find("77123")));

// ── still narrows ────────────────────────────────────────────────────
check("a query that matches nothing is rejected", () => assert.ok(!find("silva")));
check("every token must match", () => assert.ok(!find("kamal silva")));
check("missing fields don't throw or match", () =>
  assert.ok(!matchesSearch("kamal", null, undefined, ""))
);
check("array fields are searched", () =>
  assert.ok(matchesSearch("chest", "Bench Press", ["Chest", "Triceps"]))
);

// ── helpers ──────────────────────────────────────────────────────────
check("normalizeText lowercases, strips accents and collapses spaces", () =>
  assert.strictEqual(normalizeText("  ÀÉÎ  Ôû  "), "aei ou")
);
check("normalizeText handles null", () => assert.strictEqual(normalizeText(null), ""));
check("digitsOnly keeps digits only", () =>
  assert.strictEqual(digitsOnly("+94 77-123 4567"), "94771234567")
);

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
