// DOM elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const progressSection = document.getElementById('progressSection');
const progressBar = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const analysisSection = document.getElementById('analysisSection');
const analysisResults = document.getElementById('criteriaGrid');
const resultsSection = document.getElementById('resultsSection');
const resultsContainer = document.getElementById('resultsGrid');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');

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
        console.log('Filter request data:', { candidates, criteria, query });
        
        const response = await fetch('/api/filter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ candidates, criteria, query })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Filter API error response:', errorText);
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
        <div class="criteria-item">
            <h4>${criterion.title}</h4>
            <p>${criterion.description}</p>
            <div class="keywords">
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

    resultsContainer.innerHTML = results.map((result, index) => `
        <div class="result-item">
            <div class="result-header">
                <div class="result-char">${result.char}</div>
                <div class="result-info">
                    <h4>${result.name}</h4>
                    <div class="unicode-code">${result.code}</div>
                </div>
            </div>
            <div class="result-scores">
                <span class="score">Relevance: ${result.relevance_score}/10</span>
                <span class="score">Visual: ${result.visual_match_score}/10</span>
            </div>
            <div class="result-description">${result.analysis}</div>
            <div class="result-actions">
                <button class="copy-btn" data-char="${result.char}" data-index="${index}">문자 복사</button>
            </div>
        </div>
    `).join('');

    // Add event listeners to copy buttons
    const copyButtons = resultsContainer.querySelectorAll('.copy-btn');
    copyButtons.forEach(button => {
        button.addEventListener('click', function() {
            const char = this.getAttribute('data-char');
            copyCharacter(char, this);
        });
    });

    resultsSection.style.display = 'block';
}

// Copy character to clipboard
async function copyCharacter(char, button) {
    try {
        await navigator.clipboard.writeText(char);
        
        // Visual feedback
        const originalText = button.textContent;
        button.textContent = '복사됨!';
        button.classList.add('copied');
        
        setTimeout(() => {
            button.textContent = originalText;
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
            button.textContent = '복사됨!';
            setTimeout(() => {
                button.textContent = '문자 복사';
            }, 2000);
        } catch (err) {
            button.textContent = '복사 실패';
            setTimeout(() => {
                button.textContent = '문자 복사';
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