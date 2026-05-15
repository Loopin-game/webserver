import { supabase } from '../src/config/db.js';

async function seedData() {
    console.log('🌱 Seeding Data...');

    const powerups = [
        { id: 'shield', name: 'Shield', description: 'Protects trail for 60s', cost: 2.0, type: 'defense' },
        { id: 'invisibility', name: 'Invisibility', description: 'Hides trail for 60s', cost: 5.0, type: 'stealth' }
    ];

    const { error } = await supabase.from('powerups').upsert(powerups);

    if (error) {
        console.error('❌ Error seeding powerups:', error);
    } else {
        console.log('✅ Powerups seeded successfully');
    }
}

seedData();
