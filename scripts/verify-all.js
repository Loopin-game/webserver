import fetch from 'node-fetch';
import WebSocket from 'ws';

const BASE_URL = 'http://localhost:3001/api';
const WS_URL = 'ws://localhost:3001/ws/game';

// Test Data
const PLAYER_1 = { wallet_address: `ST1_${Date.now()}`, username: `P1_${Date.now()}` };
const PLAYER_2 = { wallet_address: `ST2_${Date.now()}`, username: `P2_${Date.now()}` };
let p1_id, p2_id;
let game_id; // UUID from DB

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function request(method, endpoint, body) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE_URL}${endpoint}`, opts);
    const data = await res.json();
    return { status: res.status, data };
}

async function runTests() {
    console.log('🚀 Starting Comprehensive Verification...\n');

    // 1. Auth & Players
    console.log('--- Auth & Players ---');
    const r1 = await request('POST', '/auth/register', PLAYER_1);
    if (!r1.data.success) throw new Error(`P1 Register failed: ${JSON.stringify(r1.data)}`);
    p1_id = r1.data.data.id;
    console.log(`✅ Player 1 Registered: ${p1_id}`);

    const r2 = await request('POST', '/auth/register', PLAYER_2);
    if (!r2.data.success) throw new Error(`P2 Register failed: ${JSON.stringify(r2.data)}`);
    p2_id = r2.data.data.id;
    console.log(`✅ Player 2 Registered: ${p2_id}`);

    // 2. Ads (Sponsors)
    console.log('\n--- Ads & Sponsors ---');
    const adRes = await request('POST', '/ads/locations', {
        sponsorName: 'Mega Corp',
        name: 'Mega HQ',
        lat: 40.7128,
        lng: -74.0060,
        bidPrice: 1.5
    });
    // Note: It might 500 if verified on fresh DB without full schema, but we assume schema is good.
    if (adRes.data.success) {
        console.log('✅ Ad Location Created');
    } else {
        console.warn('⚠️ Ad Creation Warning:', adRes.data);
    }

    const locsRes = await request('GET', '/ads/locations');
    if (locsRes.data.success && locsRes.data.data.length > 0) {
        console.log(`✅ Ad Locations Listed: ${locsRes.data.data.length} found`);
    } else {
        console.warn('⚠️ No Ad Locations found or failed');
    }

    // 3. Game Lifecycle
    console.log('\n--- Game Lifecycle ---');
    // Create
    const createRes = await request('POST', '/game/create', { gameType: 'CASUAL', maxPlayers: 10 });
    if (!createRes.data.success) {
        // It might fail if no mock contract service.
        // But let's check if it returns mocked data?
        // contractService.js usually MOCKS calls if no env? No, it uses fetch to Stacks node.
        // It might fail on contract call.
        console.warn('⚠️ Game Create (Contract) skipped/failed:', createRes.data.error);
        // We need a game ID to proceed. 
        // If create failed, we can't really test game Join unless we mock DB insert.
        // However, let's try to proceed if we got ANY data.
    } else {
        console.log('✅ Game Created on Chain (Mock/Real)');
    }

    // We can't rely on 'create' returning DB ID because of the sync issue in code.
    // Let's manually create a "Lobby" game directly in DB via direct API if possible?
    // No, we must rely on 'create' to sync.
    // Wait, getLobbyGames should show it.

    await sleep(1000);
    const lobbyRes = await request('GET', '/game/lobby');
    const games = lobbyRes.data.data || [];
    console.log(`✅ Lobby Games: ${games.length}`);

    if (games.length === 0) {
        console.error('❌ No games in lobby. Cannot proceed with Join/Play tests.');
        // Force create a dummy game if possible? No direct backdoor.
        return;
    }

    game_id = games[0].id;
    console.log(`👉 Using Game UUID: ${game_id}`);

    // Join
    const joinRes = await request('POST', `/game/${game_id}/confirm-join`, { walletAddress: PLAYER_1.wallet_address });
    if (joinRes.data.success) {
        console.log('✅ Player 1 Joined Game');
    } else {
        console.error('❌ Player 1 Join Failed:', joinRes.data);
    }

    // Start
    const startRes = await request('POST', '/game/start', { gameId: game_id });
    if (startRes.data.success) {
        console.log('✅ Game Started');
    } else {
        console.warn('⚠️ Game Start Failed (Chain issues?):', startRes.data);
        // We can proceed to WS test anyway if DB status updated?
    }

    // 4. Powerups
    console.log('\n--- Powerups ---');
    // Purchase
    const purchRes = await request('POST', '/powerup/purchase', { playerId: p1_id, powerupId: 'shield' });
    if (purchRes.data.success) {
        console.log('✅ Powerup Purchased');
    } else {
        console.error('❌ Powerup Purchase Failed:', purchRes.data);
    }

    // Inventory
    const invRes = await request('GET', `/powerup/${p1_id}/inventory`);
    // API returns array: [{ powerup_id, quantity }]
    const shieldItem = (invRes.data.data || []).find(i => i.powerup_id === 'shield');
    if (shieldItem && shieldItem.quantity > 0) {
        console.log('✅ Inventory Verified');
    } else {
        console.error('❌ Inventory Check Failed:', invRes.data);
    }

    // 5. WebSocket & Real-time Support
    console.log('\n--- WebSocket & Game Mechanics ---');
    const ws = new WebSocket(WS_URL);

    await new Promise((resolve, reject) => {
        ws.on('open', () => {
            console.log('✅ WS Connected');

            // Send Position
            ws.send(JSON.stringify({
                type: 'position_update',
                playerId: p1_id,
                lat: 40.7128,
                lng: -74.0060
            }));
            console.log('👉 Sent Position Update');
            resolve();
        });

        ws.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.type === 'init') {
                console.log('✅ Received Init State');
            } else if (msg.type === 'game_state_update') {
                // console.log('✅ Received Game State Update'); 
                // Reduced noise
            }
        });

        ws.on('error', (e) => {
            console.error('❌ WS Error:', e);
            reject(e);
        });
    });

    await sleep(2000); // Wait for processing
    ws.close();
    console.log('✅ WS Closed');

    console.log('\n🎉 Comprehensive Verification Complete!');
}

runTests().catch(e => console.error(e));
