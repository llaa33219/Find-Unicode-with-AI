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

CRITICAL: Process everything in English internally, regardless of the input language.

Your task is to identify the PRIMARY criterion and any SECONDARY criteria that are relevant.

Return EXACTLY this JSON structure:
{
  "primary_criterion": "range|shape|function|name",
  "criteria": {
    "range": {
      "type": "actual_unicode_block_name_or_null",
      "keywords": ["english_keyword1", "english_keyword2"],
      "confidence": 0.0-1.0
    },
    "shape": {
      "type": "english_shape_description_or_null",
      "keywords": ["english_keyword1", "english_keyword2"],
      "confidence": 0.0-1.0
    },
    "function": {
      "type": "english_function_description_or_null",
      "keywords": ["english_keyword1", "english_keyword2"],
      "confidence": 0.0-1.0
    },
    "name": {
      "keywords": ["english_keyword1", "english_keyword2"],
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
6. ALL keywords and types must be in English only
7. For range "type", use actual Unicode block names when possible (e.g., "Mathematical Operators", "CJK Unified Ideographs", "Miscellaneous Symbols")

DECISION PRIORITY:
1. If query mentions specific Unicode ranges or character categories → PRIMARY: range
2. If query mentions visual appearance or shape descriptions → PRIMARY: shape (unless range is also mentioned)
3. If query mentions specific character functions → PRIMARY: function
4. If query is about character names, meanings, or contains specific name terms → PRIMARY: name

Use your natural language understanding to determine:
- When a query is asking about a specific type or category of characters (range)
- When a query is describing visual appearance or shape (shape)
- When a query is about character functionality (function)
- When a query is searching by name or meaning (name)

EXAMPLES:
- "수학 기호 중 동그랗게 생긴거" → PRIMARY: range (type: "Mathematical Operators", keywords: ["math", "symbol"], confidence: 1.0), shape (type: "circular", keywords: ["round", "circle"], confidence: 0.8)
- "이모지 중에서 웃는 얼굴" → PRIMARY: range (type: "Emoticons", keywords: ["emoji", "face"], confidence: 1.0), shape (type: "smiling", keywords: ["smile", "happy"], confidence: 0.7)
- "한자 중에서 나무 모양" → PRIMARY: range (type: "CJK Unified Ideographs", keywords: ["chinese", "character"], confidence: 1.0), shape (type: "tree_like", keywords: ["tree", "wood"], confidence: 0.8)
- "동그란 모양" → PRIMARY: shape (type: "circular", keywords: ["round", "circle"], confidence: 1.0)
- "heart symbol" → PRIMARY: name (keywords: ["heart"], confidence: 1.0)

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
    
    // Normalize each criterion - allow AI's creative types
    result.criteria.range = normalizeCriterionOpen(result.criteria.range);
    result.criteria.shape = normalizeCriterionOpen(result.criteria.shape);
    result.criteria.function = normalizeCriterionOpen(result.criteria.function);
    result.criteria.name = normalizeNameCriterion(result.criteria.name);
    
    // Enforce confidence levels only
    enforceConfidenceLevels(result);
    
    return result;
}

// Normalize individual criterion - accept AI's types
function normalizeCriterionOpen(criterion) {
    if (!criterion) {
        return { type: null, keywords: [], confidence: 0.0 };
    }
    
    return {
        type: criterion.type || null, // Keep AI's type as-is
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

// Enforce confidence levels without changing primary criterion
function enforceConfidenceLevels(result) {
    const primaryType = result.primary_criterion;
    
    // Ensure primary criterion has high confidence
    if (result.criteria[primaryType] && result.criteria[primaryType].confidence < 0.7) {
        result.criteria[primaryType].confidence = Math.max(0.7, result.criteria[primaryType].confidence);
    }
    
    // Reduce confidence of non-primary criteria if they're too high
    for (const [criterionName, criterion] of Object.entries(result.criteria)) {
        if (criterionName !== primaryType && criterion.confidence > 0.9) {
            criterion.confidence = Math.min(0.8, criterion.confidence);
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