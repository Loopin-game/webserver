import { supabase } from '../config/db.js';

export const createGameSession = async (gameId, gameType, maxPlayers, entryFee, prizePool) => {
    const { data, error } = await supabase
        .from('game_sessions')
        .insert([{
            game_type: gameType,
            max_players: maxPlayers,
            entry_fee: entryFee,
            prize_pool: prizePool,
            status: 'lobby',
            start_time: new Date().toISOString()
        }])
        .select('id')
        .single();

    if (error) throw new Error(error.message);
    return data.id;
};

export const ensurePlayer = async (walletAddress) => {
    // Calling RPC function defined in Supabase
    const { data, error } = await supabase.rpc('ensure_player', {
        p_wallet: walletAddress,
        p_username_default: `Player ${walletAddress.substr(0, 6)}`
    });

    if (error) throw new Error(error.message);
    // RPC returns a table, but usually as an array of objects
    return data[0]; // { id, username, wallet_address }
};

export const joinGame = async (playerUuid, gameUuid) => {
    const { error } = await supabase.rpc('join_game', {
        p_game_id: gameUuid,
        p_player_id: playerUuid
    });
    if (error) throw new Error(error.message);
};

export const updateGameStatus = async (gameId, status) => {
    const { error } = await supabase
        .from('game_sessions')
        .update({ status: status })
        .eq('id', gameId);

    if (error) throw new Error(error.message);
};

export const getGameSession = async (gameId) => {
    const { data, error } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', gameId)
        .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message); // PGRST116 is 'not found'
    return data;
};

export const getLobbyGames = async () => {
    // Returns { rows: ... } structure to match previous interface for routes? 
    // Or we update routes. Let's return object that mimics 'pg' result or just raw data.
    // Better to return raw data and update routes.
    const { data, error } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('status', 'lobby')
        .order('start_time', { ascending: false });

    if (error) throw new Error(error.message);
    return { rows: data }; // Keeping { rows } format for minimal route changes
};

export const recordGameResult = async (gameUuid, playerUuid, rank, areaCaptured, prizeWon) => {
    const { error } = await supabase.rpc('record_game_result', {
        p_game_id: gameUuid,
        p_player_id: playerUuid,
        p_rank: rank,
        p_area: areaCaptured,
        p_prize: prizeWon
    });
    if (error) throw new Error(error.message);
};

export const severPlayerTrail = async (gameId, playerId) => {
    const { error } = await supabase.rpc('sever_player_trail', {
        p_game_id: gameId,
        p_player_id: playerId
    });
    if (error) {
        console.error(`Error severing trail for player ${playerId}:`, error);
        // We log but don't throw to avoid crashing the main loop
    }
};

/**
 * Updates a player's trail and checks for game events (loops, collisions).
 */
// Helper for retrying async operations
const withRetry = async (fn, retries = 3, delay = 1000) => {
    try {
        return await fn();
    } catch (err) {
        if (retries === 0) throw err;
        await new Promise(res => setTimeout(res, delay));
        return withRetry(fn, retries - 1, delay * 2);
    }
};

export const updatePlayerPosition = async (gameId, playerId, lat, lng, shieldedPlayerIds = []) => {
    try {
        // Calls the complex PostGIS logic via RPC
        const { data, error } = await withRetry(async () => {
            const res = await supabase.rpc('update_player_position_rpc', {
                p_game_id: gameId,
                p_player_id: playerId,
                p_lat: lat,
                p_lng: lng,
                p_shielded_ids: shieldedPlayerIds
            });

            // Force retry if there's an error (e.g. network timeout returned as error object)
            if (res.error) throw res.error;
            return res;
        });

        if (error) {
            console.error('RPC Error:', error);
            return [];
        }

        // RPC returns rows = events
        // Transform to match event structure if needed
        // The RPC returns (event_type, attacker_id, victim_id, area_added)

        // We map snake_case from DB to camelCase for WS
        const events = (data || []).map(evt => {
            const e = { type: evt.event_type };
            if (evt.event_type === 'territory_captured') {
                e.playerId = evt.attacker_id;
                e.areaAdded = evt.area_added;
            } else if (evt.event_type === 'trail_severed') {
                e.attackerId = evt.attacker_id;
                e.victimId = evt.victim_id;

                // DEADLOCK RESOLUTION: 
                // The DB transaction only returned the event. We must now apply the severing.
                if (evt.victimId) {
                    // Fire and forget (or await if critical consistency needed)
                    // We await to ensure the "Severed" state is likely in DB before clients query it
                    withRetry(() => severPlayerTrail(gameId, evt.victimId)).catch(err => console.error(err));
                }
            } else if (evt.event_type === 'trail_banked') {
                e.playerId = evt.attacker_id; // we reused column
            }
            return e;
        });

        return events;
    } catch (error) {
        console.error('RPC Error (after retries):', error);
        return [];
    }
};

