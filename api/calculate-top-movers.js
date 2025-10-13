import { kv } from '@vercel/kv';
import { ENTITY_TYPES, LEADERBOARD_TYPES, PLAYERS_AND_CLANS_SKILLS, PET_SKILLS } from '../lib/constants.js';

export default async function handler(request, response) {
    // Security check: Block unauthorized web access in production.
    const isDevelopment = process.env.NODE_ENV === 'development';
    // if (!isDevelopment) {
    //     const authHeader = request.headers.get('authorization');
    //     if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //         return response.status(401).json({ error: 'Unauthorized' });
    //     }
    // }

    // Determine the environment prefix.
    const requestedEnv = request.query.env;
    const env = requestedEnv || process.env.VERCEL_ENV || 'development';

    console.log(`Calculating Top 10 movers for environment: ${env}`);

    try {
        // Analyze the data for each combination of entity and game mode.
        for (const entityType of ENTITY_TYPES) {
            for (const type of LEADERBOARD_TYPES) {
                const skills = (entityType === 'pets') ? PET_SKILLS : PLAYERS_AND_CLANS_SKILLS;

                // Generate all the keys we need to read from the database for this specific combination.
                const allMovementKeys = skills.map(skill => `leaderboard:movements:${env}:${entityType}-${type}-${skill}`);

                if (allMovementKeys.length === 0) continue;

                // Fetch all relevant movement data in one batch.
                const allMovementsData = await kv.mget(...allMovementKeys);

                const flatPlayerList = [];

                // Create a flat list of all player movements.
                allMovementsData.forEach((movementData, index) => {
                    if (movementData && Array.isArray(movementData)) {
                        movementData.forEach(player => {
                            if (player.movement !== 0) {
                                // Add the specific skill to the player object for context.
                                flatPlayerList.push({ ...player, skill: skills[index] });
                            }
                        });
                    }
                });

                // Calculate and save Top 10 Gainers.
                flatPlayerList.sort((a, b) => b.movement - a.movement);
                await kv.set(`top-gainers:${env}:${entityType}:${type}`, flatPlayerList.slice(0, 10));

                // Calculate and save Top 10 Losers.
                flatPlayerList.sort((a, b) => a.movement - b.movement);
                await kv.set(`top-losers:${env}:${entityType}:${type}`, flatPlayerList.filter(p => p.movement < 0).slice(0, 10));

                console.log(`Saved Top 10 movers for ENV: ${env}, ENTITY: ${entityType}, MODE: ${type}.`);
            }
        }

        console.log("Top 10 movers calculation complete.");
        response.status(200).json({ status: 'OK', message: 'Top movers calculated successfully.' });

    } catch (error) {
        console.error("An error occurred during Top Movers calculation:", error);
        response.status(500).json({ status: 'Error', message: 'Failed to calculate top movers.' });
    }
}