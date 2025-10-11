import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    // Read both 'skill' and 'leaderboardType' from the query string
    // Defaulting to 'total_level' and 'groupironman'
    const skill = request.query.skill || 'total_level';
    const leaderboardType = request.query.leaderboardType || 'groupironman';

    // Construct the key name from both parameters to match what the cron job saves
    const leaderboardName = `${leaderboardType}-${skill}`;
    const movementsKey = `leaderboard:movements:${leaderboardName}`;
    const lastUpdatedKey = `last-updated:${leaderboardName}`;

    // Fetch data for the requested combination
    const movements = await kv.get(movementsKey);
    const lastUpdated = await kv.get(lastUpdatedKey);

    response.status(200).json({
        movements: movements || [],
        lastUpdated: lastUpdated || null
    });
}