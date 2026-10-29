export type TranslationService = 'google' | 'microsoft' | 'brave'

export interface TranslationResult {
	translatedText: string
	detectedSource?: string
	serviceUsed: TranslationService
}

let cachedEdgeToken: string | null = null
let edgeTokenExpiry = 0

async function getEdgeAuthToken(): Promise<string> {
	const now = Date.now()
	if (cachedEdgeToken && now < edgeTokenExpiry) return cachedEdgeToken

	const res = await fetch('https://edge.microsoft.com/translate/auth', {
		method: 'GET',
		headers: {
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
		},
	})

	if (!res.ok) throw new Error(`Edge auth failed (${res.status})`)

	const token = await res.text()
	if (!token?.trim()) throw new Error('Empty token from Edge auth')

	cachedEdgeToken = token.trim()
	edgeTokenExpiry = now + 9 * 60 * 1000
	return cachedEdgeToken
}

async function translateGoogle(text: string, from: string, to: string): Promise<TranslationResult> {
	const sl = from === 'auto' ? 'auto' : from
	const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`

	const res = await fetch(url, { headers: { Accept: 'application/json' } })
	if (!res.ok) throw new Error(`Google Translate error (${res.status})`)

	const data = await res.json()
	if (!Array.isArray(data) || !Array.isArray(data[0]))
		throw new Error('Unexpected Google Translate response format')

	const translatedText = data[0]
		.map((part: any) => (Array.isArray(part) && part[0] ? part[0] : ''))
		.join('')

	return {
		translatedText: translatedText.trim(),
		detectedSource: typeof data[2] === 'string' ? data[2] : undefined,
		serviceUsed: 'google',
	}
}

async function translateMicrosoft(
	text: string,
	from: string,
	to: string,
	retry = true,
): Promise<TranslationResult> {
	const token = await getEdgeAuthToken()

	let url = `https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${encodeURIComponent(to)}`
	if (from !== 'auto') url += `&from=${encodeURIComponent(from)}`

	const res = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify([{ Text: text }]),
	})

	if (res.status === 401 && retry) {
		cachedEdgeToken = null
		return translateMicrosoft(text, from, to, false)
	}

	if (!res.ok) throw new Error(`Microsoft Translate error (${res.status})`)

	const data = await res.json()
	const translation = data?.[0]?.translations?.[0]
	if (!translation) throw new Error('Unexpected Microsoft Translate response')

	return {
		translatedText: translation.text?.trim() ?? '',
		detectedSource: data[0]?.detectedLanguage?.language,
		serviceUsed: 'microsoft',
	}
}

async function translateBrave(text: string, from: string, to: string): Promise<TranslationResult> {
	const body: Record<string, string> = { q: text, target: to }
	if (from !== 'auto') body.source = from

	const res = await fetch('https://translate.brave.com/translate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})

	if (!res.ok) throw new Error(`Brave Translate error (${res.status})`)

	const data = await res.json()
	const translatedText = data?.translatedText ?? data?.text ?? ''
	if (!translatedText) throw new Error('Unexpected Brave Translate response')

	return {
		translatedText: translatedText.trim(),
		detectedSource: data?.detectedSourceLanguage,
		serviceUsed: 'brave',
	}
}

export async function translateText(
	text: string,
	service: TranslationService,
	from: string,
	to: string,
): Promise<TranslationResult> {
	switch (service) {
		case 'microsoft':
			return translateMicrosoft(text, from, to)
		case 'brave':
			return translateBrave(text, from, to)
		case 'google':
		default:
			return translateGoogle(text, from, to)
	}
}
