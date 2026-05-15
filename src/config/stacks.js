import { StacksTestnet, StacksMainnet } from '@stacks/network';
import dotenv from 'dotenv';

dotenv.config();

// Network configuration
export const getNetwork = () => {
    const networkType = process.env.NETWORK || 'testnet';

    if (networkType === 'mainnet') {
        return new StacksMainnet();
    }
    return new StacksTestnet();
};

// Contract configuration
export const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
export const CONTRACT_NAME = process.env.CONTRACT_NAME || 'loopin-game';

// Wallet configuration
export const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Validate configuration
export const validateConfig = () => {
    if (!CONTRACT_ADDRESS) {
        throw new Error('CONTRACT_ADDRESS is not set in environment variables');
    }

    if (!PRIVATE_KEY || PRIVATE_KEY === 'your-private-key-here') {
        console.warn('⚠️  WARNING: PRIVATE_KEY is not set or using default value');
        console.warn('⚠️  Contract write operations will fail');
    }

    console.log('✓ Configuration loaded');
    console.log(`  Network: ${process.env.NETWORK || 'testnet'}`);
    console.log(`  Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);
};
