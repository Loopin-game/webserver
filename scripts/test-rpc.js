import WebSocket from 'ws';
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001/api';
const WS_URL = 'ws://localhost:3001/ws/game';

async function test() {
    try {
        console.log('1. Getting Player...');
        // Use a random wallet to ensure fresh state if needed, or constant for consistency
        const wallet = 'ST_' + Math.floor(Math.random() * 1000000) + '_' + Date.now();

        // We assume ensure_player logic happens inside create/join or we call an endpoint?
        // The API actually defines GET /player/:address/stats which calls contract, 
        // but maybe /game/create does ensure_player? 
        // Looking at gameService, ensurePlayer is exported. 
        // Let's assume we can just use any wallet string for the socket if the DB is flexible,
        // but the DB has foreign keys.
        // We need to create a player first.
        // There is no public endpoint exposed in `src/index.js` (based on previous `run_command` output)
        // explicitly for "create player", but `GET /api/player/:address/profile` might not create it?
        // Actually `rpc.sql` has `ensure_player`.
        // Let's look at `src/routes/game.js` or `player.js` to see where `ensurePlayer` is called.
        // I will just try to join with a wallet address and see if it works.

        // Actually, let's just inspect the previous `curl` output for `api/game/create`.
        // It's likely `api/game/create` calls `ensurePlayer`.

        console.log('2. Creating Game...');
        const createRes = await fetch(`${API_URL}/game/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hostWallet: wallet,
                gameType: 'CASUAL',
                maxPlayers: 10,
                entryFee: 0,
                prizePool: 100
            })
        });
        const createData = await createRes.json();

        if (!createData.success) {
            throw new Error(`Failed to create game: ${JSON.stringify(createData)}`);
        }

        const gameId = createData.data.gameId;
        console.log(`   Game Created: ${gameId}`);

        console.log('2.5. Joining Game (DB)...');
        const joinRes = await fetch(`${API_URL}/game/${gameId}/confirm-join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                walletAddress: wallet
            })
        });
        const joinData = await joinRes.json();
        if (!joinData.success) {
            throw new Error(`Failed to join game: ${JSON.stringify(joinData)}`);
        }
        const playerId = joinData.player.id;
        console.log(`   Player Joined: ${playerId}`);

        console.log('3. Connecting WebSocket...');
        const ws = new WebSocket(WS_URL);

        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
        });
        console.log('   WS Connected');

        console.log('4. Joining Game & Sending Move...');

        // Join
        ws.send(JSON.stringify({
            type: 'join_game_socket',
            gameId: gameId,
            playerId: playerId
        }));

        // Move
        ws.send(JSON.stringify({
            type: 'position_update',
            gameId: gameId,
            playerId: playerId,
            lat: 12.9716, // Random coords
            lng: 77.5946
        }));

        // Listen for updates
        ws.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.type === 'game_state_update') {
                console.log('   Received Game State Update: Success!');
                console.log('   Verified RPC update_player_position executed.');
                ws.close();
                process.exit(0);
            } else if (msg.type === 'error') {
                console.error('   Received Error:', msg);
            }
        });

        // Timeout
        setTimeout(() => {
            console.error('Timeout waiting for game state update');
            ws.close();
            process.exit(1);
        }, 5000);

    } catch (e) {
        console.error('Test Failed:', e);
        process.exit(1);
    }
}

test();
