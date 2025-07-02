// AI를 통해 후보 문자들을 필터링하여 최종 결과를 반환하는 API
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    
    console.log('Filter API received:', body);
    
    const { candidates, query, criteria } = body;

    if (!candidates || !Array.isArray(candidates)) {
      console.log('No candidates provided, returning enhanced recommendations');
      const recommendations = await getEnhancedRecommendations(query, env);
      return new Response(JSON.stringify({
        results: recommendations,
        total: recommendations.length,
        fallback: true
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    if (candidates.length === 0) {
      console.log('Empty candidates array, returning enhanced recommendations');
      const recommendations = await getEnhancedRecommendations(query, env);
      return new Response(JSON.stringify({
        results: recommendations,
        total: recommendations.length,
        fallback: true
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    console.log('Processing candidates:', candidates.length);

    // Determine if we need visual analysis (VL model)
    const needsVisualAnalysis = isVisualAnalysisNeeded(criteria);
    const modelToUse = needsVisualAnalysis ? 'qwen-vl-plus-latest' : 'qwen-turbo-latest';
    
    console.log('Using model:', modelToUse, 'for visual analysis:', needsVisualAnalysis);

    let filteredResults;
    if (needsVisualAnalysis) {
      filteredResults = await filterWithVisualAnalysis(candidates, query, criteria, env, modelToUse);
    } else {
      filteredResults = await filterWithTextAnalysis(candidates, query, criteria, env, modelToUse);
    }

    console.log('Filtered results:', filteredResults.length);

    return new Response(JSON.stringify({
      results: filteredResults,
      total: filteredResults.length,
      model_used: modelToUse,
      visual_analysis: needsVisualAnalysis
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });

  } catch (error) {
    console.error('Filter error:', error);
    
    return new Response(JSON.stringify({
      error: 'Filter processing failed',
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

// Determine if visual analysis is needed
function isVisualAnalysisNeeded(criteria) {
  if (!criteria) return false;
  
  // Check if shape is the primary criterion or has high confidence
  if (criteria.primary_criterion === 'shape') return true;
  if (criteria.criteria?.shape?.confidence > 0.6) return true;
  
  // Check for specific visual keywords
  const allKeywords = [];
  Object.values(criteria.criteria || {}).forEach(criterion => {
    if (criterion.keywords) allKeywords.push(...criterion.keywords);
  });
  
  const visualKeywords = ['looks', 'similar', 'shape', 'appearance', 'visual', 'circle', 'square', 'triangle', 'round'];
  return visualKeywords.some(keyword => 
    allKeywords.some(k => k.toLowerCase().includes(keyword))
  );
}

// Filter with visual analysis using VL model
async function filterWithVisualAnalysis(candidates, query, criteria, env, model) {
  try {
    // Create visual representation of characters for analysis
    const charactersForAnalysis = candidates.slice(0, 30).map(c => c.char).join('  ');
    
    const response = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: `You are a Unicode character visual analysis expert. You will analyze characters visually to determine which ones best match the user's description.

Given a list of Unicode characters and a query, rank them by visual similarity to what the user is looking for.

Return EXACTLY this JSON structure:
{
  "results": [
    {
      "char": "character",
      "code": "U+XXXX",
      "name": "UNICODE CHARACTER NAME", 
      "score": 0.0-1.0,
      "reason": "why this character matches visually",
      "visual_features": "specific visual characteristics"
    }
  ]
}

Guidelines for visual analysis:
- Focus on actual visual appearance of the characters
- Consider shape, proportions, visual similarity
- Score based on how well the visual matches the query
- Only include characters with score > 0.3
- Prioritize characters that visually look like what's described
- Be strict about visual matching - if it doesn't look similar, score it low
- Limit results to top 10 best visual matches

Respond with ONLY the JSON, no additional text.`
          },
          {
            role: "user",
            content: `Analyze these Unicode characters and find the ones that visually match this description: "${query}"

Characters to analyze: ${charactersForAnalysis}

Here are the character details:
${candidates.slice(0, 30).map(c => `${c.char} (${c.code}) - ${c.name}`).join('\n')}`
          }
        ],
        temperature: 0.2,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      console.error('Visual analysis API error:', response.status);
      return await filterWithTextAnalysis(candidates, query, criteria, env, 'qwen-turbo-latest');
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    const result = JSON.parse(content);
    
    return result.results || [];
    
  } catch (error) {
    console.error('Visual analysis error:', error);
    return await filterWithTextAnalysis(candidates, query, criteria, env, 'qwen-turbo-latest');
  }
}

// Filter with text-based analysis
async function filterWithTextAnalysis(candidates, query, criteria, env, model) {
  try {
    const response = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: `You are a Unicode character filtering expert. Given a list of candidate Unicode characters and a user query, select and rank the TOP 10 characters that best match the query.

Return EXACTLY this JSON structure:
{
  "results": [
    {
      "char": "character",
      "code": "U+XXXX",
      "name": "UNICODE CHARACTER NAME",
      "score": 0.0-1.0,
      "reason": "detailed explanation of why this character matches the query",
      "match_types": ["exact_name", "semantic", "visual", "functional"]
    }
  ]
}

CRITICAL FILTERING RULES:
1. Only return characters that TRULY match the query description
2. Be strict about range boundaries - if query asks for math symbols, don't include emojis
3. For shape queries, prioritize characters that visually look like the described shape
4. For function queries, ensure characters actually serve that purpose
5. Score based on relevance: 0.9+ (perfect match), 0.7-0.8 (very good), 0.5-0.6 (decent), <0.5 (poor)
6. Maximum 10 results, ordered by score (highest first)
7. Include detailed reasoning for each selection
8. If criteria specify a primary search type, prioritize that heavily

Primary search criterion: ${criteria?.primary_criterion || 'name'}

Respond with ONLY the JSON, no additional text.`
          },
          {
            role: "user",
            content: `Filter these Unicode characters to find the TOP 10 that best match: "${query}"

Search criteria: ${JSON.stringify(criteria)}

Candidate characters:
${candidates.map(c => `${c.char} (${c.code}) - ${c.name}`).join('\n')}`
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      console.error('Text analysis API error:', response.status);
      return candidates.slice(0, 10).map(c => ({
        ...c,
        score: 0.5,
        reason: 'Fallback result due to API error'
      }));
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    const result = JSON.parse(content);
    
    return result.results || [];
    
  } catch (error) {
    console.error('Text analysis error:', error);
    return candidates.slice(0, 10).map(c => ({
      ...c,
      score: 0.5,
      reason: 'Fallback result due to parsing error'
    }));
  }
}

// Get enhanced recommendations when no candidates are provided
async function getEnhancedRecommendations(query, env) {
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
            content: `You are a Unicode character expert. When given a query, provide the most relevant Unicode characters.

Return EXACTLY this JSON structure:
{
  "results": [
    {
      "char": "character",
      "code": "U+XXXX",
      "name": "UNICODE CHARACTER NAME",
      "score": 0.0-1.0,
      "reason": "why this character matches the query"
    }
  ]
}

Guidelines:
- Provide 10-15 characters that best match the query
- Include both obvious and creative matches
- Use proper Unicode format (U+XXXX)
- Score based on relevance to the query
- Focus on characters that truly match the description
- Order by relevance (highest score first)

Respond with ONLY the JSON, no additional text.`
          },
          {
            role: "user", 
            content: `Find Unicode characters that match this description: "${query}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 1200
      })
    });

    if (!response.ok) {
      console.error('Enhanced recommendations API error:', response.status);
      return getStaticFallbackResults();
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    const result = JSON.parse(content);
    
    return result.results || getStaticFallbackResults();
    
  } catch (error) {
    console.error('Enhanced recommendations error:', error);
    return getStaticFallbackResults();
  }
}

// Static fallback results when all else fails
function getStaticFallbackResults() {
  return [
    { char: '●', code: 'U+25CF', name: 'BLACK CIRCLE', score: 0.7, reason: 'Common geometric shape' },
    { char: '○', code: 'U+25CB', name: 'WHITE CIRCLE', score: 0.7, reason: 'Common geometric shape' },
    { char: '■', code: 'U+25A0', name: 'BLACK SQUARE', score: 0.7, reason: 'Common geometric shape' },
    { char: '□', code: 'U+25A1', name: 'WHITE SQUARE', score: 0.7, reason: 'Common geometric shape' },
    { char: '▲', code: 'U+25B2', name: 'BLACK UP-POINTING TRIANGLE', score: 0.7, reason: 'Common geometric shape' },
    { char: '★', code: 'U+2605', name: 'BLACK STAR', score: 0.7, reason: 'Common symbol' },
    { char: '❤️', code: 'U+2764', name: 'RED HEART', score: 0.7, reason: 'Popular symbol' },
    { char: '✅', code: 'U+2705', name: 'CHECK MARK BUTTON', score: 0.6, reason: 'Common checkmark' },
    { char: '❌', code: 'U+274C', name: 'CROSS MARK', score: 0.6, reason: 'Common x mark' },
    { char: '😀', code: 'U+1F600', name: 'GRINNING FACE', score: 0.6, reason: 'Common emoji' }
  ];
}

// CORS 처리를 위한 OPTIONS 핸들러
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
} 