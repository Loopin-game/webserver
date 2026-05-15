import { supabase } from '../config/db.js';

/**
 * Purchases a powerup (upsert inventory)
 */
export const purchasePowerup = async (playerId, powerupId) => {
    // Check if player exists
    const { data: player } = await supabase.from('players').select('id').eq('id', playerId).single();
    if (!player) throw new Error('Player not found');

    // Get current quantity
    const { data: current } = await supabase
        .from('player_powerups')
        .select('quantity')
        .match({ player_id: playerId, powerup_id: powerupId })
        .single();

    const newQuantity = (current?.quantity || 0) + 1;

    // Upsert
    const { data, error } = await supabase
        .from('player_powerups')
        .upsert({
            player_id: playerId,
            powerup_id: powerupId,
            quantity: newQuantity
        }, { onConflict: 'player_id, powerup_id' })
        .select();

    if (error) throw new Error(error.message);
    return data[0];
};

/**
 * Uses a powerup (decrement inventory)
 */
export const usePowerup = async (playerId, powerupId) => {
    const { data: current, error: fetchError } = await supabase
        .from('player_powerups')
        .select('quantity')
        .match({ player_id: playerId, powerup_id: powerupId })
        .single();

    if (fetchError || !current || current.quantity < 1) {
        throw new Error('Powerup not available');
    }

    const { data, error } = await supabase
        .from('player_powerups')
        .update({ quantity: current.quantity - 1 })
        .match({ player_id: playerId, powerup_id: powerupId })
        .select();

    if (error) throw new Error(error.message);
    return data[0];
};

/**
 * Get player inventory
 */
export const getPowerupInventory = async (playerId) => {
    const { data, error } = await supabase
        .from('player_powerups')
        .select('powerup_id, quantity')
        .eq('player_id', playerId);

    if (error) throw new Error(error.message);
    return data;
};
