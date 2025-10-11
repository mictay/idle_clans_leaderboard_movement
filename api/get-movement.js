import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    // Define which leaderboard to show. This should match the one in the update script.
    const leaderboardName = 'groupironman-foraging';

    const movements = await kv.get(`leaderboard:movements:${leaderboardName}`);

    // Return the data, or an empty array if no data has been saved yet
    response.status(200).json(movements || []);
}