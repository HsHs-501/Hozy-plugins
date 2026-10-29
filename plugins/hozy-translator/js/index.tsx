import { lookupModule, lookupModules } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { before, after } from '@valenced/patcher'
import { afterJSX } from '@valenced/react/jsx-runtime'
import { Design } from '@valenced/discord/design'
import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { TableRowAssetIcon } from '@valenced/components'
import { definePlugin } from '@valenced/plugin'
import React from 'react'

import { translateText, type TranslationService } from './translator'
import { getLanguageName } from './languages'
import { SettingsComponent, DEFAULT_SETTINGS, type TranslatorSettings } from './settings'

// ─── Ephemeral (local) message ───────────────────────────────────────────────

function sendEphemeralMessage(channelId: string, content: string) {
	try {
		const mod = lookupModule(withProps('receiveMessage', 'createBotMessage'))
		if (mod?.createBotMessage && mod?.receiveMessage) {
			mod.receiveMessage(channelId, mod.createBotMessage({ channelId, content, loggingName: "Hozy's Translator" }))
			return
		}

		const botMod = lookupModule(withProps('createBotMessage'))
		const recvMod = lookupModule(withProps('receiveMessage'))
		if (botMod?.createBotMessage && recvMod?.receiveMessage) {
			recvMod.receiveMessage(channelId, botMod.createBotMessage({ channelId, content, loggingName: "Hozy's Translator" }))
			return
		}

		const dispatcher =
			lookupModule(withProps('dispatch', 'isDispatching')) ??
			lookupModule(withProps('flushWaitQueue'))

		if (dispatcher?.dispatch) {
			// ID رقمي صالح ليقبله نظام ديسكورد الداخلي
			const fakeSnowflake = "99999" + Date.now().toString();

			dispatcher.dispatch({
				type: 'MESSAGE_CREATE',
				channelId,
				message: {
					id: fakeSnowflake,
					channel_id: channelId,
					content,
					timestamp: new Date().toISOString(),
					author: { id: '1', username: "Hozy's Translator", discriminator: '0000', bot: true },
					flags: 64, // رسالة مخفية لك فقط
					attachments: [],
					embeds: [],
					mentions: [],
					pinned: false,
					mention_everyone: false,
					tts: false
				},
				optimistic: false,
				isPushNotification: false
			})
		}
	} catch (err) {
		console.error("[Hozy's Translator] Error:", err)
	}
}

// ─── Core translate handler ───────────────────────────────────────────────────

async function handleTranslate(message: any, channelId: string, settings: TranslatorSettings) {
	const text =
		typeof message === 'string'
			? message
			: (message?.content ?? message?.message?.content ?? '')

	if (!text.trim()) {
		sendEphemeralMessage(channelId, '⚠️ **[Hozy\'s Translator]** لا يوجد نص لترجمته.')
		return
	}

	const service: TranslationService = settings.service ?? 'google'
	const from = settings.fromLanguage ?? 'auto'
	const to = settings.toLanguage ?? 'ar'

	try {
		const result = await translateText(text, service, from, to)

		const engineLabel: Record<TranslationService, string> = {
			google: 'Google',
			microsoft: 'Microsoft',
			brave: 'Brave',
		}

		const fromLabel =
			result.detectedSource && result.detectedSource !== from
				? `${getLanguageName(result.detectedSource)}`
				: getLanguageName(from)

		sendEphemeralMessage(
			channelId,
			`🌐 **[Hozy's Translator]** (${fromLabel} ➔ ${getLanguageName(to)})\n\n${result.translatedText}`,
		)
	} catch (err: any) {
		sendEphemeralMessage(
			channelId,
			`❌ **[Hozy's Translator Error]** ${err?.message ?? String(err)}`,
		)
	}
}

// ─── Plugin entry ─────────────────────────────────────────────────────────────

