import express from 'express';
import * as chainRouter from '../services/chain-router.js';
import * as gameService from '../services/gameService.js';

const router = express.Router();

const defaultChain = (req) =>
    (req.body && req.body.chain) ||
    (req.query && req.query.chain) ||
    'solana';

/**
 * GET /api/game/lobby
 * List active games in lobby
 */
router.get('/lobby', async (req, res) => {
    try {
        const { rows } = await gameService.getLobbyGames();
        res.json({ success: true, data: rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * GET /api/game/next-id
 * Games use UUIDs from the database — create via POST /api/game/create
 */
router.get('/next-id', async (req, res) => {
    res.json({
        success: true,
        data: {
            message: 'Game sessions use UUID primary keys. Use POST /api/game/create to start a new session.',
            nextId: null,
        },
    });
});

/**
 * GET /api/game/token-info
 * $LOOPIN / Bags metadata for clients
 */
router.get('/token-info', (req, res) => {
    try {
        res.json({ success: true, data: chainRouter.getTokenInfo() });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * GET /api/game/entry-fee-info
 * Query: chain=solana&entryFee=0.01
 */
router.get('/entry-fee-info', (req, res) => {
    try {
        const chain = defaultChain(req);
        const entryFee = parseFloat(String(req.query.entryFee || '0'));
        const info = chainRouter.getEntryFeeInfo(chain, Number.isFinite(entryFee) ? entryFee : 0);
        res.json({ success: true, data: info });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/game/create
 * Create a new game
 */
router.post('/create', async (req, res) => {
    try {
        const { gameType, maxPlayers } = req.body;

        if (!gameType || !maxPlayers) {
            return res.status(400).json({
                success: false,
                error: 'gameType and maxPlayers are required',
            });
        }

        const validTypes = ['CASUAL', 'BLITZ', 'ELITE'];
        if (!validTypes.includes(gameType)) {
            return res.status(400).json({
                success: false,
                error: 'gameType must be CASUAL, BLITZ, or ELITE',
            });
        }

        const newGameId = await gameService.createGameSession(
            null,
            gameType,
            maxPlayers,
            0,
            0
        );

        console.log(`Created DB session ${newGameId}`);

        res.json({
            success: true,
            data: {
                gameId: newGameId,
                txId: 'mock_tx_uuid_mode',
            },
        });
    } catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/game/start
 */
router.post('/start', async (req, res) => {
    try {
        const { gameId } = req.body;

        if (!gameId) {
            return res.status(400).json({
                success: false,
                error: 'gameId is required',
            });
        }

        await gameService.updateGameStatus(gameId, 'active');

        res.json({
            success: true,
            data: { success: true, gameId },
        });
    } catch (error) {
        console.error('Error starting game:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/game/end
 */
router.post('/end', async (req, res) => {
    try {
        const { gameId } = req.body;

        if (!gameId) {
            return res.status(400).json({
                success: false,
                error: 'gameId is required',
            });
        }

        await gameService.updateGameStatus(gameId, 'ended');

        res.json({
            success: true,
            data: { success: true, gameId },
        });
    } catch (error) {
        console.error('Error ending game:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/game/submit-results
 */
router.post('/submit-results', async (req, res) => {
    try {
        const { gameId, playerAddress, areaCaptured, rank } = req.body;

        if (!gameId || !playerAddress || areaCaptured === undefined || rank === undefined) {
            return res.status(400).json({
                success: false,
                error: 'gameId, playerAddress, areaCaptured, and rank are required',
            });
        }

        try {
            const player = await gameService.ensurePlayer(playerAddress);
            const session = await gameService.getGameSession(gameId);

            if (player && session) {
                const prize = rank === 1 ? session.prize_pool : 0;

                await gameService.recordGameResult(
                    session.id,
                    player.id,
                    rank,
                    areaCaptured,
                    prize
                );
            }
        } catch (e) {
            console.error('DB Sync failed for submit-result', e);
            throw e;
        }

        res.json({
            success: true,
            data: { success: true },
        });
    } catch (error) {
        console.error('Error submitting results:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/game/distribute-prize
 * Body: { gameId, playerAddress, prizeAmount, chain? }
 */
router.post('/distribute-prize', async (req, res) => {
    try {
        const { gameId, playerAddress, prizeAmount } = req.body;

        if (gameId === undefined || !playerAddress || prizeAmount === undefined) {
            return res.status(400).json({
                success: false,
                error: 'gameId, playerAddress, and prizeAmount are required',
            });
        }

        const chain = defaultChain(req);
        const result = await chainRouter.distributePrize(
            chain,
            gameId,
            playerAddress,
            prizeAmount
        );

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Error distributing prize:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/game/:gameId/confirm-join
 */
router.post('/:gameId/confirm-join', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { walletAddress } = req.body;

        if (!walletAddress) {
            return res.status(400).json({
                success: false,
                error: 'walletAddress is required',
            });
        }

        const player = await gameService.ensurePlayer(walletAddress);
        await gameService.joinGame(player.id, gameId);

        res.json({
            success: true,
            message: 'Player joined game session',
            player,
        });
    } catch (error) {
        console.error('Error joining game:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/game/:gameId/participant/:address
 */
router.get('/:gameId/participant/:address', async (req, res) => {
    try {
        const { gameId, address } = req.params;

        const result = await gameService.getGameParticipantByWallet(gameId, address);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Error getting participant:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/game/:gameId/player-count
 */
router.get('/:gameId/player-count', async (req, res) => {
    try {
        const { gameId } = req.params;
        const count = await gameService.getGameParticipantCount(gameId);

        res.json({
            success: true,
            data: count,
        });
    } catch (error) {
        console.error('Error getting player count:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/game/:gameId
 */
router.get('/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;

        let session = null;
        try {
            session = await gameService.getGameSession(gameId);
        } catch (e) {
            console.warn('Session not found', e);
        }

        const localState = await gameService.getGameState(gameId);

        res.json({
            success: true,
            data: {
                ...session,
                localState,
            },
        });
    } catch (error) {
        console.error('Error getting game:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
