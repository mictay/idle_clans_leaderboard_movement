import { kv } from '@vercel/kv';

// --- No changes to constants or the sleep function ---
const LEADERBOARD_TYPES = ['default', 'ironman', 'groupironman'];
const SKILLS = [
    'total_level', 'smithing', 'woodcutting', 'crafting', 'enchanting',
    'farming', 'foraging', 'carpentry', 'plundering', 'mining',
    'cooking', 'brewing', 'agility', 'fishing'
];
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- UPDATED: processLeaderboard function is now wrapped in a try...catch block ---
async function processLeaderboard(leaderboardType, skill) {
    const leaderboardName = `${leaderboardType}-${skill}`;
    const apiLeaderboardType = `players:${leaderboardType}`;
    const apiUrl = `https://query.idleclans.com/api/Leaderboard/top/${apiLeaderboardType}/${skill}`;

    // This try...catch block ensures that an error for one skill does not stop the others.
    try {
        const movementsKey = `leaderboard:movements:${leaderboardName}`;
        const lastUpdatedKey = `last-updated:${leaderboardName}`;

        const apiResponse = await fetch(apiUrl);
        if (!apiResponse.ok) {
            // This is a "soft" failure. We log it and return, preventing a crash.
            const reason = `API fetch failed with status: ${apiResponse.status}`;
            console.error(`Failed to process ${leaderboardName}: ${reason}`);
            return { leaderboard: leaderboardName, status: 'error', reason };
        }
        const currentLeaderboard = await apiResponse.json();

        // Cleanup Logic
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

        // Processing Logic
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

        // CRITICAL: The timestamp is only written here, at the end of a SUCCESSFUL process.
        const currentTime = new Date().toISOString();
        await kv.set(movementsKey, movementResults);
        await kv.set(lastUpdatedKey, currentTime);

        return { leaderboard: leaderboardName, status: 'OK', processed: movementResults.length, deleted: keysToDelete.length / 2 };

    } catch (error) {
        // This catches any unexpected errors (e.g., from KV, JSON parsing, etc.)
        console.error(`An unexpected error occurred while processing ${leaderboardName}:`, error);
        return { leaderboard: leaderboardName, status: 'error', reason: error.message };
    }
}

// --- The main handler logic remains the same, but is now more resilient ---
export default async function handler(request, response) {
    const allCombinations = [];
    for (const type of LEADERBOARD_TYPES) {
        for (const skill of SKILLS) {
            allCombinations.push({ leaderboardType: type, skill });
        }
    }

    const chunkSize = 14;
    const delayInMs = 60000;
    const allResults = [];

    console.log(`Starting leaderboard processing. Total: ${allCombinations.length} leaderboards in chunks of ${chunkSize}.`);

    for (let i = 0; i < allCombinations.length; i += chunkSize) {
        const chunk = allCombinations.slice(i, i + chunkSize);
        console.log(`Processing batch #${(i / chunkSize) + 1}...`);

        // Because processLeaderboard now handles its own errors, Promise.all will not fail fast.
        const chunkResults = await Promise.all(
            chunk.map(combo => processLeaderboard(combo.leaderboardType, combo.skill))
        );
        allResults.push(...chunkResults);
        console.log(`Batch #${(i / chunkSize) + 1} complete.`);

        if (i + chunkSize < allCombinations.length) {
            console.log(`Waiting for ${delayInMs / 1000} seconds before next batch...`);
            await sleep(delayInMs);
        }
    }

    const successfulJobs = allResults.filter(r => r.status === 'OK').length;
    const failedJobs = allResults.length - successfulJobs;
    console.log(`All leaderboard processing complete. Success: ${successfulJobs}, Failed: ${failedJobs}.`);

    response.status(200).json({ status: 'OK', successfulJobs, failedJobs, results: allResults });
}