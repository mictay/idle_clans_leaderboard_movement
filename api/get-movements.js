import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    const leaderboardName = 'groupironman-foraging';
    const movementsKey = `leaderboard:movements:${leaderboardName}`;
    const lastUpdatedKey = `last-updated:${leaderboardName}`; // Key for the timestamp

    // Fetch both pieces of data from the database
    const movements = await kv.get(movementsKey);
    const lastUpdated = await kv.get(lastUpdatedKey);

    // Return an object containing both movements and the timestamp
    response.status(200).json({
        movements: movements || [],
        lastUpdated: lastUpdated || null
    });
}