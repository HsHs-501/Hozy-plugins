export interface LanguageItem {
    code: string;
    name: string;
}

export const SOURCE_LANGUAGES: LanguageItem[] = [
    { code: 'auto', name: 'Auto Detect' },
    { code: 'ar', name: 'Arabic' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ru', name: 'Russian' },
    { code: 'tr', name: 'Turkish' },
    { code: 'tl', name: 'Tagalog' },
];

export const TARGET_LANGUAGES: LanguageItem[] = SOURCE_LANGUAGES.filter(l => l.code !== 'auto');

export function getLanguageName(code: string): string {
    const lang = SOURCE_LANGUAGES.find(l => l.code === code);
    return lang ? lang.name : code;
}
