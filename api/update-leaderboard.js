import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    // 1. Define the leaderboard and construct the API URL and KV keys
    const leaderboardType = 'groupironman';
    const skill = 'foraging';
    const leaderboardName = `${leaderboardType}-${skill}`;
    const apiUrl = `https://query.idleclans.com/api/Leaderboard/top/players:${leaderboardType}/${skill}`;
    const movementsKey = `leaderboard:movements:${leaderboardName}`;

    // 2. Fetch current leaderboard data from the Idle Clans API
    const apiResponse = await fetch(apiUrl);
    if (!apiResponse.ok) {
        return response.status(500).json({ error: 'Failed to fetch Idle Clans API' });
    }
    const currentLeaderboard = await apiResponse.json();

    // ====================================================================
    // === NEW: Step 3 - Clean up players who fell off the leaderboard ===
    // ====================================================================

    // Create a Set of current players for very fast lookups (O(1) complexity)
    const currentPlayerUsernames = new Set(currentLeaderboard.map(p => p.username));

    // Get the results we saved yesterday
    const previousResults = await kv.get(movementsKey);
    const playersToDelete = [];

    if (previousResults && Array.isArray(previousResults)) {
        for (const oldPlayer of previousResults) {
            // If a player from yesterday's list is NOT in today's list...
            if (!currentPlayerUsernames.has(oldPlayer.username)) {
                // ...add their specific KV key to a deletion list.
                const playerKey = `${leaderboardName}:player:${oldPlayer.username}`;
                playersToDelete.push(playerKey);
            }
        }
    }

    // Delete all the dropped-off players from KV.
    // Using Promise.all is more efficient than awaiting each deletion one by one.
    if (playersToDelete.length > 0) {
        await Promise.all(playersToDelete.map(key => kv.del(key)));
    }

    // ====================================================================
    // === Step 4 - Process the current leaderboard (existing logic)    ===
    // ====================================================================

    const movementResults = [];

    for (const [index, player] of currentLeaderboard.entries()) {
        const playerName = player.username;
        const currentRank = index + 1;
        const playerKey = `${leaderboardName}:player:${playerName}`;

        const oldRank = await kv.get(playerKey);

        let movement = 0;
        if (oldRank !== null) {
            movement = oldRank - currentRank;
        }

        movementResults.push({
            username: playerName,
            currentRank: currentRank,
            movement: movement,
            score: player.score
        });

        // Save the new rank for tomorrow's comparison
        await kv.set(playerKey, currentRank);
    }

    // 5. Store the final calculated movements in the single key for the frontend
    await kv.set(movementsKey, movementResults);

    // 6. Send a success response
    response.status(200).json({
        status: 'OK',
        leaderboard: leaderboardName,
        processed: movementResults.length,
        deleted: playersToDelete.length
    });
}