import express from 'express';
import { supabase } from '../config/db.js';

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new player
 * Body: { wallet_address, username, avatar_seed (optional) }
 */
router.post('/register', async (req, res) => {
    try {
        const { wallet_address, username, avatar_seed } = req.body;

        // Basic Validation
        if (!wallet_address || !username) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: wallet_address, username',
            });
        }

        // Check if user already exists (by wallet or username)
        const { data: existingUser, error: checkError } = await supabase
            .from('players')
            .select('id')
            .or(`wallet_address.eq.${wallet_address},username.eq.${username}`)
            .maybeSingle();

        if (checkError) {
            throw checkError;
        }

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'Player with this wallet or username already exists',
            });
        }

        // Create new player
        const { data: newPlayer, error: createError } = await supabase
            .from('players')
            .insert([
                {
                    wallet_address,
                    username,
                    avatar_seed: avatar_seed || `seed-${Date.now()}`, // Default if not provided
                    // default values for level, joined_at are handled by DB defaults
                }
            ])
            .select() // Return the created record
            .single();

        if (createError) {
            throw createError;
        }

        // Initialize player stats (optional but good practice for ensuring the record exists)
        const { error: statsError } = await supabase
            .from('player_stats')
            .insert([{ player_id: newPlayer.id }]);

        if (statsError) {
            console.error('Error initializing player stats:', statsError);
            // Non-critical, can proceed or try to cleanup
        }

        res.status(201).json({
            success: true,
            data: newPlayer,
        });

    } catch (error) {
        console.error('Error registering player:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
});

/**
 * POST /api/auth/login
 * Login existing player
 * Body: { wallet_address }
 */
router.post('/login', async (req, res) => {
    try {
        const { wallet_address } = req.body;

        if (!wallet_address) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: wallet_address',
            });
        }

        // "Login" by checking if player exists
        const { data: player, error } = await supabase
            .from('players')
            .select('*')
            .eq('wallet_address', wallet_address)
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // Not found
                return res.status(404).json({
                    success: false,
                    error: 'Player not found',
                });
            }
            throw error;
        }

        res.json({
            success: true,
            data: player,
        });

    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
});

export default router;
