import express from 'express';
import { purchasePowerup, getPowerupInventory } from '../services/powerupService.js';

const router = express.Router();

/**
 * POST /api/powerup/purchase
 * Purchase a powerup (Mock payment for now)
 */
router.post('/purchase', async (req, res) => {
    try {
        const { playerId, powerupId } = req.body;

        if (!playerId || !powerupId) {
            return res.status(400).json({ success: false, error: 'Missing playerId or powerupId' });
        }

        // Mock Payment Verification (TODO: Verify Stacks Tx)
        // ...

        const inventory = await purchasePowerup(playerId, powerupId);

        res.json({
            success: true,
            data: inventory
        });
    } catch (e) {
        console.error("Purchase error", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * GET /api/powerup/:playerId/inventory
 */
router.get('/:playerId/inventory', async (req, res) => {
    try {
        const { playerId } = req.params;
        const inventory = await getPowerupInventory(playerId);
        res.json({ success: true, data: inventory });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
