# Spec

Versioned specs. The most recent file is the source of truth.

Naming: `YYYY-MM-DD HHMM Spec - Subject.md`

When the spec changes meaningfully, create a new file — don't edit existing ones. This preserves the history of what was originally intended vs. what evolved.

# Shared Dice Table

## Product and Technical Specification

**Working title:** Shared Dice Table
**Product type:** Mobile-first multiplayer web application
**Primary use case:** A private group of tabletop role-playing players sharing a virtual dice table through phones and desktop browsers.

---

# 1. Product Summary

Shared Dice Table recreates the communal experience of rolling physical role-playing dice without attempting to become a full virtual tabletop.

A player creates a private room and receives a short room code. Other players visit the website, enter the code, choose a display name and dice color, and join the same virtual table.

Players select dice, pick them up beneath their finger or pointer, and release them onto the table. The dice tumble using visible 3D physics. Everyone in the room sees the roll, the player responsible for it, and the result.

After dice settle, players can inspect and interact with individual dice. By default, players may only pick up and reroll their own dice. A host-controlled room setting may allow players to pick up and reroll other players’ dice.

Players may also keep dice on the table, set them aside, clear them, or send brief visual reactions to a roll.

The application should feel like a shared digital dice tray that can accompany an in-person, video, or voice-based role-playing game.

---

# 2. Product Principles

The application should be:

* Immediate to join
* Easy to understand without instructions
* Designed primarily for phones
* Visually satisfying without becoming graphically demanding
* Social rather than competitive
* Reliable enough that everyone sees the same official result
* Playful without becoming disruptive
* Usable without creating an account
* Focused on dice rather than character sheets, maps, or rules automation

The shared table should remain visually uncluttered. Controls should appear only when needed.

---

# 3. Core User Experience

## 3.1 Create a Room

A user visits the landing page and selects **Create Room**.

The server creates a private room and returns:

* A six-character room code
* A shareable room URL
* A private player session token
* A private host token stored locally

Example:

```text
Room code: K7M4PX
Room URL: /room/K7M4PX
```

The creator then enters:

* Display name
* Preferred dice color

The creator enters the shared table as the room host.

## 3.2 Join a Room

A player visits the landing page and sees:

* Room code field
* Join Room button
* Create Room button

After entering a valid room code, the player chooses:

* Display name
* Dice color

The server assigns:

* Player ID
* Player session token
* Available dice color

The player enters the room without creating an account.

## 3.3 Shared Table

The main room screen contains:

* A mostly empty 3D dice table
* Room code and share control
* Connected player count
* Dice selection button
* Roll history drawer
* Connection status indicator
* Room settings control for the host

Players see dice thrown by every connected player.

---

# 4. MVP Scope

The MVP must include:

1. Private rooms using join codes
2. Player display names
3. Player-specific dice colors
4. Real-time player presence
5. Standard RPG dice
6. Mobile drag-and-release rolling
7. Desktop mouse rolling
8. Visible 3D dice physics
9. Server-authoritative roll results
10. Shared roll animations
11. Roll history
12. Roll inspection
13. Long-press or context-click dice interaction menus
14. Owner-only dice handling by default
15. Optional shared dice rerolling controlled by the host
16. Picking up settled dice and physically rerolling them
17. Keeping or setting aside dice
18. Clearing an individual roll
19. Brief visual roll reactions
20. Reconnection after a temporary network interruption
21. Room expiration
22. Responsive mobile and desktop layouts
23. Automated tests
24. Production deployment configuration

---

# 5. Standard Dice

Support:

* d4
* d6
* d8
* d10
* d12
* d20
* d100, represented by two percentile d10s

Players must be able to roll:

* One die
* Multiple dice of one type
* A mixed pool of dice
* An optional numeric modifier

Examples:

```text
1d20
2d6
4d8 + 3
1d20 + 1d4 + 5
```

MVP limits:

```text
Maximum dice in one roll: 10
Maximum visible dice belonging to one player: 20
Maximum visible dice in one room: 60
Maximum connected players in one room: 12
Modifier range: -999 through 999
```

The server must reject requests exceeding these limits.

---

# 6. Dice Selection and Throwing

## 6.1 Dice Tray

A small persistent dice button appears near the bottom of the screen.

Selecting it opens a compact bottom tray containing:

* Die type buttons
* Current dice pool
* Quantity controls
* Modifier control
* Clear selection
* Pick Up and Roll control

The tray should cover no more than approximately one-third of a phone screen.

## 6.2 Mobile Touch Controls

The preferred mobile interaction is:

1. Open the dice tray.
2. Select one or more dice.
3. Press and hold the assembled dice pool.
4. The selected dice appear above the player’s finger.
5. The dice track the finger across the table.
6. The application samples finger direction and velocity.
7. Releasing the finger throws the dice.

The dice should be offset from the finger by approximately 24 to 40 screen pixels so the player can see them.

A release with little movement should still produce a small valid roll.

## 6.3 Desktop Controls

Desktop users may:

* Click and drag the selected dice, then release
* Use a Pick Up and Roll button to attach the dice to the cursor
* Click or release to throw the dice

Click-drag-release should be the default behavior.

## 6.4 Canceling a Pending Roll

A pending roll may be canceled by:

* Dragging the dice back into the dice tray
* Pressing Escape on desktop
* Using a visible Cancel control while dice are held

Canceled dice must not create a roll result or history entry.

---

# 7. Dice Physics

## 7.1 Physical Behavior

Dice should:

* Spawn slightly above the table
* Respond to release direction and velocity
* Receive randomized angular velocity
* Collide with the table
* Collide with other active dice
* Bounce, tumble, and settle
* Display readable numbered faces
* Remain visible after settling
* Enter a sleeping state when no longer moving

