import { kv } from '@vercel/kv';
import { ENTITY_TYPES, LEADERBOARD_TYPES, PLAYERS_AND_CLANS_SKILLS, PET_SKILLS } from '../lib/constants.js';

// Helper function to pause execution.
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Processes a single leaderboard, fetching data, calculating movements, and saving to KV.
 * This function is designed to be resilient, handling its own errors.
 * @param {string} entityType - The entity type (e.g., 'players').
 * @param {string} leaderboardType - The game mode (e.g., 'groupironman').
 * @param {string} skill - The skill name (e.g., 'foraging').
 * @returns {Promise<object>} A result object indicating success or failure.
 */
async function processLeaderboard(entityType, leaderboardType, skill) {
    const leaderboardName = `${entityType}-${leaderboardType}-${skill}`;
    const apiEntityType = `${entityType}:${leaderboardType}`;
    const apiUrl = `https://query.idleclans.com/api/Leaderboard/top/${apiEntityType}/${skill}`;

    const movementsKey = `leaderboard:movements:${leaderboardName}`;
    const lastUpdatedKey = `last-updated:${leaderboardName}`;
    const previousUpdatedKey = `previous-updated:${leaderboardName}`;

    try {
        const oldTimestamp = await kv.get(lastUpdatedKey);
        const apiResponse = await fetch(apiUrl);
        if (!apiResponse.ok) {
            const reason = `API fetch failed with status: ${apiResponse.status}`;
            console.error(`Failed to process ${leaderboardName}: ${reason}`);
            return { leaderboard: leaderboardName, status: 'error', reason };
        }
        const currentLeaderboard = await apiResponse.json();

        const currentPlayerUsernames = new Set(currentLeaderboard.map(p => p.username));
        const previousResults = await kv.get(movementsKey);
        const keysToDelete = [];
        if (previousResults && Array.isArray(previousResults)) {
            for (const oldPlayer of previousResults) {
                if (!currentPlayerUsernames.has(oldPlayer.username)) {
                    keysToDelete.push(`${leaderboardName}:player:${oldPlayer.username}`);
                    keysToDelete.push(`${leaderboardName}:score:${oldPlayer.username}`);
                }
            }
        }
        if (keysToDelete.length > 0) {
            await Promise.all(keysToDelete.map(key => kv.del(key)));
        }

        const movementResults = [];
        for (const [index, player] of currentLeaderboard.entries()) {
            const playerName = player.username;
            const playerRankKey = `${leaderboardName}:player:${playerName}`;
            const playerScoreKey = `${leaderboardName}:score:${playerName}`;
            const [oldRank, oldScore] = await kv.mget(playerRankKey, playerScoreKey);
            const movement = oldRank !== null ? oldRank - (index + 1) : 0;
            const scoreDelta = oldScore !== null ? player.score - oldScore : 0;
            movementResults.push({ username: playerName, currentRank: index + 1, movement, score: player.score, scoreDelta });
            await kv.set(playerRankKey, index + 1);
            await kv.set(playerScoreKey, player.score);
        }

        const currentTime = new Date().toISOString();
        await kv.set(movementsKey, movementResults);
        await kv.set(lastUpdatedKey, currentTime);
        if (oldTimestamp) {
            await kv.set(previousUpdatedKey, oldTimestamp);
        }

        return { leaderboard: leaderboardName, status: 'OK' };
    } catch (error) {
        console.error(`An unexpected error occurred while processing ${leaderboardName}:`, error);
        return { leaderboard: leaderboardName, status: 'error', reason: error.message };
    }
}

/**
 * The main handler for the cron job.
 */
export default async function handler(request, response) {
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (!isDevelopment) {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return response.status(401).json({ error: 'Unauthorized' });
        }
    }

    // --- NEW: Read and validate the entityType from the query string ---
    const entityType = request.query.entityType;
    if (!entityType || !ENTITY_TYPES.includes(entityType)) {
        return response.status(400).json({ error: 'Invalid or missing entityType parameter.' });
    }

    // Generate the list of tasks ONLY for the specified entityType.
    const allCombinations = [];
    const skills = (entityType === 'pets') ? PET_SKILLS : PLAYERS_AND_CLANS_SKILLS;
    for (const type of LEADERBOARD_TYPES) {
        for (const skill of skills) {
            allCombinations.push({ entityType, leaderboardType: type, skill });
        }
    }

    // startIndex and stopIndex logic remains the same.
    const startIndexRaw = request.query.startIndex;
    let startIndex = 0;
    if (startIndexRaw) {
        const parsedIndex = parseInt(startIndexRaw, 10);
        if (!isNaN(parsedIndex) && parsedIndex >= 0) {
            startIndex = parsedIndex;
        }
    }

    const stopIndexRaw = request.query.stopIndex;
    let stopIndex = allCombinations.length;
    if (stopIndexRaw) {
        const parsedIndex = parseInt(stopIndexRaw, 10);
        if (!isNaN(parsedIndex) && parsedIndex > startIndex) {
            stopIndex = Math.min(parsedIndex, allCombinations.length);
        }
    }

    const chunkSize = 14;
    const intervalInMs = 70000;
    const allResults = [];

    console.log(`Starting leaderboard processing for ENTITY: ${entityType}. Total for this entity: ${allCombinations.length}. Processing from index ${startIndex} to ${stopIndex}.`);

    // The rest of the processing loop is unchanged.
    for (let i = startIndex; i < stopIndex; i += chunkSize) {
        const batchStartTime = Date.now();
        const chunk = allCombinations.slice(i, Math.min(i + chunkSize, stopIndex));
        console.log(`Processing batch starting at index ${i}...`);

        const chunkResults = await Promise.all(
            chunk.map(combo => processLeaderboard(combo.entityType, combo.leaderboardType, combo.skill))
        );
        allResults.push(...chunkResults);

        const elapsedTime = Date.now() - batchStartTime;
        console.log(`Batch complete. Took ${elapsedTime}ms.`);

        if (i + chunkSize < stopIndex) {
            const waitTime = intervalInMs - elapsedTime;
            if (waitTime > 0) {
                console.log(`Waiting for ${waitTime}ms before next batch...`);
                await sleep(waitTime);
            } else {
                console.log(`Batch took longer than interval. Proceeding immediately.`);
            }
        }
    }

    const successfulJobs = allResults.filter(r => r.status === 'OK').length;
    const failedJobs = allResults.length - successfulJobs;
    console.log(`Leaderboard fetch complete for ENTITY: ${entityType}. Success: ${successfulJobs}, Failed: ${failedJobs}.`);

    response.status(200).json({ status: 'OK', successfulJobs, failedJobs });
}