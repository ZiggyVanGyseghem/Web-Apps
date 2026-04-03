# Anime Tracker 📺

A Progressive Web App (PWA) to track seasonal anime releases, see countdowns for upcoming episodes, and organize your watchlist. Built as a project for **Theorie en Labo Web Apps (2025 – 2026)**.

*Note: This project will be using code, layout elements, and logic from my previous old manga website project as a foundational base to build upon.*

## 📋 Project Checklist & To-Do

Below is the comprehensive roadmap for developing this PWA, ensuring it meets all project parameters and includes experimental features.

### 1. Basic Setup & UI/UX (In Progress 🚧)
- [x] Set up basic project structure (HTML, CSS, JS).
- [x] Create an attractive, modern UI (Dark mode, neon highlights, responsive base).
- [x] Implement dummy data and countdown logic for proof-of-concept.
- [ ] Connect to a real Anime API (e.g., Jikan, AniList API) for live schedules.
- [ ] Add the ability to add/remove shows from a personal "Watchlist".

### 2. PWA & Offline Capabilities
- [ ] Create `manifest.json` (icons, theme colors, display modes).
- [ ] Implement a Service Worker.
- [ ] Setup caching strategies (e.g., Stale-While-Revalidate) so the app works offline.
- [ ] Ensure the app triggers an "Install App" prompt on mobile devices.
- [ ] Save the user's Watchlist to `localStorage` or `IndexedDB` so they can view it without an internet connection.

### 3. Hardware Integration
*The project requires at least one sensor or actuator. We will explore a few options:*
- [ ] **Camera Integration (Sensor) 📸 - *Experimental***: Implement a camera scanner that allows users to scan the barcode or cover of a manga/book/anime to automatically fetch its details and add it to the watchlist.
- [ ] **Vibration API (Actuator) 📳**: Make the phone buzz when a countdown timer reaches zero.
- [ ] **Accelerometer (Sensor) 📱**: Allow the user to "shake to dismiss" an alarm or notification.

### 4. Notifications
- [ ] Ask the user for Notification permissions.
- [ ] Implement local or Web Push notifications to alert the user: *"New Jujutsu Kaisen episode is now online!"*

### 5. Quality Assurance & Evaluation Requirements
- [ ] Run a comprehensive **Chrome Lighthouse PWA Audit** and pass with a high/perfect PWA score.
- [ ] Ensure the design is 100% responsive across all device sizes (mobile, tablet, desktop).
- [ ] Ensure the core functionality meets the expectations set out in the assignment.

### 6. Deployment & Version Control
- [x] Initialize Git repository.
- [ ] Spread out commits over at least 4 weeks (min. 4 commits).
- [ ] Add the lector as a 'collaborator' to the GitHub repository.
- [ ] Host the final PWA on a free domain (e.g., Firebase Hosting or Combell).

---

## 🛠️ Tech Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **PWA**: Service Workers, Manifest
- **Hosting**: Firebase / Combell (To be decided)
- **API**: (To be decided, e.g., Jikan API)
