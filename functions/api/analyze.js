// 사용자 쿼리를 4가지 기준으로 분석하는 API
export default {
  async fetch(request, env, ctx) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      });
    }

    try {
      const { query } = await request.json();
      
      if (!query || typeof query !== 'string') {
        return new Response(JSON.stringify({ 
          error: 'Query is required and must be a string' 
        }), { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });
      }

      // Use official Qwen DashScope API
      const response = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "qwen-plus",
          messages: [
            {
              role: "system",
              content: `You are a Unicode search query analyzer. Your task is to analyze user queries and break them down into 4 specific search criteria.

For the given query, provide EXACTLY this JSON structure:
{
  "range": {
    "type": "specific range type or null",
    "title": "descriptive title",
    "description": "what to search for",
    "keywords": ["array", "of", "relevant", "keywords"]
  },
  "shape": {
    "type": "geometric shape type or null", 
    "title": "descriptive title",
    "description": "visual characteristics to search for",
    "keywords": ["array", "of", "shape", "keywords"]
  },
  "function": {
    "type": "unicode function type or null",
    "title": "descriptive title", 
    "description": "functional purpose or usage",
    "keywords": ["array", "of", "function", "keywords"]
  },
  "name": {
    "type": "name pattern type or null",
    "title": "descriptive title",
    "description": "name-based search terms",
    "keywords": ["array", "of", "name", "keywords"]
  }
}

Guidelines:
- Set "type" to null if that criteria doesn't apply to the query
- For "range": Use types like "emoji", "math", "arrows", "geometric", "punctuation", "currency"
- For "shape": Use types like "circle", "square", "triangle", "star", "heart", "diamond" 
- For "function": Use types like "separator", "emphasis", "currency", "math_operator"
- For "name": Use descriptive terms that would appear in Unicode character names
- Include 3-8 relevant keywords for each applicable criteria
- Focus on the most relevant 2-3 criteria for any given query

Respond with ONLY the JSON, no additional text.`
            },
            {
              role: "user",
              content: query
            }
          ],
          temperature: 0.3,
          max_tokens: 800
        })
      });

      if (!response.ok) {
        console.error('Qwen API error:', response.status, await response.text());
        // Fallback analysis
        return new Response(JSON.stringify(getFallbackAnalysis(query)), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const data = await response.json();
      let analysisResult;

      try {
        const content = data.choices[0].message.content.trim();
        analysisResult = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse Qwen response:', parseError);
        analysisResult = getFallbackAnalysis(query);
      }

      return new Response(JSON.stringify(analysisResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Analysis error:', error);
      
      // Return fallback analysis
      const fallback = getFallbackAnalysis(query || '');
      return new Response(JSON.stringify(fallback), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }
};

function getFallbackAnalysis(query) {
  const lowerQuery = query.toLowerCase();
  
  // Simple keyword-based fallback analysis
  let analysis = {
    range: { type: null, title: "Range Search", description: "General character range", keywords: [] },
    shape: { type: null, title: "Shape Search", description: "Visual characteristics", keywords: [] },
    function: { type: null, title: "Function Search", description: "Character purpose", keywords: [] },
    name: { type: null, title: "Name Search", description: "Character names", keywords: [query] }
  };

  // Emoji detection
  if (lowerQuery.includes('emoji') || lowerQuery.includes('face') || lowerQuery.includes('smile')) {
    analysis.range = {
      type: "emoji",
      title: "Emoji Characters",
      description: "Search in emoji ranges",
      keywords: ["emoji", "face", "expression"]
    };
  }

  // Shape detection
  const shapes = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond', 'arrow'];
  for (let shape of shapes) {
    if (lowerQuery.includes(shape)) {
      analysis.shape = {
        type: shape,
        title: `${shape.charAt(0).toUpperCase() + shape.slice(1)} Shapes`,
        description: `Characters with ${shape} shape`,
        keywords: [shape, "geometric", "symbol"]
      };
      break;
    }
  }

  // Math detection
  if (lowerQuery.includes('math') || lowerQuery.includes('number') || lowerQuery.includes('equation')) {
    analysis.range = {
      type: "math",
      title: "Mathematical Symbols",
      description: "Mathematical and scientific notation",
      keywords: ["math", "mathematical", "symbol", "equation"]
    };
  }

  return analysis;
} 