# Hokus Pokers

> 💬 **Feedback Wanted!** – Found a bug or have a suggestion? [Open an issue](https://github.com/zihanlei/hokus-pokers/issues/new) or start a [Discussion](https://github.com/zihanlei/hokus-pokers/discussions) or email me directly at: ```zihanlei0512@gmail.com```. See the full [Feedback & Bug Reports](#feedback--bug-reports) section below.

**Hokus Pokers** is a real‑time, multiplayer Texas Hold’em poker web application. Host private or public games with up to 12 players, manage blind levels, enable rebuys, and watch the action unfold with live chat, emoji reactions, and a built‑in timer. The game is server‑authoritative: all logic runs on the Node.js backend, so cheating is impossible.

---

## 📋 Table of Contents

- [About the Project](#about-the-project)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
  - [Hosting a Game](#hosting-a-game)
  - [Joining a Game](#joining-a-game)
  - [Spectator Mode](#spectator-mode)
  - [Game Controls](#game-controls)
  - [Host Settings](#host-settings)
- [File Structure](#file-structure)
- [Versioning & Changelog](#versioning--changelog)
- [Feedback & Bug Reports](#feedback--bug-reports)

---

## About the Project

Hokus Pokers delivers a complete poker experience right in your browser. It features:

- **Real‑time multiplayer** with Socket.IO: up to 12 players per table.
- **Full Texas Hold’em rules**: blinds, betting rounds, all‑in, side pots, showdown.
- **Host controls**: kick players, edit chips, change password, toggle rebuys, adjust max players.
- **Spectator mode**: watch games without playing; request to join (host approved).
- **Turn timer** (default 20s): auto‑fold on timeout, with a visual countdown.
- **Responsive UI**: works on desktop and mobile (chat collapses, seats rearrange).
- **Sound effects**: synthesised via Web Audio API (no external files).
- **Floating emojis**: like YouTube live chat, add fun reactions.

The entire game state is managed on the server, ensuring fair play and preventing any client‑side tampering.

---

## Tech Stack

- **Backend:** Node.js + Express
- **Real‑time communication:** Socket.IO
- **Frontend:** Vanilla JavaScript, HTML5, CSS3 (no frameworks)
- **Styling:** Custom CSS with a clean, chess.com‑inspired design
- **Persistence:** In‑memory (rooms and player data are lost on server restart – perfect for a lightweight demo)

---

## Getting Started

### Prerequisites

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** (optional, for cloning)

### Installation

1. **Clone the repository** (or download and extract the ZIP)

```bash
git clone https://github.com/zihanlei/hokus-pokers
cd hokus-pokers
```

2. **Install dependencies**

```bash
npm install
```

3. **Start the server**

```bash
npm start
```
or directly:
```bash
node server.js
```

The server will run on `http://localhost:3000` by default (or the port set in the `PORT` environment variable).

4. **Open the app**  
Visit `http://localhost:3000` in your browser.

---

## Usage

### Hosting a Game

- On the home screen, click **Host Game**.
- Enter your nickname, room name (optional), and set your game preferences:
  - **Small/Big Blind**: default 10/20.
  - **Max Players**: 2–12 (default 8).
  - **Starting Chips**: default 1000.
  - **Rebuys Allowed**: toggle on/off.
  - **Turn Timer**: enable/disable and set duration (5–120s).
- Click **Create Game**. You’ll be taken to the table with a 6‑character room code (copy it to share).

### Joining a Game

- On the home screen, click **Join Game**.
- Either:
  - **Enter a room code** manually (and password if private), or
  - **Browse public rooms**: click **Refresh List** to see open tables. Click a room to auto‑fill the code.
- Enter your nickname and click **Join Game**.

### Spectator Mode

- When joining, you can choose **Spectate Instead**.
- Spectators see all community cards and public actions but **cannot** see hole cards until showdown.
- Spectators can request to join the game (host approval required). Pending requests appear in the host settings.

### Game Controls

- **Action Buttons**: Fold, Check, Call, Raise (enter amount), All‑in.
- **Timer**: visible when it’s your turn; auto‑fold if time runs out.
- **Chat**: toggle chat panel with the 💬 button. Players can send messages and emojis.
- **Emojis**: click the Emoji button to send a floating reaction (😂🔥👏😮💀) that appears above your seat.

### Host Settings

- Click the **⚙️** gear icon (only visible to the host) to open the settings modal.
- From there you can:
  - **Kick** a player (they become a spectator) or remove a spectator entirely.
  - **Edit chips** of any player (between hands).
  - **Change the room password** (leave blank to make it public).
  - **Toggle the turn timer** and adjust its duration.
  - **Toggle rebuys** (when on, players with 0 chips can request a rebuy).
  - **Approve/Decline rebuy requests** and **join requests** from spectators.
  - **Change max players** (existing players stay, new joins are limited).
  - **End the game** function destroys the room and returns everyone to the home screen.

---

## File Structure

```
hokus-pokers/
├── public/
│   ├── client.js      # frontend Socket.IO logic and UI updates
│   ├── index.html     # main HTML layout
│   └── style.css      # all styles (responsive)
├── server.js          # Node.js server + game logic
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

---

## Versioning & Changelog

We use [Semantic Versioning](https://semver.org/) for releases (`v1.0.0`, `v1.0.1`, `v1.1.0`, etc.).  
All notable changes are documented in the **CHANGELOG.md** file located in the project root.

---

## Feedback & Bug Reports

I welcome your feedback!  
- **Bug reports** and **feature requests** can be opened as [GitHub Issues](https://github.com/zihanlei/hokus-pokers/issues) or start a discussion in [GitHub Discussions](https://github.com/zihanlei/hokus-pokers/discussions)  
- For any other questions, you can contact me directly via email: `zihanlei0512@gmail.com`

When reporting a bug, please include:
- Steps to reproduce
- Expected vs actual behaviour
- Browser and OS version
- Any relevant console errors (if applicable)
