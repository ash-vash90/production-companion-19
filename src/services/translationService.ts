/**
 * Translation Service
 *
 * Provides auto-translation for work instructions content.
 * Uses Supabase Edge Function for translation API calls.
 */

import { supabase } from '@/integrations/supabase/client';

export type SupportedLanguage = 'en' | 'nl';

interface TranslationResult {
  text: string;
  detectedLanguage?: string;
}

interface TranslateOptions {
  from?: SupportedLanguage | 'auto';
  to: SupportedLanguage;
  preserveHtml?: boolean;
}

/**
 * Translate text from one language to another
 * Uses Supabase Edge Function which can integrate with various translation APIs
 */
export async function translateText(
  text: string,
  options: TranslateOptions
): Promise<TranslationResult> {
  const { from = 'auto', to, preserveHtml = true } = options;

  // Don't translate empty text
  if (!text || text.trim() === '') {
    return { text: '' };
  }

  // Don't translate if source and target are the same
  if (from !== 'auto' && from === to) {
    return { text };
  }

  try {
    const { data, error } = await supabase.functions.invoke('translate', {
      body: {
        text,
        sourceLanguage: from,
        targetLanguage: to,
        preserveHtml,
      },
    });

    if (error) {
      console.error('Translation error:', error);
      throw new Error(`Translation failed: ${error.message}`);
    }

    return {
      text: data.translatedText,
      detectedLanguage: data.detectedLanguage,
    };
  } catch (error) {
    console.error('Translation service error:', error);
    // Return original text if translation fails
    return { text };
  }
}

/**
 * Translate work instruction content
 * Handles the specific fields used in instruction steps
 */
export async function translateInstructionContent(
  content: {
    title: string;
    content: string;
    warningText?: string;
    tipText?: string;
  },
  sourceLanguage: SupportedLanguage,
  targetLanguage: SupportedLanguage
): Promise<{
  title: string;
  content: string;
  warningText: string;
  tipText: string;
}> {
  // Translate all fields in parallel
  const [titleResult, contentResult, warningResult, tipResult] = await Promise.all([
    translateText(content.title, { from: sourceLanguage, to: targetLanguage }),
    translateText(content.content, { from: sourceLanguage, to: targetLanguage, preserveHtml: true }),
    content.warningText
      ? translateText(content.warningText, { from: sourceLanguage, to: targetLanguage, preserveHtml: true })
      : Promise.resolve({ text: '' }),
    content.tipText
      ? translateText(content.tipText, { from: sourceLanguage, to: targetLanguage, preserveHtml: true })
      : Promise.resolve({ text: '' }),
  ]);

  return {
    title: titleResult.text,
    content: contentResult.text,
    warningText: warningResult.text,
    tipText: tipResult.text,
  };
}

/**
 * Batch translate multiple text items
 */
export async function translateBatch(
  texts: string[],
  options: TranslateOptions
): Promise<string[]> {
  const results = await Promise.all(
    texts.map((text) => translateText(text, options))
  );
  return results.map((r) => r.text);
}

/**
 * Detect the language of a text
 */
export async function detectLanguage(text: string): Promise<SupportedLanguage | null> {
  if (!text || text.trim() === '') {
    return null;
  }

  try {
    const { data, error } = await supabase.functions.invoke('detect-language', {
      body: { text },
    });

    if (error) {
      console.error('Language detection error:', error);
      return null;
    }

    return data.language as SupportedLanguage;
  } catch (error) {
    console.error('Language detection service error:', error);
    return null;
  }
}

/**
 * Check if translation service is available
 */
export async function isTranslationAvailable(): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('translate', {
      body: { text: 'test', sourceLanguage: 'en', targetLanguage: 'nl' },
    });
    return !error;
  } catch {
    return false;
  }
}
