// AI-driven Unicode character search based on analysis results
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

        console.log('AI is searching for Unicode characters...');

        // Let AI do ALL the searching based on the analysis criteria
        const searchResults = await getAISearchResults(query, criteria, env);
        
        console.log('AI search complete:', {
            total: searchResults.length,
            sample: searchResults.slice(0, 3)
        });

        return new Response(JSON.stringify({
            results: searchResults,
            total: searchResults.length,
            ai_driven: true
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

// AI does ALL the searching - no presets, no limitations
async function getAISearchResults(query, criteria, env) {
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
                        content: `You are a comprehensive Unicode search expert. Based on the user's query and analysis criteria, find ALL relevant Unicode characters from ANY Unicode block.

CRITICAL INSTRUCTIONS:
- Search across ALL Unicode ranges and blocks without ANY limitations
- Use the analysis criteria to guide your search, but don't be restricted by them
- Find characters based on visual similarity, functional purpose, semantic meaning, and contextual relevance
- Include characters from multiple Unicode blocks that serve similar purposes
- Be comprehensive - find 25-40 characters that could be useful
- RETURN ONLY SINGLE UNICODE CHARACTERS, NOT WORDS OR COMBINATIONS
- Each result must be exactly ONE character, not multiple characters together

Analysis criteria will include:
- Primary criterion (most important search direction)
- Multiple criteria with confidence scores
- Keywords for each criterion

Return EXACTLY this JSON structure:
{
  "results": [
    {
      "char": "single_character_only",
      "code": "U+XXXX",
      "name": "UNICODE CHARACTER NAME",
      "reason": "detailed explanation of why this single character matches"
    }
  ]
}

Guidelines:
- Find 25-40 relevant SINGLE characters from ALL applicable Unicode blocks
- Don't limit yourself to predefined categories
- Look for visual, functional, and semantic matches
- Include both obvious and creative matches
- Consider all criteria, not just the primary one
- Use proper Unicode format (U+XXXX)
- NEVER return multiple characters together (like 顔文字 or 輪郭)
- Each "char" field must contain exactly ONE Unicode character
- Do not return compound words, phrases, or character combinations

EXAMPLES OF CORRECT FORMAT:
✅ "char": "顔" (single character)
✅ "char": "文" (single character) 
✅ "char": "字" (single character)

EXAMPLES OF INCORRECT FORMAT:
❌ "char": "顔文字" (multiple characters)
❌ "char": "輪郭" (multiple characters)
❌ "char": "face shape" (words)

Respond with ONLY the JSON, no additional text.`
                    },
                    {
                        role: "user",
                        content: `Find Unicode characters for this query: "${query}"

Analysis criteria:
${JSON.stringify(criteria, null, 2)}

Primary criterion: ${criteria.primary_criterion}

Search comprehensively across all Unicode blocks and find characters that match any aspect of this query and criteria.`
                    }
                ],
                temperature: 0.3,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            console.error('AI search API error:', response.status);
            return [];
        }

        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        
        try {
            const result = JSON.parse(content);
            return result.results || [];
        } catch (parseError) {
            console.error('Failed to parse AI search response:', parseError);
            return [];
        }
        
    } catch (error) {
        console.error('AI search error:', error);
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