// Search for Unicode characters based on analysis results + AI recommendations
export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const body = await request.json();
        
        console.log('Search API received:', body);
        
        const { criteria, query } = body;

        if (!criteria || typeof criteria !== 'object') {
            console.error('Invalid criteria:', criteria);
            return new Response(JSON.stringify({
                error: 'Valid search criteria is required'
            }), {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                }
            });
        }

        let searchCandidates = [];

        // Step 1: Search by each criterion from analysis
        if (criteria.range && criteria.range.type) {
            console.log('Searching by range:', criteria.range);
            const candidates = searchByRange(criteria.range);
            searchCandidates = searchCandidates.concat(candidates);
        }

        if (criteria.shape && criteria.shape.type) {
            console.log('Searching by shape:', criteria.shape);
            const candidates = searchByShape(criteria.shape);
            searchCandidates = searchCandidates.concat(candidates);
        }

        if (criteria.function && criteria.function.type) {
            console.log('Searching by function:', criteria.function);
            const candidates = searchByFunction(criteria.function);
            searchCandidates = searchCandidates.concat(candidates);
        }

        if (criteria.name && criteria.name.keywords && criteria.name.keywords.length > 0) {
            console.log('Searching by name:', criteria.name);
            const candidates = searchByName(criteria.name);
            searchCandidates = searchCandidates.concat(candidates);
        }

        console.log('Search results count:', searchCandidates.length);

        // Step 2: Get AI recommendations (always, regardless of search results)
        console.log('Getting AI recommendations...');
        const aiRecommendations = await getAIRecommendations(query, env);
        
        console.log('AI recommendations count:', aiRecommendations.length);

        // Step 3: Combine search results + AI recommendations
        const allCandidates = [...searchCandidates, ...aiRecommendations];

        // Step 4: Remove duplicates (based on Unicode code point)
        const uniqueCandidates = removeDuplicates(allCandidates);
        
        // Step 5: Limit to maximum 50 results for filtering
        const limitedCandidates = uniqueCandidates.slice(0, 50);
        
        console.log('Final candidates:', { 
            search: searchCandidates.length,
            ai: aiRecommendations.length,
            total: uniqueCandidates.length, 
            limited: limitedCandidates.length,
            first3: limitedCandidates.slice(0, 3)
        });

        return new Response(JSON.stringify({
            results: limitedCandidates,
            total: uniqueCandidates.length,
            breakdown: {
                search_results: searchCandidates.length,
                ai_recommendations: aiRecommendations.length,
                after_dedup: uniqueCandidates.length
            }
        }), {
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        });

    } catch (error) {
        console.error('Search error:', error);
        
        return new Response(JSON.stringify({
            error: 'Search error occurred',
            details: error.message
        }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        });
    }
}

// Get AI recommendations based on the original query
async function getAIRecommendations(query, env) {
    try {
        const response = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.DASHSCOPE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: "qwen-turbo-latest",
                messages: [
                    {
                        role: "system",
                        content: `You are a Unicode character expert. Given a user query, recommend Unicode characters that match the description.

Return EXACTLY this JSON structure:
{
  "recommendations": [
    {
      "char": "character",
      "code": "U+XXXX", 
      "name": "UNICODE CHARACTER NAME",
      "reason": "why this character matches the query"
    }
  ]
}

Guidelines:
- Recommend 10-20 characters that best match the query
- Include both obvious and creative matches
- Use proper Unicode format (U+XXXX)
- Provide clear reasoning for each recommendation
- Focus on characters that truly match the description

Respond with ONLY the JSON, no additional text.`
                    },
                    {
                        role: "user",
                        content: `Find Unicode characters that match this description: "${query}"`
                    }
                ],
                temperature: 0.4,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            console.error('AI recommendation API error:', response.status);
            return [];
        }

        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        const result = JSON.parse(content);
        
        return result.recommendations || [];
        
    } catch (error) {
        console.error('AI recommendation error:', error);
        return [];
    }
}

// CORS handler for OPTIONS requests
export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    });
}

