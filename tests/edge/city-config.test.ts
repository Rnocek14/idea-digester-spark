import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getCityConfig,
  getActiveCityConfigs,
  withinBbox,
  hasLocalKeyword,
  hasNonLocalKeyword,
  LAKE_GENEVA_DEFAULTS,
  __resetCityConfigCacheForTests,
} from "../../supabase/functions/_shared/cityConfig.ts";
import { createMockSupabase, type Resolver } from "./harness.ts";

beforeEach(() => __resetCityConfigCacheForTests());

test("getCityConfig merges a DB row over defaults", async () => {
  const resolver: Resolver = (q) => {
    assert.equal(q.table, "city_config");
    return {
      data: {
        id: "testville-wi",
        city_name: "Testville",
        site_domain: "testville.example",
        bbox: { minLat: 1, maxLat: 2, minLon: 3, maxLon: 4 },
        local_keywords: ["testville", "test county"],
        non_local_keywords: ["bigcity"],
      },
    };
  };
  const { client } = createMockSupabase(resolver);
  const config = await getCityConfig(client);
  assert.equal(config.city_name, "Testville");
  assert.equal(config.site_domain, "testville.example");
  assert.deepEqual(config.bbox, { minLat: 1, maxLat: 2, minLon: 3, maxLon: 4 });
  assert.deepEqual(config.local_keywords, ["testville", "test county"]);
  // Fields absent from the row fall back to defaults
  assert.equal(config.timezone, LAKE_GENEVA_DEFAULTS.timezone);
});

test("getCityConfig falls back to Lake Geneva defaults on error", async () => {
  const { client } = createMockSupabase(() => ({ data: null, error: { message: "relation missing" } }));
  const config = await getCityConfig(client);
  assert.equal(config.city_name, "Lake Geneva");
  assert.equal(config.id, "default");
  assert.ok(config.local_keywords.includes("lake geneva"));
});

test("getCityConfig caches between calls", async () => {
  let queries = 0;
  const { client } = createMockSupabase(() => {
    queries++;
    return { data: { id: "default", city_name: "Cached City" } };
  });
  await getCityConfig(client);
  await getCityConfig(client);
  assert.equal(queries, 1);
});

test("getActiveCityConfigs returns every active city, defaults-merged", async () => {
  const { client } = createMockSupabase((q) => {
    assert.equal(q.table, "city_config");
    assert.ok(q.filters.some((f) => f.m === "eq" && f.args[0] === "status" && f.args[1] === "active"));
    return {
      data: [
        { id: "default", city_name: "Lake Geneva" },
        { id: "delavan-wi", city_name: "Delavan", local_keywords: ["delavan"] },
      ],
    };
  });
  const configs = await getActiveCityConfigs(client);
  assert.equal(configs.length, 2);
  assert.equal(configs[1].city_name, "Delavan");
  assert.deepEqual(configs[1].local_keywords, ["delavan"]);
  // Missing fields fall back to defaults
  assert.equal(configs[1].timezone, LAKE_GENEVA_DEFAULTS.timezone);
});

test("getActiveCityConfigs falls back to [defaults] when the table is empty or errors", async () => {
  const { client: emptyClient } = createMockSupabase(() => ({ data: [] }));
  const empty = await getActiveCityConfigs(emptyClient);
  assert.equal(empty.length, 1);
  assert.equal(empty[0].id, "default");

  const { client: errClient } = createMockSupabase(() => ({ data: null, error: { message: "boom" } }));
  const errd = await getActiveCityConfigs(errClient);
  assert.equal(errd.length, 1);
  assert.equal(errd[0].city_name, "Lake Geneva");
});

test("withinBbox boundary behavior", () => {
  const bbox = { minLat: 42.0, maxLat: 43.0, minLon: -89.0, maxLon: -88.0 };
  assert.equal(withinBbox(bbox, 42.5, -88.5), true);
  assert.equal(withinBbox(bbox, 42.0, -89.0), true); // inclusive edges
  assert.equal(withinBbox(bbox, 41.99, -88.5), false);
  assert.equal(withinBbox(bbox, null, -88.5), false);
  assert.equal(withinBbox(bbox, undefined, undefined), false);
});

test("keyword helpers are case-insensitive", () => {
  const config = { ...LAKE_GENEVA_DEFAULTS };
  assert.equal(hasLocalKeyword(config, "Crash near LAKE GENEVA today"), true);
  assert.equal(hasLocalKeyword(config, "Crash in some other town"), false);
  assert.equal(hasNonLocalKeyword(config, "Fire in Milwaukee overnight"), true);
  assert.equal(hasNonLocalKeyword(config, "Fire on Main Street"), false);
});
