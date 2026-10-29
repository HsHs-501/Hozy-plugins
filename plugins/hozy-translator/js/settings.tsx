import { useState } from 'react'
import { Design } from '@valenced/discord/design'
import { Page } from '@valenced/components'
import type { TranslationService } from './translator'
import { SOURCE_LANGUAGES, TARGET_LANGUAGES, getLanguageName } from './languages'
import { LanguagePickerModal } from './picker'

export interface TranslatorSettings {
	service: TranslationService
	fromLanguage: string
	toLanguage: string
}

export const DEFAULT_SETTINGS: TranslatorSettings = {
	service: 'google',
	fromLanguage: 'auto',
	toLanguage: 'ar',
}

interface SettingsProps {
	api: {
		jsonStorage: {
			use(): TranslatorSettings | null
			set(s: Partial<TranslatorSettings>): void
		}
	}
}

export function SettingsComponent({ api }: SettingsProps) {
	const s = api.jsonStorage.use() ?? DEFAULT_SETTINGS
	const [pickerType, setPickerType] = useState<'from' | 'to' | null>(null)

	const service = s.service ?? 'google'
	const fromLang = s.fromLanguage ?? 'auto'
	const toLang = s.toLanguage ?? 'ar'

	return (
		<Page>
			<Design.TableRowGroup title="Translation Engine">
				<Design.TableRadioGroup
					value={service}
					onChange={(val: TranslationService) => api.jsonStorage.set({ service: val })}
				>
					<Design.TableRadioRow
						label="Google Translate"
						subLabel="Free & fast — no API key needed"
						value="google"
						selected={service === 'google'}
						onPress={() => api.jsonStorage.set({ service: 'google' })}
					/>
					<Design.TableRadioRow
						label="Microsoft Translator"
						subLabel="Powered by Edge Translator"
						value="microsoft"
						selected={service === 'microsoft'}
						onPress={() => api.jsonStorage.set({ service: 'microsoft' })}
					/>
					<Design.TableRadioRow
						label="Brave Translate"
						subLabel="Experimental Brave Translate API"
						value="brave"
						selected={service === 'brave'}
						onPress={() => api.jsonStorage.set({ service: 'brave' })}
					/>
				</Design.TableRadioGroup>
			</Design.TableRowGroup>

			<Design.TableRowGroup title="Languages">
				<Design.TableRow
					label="Translate From"
					subLabel={getLanguageName(fromLang)}
					arrow
					onPress={() => setPickerType('from')}
				/>
				<Design.TableRow
					label="Translate To"
					subLabel={getLanguageName(toLang)}
					arrow
					onPress={() => setPickerType('to')}
				/>
			</Design.TableRowGroup>

			{pickerType === 'from' && (
				<LanguagePickerModal
					visible
					title="Source Language"
					languages={SOURCE_LANGUAGES}
					selectedCode={fromLang}
					onSelect={code => api.jsonStorage.set({ fromLanguage: code })}
					onClose={() => setPickerType(null)}
				/>
			)}

			{pickerType === 'to' && (
				<LanguagePickerModal
					visible
					title="Target Language"
					languages={TARGET_LANGUAGES}
					selectedCode={toLang}
					onSelect={code => api.jsonStorage.set({ toLanguage: code })}
					onClose={() => setPickerType(null)}
				/>
			)}
		</Page>
	)
}