// Search by range (Unicode blocks)
function searchByRange(rangeObj) {
    const { type, keywords } = rangeObj;
    const candidates = [];
    
    switch (type) {
        case 'emoji':
            candidates.push(...getEmojiCharacters());
            break;
        case 'math':
            candidates.push(...getMathematicalCharacters());
            break;
        case 'arrows':
            candidates.push(...getArrowCharacters());
            break;
        case 'geometric':
            candidates.push(...getGeometricCharacters());
            break;
        case 'punctuation':
            candidates.push(...getPunctuationCharacters());
            break;
        case 'currency':
            candidates.push(...getCurrencyCharacters());
            break;
        default:
            // Fallback: search by keywords
            for (const keyword of keywords || []) {
                candidates.push(...searchByNamePattern(keyword));
            }
    }
    
    return candidates;
}

// Search by shape
function searchByShape(shapeObj) {
    const { type, keywords } = shapeObj;
    const candidates = [];
    
    switch (type) {
        case 'circle':
            candidates.push(...getCircleShapes());
            break;
        case 'square':
            candidates.push(...getSquareShapes());
            break;
        case 'triangle':
            candidates.push(...getTriangleShapes());
            break;
        case 'star':
            candidates.push(...getStarShapes());
            break;
        case 'heart':
            candidates.push(...getHeartShapes());
            break;
        case 'diamond':
            candidates.push(...getDiamondShapes());
            break;
        case 'arrow':
            candidates.push(...getArrowCharacters());
            break;
        default:
            // Fallback: search by keywords
            for (const keyword of keywords || []) {
                candidates.push(...searchByNamePattern(keyword));
            }
    }
    
    return candidates;
}

// Search by function
function searchByFunction(functionObj) {
    const { type, keywords } = functionObj;
    const candidates = [];
    
    switch (type) {
        case 'separator':
        case 'punctuation':
            candidates.push(...getPunctuationCharacters());
            break;
        case 'currency':
            candidates.push(...getCurrencyCharacters());
            break;
        case 'math_operator':
            candidates.push(...getMathematicalCharacters());
            break;
        case 'emphasis':
            candidates.push(...getEmphasisCharacters());
            break;
        default:
            // Fallback: search by keywords
            for (const keyword of keywords || []) {
                candidates.push(...searchByNamePattern(keyword));
            }
    }
    
    return candidates;
}

// Search by name patterns
function searchByName(nameObj) {
    const { keywords } = nameObj;
    const candidates = [];
    
    for (const keyword of keywords || []) {
        candidates.push(...searchByNamePattern(keyword));
    }
    
    return candidates;
}

// Remove duplicate characters
function removeDuplicates(candidates) {
    const seen = new Set();
    return candidates.filter(candidate => {
        if (seen.has(candidate.code)) {
            return false;
        }
        seen.add(candidate.code);
        return true;
    });
}

// Get emoji characters
function getEmojiCharacters() {
    return [
        { char: '😀', code: 'U+1F600', name: 'GRINNING FACE' },
        { char: '😃', code: 'U+1F603', name: 'GRINNING FACE WITH BIG EYES' },
        { char: '😄', code: 'U+1F604', name: 'GRINNING FACE WITH SMILING EYES' },
        { char: '😁', code: 'U+1F601', name: 'BEAMING FACE WITH SMILING EYES' },
        { char: '😆', code: 'U+1F606', name: 'GRINNING SQUINTING FACE' },
        { char: '😅', code: 'U+1F605', name: 'GRINNING FACE WITH SWEAT' },
        { char: '🤣', code: 'U+1F923', name: 'ROLLING ON THE FLOOR LAUGHING' },
        { char: '😂', code: 'U+1F602', name: 'FACE WITH TEARS OF JOY' },
        { char: '🙂', code: 'U+1F642', name: 'SLIGHTLY SMILING FACE' },
        { char: '🙃', code: 'U+1F643', name: 'UPSIDE-DOWN FACE' },
        { char: '😉', code: 'U+1F609', name: 'WINKING FACE' },
        { char: '😊', code: 'U+1F60A', name: 'SMILING FACE WITH SMILING EYES' },
        { char: '😇', code: 'U+1F607', name: 'SMILING FACE WITH HALO' },
        { char: '❤️', code: 'U+2764', name: 'RED HEART' },
        { char: '💛', code: 'U+1F49B', name: 'YELLOW HEART' },
        { char: '💚', code: 'U+1F49A', name: 'GREEN HEART' },
        { char: '💙', code: 'U+1F499', name: 'BLUE HEART' },
        { char: '💜', code: 'U+1F49C', name: 'PURPLE HEART' },
        { char: '��', code: 'U+1F90D', name: 'WHITE HEART' },
        { char: '🖤', code: 'U+1F5A4', name: 'BLACK HEART' },
        { char: '🤎', code: 'U+1F90E', name: 'BROWN HEART' },
        { char: '💕', code: 'U+1F495', name: 'TWO HEARTS' },
        { char: '💖', code: 'U+1F496', name: 'SPARKLING HEART' },
        { char: '✅', code: 'U+2705', name: 'CHECK MARK BUTTON' },
        { char: '❌', code: 'U+274C', name: 'CROSS MARK' }
    ];
}

