// Module-level resolved city id, kept in sync by useCityConfig (mounted on
// every page via PageShell/PublicHeader). Query functions call getCityId()
// inside queryFn — no per-component hook threading. When hostname resolution
// lands on a different city than the default, useCityConfig invalidates all
// queries so everything refetches under the correct city.

let resolvedCityId = "default";

export function getCityId(): string {
  return resolvedCityId;
}

export function setResolvedCityId(id: string): void {
  resolvedCityId = id || "default";
}
