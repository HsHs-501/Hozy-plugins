export type TranslationService = 'google' | 'microsoft' | 'brave';

export interface TranslationResult {
    translatedText: string;
    detectedSource?: string;
    serviceUsed: TranslationService;
}

export async function translateText(
    text: string,
    service: TranslationService,
    from: string,
    to: string
): Promise<TranslationResult> {
    const sourceLang = from === 'auto' ? 'auto' : from;
    const targetLang = to;

    try {
        // استخدام واجهة جوجل المفتوحة والتي تعمل بدون API Key وبدون قيود CORS على الجوال
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`خطأ في الشبكة: ${response.status}`);
        }

        const data = await response.json();
        let translatedText = '';
        let detectedSource = '';

        if (data && data[0]) {
            for (let i = 0; i < data[0].length; i++) {
                if (data[0][i][0]) {
                    translatedText += data[0][i][0];
                }
            }
        }

        if (data && data[2]) {
            detectedSource = data[2];
        }

        return {
            translatedText: translatedText.trim(),
            detectedSource,
            serviceUsed: 'google' 
        };
    } catch (error) {
        console.error("[Hozy's Translator] API Error:", error);
        throw new Error("فشل الاتصال بخادم الترجمة، حاول مرة أخرى.");
    }
}
