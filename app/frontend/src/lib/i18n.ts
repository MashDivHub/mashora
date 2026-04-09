/**
 * Internationalization (i18n) system for the Mashora ERP frontend.
 *
 * Loads translations from the backend API and provides a `t()` function
 * for translating UI strings. Falls back to the source string if no
 * translation is found.
 */
import { create } from 'zustand'

interface I18nState {
  lang: string
  translations: Record<string, string>
  loading: boolean
  setLang: (lang: string) => Promise<void>
  t: (key: string, defaultValue?: string) => string
  loadTranslations: (lang: string) => Promise<void>
}

export const useI18n = create<I18nState>((set, get) => ({
  lang: 'en_US',
  translations: {},
  loading: false,

  setLang: async (lang: string) => {
    set({ lang, loading: true })
    await get().loadTranslations(lang)
  },

  t: (key: string, defaultValue?: string) => {
    const { translations } = get()
    return translations[key] || defaultValue || key
  },

  loadTranslations: async (lang: string) => {
    try {
      set({ loading: true })
      const response = await fetch(`/api/v1/i18n/translations/${lang}`)
      if (response.ok) {
        const data = await response.json()
        set({ translations: data.translations || {}, loading: false })
      } else {
        set({ loading: false })
      }
    } catch (error) {
      console.warn('Failed to load translations for', lang, error)
      set({ loading: false })
    }
  },
}))

/**
 * Hook to get the translation function.
 * Usage: const t = useTranslation()
 *        <span>{t('Invoice', 'Invoice')}</span>
 */
export function useTranslation() {
  return useI18n((state) => state.t)
}

/**
 * Hook to get the current language and setter.
 */
export function useLanguage() {
  return useI18n((state) => ({ lang: state.lang, setLang: state.setLang, loading: state.loading }))
}
