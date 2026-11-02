// node --test tests/   (Node ≥ 23 strips TypeScript types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyMemory, evaluateProximity, PROXIMITY_RULES } from "../src/lib/proximity.ts";
import { haversineM, cumulative, projectOnLine } from "../src/lib/geo.ts";

type LL = [number, number];
const townHall: LL = [79.8540906, 6.9388726];
const mosque: LL = [79.8516789, 6.9384059];
const stops = [
  { id: "a", coord: townHall, radiusM: 40 },
  { id: "b", coord: mosque, radiusM: 40 },
];
const none = new Set<string>();
const near = (p: LL, metresEast: number): LL => [p[0] + metresEast / (111320 * Math.cos((p[1] * Math.PI) / 180)), p[1]];

test("fires once when entering a stop radius", () => {
  const r1 = evaluateProximity(stops, near(townHall, 10), 8, emptyMemory(), 1_000_000, none, haversineM);
  assert.equal(r1.hit?.id, "a");
  const r2 = evaluateProximity(stops, near(townHall, 5), 8, r1.memory, 1_000_000 + 120_000, none, haversineM);
  assert.equal(r2.hit, null, "no repeat while still at the stop");
});

test("ignores poor GPS accuracy", () => {
  const r = evaluateProximity(stops, townHall, PROXIMITY_RULES.maxAccuracyM + 1, emptyMemory(), 0, none, haversineM);
  assert.equal(r.hit, null);
});

test("global cooldown delays the next stop", () => {
  const t0 = 1_000_000;
  const r1 = evaluateProximity(stops, townHall, 5, emptyMemory(), t0, none, haversineM);
  const r2 = evaluateProximity(stops, mosque, 5, r1.memory, t0 + 10_000, none, haversineM);
  assert.equal(r2.hit, null);
  const r3 = evaluateProximity(stops, mosque, 5, r2.memory, t0 + PROXIMITY_RULES.globalCooldownMs, none, haversineM);
  assert.equal(r3.hit?.id, "b");
});

test("re-arms only after leaving and waiting", () => {
  const t0 = 1_000_000;
  const r1 = evaluateProximity(stops, townHall, 5, emptyMemory(), t0, none, haversineM);
  const away = evaluateProximity(stops, near(townHall, 400), 5, r1.memory, t0 + 60_000, none, haversineM);
  const back = evaluateProximity(stops, townHall, 5, away.memory, t0 + PROXIMITY_RULES.restopCooldownMs + 1, none, haversineM);
  assert.equal(back.hit?.id, "a");
});

test("visited stops are skipped", () => {
  const r = evaluateProximity(stops, townHall, 5, emptyMemory(), 0, new Set(["a"]), haversineM);
  assert.equal(r.hit, null);
});

test("projection along the KML route start", () => {
  const line: LL[] = [[79.85405, 6.93898], [79.85364, 6.93884], [79.85355, 6.9388]];
  const cum = cumulative(line);
  const p = projectOnLine(line, cum, [79.85364, 6.93890]);
  assert.ok(Math.abs(p.alongM - cum[1]) < 3, `along ${p.alongM} vs ${cum[1]}`);
  assert.ok(p.distM > 5 && p.distM < 8);
});
