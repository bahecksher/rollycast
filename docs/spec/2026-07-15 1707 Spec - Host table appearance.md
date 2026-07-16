# Spec - Host table appearance
_Created: 2026-07-15 1707_
_Extends: docs/spec/Initial Spec.md_

This is the current product direction. Everything in the initial spec remains in force except where this
document adds or narrows behavior.

## Product addition

The player who creates a room can customize the shared rolling area for everyone in that room. Appearance
is room state: it persists for the life of the room, is included in late-join snapshots, and updates live for
connected players.

The host can set:

- Table surface color
- Table rim color
- Scene background color
- An optional background image on the table surface

The initial colors remain the default when the host has not customized the room. Removing an image restores
the selected surface color.

## Host experience

A clearly labelled **Table appearance** control is available only to the host. It opens a compact panel that
previews the selected colors and image, supports restoring the default palette, and applies changes with one
explicit save action.

Background images are selected from the host's device. The initial implementation accepts PNG, JPEG, and
WebP raster images up to 10 MB. Before upload, the browser resizes and converts the image to a compact JPEG
data URL that fits within the WebSocket message limit. SVG and animated formats are not accepted.

## Authority and synchronization

- Appearance changes use `UPDATE_ROOM_SETTINGS` and require the private host token.
- The server validates every color and image value, persists the complete appearance settings, increments
  room state, and broadcasts `ROOM_SETTINGS_UPDATED`.
- Non-host clients cannot alter appearance, even if they construct the message directly.
- A late joiner receives the active appearance in `ROOM_STATE`.
- Existing rooms whose stored settings predate this feature receive the default appearance.

## Shared model

```ts
interface RoomAppearance {
  surfaceColor: string; // six-digit #RRGGBB
  rimColor: string; // six-digit #RRGGBB
  backgroundColor: string; // six-digit #RRGGBB
  backgroundImage: string | null; // validated JPEG/PNG/WebP data URL
}

interface RoomSettings {
  diceHandlingMode: "owner_only" | "shared_rerolls";
  joiningLocked: boolean;
  appearance: RoomAppearance;
}
```

The encoded background image is limited to 48,000 characters so an update remains below the 64 KiB message
limit after envelope overhead.

## Scope boundaries

This slice does not add an image library, image search, remote image URLs, crop/reposition controls, video or
animated backgrounds, per-player themes, or permanent storage beyond the room's existing lifetime.

## Acceptance criteria

- Only the room creator sees the appearance editor and only a valid host token can save changes.
- Surface, rim, and background colors update for every connected client and survive reload/late join.
- A host can choose a supported image, see its preview, save it, and remove it later.
- Invalid colors, unsupported data URLs, oversized payloads, and non-host updates are rejected.
- Dice remain readable and the rolling physics/colliders are unchanged.
