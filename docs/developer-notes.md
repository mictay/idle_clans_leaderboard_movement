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

# Upstash

leaderboard:movements*

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
agility
exterminating
attack
strength
magic
defence
archery
health
zeus
medusa
hades
griffin
devil
chimera
sobek
kronos
malignant_spider
skeleton_warrior
otherworldly_golem
reckoning_of_the_gods
guardians_of_the_citadel
bloodmoon_massacre


# API - update-leaderboard

- Normal Cron Job: Your vercel.json file does not need to change. The cron will continue to call /api/update-leaderboard without parameters, so startIndex will default to 0 and the job will run from the beginning.

- Manual Trigger (Local or Deployed): To start from a specific point, you can now add the query parameter to the URL in your browser or with curl.
- - To start from the beginning: https://your-site.vercel.app/api/update-leaderboard
- - To skip the first 14 and start at the 15th leaderboard (index 14): https://your-site.vercel.app/api/update-leaderboard?startIndex=14
- - To restart from the 50th leaderboard (index 49): https://your-site.vercel.app/api/update-leaderboard?startIndex=49

# Running the Cron job locall
Terminal 1
```
vercel dev
```

Terminal 2 (powershell)
```
Invoke-WebRequest http://localhost:3000/api/update-leaderboard?startIndex=0 -TimeoutSec 1800
```

terminal 2 may time out, just update the startIndex=0 to the last successful index
