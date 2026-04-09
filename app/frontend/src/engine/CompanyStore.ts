import { create } from 'zustand'
import { erpClient } from '@/lib/erp-api'

interface CompanyState {
  companies: { id: number; name: string }[]
  currentCompanyId: number | null
  loading: boolean
  fetchCompanies: () => Promise<void>
  setCurrentCompany: (id: number) => void
}

export const useCompanyStore = create<CompanyState>((set, get) => ({
  companies: [],
  currentCompanyId: null,
  loading: false,

  fetchCompanies: async () => {
    set({ loading: true })
    try {
      const { data } = await erpClient.raw.post('/model/res.company', {
        fields: ['id', 'name'],
        limit: 100,
      })
      const companies = data.records || []
      const currentId = get().currentCompanyId || (companies.length > 0 ? companies[0].id : null)
      set({ companies, currentCompanyId: currentId, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  setCurrentCompany: (id: number) => {
    set({ currentCompanyId: id })
    // Store in localStorage for persistence
    localStorage.setItem('mashora_company_id', String(id))
  },
}))

// Initialize from localStorage
const storedCompanyId = localStorage.getItem('mashora_company_id')
if (storedCompanyId) {
  const parsed = parseInt(storedCompanyId, 10)
  if (!isNaN(parsed)) {
    useCompanyStore.setState({ currentCompanyId: parsed })
  }
}