export default definePlugin<{ jsonStorage: TranslatorSettings }>({
	jsonStorage: {
		load: true,
		default: DEFAULT_SETTINGS,
	},

	start({ cleanup, jsonStorage, logger }) {
		logger?.log("Hozy's Translator started")

		const getSettings = (): TranslatorSettings => jsonStorage.cache ?? DEFAULT_SETTINGS

		if (typeof ActionSheetActionCreators?.openLazy === 'function') {
			cleanup(
				before(ActionSheetActionCreators, 'openLazy', (args: any[]) => {
					try {
						const [componentLoader, key, props] = args
						const isMessageSheet =
							key === 'MessageLongPressActionSheet' ||
							key === 'MessageActions' ||
							key === 'MessageContextMenu' ||
							Boolean(props?.message)

						if (!isMessageSheet || typeof componentLoader !== 'function') return args

						const wrappedLoader = () => {
							const res = componentLoader()
							const promise = typeof res?.then === 'function' ? res : Promise.resolve(res)

							return promise.then((mod: any) => {
								const Original = mod?.default ?? (typeof mod === 'function' ? mod : null)
								if (!Original) return mod

								const Patched = (sheetProps: any) => {
									const rendered = Original(sheetProps)
									const message =
										sheetProps?.message ?? props?.message ?? sheetProps?.targetMessage
									const channelId =
										sheetProps?.channel?.id ??
										props?.channel?.id ??
										message?.channel_id ??
										message?.channelId

									if (message && channelId && rendered?.props) {
										const translateRow = (
											<Design.ActionSheetRow
												key="hozy-translate-action"
												label="Translate"
												icon={<TableRowAssetIcon name="TranslateIcon" />}
												onPress={() => {
													ActionSheetActionCreators?.hideActionSheet?.(key)
													handleTranslate(message, channelId, getSettings())
												}}
											/>
										)

										const children = rendered.props.children
										const childrenArray = Array.isArray(children) ? children : [children].filter(Boolean)

										return React.cloneElement(rendered, {}, [...childrenArray, translateRow])
									}
									return rendered
								}
								return mod?.default ? { ...mod, default: Patched } : Patched
							})
						}
						return [wrappedLoader, key, props]
					} catch {
						return args
					}
				}),
			)
		}

		try {
			for (const mod of lookupModules(withProps('useMessageActions'))) {
				if (typeof mod?.useMessageActions !== 'function') continue
				cleanup(
					after(mod, 'useMessageActions', (args: any[], ret: any) => {
						try {
							if (!Array.isArray(ret)) return ret
							const msg = args[0]?.message ?? args[0];
							const ch = args[0]?.channel ?? args[1];
							
							if (!msg) return ret;
							const channelId = ch?.id ?? msg?.channel_id ?? msg?.channelId;

							return [
								...ret,
								{
									label: 'Translate',
									icon: 'TranslateIcon',
									onPress: () => {
										handleTranslate(msg, channelId, getSettings());
									},
								},
							]
						} catch {
							return ret
						}
					}),
				)
			}
		} catch { }

		if (Design?.ActionSheet) {
			try {
				cleanup(
					afterJSX(Design.ActionSheet, (element: any) => {
						try {
							const sheetProps = element?.props
							const message = sheetProps?.message ?? sheetProps?.targetMessage
							const channelId =
								sheetProps?.channel?.id ??
								message?.channel_id ??
								message?.channelId

							if (!message || !channelId) return element

							const translateRow = (
								<Design.ActionSheetRow
									key="hozy-translate-jsx"
									label="Translate"
									icon={<TableRowAssetIcon name="TranslateIcon" />}
									onPress={() => handleTranslate(message, channelId, getSettings())}
								/>
							)

							const children = element?.props?.children
							const newChildren = Array.isArray(children)
								? [...children, translateRow]
								: children ? [children, translateRow] : [translateRow]

							return React.cloneElement(element, {}, newChildren)
						} catch {
							return element
						}
					}),
				)
			} catch { }
		}
	},

	SettingsComponent({ api }) {
		return <SettingsComponent api={api} />
	},
})
