# Loopin WebServer

The Node.js backend service for Loopin, handling game logic, custom authentication, and real-time state synchronization via WebSockets.

## Features

- **Custom Authentication**: Wallet-based login and registration (bypassing Supabase Auth specific limitations).
- **Real-Time Game Mechanics**:
  - **Trail Formation**: Tracking player movement using PostGIS.
  - **Territory Capture**: Detecting loop closures to claim area.
  - **PVP Interactions**: "Severing" trails of opponents upon collision.
  - **Safe Zones**: Protected areas where trails are banked automatically.
- **WebSocket Communication**: Broadcasting highly optimized, delta-compressed game states to connected clients.
- **Microservices**: Includes endpoints for Ads, Powerups, and Player Stats.

## Prerequisites

- **Node.js** v16+
- **Supabase Project**: With PostgreSQL and PostGIS extension enabled.
- **Stacks Blockchain**: (Optional) For on-chain game session management.

## Setup & Deployment

### 1. Environment Variables

Create a `.env` file in the root of `WebServer` with the following:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_role_key
# Optional: Blockchain keys if using smart contracts directly
PRIVATE_KEY=your_stacks_private_key
```

### 2. Database Setup

You must apply the following SQL files to your Supabase project in order:

1. **Schema**: Apply `schema.sql` (located in project root) to set up tables and types.
2. **RPC Functions**: Apply `rpc.sql` (located in project root) to install critical game logic functions.
    - *Note*: The `rpc.sql` file contains the logic for `update_player_position_rpc`, which handles complex spatial interactions. **This is required for gameplay.**

### 3. Installation

```bash
cd WebServer
npm install
```

### 4. Running the Server

**Development Mode:**

```bash
npm run dev
# Server will start on port 3001
# WebSocket available at ws://localhost:3001/ws/game
```

**Production Mode:**

```bash
npm start
```

### Azure Deployment

The WebServer is deployed as an Azure Web App:

- **Base URL:** `https://loopin-server.azurewebsites.net`
- **WebSocket Endpoint:** `wss://loopin-server.azurewebsites.net/ws/game`

## API Documentation

### Authentication

- `POST /api/auth/register`
  - Body: `{ "wallet_address": "ST...", "username": "..." }`
  - Returns: `{ "success": true, "data": { "id": "uuid", ... } }`
- `POST /api/auth/login`
  - Body: `{ "wallet_address": "ST..." }`
  - Returns: User profile.

### Player Data

- `GET /api/player/:address/profile`: Full profile including **Inventory** (Powerups owned) and Stats.
- `GET /api/player/:address/stats`: On-chain stats.

### Powerups

- `POST /api/powerup/purchase`: Buy a powerup.
  - Body: `{ "playerId": "...", "powerupId": "shield" }`
- `GET /api/powerup/:playerId/inventory`: Get specifically the inventory list.

### Game Management

- `POST /api/game/create`: Create a new lobby.
- `POST /api/game/start`: Start a session.
- `GET /api/game/:id`: Fetch session details.

### WebSocket Events

Connect to `/ws/game`.

**Client -> Server:**

- `position_update`: `{ "type": "position_update", "playerId": "...", "lat": 1.0, "lng": 1.0 }`
- `use_powerup`: `{ "type": "use_powerup", "playerId": "...", "powerupId": "shield" }`

**Server -> Client:**

- `init`: sent on connection with full game state.
- `game_state_update`: periodic broadcast of visible players and trails.
- `territory_captured`: when a player closes a loop.
- `trail_severed`: when a player cuts another's trail.

## Verification

Scripts are provided in `scripts/` to verify the system:

- `npm run verify-auth`: Tests registration and login.
- `npm run verify-mechanics`: Simulates a full game scenario with two players (movement, trail formation, loop closure).
- `npm run verify-all`: comprehensive check of all endpoints.
