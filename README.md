# 🎭 Imposter Multiplayer Party Game

Full-stack real-time multiplayer party game inspired by *Undercover / Imposter*. Built with Node.js, Express, Socket.IO, Redis, MongoDB, React, Vite, Tailwind CSS, and PWA support.

---

## 📁 Project Architecture

The codebase strictly follows the architectural file structures:

```text
Game/
├── Backend/                 # Express, Socket.IO, Redis Cloud, MongoDB
│   ├── src/
│   │   ├── controllers/     # Auth, Room, Admin, Stats controllers
│   │   ├── routes/          # REST endpoints (/api/v1)
│   │   ├── services/        # GameEngine & AuthService
│   │   ├── sockets/         # Real-time game events & WebRTC voice signaling
│   │   ├── app.js
│   │   └── server.js
│   └── package.json
│
├── Frontend/                # Player Web Application (Vite + React + Tailwind)
│   ├── src/
│   │   ├── pages/           # Home, Lobby, GameView, PassAndPlay, Leaderboard
│   │   ├── components/      # UI components, modals, voice controls
│   │   ├── context/         # AuthContext (Player identity), SocketContext, VoiceContext
│   │   └── App.jsx
│   └── vite.config.js       # Port 5173
│
├── Frontend Admin/          # Dedicated Admin Web Portal (Vite + React + Tailwind)
│   ├── src/
│   │   ├── pages/           # AdminLogin, AdminDashboard (Category & Word Pack CRUD, Audit)
│   │   ├── context/         # Dedicated Admin AuthContext
│   │   └── App.jsx
│   └── vite.config.js       # Port 5174
│
├── Mobile/                  # Player Mobile Application (React Native + Expo)
│   ├── src/
│   │   ├── screens/         # HomeScreen, LobbyScreen, GameViewScreen, PassAndPlay, Leaderboard
│   │   ├── context/         # Player AuthContext, SocketContext, VoiceChatContext
│   │   └── navigation/      # RootNavigator
│   └── app.json             # Imposter Mobile Game
│
└── Mobile Admin/            # Dedicated Admin Mobile Application (React Native + Expo)
    ├── src/
    │   ├── screens/         # AdminLoginScreen, AdminDashboardScreen
    │   ├── context/         # Dedicated Admin AuthContext
    │   └── navigation/      # Admin RootNavigator
    └── app.json             # Imposter Admin Console
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

### 4. Running the Client Applications

#### A. Player Web Client (`Frontend`)
```bash
cd Frontend
npm run dev
```
Runs at **http://localhost:5173**.

#### B. Dedicated Admin Web Portal (`Frontend Admin`)
```bash
cd "Frontend Admin"
npm run dev
```
Runs at **http://localhost:5174**. Manage categories, words, history, audit trail, and database seeding in isolation.

#### C. Player Mobile App (`Mobile`)
```bash
cd Mobile
npx expo start
```
Runs the player app on Android, iOS, or web.

#### D. Dedicated Admin Mobile App (`Mobile Admin`)
```bash
cd "Mobile Admin"
npx expo start
```
Runs the standalone mobile administrative app with full category CRUD, stats, and audit logs.

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
