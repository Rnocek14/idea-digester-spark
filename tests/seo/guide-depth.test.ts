import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Content-reversion guard.
 *
 * Two writers share this repository: these sessions push through git, and the
 * Lovable platform writes its own commits. Mid-session container rollbacks have
 * already produced one convincing false alarm in which all nineteen deepened
 * guides appeared to have been reverted to their thin pre-audit versions — that
 * time it was an illusion, but the failure mode itself is real: a stale write
 * from either side could silently replace months of editorial depth, and no
 * typecheck or build would notice, because a 200-word guide compiles exactly as
 * well as a 2,500-word one.
 *
 * This test measures the visible prose of every deepened guide (JSX text nodes
 * — the same signal a reader gets) and fails if any drops below a floor set at
 * roughly 60% of its audited depth. Ordinary editing never moves a page that
 * far; replacement with a pre-audit version always does.
 *
 * If a floor fires on an INTENTIONAL cut, lower the number here in the same
 * commit — that is the whole ceremony, and it exists so a big cut is a decision
 * someone states rather than a diff nobody read.
 */

// Floors ≈ 60% of the 2026-08-03 measured depth, rounded down to a friendly
// number. Measured values on that date are in the right-hand comments.
const FLOORS: Record<string, number> = {
  LakeGenevaPublicAccess: 1500, // 2546
  WinterLakeGeneva: 1300, //       2183
  WhereToStayLakeGeneva: 1250, //  2102
  SummerLakeGeneva: 1200, //       2056
  WhyPeopleLoveLakeGeneva: 1150, // 1928
  ThingsToDoLakeGeneva: 1000, //   1670
  LakeGenevaShorePath: 950, //     1604
  StreblowBoats: 890, //           1486
  CostOfLivingLakeGeneva: 870, //  1451
  MovingToLakeGeneva: 850, //      1419
  FontanaVsLakeGeneva: 800, //     1358
  ThisWeekendLakeGeneva: 780, //   1315
  LakeGenevaVsWilliamsBay: 700, // 1194
  YerkesObservatory: 680, //       1137
  LakeGenevaSchools: 660, //       1115
  LakeGenevaNeighborhoods: 630, // 1057
  BigFootBeach: 550, //            922
  LakeGenevaFAQ: 530, //           897
  LakeGenevaWithKids: 450, //      758
};

function visibleWords(path: string): number {
  const src = readFileSync(path, "utf8");
  const text = [...src.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]).join(" ");
  return text
    .replace(/\s+/g, " ")
    .split(" ")
    .filter((w) => /[a-zA-Z]/.test(w) && w.length > 1).length;
}

test("no deepened guide has silently shrunk below its audited depth", () => {
  const failures: string[] = [];
  for (const [name, floor] of Object.entries(FLOORS)) {
    const words = visibleWords(`src/pages/guides/${name}.tsx`);
    if (words < floor) failures.push(`${name}: ${words} words (floor ${floor})`);
  }
  assert.deepEqual(
    failures,
    [],
    `Guide content shrank below its audited floor:\n  ${failures.join("\n  ")}\n` +
      `If the cut is intentional, lower the floor in tests/seo/guide-depth.test.ts ` +
      `in the same commit. If it is not, a stale write has reverted editorial ` +
      `content — restore the guide from git history before merging.`,
  );
});

test("every guarded guide file still exists", () => {
  for (const name of Object.keys(FLOORS)) {
    assert.doesNotThrow(
      () => readFileSync(`src/pages/guides/${name}.tsx`),
      `${name}.tsx is missing — a deepened guide was deleted`,
    );
  }
});
