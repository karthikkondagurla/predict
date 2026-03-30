# Challenge Card System — Product Requirements Document

## 1. Overview

The Challenge Card is the core interactive unit of the IPL Prediction Challenge app. A user creates a challenge (a set of prediction questions for a live/upcoming IPL match), and it appears as a **poll-style card** in the Feed. Friends can participate by locking their predictions, and the card updates live with participant details, comments, and eventually AI Umpire results.

---

## 2. Challenge Identity

Each challenge receives a **daily unique short ID** — a 3-character alphanumeric code (e.g., `A3F`, `9BK`, `X12`).

- Generated per day — resets daily so IDs stay short
- Displayed prominently on the challenge card header
- Format: `[A-Z0-9]{3}` (uppercase + digits, 3 chars)
- Stored in the `challenges` table as `short_id`

---

## 3. Challenge Lifecycle

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│   Created    │ ──▶ │   Active     │ ──▶ │  Match Ends   │ ──▶ │   Resolved   │
│  (by User1)  │     │ (Open for    │     │  (AI Umpire   │     │  (Results     │
│              │     │  predictions)│     │   grades)     │     │   published)  │
└─────────────┘     └──────────────┘     └───────────────┘     └──────────────┘
```

---

## 4. Challenge Card — States & Views

### 4.1 Creator View (User1 — after creation)

After User1 creates a challenge:
- The card appears in **User1's Feed** immediately
- Shows questions & options in a **swipeable carousel** (one question per slide)
- Creator's selected answers are **highlighted and immutable** (locked radio buttons)
- Card footer shows:
  - Short ID badge (e.g., `#A3F`)
  - Participant count (live-updating)
  - Participant avatars (live-updating)
  - 💬 Comments button

### 4.2 Friend View (User2 — has NOT participated yet)

When User2 (a friend of User1) sees the challenge in their Feed:
- Swipeable carousel showing questions & options
- Options are **selectable** (radio buttons, one per question)
- User must answer ALL questions before they can submit
- After selecting all answers → **Confirmation popup** appears:
  > "🔒 Lock your prediction? This cannot be changed."
  >
  > [Cancel] [Lock Prediction]
- After confirmation:
  - Answers are saved to `challenge_responses`
  - Card transitions to "Participated" state (see 4.3)
  - **Notification sent to User1** (creator): "User2 locked their prediction!"
  - Card now also appears in **User2's activity** on their Profile

### 4.3 Participated View (any user who has locked predictions)

After locking, the card looks **exactly the same** as before — same questions, same options, same layout. The only differences:
- The user's selected option is **highlighted** on each question
- Options are **locked** — tapping does nothing
- Participant details (count + avatars) are visible at the bottom
- 💬 Comments button

> **Key principle:** There is NO separate "results" screen, NO transition to a different UI. The card is always the poll. Before locking = interactive poll. After locking = frozen poll with your picks shown.

### 4.4 Non-Friend / Stranger View

- Challenge cards are **only visible** to the creator and their friends
- Strangers never see the card

---

## 5. Feed Visibility Rules

| Viewer | Sees this challenge in Feed? |
|---|---|
| **Creator (User1)** | ✅ Always (immediately after creation) |
| **Friend who participated** | ✅ After locking prediction |
| **Friend who has NOT participated** | ✅ Can see and interact (select & lock) |
| **Non-friend** | ❌ Never |

---

## 6. Live Updates on the Challenge Card

The Challenge Card should update in **real-time** (via Supabase Realtime subscriptions):

1. **Participant count** — updates when a new user locks prediction
2. **Participant avatars** — row of small profile pics showing who participated
3. **Comments** — real-time comment thread (already implemented via `CommentsSection`)

---

## 7. Notifications

| Event | Recipient | Message |
|---|---|---|
| Friend locks prediction | Creator (User1) | "🏏 {User2} locked their prediction on your challenge #{short_id}" |
| Comment posted | All participants | "💬 {User} commented on challenge #{short_id}" |

> **Note:** Notifications can be implemented as in-app toast/badge for now. Push notifications are out of scope for v1.

---

## 8. Comments

- Already implemented via `CommentsSection.jsx`
- Attached to each challenge card via `challenge_id`
- Real-time updates via Supabase channel subscription
- Any user who can see the card can comment
- Comment author can delete their own comments

---

## 9. Database Schema Changes

### 9.1 `challenges` table — add `short_id` column

```sql
ALTER TABLE challenges ADD COLUMN short_id TEXT;
```

### 9.2 Short ID generation

Generate on insert via a Supabase trigger or in-app logic:

```
short_id = random 3-char alphanumeric, unique per day
```

Uniqueness is scoped to `DATE(created_at)` + `short_id`.

---

## 10. UI Component Structure

```
ChallengeCard
├── Header
│   ├── "Challenge" tag
│   ├── Short ID badge (#A3F)
│   ├── Q counter (Q 1 of 3)
│   └── Timestamp
├── Match Name
├── Progress Bar
├── Question Carousel (swipeable)
│   ├── Question Title
│   └── Options (radio buttons)
│       ├── Selectable (if not participated & not creator)
│       └── Highlighted + Locked (if participated or creator)
├── Navigation (← Prev / Next →)
├── Participants Section
│   ├── Avatar row (live)
│   └── "{N} predictions locked"
├── Lock Prediction Button (only if all answered & not yet submitted)
└── Footer
    └── 💬 Comments button
```

---

## 11. Confirmation Popup (Lock Prediction)

Triggered when user attempts to submit after answering all questions.

```
┌──────────────────────────────┐
│       🔒 Lock Prediction?    │
│                              │
│  Your answers cannot be      │
│  changed after locking.      │
│                              │
│  [Cancel]   [Lock Prediction]│
└──────────────────────────────┘
```

- **Cancel** — returns to the carousel, user can change answers
- **Lock Prediction** — submits to DB, card becomes immutable

---

## 12. Summary of Key Behaviors

1. **Same card, always**: The challenge card looks the same before and after locking — it's always a poll showing questions + options. After locking, options are simply frozen with the user's picks highlighted
2. **Immutability**: Once a prediction is locked (by creator or participant), it cannot be edited
3. **Live participants**: Card shows real-time participant count and avatars
4. **Feed propagation**: Card appears in feeds of creator + all participating friends
5. **Daily short ID**: 3-char alphanumeric, unique per day
6. **Confirmation flow**: Popup before locking to prevent accidental submission
7. **Notifications**: Creator is notified when friends participate
8. **Comments**: Real-time comment thread on every challenge card