export const getGameState = async (gameId) => {
    // We can fetch table data normally. 
    // PostGIS geometries are returned as WKB/HEX by default in Supabase query builder?
    // Actually, Supabase JS client handles GeoJSON if we select it specifically using PostGIS functions in select?
    // No, standard `select` returns the column based on DB setup. 
    // For PostGIS columns, it's safer to use an RPC that returns GeoJSON 
    // OR use raw sql via tables view if we define a view.

    // Let's try direct select. If it returns binary/hex, we might need a workaround.
    // However, the previous `pg` implementation used `ST_AsGeoJSON`.
    // We can create a VIEW `game_state_view` in our SQL setup that does `ST_AsGeoJSON`.
    // OR we can make `get_game_state` RPC.
    // RPC is safest and cleanest for data transformation.

    // BUT we didn't define `get_game_state` RPC in the loop above.
    // I will write a simple fallback query using join.
    // Actually, let's assume we create a VIEW in the database for reading game state.
    // Or we will query tables and assume Supabase returns WKT/GeoJSON?
    // Supabase (PostgREST) returns GeoJSON for geometry/geography columns automatically if configured?
    // Answer: PostgREST returns GeoJSON for `application/geo+json` accept header, otherwise usually string.

    // Safest bet for "Porting" without trial and error:
    // Create an RPC `get_game_state_rpc`? Or Views.

    // Let's stick with specific RPCs for getting trails/territories as GeoJSON.
    // Wait, simple Select on a view:
    /*
    create view active_trails as 
    select player_id, st_asgeojson(trail)::json as path from player_trails;
    */

    // I'll execute raw SQL? No, `supabase-js` doesn't support raw SQL.
    // I MUST use RPC or Views for PostGIS functions like ST_AsGeoJSON.

    // I will define 'get_active_trails' and 'get_active_territories' in SQL artifact?
    // Or I'll update the `supabase_rpc.sql` artifact now to include these helpers.
    /*
     CREATE OR REPLACE FUNCTION get_active_trails() 
     RETURNS TABLE (player_id UUID, path JSON) AS $$
     SELECT player_id, ST_AsGeoJSON(trail)::json FROM player_trails;
     $$ LANGUAGE sql;
    */

    // I'll call `get_active_trails` RPC.

    // We'll query players who are actually in the game
    const { data: playersData, error: playersError } = await supabase
        .from('game_participants')
        .select(`
            player_id,
            players:player_id (
                id,
                username,
                wallet_address,
                player_stats (total_area)
            )
        `)
        .eq('game_id', gameId);

    if (playersError) {
        console.error("Error fetching game players:", playersError);
        return { trails: [], territories: [], players: [] };
    }

    // Parallel fetch for trails and territories
    const [trailsRes, territoriesRes] = await Promise.all([
        supabase.rpc('get_active_trails', { p_game_id: gameId }),
        supabase.rpc('get_active_territories', { p_game_id: gameId })
    ]);

    const trails = (trailsRes.data || []).map(r => ({ playerId: r.player_id, path: r.path }));
    const territories = (territoriesRes.data || []).map(r => ({ playerId: r.player_id, polygon: r.polygon, area: r.area_sqm }));

    // Format players list
    const players = (playersData || []).map(p => {
        const playerDetails = p.players; // joined data
        return {
            id: playerDetails.id,
            username: playerDetails.username,
            walletAddress: playerDetails.wallet_address,
            score: playerDetails.player_stats?.[0]?.total_area || 0
        };
    });

    return { trails, territories, players };
};

export const getSafePoints = async () => {
    // Needs RPC for GeoJSON
    const { data } = await supabase.rpc('get_safe_points_geojson');
    return (data || []).map(r => ({
        ...r,
        location: r.location // is json
    }));
};

export const cleanupPlayerSession = async (gameId, playerId) => {
    try {
        await Promise.all([
            supabase
                .from('player_territories')
                .delete()
                .eq('game_id', gameId)
                .eq('player_id', playerId),
            supabase
                .from('player_trails')
                .delete()
                .eq('game_id', gameId)
                .eq('player_id', playerId)
        ]);
        console.log(`Cleaned up session for player ${playerId} in game ${gameId}`);
    } catch (error) {
        console.error(`Error cleaning up player session: ${error.message}`);
    }
};

/**
 * Count participants in a game session (UUID game id).
 */
export const getGameParticipantCount = async (gameId) => {
    const { count, error } = await supabase
        .from('game_participants')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId);

    if (error) throw new Error(error.message);
    return count ?? 0;
};

/**
 * Get one participant by wallet address for a game.
 */
export const getGameParticipantByWallet = async (gameId, walletAddress) => {
    const { data: player, error: pErr } = await supabase
        .from('players')
        .select('id, wallet_address, username')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

    if (pErr) throw new Error(pErr.message);
    if (!player) return null;

    const { data: row, error } = await supabase
        .from('game_participants')
        .select('player_id, joined_at')
        .eq('game_id', gameId)
        .eq('player_id', player.id)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return null;

    return {
        playerId: player.id,
        walletAddress: player.wallet_address,
        username: player.username,
        joinedAt: row.joined_at,
    };
};

/**
 * Player stats from DB (used for Solana / non-chain stats).
 */
export const getPlayerStatsFromDb = async (walletAddress) => {
    const { data: player, error } = await supabase
        .from('players')
        .select(`
            id,
            wallet_address,
            username,
            player_stats (
                total_area,
                games_played,
                games_won,
                total_earnings
            )
        `)
        .eq('wallet_address', walletAddress)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!player) return null;

    const stats = player.player_stats?.[0] || {};
    return {
        walletAddress: player.wallet_address,
        username: player.username,
        totalArea: stats.total_area ?? 0,
        gamesPlayed: stats.games_played ?? 0,
        gamesWon: stats.games_won ?? 0,
        totalEarnings: stats.total_earnings ?? 0,
        source: 'database',
    };
};