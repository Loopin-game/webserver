import { supabase } from '../src/config/db.js';

async function checkTrails() {
    console.log('🔍 Checking Trails...', new Date().toISOString());
    const { data, error } = await supabase.from('player_trails').select('*');
    if (error) {
        console.error('Error fetching trails:', error);
    } else {
        console.log('Trails found:', data.length);
        if (data.length > 0) {
            console.log(JSON.stringify(data[0], null, 2));
        }
    }
}
checkTrails();
