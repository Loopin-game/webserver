/**
 * Chain Router — Routes blockchain calls to Stacks or Solana
 * 
 * All game routes call through this router so the rest of the backend
 * stays chain-agnostic. The chain is determined by the player's preference
 * passed in the API request.
 */

import * as stacksContract from './contract.js';
import * as solanaContract from './solana-contract.js';

const SUPPORTED_CHAINS = ['stacks', 'solana'];

/**
 * Get the correct contract service for a given chain
 */
function getService(chain) {
    if (!chain || !SUPPORTED_CHAINS.includes(chain)) {
        // Default to solana for the Bags hackathon
        chain = 'solana';
    }
    return chain === 'solana' ? solanaContract : stacksContract;
}

// ─────────────────────────────────────────────────────────────
// Game Lifecycle
// ─────────────────────────────────────────────────────────────

/**
 * Create a game on the specified chain
 */
export async function createGame(chain, gameType, maxPlayers) {
    console.log(`[ChainRouter] createGame on ${chain}: type=${gameType}, max=${maxPlayers}`);
    const service = getService(chain);
    return service.createGame(gameType, maxPlayers);
}

/**
 * Start a game
 */
export async function startGame(chain, gameId) {
    console.log(`[ChainRouter] startGame on ${chain}: gameId=${gameId}`);
    const service = getService(chain);

    if (chain === 'stacks') {
        return service.startGame(gameId);
    }

    // Solana: game start is DB-only for now
    return { success: true };
}

/**
 * End a game
 */
export async function endGame(chain, gameId) {
    console.log(`[ChainRouter] endGame on ${chain}: gameId=${gameId}`);
    const service = getService(chain);

    if (chain === 'stacks') {
        return service.endGame(gameId);
    }

    // Solana: game end is DB-only for now
    return { success: true };
}

/**
 * Submit player results
 */
export async function submitPlayerResult(chain, gameId, playerAddress, areaCaptured, rank) {
    console.log(`[ChainRouter] submitPlayerResult on ${chain}: game=${gameId}, player=${playerAddress}`);
    const service = getService(chain);

    if (chain === 'stacks') {
        return service.submitPlayerResult(gameId, playerAddress, areaCaptured, rank);
    }

    // Solana: results are stored in DB. On-chain recording comes with Anchor program.
    return { success: true };
}

/**
 * Distribute prize
 */
export async function distributePrize(chain, gameId, playerAddress, prizeAmount) {
    console.log(`[ChainRouter] distributePrize on ${chain}: game=${gameId}, player=${playerAddress}, prize=${prizeAmount}`);
    const service = getService(chain);

    if (chain === 'stacks') {
        return service.distributePrize(gameId, playerAddress, prizeAmount);
    }

    // Solana: direct SOL transfer from escrow
    return service.distributePrize(playerAddress, prizeAmount);
}

// ─────────────────────────────────────────────────────────────
// Read-only
// ─────────────────────────────────────────────────────────────

/**
 * Get game details
 */
export async function getGame(chain, gameId) {
    const service = getService(chain);

    if (chain === 'stacks') {
        return service.getGame(gameId);
    }

    // Solana: game data comes from DB
    return null;
}

/**
 * Get player stats
 */
export async function getPlayerStats(chain, playerAddress) {
    const service = getService(chain);

    if (chain === 'stacks') {
        return service.getPlayerStats(playerAddress);
    }

    // Solana: stats come from DB
    return null;
}

/**
 * Get player balance on the selected chain
 */
export async function getBalance(chain, address) {
    if (chain === 'solana') {
        return solanaContract.getBalance(address);
    }
    // Stacks balance is handled by the frontend directly
    return null;
}

/**
 * Verify entry fee payment (Solana only)
 */
export async function verifyEntryFee(chain, txSignature, playerAddress, amountSOL) {
    if (chain !== 'solana') {
        // Stacks handles this through contract calls
        return { success: true };
    }
    return solanaContract.verifyEntryFeePayment(txSignature, playerAddress, amountSOL);
}

/**
 * Get entry fee info for the frontend (Solana only)
 */
export function getEntryFeeInfo(chain, entryFee) {
    if (chain === 'solana') {
        return solanaContract.getEntryFeeInfo(entryFee);
    }
    return {
        contractAddress: process.env.CONTRACT_ADDRESS,
        contractName: process.env.CONTRACT_NAME,
        network: process.env.NETWORK || 'testnet',
    };
}

/**
 * Get $LOOPIN token info
 */
export function getTokenInfo() {
    return {
        mint: solanaContract.getTokenMint(),
        symbol: 'LOOPIN',
        name: 'Loopin',
        bagsUrl: `https://bags.fm/${solanaContract.getTokenMint()}`,
        chain: 'solana',
    };
}
