# Vercel
Vercel is the application hosting provider.
Application URL: idle-clans-leaderboard-movement.vercel.app
UpStash is the database provider
Redis was also created, but not used at this time.

# Running Vercel Local host

```
npm i -g vercel
vercel login
vercel link
vercel env pull
vercel dev
```
This will run the project on http://localhost:3000

# Idle Clans
api docs:  https://query.idleclans.com/api-docs/index.html

## Sample api calls
https://query.idleclans.com/api/Leaderboard/top/players:groupironman/foraging
https://query.idleclans.com/api/Player/profile/DerfRevrac
https://query.idleclans.com/api/Leaderboard/profile/players:groupironman/DerfRevrac

## Skills
total_level
smithing
woodcutting
crafting
enchanting
farming
foraging
carpentry
plundering
mining
cooking
brewing
agility
fishing