// Get mathematical characters
function getMathematicalCharacters() {
    return [
        { char: '+', code: 'U+002B', name: 'PLUS SIGN' },
        { char: '−', code: 'U+2212', name: 'MINUS SIGN' },
        { char: '×', code: 'U+00D7', name: 'MULTIPLICATION SIGN' },
        { char: '÷', code: 'U+00F7', name: 'DIVISION SIGN' },
        { char: '=', code: 'U+003D', name: 'EQUALS SIGN' },
        { char: '≠', code: 'U+2260', name: 'NOT EQUAL TO' },
        { char: '≈', code: 'U+2248', name: 'ALMOST EQUAL TO' },
        { char: '≤', code: 'U+2264', name: 'LESS-THAN OR EQUAL TO' },
        { char: '≥', code: 'U+2265', name: 'GREATER-THAN OR EQUAL TO' },
        { char: '∞', code: 'U+221E', name: 'INFINITY' },
        { char: '∫', code: 'U+222B', name: 'INTEGRAL' },
        { char: '∑', code: 'U+2211', name: 'N-ARY SUMMATION' },
        { char: '∏', code: 'U+220F', name: 'N-ARY PRODUCT' },
        { char: '√', code: 'U+221A', name: 'SQUARE ROOT' },
        { char: 'π', code: 'U+03C0', name: 'GREEK SMALL LETTER PI' },
        { char: '∆', code: 'U+2206', name: 'INCREMENT' },
        { char: '∇', code: 'U+2207', name: 'NABLA' },
        { char: '∈', code: 'U+2208', name: 'ELEMENT OF' },
        { char: '∉', code: 'U+2209', name: 'NOT AN ELEMENT OF' },
        { char: '∪', code: 'U+222A', name: 'UNION' },
        { char: '∩', code: 'U+2229', name: 'INTERSECTION' }
    ];
}

// Get arrow characters
function getArrowCharacters() {
    return [
        { char: '↑', code: 'U+2191', name: 'UPWARDS ARROW' },
        { char: '↓', code: 'U+2193', name: 'DOWNWARDS ARROW' },
        { char: '←', code: 'U+2190', name: 'LEFTWARDS ARROW' },
        { char: '→', code: 'U+2192', name: 'RIGHTWARDS ARROW' },
        { char: '↔', code: 'U+2194', name: 'LEFT RIGHT ARROW' },
        { char: '↕', code: 'U+2195', name: 'UP DOWN ARROW' },
        { char: '↖', code: 'U+2196', name: 'NORTH WEST ARROW' },
        { char: '↗', code: 'U+2197', name: 'NORTH EAST ARROW' },
        { char: '↘', code: 'U+2198', name: 'SOUTH EAST ARROW' },
        { char: '↙', code: 'U+2199', name: 'SOUTH WEST ARROW' },
        { char: '⇑', code: 'U+21D1', name: 'UPWARDS DOUBLE ARROW' },
        { char: '⇓', code: 'U+21D3', name: 'DOWNWARDS DOUBLE ARROW' },
        { char: '⇐', code: 'U+21D0', name: 'LEFTWARDS DOUBLE ARROW' },
        { char: '⇒', code: 'U+21D2', name: 'RIGHTWARDS DOUBLE ARROW' },
        { char: '⇔', code: 'U+21D4', name: 'LEFT RIGHT DOUBLE ARROW' },
        { char: '▲', code: 'U+25B2', name: 'BLACK UP-POINTING TRIANGLE' },
        { char: '▼', code: 'U+25BC', name: 'BLACK DOWN-POINTING TRIANGLE' },
        { char: '◀', code: 'U+25C0', name: 'BLACK LEFT-POINTING TRIANGLE' },
        { char: '▶', code: 'U+25B6', name: 'BLACK RIGHT-POINTING TRIANGLE' }
    ];
}

