/** Shared table dimensions (world units). The die size is ~1 unit. */
export const TABLE = {
  halfX: 5,
  halfZ: 3.6,
  wallHeight: 1.4,
  wallThickness: 0.4,
  /** Height above the table where held dice hover before release (spec §6.2). */
  throwHeight: 2.2,
} as const;
