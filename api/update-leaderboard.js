import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    // 1. Define keys
    const leaderboardType = 'groupironman';
    const skill = 'foraging';
    const leaderboardName = `${leaderboardType}-${skill}`;
    const apiUrl = `https://query.idleclans.com/api/Leaderboard/top/players:${leaderboardType}/${skill}`;
    const movementsKey = `leaderboard:movements:${leaderboardName}`;
    const lastUpdatedKey = `last-updated:${leaderboardName}`; // New key for the timestamp

    // ... (The rest of the fetching and processing logic remains the same) ...
    const apiResponse = await fetch(apiUrl);
    if (!apiResponse.ok) {
        return response.status(500).json({ error: 'Failed to fetch Idle Clans API' });
    }
    const currentLeaderboard = await apiResponse.json();

    // (Cleanup logic for dropped players - no changes here)
    const currentPlayerUsernames = new Set(currentLeaderboard.map(p => p.username));
    const previousResults = await kv.get(movementsKey);
    const playersToDelete = [];

    if (previousResults && Array.isArray(previousResults)) {
        for (const oldPlayer of previousResults) {
            if (!currentPlayerUsernames.has(oldPlayer.username)) {
                const playerKey = `${leaderboardName}:player:${oldPlayer.username}`;
                playersToDelete.push(playerKey);
            }
        }
    }

    if (playersToDelete.length > 0) {
        await Promise.all(playersToDelete.map(key => kv.del(key)));
    }

    // (Movement calculation logic - no changes here)
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

        await kv.set(playerKey, currentRank);
    }

    // 5. Store the final calculated movements AND the new timestamp
    const currentTime = new Date().toISOString();
    await kv.set(movementsKey, movementResults);
    await kv.set(lastUpdatedKey, currentTime); // Save the current time

    // (Response logic - no changes here)
    response.status(200).json({
        status: 'OK',
        leaderboard: leaderboardName,
        processed: movementResults.length,
        deleted: playersToDelete.length
    });
}