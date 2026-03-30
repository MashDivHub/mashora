import { useEffect, useState, useRef } from 'react'
import {
  getPublisherAddons,
  submitAddon,
  uploadVersion,
  AddonResponse,
  AddonVersionResponse,
} from '../api/addons'
import StarRating from '../components/StarRating'

const CATEGORIES = ['Accounting', 'CRM', 'Sales', 'HR', 'Website', 'Other']

function statusBadge(status: string): React.CSSProperties {
  const map: Record<string, { bg: string; color: string }> = {
    pending:  { bg: '#FEF3C7', color: '#92400E' },
    approved: { bg: '#DBEAFE', color: '#1E40AF' },
    published:{ bg: '#D1FAE5', color: '#065F46' },
    rejected: { bg: '#FEE2E2', color: '#991B1B' },
  }
  const style = map[status] ?? { bg: '#F3F4F6', color: '#374151' }
  return {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 600,
    background: style.bg,
    color: style.color,
  }
}

interface UploadFormState {
  version: string
  changelog: string
  file: File | null
}

export default function PublisherDashboard() {
  const [addons, setAddons] = useState<AddonResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Submit new addon form
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const [submitData, setSubmitData] = useState({
    technical_name: '',
    display_name: '',
    summary: '',
    description: '',
    category: CATEGORIES[0],
    price_cents: 0,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')
  const [submitError, setSubmitError] = useState('')

  // Upload version per addon (keyed by technical_name)
  const [uploadForms, setUploadForms] = useState<Record<string, UploadFormState>>({})
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [uploadMsg, setUploadMsg] = useState<Record<string, string>>({})
  const [uploadError, setUploadError] = useState<Record<string, string>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    getPublisherAddons()
      .then(setAddons)
      .catch(() => setError('Failed to load your addons.'))
      .finally(() => setLoading(false))
  }, [])

  function getUploadForm(name: string): UploadFormState {
    return uploadForms[name] ?? { version: '', changelog: '', file: null }
  }

  function setUploadFormField(name: string, field: keyof UploadFormState, value: string | File | null) {
    setUploadForms((prev) => ({
      ...prev,
      [name]: { ...getUploadForm(name), [field]: value },
    }))
  }

  async function handleSubmitAddon(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitMsg('')
    setSubmitError('')
    try {
      const newAddon = await submitAddon(submitData)
      setAddons((prev) => [newAddon, ...prev])
      setSubmitMsg('Addon submitted for review!')
      setShowSubmitForm(false)
      setSubmitData({ technical_name: '', display_name: '', summary: '', description: '', category: CATEGORIES[0], price_cents: 0 })
    } catch {
      setSubmitError('Failed to submit addon. Check all fields and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUploadVersion(technicalName: string, e: React.FormEvent) {
    e.preventDefault()
    const form = getUploadForm(technicalName)
    if (!form.file) return
    setUploadingFor(technicalName)
    setUploadMsg((prev) => ({ ...prev, [technicalName]: '' }))
    setUploadError((prev) => ({ ...prev, [technicalName]: '' }))
    try {
      const fd = new FormData()
      fd.append('version', form.version)
      fd.append('changelog', form.changelog)
      fd.append('file', form.file)
      const result: AddonVersionResponse = await uploadVersion(technicalName, fd)
      setUploadMsg((prev) => ({ ...prev, [technicalName]: `Version ${result.version} uploaded!` }))
      setUploadForms((prev) => ({ ...prev, [technicalName]: { version: '', changelog: '', file: null } }))
      if (fileInputRefs.current[technicalName]) {
        fileInputRefs.current[technicalName]!.value = ''
      }
    } catch {
      setUploadError((prev) => ({ ...prev, [technicalName]: 'Upload failed. Check the form and try again.' }))
    } finally {
      setUploadingFor(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: '#1E293B' }}>
            Publisher Dashboard
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
            Manage and publish your addons to the Mashora Marketplace
          </p>
        </div>
        <button
          onClick={() => { setShowSubmitForm((v) => !v); setSubmitMsg(''); setSubmitError('') }}
          style={{
            padding: '9px 18px',
            background: '#7C3AED',
            color: '#fff',
            border: 'none',
            borderRadius: '7px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showSubmitForm ? 'Cancel' : '+ Submit New Addon'}
        </button>
      </div>

      {/* Submit new addon form */}
      {showSubmitForm && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 18px', fontSize: '17px', fontWeight: 700, color: '#1E293B' }}>
            Submit New Addon
          </h2>
          <form onSubmit={handleSubmitAddon}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Technical Name *</label>
                <input
                  required
                  value={submitData.technical_name}
                  onChange={(e) => setSubmitData((p) => ({ ...p, technical_name: e.target.value }))}
                  placeholder="e.g. my_crm_addon"
                  style={inputStyle}
                />
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                  Lowercase, underscores only. Cannot be changed later.
                </div>
              </div>
              <div>
                <label style={labelStyle}>Display Name *</label>
                <input
                  required
                  value={submitData.display_name}
                  onChange={(e) => setSubmitData((p) => ({ ...p, display_name: e.target.value }))}
                  placeholder="e.g. My CRM Addon"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Category *</label>
                <select
                  value={submitData.category}
                  onChange={(e) => setSubmitData((p) => ({ ...p, category: e.target.value }))}
                  style={inputStyle}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Price (cents, 0 = Free)</label>
                <input
                  type="number"
                  min={0}
                  value={submitData.price_cents}
                  onChange={(e) => setSubmitData((p) => ({ ...p, price_cents: Number(e.target.value) }))}
                  placeholder="0"
                  style={inputStyle}
                />
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                  e.g. 999 = $9.99/month
                </div>
              </div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Summary *</label>
              <input
                required
                value={submitData.summary}
                onChange={(e) => setSubmitData((p) => ({ ...p, summary: e.target.value }))}
                placeholder="One-line description shown in marketplace cards"
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Description *</label>
              <textarea
                required
                value={submitData.description}
                onChange={(e) => setSubmitData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Full description shown on the addon detail page..."
                rows={5}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '9px 20px',
                  background: submitting ? '#C4B5FD' : '#7C3AED',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '7px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: submitting ? 'default' : 'pointer',
                }}
              >
                {submitting ? 'Submitting...' : 'Submit for Review'}
              </button>
              {submitMsg && <span style={{ fontSize: '13px', color: '#065F46' }}>{submitMsg}</span>}
              {submitError && <span style={{ fontSize: '13px', color: '#B91C1C' }}>{submitError}</span>}
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* Addons list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#6B7280' }}>Loading your addons...</div>
      ) : addons.length === 0 ? (
        <div style={{
          background: '#fff',
          border: '1px solid #E5E7EB',
          borderRadius: '10px',
          padding: '48px',
          textAlign: 'center',
          color: '#6B7280',
          fontSize: '15px',
        }}>
          You haven't submitted any addons yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {addons.map((addon) => {
            const form = getUploadForm(addon.technical_name)
            const isUploading = uploadingFor === addon.technical_name
            return (
              <div
                key={addon.id}
                style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}
              >
                {/* Addon header */}
                <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '8px',
                      background: addon.icon_url ? undefined : '#EDE9FE',
                      backgroundImage: addon.icon_url ? `url(${addon.icon_url})` : undefined,
                      backgroundSize: 'cover',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      flexShrink: 0,
                    }}
                  >
                    {!addon.icon_url && '🧩'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>{addon.display_name}</span>
                      <span style={statusBadge(addon.status)}>{addon.status}</span>
                      <span style={{ fontSize: '12px', color: '#6B7280' }}>v{addon.version}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#4B5563', marginBottom: '8px' }}>{addon.summary}</div>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                      {/* Analytics */}
                      <div style={statBox}>
                        <div style={statValue}>{addon.download_count.toLocaleString()}</div>
                        <div style={statLabel}>Downloads</div>
                      </div>
                      <div style={statBox}>
                        <div style={{ ...statValue, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <StarRating rating={addon.rating_avg} readonly size={14} />
                          <span>{addon.rating_avg.toFixed(1)}</span>
                        </div>
                        <div style={statLabel}>{addon.rating_count} reviews</div>
                      </div>
                      <div style={statBox}>
                        <div style={statValue}>
                          {addon.price_cents === 0 ? 'Free' : `$${(addon.price_cents / 100).toFixed(2)}/mo`}
                        </div>
                        <div style={statLabel}>Price</div>
                      </div>
                      <div style={statBox}>
                        <div style={statValue}>{addon.category}</div>
                        <div style={statLabel}>Category</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upload version section */}
                <div style={{ borderTop: '1px solid #F3F4F6', background: '#F9FAFB', padding: '16px 20px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
                    Upload New Version
                  </div>
                  <form onSubmit={(e) => handleUploadVersion(addon.technical_name, e)}>
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div>
                        <label style={labelStyle}>Version *</label>
                        <input
                          required
                          value={form.version}
                          onChange={(e) => setUploadFormField(addon.technical_name, 'version', e.target.value)}
                          placeholder="e.g. 1.2.0"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Changelog</label>
                        <input
                          value={form.changelog}
                          onChange={(e) => setUploadFormField(addon.technical_name, 'changelog', e.target.value)}
                          placeholder="What changed in this version..."
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={labelStyle}>Addon File (.zip) *</label>
                      <input
                        type="file"
                        accept=".zip"
                        required
                        ref={(el) => { fileInputRefs.current[addon.technical_name] = el }}
                        onChange={(e) => setUploadFormField(addon.technical_name, 'file', e.target.files?.[0] ?? null)}
                        style={{ fontSize: '13px', display: 'block' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        type="submit"
                        disabled={isUploading || !form.file}
                        style={{
                          padding: '7px 16px',
                          background: isUploading || !form.file ? '#C4B5FD' : '#7C3AED',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: isUploading || !form.file ? 'default' : 'pointer',
                        }}
                      >
                        {isUploading ? 'Uploading...' : 'Upload Version'}
                      </button>
                      {uploadMsg[addon.technical_name] && (
                        <span style={{ fontSize: '13px', color: '#065F46' }}>{uploadMsg[addon.technical_name]}</span>
                      )}
                      {uploadError[addon.technical_name] && (
                        <span style={{ fontSize: '13px', color: '#B91C1C' }}>{uploadError[addon.technical_name]}</span>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid #D1D5DB',
  fontSize: '13px',
  background: '#fff',
  boxSizing: 'border-box',
  outline: 'none',
}

const statBox: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
}

const statValue: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#1E293B',
}

const statLabel: React.CSSProperties = {
  fontSize: '11px',
  color: '#9CA3AF',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
}