Recommended starting settings:

```text
Physics timestep: 1/60 second
Maximum substeps: 3
Maximum roll duration: 6 seconds
Settled speed duration: 400 milliseconds
Default fade delay: 30 seconds
Fade duration: 1 second
```

Exact values may be adjusted during implementation.

## 7.2 Authoritative Results

The visible physics simulation must not determine the official result.

Instead:

1. The player releases the dice.
2. The client sends the dice pool and throw gesture to the server.
3. The server generates the official results using secure randomness.
4. The server broadcasts the results and approved launch information.
5. Clients simulate or replay the throw.
6. Each die settles.
7. The die smoothly reconciles its final orientation so the official result faces upward.
8. The result is revealed and added to the shared roll history.

The client must never submit a claimed result.

## 7.3 Result Reconciliation

Each die model must contain a mapping between:

* Face value
* Face normal
* Required final orientation

When a die reaches its settled threshold or maximum roll duration:

1. Reduce physical movement.
2. Smoothly rotate the die toward its authoritative face.
3. Complete the adjustment within approximately 200 to 350 milliseconds.
4. Put the rigid body to sleep.

The correction should not visibly teleport the die.

## 7.4 Result Reveal

The server may provide the result to clients when the roll begins, but the interface should not display the result until:

* The dice settle, or
* The maximum roll duration is reached

This preserves the suspense of watching the dice tumble.

---

# 8. Individual Dice Interactions

## 8.1 General Interaction Rules

Interactions target individual dice or individual rolls.

They must:

* Never silently change a completed official result
* Clearly identify the targeted die or roll
* Respect ownership and room permissions
* Work through touch, mouse, and keyboard
* Avoid allowing one player to repeatedly disrupt another player
* Remain secondary to the core rolling experience

Once a server-authoritative result exists:

* That roll history entry remains unchanged
* Physical movement is visual only
* A reroll creates a new linked roll record
* Clearing dice removes them from the table, not from history

---

# 9. Dice Ownership

Every visible die has an owner.

The owner is normally the player whose dice pool created the die.

Ownership controls who may:

* Pick up the die
* Reroll the die
* Keep or release the die
* Move the die
* Clear the die

By default, only the owner may physically handle a settled die.

Inspection and visual reactions are available to everyone.

## 9.1 Shared Dice Handling Toggle

The host may change the room setting:

```text
Dice handling:
1. Owner Only
2. Shared Rerolls
```

### Owner Only

This is the default.

Players may:

* Pick up their own dice
* Reroll their own dice
* Move their own dice
* Keep their own dice
* Clear their own dice

Other players may:

* Inspect dice
* Highlight rolls
* Send reactions

### Shared Rerolls

Players may pick up and reroll another player’s unkept, settled dice.

Shared Rerolls does not allow another player to:

* Clear someone else’s dice
* Mark someone else’s dice as kept
* Release someone else’s kept dice
* Permanently change ownership
* Remove a roll from history

When another player rerolls a die:

* The die retains its original owner
* The new die retains the original owner’s color
* The acting player is recorded as the person who initiated the reroll
* The new roll is linked to the original roll

Example history:

```text
Brett rolled 3d6
[2, 4, 6] = 12

Kayleen rerolled Brett’s 2
[5]
```

Kept dice cannot be picked up by other players, even when Shared Rerolls is enabled.

---

# 10. Dice Interaction Menu

## 10.1 Opening the Menu

A player may open the dice interaction menu through:

### Mobile

* Long press a settled die for approximately 450 milliseconds

### Desktop

* Right-click a settled die
* Long-click a settled die
* Focus the die and press the context-menu keyboard key

A short tap or ordinary click should inspect the die rather than open the full interaction menu.

## 10.2 Interaction Menu Design

The interaction menu should appear near the selected die as either:

* A compact radial menu
* A small floating card
* A bottom sheet on narrow phone screens

It should not obscure the die result.

The menu should include clear icons and text labels. Icons alone are insufficient.

## 10.3 Owner Menu

The owner sees:

* Inspect Roll
* Pick Up and Reroll
* Keep Die or Release Die
* Move Die
* Clear Roll
* React

## 10.4 Other Player Menu

Another player sees:

* Inspect Roll
* React
* Pick Up and Reroll, only when Shared Rerolls is enabled and the die is eligible

## 10.5 Accessibility

Every interaction must also be available through an accessible list of actions.

The radial menu cannot be the only way to interact with a die.

---

# 11. Inspecting Dice and Rolls

Inspecting a die is a core MVP interaction.

A player may tap or click any visible die to inspect the roll that created it.

The application should:

* Highlight the selected die
* Highlight all dice belonging to the same roll
* Dim unrelated dice slightly
* Open a compact inspection panel

The inspection panel displays:

* Player name
* Dice expression
* Individual dice results
* Modifier
* Total
* Time rolled
* Whether the roll was an original roll or reroll
* The source roll, when applicable
* The player who initiated a shared reroll

Example:

```text
Brett rolled 4d6 + 2

Dice: 2, 3, 5, 6
Modifier: +2
Total: 18
```

Selecting an individual result in the inspection panel should briefly highlight the corresponding physical die.

The inspection panel should provide interaction controls based on the current player’s permissions.

Inspection is normally local to the viewing player. It does not need to interrupt or change another player’s screen.

---

# 12. Picking Up and Rerolling Dice

## 12.1 Single-Die Reroll

To reroll a settled die:

