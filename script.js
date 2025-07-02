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
                'range': t('rangeSearch'),
                'shape': t('shapeSearch'), 
                'function': t('functionSearch'),
                'name': t('nameSearch')
            };
            
            activeCriteria.push({
                type: key,
                title: displayNames[key] || key,
                description: criterion.type ? `${t('type')}: ${criterion.type}` : t('keywordBased'),
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
            <h4>${criterion.title} ${criterion.isPrimary ? `(${t('primary')})` : ''}</h4>
            <p>${criterion.description}</p>
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: ${criterion.confidence * 100}%"></div>
                <span class="confidence-text">${t('confidence')}: ${(criterion.confidence * 100).toFixed(0)}%</span>
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
                    <button class="copy-btn" data-char="${result.char}" data-index="${index}">${t('copy')}</button>
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
        button.textContent = t('copied');
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
            button.textContent = t('copied');
            setTimeout(() => {
                button.textContent = t('copy');
            }, 2000);
        } catch (err) {
            button.textContent = t('copyFailed');
            setTimeout(() => {
                button.textContent = t('copy');
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

// Internationalization (i18n) system
const translations = {
    ko: {
        title: 'Find Unicode with AI',
        subtitle: 'AI를 활용해 원하는 유니코드 문자를 쉽게 찾아보세요',
        searchPlaceholder: '찾고자 하는 문자를 설명해주세요. 예: \'웃는 얼굴 이모지\', \'수학 기호 중 적분\', \'화살표 모양\' 등',
        searchButton: '검색',
        analyzing: '분석 중...',
        analysisResults: '분석 결과',
        foundCharacters: '찾은 유니코드 문자',
        poweredBy: '만든사람: <a href="https://github.com/llaa33219" target="_blank">BLOUplanet</a>',
        copy: '복사',
        copied: '복사됨!',
        copyFailed: '복사 실패',
        confidence: '신뢰도',
        primary: '주요',
        rangeSearch: '범위 검색',
        shapeSearch: '모양 검색',
        functionSearch: '기능 검색',
        nameSearch: '이름 검색',
        keywordBased: '키워드 기반 검색',
        type: '유형',
        noResults: '검색 결과가 없습니다',
        searchFailed: '검색 실패',
        enterQuery: '검색어를 입력해주세요'
    },
    en: {
        title: 'Find Unicode with AI',
        subtitle: 'Easily find the Unicode characters you want using AI',
        searchPlaceholder: 'Describe the character you\'re looking for. e.g. \'smiling face emoji\', \'integral math symbol\', \'arrow shape\', etc.',
        searchButton: 'Search',
        analyzing: 'Analyzing...',
        analysisResults: 'Analysis Results',
        foundCharacters: 'Found Unicode Characters',
        poweredBy: 'Made by <a href="https://github.com/llaa33219" target="_blank">BLOUplanet</a>',
        copy: 'Copy',
        copied: 'Copied!',
        copyFailed: 'Copy failed',
        confidence: 'Confidence',
        primary: 'Primary',
        rangeSearch: 'Range Search',
        shapeSearch: 'Shape Search',
        functionSearch: 'Function Search',
        nameSearch: 'Name Search',
        keywordBased: 'Keyword-based search',
        type: 'Type',
        noResults: 'No search results found',
        searchFailed: 'Search failed',
        enterQuery: 'Please enter a search query'
    },
    ja: {
        title: 'Find Unicode with AI',
        subtitle: 'AIを活用して欲しいUnicode文字を簡単に見つけます',
        searchPlaceholder: '探している文字を説明してください。例：「笑顔の絵文字」、「積分の数学記号」、「矢印の形」など',
        searchButton: '検索',
        analyzing: '分析中...',
        analysisResults: '分析結果',
        foundCharacters: '見つかったUnicode文字',
        poweredBy: '制作者: <a href="https://github.com/llaa33219" target="_blank">BLOUplanet</a>',
        copy: 'コピー',
        copied: 'コピーしました！',
        copyFailed: 'コピー失敗',
        confidence: '信頼度',
        primary: '主要',
        rangeSearch: '範囲検索',
        shapeSearch: '形状検索',
        functionSearch: '機能検索',
        nameSearch: '名前検索',
        keywordBased: 'キーワードベース検索',
        type: 'タイプ',
        noResults: '検索結果が見つかりません',
        searchFailed: '検索に失敗しました',
        enterQuery: '検索クエリを入力してください'
    },
    zh: {
        title: 'Find Unicode with AI',
        subtitle: '使用AI轻松找到您想要的Unicode字符',
        searchPlaceholder: '请描述您要查找的字符。例如："笑脸表情符号"、"积分数学符号"、"箭头形状"等',
        searchButton: '搜索',
        analyzing: '分析中...',
        analysisResults: '分析结果',
        foundCharacters: '找到的Unicode字符',
        poweredBy: '制作者: <a href="https://github.com/llaa33219" target="_blank">BLOUplanet</a>',
        copy: '复制',
        copied: '已复制！',
        copyFailed: '复制失败',
        confidence: '置信度',
        primary: '主要',
        rangeSearch: '范围搜索',
        shapeSearch: '形状搜索',
        functionSearch: '功能搜索',
        nameSearch: '名称搜索',
        keywordBased: '基于关键词的搜索',
        type: '类型',
        noResults: '未找到搜索结果',
        searchFailed: '搜索失败',
        enterQuery: '请输入搜索查询'
    }
};

let currentLanguage = 'ko';

// Dark mode functionality
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle.querySelector('.theme-icon');
const languageSelect = document.getElementById('languageSelect');

// Initialize theme
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

// Internationalization functions
function initializeLanguage() {
    const savedLanguage = localStorage.getItem('language') || 'ko';
    currentLanguage = savedLanguage;
    languageSelect.value = savedLanguage;
    updateTexts();
}

function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    updateTexts();
}

function t(key) {
    return translations[currentLanguage][key] || translations['ko'][key] || key;
}

function updateTexts() {
    // Update elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = t(key);
        
        // Use innerHTML for elements that contain HTML (like links)
        if (translation.includes('<') && translation.includes('>')) {
            element.innerHTML = translation;
        } else {
            element.textContent = translation;
        }
    });
    
    // Update placeholder
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.placeholder = t('searchPlaceholder');
    }
}

// Event listeners for theme and language
themeToggle.addEventListener('click', toggleTheme);
languageSelect.addEventListener('change', (e) => {
    setLanguage(e.target.value);
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeLanguage();
});

// Copy notification
function showCopyNotification() {
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = t('copied');
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Hide and remove notification
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 2000);
}

// Update existing functions to use translations
const originalShowError = showError;
function showError(message) {
    // Try to translate common error messages
    let translatedMessage = message;
    if (message.includes('Please enter a search query')) {
        translatedMessage = t('enterQuery');
    } else if (message.includes('Search failed')) {
        translatedMessage = t('searchFailed');
    }
    originalShowError(translatedMessage);
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