// Get geometric characters
function getGeometricCharacters() {
    return [
        { char: '●', code: 'U+25CF', name: 'BLACK CIRCLE' },
        { char: '○', code: 'U+25CB', name: 'WHITE CIRCLE' },
        { char: '◉', code: 'U+25C9', name: 'FISHEYE' },
        { char: '◎', code: 'U+25CE', name: 'BULLSEYE' },
        { char: '■', code: 'U+25A0', name: 'BLACK SQUARE' },
        { char: '□', code: 'U+25A1', name: 'WHITE SQUARE' },
        { char: '▪', code: 'U+25AA', name: 'BLACK SMALL SQUARE' },
        { char: '▫', code: 'U+25AB', name: 'WHITE SMALL SQUARE' },
        { char: '▲', code: 'U+25B2', name: 'BLACK UP-POINTING TRIANGLE' },
        { char: '△', code: 'U+25B3', name: 'WHITE UP-POINTING TRIANGLE' },
        { char: '▼', code: 'U+25BC', name: 'BLACK DOWN-POINTING TRIANGLE' },
        { char: '▽', code: 'U+25BD', name: 'WHITE DOWN-POINTING TRIANGLE' },
        { char: '◆', code: 'U+25C6', name: 'BLACK DIAMOND' },
        { char: '◇', code: 'U+25C7', name: 'WHITE DIAMOND' },
        { char: '★', code: 'U+2605', name: 'BLACK STAR' },
        { char: '☆', code: 'U+2606', name: 'WHITE STAR' }
    ];
}

// Get circle shapes
function getCircleShapes() {
    return [
        { char: '●', code: 'U+25CF', name: 'BLACK CIRCLE' },
        { char: '○', code: 'U+25CB', name: 'WHITE CIRCLE' },
        { char: '◉', code: 'U+25C9', name: 'FISHEYE' },
        { char: '◎', code: 'U+25CE', name: 'BULLSEYE' },
        { char: '⚫', code: 'U+26AB', name: 'MEDIUM BLACK CIRCLE' },
        { char: '⚪', code: 'U+26AA', name: 'MEDIUM WHITE CIRCLE' },
        { char: '🔴', code: 'U+1F534', name: 'RED CIRCLE' },
        { char: '🟠', code: 'U+1F7E0', name: 'ORANGE CIRCLE' },
        { char: '🟡', code: 'U+1F7E1', name: 'YELLOW CIRCLE' },
        { char: '🟢', code: 'U+1F7E2', name: 'GREEN CIRCLE' },
        { char: '🔵', code: 'U+1F535', name: 'BLUE CIRCLE' },
        { char: '🟣', code: 'U+1F7E3', name: 'PURPLE CIRCLE' }
    ];
}

// Get square shapes
function getSquareShapes() {
    return [
        { char: '■', code: 'U+25A0', name: 'BLACK SQUARE' },
        { char: '□', code: 'U+25A1', name: 'WHITE SQUARE' },
        { char: '▪', code: 'U+25AA', name: 'BLACK SMALL SQUARE' },
        { char: '▫', code: 'U+25AB', name: 'WHITE SMALL SQUARE' },
        { char: '◼', code: 'U+25FC', name: 'BLACK MEDIUM SQUARE' },
        { char: '◻', code: 'U+25FB', name: 'WHITE MEDIUM SQUARE' },
        { char: '⬛', code: 'U+2B1B', name: 'BLACK LARGE SQUARE' },
        { char: '⬜', code: 'U+2B1C', name: 'WHITE LARGE SQUARE' },
        { char: '🟥', code: 'U+1F7E5', name: 'RED SQUARE' },
        { char: '🟧', code: 'U+1F7E7', name: 'ORANGE SQUARE' },
        { char: '🟨', code: 'U+1F7E8', name: 'YELLOW SQUARE' },
        { char: '🟩', code: 'U+1F7E9', name: 'GREEN SQUARE' },
        { char: '🟦', code: 'U+1F7EA', name: 'BLUE SQUARE' },
        { char: '🟪', code: 'U+1F7EB', name: 'PURPLE SQUARE' }
    ];
}

