// Analyze user query and determine search criteria
export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const body = await request.json();
        const { query } = body;

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return new Response(JSON.stringify({
                error: 'Valid query is required'
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

        console.log('Analyzing query:', query);

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
                        content: `You are a Unicode character search expert. Analyze user queries to determine search criteria with appropriate confidence levels.

Your task is to identify the PRIMARY criterion and any SECONDARY criteria that are relevant.

Return EXACTLY this JSON structure:
{
  "primary_criterion": "range|shape|function|name",
  "criteria": {
    "range": {
      "type": "AI_determined_range_category_or_null",
      "keywords": ["keyword1", "keyword2"],
      "confidence": 0.0-1.0
    },
    "shape": {
      "type": "AI_determined_shape_category_or_null",
      "keywords": ["keyword1", "keyword2"],
      "confidence": 0.0-1.0
    },
    "function": {
      "type": "AI_determined_function_category_or_null",
      "keywords": ["keyword1", "keyword2"],
      "confidence": 0.0-1.0
    },
    "name": {
      "keywords": ["keyword1", "keyword2"],
      "confidence": 0.0-1.0
    }
  }
}

CRITICAL RULES:
1. Choose EXACTLY ONE "primary_criterion" - the most important search method
2. Set confidence to 1.0 for the primary criterion
3. Set confidence to 0.6-0.8 for relevant secondary criteria
4. Set confidence to 0.0 for irrelevant criteria
5. Set "type" to "null" for criteria that don't apply
6. Use English keywords only, even if query is in another language
7. Only use "shape" if query explicitly mentions VISUAL APPEARANCE or LOOKS LIKE something

AI FREEDOM FOR TYPE FIELDS:
- For "range": Create your own category names like "facial_emojis", "mathematical_symbols", "korean_characters", "chinese_characters", "punctuation_marks", etc.
- For "shape": Create your own shape descriptions like "circular", "oval_face", "triangular_point", "linear_bar", "cross_pattern", "tree_like", etc.
- For "function": Create your own function descriptions like "text_separator", "mathematical_operator", "currency_indicator", "emphasis_marker", etc.
- DO NOT limit yourself to predefined categories - be creative and specific!

DECISION PRIORITY:
1. If query mentions specific Unicode ranges or character categories → PRIMARY: range
2. If query mentions visual appearance or shape descriptions → Add shape as criterion
3. If query mentions specific character functions → PRIMARY: function  
4. Everything else → PRIMARY: name

Use your natural language understanding to determine:
- When a query is asking about a specific type or category of characters (range)
- When a query is describing visual appearance or shape (shape)
- When a query is about character functionality (function)
- When a query is searching by name or meaning (name)

EXAMPLES:
- "수학 기호 중 동그랗게 생긴거" → PRIMARY: range (confidence: 1.0), shape (confidence: 0.8)
- "이모지 중에서 웃는 얼굴" → PRIMARY: range (confidence: 1.0), shape (confidence: 0.7)
- "한자 중에서 나무 모양" → PRIMARY: range (confidence: 1.0), shape (confidence: 0.8)
- "동그란 모양" → PRIMARY: shape (confidence: 1.0), others: 0.0
- "heart symbol" → PRIMARY: name (confidence: 1.0), others: 0.0

Respond with ONLY the JSON, no additional text.`
                    },
                    {
                        role: "user",
                        content: `Analyze this query and determine search criteria: "${query}"`
                    }
                ],
                temperature: 0.1,
                max_tokens: 800
            })
        });

        if (!response.ok) {
            console.error('Qwen API error:', response.status, await response.text());
            return new Response(JSON.stringify({
                error: 'Analysis service unavailable'
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

        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        
        console.log('Raw AI response:', content);

        let analysisResult;
        try {
            analysisResult = JSON.parse(content);
        } catch (parseError) {
            console.error('Failed to parse AI response:', parseError);
            // Fallback analysis
            analysisResult = createFallbackAnalysis(query);
        }

        // Validate and normalize the analysis result
        const normalizedResult = normalizeAnalysis(analysisResult);
        
        console.log('Final analysis result:', normalizedResult);

        return new Response(JSON.stringify(normalizedResult), {
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        });

    } catch (error) {
        console.error('Analysis error:', error);
        
        return new Response(JSON.stringify({
            error: 'Analysis failed',
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

// Create fallback analysis when AI parsing fails
function createFallbackAnalysis(query) {
    const lowerQuery = query.toLowerCase();
    
    // Shape keywords
    const shapeWords = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond', 'arrow', 'round', 'looks like', 'similar to', 'shape'];
    // Range keywords  
    const emojiWords = ['emoji', 'emoticon', 'face', 'smiley'];
    const mathWords = ['math', 'mathematical', 'plus', 'minus', 'equals', 'symbol'];
    const arrowWords = ['arrow', 'direction', 'point'];
    // Function keywords
    const punctWords = ['punctuation', 'comma', 'period', 'semicolon'];
    const currencyWords = ['currency', 'money', 'dollar', 'euro', 'yen'];
    
    let primary = 'name';
    let shapeType = null;
    let rangeType = null;
    let functionType = null;
    
    // Determine primary criterion
    if (shapeWords.some(word => lowerQuery.includes(word))) {
        primary = 'shape';
        if (lowerQuery.includes('circle') || lowerQuery.includes('round')) shapeType = 'circle';
        else if (lowerQuery.includes('square')) shapeType = 'square';
        else if (lowerQuery.includes('triangle')) shapeType = 'triangle';
        else if (lowerQuery.includes('star')) shapeType = 'star';
        else if (lowerQuery.includes('heart')) shapeType = 'heart';
        else if (lowerQuery.includes('diamond')) shapeType = 'diamond';
        else if (lowerQuery.includes('arrow')) shapeType = 'arrow';
    } else if (emojiWords.some(word => lowerQuery.includes(word))) {
        primary = 'range';
        rangeType = 'emoji';
    } else if (mathWords.some(word => lowerQuery.includes(word))) {
        primary = 'range';
        rangeType = 'math';
    } else if (arrowWords.some(word => lowerQuery.includes(word))) {
        primary = 'range';
        rangeType = 'arrows';
    } else if (punctWords.some(word => lowerQuery.includes(word))) {
        primary = 'function';
        functionType = 'punctuation';
    } else if (currencyWords.some(word => lowerQuery.includes(word))) {
        primary = 'function';
        functionType = 'currency';
    }
    
    return {
        primary_criterion: primary,
        criteria: {
            range: {
                type: rangeType,
                keywords: rangeType ? [rangeType] : [],
                confidence: rangeType ? 0.8 : 0.0
            },
            shape: {
                type: shapeType,
                keywords: shapeType ? [shapeType] : [],
                confidence: shapeType ? 0.8 : 0.0
            },
            function: {
                type: functionType,
                keywords: functionType ? [functionType] : [],
                confidence: functionType ? 0.8 : 0.0
            },
            name: {
                keywords: query.split(' ').slice(0, 3),
                confidence: 0.6
            }
        }
    };
}

// Normalize and validate analysis result
function normalizeAnalysis(result) {
    // Ensure primary_criterion is set
    if (!result.primary_criterion) {
        result.primary_criterion = 'name';
    }
    
    // Ensure criteria structure exists
    if (!result.criteria) {
        result.criteria = {};
    }
    
    // Normalize each criterion
    result.criteria.range = normalizeCriterion(result.criteria.range, ['emoji', 'math', 'arrows', 'geometric', 'punctuation', 'currency', 'symbols']);
    result.criteria.shape = normalizeCriterion(result.criteria.shape, ['circle', 'square', 'triangle', 'star', 'heart', 'diamond', 'arrow', 'line', 'cross']);
    result.criteria.function = normalizeCriterion(result.criteria.function, ['separator', 'punctuation', 'currency', 'math_operator', 'emphasis', 'decoration']);
    result.criteria.name = normalizeNameCriterion(result.criteria.name);
    
    // Enforce single primary criterion rule
    enforcePrimaryCriterion(result);
    
    return result;
}

// Normalize individual criterion
function normalizeCriterion(criterion, validTypes) {
    if (!criterion) {
        return { type: null, keywords: [], confidence: 0.0 };
    }
    
    return {
        type: validTypes.includes(criterion.type) ? criterion.type : null,
        keywords: Array.isArray(criterion.keywords) ? criterion.keywords.slice(0, 3) : [],
        confidence: typeof criterion.confidence === 'number' ? Math.max(0, Math.min(1, criterion.confidence)) : 0.0
    };
}

// Normalize name criterion
function normalizeNameCriterion(criterion) {
    if (!criterion) {
        return { keywords: [], confidence: 0.0 };
    }
    
    return {
        keywords: Array.isArray(criterion.keywords) ? criterion.keywords.slice(0, 3) : [],
        confidence: typeof criterion.confidence === 'number' ? Math.max(0, Math.min(1, criterion.confidence)) : 0.0
    };
}

// Enforce single primary criterion rule
function enforcePrimaryCriterion(result) {
    const primaryType = result.primary_criterion;
    
    // Reduce confidence of non-primary criteria
    for (const [criterionName, criterion] of Object.entries(result.criteria)) {
        if (criterionName !== primaryType && criterion.confidence > 0.5) {
            criterion.confidence = Math.min(0.5, criterion.confidence);
        }
        
        // Ensure primary criterion has reasonable confidence
        if (criterionName === primaryType && criterion.confidence < 0.7) {
            criterion.confidence = Math.max(0.7, criterion.confidence);
        }
    }
    
    // If primary criterion has null type, try to fix it
    if (result.criteria[primaryType]?.type === null || !result.criteria[primaryType]?.type) {
        if (primaryType === 'name') {
            // Name criterion doesn't need a type
            result.criteria.name.confidence = 0.8;
        } else {
            // Switch to name as fallback
            result.primary_criterion = 'name';
            result.criteria.name.confidence = 0.8;
        }
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