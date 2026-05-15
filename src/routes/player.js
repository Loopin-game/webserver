import express from 'express';
import * as contractService from '../services/contract.js';
import * as gameService from '../services/gameService.js';

import { supabase } from '../config/db.js';

const router = express.Router();

/**
 * GET /api/player/:address/profile
 * Get full player profile including inventory (for Frontend)
 */
router.get('/:address/profile', async (req, res) => {
    try {
        const { address } = req.params;

        const { data: player, error } = await supabase
            .from('players')
            .select(`
                id, wallet_address, username, avatar_seed, level, joined_at,
                player_stats (total_area, games_won),
                player_powerups (powerup_id, quantity)
            `)
            .eq('wallet_address', address)
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // Not found
                return res.status(404).json({ success: false, error: 'Player not found' });
            }
            throw error;
        }

        // Format Inventory
        const inventory = {};
        if (player.player_powerups) {
            player.player_powerups.forEach(p => {
                inventory[p.powerup_id] = p.quantity;
            });
        }

        res.json({
            success: true,
            data: {
                id: player.id,
                wallet_address: player.wallet_address,
                username: player.username,
                avatar_seed: player.avatar_seed,
                level: player.level,
                joined_at: player.joined_at,
                stats: player.player_stats?.[0] || {},
                inventory: inventory
            }
        });
    } catch (error) {
        console.error('Error getting player profile:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/player/:address/stats
 * Query chain=stacks|solana (default solana uses DB stats)
 */
router.get('/:address/stats', async (req, res) => {
    try {
        const { address } = req.params;
        const chain = (req.query.chain || 'solana').toLowerCase();

        if (!address) {
            return res.status(400).json({
                success: false,
                error: 'Player address is required',
            });
        }

        if (chain === 'stacks') {
            const result = await contractService.getPlayerStats(address);
            return res.json({
                success: true,
                data: result,
            });
        }

        const stats = await gameService.getPlayerStatsFromDb(address);
        if (!stats) {
            return res.status(404).json({
                success: false,
                error: 'Player not found',
            });
        }

        return res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.error('Error getting player stats:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
