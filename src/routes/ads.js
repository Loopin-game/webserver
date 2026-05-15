import express from 'express';
import { supabase } from '../config/db.js';

const router = express.Router();

/**
 * POST /api/ads/locations
 * Add a sponsored location
 */
router.post('/locations', async (req, res) => {
    try {
        const { sponsorName, name, lat, lng, bidPrice } = req.body;

        // 1. Find or Create Sponsor
        let { data: sponsor } = await supabase.from('sponsors').select('id').eq('name', sponsorName).single();

        let sponsorId;
        if (!sponsor) {
            const { data: newSponsor, error: sError } = await supabase
                .from('sponsors')
                .insert({ name: sponsorName })
                .select('id')
                .single();
            if (sError) throw sError;
            sponsorId = newSponsor.id;
        } else {
            sponsorId = sponsor.id;
        }

        // 2. Insert Location
        // PostGIS WKT format: "POINT(-118 34)"
        const { data, error } = await supabase
            .from('sponsored_locations')
            .insert({
                sponsor_id: sponsorId,
                name: name,
                location: `POINT(${lng} ${lat})`,
                bid_price: bidPrice
            })
            .select('id')
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, id: data.id });
    } catch (e) {
        console.error("Ad create error", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * GET /api/ads/locations
 * Get all sponsored locations (for AI Manager)
 */
router.get('/locations', async (req, res) => {
    try {
        // Needs proper Join or View. 
        // Supabase select with internal join:
        // .select('*, sponsors(name)')

        // But getting Lat/Lng out of location column requires conversion?
        // PostgREST returns WKT or HEX by default?
        // Let's assume we want WKT or we parse it.
        // Simplest: .select('id, name, bid_price, sponsors(name), location')
        // And we might get WKT "POINT(x y)"

        const { data, error } = await supabase
            .from('sponsored_locations')
            .select('id, name, bid_price, location, sponsors(name)');

        if (error) throw error;

        // Transform if necessary
        // Assuming location comes as string "POINT(lng lat)" or HEX
        // MVP: Return raw for now or assume AI brain can parse WKT.

        const locations = data.map(d => ({
            ...d,
            sponsor_name: d.sponsors?.name
        }));

        res.json({ success: true, data: locations });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
