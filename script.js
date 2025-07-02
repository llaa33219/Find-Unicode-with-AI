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
const themeToggleBtn = document.getElementById('themeToggle');
const themeIcon = themeToggleBtn.querySelector('.theme-icon');

// Theme functionality
let currentTheme = localStorage.getItem('theme') || 'light';

function initTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon();
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    updateThemeIcon();
    
    // Add bounce animation to the button
    themeToggleBtn.style.animation = 'none';
    setTimeout(() => {
        themeToggleBtn.style.animation = '';
    }, 10);
}

function updateThemeIcon() {
    themeIcon.textContent = currentTheme === 'light' ? '🌙' : '☀️';
}

// Add floating animation to particles
function animateParticles() {
    const particles = document.querySelectorAll('.particle');
    particles.forEach((particle, index) => {
        const delay = index * 2000;
        particle.style.animationDelay = `${delay}ms`;
    });
}

// Event listeners
searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSearch();
    }
});
themeToggleBtn.addEventListener('click', toggleTheme);

// Initialize theme and animations
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    animateParticles();
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
        
        // Step 2: Search by criteria + AI recommendations
        const searchResults = await searchUnicode(analysisResult, query);
        
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
async function searchUnicode(criteria, query) {
    try {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                criteria: criteria.criteria || criteria,
                query: query  // Pass original query for AI recommendations
            })
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
            body: JSON.stringify({ 
                candidates: candidates,
                query: query,
                criteria: criteria
            })
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
    const criteria = analysis.criteria || {};
    const primaryCriterion = analysis.primary_criterion;
    
    // Check each criteria type with new structure
    Object.entries(criteria).forEach(([key, criterion]) => {
        if (criterion.confidence > 0.3) {  // Only show criteria with decent confidence
            const displayNames = {
                'range': '범위 검색',
                'shape': '모양 검색', 
                'function': '기능 검색',
                'name': '이름 검색'
            };
            
            activeCriteria.push({
                type: key,
                title: displayNames[key] || key,
                description: criterion.type ? `유형: ${criterion.type}` : '키워드 기반 검색',
                keywords: criterion.keywords || [],
                confidence: criterion.confidence,
                isPrimary: key === primaryCriterion
            });
        }
    });

    // Sort by confidence (primary first, then by confidence)
    activeCriteria.sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return b.confidence - a.confidence;
    });

    analysisResults.innerHTML = activeCriteria.map(criterion => `
        <div class="criteria-item ${criterion.isPrimary ? 'primary' : ''}">
            <h4>${criterion.title} ${criterion.isPrimary ? '(주요)' : ''}</h4>
            <p>${criterion.description}</p>
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: ${criterion.confidence * 100}%"></div>
                <span class="confidence-text">신뢰도: ${(criterion.confidence * 100).toFixed(0)}%</span>
            </div>
            ${criterion.keywords.length > 0 ? `
                <div class="keywords">
                    ${criterion.keywords.map(keyword => 
                        `<span class="keyword">${keyword}</span>`
                    ).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');

    analysisSection.style.display = 'block';
}

// Display final results
function displayResults(results) {
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<p class="no-results">검색 결과가 없습니다. 다른 검색어로 시도해보세요.</p>';
        resultsSection.style.display = 'block';
        return;
    }

    resultsContainer.innerHTML = results.map((result, index) => {
        // Handle both old and new result formats
        const score = result.score || (result.relevance_score + result.visual_match_score) / 20 || 0;
        const reason = result.reason || result.analysis || 'No description available';
        
        return `
            <div class="result-item">
                <div class="result-header">
                    <div class="result-rank">${index + 1}</div>
                    <div class="result-char">${result.char}</div>
                    <div class="result-info">
                        <h4>${result.name}</h4>
                        <div class="unicode-code">${result.code}</div>
                    </div>
                </div>
                <div class="result-scores">
                    <div class="score-bar">
                        <div class="score-fill" style="width: ${score * 100}%"></div>
                        <span class="score-text">점수: ${(score * 10).toFixed(1)}/10</span>
                    </div>
                    ${result.match_types ? `
                        <div class="match-types">매치 유형: ${result.match_types.join(', ')}</div>
                    ` : ''}
                </div>
                <div class="result-description">${reason}</div>
                ${result.visual_features ? `
                    <div class="visual-features"><strong>시각적 특징:</strong> ${result.visual_features}</div>
                ` : ''}
                <div class="result-actions">
                    <button class="copy-btn" data-char="${result.char}" data-index="${index}">문자 복사</button>
                </div>
            </div>
        `;
    }).join('');

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