1. Open the die interaction menu.
2. Select **Pick Up and Reroll**.
3. The die lifts from the table.
4. The die follows the player’s finger or pointer.
5. The player moves the die across the table.
6. Releasing the finger or pointer throws the die.
7. The server generates a new result.
8. The new roll is linked to the original roll.

The original history entry remains unchanged.

The visible source die is replaced by the newly rolled version after release.

## 12.2 Multiple-Die Reroll

The interaction menu may include **Select More Dice**.

When enabled:

1. The first selected die receives a selection ring.
2. The player taps additional eligible dice from the same roll.
3. Selected dice must share the same owner.
4. The player selects **Pick Up and Reroll Selected**.
5. The dice gather beneath the player’s finger or pointer.
6. Releasing them creates one linked reroll.

MVP maximum:

```text
Maximum dice in one reroll: 10
```

## 12.3 Grab Lock

Only one player may control a die at a time.

When a player begins picking up a die:

1. The client requests a temporary grab lock.
2. The server validates ownership and room permissions.
3. The server grants or denies the lock.
4. The granted player becomes the temporary controller.
5. Other clients see the die being held.

The grab lock should expire automatically after approximately 10 seconds without movement or connection.

## 12.4 Canceling a Grab

A player may cancel by:

* Returning the die to its original position
* Pressing Escape
* Selecting Cancel
* Losing the grab lock before release

The die returns to:

* Its previous position
* Its previous result
* Its previous kept status
* Its previous owner

No reroll history entry is created.

## 12.5 Shared Reroll Attribution

When a player rerolls someone else’s die:

```text
Original owner: Brett
Acting player: Kayleen
Die color: Brett’s selected color
New result ownership: Brett
History attribution: Kayleen rerolled Brett’s die
```

The application should make the distinction clear.

---

# 13. Keeping and Setting Aside Dice

A player may mark one of their dice as **Kept**.

Keeping a die means:

* It remains visible indefinitely
* It does not fade automatically
* It is visually distinguished
* It may be moved to the player’s edge of the table
* It is excluded from ordinary Clear Unkept Dice actions
* Other players cannot pick it up
* Its official result remains unchanged

## 13.1 Keep Interaction

A player may keep a die by:

* Opening the interaction menu and selecting Keep Die
* Using the roll inspection panel
* Using a keyboard-accessible action

Selecting the action again changes it to Release Die.

## 13.2 Visual Treatment

A kept die may receive:

* A subtle ring beneath it
* A small lock or bookmark marker
* A slight raised platform
* A thin outline using the owner’s color

The effect should not obscure the visible face.

## 13.3 Set-Aside Area

Each player may have a subtle set-aside region near their side of the table.

This region should:

* Appear only when the player begins moving or keeping dice
* Avoid permanently dividing the table
* Accept only that player’s dice
* Keep dice arranged without requiring precise placement

Moving a kept die into this region should snap it into a loose row or group.

## 13.4 Released Dice

When a die is released from kept status:

* It becomes eligible for automatic fading
* It becomes eligible for shared rerolls when Shared Rerolls is enabled
* Its fade timer begins after a short delay

---

# 14. Moving Settled Dice

The owner may reposition a settled die without rerolling it.

Moving a die should:

* Keep it close to the table surface
* Preserve its official upward-facing value
* Avoid applying large physical impulses
* Allow gentle collisions with other settled dice
* Return the die to its official orientation after release

Moving and rerolling must feel different.

Recommended distinction:

```text
Move Die:
The die remains close to the table.

Pick Up and Reroll:
The die visibly lifts above the table and enters throwing mode.
```

Other players cannot move someone else’s dice.

---

# 15. Roll Reactions

Any player may send a brief visual reaction to a completed roll.

Reactions are opened through:

* The die interaction menu
* The roll inspection panel
* A small reaction control attached to the roll notification

Possible reaction categories:

* Critical
* Success
* Disaster
* Suspense
* Applause
* Question

The visual interface may represent these categories with emoticon-style icons, symbols, or simple animated marks.

Every icon must have a text label and accessible name.

## 15.1 Reaction Behavior

A reaction should:

* Appear around the selected roll
* Affect all dice belonging to the roll
* Last less than two seconds
* Identify the reacting player when practical
* Avoid moving the dice
* Avoid obscuring results
* Avoid creating a permanent history entry
* Be visible to all connected players

Possible effects include:

* A quick outline pulse
* A small symbol above the dice
* A brief burst around the roll
* A short glow
* A temporary reaction count

## 15.2 Reaction Limits

Recommended limits:

```text
Maximum reactions per player: 3 every 10 seconds
Maximum identical active reactions on one roll: 3
Reaction duration: 1.5 seconds
```

The server should rate-limit reactions.

Reactions are ephemeral and do not need to survive a reconnect.

---

# 16. Clearing Dice

## 16.1 Clear a Specific Roll

A player may remove all visible dice from one of their rolls.

The roll remains in history.

A player may clear only:

* Their own rolls
* Dice they own

Other players cannot clear those dice, even when Shared Rerolls is enabled.

## 16.2 Clear Unkept Dice

A player may clear all of their unkept dice.

Kept dice remain.

## 16.3 Clear All Dice

The host may clear all visible dice in the room.

This action:

* Removes visible dice
* Does not erase roll history
* Requires host authorization
* Should ask for confirmation

## 16.4 Roll History Deletion

Deleting or resetting the roll history is not required for the MVP.

---

# 17. Dice Lifetime and Table Clutter

Unkept settled dice should remain visible for approximately 30 seconds.

The timer resets when the die is:

* Inspected
* Moved
* Selected
* Included in a reaction
* Included in an active interaction menu

Kept dice do not fade automatically.

When room limits are reached:

