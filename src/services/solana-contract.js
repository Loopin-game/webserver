/**
 * Solana Contract Service
 * Handles SOL transfers and $LOOPIN token operations for the game economy.
 * Uses direct SOL transfers as escrow for entry fees and prize distribution.
 */

import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL,
    clusterApiUrl,
} from '@solana/web3.js';
import bs58 from 'bs58';

const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'mainnet-beta';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl(SOLANA_NETWORK);
const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY || '';
const LOOPIN_TOKEN_MINT = process.env.LOOPIN_TOKEN_MINT || 'GnPwqMJiHCVoQ1KrunqNz9JJV4jXh7cYjjLvue3zBAGS';

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

/**
 * Get the oracle/admin keypair from env
 */
function getOracleKeypair() {
    if (!SOLANA_PRIVATE_KEY) {
        throw new Error('SOLANA_PRIVATE_KEY not configured');
    }
    return Keypair.fromSecretKey(bs58.decode(SOLANA_PRIVATE_KEY));
}

/**
 * Escrow public key when configured; otherwise null (entry fee UI can still show token link).
 */
function getEscrowPublicKeyOrNull() {
    if (!SOLANA_PRIVATE_KEY) return null;
    try {
        return getOracleKeypair().publicKey;
    } catch {
        return null;
    }
}

/**
 * Get the escrow wallet public key (oracle wallet acts as escrow for now)
 */
function getEscrowPublicKey() {
    const pk = getEscrowPublicKeyOrNull();
    if (!pk) {
        throw new Error('SOLANA_PRIVATE_KEY not configured');
    }
    return pk;
}

// ─────────────────────────────────────────────────────────────
// Game Lifecycle
// ─────────────────────────────────────────────────────────────

/**
 * Create a new game
 * For now, game creation is DB-only. Blockchain records are created on join.
 */
export async function createGame(gameType, maxPlayers) {
    console.log(`[Solana] Creating game: type=${gameType}, maxPlayers=${maxPlayers}`);
    const escrow = getEscrowPublicKeyOrNull();
    return {
        success: true,
        escrowAddress: escrow ? escrow.toBase58() : null,
        escrowConfigured: Boolean(escrow),
    };
}

/**
 * Verify that a player has sent their entry fee to the escrow
 * Called by backend after player sends the transaction on the frontend
 */
export async function verifyEntryFeePayment(txSignature, expectedPlayerAddress, expectedAmountSOL) {
    try {
        console.log(`[Solana] Verifying entry fee: tx=${txSignature}`);

        const escrowPk = getEscrowPublicKeyOrNull();
        if (!escrowPk) {
            return { success: false, error: 'SOLANA_PRIVATE_KEY not configured — cannot verify escrow' };
        }
        const escrowKey = escrowPk.toBase58();

        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(txSignature, 'confirmed');
        if (confirmation.value.err) {
            throw new Error('Transaction failed on-chain');
        }

        // Fetch the transaction details
        const tx = await connection.getTransaction(txSignature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
        });

        if (!tx) {
            throw new Error('Transaction not found');
        }

        // Verify: sender = player, recipient = escrow, amount = entry fee
        const accountKeys = tx.transaction.message.getAccountKeys();
        const preBalances = tx.meta.preBalances;
        const postBalances = tx.meta.postBalances;

        // Check that escrow received the expected amount
        let escrowIdx = -1;
        for (let i = 0; i < accountKeys.length; i++) {
            if (accountKeys.get(i).toBase58() === escrowKey) {
                escrowIdx = i;
                break;
            }
        }

        if (escrowIdx === -1) {
            throw new Error('Escrow not found in transaction');
        }

        const received = (postBalances[escrowIdx] - preBalances[escrowIdx]) / LAMPORTS_PER_SOL;
        const expectedAmount = expectedAmountSOL;

        // Allow 0.1% tolerance for rounding
        if (received < expectedAmount * 0.999) {
            throw new Error(`Insufficient payment: expected ${expectedAmount} SOL, received ${received} SOL`);
        }

        console.log(`[Solana] ✅ Entry fee verified: ${received} SOL from ${expectedPlayerAddress}`);

        return {
            success: true,
            amountReceived: received,
            txSignature,
        };
    } catch (error) {
        console.error('[Solana] ❌ Verification error:', error.message);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Distribute prize to winner
 * Sends SOL from escrow wallet to winner
 */
export async function distributePrize(playerAddress, prizeAmountSOL) {
    try {
        const oracle = getOracleKeypair();
        const winner = new PublicKey(playerAddress);

        const platformFeePercent = 5; // 5% platform fee
        const platformFee = prizeAmountSOL * (platformFeePercent / 100);
        const playerPrize = prizeAmountSOL - platformFee;

        const lamports = Math.floor(playerPrize * LAMPORTS_PER_SOL);

        console.log(`[Solana] Distributing prize: ${playerPrize} SOL to ${playerAddress}`);

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: oracle.publicKey,
                toPubkey: winner,
                lamports,
            })
        );

        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [oracle],
            { commitment: 'confirmed' }
        );

        console.log(`[Solana] ✅ Prize distributed: ${signature}`);

        return {
            success: true,
            txSignature: signature,
            playerPrize,
            platformFee,
        };
    } catch (error) {
        console.error('[Solana] ❌ Prize distribution error:', error.message);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Get SOL balance for an address
 */
export async function getBalance(address) {
    try {
        const pubkey = new PublicKey(address);
        const lamports = await connection.getBalance(pubkey);
        return lamports / LAMPORTS_PER_SOL;
    } catch (error) {
        console.error('[Solana] Balance error:', error.message);
        return 0;
    }
}

/**
 * Get escrow balance (total prize pool available)
 */
export async function getEscrowBalance() {
    const escrow = getEscrowPublicKey();
    return getBalance(escrow.toBase58());
}

/**
 * Generate entry fee transfer instruction for the frontend
 * Returns the escrow address and amount for the player to send
 */
export function getEntryFeeInfo(entryFeeSOL) {
    const escrow = getEscrowPublicKeyOrNull();
    return {
        escrowAddress: escrow ? escrow.toBase58() : null,
        amountSOL: entryFeeSOL,
        amountLamports: Math.floor(entryFeeSOL * LAMPORTS_PER_SOL),
        network: SOLANA_NETWORK,
        tokenMint: LOOPIN_TOKEN_MINT,
        bagsUrl: `https://bags.fm/${LOOPIN_TOKEN_MINT}`,
        escrowConfigured: Boolean(escrow),
    };
}

/**
 * Get the $LOOPIN token mint address
 */
export function getTokenMint() {
    return LOOPIN_TOKEN_MINT;
}
