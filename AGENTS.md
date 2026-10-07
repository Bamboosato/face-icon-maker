# AGENTS.md

## Project Overview

Face Icon Maker is a browser-only web application that creates profile icons from group photos.

Core user flow:

1. Upload a group photo
2. Detect faces automatically
3. Select a face
4. Adjust crop if needed
5. Download PNG icon

The primary value of this product is face detection and face selection.

This is NOT a general-purpose image editor.

---

## Product Philosophy

Always optimize for:

```text
Upload Photo
↓
Select Face
↓
Download Icon
```

The fewer user actions required, the better.

When making implementation decisions:

- Prefer simplicity over flexibility.
- Prefer automation over manual editing.
- Prefer fast interaction over advanced features.

---

## MVP Scope

This section defines the original MVP. For the current implemented scope, see
`README.md` and `docs/requirements.md` (implementation audit: 2026-10-06).

Included:

- Photo upload
- Face detection
- Multiple face selection
- Auto crop generation
- Crop adjustment
- Square icon
- Circular icon
- PNG download

Excluded:

- User accounts
- Cloud storage
- Backend services
- Databases
- Authentication
- Social features
- AI image generation

---

## Technical Constraints

### Architecture

The application must run entirely in the browser.

Requirements:

- No backend
- No database
- No image upload to servers
- No paid APIs

Preferred stack:

- React
- TypeScript
- Vite
- Tailwind CSS
- MediaPipe Face Detection
- MediaPipe Face Landmarker (static selected-face analysis)
- HTML5 Canvas

---

## Face Detection Rules

Face detection is a core feature.

Do not treat it as an optional enhancement.

Requirements:

- Detect multiple faces
- Display face bounding boxes
- Allow selecting any detected face
- Highlight selected face

If a face is selected:

- Generate a crop automatically
- Center the face
- Include sufficient surrounding space

Recommended crop size:

```text
face bounding box × 2.2
```

Include hair and head shape whenever possible.

---

## UI Guidelines

### Mobile First

The primary target is smartphone users.

Design for:

- Touch interaction
- One-handed operation
- Large tap targets

### Keep Screens Simple

Avoid complex toolbars.

Prefer:

- One primary action per screen
- Clear navigation
- Minimal settings

---

## Performance Guidelines

Target:

- Face detection starts within 3 seconds
- Face selection response under 100ms
- PNG export under 1 second

Avoid:

- Unnecessary rerenders
- Large state trees
- Heavy dependencies

---

## Code Organization

Recommended structure:

```text
src/
├─ pages/
├─ components/
├─ services/
├─ hooks/
├─ types/
└─ utils/
```

Keep business logic outside UI components.

Preferred:

```text
components -> services
```

Avoid:

```text
large components with embedded logic
```

---

## State Management

Use React state for MVP.

Do not introduce:

- Redux
- MobX
- Complex global stores

Unless there is a demonstrated need.

---

## Future Features

The following original phase list is retained for planning context. Background
removal, solid background colors, pixel/comic/paint styles, super resolution,
and 12 static animal presets are already implemented. A web app manifest and
icons exist; Service Worker support and guaranteed offline use do not.

Remaining future features:

Phase 2:

- Gradient backgrounds

Phase 3:

- Additional illustration effects beyond the existing comic/paint styles
- Service Worker and offline support

Do not implement future features unless explicitly requested.

---

## Development Priority Order

Always prioritize work in this order:

1. Face detection
2. Face selection
3. Auto crop
4. PNG export
5. UI polish
6. Additional features

If time is limited, complete higher-priority items first.

---

## Definition of MVP Success

The MVP is successful when a user can:

1. Upload a group photo
2. Select their face
3. Download a profile icon

within 30 seconds.

If a proposed change does not improve that experience, it is likely outside MVP scope.
