import {
    makeContractCall,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
    stringAsciiCV,
    uintCV,
    principalCV,
    callReadOnlyFunction,
    cvToJSON,
} from '@stacks/transactions';
import { getNetwork, CONTRACT_ADDRESS, CONTRACT_NAME, PRIVATE_KEY } from '../config/stacks.js';

/**
 * Create a new game on the blockchain
 */
export async function createGame(gameType, maxPlayers) {
    const network = getNetwork();

    const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'create-game',
        functionArgs: [
            stringAsciiCV(gameType),
            uintCV(maxPlayers)
        ],
        senderKey: PRIVATE_KEY,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
    };

    const transaction = await makeContractCall(txOptions);
    const broadcastResponse = await broadcastTransaction(transaction, network);

    return {
        txId: broadcastResponse.txid,
        success: true
    };
}

/**
 * Start a game
 */
export async function startGame(gameId) {
    const network = getNetwork();

    const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'start-game',
        functionArgs: [uintCV(gameId)],
        senderKey: PRIVATE_KEY,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
    };

    const transaction = await makeContractCall(txOptions);
    const broadcastResponse = await broadcastTransaction(transaction, network);

    return {
        txId: broadcastResponse.txid,
        success: true
    };
}

/**
 * End a game
 */
export async function endGame(gameId) {
    const network = getNetwork();

    const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'end-game',
        functionArgs: [uintCV(gameId)],
        senderKey: PRIVATE_KEY,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
    };

    const transaction = await makeContractCall(txOptions);
    const broadcastResponse = await broadcastTransaction(transaction, network);

    return {
        txId: broadcastResponse.txid,
        success: true
    };
}

/**
 * Submit player results after game ends
 */
export async function submitPlayerResult(gameId, playerAddress, areaCaptured, rank) {
    const network = getNetwork();

    const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'submit-player-result',
        functionArgs: [
            uintCV(gameId),
            principalCV(playerAddress),
            uintCV(areaCaptured),
            uintCV(rank)
        ],
        senderKey: PRIVATE_KEY,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
    };

    const transaction = await makeContractCall(txOptions);
    const broadcastResponse = await broadcastTransaction(transaction, network);

    return {
        txId: broadcastResponse.txid,
        success: true
    };
}

/**
 * Distribute prize to a player
 */
export async function distributePrize(gameId, playerAddress, prizeAmount) {
    const network = getNetwork();

    const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'distribute-prize',
        functionArgs: [
            uintCV(gameId),
            principalCV(playerAddress),
            uintCV(prizeAmount)
        ],
        senderKey: PRIVATE_KEY,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
    };

    const transaction = await makeContractCall(txOptions);
    const broadcastResponse = await broadcastTransaction(transaction, network);

    return {
        txId: broadcastResponse.txid,
        success: true
    };
}

/**
 * Get game details (read-only)
 */
export async function getGame(gameId) {
    const network = getNetwork();

    const options = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-game',
        functionArgs: [uintCV(gameId)],
        network,
        senderAddress: CONTRACT_ADDRESS,
    };

    const result = await callReadOnlyFunction(options);
    return cvToJSON(result);
}

/**
 * Get participant details (read-only)
 */
export async function getParticipant(gameId, playerAddress) {
    const network = getNetwork();

    const options = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-participant',
        functionArgs: [uintCV(gameId), principalCV(playerAddress)],
        network,
        senderAddress: CONTRACT_ADDRESS,
    };

    const result = await callReadOnlyFunction(options);
    return cvToJSON(result);
}

/**
 * Get player stats (read-only)
 */
export async function getPlayerStats(playerAddress) {
    const network = getNetwork();

    const options = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-player-stats',
        functionArgs: [principalCV(playerAddress)],
        network,
        senderAddress: CONTRACT_ADDRESS,
    };

    const result = await callReadOnlyFunction(options);
    return cvToJSON(result);
}

/**
 * Get player count in a game (read-only)
 */
export async function getPlayerCount(gameId) {
    const network = getNetwork();

    const options = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-player-count',
        functionArgs: [uintCV(gameId)],
        network,
        senderAddress: CONTRACT_ADDRESS,
    };

    const result = await callReadOnlyFunction(options);
    return cvToJSON(result);
}

/**
 * Get next game ID (read-only)
 */
export async function getNextGameId() {
    const network = getNetwork();

    const options = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-next-game-id',
        functionArgs: [],
        network,
        senderAddress: CONTRACT_ADDRESS,
    };

    const result = await callReadOnlyFunction(options);
    return cvToJSON(result);
}
