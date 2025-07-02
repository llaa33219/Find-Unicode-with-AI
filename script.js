// DOM elements
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const analysisSection = document.getElementById('analysis-section');
const analysisResults = document.getElementById('analysis-results');
const resultsSection = document.getElementById('results-section');
const resultsContainer = document.getElementById('results-container');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');

// Event listeners
searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSearch();
    }
});

// Main search handler
async function handleSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        showError('Please enter a search query');
        return;
    }

    try {
        hideError();
        hideAllSections();
        showProgress('Analyzing your query with AI...', 20);
        
        // Step 1: Analyze query
        const analysisResult = await analyzeQuery(query);
        
        showProgress('Searching Unicode database...', 40);
        
        // Step 2: Search by criteria
        const searchResults = await searchUnicode(analysisResult);
        
        showProgress('AI filtering results...', 70);
        
        // Step 3: Filter with AI
        const finalResults = await filterResults(searchResults.results, analysisResult, query);
        
        showProgress('Complete!', 100);
        
        // Display results
        displayAnalysis(analysisResult);
        displayResults(finalResults.results);
        
        setTimeout(() => {
            hideProgress();
        }, 500);
        
    } catch (error) {
        console.error('Search error:', error);
        hideProgress();
        showError(`Search failed: ${error.message}`);
    }
}

// Step 1: Analyze query with AI
async function analyzeQuery(query) {
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Analysis error:', error);
        throw error;
    }
}

// Step 2: Search Unicode database
async function searchUnicode(criteria) {
    try {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ criteria })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Search error:', error);
        throw error;
    }
}

// Step 3: Filter results with AI
async function filterResults(candidates, criteria, query) {
    try {
        const response = await fetch('/api/filter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ candidates, criteria, query })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Filter error:', error);
        throw error;
    }
}

// Display analysis results
function displayAnalysis(analysis) {
    const activeCriteria = [];
    
    // Check each criteria type
    if (analysis.range && analysis.range.type) {
        activeCriteria.push({
            type: 'Range',
            title: analysis.range.title,
            description: analysis.range.description,
            keywords: analysis.range.keywords
        });
    }
    
    if (analysis.shape && analysis.shape.type) {
        activeCriteria.push({
            type: 'Shape',
            title: analysis.shape.title,
            description: analysis.shape.description,
            keywords: analysis.shape.keywords
        });
    }
    
    if (analysis.function && analysis.function.type) {
        activeCriteria.push({
            type: 'Function',
            title: analysis.function.title,
            description: analysis.function.description,
            keywords: analysis.function.keywords
        });
    }
    
    if (analysis.name && analysis.name.keywords && analysis.name.keywords.length > 0) {
        activeCriteria.push({
            type: 'Name',
            title: analysis.name.title,
            description: analysis.name.description,
            keywords: analysis.name.keywords
        });
    }

    analysisResults.innerHTML = activeCriteria.map(criterion => `
        <div class="analysis-item">
            <div class="analysis-header">
                <span class="analysis-type">${criterion.type}</span>
                <h4>${criterion.title}</h4>
            </div>
            <p class="analysis-description">${criterion.description}</p>
            <div class="analysis-keywords">
                ${criterion.keywords.map(keyword => 
                    `<span class="keyword">${keyword}</span>`
                ).join('')}
            </div>
        </div>
    `).join('');

    analysisSection.style.display = 'block';
}

// Display final results
function displayResults(results) {
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<p class="no-results">No matching characters found. Try a different search term.</p>';
        resultsSection.style.display = 'block';
        return;
    }

    resultsContainer.innerHTML = results.map(result => `
        <div class="result-item">
            <div class="character" data-char="${result.char}">${result.char}</div>
            <div class="character-info">
                <div class="character-name">${result.name}</div>
                <div class="character-code">${result.code}</div>
                <div class="character-scores">
                    <span class="score">Relevance: ${result.relevance_score}/10</span>
                    <span class="score">Visual: ${result.visual_match_score}/10</span>
                </div>
                <div class="character-analysis">${result.analysis}</div>
            </div>
            <button class="copy-btn" onclick="copyCharacter('${result.char}', this)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy
            </button>
        </div>
    `).join('');

    resultsSection.style.display = 'block';
}

// Copy character to clipboard
async function copyCharacter(char, button) {
    try {
        await navigator.clipboard.writeText(char);
        
        // Visual feedback
        const originalText = button.innerHTML;
        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20,6 9,17 4,12"></polyline>
            </svg>
            Copied!
        `;
        button.classList.add('copied');
        
        setTimeout(() => {
            button.innerHTML = originalText;
            button.classList.remove('copied');
        }, 2000);
        
    } catch (error) {
        console.error('Failed to copy:', error);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = char;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            button.textContent = 'Copied!';
            setTimeout(() => {
                button.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy
                `;
            }, 2000);
        } catch (err) {
            button.textContent = 'Copy failed';
            setTimeout(() => {
                button.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy
                `;
            }, 2000);
        }
        document.body.removeChild(textArea);
    }
}

// Progress management
function showProgress(text, percentage) {
    progressText.textContent = text;
    progressBar.style.width = `${percentage}%`;
    progressSection.style.display = 'block';
}

function hideProgress() {
    progressSection.style.display = 'none';
}

// Error management
function showError(message) {
    errorMessage.textContent = message;
    errorSection.style.display = 'block';
}

function hideError() {
    errorSection.style.display = 'none';
}

// Hide all sections
function hideAllSections() {
    progressSection.style.display = 'none';
    analysisSection.style.display = 'none';
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    searchInput.focus();
});

// Global error handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showError('An unexpected error occurred. Please try again.');
}); 