// Get triangle shapes
function getTriangleShapes() {
    return [
        { char: '▲', code: 'U+25B2', name: 'BLACK UP-POINTING TRIANGLE' },
        { char: '△', code: 'U+25B3', name: 'WHITE UP-POINTING TRIANGLE' },
        { char: '▼', code: 'U+25BC', name: 'BLACK DOWN-POINTING TRIANGLE' },
        { char: '▽', code: 'U+25BD', name: 'WHITE DOWN-POINTING TRIANGLE' },
        { char: '◀', code: 'U+25C0', name: 'BLACK LEFT-POINTING TRIANGLE' },
        { char: '◁', code: 'U+25C1', name: 'WHITE LEFT-POINTING TRIANGLE' },
        { char: '▶', code: 'U+25B6', name: 'BLACK RIGHT-POINTING TRIANGLE' },
        { char: '▷', code: 'U+25B7', name: 'WHITE RIGHT-POINTING TRIANGLE' },
        { char: '🔺', code: 'U+1F53A', name: 'RED TRIANGLE POINTED UP' },
        { char: '🔻', code: 'U+1F53B', name: 'RED TRIANGLE POINTED DOWN' }
    ];
}

// Get star shapes
function getStarShapes() {
    return [
        { char: '★', code: 'U+2605', name: 'BLACK STAR' },
        { char: '☆', code: 'U+2606', name: 'WHITE STAR' },
        { char: '✦', code: 'U+2726', name: 'BLACK FOUR POINTED STAR' },
        { char: '✧', code: 'U+2727', name: 'WHITE FOUR POINTED STAR' },
        { char: '✩', code: 'U+2729', name: 'STRESS OUTLINED WHITE STAR' },
        { char: '✪', code: 'U+272A', name: 'CIRCLED WHITE STAR' },
        { char: '✫', code: 'U+272B', name: 'OPEN CENTRE BLACK STAR' },
        { char: '✬', code: 'U+272C', name: 'BLACK CENTRE WHITE STAR' },
        { char: '✭', code: 'U+272D', name: 'OUTLINED BLACK STAR' },
        { char: '✮', code: 'U+272E', name: 'HEAVY OUTLINED BLACK STAR' },
        { char: '✯', code: 'U+272F', name: 'PINWHEEL STAR' },
        { char: '⭐', code: 'U+2B50', name: 'WHITE MEDIUM STAR' }
    ];
}

// Get heart shapes
function getHeartShapes() {
    return [
        { char: '❤️', code: 'U+2764', name: 'RED HEART' },
        { char: '🧡', code: 'U+1F9E1', name: 'ORANGE HEART' },
        { char: '💛', code: 'U+1F49B', name: 'YELLOW HEART' },
        { char: '💚', code: 'U+1F49A', name: 'GREEN HEART' },
        { char: '💙', code: 'U+1F499', name: 'BLUE HEART' },
        { char: '💜', code: 'U+1F49C', name: 'PURPLE HEART' },
        { char: '🤍', code: 'U+1F90D', name: 'WHITE HEART' },
        { char: '🖤', code: 'U+1F5A4', name: 'BLACK HEART' },
        { char: '🤎', code: 'U+1F90E', name: 'BROWN HEART' },
        { char: '💕', code: 'U+1F495', name: 'TWO HEARTS' },
        { char: '💖', code: 'U+1F496', name: 'SPARKLING HEART' },
        { char: '💗', code: 'U+1F497', name: 'GROWING HEART' },
        { char: '💓', code: 'U+1F493', name: 'BEATING HEART' },
        { char: '💞', code: 'U+1F49E', name: 'REVOLVING HEARTS' },
        { char: '💝', code: 'U+1F49D', name: 'HEART WITH RIBBON' },
        { char: '♥️', code: 'U+2665', name: 'HEART SUIT' }
    ];
}

// Get diamond shapes
function getDiamondShapes() {
    return [
        { char: '◆', code: 'U+25C6', name: 'BLACK DIAMOND' },
        { char: '◇', code: 'U+25C7', name: 'WHITE DIAMOND' },
        { char: '◈', code: 'U+25C8', name: 'WHITE DIAMOND CONTAINING BLACK SMALL DIAMOND' },
        { char: '♦️', code: 'U+2666', name: 'DIAMOND SUIT' },
        { char: '♢', code: 'U+2662', name: 'WHITE DIAMOND SUIT' },
        { char: '💎', code: 'U+1F48E', name: 'GEM STONE' }
    ];
}

