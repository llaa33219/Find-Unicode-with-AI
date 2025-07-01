// 분석 결과를 바탕으로 유니코드 문자를 검색하는 API
export async function onRequestPost(context) {
    try {
        const { request } = context;
        const { analysis } = await request.json();

        if (!analysis || !analysis.criteria || !Array.isArray(analysis.criteria)) {
            return new Response(JSON.stringify({
                error: '유효한 분석 결과가 필요합니다.'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        let allCandidates = [];

        // 각 기준에 따라 검색 수행
        for (const criterion of analysis.criteria) {
            const candidates = await searchByCriterion(criterion);
            allCandidates = allCandidates.concat(candidates);
        }

        // 중복 제거 (유니코드 포인트 기준)
        const uniqueCandidates = removeDuplicates(allCandidates);
        
        // 최대 50개로 제한
        const limitedCandidates = uniqueCandidates.slice(0, 50);

        return new Response(JSON.stringify({
            candidates: limitedCandidates,
            total: uniqueCandidates.length
        }), {
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });

    } catch (error) {
        console.error('검색 API 오류:', error);
        
        return new Response(JSON.stringify({
            error: '검색 중 오류가 발생했습니다.',
            details: error.message
        }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

// CORS 처리를 위한 OPTIONS 핸들러
export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

// 기준에 따른 검색 함수
async function searchByCriterion(criterion) {
    const { type, keywords } = criterion;
    let candidates = [];

    switch (type) {
        case '범위':
            candidates = searchByRange(keywords);
            break;
        case '모양':
            candidates = searchByShape(keywords);
            break;
        case '기능':
            candidates = searchByFunction(keywords);
            break;
        case '이름':
            candidates = searchByName(keywords);
            break;
        default:
            // 기본적으로 이름으로 검색
            candidates = searchByName(keywords);
    }

    return candidates;
}

// 범위별 검색 (유니코드 블록 기반)
function searchByRange(keywords) {
    const candidates = [];
    
    for (const keyword of keywords) {
        const lowerKeyword = keyword.toLowerCase();
        
        // 이모지 관련
        if (lowerKeyword.includes('emoji') || lowerKeyword.includes('이모지') || 
            lowerKeyword.includes('emoticon') || lowerKeyword.includes('face') || 
            lowerKeyword.includes('얼굴') || lowerKeyword.includes('표정')) {
            
            // 주요 이모지 범위
            candidates.push(...getEmojiCharacters());
        }
        
        // 수학 기호
        if (lowerKeyword.includes('math') || lowerKeyword.includes('수학') ||
            lowerKeyword.includes('mathematical') || lowerKeyword.includes('기호')) {
            candidates.push(...getMathematicalCharacters());
        }
        
        // 화살표
        if (lowerKeyword.includes('arrow') || lowerKeyword.includes('화살표')) {
            candidates.push(...getArrowCharacters());
        }
        
        // 기하학적 모양
        if (lowerKeyword.includes('geometric') || lowerKeyword.includes('기하') ||
            lowerKeyword.includes('shape') || lowerKeyword.includes('모양')) {
            candidates.push(...getGeometricCharacters());
        }
    }
    
    return candidates;
}

// 모양별 검색
function searchByShape(keywords) {
    const candidates = [];
    
    for (const keyword of keywords) {
        const lowerKeyword = keyword.toLowerCase();
        
        if (lowerKeyword.includes('circle') || lowerKeyword.includes('둥근') || 
            lowerKeyword.includes('원')) {
            candidates.push(...getCircleShapes());
        }
        
        if (lowerKeyword.includes('square') || lowerKeyword.includes('사각') ||
            lowerKeyword.includes('box') || lowerKeyword.includes('네모')) {
            candidates.push(...getSquareShapes());
        }
        
        if (lowerKeyword.includes('triangle') || lowerKeyword.includes('삼각') ||
            lowerKeyword.includes('세모')) {
            candidates.push(...getTriangleShapes());
        }
        
        if (lowerKeyword.includes('star') || lowerKeyword.includes('별')) {
            candidates.push(...getStarShapes());
        }
    }
    
    return candidates;
}

// 기능별 검색
function searchByFunction(keywords) {
    const candidates = [];
    
    for (const keyword of keywords) {
        const lowerKeyword = keyword.toLowerCase();
        
        if (lowerKeyword.includes('punctuation') || lowerKeyword.includes('구분') ||
            lowerKeyword.includes('separator') || lowerKeyword.includes('구두점')) {
            candidates.push(...getPunctuationCharacters());
        }
        
        if (lowerKeyword.includes('currency') || lowerKeyword.includes('통화') ||
            lowerKeyword.includes('money') || lowerKeyword.includes('돈')) {
            candidates.push(...getCurrencyCharacters());
        }
    }
    
    return candidates;
}

// 이름별 검색
function searchByName(keywords) {
    const candidates = [];
    
    for (const keyword of keywords) {
        const lowerKeyword = keyword.toLowerCase();
        
        // 미리 정의된 문자들에서 이름 매칭
        candidates.push(...searchByNamePattern(lowerKeyword));
    }
    
    return candidates;
}

// 중복 제거 함수
function removeDuplicates(candidates) {
    const seen = new Set();
    return candidates.filter(candidate => {
        if (seen.has(candidate.codepoint)) {
            return false;
        }
        seen.add(candidate.codepoint);
        return true;
    });
}

// 이모지 문자들 반환
function getEmojiCharacters() {
    return [
        { character: '😀', name: 'Grinning Face', codepoint: '1F600', description: '활짝 웃는 얼굴' },
        { character: '😃', name: 'Grinning Face with Big Eyes', codepoint: '1F603', description: '큰 눈으로 웃는 얼굴' },
        { character: '😄', name: 'Grinning Face with Smiling Eyes', codepoint: '1F604', description: '눈웃음치는 얼굴' },
        { character: '😁', name: 'Beaming Face with Smiling Eyes', codepoint: '1F601', description: '환하게 웃는 얼굴' },
        { character: '😆', name: 'Grinning Squinting Face', codepoint: '1F606', description: '눈을 찡긋하며 웃는 얼굴' },
        { character: '😅', name: 'Grinning Face with Sweat', codepoint: '1F605', description: '식은땀 흘리며 웃는 얼굴' },
        { character: '🤣', name: 'Rolling on the Floor Laughing', codepoint: '1F923', description: '바닥에 굴러다니며 웃는 얼굴' },
        { character: '😂', name: 'Face with Tears of Joy', codepoint: '1F602', description: '기쁨의 눈물을 흘리는 얼굴' },
        { character: '🙂', name: 'Slightly Smiling Face', codepoint: '1F642', description: '살짝 웃는 얼굴' },
        { character: '😉', name: 'Winking Face', codepoint: '1F609', description: '윙크하는 얼굴' },
        { character: '😊', name: 'Smiling Face with Smiling Eyes', codepoint: '1F60A', description: '눈웃음 치는 얼굴' },
        { character: '😇', name: 'Smiling Face with Halo', codepoint: '1F607', description: '천사 얼굴' },
        { character: '❤️', name: 'Red Heart', codepoint: '2764', description: '빨간 하트' },
        { character: '💙', name: 'Blue Heart', codepoint: '1F499', description: '파란 하트' },
        { character: '💚', name: 'Green Heart', codepoint: '1F49A', description: '초록 하트' },
        { character: '💛', name: 'Yellow Heart', codepoint: '1F49B', description: '노란 하트' },
        { character: '🧡', name: 'Orange Heart', codepoint: '1F9E1', description: '주황 하트' },
        { character: '💜', name: 'Purple Heart', codepoint: '1F49C', description: '보라 하트' },
        { character: '🖤', name: 'Black Heart', codepoint: '1F5A4', description: '검은 하트' },
        { character: '🤍', name: 'White Heart', codepoint: '1F90D', description: '흰 하트' }
    ];
}

// 수학 기호들 반환
function getMathematicalCharacters() {
    return [
        { character: '+', name: 'Plus Sign', codepoint: '002B', description: '더하기 기호' },
        { character: '−', name: 'Minus Sign', codepoint: '2212', description: '빼기 기호' },
        { character: '×', name: 'Multiplication Sign', codepoint: '00D7', description: '곱하기 기호' },
        { character: '÷', name: 'Division Sign', codepoint: '00F7', description: '나누기 기호' },
        { character: '=', name: 'Equals Sign', codepoint: '003D', description: '등호' },
        { character: '≠', name: 'Not Equal To', codepoint: '2260', description: '부등호' },
        { character: '≤', name: 'Less-Than or Equal To', codepoint: '2264', description: '작거나 같음' },
        { character: '≥', name: 'Greater-Than or Equal To', codepoint: '2265', description: '크거나 같음' },
        { character: '∑', name: 'N-Ary Summation', codepoint: '2211', description: '합 기호' },
        { character: '∏', name: 'N-Ary Product', codepoint: '220F', description: '곱 기호' },
        { character: '∫', name: 'Integral', codepoint: '222B', description: '적분 기호' },
        { character: '∂', name: 'Partial Differential', codepoint: '2202', description: '편미분 기호' },
        { character: '∞', name: 'Infinity', codepoint: '221E', description: '무한대 기호' },
        { character: 'π', name: 'Greek Small Letter Pi', codepoint: '03C0', description: '파이' },
        { character: '°', name: 'Degree Sign', codepoint: '00B0', description: '도 기호' }
    ];
}

// 화살표 문자들 반환
function getArrowCharacters() {
    return [
        { character: '→', name: 'Rightwards Arrow', codepoint: '2192', description: '오른쪽 화살표' },
        { character: '←', name: 'Leftwards Arrow', codepoint: '2190', description: '왼쪽 화살표' },
        { character: '↑', name: 'Upwards Arrow', codepoint: '2191', description: '위쪽 화살표' },
        { character: '↓', name: 'Downwards Arrow', codepoint: '2193', description: '아래쪽 화살표' },
        { character: '↗', name: 'North East Arrow', codepoint: '2197', description: '북동쪽 화살표' },
        { character: '↖', name: 'North West Arrow', codepoint: '2196', description: '북서쪽 화살표' },
        { character: '↘', name: 'South East Arrow', codepoint: '2198', description: '남동쪽 화살표' },
        { character: '↙', name: 'South West Arrow', codepoint: '2199', description: '남서쪽 화살표' },
        { character: '⇒', name: 'Rightwards Double Arrow', codepoint: '21D2', description: '오른쪽 이중 화살표' },
        { character: '⇐', name: 'Leftwards Double Arrow', codepoint: '21D0', description: '왼쪽 이중 화살표' },
        { character: '⇑', name: 'Upwards Double Arrow', codepoint: '21D1', description: '위쪽 이중 화살표' },
        { character: '⇓', name: 'Downwards Double Arrow', codepoint: '21D3', description: '아래쪽 이중 화살표' }
    ];
}

// 기하학적 모양들 반환
function getGeometricCharacters() {
    return [
        { character: '●', name: 'Black Circle', codepoint: '25CF', description: '검은 원' },
        { character: '○', name: 'White Circle', codepoint: '25CB', description: '흰 원' },
        { character: '■', name: 'Black Large Square', codepoint: '25A0', description: '검은 사각형' },
        { character: '□', name: 'White Large Square', codepoint: '25A1', description: '흰 사각형' },
        { character: '▲', name: 'Black Up-Pointing Triangle', codepoint: '25B2', description: '검은 위쪽 삼각형' },
        { character: '△', name: 'White Up-Pointing Triangle', codepoint: '25B3', description: '흰 위쪽 삼각형' },
        { character: '▼', name: 'Black Down-Pointing Triangle', codepoint: '25BC', description: '검은 아래쪽 삼각형' },
        { character: '▽', name: 'White Down-Pointing Triangle', codepoint: '25BD', description: '흰 아래쪽 삼각형' },
        { character: '◆', name: 'Black Diamond', codepoint: '25C6', description: '검은 다이아몬드' },
        { character: '◇', name: 'White Diamond', codepoint: '25C7', description: '흰 다이아몬드' }
    ];
}

// 원형 모양들 반환
function getCircleShapes() {
    return [
        { character: '●', name: 'Black Circle', codepoint: '25CF', description: '검은 원' },
        { character: '○', name: 'White Circle', codepoint: '25CB', description: '흰 원' },
        { character: '◉', name: 'Fisheye', codepoint: '25C9', description: '피시아이' },
        { character: '◎', name: 'Bullseye', codepoint: '25CE', description: '불스아이' }
    ];
}

// 사각형 모양들 반환
function getSquareShapes() {
    return [
        { character: '■', name: 'Black Large Square', codepoint: '25A0', description: '검은 사각형' },
        { character: '□', name: 'White Large Square', codepoint: '25A1', description: '흰 사각형' },
        { character: '▪', name: 'Black Small Square', codepoint: '25AA', description: '검은 작은 사각형' },
        { character: '▫', name: 'White Small Square', codepoint: '25AB', description: '흰 작은 사각형' }
    ];
}

// 삼각형 모양들 반환
function getTriangleShapes() {
    return [
        { character: '▲', name: 'Black Up-Pointing Triangle', codepoint: '25B2', description: '검은 위쪽 삼각형' },
        { character: '△', name: 'White Up-Pointing Triangle', codepoint: '25B3', description: '흰 위쪽 삼각형' },
        { character: '▼', name: 'Black Down-Pointing Triangle', codepoint: '25BC', description: '검은 아래쪽 삼각형' },
        { character: '▽', name: 'White Down-Pointing Triangle', codepoint: '25BD', description: '흰 아래쪽 삼각형' }
    ];
}

// 별 모양들 반환
function getStarShapes() {
    return [
        { character: '★', name: 'Black Star', codepoint: '2605', description: '검은 별' },
        { character: '☆', name: 'White Star', codepoint: '2606', description: '흰 별' },
        { character: '✦', name: 'Black Four Pointed Star', codepoint: '2726', description: '검은 네모 별' },
        { character: '✧', name: 'White Four Pointed Star', codepoint: '2727', description: '흰 네모 별' }
    ];
}

// 구두점 문자들 반환
function getPunctuationCharacters() {
    return [
        { character: '!', name: 'Exclamation Mark', codepoint: '0021', description: '느낌표' },
        { character: '?', name: 'Question Mark', codepoint: '003F', description: '물음표' },
        { character: '.', name: 'Full Stop', codepoint: '002E', description: '마침표' },
        { character: ',', name: 'Comma', codepoint: '002C', description: '쉼표' },
        { character: ';', name: 'Semicolon', codepoint: '003B', description: '세미콜론' },
        { character: ':', name: 'Colon', codepoint: '003A', description: '콜론' }
    ];
}

// 통화 기호들 반환
function getCurrencyCharacters() {
    return [
        { character: '$', name: 'Dollar Sign', codepoint: '0024', description: '달러 기호' },
        { character: '€', name: 'Euro Sign', codepoint: '20AC', description: '유로 기호' },
        { character: '£', name: 'Pound Sign', codepoint: '00A3', description: '파운드 기호' },
        { character: '¥', name: 'Yen Sign', codepoint: '00A5', description: '엔 기호' },
        { character: '₩', name: 'Won Sign', codepoint: '20A9', description: '원 기호' }
    ];
}

// 이름 패턴으로 검색
function searchByNamePattern(keyword) {
    const allCharacters = [
        ...getEmojiCharacters(),
        ...getMathematicalCharacters(),
        ...getArrowCharacters(),
        ...getGeometricCharacters()
    ];
    
    return allCharacters.filter(char => 
        char.name.toLowerCase().includes(keyword) ||
        char.description.toLowerCase().includes(keyword)
    );
} 