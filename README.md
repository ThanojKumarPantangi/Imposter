# 🎭 Imposter Multiplayer Party Game

Full-stack real-time multiplayer party game inspired by *Undercover / Imposter*. Built with Node.js, Express, Socket.IO, Redis, MongoDB, React, Vite, Tailwind CSS, and PWA support.

---

## 📁 Project Architecture

The codebase strictly follows the architectural file structures:

```text
Game/
├── Backend/
│   ├── src/
│   │   ├── config/          # Cloud MongoDB & Redis connection managers
│   │   ├── controllers/     # Auth, Room, Admin, Stats controllers
│   │   ├── cron/            # Stale room cleanup cron
│   │   ├── emailTemplates/  # Notification templates
│   │   ├── middlewares/     # JWT Auth & Admin permission guards
│   │   ├── models/          # Guest, Category, GameHistory, AdminUser, AuditLog
│   │   ├── queues/          # Job queue abstractions
│   │   ├── redis/           # Pure Redis active state & roomRepository
│   │   ├── routes/          # REST endpoints (/api/v1)
│   │   ├── scripts/         # seedCategories.js & word packs
│   │   ├── services/        # AuthService & Authoritative GameEngine
│   │   ├── sockets/         # Socket.IO game handlers & WebRTC voice signaling
│   │   ├── templates/       # Result formatters
│   │   ├── utils/           # Logger utilities
│   │   ├── workers/         # Background cleanup workers
│   │   ├── app.js           # Express app & middleware configuration
│   │   ├── clearRedis.js    # Utility script to flush game Redis keys
│   │   └── server.js        # HTTP server + Socket.IO server
│   ├── .env                 # Environment credentials (MongoDB & Redis Cloud)
│   └── package.json
│
└── Frontend/
    ├── public/              # Manifest.json & PWA icons
    ├── src/
    │   ├── api/             # Client API wrappers (Auth, Room, Admin)
    │   ├── app/             # App configs
    │   ├── components/      # Avatar, Countdown, VoiceControls, Modals, Banners
    │   ├── context/         # AuthContext, SocketContext, VoiceChatContext
    │   ├── features/        # Game helpers
    │   ├── hooks/           # useSound, useDeviceIdentity
    │   ├── layouts/         # MainLayout, AdminLayout
    │   ├── pages/           # Home, Lobby, GameView, PassAndPlay, Leaderboard, AdminLogin, AdminDashboard
    │   ├── routes/          # AppRoutes
    │   ├── utils/           # Device UUID persistence & Web Audio sounds
    │   ├── App.jsx
    │   ├── index.css        # Tailwind & Glassmorphism design tokens
    │   ├── main.jsx
    │   ├── Root.jsx
    │   └── sw.js            # PWA service worker
    ├── .env
    ├── index.html
    └── vite.config.js
```

---

## 🚀 Quick Setup & Configuration

### 1. Configure Cloud MongoDB & Redis
Open [Backend/.env](file:///d:/Game/Backend/.env) and insert your Cloud MongoDB connection string and Redis Cloud URL:

```env
# MongoDB Atlas
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/imposter_game?retryWrites=true&w=majority

# Redis Cloud
REDIS_URL=rediss://default:<password>@<host>:<port>

# JWT Secret
JWT_SECRET=super_secret_imposter_jwt_key_2026_x99!

# Default Admin Credentials
ADMIN_EMAIL=admin@imposter.game
ADMIN_PASSWORD=AdminSecret123!
```

### 2. Seed Categories into MongoDB
Run the seed script from the `Backend` directory to populate the database with word packs and initialize the default admin account:

```bash
cd Backend
npm run seed
```

*(You can also trigger database seeding anytime with 1 click from the Admin Dashboard at `/admin`).*

### 3. Start Backend Server
```bash
cd Backend
npm run dev
```
Backend runs on **http://localhost:5000** with REST API at `/api/v1` and Socket.IO at `/game`.

### 4. Start Frontend PWA
```bash
cd Frontend
npm run dev
```
Open **http://localhost:5173** in your browser. Install as a PWA on any device!

---

## 🎮 Game Features & Mechanics

1. **Pure Redis Active Multiplayer State**:
   - Zero Node.js in-memory maps or process-local room stores.
   - All rooms, active player presence, turns, votes, and deadlines are authoritative in Redis.
2. **Persistent Device-Based Identity**:
   - Unique device UUID generated and persisted in localStorage.
   - Usernames entered once, saved to MongoDB, and editable anytime from the lobby without losing stats or identity.
3. **Lobby Disconnection Protection**:
   - Authoritative disconnect countdown timer (default 5s, configurable: 3s, 5s, 10s, 15s, 30s).
   - "Start Game" is locked and disabled whenever a player is temporarily disconnected.
   - Automatic removal if grace period expires; timer cancelled upon reconnection.
4. **Host Player Removal**:
   - Host can kick any unwanted participant with confirmation dialog.
5. **Turn-Based Clue System & Imposter Word Guess**:
   - Duplicate clues are rejected.
   - Civilians cannot enter the secret word.
   - An Imposter can enter the exact secret word during their turn to achieve an instant victory!
6. **WebRTC Mesh Voice Chat**:
   - Real-time audio transmission.
   - Microphone default **OFF**, Speaker default **ON** (independent controls).
7. **Pass & Play Mode**:
   - Local party mode on a single device with screen shielding.
8. **Separated Admin Dashboard** (`/admin`):
   - Category and word pack CRUD.
   - Match history and audit logs.
   - One-click MongoDB seeding.
