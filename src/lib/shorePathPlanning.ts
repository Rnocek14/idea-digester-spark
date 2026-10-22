/** Approximate leg distances from the Williams Bay Recreation Department map. */
export const SHORE_PATH_MAP_URL =
  "https://www.williamsbay.org/DocumentCenter/View/287/Williamsbaygenevalake-Map";

export const SHORE_PATH_LEGS = [
  { from: "Williams Bay", to: "Fontana", miles: 3.5 },
  { from: "Fontana", to: "Shadow Lane", miles: 2.3 },
  { from: "Shadow Lane", to: "Linn Road", miles: 2.9 },
  { from: "Linn Road", to: "Big Foot Beach", miles: 3.3 },
  { from: "Big Foot Beach", to: "Lake Geneva", miles: 2.0 },
  { from: "Lake Geneva", to: "Chapin Road", miles: 3.5 },
  { from: "Chapin Road", to: "Williams Bay", miles: 3.5 },
] as const;

export const SHORE_PATH_MAP_MILES =
  SHORE_PATH_LEGS.reduce((total, leg) => total + leg.miles, 0);