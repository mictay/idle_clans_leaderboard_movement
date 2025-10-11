import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    const skill = request.query.skill || 'total_level';
    const leaderboardType = request.query.leaderboardType || 'groupironman';

    const leaderboardName = `${leaderboardType}-${skill}`;
    const movementsKey = `leaderboard:movements:${leaderboardName}`;
    const lastUpdatedKey = `last-updated:${leaderboardName}`;
    // --- NEW: Key for the previous timestamp ---
    const previousUpdatedKey = `previous-updated:${leaderboardName}`;

    // Fetch all three pieces of data
    const movements = await kv.get(movementsKey);
    const lastUpdated = await kv.get(lastUpdatedKey);
    const previousUpdated = await kv.get(previousUpdatedKey);

    // Return an object containing all data
    response.status(200).json({
        movements: movements || [],
        lastUpdated: lastUpdated || null,
        previousUpdated: previousUpdated || null
    });
}