
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

const ws = new WebSocket('ws://localhost:3001/ws/game');

ws.on('open', function open() {
    console.log('Connected to WebSocket');

    const gameId = uuidv4();
    const playerId = uuidv4();

    console.log(`Simulating join for Game: ${gameId}, Player: ${playerId}`);

    ws.send(JSON.stringify({
        type: 'join_game_socket',
        gameId: gameId,
        playerId: playerId
    }));

    setTimeout(() => {
        console.log('Disconnecting...');
        ws.close();
    }, 2000);
});

ws.on('close', function close() {
    console.log('Disconnected');
});

ws.on('error', console.error);