1. Remove the oldest unkept settled dice.
2. Preserve kept dice whenever possible.
3. Reject additional keep actions if kept dice alone exceed the room limit.
4. Display a clear message when no additional dice can be kept.

Suggested limits:

```text
Maximum kept dice per player: 12
Maximum kept dice in room: 36
Maximum total visible dice: 60
```

---

# 18. Player Identity and Dice Colors

## 18.1 Display Names

Display names must:

* Be between 1 and 24 characters
* Be trimmed
* Be escaped before display
* Reject unsupported control characters
* Default to Player followed by a short number when invalid

Duplicate names are allowed, but the interface may append a temporary discriminator.

Example:

```text
Brett
Brett 2
```

## 18.2 Dice Colors

Provide at least 12 predefined colors.

Colors must:

* Remain distinguishable on the table
* Work against dark and light table themes
* Have readable face numbering
* Avoid relying solely on color for player identification

A small player name label should briefly appear near newly thrown dice.

When two players select the same color, the server may assign a nearby available color.

Do not accept arbitrary CSS color values from clients.

---

# 19. Roll History

The room maintains chronological roll history.

Each entry displays:

* Original owner
* Acting player, when different
* Dice expression
* Individual dice results
* Modifier
* Total
* Timestamp
* Source roll relationship

Example original roll:

```text
Brett rolled 2d6 + 3
[4, 6] + 3 = 13
```

Example reroll:

```text
Brett rerolled one die from the previous roll
[2] became [5]
```

Example shared reroll:

```text
Kayleen rerolled Brett’s d6
[2] became [5]
```

For d100:

```text
Kayleen rolled d100
70 + 4 = 74
```

The history drawer should:

* Be collapsed by default on phones
* Open from the side or bottom
* Show the most recent roll first
* Retain the last 100 roll records
* Be included in the initial room state for late joiners
* Use accessible text
* Allow a history entry to highlight its corresponding visible dice

A new roll should briefly appear as a small toast or table overlay.

---

# 20. Room Behavior

## 20.1 Room Codes

Room codes must:

* Contain six uppercase characters
* Avoid easily confused characters
* Use secure random generation
* Be case-insensitive during entry

Recommended alphabet:

```text
ABCDEFGHJKLMNPQRSTUVWXYZ23456789
```

Exclude:

```text
0 O 1 I
```

## 20.2 Room Lifetime

Rooms expire after 24 hours without activity.

Activity includes:

* A player joining
* A roll
* A reroll
* A player profile change
* A room setting change
* Keeping or moving dice
* Clearing dice

Reactions and inspections do not need to extend room lifetime.

## 20.3 Reconnection

Store locally:

* Room code
* Player ID
* Player session token
* Display name
* Dice color
* Host token, when applicable

When the connection drops:

1. Display a non-blocking reconnecting indicator.
2. Attempt reconnection with exponential backoff.
3. Reclaim the existing player identity.
4. Request the current room state.
5. Avoid duplicating the player.

A disconnected player remains in room state for approximately 60 seconds before being marked absent.

Any grab locks belonging to that player should be released when the player disconnects.

## 20.4 Late Joining

A player joining an active room receives:

* Connected players
* Room settings
* Current visible dice
* Dice ownership
* Kept status
* Recent roll history
* Current final dice transforms

The player does not need to replay earlier roll animations.

---

# 21. Host Controls

The room creator receives a host token stored locally.

The host may:

* Change Dice Handling between Owner Only and Shared Rerolls
* Clear all visible dice
* Lock or unlock joining
* Remove a disruptive player
* Close the room

Only the first two controls are required for the initial MVP.

Host authorization must use the private host token, not the player name or player ID.

Room setting changes should be visible to everyone.

Example notification:

```text
Dice handling changed to Shared Rerolls.
```

---

# 22. Networking Model

Use one real-time room coordinator for each room.

The server is authoritative for:

* Room membership
* Player identity
* Player color
* Dice ownership
* Room settings
* Random dice results
* Roll history
* Roll IDs
* Reroll relationships
* Grab locks
* Kept status
* Event ordering
* Rate limits
* Room expiration

The player currently rolling or holding dice is temporarily authoritative only for high-frequency visual transform updates.

These visual updates never determine the official result.

---

# 23. Recommended Technical Architecture

Use:

* TypeScript with strict mode
* React
* Vite
* Three.js through React Three Fiber
* Rapier 3D physics
* Cloudflare Workers
* One Cloudflare Durable Object per room
* WebSockets
* Runtime schema validation
* Vitest
* Playwright

Alternative equivalent infrastructure is acceptable when it provides:

* Stateful WebSocket rooms
* Server-authoritative coordination
* Reliable room expiration
* Secure randomness
* Horizontal scalability

A monorepo is preferred so the client and server share protocol types and validation schemas.

---

# 24. Network Message Envelope

All WebSocket messages must use validated JSON objects with a version field.

```ts
interface NetworkMessage<T> {
  version: 1;
  type: string;
  requestId?: string;
  timestamp: number;
  payload: T;
}
```

---

# 25. Client-to-Server Events

## 25.1 JOIN_ROOM

```ts
interface JoinRoomPayload {
  roomCode: string;
  playerId?: string;
  sessionToken?: string;
  displayName: string;
  colorId: string;
}
```

## 25.2 UPDATE_PLAYER

```ts
interface UpdatePlayerPayload {
  displayName?: string;
  colorId?: string;
}
```

## 25.3 ROLL_REQUEST

