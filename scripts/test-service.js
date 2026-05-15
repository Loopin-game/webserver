import dotenv from 'dotenv';
dotenv.config();

import { updatePlayerPosition, createGameSession, ensurePlayer, joinGame } from '../src/services/gameService.js';

// Mock Supabase/DB connection is handled by src/config/db.js loading via dotenv
// We just need to make sure we are not running as a module that fails to load imports.
// package.json type: module handles imports.

async function test() {
    try {
        console.log('1. Setup...');
        const wallet = 'ST_' + Math.floor(Math.random() * 1000000);

        console.log('2. Ensure Player...');
        const player = await ensurePlayer(wallet);
        console.log('   Player:', player.id);

        console.log('3. Create Game...');
        const gameId = await createGameSession(null, 'CASUAL', 10, 0, 0);
        console.log('   Game:', gameId);

        console.log('4. Join Game...');
        await joinGame(player.id, gameId);
        console.log('   Joined.');

        console.log('5. Update Position (Simulate Move)...');
        // Random coords
        const lat = 12.9 + Math.random();
        const lng = 77.5 + Math.random();

        const events = await updatePlayerPosition(gameId, player.id, lat, lng, []);
        console.log('   Update Result (Events):', events);

        if (Array.isArray(events)) {
            console.log('SUCCESS: RPC executed and returned events array.');
        } else {
            console.error('FAILURE: Unexpected result format.');
            process.exit(1);
        }

        process.exit(0);
    } catch (e) {
        console.error('TEST FAILED:', e);
        process.exit(1);
    }
}

test();
