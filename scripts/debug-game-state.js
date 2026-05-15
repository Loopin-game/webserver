import { getGameState } from '../src/services/gameService.js';

async function debugState() {
    console.log('🔍 Debugging Game State...');
    try {
        const state = await getGameState();
        console.log('State Keys:', Object.keys(state));
        console.log('Trails Count:', state.trails.length);
        if (state.trails.length > 0) {
            console.log('Sample Trail:', JSON.stringify(state.trails[0], null, 2));
        }
        console.log('Territories Count:', state.territories.length);
    } catch (e) {
        console.error('Error getting state:', e);
    }
}
debugState();
