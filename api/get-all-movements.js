import { kv } from '@vercel/kv';

// These lists must be kept in sync with the cron job (`update-leaderboard.js`)
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

export default async function handler(request, response) {
    const keysToFetch = [];

    // 1. Generate keys for individual leaderboards and their timestamps
    for (const type of LEADERBOARD_TYPES) {
        for (const skill of SKILLS) {
            const name = `${type}-${skill}`;
            keysToFetch.push(`leaderboard:movements:${name}`);
            keysToFetch.push(`last-updated:${name}`);
            keysToFetch.push(`previous-updated:${name}`);
        }
    }

    // 2. Generate keys for the pre-calculated top movers lists
    for (const type of LEADERBOARD_TYPES) {
        keysToFetch.push(`top-gainers:${type}`);
        keysToFetch.push(`top-losers:${type}`);
    }

    // 3. Fetch all keys from the database in one efficient batch
    const allData = await kv.mget(...keysToFetch);

    // 4. Reconstruct the response object from the flat array of data
    const movementsData = {};
    const timestamps = {};
    let dataIndex = 0;

    // Process the individual leaderboard data
    for (const type of LEADERBOARD_TYPES) {
        for (const skill of SKILLS) {
            const name = `${type}-${skill}`;
            movementsData[name] = allData[dataIndex] || [];
            timestamps[name] = {
                lastUpdated: allData[dataIndex + 1],
                previousUpdated: allData[dataIndex + 2]
            };
            dataIndex += 3;
        }
    }

    // Process the top movers data
    const topMovers = {
        gainers: {},
        losers: {}
    };
    for (const type of LEADERBOARD_TYPES) {
        topMovers.gainers[type] = allData[dataIndex++] || [];
        topMovers.losers[type] = allData[dataIndex++] || [];
    }

    // 5. Send the complete, structured data to the frontend
    response.status(200).json({
        movementsData,
        timestamps,
        topMovers
    });
}