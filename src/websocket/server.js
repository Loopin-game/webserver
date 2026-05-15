import { WebSocketServer } from 'ws';
import { updatePlayerPosition, getSafePoints, getGameState, cleanupPlayerSession } from '../services/gameService.js';
import { usePowerup, getPowerupInventory } from '../services/powerupService.js';

// Connection state: Map<WebSocket, { playerId: string, activePowerups: Set<string> }>
const connectionStates = new Map();

export const setupWebSocket = (server) => {
    const wss = new WebSocketServer({ server, path: '/ws/game' });

    console.log('socket server setup on /ws/game');

    wss.on('connection', async (ws, req) => {
        console.log('New client connected');

        // Initialize state
        connectionStates.set(ws, { playerId: null, activePowerups: new Set() });

        // Send initial state
        try {
            const safePoints = await getSafePoints();
            const gameState = await getGameState(); // Raw state

            ws.send(JSON.stringify({
                type: 'init',
                safePoints,
                gameState
            }));
        } catch (e) {
            console.error('Error sending init state:', e);
        }

        ws.on('message', async (message) => {
            try {
                console.log('WS Received:', message.toString());
                const data = JSON.parse(message);

                if (data.type === 'join_game_socket') {
                    // Explicit join message to set context
                    const { gameId, playerId } = data;
                    const state = connectionStates.get(ws);
                    if (state) {
                        state.playerId = playerId;
                        state.gameId = gameId;
                    }
                }
                else if (data.type === 'position_update') {
                    const { playerId, gameId, lat, lng } = data;

                    // Allow gameId from message or fallback to state
                    const state = connectionStates.get(ws);
                    const activeGameId = gameId || (state ? state.gameId : null);

                    if (playerId && lat && lng && activeGameId) {
                        // Update State
                        if (state) {
                            state.playerId = playerId;
                            state.gameId = activeGameId;
                        }

                        // Gather Shielded Players IN THIS GAME
                        const shieldedPlayerIds = [];
                        for (const [sWs, sState] of connectionStates.entries()) {
                            if (sState.gameId === activeGameId && sState.playerId && sState.activePowerups.has('shield')) {
                                shieldedPlayerIds.push(sState.playerId);
                            }
                        }

                        // Process Game Mechanics
                        const events = await updatePlayerPosition(activeGameId, playerId, lat, lng, shieldedPlayerIds);

                        // Broadcast State (Scoped to Game)
                        await broadcastGameUpdate(wss, activeGameId, connectionStates);

                        // Broadcast events to players in this game
                        if (events && events.length > 0) {
                            events.forEach(event => {
                                broadcastToGame(wss, activeGameId, event, connectionStates);
                            });
                        }
                    }
                }
                else if (data.type === 'use_powerup') {
                    const { playerId, gameId, powerupId } = data;
                    // Validate and Decrement Inventory
                    const success = await usePowerup(playerId, powerupId);

                    if (success) {
                        const state = connectionStates.get(ws);
                        if (state) {
                            state.activePowerups.add(powerupId);
                            // Set timeout to remove it (e.g. 60s)
                            setTimeout(() => {
                                if (connectionStates.has(ws)) {
                                    connectionStates.get(ws).activePowerups.delete(powerupId);
                                    // Trigger update to refresh visibility
                                    if (state.gameId) broadcastGameUpdate(wss, state.gameId, connectionStates);
                                }
                            }, 60000);
                        }

                        // Notify user
                        ws.send(JSON.stringify({ type: 'powerup_activated', powerupId }));

                        // Refresh state for others (if stealth used)
                        if (state && state.gameId) broadcastGameUpdate(wss, state.gameId, connectionStates);
                    }
                }
            } catch (err) {
                console.error('Error processing message:', err);
            }
        });

        ws.on('close', async () => {
            console.log('Client disconnected');
            const state = connectionStates.get(ws);

            if (state && state.gameId && state.playerId) {
                console.log(`Cleaning up for player ${state.playerId} in game ${state.gameId}`);
                await cleanupPlayerSession(state.gameId, state.playerId);

                // Optional: Broadcast update so others see them disappear immediately
                // Note: If the cleanup is slow, this might not reflect immediately unless we wait.
                // We awaited cleanup above, so DB should be empty now.
                broadcastGameUpdate(wss, state.gameId, connectionStates);
            }

            connectionStates.delete(ws);
        });
    });
};

// Broadcast state to all clients in a specific game
const broadcastGameUpdate = async (wss, gameId, states) => {
    try {
        // Fetch fresh state for this game
        const baseState = await getGameState(gameId);

        // 1. Create a map of active powerups for players in this game
        const powerupMap = new Map();
        for (const [ws, s] of states.entries()) {
            if (s.gameId === gameId && s.playerId) {
                powerupMap.set(s.playerId, s.activePowerups);
            }
        }

        // 2. Send to each client in this game
        wss.clients.forEach((client) => {
            const clientState = states.get(client);
            if (client.readyState === 1 && clientState && clientState.gameId === gameId) {
                const recipientId = clientState.playerId || 'anon';

                // Filter Players
                const visiblePlayers = baseState.players.filter(p => {
                    const pPowerups = powerupMap.get(p.id) || new Set();
                    const isInvisible = pPowerups.has('invisibility'); // or 'stealth'
                    const isMe = p.id === recipientId;
                    return isMe || !isInvisible;
                }).map(p => ({
                    ...p,
                    powerups: Array.from(powerupMap.get(p.id) || [])
                }));

                // Filter Trails
                const visibleTrails = baseState.trails.filter(t => {
                    const pPowerups = powerupMap.get(t.playerId) || new Set();
                    const isInvisible = pPowerups.has('invisibility');
                    const isMe = t.playerId === recipientId;
                    return isMe || !isInvisible;
                });

                const payload = {
                    type: 'game_state_update',
                    state: {
                        ...baseState,
                        players: visiblePlayers,
                        trails: visibleTrails
                    }
                };

                client.send(JSON.stringify(payload));
            }
        });
    } catch (e) {
        console.error(`Error broadcasting game ${gameId}:`, e);
    }
};

const broadcastToGame = (wss, gameId, data, states) => {
    const msg = JSON.stringify(data);
    wss.clients.forEach(client => {
        const s = states.get(client);
        if (client.readyState === 1 && s && s.gameId === gameId) {
            client.send(msg);
        }
    });
};
