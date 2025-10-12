import { kv } from '@vercel/kv';
import { LEADERBOARD_TYPES, SKILLS } from '../lib/constants.js';

export default async function handler(request, response) {

    // Secure this endpoint just like the other one.
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (!isDevelopment) {
        const authHeader = request.headers && typeof request.headers.get === "function" ? request.headers.get('authorization') : null;
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return response.status(401).json({ error: 'Unauthorized' });
        }
    }

    console.log("Starting Top 10 movers calculation...");

    // Generate all the keys we need to read from the database.
    const allMovementKeys = [];
    for (const type of LEADERBOARD_TYPES) {
        for (const skill of SKILLS) {
            allMovementKeys.push(`leaderboard:movements:${type}-${skill}`);
        }
    }

    // Fetch all movement data in one batch.
    const allMovementsData = await kv.mget(...allMovementKeys);

    // Analyze the data for each game mode.
    for (const type of LEADERBOARD_TYPES) {
        const flatPlayerList = [];

        // Create a flat list of all player movements for this game mode.
        for (const skill of SKILLS) {
            const key = `leaderboard:movements:${type}-${skill}`;
            const index = allMovementKeys.indexOf(key);
            const movementData = allMovementsData[index];

            if (movementData && Array.isArray(movementData)) {
                movementData.forEach(player => {
                    if (player.movement !== 0) {
                        flatPlayerList.push({ ...player, skill });
                    }
                });
            }
        }

        // Calculate, save Top 10 Gainers.
        flatPlayerList.sort((a, b) => b.movement - a.movement);
        await kv.set(`top-gainers:${type}`, flatPlayerList.slice(0, 10));

        // Calculate, save Top 10 Losers.
        flatPlayerList.sort((a, b) => a.movement - b.movement);
        await kv.set(`top-losers:${type}`, flatPlayerList.filter(p => p.movement < 0).slice(0, 10));

        console.log(`Saved Top 10 movers for ${type}.`);
    }

    console.log("Top 10 movers calculation complete.");
    response.status(200).json({ status: 'OK', message: 'Top movers calculated successfully.' });
}