// Get punctuation characters
function getPunctuationCharacters() {
    return [
        { char: '.', code: 'U+002E', name: 'FULL STOP' },
        { char: ',', code: 'U+002C', name: 'COMMA' },
        { char: ';', code: 'U+003B', name: 'SEMICOLON' },
        { char: ':', code: 'U+003A', name: 'COLON' },
        { char: '!', code: 'U+0021', name: 'EXCLAMATION MARK' },
        { char: '?', code: 'U+003F', name: 'QUESTION MARK' },
        { char: '"', code: 'U+0022', name: 'QUOTATION MARK' },
        { char: "'", code: 'U+0027', name: 'APOSTROPHE' },
        { char: '(', code: 'U+0028', name: 'LEFT PARENTHESIS' },
        { char: ')', code: 'U+0029', name: 'RIGHT PARENTHESIS' },
        { char: '[', code: 'U+005B', name: 'LEFT SQUARE BRACKET' },
        { char: ']', code: 'U+005D', name: 'RIGHT SQUARE BRACKET' },
        { char: '{', code: 'U+007B', name: 'LEFT CURLY BRACKET' },
        { char: '}', code: 'U+007D', name: 'RIGHT CURLY BRACKET' },
        { char: '–', code: 'U+2013', name: 'EN DASH' },
        { char: '—', code: 'U+2014', name: 'EM DASH' },
        { char: '…', code: 'U+2026', name: 'HORIZONTAL ELLIPSIS' }
    ];
}

// Get currency characters
function getCurrencyCharacters() {
    return [
        { char: '$', code: 'U+0024', name: 'DOLLAR SIGN' },
        { char: '€', code: 'U+20AC', name: 'EURO SIGN' },
        { char: '£', code: 'U+00A3', name: 'POUND SIGN' },
        { char: '¥', code: 'U+00A5', name: 'YEN SIGN' },
        { char: '₹', code: 'U+20B9', name: 'INDIAN RUPEE SIGN' },
        { char: '₩', code: 'U+20A9', name: 'WON SIGN' },
        { char: '¢', code: 'U+00A2', name: 'CENT SIGN' },
        { char: '₽', code: 'U+20BD', name: 'RUBLE SIGN' },
        { char: '₿', code: 'U+20BF', name: 'BITCOIN SIGN' },
        { char: '¤', code: 'U+00A4', name: 'GENERIC CURRENCY SYMBOL' }
    ];
}

// Get emphasis characters
function getEmphasisCharacters() {
    return [
        { char: '*', code: 'U+002A', name: 'ASTERISK' },
        { char: '**', code: 'U+002A U+002A', name: 'DOUBLE ASTERISK' },
        { char: '_', code: 'U+005F', name: 'LOW LINE' },
        { char: '‾', code: 'U+203E', name: 'OVERLINE' },
        { char: '‗', code: 'U+2017', name: 'DOUBLE LOW LINE' },
        { char: '′', code: 'U+2032', name: 'PRIME' },
        { char: '″', code: 'U+2033', name: 'DOUBLE PRIME' },
        { char: '‴', code: 'U+2034', name: 'TRIPLE PRIME' }
    ];
}

// Search by name pattern
function searchByNamePattern(keyword) {
    const candidates = [];
    const lowerKeyword = keyword.toLowerCase();
    
    // Get all character sets
    const allCharacters = [
        ...getEmojiCharacters(),
        ...getMathematicalCharacters(),
        ...getArrowCharacters(),
        ...getGeometricCharacters(),
        ...getCircleShapes(),
        ...getSquareShapes(),
        ...getTriangleShapes(),
        ...getStarShapes(),
        ...getHeartShapes(),
        ...getDiamondShapes(),
        ...getPunctuationCharacters(),
        ...getCurrencyCharacters(),
        ...getEmphasisCharacters()
    ];
    
    // Search for characters whose names contain the keyword
    for (const character of allCharacters) {
        if (character.name.toLowerCase().includes(lowerKeyword)) {
            candidates.push(character);
        }
    }
    
    return candidates;
} 