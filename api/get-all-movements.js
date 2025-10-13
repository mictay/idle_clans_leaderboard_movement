import { kv } from '@vercel/kv';
import { ENTITY_TYPES, LEADERBOARD_TYPES, PLAYERS_AND_CLANS_SKILLS, PET_SKILLS } from '../lib/constants.js';

export default async function handler(request, response) {
  const keysToFetch = [];
  
  // 1. Generate keys for individual leaderboards and their timestamps
  for (const entityType of ENTITY_TYPES) {
    const skills = (entityType === 'pets') ? PET_SKILLS : PLAYERS_AND_CLANS_SKILLS;
    for (const type of LEADERBOARD_TYPES) {
      for (const skill of skills) {
        const name = `${entityType}-${type}-${skill}`;
        keysToFetch.push(`leaderboard:movements:${name}`);
        keysToFetch.push(`last-updated:${name}`);
        keysToFetch.push(`previous-updated:${name}`);
      }
    }
  }

  // 2. Generate keys for the pre-calculated top movers lists
  for (const entityType of ENTITY_TYPES) {
    for (const type of LEADERBOARD_TYPES) {
      keysToFetch.push(`top-gainers:${entityType}:${type}`);
      keysToFetch.push(`top-losers:${entityType}:${type}`);
    }
  }

  // 3. Fetch all keys from the database in one efficient batch
  const allData = await kv.mget(...keysToFetch);

  // 4. Reconstruct the response object from the flat array of data
  const movementsData = {};
  const timestamps = {};
  let dataIndex = 0;
  
  // Process the individual leaderboard data
  for (const entityType of ENTITY_TYPES) {
    const skills = (entityType === 'pets') ? PET_SKILLS : PLAYERS_AND_CLANS_SKILLS;
    for (const type of LEADERBOARD_TYPES) {
      for (const skill of skills) {
        const name = `${entityType}-${type}-${skill}`;
        movementsData[name] = allData[dataIndex] || [];
        timestamps[name] = {
          lastUpdated: allData[dataIndex + 1],
          previousUpdated: allData[dataIndex + 2]
        };
        dataIndex += 3;
      }
    }
  }

  // Process the top movers data
  const topMovers = {
    gainers: {},
    losers: {}
  };
  for (const entityType of ENTITY_TYPES) {
    for (const type of LEADERBOARD_TYPES) {
        const key = `${entityType}:${type}`;
        topMovers.gainers[key] = allData[dataIndex++] || [];
        topMovers.losers[key] = allData[dataIndex++] || [];
    }
  }
  
  // 5. Send the complete, structured data to the frontend
  response.status(200).json({
    movementsData,
    timestamps,
    topMovers
  });
}
