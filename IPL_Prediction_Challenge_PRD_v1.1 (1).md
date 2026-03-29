# 🏏 IPL Prediction Challenge
## Product Requirements Document — v1.1

| Version | Date | Status | Owner |
|---------|------|--------|-------|
| 1.1 | March 2026 | Draft | Product Team |

> **v1.1 change:** Adds Public Profile & Social Feed feature (Section 14 onwards). All prior sections unchanged from v1.0.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [User Personas](#3-user-personas)
4. [User Journey & Flow](#4-user-journey--flow)
5. [Feature Specifications](#5-feature-specifications)
6. [Technical Architecture](#6-technical-architecture)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Feature Priority & Phasing](#8-feature-priority--phasing)
9. [Constraints & Assumptions](#9-constraints--assumptions)
10. [Out of Scope](#10-out-of-scope-v10)
11. [Risks & Mitigations](#11-risks--mitigations)
12. [Indicative Timeline](#12-indicative-timeline)
13. [Glossary](#13-glossary)
14. [Amendment: Public Profile & Social Feed](#14-amendment-public-profile--social-feed)

---

## 1. Executive Summary

IPL Prediction Challenge is a real-time social sports prediction web application designed for IPL (Indian Premier League) fans. Users can create custom question sets around live IPL matches, challenge their friends via WhatsApp and Instagram, and compete in real-time as match events unfold.

The app combines the thrill of live cricket with social gaming and instant feedback — notifying players the moment their predictions are validated or invalidated by actual in-game events.

> **Problem Statement:** Cricket fans want deeper engagement during live matches, but existing platforms lack a social, friend-group-centric prediction experience with real-time feedback tied to actual match events.

> **Opportunity:** IPL 2025 drew 500M+ viewers. Even a small fraction of fans seeking interactive, social engagement represents a massive addressable market for a lightweight, shareable prediction game.

---

## 2. Goals & Success Metrics

### 2.1 Product Goals

- Deliver a delightful, low-friction social prediction experience around live IPL matches
- Drive organic virality through WhatsApp and Instagram sharing
- Create deep engagement with real-time event-triggered notifications
- Build a competitive, rankable leaderboard experience per match

### 2.2 Success Metrics

| Metric | Target |
|--------|--------|
| DAU / MAU ratio | > 40% during IPL season |
| Shares per session | > 2 challenge shares per match host |
| Friends per challenge | Average 5+ participants per shared challenge |
| Notification open rate | > 60% for real-time event alerts |
| Match completion rate | > 70% of started challenges see final leaderboard |
| D7 Retention | > 30% of users return across match weeks |

---

## 3. User Personas

### 3.1 The Match Host (Primary)

| Attribute | Description |
|-----------|-------------|
| Profile | Passionate IPL fan, aged 18–35, watches matches with friends or follows closely on mobile |
| Goal | Create a fun prediction challenge for their friend group around a specific match |
| Motivation | Social status, being 'the organiser', and winning bragging rights |
| Pain point | No lightweight tool to quickly set up and share a prediction game before a match starts |
| Key actions | Browse matches → Create questions → Set stakes → Share link → Monitor results |

### 3.2 The Participant (Secondary)

| Attribute | Description |
|-----------|-------------|
| Profile | Friend or follower of the host, casual to passionate cricket fan |
| Goal | Join the challenge, answer questions, and win the leaderboard |
| Motivation | Competitive fun, real-time excitement, social connection during matches |
| Pain point | Boring passive viewing; wants skin in the game without real money stakes |
| Key actions | Receive link → Answer questions → Get real-time alerts → See leaderboard |

---

## 4. User Journey & Flow

### 4.1 Host Flow

| Step | Action |
|------|--------|
| Step 1 | Opens app → Sees upcoming IPL match cards with team logos, date, time, and venue |
| Step 2 | Taps a match → Prompted to sign in with Google (OAuth 2.0) |
| Step 3 | Post-login: Enters the Match Challenge Creator panel |
| Step 4 | Creates questions (up to 10) — enters question text, multiple choice options, and assigns point stakes per question |
| Step 5 | Reviews and locks the question set — no editing allowed post-lock |
| Step 6 | Shares the generated challenge link via WhatsApp Deep Link or Instagram Story/DM |
| Step 7 | Monitors the live dashboard — sees friends join, tracks real-time scores |
| Step 8 | Receives final leaderboard at match end |

### 4.2 Participant Flow

| Step | Action |
|------|--------|
| Step 1 | Receives link via WhatsApp / Instagram |
| Step 2 | Opens link → Sees challenge preview (match details, host name, question count) |
| Step 3 | Taps 'Join Challenge' → Google Sign-In |
| Step 4 | Answers all questions before the match or a set deadline |
| Step 5 | Watches live match — receives push notifications when a question's answer is determined |
| Step 6 | Notification shows: 'Rohit hit a 50! You predicted YES — +15 points 🎉' or 'You predicted NO — 0 points' |
| Step 7 | Views live leaderboard that updates as events occur |
| Step 8 | Sees final ranked leaderboard at match end with scores and breakdown |

---

## 5. Feature Specifications

### 5.1 Home Screen — Match Discovery

Upon opening the app, users see a live-updated list of upcoming and ongoing IPL matches. No login is required to browse.

**Match Card Components:**
- Team names with official logos
- Match date, time, and venue
- Match format (League / Playoff / Final)
- Live match status badge (Upcoming / Live / Completed)
- Active challenges count for that match

### 5.2 Authentication — Google Sign-In

- Triggered only when user taps on a match card to create or join a challenge
- Uses Google OAuth 2.0 — email, display name, and profile picture are fetched
- Session is persisted; user stays logged in across visits
- New users are auto-registered on first sign-in; no separate registration flow

### 5.3 Challenge Creator

**Question Management:**
- Host can add up to 10 prediction questions per challenge
- Each question supports 2–4 answer options
- Host selects the correct answer at creation time OR marks it as 'To be revealed' for event-based resolution
- Reorder questions via drag-and-drop
- Preview mode before locking

**Stake System:**
- Each question is assigned a point value (e.g., 5, 10, 15, 20 points)
- Harder or more specific predictions can carry higher stakes
- Total possible score is auto-calculated and shown to participants
- No real money involved — purely points-based

**Lock Mechanism:**
- Host must explicitly tap 'Lock & Publish Challenge' to finalise
- Once locked, questions and options cannot be edited
- A shareable link is generated immediately upon locking

### 5.4 Challenge Participation

- Participants open the link and see full question list before answering
- Must answer all questions in one session before submitting
- Answer window closes at match start time or when host manually closes it
- Participants can see how many others have joined but not their answers

### 5.5 Real-Time Event Notifications

This is the core engagement mechanic. The app listens to a live match data feed and triggers notifications when events matching locked questions occur.

**Notification Triggers (examples):**
- A batsman reaches 50 or 100 runs
- A bowler takes a wicket
- Match result — win, loss, super over
- A player scores in the powerplay
- A six is hit in the death overs

**Notification Format:**
> *"[Player] just hit a century! 🎉 You predicted YES on Q3 — +20 points!"*
> *"You predicted NO — 0 points this round."*

- Delivered via Web Push Notification (PWA) and in-app toast
- All participants in a challenge receive the same trigger simultaneously
- Leaderboard updates in real time after each event resolution

### 5.6 Sharing

**WhatsApp Sharing:**
- Deep link opens a pre-filled WhatsApp message with challenge link and match summary
- Message includes: match name, host name, total questions, and stake range

**Instagram Sharing:**
- Generates a shareable story card image (match branding + challenge info)
- Link added to bio or DM — Story swipe-up for eligible accounts
- Fallback: Copy link to clipboard with one tap

### 5.7 Leaderboard & Results

- Live leaderboard updates after each question is resolved by a real event
- Shows rank, name, profile picture, score, and correct answer count
- Final leaderboard displayed at match end with winner celebration UI
- Score breakdown per question available on tap
- Host can share the final leaderboard as an image to WhatsApp / Instagram

---

## 6. Technical Architecture

### 6.1 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (PWA) — installable on mobile, supports push notifications |
| Backend | Node.js + Express or Firebase Cloud Functions |
| Database | Firestore (real-time sync) for challenges, answers, and scores |
| Auth | Firebase Authentication — Google OAuth provider |
| Live Match Data | CricAPI or Cricbuzz API for live scores and event feeds |
| Notifications | Firebase Cloud Messaging (FCM) for Web Push |
| Hosting | Firebase Hosting or Vercel |
| Link Sharing | Dynamic Links (Firebase) for cross-platform deep links |

### 6.2 Data Models

**Challenge Object:**
`challengeId, matchId, hostUserId, title, questions[], lockedAt, shareLink, status`

**Question Object:**
`questionId, text, options[], correctOptionId, stakePoints, resolvedAt, triggerEvent`

**Participant Answer Object:**
`participantId, challengeId, questionId, selectedOptionId, submittedAt, pointsAwarded`

**Leaderboard Entry:**
`userId, displayName, photoURL, totalScore, correctCount, rank`

### 6.3 Real-Time Event Processing

| Component | Behaviour |
|-----------|-----------|
| Polling / Webhook | Backend polls live match API every 30–60 seconds for event updates |
| Event Matching | Each new event is matched against open question triggers |
| Score Update | Firestore batch writes update all participant scores simultaneously |
| Notification Dispatch | FCM sends push to all participants in the affected challenge |
| Leaderboard Sync | Frontend Firestore listener auto-updates UI without page refresh |

---

## 7. Non-Functional Requirements

| Requirement | Specification |
|-------------|--------------|
| Performance | Home screen loads in < 2s on 4G. Match data refreshes every 30s. |
| Scalability | Support 10,000 concurrent users per match day without degradation |
| Availability | 99.5% uptime during IPL match windows (6 PM – 11 PM IST) |
| Notification latency | Event-to-notification delivery < 60 seconds |
| Security | All user data encrypted in transit (HTTPS). Google OAuth only — no passwords stored. |
| Privacy | GDPR and IT Act compliant. No selling of user data. Anonymous leaderboard option. |
| Mobile-first | Responsive design; primary breakpoints at 375px and 390px |
| Accessibility | WCAG 2.1 AA compliance — contrast ratios, touch targets > 44px |

---

## 8. Feature Priority & Phasing

| Feature | Priority | Phase |
|---------|----------|-------|
| Match listing & live status | P0 | Phase 1 — MVP |
| Google Sign-In | P0 | Phase 1 — MVP |
| Challenge Creator (questions + options) | P0 | Phase 1 — MVP |
| Stake assignment per question | P0 | Phase 1 — MVP |
| Lock & share challenge link | P0 | Phase 1 — MVP |
| Participant answer submission | P0 | Phase 1 — MVP |
| WhatsApp share integration | P0 | Phase 1 — MVP |
| Real-time event notifications | P1 | Phase 2 |
| Live leaderboard updates | P1 | Phase 2 |
| Instagram sharing & story card | P1 | Phase 2 |
| Score breakdown per question | P1 | Phase 2 |
| Final leaderboard share image | P2 | Phase 3 |
| PWA installability | P2 | Phase 3 |
| Match history & past challenges | P2 | Phase 3 |
| Team/player stats on match card | P3 | Phase 4 |
| Public leaderboards across users | P3 | Phase 4 |
| Seasonal rankings | P3 | Phase 4 |

---

## 9. Constraints & Assumptions

### 9.1 Constraints

- IPL match data is subject to third-party API availability and rate limits — a paid API tier may be required for reliable real-time event feeds
- WhatsApp Deep Link and Instagram sharing are subject to platform policy changes
- Web Push Notifications require user permission and are blocked by iOS Safari until PWA is installed — affects iOS reach
- No real-money transactions; app is positioned purely as a social points game to avoid gaming regulation complexity

### 9.2 Assumptions

- Users have a Google account for authentication
- Friends sharing and joining challenges are predominantly on mobile browsers
- Live match data API provides ball-by-ball or over-by-over updates with < 45 second delay
- Users are comfortable granting push notification permissions for real-time alerts

---

## 10. Out of Scope (v1.0)

- Real-money betting or wagering of any kind
- In-app messaging or chat between participants
- Official IPL team or BCCI branding or licensing
- Video streaming or live match commentary
- Non-IPL cricket formats (Test, ODI, other T20 leagues) — considered for Phase 4
- Native iOS or Android app — PWA covers mobile v1

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| API reliability | Live match event API may have downtime — mitigate with fallback manual result entry by host |
| iOS push limitations | Push unavailable on non-installed PWA on iOS — mitigate with in-app polling fallback and install prompts |
| Low virality | Challenge links may not convert — mitigate with compelling preview cards and frictionless join flow |
| Answer window abuse | Participants could answer after match starts if window not enforced — strictly enforce server-side deadline |
| Scalability spikes | Finals and high-profile matches could spike traffic — use Firebase auto-scaling and CDN caching aggressively |

---

## 12. Indicative Timeline

| Timeline | Deliverable |
|----------|------------|
| Week 1–2 | Technical setup: Firebase project, Google Auth, CricAPI integration, match listing UI |
| Week 3–4 | Challenge Creator: question builder, stake system, lock & share flow |
| Week 5–6 | Participant flow: join via link, answer submission, deadline enforcement |
| Week 7–8 | Real-time engine: event polling, notification dispatch, live leaderboard |
| Week 9 | Sharing: WhatsApp deep link, Instagram story card, PWA manifest |
| Week 10 | QA, performance testing, security review, beta with 20 internal users |
| Week 11 | Soft launch: IPL match week, monitor metrics, hotfixes |
| Week 12+ | Phase 2 features, feedback loop, scaling review |

*Note: Timeline extended to Week 15 in v1.1 — see Section 14.8*

---

## 13. Glossary

| Term | Definition |
|------|-----------|
| Challenge | A locked set of prediction questions created by a host for a specific IPL match |
| Host | The user who creates and shares a challenge |
| Participant | Any user who joins a challenge via a shared link |
| Stake | Point value assigned to a question — higher stake = more points for correct answer |
| Event Trigger | A live match event (e.g., wicket, fifty) that resolves a prediction question |
| Lock | The action of finalising a challenge, after which no edits are allowed |
| Leaderboard | Ranked list of participants by total points earned in a challenge |
| PWA | Progressive Web App — web app installable on mobile home screen with push support |

---

---

# 14. Amendment: Public Profile & Social Feed

> **Added in v1.1 — March 2026**
> Sections updated: 5 (Features), 6 (Architecture), 8 (Priority), 12 (Timeline)

---

### 14.1 Feature Overview

The Public Profile feature transforms IPL Prediction Challenge from a closed, invite-only game into an open social platform — similar to how Instagram profiles work. Every user gets a public, shareable profile page that acts as their cricket prediction identity.

Friends, strangers, and rivals can browse any player's match history, challenge record, and performance stats without needing to be in the same challenge group.

> **Core Idea:** Your prediction record is your reputation. Anyone can visit your profile, see your wins, your accuracy rate, and your past challenges — just like visiting an Instagram profile.

---

### 14.2 Profile Page — Header

The top section of every user's profile mirrors the Instagram header pattern.

| Element | Specification |
|---------|--------------|
| Profile Photo | Google account profile picture (auto-synced). User can override with a custom upload. |
| Display Name | Google display name (editable). Shown as the primary identity across the app. |
| Username / Handle | Auto-generated @handle on first login (e.g., @rohit_fan_22). User can customise once. |
| Stats Row | Three headline numbers displayed inline: **Matches Played \| Challenges Won \| Prediction Accuracy %** |
| Bio / Tagline | Optional 100-character free-text bio. E.g., *'CSK die-hard 🦁 \| Always backing Gaikwad'* |
| Favourite Team Badge | User selects their favourite IPL team. Badge displayed on profile. |
| Follow / Share | Any visitor can tap 'Follow' to subscribe to activity, or share the profile link. |

---

### 14.3 Challenge History Feed

Below the profile header, past challenges are displayed as a scrollable feed of match cards — most recent first. Each card is a self-contained record of one challenge.

**Challenge Card Components:**
- Match name and date — e.g., *'MI vs CSK — Apr 6, 2026'*
- Role badge — **Host** or **Participant**
- Score achieved — e.g., *'75 / 100 pts'*
- Rank in challenge — e.g., *'#2 of 8 players'*
- Accuracy — e.g., *'6/8 correct predictions'*
- Result highlight — best correct prediction shown as a pill, e.g., *'Called Bumrah Hat-trick ✅'*
- Tap to expand — opens full challenge detail with all questions, answers, and friend leaderboard

---

### 14.4 Profile Stats Tab

A dedicated Stats tab shows deeper historical analytics.

| Stat | Description |
|------|-------------|
| Total Matches | Count of all IPL matches participated in via any challenge |
| Challenges Hosted | How many challenges this user has created and shared |
| Win Rate | Percentage of challenges where user ranked #1 |
| Top 3 Rate | Percentage of challenges where user finished in top 3 |
| Prediction Accuracy | Overall correct / total predictions across all challenges |
| Best Streak | Longest consecutive correct prediction run |
| Favourite Question Type | Most accurate category — e.g., *'Wicket predictions: 82% accuracy'* |
| All-time Points | Cumulative points across all challenges ever played |
| Head-to-Head Record | Win/loss breakdown against friends they frequently play with |

---

### 14.5 Trophies & Badges

A Trophy Shelf section displays earned badges, visible to all profile visitors.

| Badge | Unlock Condition |
|-------|-----------------|
| First Blood 🩸 | Completed first challenge |
| Sharp Eye 🎯 | Achieved 80%+ accuracy in a single challenge |
| Century Club 💯 | Scored 100 points in a challenge |
| Social Star ⭐ | Shared 10+ challenges via WhatsApp or Instagram |
| Streak Master 🔥 | 5 consecutive correct predictions in one match |
| Champion 🏆 | Won (ranked #1) in 5 or more challenges |
| Super Host 🎙️ | Hosted 10+ challenges with 5+ participants each |
| Faithful Fan 💙 | Played challenges for every match in a full IPL season |

---

### 14.6 Social Graph — Following & Followers

- Users can follow any other public profile — similar to Instagram's follow model
- **Following Feed:** A home tab showing recent challenge activity from people you follow
- Follower count and following count shown in the profile header stats row
- **Notifications:** *'Priya just hosted a challenge for RR vs KKR — join now'* (only from followed users)
- No approval required — all profiles are public by default; no private profile mode in v1

---

### 14.7 Profile Discovery

- Search bar on the Explore tab — search by display name or @handle
- *'People you may know'* suggestions based on mutual challenges played
- Leaderboard names are tappable — any participant can visit their profile from any leaderboard
- Shareable profile URL: `app.iplpredict.com/@username` — opens directly in browser
- Rich link previews when shared on WhatsApp/Instagram (Open Graph meta tags): photo, name, win rate, team badge

---

### 14.8 Privacy & Visibility Rules

> **Default:** All profiles are public. Anyone — logged in or not — can view a profile page and challenge history.

| Data Element | Visibility |
|--------------|-----------|
| Challenge history | Fully public — match name, score, rank, accuracy visible to all |
| Question answers | Hidden until the challenge's match has concluded — no spoiling live challenges |
| Following / Followers list | Public — visible to all profile visitors |
| Email address | Never shown publicly — internal only |
| Profile photo & name | Public — sourced from Google account |
| Badges & trophies | Fully public |
| Head-to-head stats | Only visible to the two users involved |

*Future consideration (v2): Allow users to set profile to 'Friends Only' visibility.*

---

### 14.9 User Flows

**Viewing Your Own Profile:**
1. Tap profile avatar / 'My Profile' in the nav bar
2. See profile header: photo, name, handle, stats row, bio, team badge
3. Scroll feed of past challenge cards
4. Tap Stats tab — view full historical analytics
5. Tap Trophies tab — view earned and locked badges
6. Tap Edit Profile — change display name, bio, team badge, profile photo

**Viewing Another User's Profile:**
- Entry points: tap a name on any leaderboard, search by @handle, open a shared link
1. Arrive at public profile — see header, stats, team badge
2. Browse their challenge history feed
3. Tap 'Follow' to subscribe to their activity
4. Tap any challenge card — answers hidden if match is still live
5. Tap 'Challenge Them' — creates a new challenge for the same team's next match

**Following Feed:**
- Location: New **Feed** tab on the home screen (alongside 'Matches')
- Content: Chronological activity from followed users — new challenges, badges earned, wins
- Card format: *'@handle just hosted a challenge for RCB vs DC — 6 questions, up to 80 pts. Join now →'*

---

### 14.10 Data Model Additions

**User Profile Object (extended):**
```
username           string, unique, lowercase, alphanumeric + underscore
bio                string, max 100 chars
favouriteTeam      string — IPL team code
profilePhotoURL    string — defaults to Google photo
totalPoints        number — cumulative across all challenges
challengesPlayed   number
challengesHosted   number
challengesWon      number
predictionAccuracy float — correct / total
badges             string[] — array of badgeId
followersCount     number
followingCount     number
```

**Follow Relationship Object:**
```
followId      string
followerId    userId of the person following
followingId   userId of the profile being followed
createdAt     timestamp
```

**Challenge Card (public record):**
Every completed challenge is permanently stored and linked to all participant userIds.
```
matchId, matchName, matchDate, role (host/participant),
score, rank, totalParticipants, accuracyRate,
questionCount, topPrediction
```
Challenge cards are never deleted — they form the immutable public record.

---

### 14.11 Architecture Additions

| Component | Implementation |
|-----------|---------------|
| Profile storage | Firestore 'users' collection extended with new profile fields |
| Username index | Firestore index on username field for O(1) handle lookups |
| Follow graph | Firestore 'follows' collection with compound queries for follower/following lists |
| Challenge archive | Firestore 'challengeHistory' sub-collection per user — written on challenge resolution |
| Badge engine | Cloud Function triggered on score update — evaluates badge unlock conditions |
| Public profile URLs | Firebase Hosting rewrites: `/@username` routes map to the React SPA with OG meta tags |
| OG link previews | Rich preview on WhatsApp/Instagram: photo, name, win rate, team badge |

---

### 14.12 Updated Priority (v1.1 additions)

| Feature | Priority | Phase |
|---------|----------|-------|
| Public profile page (header + stats row) | P1 | Phase 2 |
| Challenge history feed on profile | P1 | Phase 2 |
| Follow / unfollow users | P1 | Phase 2 |
| Profile search by name / handle | P1 | Phase 2 |
| Tappable names on leaderboard → profile | P1 | Phase 2 |
| Following activity feed tab | P2 | Phase 3 |
| Badges & trophy shelf | P2 | Phase 3 |
| Detailed stats tab (accuracy, streaks) | P2 | Phase 3 |
| Edit profile (bio, team badge, photo) | P2 | Phase 3 |
| Shareable profile URL with OG preview | P2 | Phase 3 |
| Head-to-head records between users | P3 | Phase 4 |
| 'Challenge Them' quick action | P3 | Phase 4 |
| Private profile mode | P3 | Phase 4 |

---

### 14.13 Revised Timeline (v1.1)

> **Net addition:** Public Profile adds approximately 3–4 weeks to the overall roadmap.

| Timeline | Deliverable |
|----------|------------|
| Week 7–8 | Profile schema design, Firestore extensions, username system, profile page UI |
| Week 9–10 | Challenge history archive, feed display, leaderboard tap-through to profile |
| Week 11 | Follow graph, following activity feed, profile search |
| Week 12 | Badge engine, trophy shelf, stats tab |
| Week 13 | OG meta tags for profile sharing, edit profile, profile photo upload |
| Week 14 | QA, accessibility review, beta testing with internal group |
| Week 15 | Soft launch with profile feature enabled |

---

### 14.14 Glossary Additions

| Term | Definition |
|------|-----------|
| Public Profile | A permanent, publicly visible page for each user showing their prediction identity and history |
| Handle / Username | A unique @username chosen by the user, used in shareable profile URLs |
| Challenge Card | A feed item on a profile representing a completed challenge |
| Trophy Shelf | A collection of earned badges displayed on a user's profile |
| Follow | Subscribing to another user's activity — surfaces their challenges in your Following Feed |
| Following Feed | A home tab showing real-time challenge activity from users you follow |
| OG Preview | Open Graph meta tags that render a rich link preview when a profile URL is shared |
| Badge Engine | A backend Cloud Function that evaluates and awards achievement badges |

---

*IPL Prediction Challenge PRD v1.1 — Confidential — March 2026*
