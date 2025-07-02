// AI를 통해 후보 문자들을 필터링하여 최종 결과를 반환하는 API
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { candidates, criteria, query } = await request.json();
    
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Candidates array is required' 
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

    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ 
        error: 'Query is required and must be a string' 
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

    // Check if this is a shape-related query for enhanced analysis
    const isShapeQuery = criteria?.shape?.type && criteria.shape.type !== null;
    const model = isShapeQuery ? "qwen-vl-plus" : "qwen-plus";

    let messages = [
      {
        role: "system",
        content: `You are a Unicode character expert. Your task is to filter and analyze Unicode characters based on user queries.

Given a list of Unicode character candidates and the original user query, select the TOP 10 most relevant characters and provide detailed analysis.

Return EXACTLY this JSON structure:
{
  "results": [
    {
      "char": "character",
      "code": "U+XXXX",
      "name": "UNICODE CHARACTER NAME",
      "relevance_score": 0-10,
      "visual_match_score": 0-10,
      "analysis": "detailed explanation of why this character matches the query"
    }
  ]
}

Scoring guidelines:
- relevance_score: How well the character matches the semantic meaning of the query (0-10)
- visual_match_score: How well the character matches the visual description (0-10)
- Select exactly 10 characters (or fewer if less than 10 candidates provided)
- Order by combined relevance and visual match scores
- Provide specific analysis explaining the match

Respond with ONLY the JSON, no additional text.`
      },
      {
        role: "user",
        content: `Original query: "${query}"

Search criteria: ${JSON.stringify(criteria || {})}

Candidates to filter and analyze:
${candidates.map(c => `${c.char} (${c.code}) - ${c.name}`).join('\n')}

Please select the top 10 most relevant characters and provide detailed analysis for each.`
      }
    ];

    // Use official Qwen DashScope API
    const response = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.2,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      console.error('Qwen API error:', response.status, await response.text());
      // Fallback to basic filtering
      return new Response(JSON.stringify({
        results: getBasicFilteredResults(candidates, query)
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    const data = await response.json();
    let filterResult;

    try {
      const content = data.choices[0].message.content.trim();
      filterResult = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse Qwen response:', parseError);
      filterResult = {
        results: getBasicFilteredResults(candidates, query)
      };
    }

    // Ensure we have valid results
    if (!filterResult.results || !Array.isArray(filterResult.results)) {
      filterResult = {
        results: getBasicFilteredResults(candidates, query)
      };
    }

    // Limit to 10 results and ensure proper format
    filterResult.results = filterResult.results.slice(0, 10).map(result => ({
      char: result.char || '?',
      code: result.code || 'U+0000',
      name: result.name || 'UNKNOWN',
      relevance_score: Math.min(10, Math.max(0, result.relevance_score || 5)),
      visual_match_score: Math.min(10, Math.max(0, result.visual_match_score || 5)),
      analysis: result.analysis || 'Character matches the search criteria.'
    }));

    return new Response(JSON.stringify(filterResult), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });

  } catch (error) {
    console.error('Filter error:', error);
    
    // Return basic filtered results as fallback
    const fallbackResults = candidates ? getBasicFilteredResults(candidates.slice(0, 10), query || '') : [];
    return new Response(JSON.stringify({
      results: fallbackResults
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
}

// CORS 처리를 위한 OPTIONS 핸들러
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

function getBasicFilteredResults(candidates, query) {
  if (!Array.isArray(candidates)) return [];
  
  const lowerQuery = query.toLowerCase();
  
  // Simple scoring based on name similarity and common patterns
  return candidates.slice(0, 10).map(candidate => {
    const name = (candidate.name || '').toLowerCase();
    let relevanceScore = 5; // base score
    let visualScore = 5;
    
    // Check if query terms appear in the name
    const queryWords = lowerQuery.split(/\s+/);
    const matchingWords = queryWords.filter(word => 
      word.length > 2 && name.includes(word)
    );
    
    relevanceScore += matchingWords.length * 2;
    
    // Boost scores for exact matches
    if (name.includes(lowerQuery)) {
      relevanceScore += 3;
    }
    
    // Shape-based scoring
    if (lowerQuery.includes('circle') && name.includes('circle')) visualScore += 3;
    if (lowerQuery.includes('square') && name.includes('square')) visualScore += 3;
    if (lowerQuery.includes('triangle') && name.includes('triangle')) visualScore += 3;
    if (lowerQuery.includes('star') && name.includes('star')) visualScore += 3;
    if (lowerQuery.includes('heart') && name.includes('heart')) visualScore += 3;
    if (lowerQuery.includes('arrow') && name.includes('arrow')) visualScore += 3;
    
    // Cap scores at 10
    relevanceScore = Math.min(10, relevanceScore);
    visualScore = Math.min(10, visualScore);
    
    return {
      char: candidate.char || '?',
      code: candidate.code || 'U+0000',
      name: candidate.name || 'UNKNOWN',
      relevance_score: relevanceScore,
      visual_match_score: visualScore,
      analysis: `Character matches query "${query}" with ${matchingWords.length} matching terms in the name.`
    };
  }).sort((a, b) => {
    const scoreA = a.relevance_score + a.visual_match_score;
    const scoreB = b.relevance_score + b.visual_match_score;
    return scoreB - scoreA;
  });
} 