```ts
type DieType =
  | "d4"
  | "d6"
  | "d8"
  | "d10"
  | "d12"
  | "d20"
  | "d100";

interface DiceSelection {
  type: DieType;
  quantity: number;
}

interface ThrowGesture {
  startPosition: [number, number, number];
  releasePosition: [number, number, number];
  velocity: [number, number, number];
  durationMs: number;
}

interface RollRequestPayload {
  clientRollId: string;
  dice: DiceSelection[];
  modifier: number;
  gesture: ThrowGesture;
}
```

## 25.4 ROLL_TRANSFORMS

Sent by the player who currently controls the active roll.

Limit updates to approximately 10 to 12 per second.

```ts
interface DieTransform {
  dieId: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
}

interface RollTransformsPayload {
  rollId: string;
  sequence: number;
  transforms: DieTransform[];
}
```

## 25.5 ROLL_SETTLED

```ts
interface RollSettledPayload {
  rollId: string;
  transforms: DieTransform[];
}
```

## 25.6 GRAB_DICE_REQUEST

```ts
interface GrabDiceRequestPayload {
  dieIds: string[];
  intendedAction: "move" | "reroll";
}
```

The server must validate:

* All dice exist
* All dice are settled
* All dice share the same owner
* The requesting player has permission
* None of the dice is already locked
* Kept dice may be grabbed only by their owner
* The dice count does not exceed the reroll limit

## 25.7 HELD_DICE_TRANSFORMS

```ts
interface HeldDiceTransformsPayload {
  grabLockId: string;
  sequence: number;
  transforms: DieTransform[];
}
```

## 25.8 RELEASE_DICE_AS_REROLL

```ts
interface ReleaseDiceAsRerollPayload {
  grabLockId: string;
  clientRollId: string;
  gesture: ThrowGesture;
}
```

## 25.9 RELEASE_MOVED_DICE

```ts
interface ReleaseMovedDicePayload {
  grabLockId: string;
  transforms: DieTransform[];
}
```

## 25.10 CANCEL_DICE_GRAB

```ts
interface CancelDiceGrabPayload {
  grabLockId: string;
}
```

## 25.11 SET_DIE_KEPT

```ts
interface SetDieKeptPayload {
  dieId: string;
  kept: boolean;
}
```

## 25.12 CLEAR_ROLL

```ts
interface ClearRollPayload {
  rollId: string;
}
```

## 25.13 CLEAR_OWN_UNKEPT_DICE

No payload is required beyond the message envelope.

## 25.14 REACT_TO_ROLL

```ts
type RollReaction =
  | "critical"
  | "success"
  | "disaster"
  | "suspense"
  | "applause"
  | "question";

interface ReactToRollPayload {
  rollId: string;
  reaction: RollReaction;
}
```

## 25.15 UPDATE_ROOM_SETTINGS

```ts
type DiceHandlingMode =
  | "owner_only"
  | "shared_rerolls";

interface UpdateRoomSettingsPayload {
  hostToken: string;
  diceHandlingMode?: DiceHandlingMode;
  joiningLocked?: boolean;
}
```

## 25.16 CLEAR_ALL_DICE

```ts
interface ClearAllDicePayload {
  hostToken: string;
}
```

## 25.17 PING

Used for connection health and approximate latency.

---

# 26. Server-to-Client Events

The server may broadcast:

* ROOM_STATE
* PLAYER_JOINED
* PLAYER_UPDATED
* PLAYER_DISCONNECTED
* PLAYER_LEFT
* ROOM_SETTINGS_UPDATED
* ROLL_CREATED
* ROLL_TRANSFORMS
* ROLL_FINALIZED
* GRAB_DICE_GRANTED
* GRAB_DICE_DENIED
* DICE_GRABBED
* HELD_DICE_TRANSFORMS
* DICE_MOVED
* REROLL_CREATED
* GRAB_CANCELED
* DIE_KEPT_UPDATED
* ROLL_CLEARED
* ALL_DICE_CLEARED
* ROLL_REACTION
* ROOM_CLOSED
* PONG
* ERROR

---

# 27. Roll Creation Payload

```ts
interface RolledDie {
  dieId: string;
  type: DieType;
  result: number;
  percentilePart?: "tens" | "ones";
  sourceDieId?: string;
}

interface RollCreatedPayload {
  rollId: string;
  clientRollId: string;
  ownerPlayerId: string;
  actingPlayerId: string;
  sourceRollId?: string;
  dice: RolledDie[];
  modifier: number;
  total: number;
  launchSeed: string;
  approvedGesture: ThrowGesture;
  createdAt: number;
}
```

For an original roll:

```text
ownerPlayerId equals actingPlayerId
```

For a shared reroll:

```text
ownerPlayerId identifies the original dice owner
actingPlayerId identifies the player who picked up and rerolled the dice
```

The server must make `clientRollId` idempotent.

Sending the same request twice must not create two rolls.

---

# 28. Server-Side Randomness

Generate every official die result on the server using a cryptographically secure random-number source.

Avoid modulo bias.

Use rejection sampling when converting random bytes into a die result.

Conceptual behavior:

```ts
function secureDieRoll(sides: number): number {
  // Generate secure random values.
  // Reject values outside the largest evenly divisible range.
  // Return an integer from 1 through sides.
}
```

The server may separately generate a launch seed for visual variation.

The launch seed may control:

* Spawn offsets
* Initial die spacing
* Angular velocity
* Minor bounce variation

The launch seed must not be the sole source of official result randomness.

---

# 29. Data Model

## 29.1 Room

```ts
interface Room {
  code: string;
  createdAt: number;
  lastActivityAt: number;
  hostTokenHash: string;
  settings: RoomSettings;
  players: Record<string, Player>;
  rolls: RollRecord[];
  visibleDice: Record<string, VisibleDie>;
  grabLocks: Record<string, GrabLock>;
  roomVersion: number;
}
```

