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
    // Generate actual PNG image of characters
    const charactersToAnalyze = candidates.slice(0, 9); // Limit to 9 characters for 3x3 grid
    const imageUrl = await generateCharacterImage(charactersToAnalyze);
    
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
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a Unicode character visual analysis expert. Look at this image containing Unicode characters arranged in a 3×3 grid and determine which ones best match this description: "${query}"

Each cell in the grid is numbered (1-9). Analyze each character's ACTUAL VISUAL APPEARANCE in the image and rank them by how well they visually match the query description.

Return EXACTLY this JSON structure:
{
  "results": [
    {
      "char": "character",
      "code": "U+XXXX",
      "name": "UNICODE CHARACTER NAME", 
      "score": 0.0-1.0,
      "reason": "detailed visual analysis of why this character matches based on what you see in the image",
      "visual_features": "specific visual characteristics you observe in the image",
      "position": "grid position number (1-9)"
    }
  ]
}

VISUAL ANALYSIS GUIDELINES:
- Look at the ACTUAL visual shape and appearance of each character in the image
- Focus on geometric properties you can see: circles, squares, triangles, lines, curves, symmetry
- Consider proportions, thickness, visual similarity to the described shape
- Score based on how closely the visual appearance matches the query description
- Be strict: only include characters with score > 0.6
- Prioritize characters that actually LOOK LIKE what's described in the query
- Limit results to top 6 best visual matches
- Base analysis ONLY on what you can SEE in the image
- Reference characters by their grid position number

Character reference (position: character):
${charactersToAnalyze.map((c, i) => `${i+1}: ${c.char} (${c.code}) - ${c.name}`).join('\n')}

Respond with ONLY the JSON, no additional text.`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      console.error('Visual analysis API error:', response.status);
      return await filterWithTextAnalysis(candidates, query, criteria, env, 'qwen-turbo-latest');
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    try {
      const result = JSON.parse(content);
      return result.results || [];
    } catch (parseError) {
      console.error('Failed to parse visual analysis response:', parseError);
      return await filterWithTextAnalysis(candidates, query, criteria, env, 'qwen-turbo-latest');
    }
    
  } catch (error) {
    console.error('Visual analysis error:', error);
    return await filterWithTextAnalysis(candidates, query, criteria, env, 'qwen-turbo-latest');
  }
}

// Generate actual PNG image using external service
async function generateCharacterImage(characters) {
  try {
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols+2:wght@400&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Math&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+CJK+KR:wght@400&display=swap');

body { 
  margin: 0; 
  padding: 10px; 
  background: #ffffff; 
  font-family: "Noto Color Emoji", "Noto Sans Symbols 2", "Noto Sans Math", "Noto Sans CJK KR", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Arial Unicode MS", system-ui, sans-serif;
  width: 300px;
  height: 300px;
}
.grid { 
  display: grid; 
  grid-template-columns: repeat(3, 100px); 
  grid-template-rows: repeat(3, 100px);
  gap: 0; 
  border: 3px solid #000;
}
.cell { 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  border: 2px solid #666; 
  position: relative;
  background: #ffffff;
  box-sizing: border-box;
}
.char { 
  font-size: 64px; 
  line-height: 1;
  color: #000000;
  text-align: center;
  font-weight: 400;
}
.num { 
  position: absolute; 
  top: 2px; 
  left: 2px; 
  font-size: 14px; 
  color: #333; 
  font-family: Arial, sans-serif;
  font-weight: bold;
  background: rgba(255,255,255,0.9);
  padding: 1px 4px;
  border-radius: 2px;
  border: 1px solid #ccc;
}
</style>
</head>
<body>
<div class="grid">
${characters.slice(0, 9).map((char, i) => `
  <div class="cell">
    <div class="char">${escapeHtml(char.char)}</div>
    <div class="num">${i + 1}</div>
  </div>
`).join('')}
</div>
</body>
</html>`;

    // Use HTMLCSStoImage service to generate actual PNG
    const response = await fetch('https://htmlcsstoimage.com/demo_run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: htmlContent,
        width: 300,
        height: 300,
        device_scale_factor: 2,
        format: 'png'
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.url) {
        console.log('Generated character image:', result.url);
        return result.url;
      }
    }
    
    console.log('Image service failed, trying alternative...');
    
    // Try alternative service
    const altResponse = await fetch('https://api.screenshotone.com/take', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: htmlContent,
        viewport_width: 300,
        viewport_height: 300,
        device_scale_factor: 2,
        format: 'png'
      })
    });
    
    if (altResponse.ok) {
      const altResult = await altResponse.json();
      if (altResult.url) {
        console.log('Generated character image (alt):', altResult.url);
        return altResult.url;
      }
    }
    
    throw new Error('All image generation services failed');
    
  } catch (error) {
    console.error('Image generation error:', error);
    throw error;
  }
}

// HTML escape function
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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