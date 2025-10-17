document.addEventListener('DOMContentLoaded', () => {
    // --- GLOBAL STATE ---
    let allMovementsData = {};
    let allTimestamps = {};
    let allTopMovers = { gainers: {}, losers: {} };
    let currentPlayers = [];
    let currentSortColumn = 'currentRank';
    let currentSortDirection = 'asc';
    let currentPage = 1; // For pagination
    let allPlayerNames = new Set(); // Using a Set for automatic uniqueness

    // --- SHARED CONSTANTS (for dynamic dropdown) ---
    const PLAYERS_AND_CLANS_SKILLS = [
        'total_level', 'smithing', 'woodcutting', 'crafting', 'enchanting',
        'farming', 'foraging', 'carpentry', 'plundering', 'mining',
        'cooking', 'brewing', 'agility', 'fishing', 'exterminating',
        'attack', 'strength', 'magic', 'defence', 'archery', 'health',
        'zeus', 'medusa', 'hades', 'griffin', 'devil', 'chimera', 'sobek',
        'kronos', 'malignant_spider', 'skeleton_warrior', 'otherworldly_golem',
        'reckoning_of_the_gods', 'guardians_of_the_citadel', 'bloodmoon_massacre'
    ];
    const PET_SKILLS = [
        'total_level', 'smithing', 'woodcutting', 'crafting', 'enchanting',
        'farming', 'foraging', 'carpentry', 'plundering', 'mining',
        'cooking', 'brewing', 'agility', 'fishing', 'exterminating',
        'attack', 'strength', 'magic', 'defence', 'archery', 'health'
    ];

    // --- ELEMENT SELECTORS ---
    const entityTypeSelector = document.querySelector("#entity-type-selector");
    const leaderboardSelector = document.querySelector("#leaderboard-selector");
    const skillSelector = document.querySelector("#skill-selector");
    const skillSelectorGroup = document.querySelector("#skill-selector-group");
    const updatedText = document.querySelector("#last-updated");
    const leaderboardTitle = document.querySelector("#leaderboard-title");
    const views = document.querySelectorAll('.view');
    const toggleButtons = document.querySelectorAll('.toggle-btn');
    const leaderboardTable = document.querySelector("#leaderboard-table");
    const rankDurationSpan = document.querySelector("#rank-change-duration");
    const scoreDurationSpan = document.querySelector("#score-change-duration");
    const paginationControls = document.querySelector(".pagination-controls");
    const playerSearchInput = document.querySelector("#player-search");
    const autocompleteResults = document.querySelector("#autocomplete-results");
    const highlightedPlayerBtn = document.querySelector("#highlighted-player-btn");
    const highlightedPlayerTitle = document.querySelector("#highlighted-player-title");
    const highlightedPlayerTableBody = document.querySelector("#highlighted-player-table tbody");

    // --- UTILITY FUNCTIONS ---
    const formatSkillName = (skill) => skill.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const formatDuration = (last, previous) => {
        if (!last || !previous) return "(Daily)";
        const diffMs = new Date(last).getTime() - new Date(previous).getTime();
        if (diffMs <= 0) return "(Daily)";
        const totalHours = diffMs / 3600000;
        const hours = Math.floor(totalHours);
        const minutes = Math.round((totalHours - hours) * 60);
        return `(${hours}h ${minutes}m)`;
    };

    // --- DYNAMIC UI FUNCTIONS ---
    function populateSkillSelector(entityType) {
        const skills = (entityType === 'pets') ? PET_SKILLS : PLAYERS_AND_CLANS_SKILLS;
        let optionsHtml = '';
        skills.forEach(skill => {
            const displayName = (skill === 'total_level') ? 'Total Exp' : formatSkillName(skill);
            optionsHtml += `<option value="${skill}">${displayName}</option>`;
        });
        skillSelector.innerHTML = optionsHtml;
    }

    // --- RENDERING LOGIC ---
    function renderTopMoversTable(tableId, players, isGainers) {
        const table = document.querySelector(tableId);
        let content = `<thead><tr><th>Player</th><th>Current Rank</th><th>Skill</th><th>Rank Change</th><th>Exp Change</th></tr></thead><tbody>`;
        if (players.length === 0) {
            content += `<tr><td colspan="5" style="text-align: center; padding: 2rem;">No significant movements found.</td></tr>`;
        } else {
            players.forEach(p => {
                const rankChangeClass = isGainers ? 'positive' : 'negative';
                const expChangeClass = p.scoreDelta > 0 ? 'positive' : 'negative';
                content += `<tr>
                    <td>${p.username}</td>
                    <td>${p.currentRank}</td>
                    <td>${formatSkillName(p.skill)}</td>
                    <td class="${rankChangeClass}">${p.movement > 0 ? '+' : ''}${p.movement}</td>
                    <td class="${expChangeClass}">${p.scoreDelta > 0 ? '+' : ''}${p.scoreDelta.toLocaleString()}</td>
                </tr>`;
            });
        }
        table.innerHTML = content + `</tbody>`;
    }

    function renderLeaderboardTable() {
        const tbody = leaderboardTable.querySelector('tbody');
        tbody.innerHTML = '';

        if (currentPlayers.length > 100) {
            paginationControls.style.display = 'flex';
        } else {
            paginationControls.style.display = 'none';
        }

        if (currentPlayers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem;">No data available.</td></tr>`;
            return;
        }

        const startIndex = (currentPage - 1) * 100;
        const endIndex = startIndex + 100;
        const pagePlayers = currentPlayers.slice(startIndex, endIndex);

        pagePlayers.forEach(p => {
            const row = document.createElement('tr');
            const expChangeClass = p.scoreDelta > 0 ? 'positive' : 'negative';
            const rankChangeClass = p.movement > 0 ? 'positive' : 'negative';
            row.innerHTML = `
                <td>${p.currentRank}</td>
                <td>${p.username}</td>
                <td>${p.score.toLocaleString()}</td>
                <td class="${rankChangeClass}">${p.movement > 0 ? '+' : ''}${p.movement}</td>
                <td class="${expChangeClass}">${p.scoreDelta > 0 ? '+' : ''}${p.scoreDelta.toLocaleString()}</td>`;
            tbody.appendChild(row);
        });

        highlightSelectedPlayer();
    }

    function renderHighlightedPlayerView() {
        const selectedPlayer = localStorage.getItem('selectedPlayer');
        highlightedPlayerTableBody.innerHTML = ''; // Clear previous data

        if (!selectedPlayer) {
            highlightedPlayerTitle.textContent = 'No Player Selected';
            highlightedPlayerTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">Please select a player to see their stats.</td></tr>`;
            return;
        }

        highlightedPlayerTitle.textContent = `All Stats for ${selectedPlayer}`;
        let playerRecords = [];

        // Iterate through ALL leaderboards to find the player
        for (const [leaderboardKey, leaderboard] of Object.entries(allMovementsData)) {
            const foundPlayer = leaderboard.find(p => p.username === selectedPlayer);

            if (foundPlayer) {
                // The key format is "entity-gamemode-skill"
                const [entityType, gameMode, skill] = leaderboardKey.split('-');
                playerRecords.push({
                    ...foundPlayer,
                    gameMode: formatSkillName(gameMode),
                    entityType: formatSkillName(entityType),
                    skill: formatSkillName(skill),
                });
            }
        }

        if (playerRecords.length === 0) {
            highlightedPlayerTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">No leaderboard data found for this player.</td></tr>`;
            return;
        }

        // Sort records by total experience for a logical order
        playerRecords.sort((a, b) => b.score - a.score);

        playerRecords.forEach(p => {
            const row = document.createElement('tr');
            const expChangeClass = p.scoreDelta > 0 ? 'positive' : 'negative';
            const rankChangeClass = p.movement > 0 ? 'positive' : 'negative';
            row.innerHTML = `
            <td>${p.currentRank}</td>
            <td>${p.gameMode}</td>
            <td>${p.entityType}</td>
            <td>${p.skill}</td>
            <td>${p.score.toLocaleString()}</td>
            <td class="${rankChangeClass}">${p.movement > 0 ? '+' : ''}${p.movement}</td>
            <td class="${expChangeClass}">${p.scoreDelta > 0 ? '+' : ''}${p.scoreDelta.toLocaleString()}</td>`;
            highlightedPlayerTableBody.appendChild(row);
        });
    }

    // --- DATA & VIEW UPDATE LOGIC ---
    function sortData() {
        currentPlayers.sort((a, b) => {
            const valA = a[currentSortColumn];
            const valB = b[currentSortColumn];
            const comparison = typeof valA === 'string' ? valA.localeCompare(valB) : valA - valB;
            return currentSortDirection === 'desc' ? -comparison : comparison;
        });
    }

    function updateSortIndicators() {
        leaderboardTable.querySelectorAll('.sortable').forEach(header => {
            const indicator = header.querySelector('.sort-indicator');
            indicator.textContent = header.dataset.sort === currentSortColumn ? (currentSortDirection === 'asc' ? '▲' : '▼') : '';
        });
    }

    function updateTopMoversViews() {
        const entityType = entityTypeSelector.value;
        const leaderboardType = leaderboardSelector.value;
        const moversKey = `${entityType}:${leaderboardType}`;
        renderTopMoversTable("#gains-table", allTopMovers.gainers[moversKey] || [], true);
        renderTopMoversTable("#losses-table", allTopMovers.losers[moversKey] || [], false);
    }

    function updateLeaderboardView() {
        currentPage = 1; // Reset to page 1
        paginationControls.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.page, 10) === currentPage);
        });

        const entityType = entityTypeSelector.value;
        const leaderboardType = leaderboardSelector.value;
        const skill = skillSelector.value;
        const leaderboardKey = `${entityType}-${leaderboardType}-${skill}`;

        currentPlayers = allMovementsData[leaderboardKey] || [];
        const timestamps = allTimestamps[leaderboardKey] || {};

        leaderboardTitle.textContent = `${entityTypeSelector.options[entityTypeSelector.selectedIndex].text} - ${leaderboardSelector.options[leaderboardSelector.selectedIndex].text} - ${skillSelector.options[skillSelector.selectedIndex].text}`;
        const durationText = formatDuration(timestamps.lastUpdated, timestamps.previousUpdated);
        rankDurationSpan.textContent = durationText;
        scoreDurationSpan.textContent = durationText;

        if (timestamps.lastUpdated) {
            const lastDate = new Date(timestamps.lastUpdated).toLocaleString();
            let displayText = `Last Updated: ${lastDate}`;
            if (timestamps.previousUpdated) {
                const prevDate = new Date(timestamps.previousUpdated).toLocaleString();
                displayText += ` (Previously: ${prevDate})`;
            }
            updatedText.textContent = displayText;
        } else {
            updatedText.textContent = 'No update time available for this leaderboard.';
        }

        sortData();
        renderLeaderboardTable();
        updateSortIndicators();
    }

    function highlightSelectedPlayer() {
        const selectedPlayer = localStorage.getItem('selectedPlayer');
        const tbody = leaderboardTable.querySelector('tbody');

        // First, remove any existing highlights
        tbody.querySelectorAll('tr.highlighted-row').forEach(row => {
            row.classList.remove('highlighted-row');
        });

        if (selectedPlayer) {
            tbody.querySelectorAll('tr').forEach(row => {
                // Assuming player name is in the second cell (index 1)
                const nameCell = row.cells[1];
                if (nameCell && nameCell.textContent.trim() === selectedPlayer) {
                    row.classList.add('highlighted-row');
                }
            });
        }
    }

    function updateHighlightedPlayerButtonState() {
        const selectedPlayer = localStorage.getItem('selectedPlayer');
        if (selectedPlayer) {
            highlightedPlayerBtn.style.display = 'inline-block';
        } else {
            highlightedPlayerBtn.style.display = 'none';
        }
    }

    // --- INITIALIZATION ---
    async function initialize() {
        try {
            populateSkillSelector(entityTypeSelector.value);
            const response = await fetch('/api/get-all-movements');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            allMovementsData = data.movementsData;
            allTimestamps = data.timestamps;
            allTopMovers = data.topMovers;

            Object.values(allMovementsData).forEach(leaderboard => {
                leaderboard.forEach(player => allPlayerNames.add(player.username));
            });

            const savedPlayer = localStorage.getItem('selectedPlayer');
            if (savedPlayer) {
                playerSearchInput.value = savedPlayer;
            }
            updateHighlightedPlayerButtonState();
            updateLeaderboardView();
            updateTopMoversViews();
        } catch (error) {
            updatedText.textContent = "Failed to load leaderboard data. Please try again later.";
            console.error("Initialization failed:", error);
        }
    }

    // --- EVENT LISTENERS ---
    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetViewId = button.dataset.view;
            views.forEach(view => view.classList.toggle('active', view.id === targetViewId));
            toggleButtons.forEach(btn => btn.classList.toggle('active', btn === button));

            const isLeaderboardView = targetViewId === 'leaderboard-view';
            skillSelectorGroup.style.display = isLeaderboardView ? 'flex' : 'none';
            paginationControls.style.display = isLeaderboardView && currentPlayers.length > 100 ? 'flex' : 'none';

            if (targetViewId === 'highlighted-player-view') {
                renderHighlightedPlayerView();
            }

        });
    });

    entityTypeSelector.addEventListener('change', () => {
        populateSkillSelector(entityTypeSelector.value);
        updateLeaderboardView();
        updateTopMoversViews();
    });

    leaderboardSelector.addEventListener('change', () => {
        updateLeaderboardView();
        updateTopMoversViews();
    });

    skillSelector.addEventListener('change', updateLeaderboardView);

    leaderboardTable.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const sortKey = header.dataset.sort;
            if (sortKey === currentSortColumn) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = sortKey;
                currentSortDirection = 'asc';
            }
            sortData();
            renderLeaderboardTable();
            updateSortIndicators();
        });
    });

    paginationControls.addEventListener('click', (event) => {
        if (event.target.matches('.pagination-btn')) {
            const page = parseInt(event.target.dataset.page, 10);
            if (page !== currentPage) {
                currentPage = page;
                paginationControls.querySelectorAll('.pagination-btn').forEach(btn => {
                    btn.classList.toggle('active', parseInt(btn.dataset.page, 10) === currentPage);
                });
                renderLeaderboardTable();
            }
        }
    });

    // Listener for typing in the search input field
    playerSearchInput.addEventListener('input', function () {
        const inputValue = this.value;
        autocompleteResults.innerHTML = ''; // Clear old results on every keystroke

        if (!inputValue) {
            localStorage.removeItem('selectedPlayer');
            highlightSelectedPlayer();
            updateHighlightedPlayerButtonState(); // <-- ADD THIS
            return;
        }

        // Filter the master list of names based on the input
        const filteredNames = Array.from(allPlayerNames).filter(name =>
            name.toLowerCase().includes(inputValue.toLowerCase())
        );

        // Create and display a div for each of the top 10 matches
        filteredNames.slice(0, 10).forEach(playerName => {
            const suggestionDiv = document.createElement('div');

            // Make the matching text bold for better visibility
            const matchIndex = playerName.toLowerCase().indexOf(inputValue.toLowerCase());
            const matchEnd = matchIndex + inputValue.length;
            suggestionDiv.innerHTML =
                playerName.substring(0, matchIndex) +
                `<strong>${playerName.substring(matchIndex, matchEnd)}</strong>` +
                playerName.substring(matchEnd);

            // Add a click listener to each suggestion item
            suggestionDiv.addEventListener('click', () => {
                playerSearchInput.value = playerName; // Update the search box text
                localStorage.setItem('selectedPlayer', playerName); // Save the selection
                highlightSelectedPlayer(); // Apply the highlight
                updateHighlightedPlayerButtonState();
                autocompleteResults.innerHTML = ''; // Close the suggestions list
            });

            autocompleteResults.appendChild(suggestionDiv);
        });
    });

    // Listener for clicking a player row in the main table
    leaderboardTable.querySelector('tbody').addEventListener('click', (event) => {
        const row = event.target.closest('tr');
        if (!row || !row.cells[1]) return; // Ensure it's a valid player row

        const playerName = row.cells[1].textContent.trim();
        playerSearchInput.value = playerName; // Sync the search box
        localStorage.setItem('selectedPlayer', playerName); // Save selection
        highlightSelectedPlayer(); // Apply highlight
        updateHighlightedPlayerButtonState();
        autocompleteResults.innerHTML = ''; // Close suggestions if they are open
    });

    // Listener to close the autocomplete list if the user clicks anywhere else
    document.addEventListener('click', (event) => {
        const searchContainer = document.querySelector('.autocomplete-container');
        if (!searchContainer.contains(event.target)) {
            autocompleteResults.innerHTML = '';
        }
    });

    initialize();
});