## 29.2 Room Settings

```ts
interface RoomSettings {
  diceHandlingMode: "owner_only" | "shared_rerolls";
  joiningLocked: boolean;
}
```

## 29.3 Player

```ts
interface Player {
  id: string;
  sessionTokenHash: string;
  displayName: string;
  colorId: string;
  connected: boolean;
  joinedAt: number;
  lastSeenAt: number;
}
```

## 29.4 Roll Record

```ts
interface RollRecord {
  id: string;
  clientRollId: string;
  ownerPlayerId: string;
  actingPlayerId: string;
  ownerNameAtRoll: string;
  actingPlayerNameAtRoll: string;
  dice: RolledDie[];
  modifier: number;
  total: number;
  sourceRollId?: string;
  sourceDieIds?: string[];
  createdAt: number;
}
```

## 29.5 Visible Die

```ts
interface VisibleDie {
  id: string;
  rollId: string;
  ownerPlayerId: string;
  type: DieType;
  result: number;
  colorId: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  status:
    | "rolling"
    | "settled"
    | "held"
    | "moving"
    | "fading";
  kept: boolean;
  createdAt: number;
  expiresAt?: number;
}
```

## 29.6 Grab Lock

```ts
interface GrabLock {
  id: string;
  dieIds: string[];
  controllerPlayerId: string;
  action: "move" | "reroll";
  createdAt: number;
  lastActivityAt: number;
  originalTransforms: DieTransform[];
}
```

Only the latest 100 roll records need to be retained.

---

# 30. Visual Design

## 30.1 Table

The default table should be:

* Dark
* Low contrast
* Slightly textured
* Free of unnecessary decoration
* Large enough to imply a shared physical space

Possible materials:

* Dark felt
* Matte wood
* Neutral synthetic gaming mat

Avoid a medieval fantasy interface. The application should work for fantasy, science fiction, horror, and contemporary games.

## 30.2 Camera

Use a slightly angled overhead camera.

The player should be able to see:

* Most of the table
* Dice trajectories
* Other players’ rolls
* Dice values after settling
* Kept and set-aside dice

Manual camera control is not required for the MVP.

## 30.3 Dice

Dice should have:

* Rounded edges
* Clear face numbering
* Strong contrast
* Modest reflections
* Distinct player colors
* Consistent scale
* A subtle owner indicator when selected

Avoid expensive effects such as:

* Real-time reflections
* Heavy post-processing
* Complex dynamic shadows
* High-resolution textures

Use simplified lighting and contact shadows.

---

# 31. Responsive Interface

## 31.1 Phone Portrait

* Table fills the viewport
* Dice controls remain at the bottom
* Room information remains compact at the top
* Roll history opens as a bottom sheet
* Dice inspection opens as a bottom sheet
* Interaction menus account for limited screen width
* Controls account for safe-area insets
* Touch targets are at least 44 by 44 CSS pixels

## 31.2 Phone Landscape

* Table uses the full width
* Controls may move toward the sides
* Roll history may open from the right
* Interaction menus should remain reachable by either hand

## 31.3 Desktop

* Table remains centered
* Roll history may appear as a right-side drawer
* Mouse and keyboard controls are supported
* The app should not become a dashboard with excessive panels

No important action may depend on hover.

---

# 32. Accessibility

Include:

* Keyboard-accessible controls
* Visible focus states
* Screen-reader labels
* Accessible dice interaction lists
* Text-based roll history
* An ARIA live region for new results
* Reduced-motion support
* High-contrast number faces
* Player names in addition to colors
* Controls usable at 200 percent browser zoom

When reduced motion is enabled:

* Reduce dice movement duration
* Disable unnecessary camera motion
* Reduce reaction animations
* Permit fast result settlement
* Retain clear textual result notifications

The 3D table is supplemental to the text roll log.

A player must be able to understand all official results without seeing the animation.

---

# 33. Audio and Haptics

Audio and haptics are optional enhancements after the core MVP is stable.

Potential additions:

* Light dice collision sounds
* Small haptic response when dice are picked up
* Small haptic response when dice are released
* Small haptic response when a local roll settles
* Brief sound for roll reactions

Audio must:

* Remain muted until the user interacts with the page
* Have an obvious mute control
* Avoid playing a separate loud sound for every collision

Do not block the MVP on audio.

---

# 34. Security and Abuse Prevention

Implement:

* Secure room code generation
* Secure player session tokens
* Hashed tokens in persistent storage
* Runtime schema validation
* Display-name sanitization
* Rate limiting
* Message-size limits
* Room capacity limits
* Roll capacity limits
* Grab-lock validation
* Ownership validation
* Host-token validation
* No client-submitted HTML
* No client-submitted official results

Suggested rate limits:

```text
Roll requests: 5 per second per player
Grab requests: 5 per second per player
Profile updates: 5 per minute per player
Reactions: 3 every 10 seconds per player
Room setting changes: 10 per minute
WebSocket message size: 64 KB maximum
Transform updates: 12 per second per active roll or grab
```

Do not collect:

* Email addresses
* Physical locations
* Contact lists
* Advertising identifiers
* Unnecessary device information

The room code functions as a shared private credential. Rooms should not be described as suitable for sensitive information.

---

# 35. Performance Requirements

Target:

* 60 frames per second with 12 active dice on a typical modern phone
* Graceful degradation toward 30 frames per second
* Initial landing-page load without downloading the entire 3D scene
* Lazy loading of 3D and physics packages after room creation or entry
* Typical network use below approximately 20 KB per second per player
* Room join time below three seconds under ordinary conditions

