import { kv } from '@vercel/kv';

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
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function processLeaderboard(leaderboardType, skill) {
    const leaderboardName = `${leaderboardType}-${skill}`;
    const apiLeaderboardType = `players:${leaderboardType}`;
    const apiUrl = `https://query.idleclans.com/api/Leaderboard/top/${apiLeaderboardType}/${skill}`;

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
            const currentRank = index + 1;
            const currentScore = player.score;
            const playerRankKey = `${leaderboardName}:player:${playerName}`;
            const playerScoreKey = `${leaderboardName}:score:${playerName}`;
            const oldRank = await kv.get(playerRankKey);
            const oldScore = await kv.get(playerScoreKey);
            const movement = oldRank !== null ? oldRank - currentRank : 0;
            const scoreDelta = oldScore !== null ? currentScore - oldScore : 0;
            movementResults.push({ username: playerName, currentRank, movement, score: currentScore, scoreDelta });
            await kv.set(playerRankKey, currentRank);
            await kv.set(playerScoreKey, currentScore);
        }

        const currentTime = new Date().toISOString();
        await kv.set(movementsKey, movementResults);
        await kv.set(lastUpdatedKey, currentTime);

        if (oldTimestamp) {
            await kv.set(previousUpdatedKey, oldTimestamp);
        }

        return { leaderboard: leaderboardName, status: 'OK', processed: movementResults.length, deleted: keysToDelete.length / 2 };

    } catch (error) {
        console.error(`An unexpected error occurred while processing ${leaderboardName}:`, error);
        return { leaderboard: leaderboardName, status: 'error', reason: error.message };
    }
}

export default async function handler(request, response) {

    // --- UPDATED: Security Check ---
    // Allow requests to pass only if the secret in the query parameter is correct
    // OR if we are in a local development environment (for easy testing).
    const isDevelopment = process.env.NODE_ENV === 'development';
    const { cron_secret } = request.query;

    if (!isDevelopment && cron_secret !== process.env.CRON_SECRET) {
        return response.status(401).json({ error: 'Unauthorized' });
    }
    // --- End of Security Check ---

    const allCombinations = [];
    for (const type of LEADERBOARD_TYPES) {
        for (const skill of SKILLS) {
            allCombinations.push({ leaderboardType: type, skill });
        }
    }

    // --- RE-ADDED: Read and validate the startIndex from the query string ---
    const startIndexRaw = request.query.startIndex;
    let startIndex = 0; // Default to 0 if no parameter is passed

    if (startIndexRaw) {
        const parsedIndex = parseInt(startIndexRaw, 10);
        if (!isNaN(parsedIndex) && parsedIndex >= 0) {
            startIndex = parsedIndex;
        }
    }

    const chunkSize = 14;
    const intervalInMs = 70000;
    const allResults = [];

    console.log(`Starting leaderboard processing. Total: ${allCombinations.length} leaderboards. Starting from index: ${startIndex}.`);

    // --- RE-ADDED: The loop now starts from our validated startIndex ---
    for (let i = startIndex; i < allCombinations.length; i += chunkSize) {
        const batchStartTime = Date.now();
        const chunk = allCombinations.slice(i, i + chunkSize);
        console.log(`Processing batch starting at index ${i}...`);

        const chunkResults = await Promise.all(
            chunk.map(combo => processLeaderboard(combo.leaderboardType, combo.skill))
        );
        allResults.push(...chunkResults);

        const batchEndTime = Date.now();
        const elapsedTime = batchEndTime - batchStartTime;
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

    const successfulJobs = allResults.filter(r => r.status === 'OK').length;
    const failedJobs = allResults.length - successfulJobs;
    console.log(`All leaderboard processing complete. Success: ${successfulJobs}, Failed: ${failedJobs}.`);

    response.status(200).json({ status: 'OK', successfulJobs, failedJobs, results: allResults });
}