# Usage

A full walkthrough of the outline rail and its hover panel.

## The rail

After installing and restarting DSH, open any session that already has user messages.
A thin vertical strip appears on the right edge, vertically centered:

- **One bar per question**, chronological top→bottom (a conversation minimap).
- **`+N` marker** at the top when the session has more than 60 questions — older
  questions fold into it; open the panel and use search / `Load older` to reach them.
- The rail hides itself on the blank new-session screen (nothing to outline yet).

## Hover preview

- Move the pointer onto the rail: the preview panel slides out to its left, listing
  every question's opening words (single-line truncated), its `#turn` badge and `HH:MM`
  time. Mid-turn steering messages carry a `追问` / `steer` tag.
- Move the pointer away: the panel collapses after a 240 ms grace period (the grace
  lets the pointer travel from the rail into the panel without flicker).

## Open by click (no hover required)

Click the rail itself — its padding, its background, or the `+N` marker — and the panel
opens **pinned**: it stays up until it is closed, so the strip is fully usable by click
alone (touch, pen, automation, or a pointer that never raised a hover event).

- Clicking a bar both opens the panel and jumps to that question's message; the panel
  closes again once the message is on screen.
- A pinned panel keeps a highlighted border, so "pinned" and "hover preview" look
  different.
- Closing it: `Esc`, the × button, a click anywhere outside the panel, or clicking the
  strip again.
- If a jump cannot find the message (it sits outside the loaded history window), the
  panel says so instead of failing silently — click `Load older`, then jump again.

## Jump to a message

Click a bar on the rail — or a row in the panel:

1. If another view (e.g. Trajectory) is active, the plugin switches back to the Chat
   view first.
2. The chat scrolls so the target message sits ~96px below the top.
3. The message flashes for 1.8 s.
4. The panel closes once the jump landed.

Notes:

- Jumping works only for messages already inside the loaded history window (the panel
  only lists loaded questions — use `Load older` first for deeper history). A failed
  jump is reported in the panel footer.
- `prefers-reduced-motion` disables the smooth scroll and the flash animation.

## Search

Type in the panel's search box: the list filters instantly, case-insensitively, over
the flattened question text (image attachments count as `[image]`).

## Load older

The `Load older` button appears when older history exists outside the window. It pages
one history window up via the session's `loadOlder()`; the button greys out while
loading, and the rail + panel re-derive from the expanded snapshot.

## Copy

Hover a row and click its copy button to copy the full question text (clipboard API,
with a `document.execCommand` fallback).

## Behavior rules

- The rail follows the **current session**; switching sessions collapses the panel and
  rebuilds the rail for the new session.
- New questions appear **live** while the agent runs (the UI subscribes to the session
  snapshot — no polling).
- The panel is a pure overlay: the conversation layout never shifts while it is open.
