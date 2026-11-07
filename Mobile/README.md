# 📱 Imposter Mobile Application (React Native / Expo)

A complete native mobile application reproducing the **Imposter Multiplayer Party Game** web application for Android and iOS devices.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd Mobile
npm install
```

### 2. Configure Backend Host (Emulator vs Physical Device)
By default:
- **Android Emulator**: connects automatically to `http://10.0.2.2:5000`
- **iOS Simulator / Local**: connects automatically to `http://localhost:5000`
- **Physical Device**: to test on a physical phone via Expo Go or a dev build, ensure your computer and phone are on the same Wi-Fi network and update `CONFIG.API_URL` and `CONFIG.SOCKET_URL` in `src/config/constants.ts` with your local IP (e.g. `http://192.168.1.X:5000`).

### 3. Start Development Server
```bash
npm start
# or
npx expo start
```
- Press `a` to open on an Android emulator / connected device.
- Press `i` to open on an iOS simulator (macOS required).
- Scan the QR code with the Expo Go app or a development build.

---

## 📁 Mobile Project Architecture

```text
Mobile/
├── App.tsx                   # Top-level providers (Safe Area, Auth, Socket, Voice, Root Navigator)
├── app.json                  # Expo application configuration & assets
├── tsconfig.json             # TypeScript configuration
├── package.json              # Native dependencies & Expo SDK 58 modules
└── src/
    ├── types/                # TypeScript contracts for Room, Player, Role, Settings, Results
    ├── config/               # Network endpoints (API_URL, SOCKET_URL) and Storage keys
    ├── theme/                # Cyber-deduction visual tokens (colors, gradients, typography, shadows)
    ├── utils/                # Persistent device UUID, authoritative server time sync, haptics
    ├── services/             # Centralized API service layer (Auth, Room, Admin, Categories)
    ├── context/              # AuthContext, SocketContext, VoiceChatContext
    ├── components/           # Custom reusable mobile UI components:
    │   ├── common/           # GradientButton, Card, Badge, Header
    │   ├── PlayerAvatar.tsx  # Deterministic gradient avatar with host crown & status indicators
    │   ├── CountdownTimer.tsx # Monotonic authoritative countdown timer
    │   ├── DisconnectedBanner.tsx # Lobby disconnect countdown banner
    │   ├── VoiceControls.tsx # Microphone and speaker toggles
    │   ├── EditUsernameModal.tsx # Profile editor with 8 avatar choices
    │   ├── KickConfirmModal.tsx # Host player removal confirmation
    │   ├── RejoinApprovalModal.tsx # Host 45-second approval dialog
    │   ├── RejoinWaitingModal.tsx # Kicked player pending approval modal
    │   └── CategorySelectorModal.tsx # Multi-category picker with search & groups
    ├── screens/              # 1:1 Native Screen Implementations:
    │   ├── HomeScreen.tsx    # Join room, Create lobby, Pass & Play, Leaderboard, Rules
    │   ├── LobbyScreen.tsx   # Player roster, host settings, category selector, kick controls
    │   ├── GameViewScreen.tsx# Role reveal, turn clues, voting, spectators, winner reveal
    │   ├── PassAndPlayScreen.tsx # Single-device local party mode with screen shielding
    │   ├── LeaderboardScreen.tsx # Hall of fame rankings with medal cards
    │   ├── AdminLoginScreen.tsx  # Administrator authentication portal
    │   └── AdminDashboardScreen.tsx # Category CRUD, MongoDB 1-click seeding, audit logs
    └── navigation/           # React Navigation stack & global kicked/toast overlays
```

---

## 🎨 Visual Parity & Design System

The mobile application strictly reproduces the visual identity of the React web app:
- **Base Theme**: Deep dark backgrounds (`#07090e`, `#0d1117`, `#161e2e`).
- **Imposter Glow**: Rose 500 (`#f43f5e`), vibrant glow (`#ff1e56`).
- **Civilian Glow**: Cyan 500 (`#06b6d4`), cyan glow (`#00f2fe`).
- **Gradients**: Rose-pink gradient for primary actions, cyan-blue for secondary actions, purple for Pass & Play.
- **Glassmorphism**: Translucent dark cards with 1px slate borders and elevated shadows.

---

## 🔄 Real-Time Synchronization & Game Mechanics

1. **Authoritative Clock Sync**: Independent of local device system time, measured using monotonic RTT offsets.
2. **Persistent Device Identity**: Unique UUID generated and stored in AsyncStorage/SecureStore.
3. **Turn-based Clues**: Active player turn tracking with instant victory secret word guessing for Imposters.
4. **Voting & Eliminations**: Live progress tracking, vote skipping, and spectator view for eliminated participants.
5. **Disconnect Protection**: Lobby and in-game disconnect grace periods.

