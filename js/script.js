document.addEventListener('DOMContentLoaded', () => {
    // --- GLOBAL STATE ---
    let allMovementsData = {};
    let allTimestamps = {};
    let allTopMovers = { gainers: {}, losers: {} };
    let currentPlayers = [];
    let currentSortColumn = 'currentRank';
    let currentSortDirection = 'asc';

    // --- ELEMENT SELECTORS ---
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
        if (currentPlayers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem;">No data available.</td></tr>`;
            return;
        }
        currentPlayers.forEach(p => {
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
        const leaderboardType = leaderboardSelector.value;
        renderTopMoversTable("#gains-table", allTopMovers.gainers[leaderboardType] || [], true);
        renderTopMoversTable("#losses-table", allTopMovers.losers[leaderboardType] || [], false);
    }

    function updateLeaderboardView() {
        const leaderboardType = leaderboardSelector.value;
        const skill = skillSelector.value;
        const leaderboardKey = `${leaderboardType}-${skill}`;
        currentPlayers = allMovementsData[leaderboardKey] || [];
        const timestamps = allTimestamps[leaderboardKey] || {};

        leaderboardTitle.textContent = `${leaderboardSelector.options[leaderboardSelector.selectedIndex].text} - ${skillSelector.options[skillSelector.selectedIndex].text}`;
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

    // --- INITIALIZATION ---
    async function initialize() {
        try {
            const response = await fetch('/api/get-all-movements');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            allMovementsData = data.movementsData;
            allTimestamps = data.timestamps;
            allTopMovers = data.topMovers;

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
            skillSelectorGroup.style.display = targetViewId === 'leaderboard-view' ? 'flex' : 'none';
        });
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

    initialize();
});