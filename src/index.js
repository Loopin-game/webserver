import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { validateConfig } from './config/stacks.js';
import gameRoutes from './routes/game.js';
import playerRoutes from './routes/player.js';
import powerupRoutes from './routes/powerup.js';
import adsRoutes from './routes/ads.js';
import authRoutes from './routes/auth.js';
import { setupWebSocket } from './websocket/server.js';
import { supabase, isDatabaseConfigured } from './config/db.js';

// Load environment variables
dotenv.config();

// Validate configuration
validateConfig();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Setup WebSocket
setupWebSocket(server);

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint (includes Supabase connectivity when configured)
app.get('/health', async (req, res) => {
    const base = {
        status: 'healthy',
        service: 'loopin-blockchain-service',
        timestamp: new Date().toISOString(),
        network: process.env.NETWORK || 'testnet',
        databaseConfigured: isDatabaseConfigured(),
    };

    if (!isDatabaseConfigured()) {
        return res.status(503).json({
            ...base,
            status: 'degraded',
            database: 'missing_env',
            hint: 'Set SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY',
        });
    }

    try {
        const { error } = await supabase.from('game_sessions').select('id').limit(1);
        if (error) {
            return res.status(503).json({
                ...base,
                status: 'degraded',
                database: 'error',
                error: error.message,
            });
        }
        return res.json({
            ...base,
            database: 'ok',
        });
    } catch (e) {
        return res.status(503).json({
            ...base,
            status: 'degraded',
            database: 'unreachable',
            error: e.message,
        });
    }
});

// API routes
const apiPrefix = process.env.API_PREFIX || '/api';
app.use(`${apiPrefix}/game`, gameRoutes);
app.use(`${apiPrefix}/player`, playerRoutes);
app.use(`${apiPrefix}/powerup`, powerupRoutes);
app.use(`${apiPrefix}/ads`, adsRoutes);
app.use(`${apiPrefix}/auth`, authRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
server.listen(PORT, () => {
    console.log('');
    console.log('🚀 Loopin Blockchain Service Started');
    console.log('=====================================');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🌐 Network: ${process.env.NETWORK || 'testnet'}`);
    console.log(`📝 Contract: ${process.env.CONTRACT_ADDRESS}.${process.env.CONTRACT_NAME}`);
    console.log(`🔗 API Base: http://localhost:${PORT}${apiPrefix}`);
    console.log(`⚡ WebSocket: ws://localhost:${PORT}/ws/game`);
    console.log('');
    console.log('Available endpoints:');
    console.log(`  GET  ${apiPrefix}/health`);
    console.log(`  POST ${apiPrefix}/game/create`);
    console.log(`  POST ${apiPrefix}/game/start`);
    console.log(`  POST ${apiPrefix}/game/end`);
    console.log(`  POST ${apiPrefix}/game/submit-results`);
    console.log(`  POST ${apiPrefix}/game/distribute-prize`);
    console.log(`  GET  ${apiPrefix}/game/:gameId`);
    console.log(`  GET  ${apiPrefix}/game/:gameId/participant/:address`);
    console.log(`  GET  ${apiPrefix}/game/:gameId/player-count`);
    console.log(`  GET  ${apiPrefix}/player/:address/stats`);
    console.log('=====================================');
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    process.exit(0);
});

