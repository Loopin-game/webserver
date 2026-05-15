import WebSocket from 'ws';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api';
const WS_URL = 'ws://localhost:3001/ws/game';

async function registerPlayer(tag) {
    const ts = Date.now();
    const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            wallet_address: `ST_${tag}_${ts}`,
            username: `User_${tag}_${ts}`
        })
    });
    const json = await res.json();
    return json.data.id;
}

function createClient(playerId) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        const received = [];

        ws.on('open', () => {
            console.log(`[${playerId}] WS Open`);
            resolve({ ws, received });
        });
        ws.on('message', (data) => {
            // console.log(`[${playerId}] Raw Data Length: ${data.length}`);
            try {
                const msg = JSON.parse(data);
                received.push(msg);
                if (msg.type === 'game_state_update') {
                    // Keep latest state?
                }
            } catch (e) {
                console.error(`[${playerId}] Parse Error:`, e);
            }
        });
        ws.on('error', (e) => {
            console.error(`[${playerId}] WS Error:`, e);
            reject(e);
        });
        ws.on('close', () => console.log(`[${playerId}] WS Closed`));
    });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runTest() {
    console.log('🎮 Starting Game Mechanics Verification...');

    // 1. Setup Players
    const p1 = await registerPlayer('P1');
    const p2 = await registerPlayer('P2');
    console.log(`✅ Registered P1 (${p1}) and P2 (${p2})`);

    // 2. Connect WS
    const c1 = await createClient(p1);
    const c2 = await createClient(p2);
    console.log('✅ WS Connected for both');

    // Register P2
    c2.ws.send(JSON.stringify({ type: 'position_update', playerId: p2, lat: 20, lng: 20 }));
    await sleep(200);

    // 3. Simulate Trail Formation (P1 moves in a line)
    console.log('\n--- Testing Trail Formation ---');
    // Move East
    const moves = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 0, lng: 2 },
        { lat: 0, lng: 3 }
    ];

    for (const m of moves) {
        c1.ws.send(JSON.stringify({
            type: 'position_update',
            playerId: p1,
            lat: m.lat,
            lng: m.lng
        }));
        await sleep(200);
    }

    // Verify P2 sees P1's trail
    await sleep(3000);
    console.log(`P2 Total Msgs: ${c2.received.length}`);

    // Find last state
    const lastStateP2 = c2.received.slice().reverse().find(m => m.type === 'game_state_update');
    const p1Trail = lastStateP2?.state?.trails?.find(t => t.playerId === p1);

    if (p1Trail) {
        console.log('✅ P2 sees P1 trail');
    } else {
        console.error('❌ P2 did NOT see P1 trail');
        // console.log('Received types:', c2.received.map(m => m.type));
    }

    // 4. Simulate Loop Closure (Territory)
    console.log('\n--- Testing Loop Closure ---');
    // P1 moves to form a clear square: (0,3) is current.
    // Move Up to (3,3)
    c1.ws.send(JSON.stringify({ type: 'position_update', playerId: p1, lat: 3, lng: 3 }));
    await sleep(200);
    // Move Left to (3,0)
    c1.ws.send(JSON.stringify({ type: 'position_update', playerId: p1, lat: 3, lng: 0 }));
    await sleep(200);
    // Close to Start (0,0)
    c1.ws.send(JSON.stringify({ type: 'position_update', playerId: p1, lat: 0, lng: 0 }));
    await sleep(200);

    // Check for 'territory_captured' event
    await sleep(2000);
    const capEvent = c1.received.find(m => m.type === 'territory_captured');
    if (capEvent) {
        console.log('✅ P1 Received Territory Captured Event!', JSON.stringify(capEvent));
    } else {
        console.warn('⚠️ Loop Closure did not trigger event (Check SQL logic or coordinate precision)');
    }

    // 5. PVP Trail Severing
    console.log('\n--- Testing PVP Trail Severing ---');
    // P1 acts as victim, moves to (10,10) then (10,15)
    c1.ws.send(JSON.stringify({ type: 'position_update', playerId: p1, lat: 10, lng: 10 }));
    await sleep(200);
    c1.ws.send(JSON.stringify({ type: 'position_update', playerId: p1, lat: 10, lng: 15 }));
    await sleep(200);

    // P2 acts as attacker, crosses line: (9,12) -> (11,12)
    c2.ws.send(JSON.stringify({ type: 'position_update', playerId: p2, lat: 9, lng: 12 }));
    await sleep(200);
    c2.ws.send(JSON.stringify({ type: 'position_update', playerId: p2, lat: 11, lng: 12 }));
    await sleep(2000);

    const severEvent = c1.received.find(m => m.type === 'trail_severed');
    if (severEvent) {
        console.log('✅ P1 Recv Trail Severed!');
    } else {
        console.warn('⚠️ No Trail Severed Event');
    }

    // 6. Safe Points
    const initMsg = c1.received.find(m => m.type === 'init');
    if (initMsg && initMsg.safePoints) {
        console.log(`✅ Init received ${initMsg.safePoints.length} safe points`);
    } else {
        console.error('❌ No Safe Points in Init');
    }

    c1.ws.close();
    c2.ws.close();
    console.log('\n🎉 Mechanics Verification Finished');
}

runTest();
