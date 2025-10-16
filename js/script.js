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
    const playerSearchInput = document.querySelector("#player-search");

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

    // Listener for clicking a player row to select/highlight them
    leaderboardTable.querySelector('tbody').addEventListener('click', (event) => {
        const row = event.target.closest('tr');
        if (!row || row.parentElement.tagName.toLowerCase() !== 'tbody') return;

        const playerName = row.cells[1].textContent.trim();
        if (playerName) {
            localStorage.setItem('selectedPlayer', playerName);
            playerSearchInput.value = playerName; // Sync search box
            highlightSelectedPlayer();
        }
    });

    // Listener for the search input to clear the selection
    playerSearchInput.addEventListener('input', () => {
        // If user clears the search box, clear the selection
        if (playerSearchInput.value.trim() === '') {
            localStorage.removeItem('selectedPlayer');
            highlightSelectedPlayer();
        }
        // Note: A full autocomplete is more complex, but this handles clearing.
        // To complete the autocomplete, you would filter `allPlayerNames` here
        // and display a dropdown of suggestions. When a suggestion is clicked,
        // you'd set localStorage and call highlightSelectedPlayer().
    });

    initialize();
});
