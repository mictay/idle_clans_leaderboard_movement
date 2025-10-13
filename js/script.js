document.addEventListener('DOMContentLoaded', () => {
    // --- GLOBAL STATE ---
    // The data structures remain the same, but will be populated with more data.

    // --- ELEMENT SELECTORS ---
    const entityTypeSelector = document.querySelector("#entity-type-selector");
    // ... other selectors are the same ...

    // --- DYNAMIC SKILL LISTS (for the dropdown) ---
    const playersAndClansSkills = [ /* ... full list from constants ... */];
    const petSkills = [ /* ... smaller list from constants ... */];

    // --- NEW FUNCTION: To update the skill dropdown options ---
    function populateSkillSelector(entityType) {
        const skills = (entityType === 'pets') ? petSkills : playersAndClansSkills;
        let optionsHtml = '';
        skills.forEach(skill => {
            const displayName = (skill === 'total_level') ? 'Total Exp' : formatSkillName(skill);
            optionsHtml += `<option value="${skill}">${displayName}</option>`;
        });
        skillSelector.innerHTML = optionsHtml;
    }

    // --- DATA & VIEW UPDATE LOGIC ---
    function updateTopMoversViews() {
        // This function now reads from all three selectors to find the right data.
        const entityType = entityTypeSelector.value;
        const leaderboardType = leaderboardSelector.value;
        const gainers = allTopMovers.gainers[`${entityType}:${leaderboardType}`] || [];
        const losers = allTopMovers.losers[`${entityType}:${leaderboardType}`] || [];
        // ... render tables ...
    }

    function updateLeaderboardView() {
        // This function also reads from all three selectors.
        const entityType = entityTypeSelector.value;
        const leaderboardType = leaderboardSelector.value;
        const skill = skillSelector.value;
        const leaderboardKey = `${entityType}-${leaderboardType}-${skill}`;
        // ... get data and render ...
    }

    // --- EVENT LISTENERS ---
    entityTypeSelector.addEventListener('change', () => {
        const selectedEntity = entityTypeSelector.value;
        populateSkillSelector(selectedEntity);
        // After updating the skills, re-render all views.
        updateLeaderboardView();
        updateTopMoversViews();
    });

    leaderboardSelector.addEventListener('change', () => {
        updateLeaderboardView();
        updateTopMoversViews();
    });

    // --- INITIALIZATION ---
    // Initialize the skill dropdown on first load.
    populateSkillSelector(entityTypeSelector.value);
    initialize();
});