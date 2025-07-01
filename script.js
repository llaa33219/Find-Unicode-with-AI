class UnicodeSearchApp {
    constructor() {
        this.searchBtn = document.getElementById('searchBtn');
        this.searchInput = document.getElementById('searchInput');
        this.progressSection = document.getElementById('progressSection');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.analysisSection = document.getElementById('analysisSection');
        this.criteriaGrid = document.getElementById('criteriaGrid');
        this.resultsSection = document.getElementById('resultsSection');
        this.resultsGrid = document.getElementById('resultsGrid');
        this.errorSection = document.getElementById('errorSection');
        this.errorMessage = document.getElementById('errorMessage');

        this.initEventListeners();
    }

    initEventListeners() {
        this.searchBtn.addEventListener('click', () => this.handleSearch());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.handleSearch();
            }
        });
    }

    async handleSearch() {
        const query = this.searchInput.value.trim();
        
        if (!query) {
            this.showError('검색어를 입력해주세요.');
            return;
        }

        this.setLoading(true);
        this.hideAllSections();

        try {
            await this.performSearch(query);
        } catch (error) {
            console.error('Search error:', error);
            this.showError('검색 중 오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            this.setLoading(false);
        }
    }

    async performSearch(query) {
        // Step 1: 분석 시작
        this.showProgress(10, '사용자 요청 분석 중...');
        
        const analysisResult = await this.analyzeQuery(query);
        this.showAnalysis(analysisResult);
        
        // Step 2: 유니코드 검색
        this.showProgress(40, '유니코드 데이터베이스 검색 중...');
        
        const searchResults = await this.searchUnicode(analysisResult);
        
        // Step 3: AI 필터링
        this.showProgress(70, 'AI를 통한 결과 분석 중...');
        
        const finalResults = await this.filterWithAI(query, searchResults);
        
        // Step 4: 결과 표시
        this.showProgress(100, '결과 준비 완료!');
        
        setTimeout(() => {
            this.hideProgress();
            this.showResults(finalResults);
        }, 500);
    }

    async analyzeQuery(query) {
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

        return await response.json();
    }

    async searchUnicode(analysisResult) {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ analysis: analysisResult })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    async filterWithAI(query, candidates) {
        const response = await fetch('/api/filter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                query,
                candidates 
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    showProgress(percentage, text) {
        this.progressSection.style.display = 'block';
        this.progressSection.classList.add('fade-in');
        this.progressFill.style.width = `${percentage}%`;
        this.progressText.textContent = text;
    }

    hideProgress() {
        this.progressSection.style.display = 'none';
        this.progressSection.classList.remove('fade-in');
    }

    showAnalysis(analysisResult) {
        this.analysisSection.style.display = 'block';
        this.analysisSection.classList.add('fade-in');
        
        this.criteriaGrid.innerHTML = '';
        
        if (analysisResult.criteria) {
            analysisResult.criteria.forEach(criterion => {
                const item = document.createElement('div');
                item.className = 'criteria-item';
                item.innerHTML = `
                    <h4>${criterion.title}</h4>
                    <p>${criterion.description}</p>
                `;
                this.criteriaGrid.appendChild(item);
            });
        }
    }

    showResults(results) {
        this.resultsSection.style.display = 'block';
        this.resultsSection.classList.add('fade-in');
        
        this.resultsGrid.innerHTML = '';
        
        if (results && results.length > 0) {
            results.forEach(result => {
                const item = document.createElement('div');
                item.className = 'result-item';
                item.innerHTML = `
                    <div class="result-header">
                        <div class="result-char">${result.character}</div>
                        <div class="result-info">
                            <h4>${result.name}</h4>
                            <div class="unicode-code">U+${result.codepoint}</div>
                        </div>
                    </div>
                    <div class="result-description">${result.description}</div>
                    <div class="result-actions">
                        <button class="copy-btn" data-char="${result.character}">문자 복사</button>
                        <button class="copy-btn" data-code="U+${result.codepoint}">코드 복사</button>
                    </div>
                `;
                
                // 복사 버튼 이벤트 리스너 추가
                const copyBtns = item.querySelectorAll('.copy-btn');
                copyBtns.forEach(btn => {
                    btn.addEventListener('click', (e) => this.copyToClipboard(e));
                });
                
                this.resultsGrid.appendChild(item);
            });
        } else {
            this.resultsGrid.innerHTML = '<p style="text-align: center; color: #666;">검색 결과가 없습니다.</p>';
        }
    }

    async copyToClipboard(event) {
        const btn = event.target;
        const textToCopy = btn.dataset.char || btn.dataset.code;
        
        try {
            await navigator.clipboard.writeText(textToCopy);
            
            const originalText = btn.textContent;
            btn.textContent = '복사됨!';
            btn.classList.add('copied');
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.classList.remove('copied');
            }, 2000);
            
        } catch (err) {
            console.error('복사 실패:', err);
            // 폴백: 텍스트 선택
            this.selectText(textToCopy);
        }
    }

    selectText(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('폴백 복사도 실패:', err);
        }
        document.body.removeChild(textArea);
    }

    showError(message) {
        this.hideAllSections();
        this.errorSection.style.display = 'block';
        this.errorSection.classList.add('fade-in');
        this.errorMessage.textContent = message;
    }

    hideAllSections() {
        this.progressSection.style.display = 'none';
        this.analysisSection.style.display = 'none';
        this.resultsSection.style.display = 'none';
        this.errorSection.style.display = 'none';
        
        // fade-in 클래스 제거
        [this.progressSection, this.analysisSection, this.resultsSection, this.errorSection].forEach(section => {
            section.classList.remove('fade-in');
        });
    }

    setLoading(loading) {
        const btnText = this.searchBtn.querySelector('.btn-text');
        const spinner = this.searchBtn.querySelector('.loading-spinner');
        
        if (loading) {
            this.searchBtn.disabled = true;
            btnText.style.display = 'none';
            spinner.style.display = 'block';
        } else {
            this.searchBtn.disabled = false;
            btnText.style.display = 'block';
            spinner.style.display = 'none';
        }
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    new UnicodeSearchApp();
});

// 전역 에러 핸들러
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault();
}); 