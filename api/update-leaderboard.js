import { kv } from '@vercel/kv';

// These lists define all the leaderboards to be processed.
const LEADERBOARD_TYPES = ['default', 'ironman', 'groupironman'];
const SKILLS = [
    'total_level', 'smithing', 'woodcutting', 'crafting', 'enchanting',
    'farming', 'foraging', 'carpentry', 'plundering', 'mining',
    'cooking', 'brewing', 'agility', 'fishing', 'exterminating',
    'attack', 'strength', 'magic', 'defence', 'archery', 'health',
    'zeus', 'medusa', 'hades', 'griffin', 'devil', 'chimera', 'sobek',
    'kronos', 'malignant_spider', 'skeleton_warrior', 'otherworldly_golem',
    'reckoning_of_the_gods', 'guardians_of_the_citadel', 'bloodmoon_massacre'
];

// Helper function to pause execution.
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Processes a single leaderboard, fetching data, calculating movements, and saving to KV.
 * This function is designed to be resilient, handling its own errors.
 * @param {string} leaderboardType - The game mode (e.g., 'groupironman').
 * @param {string} skill - The skill name (e.g., 'foraging').
 * @returns {Promise<object>} A result object indicating success or failure.
 */
async function processLeaderboard(leaderboardType, skill) {
    const leaderboardName = `${leaderboardType}-${skill}`;
    const apiLeaderboardType = `players:${leaderboardType}`;
    const apiUrl = `https://query.idleclans.com/api/Leaderboard/top/${apiLeaderboardType}/${skill}`;

    // Define all database keys for this leaderboard.
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

        // Clean up players who have dropped off the leaderboard.
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

        // Process each player to calculate rank and exp changes.
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

        // On success, save the main data and update timestamps.
        const currentTime = new Date().toISOString();
        await kv.set(movementsKey, movementResults);
        await kv.set(lastUpdatedKey, currentTime);
        if (oldTimestamp) {
            await kv.set(previousUpdatedKey, oldTimestamp);
        }

        // Return a success object including the processed data for the final analysis.
        return {
            leaderboard: leaderboardName,
            status: 'OK',
            processed: movementResults.length,
            deleted: keysToDelete.length / 2,
            data: { leaderboardType, skill, movementResults }
        };

    } catch (error) {
        console.error(`An unexpected error occurred while processing ${leaderboardName}:`, error);
        return { leaderboard: leaderboardName, status: 'error', reason: error.message };
    }
}

/**
 * The main handler for the cron job.
 */
export default async function handler(request, response) {
    // Security check: Block unauthorized web access in production.
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (!isDevelopment && request.query.cron_secret !== process.env.CRON_SECRET) {
        return response.status(401).json({ error: 'Unauthorized' });
    }

    // Generate the full list of all leaderboards to process.
    const allCombinations = [];
    for (const type of LEADERBOARD_TYPES) {
        for (const skill of SKILLS) {
            allCombinations.push({ leaderboardType: type, skill });
        }
    }

    // Allow starting the job from a specific index for debugging.
    const startIndexRaw = request.query.startIndex;
    let startIndex = 0;
    if (startIndexRaw) {
        const parsedIndex = parseInt(startIndexRaw, 10);
        if (!isNaN(parsedIndex) && parsedIndex >= 0) {
            startIndex = parsedIndex;
        }
    }

    const chunkSize = 14;
    const intervalInMs = 70000; // 70-second interval to respect API rate limits.
    const allResults = [];
    const successfulLeaderboardsData = [];

    console.log(`Starting leaderboard processing. Total: ${allCombinations.length}. Starting from index: ${startIndex}.`);

    // Process all leaderboards in throttled batches.
    for (let i = startIndex; i < allCombinations.length; i += chunkSize) {
        const batchStartTime = Date.now();
        const chunk = allCombinations.slice(i, i + chunkSize);
        console.log(`Processing batch starting at index ${i}...`);

        const chunkResults = await Promise.all(
            chunk.map(combo => processLeaderboard(combo.leaderboardType, combo.skill))
        );

        chunkResults.forEach(result => {
            if (result.status === 'OK' && result.data) {
                successfulLeaderboardsData.push(result.data);
            }
        });
        allResults.push(...chunkResults);

        const elapsedTime = Date.now() - batchStartTime;
        console.log(`Batch complete. Took ${elapsedTime}ms.`);

        if (i + chunkSize < allCombinations.length) {
            const waitTime = intervalInMs - elapsedTime;
            if (waitTime > 0) {
                console.log(`Waiting for ${waitTime}ms before next batch...`);
                await sleep(waitTime);
            } else {
                console.log(`Batch took longer than interval. Proceeding immediately.`);
            }
        }
    }

    // After all batches are done, calculate and save the Top 10 movers.
    console.log("Calculating Top 10 movers for each game mode...");
    for (const type of LEADERBOARD_TYPES) {
        const flatPlayerList = [];
        const modeData = successfulLeaderboardsData.filter(d => d.leaderboardType === type);

        modeData.forEach(board => {
            board.movementResults.forEach(player => {
                if (player.movement !== 0) {
                    flatPlayerList.push({ ...player, skill: board.skill });
                }
            });
        });

        // Save Top 10 Gainers
        flatPlayerList.sort((a, b) => b.movement - a.movement);
        await kv.set(`top-gainers:${type}`, flatPlayerList.slice(0, 10));

        // Save Top 10 Losers
        flatPlayerList.sort((a, b) => a.movement - b.movement);
        await kv.set(`top-losers:${type}`, flatPlayerList.filter(p => p.movement < 0).slice(0, 10));

        console.log(`Saved Top 10 movers for ${type}.`);
    }

    const successfulJobs = allResults.filter(r => r.status === 'OK').length;
    const failedJobs = allResults.length - successfulJobs;
    console.log(`All leaderboard processing complete. Success: ${successfulJobs}, Failed: ${failedJobs}.`);

    response.status(200).json({ status: 'OK', successfulJobs, failedJobs });
}