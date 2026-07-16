# Plan revision - Host table appearance
_Created: 2026-07-15 1707_
_Revises: docs/plans/2026-07-15 1349 Plan - Shared Dice Table.md_

## What changed

- Insert a host-controlled table-appearance slice before M5.
- Add synchronized surface, rim, and scene colors plus an optional table background image.
- Resume the original M5-M9 sequence after this slice is complete.

## Why

The room creator should be able to establish a shared visual identity for the rolling area. The existing
room-settings protocol, host token, persistent Durable Object state, and 3D table components provide a clean
place to add it without changing dice authority or physics.

## Updated approach

1. Extend `RoomSettings` with a validated `RoomAppearance` and backward-compatible defaults.
2. Authorize, persist, and broadcast appearance updates through `UPDATE_ROOM_SETTINGS`.
3. Add a host-only responsive appearance panel with color inputs, reset, raster upload, preview, removal,
   and explicit save.
4. Resize and encode uploads in the browser as JPEG data URLs no longer than 48,000 characters.
5. Apply the settings to the R3F scene background, table surface, rim, and optional surface texture.
6. Cover authorization, broadcast, late join, validation, and shared schemas; run the full verification suite.

Everything else in the original plan remains unchanged.
