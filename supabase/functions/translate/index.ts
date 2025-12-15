/**
 * Translation Edge Function
 *
 * Translates text between English and Dutch using Google Cloud Translation API.
 * Set GOOGLE_TRANSLATE_API_KEY in Supabase secrets.
 *
 * Alternative: Set DEEPL_API_KEY to use DeepL instead.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranslateRequest {
  text: string;
  sourceLanguage: 'en' | 'nl' | 'auto';
  targetLanguage: 'en' | 'nl';
  preserveHtml?: boolean;
}

interface TranslateResponse {
  translatedText: string;
  detectedLanguage?: string;
}

// Language code mapping
const LANGUAGE_CODES: Record<string, string> = {
  en: 'EN',
  nl: 'NL',
};

/**
 * Translate using DeepL API
 */
async function translateWithDeepL(
  text: string,
  sourceLang: string,
  targetLang: string,
  preserveHtml: boolean
): Promise<TranslateResponse> {
  const apiKey = Deno.env.get('DEEPL_API_KEY');
  if (!apiKey) {
    throw new Error('DEEPL_API_KEY not configured');
  }

  // DeepL free API uses api-free.deepl.com, pro uses api.deepl.com
  const baseUrl = apiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com'
    : 'https://api.deepl.com';

  const params = new URLSearchParams({
    text,
    target_lang: LANGUAGE_CODES[targetLang] || targetLang.toUpperCase(),
  });

  if (sourceLang !== 'auto') {
    params.append('source_lang', LANGUAGE_CODES[sourceLang] || sourceLang.toUpperCase());
  }

  if (preserveHtml) {
    params.append('tag_handling', 'html');
  }

  const response = await fetch(`${baseUrl}/v2/translate`, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepL API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const translation = data.translations[0];

  return {
    translatedText: translation.text,
    detectedLanguage: translation.detected_source_language?.toLowerCase(),
  };
}

/**
 * Translate using Google Cloud Translation API
 */
async function translateWithGoogle(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<TranslateResponse> {
  const apiKey = Deno.env.get('GOOGLE_TRANSLATE_API_KEY');
  if (!apiKey) {
    throw new Error('GOOGLE_TRANSLATE_API_KEY not configured');
  }

  const url = new URL('https://translation.googleapis.com/language/translate/v2');
  url.searchParams.set('key', apiKey);

  const body: Record<string, string> = {
    q: text,
    target: targetLang,
    format: 'html', // Preserve HTML tags
  };

  if (sourceLang !== 'auto') {
    body.source = sourceLang;
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Translate API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const translation = data.data.translations[0];

  return {
    translatedText: translation.translatedText,
    detectedLanguage: translation.detectedSourceLanguage,
  };
}

/**
 * Simple fallback translation using LibreTranslate (free, self-hosted option)
 */
async function translateWithLibre(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<TranslateResponse> {
  const apiUrl = Deno.env.get('LIBRETRANSLATE_URL') || 'https://libretranslate.com';
  const apiKey = Deno.env.get('LIBRETRANSLATE_API_KEY');

  const body: Record<string, string> = {
    q: text,
    source: sourceLang === 'auto' ? 'auto' : sourceLang,
    target: targetLang,
    format: 'html',
  };

  if (apiKey) {
    body.api_key = apiKey;
  }

  const response = await fetch(`${apiUrl}/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LibreTranslate API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  return {
    translatedText: data.translatedText,
    detectedLanguage: data.detectedLanguage?.language,
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, sourceLanguage, targetLanguage, preserveHtml = true }: TranslateRequest =
      await req.json();

    // Validate input
    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!targetLanguage || !['en', 'nl'].includes(targetLanguage)) {
      return new Response(
        JSON.stringify({ error: 'Target language must be "en" or "nl"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip translation if source and target are the same
    if (sourceLanguage !== 'auto' && sourceLanguage === targetLanguage) {
      return new Response(
        JSON.stringify({ translatedText: text, detectedLanguage: sourceLanguage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try translation providers in order of preference
    let result: TranslateResponse | null = null;
    let lastError: Error | null = null;

    // 1. Try DeepL first (best quality)
    if (Deno.env.get('DEEPL_API_KEY')) {
      try {
        result = await translateWithDeepL(text, sourceLanguage, targetLanguage, preserveHtml);
      } catch (e) {
        console.error('DeepL translation failed:', e);
        lastError = e as Error;
      }
    }

    // 2. Try Google Translate
    if (!result && Deno.env.get('GOOGLE_TRANSLATE_API_KEY')) {
      try {
        result = await translateWithGoogle(text, sourceLanguage, targetLanguage);
      } catch (e) {
        console.error('Google translation failed:', e);
        lastError = e as Error;
      }
    }

    // 3. Try LibreTranslate as fallback
    if (!result && (Deno.env.get('LIBRETRANSLATE_URL') || Deno.env.get('LIBRETRANSLATE_API_KEY'))) {
      try {
        result = await translateWithLibre(text, sourceLanguage, targetLanguage);
      } catch (e) {
        console.error('LibreTranslate failed:', e);
        lastError = e as Error;
      }
    }

    // If no translation service is configured or all failed
    if (!result) {
      const errorMsg = lastError
        ? `Translation failed: ${lastError.message}`
        : 'No translation service configured. Set DEEPL_API_KEY, GOOGLE_TRANSLATE_API_KEY, or LIBRETRANSLATE_URL in Supabase secrets.';

      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Translation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