Performance controls should include:

* Disable expensive shadows on low-powered devices
* Reduce transform frequency when latency is high
* Put settled dice to sleep
* Remove expired dice
* Reuse geometry and materials
* Use instancing where practical
* Avoid React state updates for every physics frame
* Keep per-frame transforms inside scene or physics references

---

# 36. Suggested Project Structure

```text
shared-dice-table/
  apps/
    web/
      src/
        components/
        features/
          landing/
          room/
          dice/
          dice-interactions/
          players/
          roll-log/
          room-settings/
        scene/
          DiceTable.tsx
          DiceMesh.tsx
          DiceController.tsx
          HeldDiceController.tsx
          DiceInteractionMenu.tsx
          Lighting.tsx
          CameraController.tsx
        network/
        state/
        styles/
        tests/
    worker/
      src/
        index.ts
        room-object.ts
        room-state.ts
        room-settings.ts
        grab-locks.ts
        protocol.ts
        validation.ts
        randomness.ts
        rate-limits.ts
        tests/
  packages/
    shared/
      src/
        protocol.ts
        dice.ts
        colors.ts
        schemas.ts
        interactions.ts
  docs/
    architecture.md
    network-protocol.md
    interaction-model.md
    deployment.md
  playwright/
  package.json
  tsconfig.json
  wrangler.toml
  README.md
```

---

# 37. Implementation Milestones

## Milestone 1: Local Dice Prototype

Build:

* Table scene
* d6 and d20 models
* Dice selection
* Pointer attachment
* Drag and release
* Rapier physics
* Face detection
* Authoritative face reconciliation
* Responsive controls

Exit criteria:

* Dice can be rolled repeatedly on phone and desktop.
* Dice visibly settle on specified test results.
* The scene remains responsive after 100 sequential rolls.

## Milestone 2: Rooms and Presence

Build:

* Create Room
* Join Room
* Real-time room coordinator
* WebSocket connection
* Player names
* Player colors
* Player join and leave events
* Reconnection
* Room expiration

Exit criteria:

* Two browser sessions can join the same room.
* Both sessions see the same players.
* Reloading restores the local player identity.

## Milestone 3: Shared Rolls

Build:

* Server-authoritative randomness
* Shared roll creation
* Transform synchronization
* Roll history
* Late-join room state
* Idempotent roll requests

Exit criteria:

* Two clients see the same player, expression, results, and total.
* A repeated network request does not duplicate a roll.
* Visual top faces match official results.

## Milestone 4: Complete Dice Set

Build:

* d4
* d6
* d8
* d10
* d12
* d20
* d100
* Mixed dice pools
* Modifiers
* Quantity controls

Exit criteria:

* Every die displays the correct face.
* Every die can settle on every valid result.
* d100 handles results from 1 through 100.

## Milestone 5: Inspection and Interaction Menu

Build:

* Tap or click to inspect
* Roll highlighting
* Long-press interaction menu
* Right-click interaction menu
* Accessible interaction list
* Roll detail panel

Exit criteria:

* Players can inspect any visible die.
* The application identifies all dice belonging to the roll.
* Actions shown match the player’s permissions.

## Milestone 6: Dice Ownership and Rerolling

Build:

* Dice ownership
* Owner-only handling
* Grab locks
* Pick Up and Reroll
* Multiple-die selection
* Linked reroll history
* Cancel grab behavior

Exit criteria:

* Players cannot grab another player’s dice by default.
* A player can physically pick up and reroll their own die.
* The original history entry remains unchanged.
* Rerolls create linked history records.
* Only one player can control a die at a time.

## Milestone 7: Shared Rerolls

Build:

* Host Dice Handling setting
* Shared Rerolls mode
* Acting-player attribution
* Original-owner retention
* Shared reroll permission checks

Exit criteria:

* The host can enable and disable Shared Rerolls.
* Another player can reroll an eligible die only when enabled.
* Kept dice remain protected.
* History identifies both owner and acting player.

## Milestone 8: Keep, Move, Clear, and React

Build:

* Keep and release dice
* Set-aside region
* Move settled dice
* Clear individual roll
* Clear unkept dice
* Host clear-all action
* Roll reactions
* Dice fading

Exit criteria:

* Kept dice do not fade.
* Other players cannot grab kept dice.
* Moving dice does not change results.
* Reactions are synchronized and rate-limited.
* Clearing dice does not erase history.

## Milestone 9: Hardening and Deployment

Build:

* Rate limiting
* Error states
* Accessibility pass
* Reduced-motion mode
* Performance tuning
* Automated test suite
* Production deployment configuration
* Documentation

Exit criteria:

* The application can be deployed through documented commands.
* Automated tests pass.
* Phone and desktop sessions complete the full room, roll, inspect, reroll, keep, react, disconnect, and reconnect flow.

---

# 38. Testing Requirements

## 38.1 Unit Tests

Test:

* Dice notation parsing
* Dice pool validation
* Modifier calculations
* d100 calculation
* Secure die-range conversion
* Room code validation
* Display-name sanitization
* Rate limits
* Duplicate client roll IDs
* Roll history limits
* Face-to-orientation mappings
* Dice ownership checks
* Shared reroll permission checks
* Kept-die protection
* Grab-lock expiration
* Reroll source relationships

Every die type must have a test proving each possible result maps to a valid upward face.

## 38.2 Integration Tests

Test:

* Room creation
* Room joining
* Invalid room code
* Full room
* Player reconnection
* Player color assignment
* Shared roll broadcast
* Late joining
* Room expiration
* Malformed WebSocket messages
* Unauthorized transform updates
* Duplicate roll requests
* Owner grabbing own die
* Non-owner grab denial
* Shared Rerolls enabled
* Shared Rerolls disabled
* Kept die grab denial
* Grab cancellation
* Grab expiration
* Reroll linkage
* Reaction rate limiting
* Clear-roll permissions
* Host setting authorization

## 38.3 End-to-End Tests

Use at least two isolated browser contexts.

Test:

1. Player A creates a room.
2. Player B joins by code.
3. Both players appear.
4. Player A rolls a d20.
5. Both clients display the same result.
6. Player B inspects the d20.
7. Player B cannot pick it up.
8. Player A picks up and rerolls the d20.
9. Both clients see the linked reroll.
10. Player A keeps the new d20.
11. Player B sends a reaction.
12. The host enables Shared Rerolls.
13. Player B attempts to grab the kept d20 and is denied.
14. Player A releases the kept status.
15. Player B picks up and rerolls the d20.
16. History identifies Player B as the actor and Player A as the owner.
17. Player A disconnects.
18. Player A reconnects with the same identity.
19. Roll history and visible dice remain available.

Include phone portrait and desktop viewport tests.

## 38.4 Manual Device Testing

Test on:

* Mobile Safari
* Mobile Chrome
* Desktop Chrome
* Desktop Firefox
* Desktop Safari or Edge

Pay particular attention to:

* Pointer capture
* Long-press behavior
* Browser context-menu suppression
* Touch scrolling
* Safe-area insets
* WebGL context recovery
* Background-tab reconnection
* Mobile browser address-bar resizing
* Dragging dice near screen edges
* Interaction-menu placement

---

# 39. Error States

Provide useful messages for:

* Room not found
* Room expired
* Room full
* Joining locked
* Connection lost
* Reconnecting
* WebGL unavailable
* Physics engine failed to load
* Invalid display name
* Invalid dice selection
* Rate limit reached
* Browser unsupported
* Die no longer available
* Die already held by another player
* Permission denied
* Shared Rerolls disabled
* Kept die cannot be grabbed
* Grab lock expired
* Visible dice limit reached

When WebGL is unavailable, provide a simplified text-only roller connected to the same room.

The text-only fallback should support:

* Dice selection
* Roll button
* Player list
* Roll history
* Roll inspection
* Reroll controls
* Keep status
* Reactions
* Shared server-authoritative results

---

# 40. Explicit Non-Goals

Do not include these in the MVP:

* Character sheets
* Maps
* Tokens or miniatures
* Initiative tracking
* Voice or video chat
* Text chat
* User accounts
* Friends lists
* Campaign storage
* Rules automation
* Damage calculations
* Dice macros
* Public room discovery
* Matchmaking
* Custom 3D dice uploads
* Monetization
* Automatic enforcement of reroll rules
* Automatic success counting
* Automatic advantage or disadvantage
* Cross-player dice clearing
* Interference with dice while they are actively rolling

The application is a shared dice table, not a full virtual tabletop.

---

# 41. Definition of Done

The MVP is complete when:

* A user can create a private room.
* Another user can join using only the room code.
* Each player can choose a name and dice color.
* Players can select and physically throw standard RPG dice.
* All connected players see each other’s rolls.
* Every client displays the same official result.
* Results are generated by the server.
* Visual die faces match official results.
* Roll history identifies the player and result.
* A player can inspect any visible die and its complete roll.
* A player can long press or context-click a die to open its actions.
* Players can pick up and reroll their own dice.
* Players cannot pick up another player’s dice by default.
* The host can enable Shared Rerolls.
* Shared rerolls identify both the original owner and acting player.
* A player can keep and set aside their own dice.
* Kept dice cannot be grabbed by other players.
* A player can move their own settled dice.
* A player can clear one of their visible rolls.
* Players can send limited visual reactions.
* Completed roll records never change.
* Temporary disconnections recover automatically.
* The application works on phone and desktop browsers.
* The application includes a text-only fallback.
* Automated tests cover rooms, results, ownership, rerolls, reactions, and reconnection.
* Deployment steps are documented.
* No account is required.

---

# 42. Instructions for the Coding Agent

Build the application described in this specification.

Work through the implementation milestones in order. Keep the project runnable after every milestone.

Use reasonable visual and technical defaults without stopping to request approval for routine decisions. Document assumptions in `docs/architecture.md`.

Requirements:

1. Use TypeScript strict mode.
2. Share protocol types between client and server.
3. Validate all network payloads at runtime.
4. Keep official dice results server-authoritative.
5. Do not use visual physics to calculate official results.
6. Do not trust results submitted by clients.
7. Enforce dice ownership on the server.
8. Make Owner Only the default handling mode.
9. Require host authorization to enable Shared Rerolls.
10. Protect kept dice from shared rerolling.
11. Use server-controlled grab locks.
12. Record original owner and acting player separately.
13. Keep all completed roll records immutable.
14. Treat rerolls as new linked rolls.
15. Prioritize mobile touch interaction before desktop enhancements.
16. Avoid unnecessary dependencies.
17. Add tests alongside each feature.
18. Run formatting, type checking, unit tests, and end-to-end tests before completing a milestone.
19. Provide clear local-development and deployment instructions.
20. Do not substitute mocked multiplayer behavior for the real room implementation.
21. Do not expand the product into a virtual tabletop.
22. Prefer a reliable basic experience over advanced visual effects.
23. Leave the repository in a deployable state.

Final deliverables must include:

* Complete source code
* Package lockfile
* README
* Architecture documentation
* Network protocol documentation
* Dice interaction documentation
* Testing instructions
* Deployment configuration
* Environment variable example file
* Passing automated tests
* A concise list of remaining limitations
