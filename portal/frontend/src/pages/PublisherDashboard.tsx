import { useEffect, useRef, useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import { getPublisherAddons, submitAddon, uploadVersion, type AddonResponse, type AddonVersionResponse } from '../api/addons'
import StarRating from '../components/StarRating'
import { Notice } from '@/components/app/notice'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const categories = ['Accounting', 'CRM', 'Sales', 'HR', 'Website', 'Other']

interface UploadFormState {
  version: string
  changelog: string
  file: File | null
}

export default function PublisherDashboard() {
  const [addons, setAddons] = useState<AddonResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const [submitData, setSubmitData] = useState({
    technical_name: '',
    display_name: '',
    summary: '',
    description: '',
    category: categories[0],
    price_cents: 0,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')
  const [submitError, setSubmitError] = useState('')
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
      setSubmitMsg('Addon submitted for review.')
      setShowSubmitForm(false)
      setSubmitData({
        technical_name: '',
        display_name: '',
        summary: '',
        description: '',
        category: categories[0],
        price_cents: 0,
      })
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
      const formData = new FormData()
      formData.append('version', form.version)
      formData.append('changelog', form.changelog)
      formData.append('file', form.file)
      const result: AddonVersionResponse = await uploadVersion(technicalName, formData)
      setUploadMsg((prev) => ({ ...prev, [technicalName]: `Version ${result.version} uploaded.` }))
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
    <div className="space-y-8">
      <PageHeader
        eyebrow="Publisher"
        title="Publish and iterate on addons"
        description="Submit new marketplace packages, track approval status, and push fresh versions through a cleaner workflow."
        actions={
          <Button
            className="w-full rounded-2xl sm:w-auto"
            onClick={() => {
              setShowSubmitForm((value) => !value)
              setSubmitMsg('')
              setSubmitError('')
            }}
          >
            <Plus className="size-4" />
            {showSubmitForm ? 'Hide form' : 'Submit addon'}
          </Button>
        }
      />

      {submitMsg ? <Notice tone="success">{submitMsg}</Notice> : null}
      {submitError ? <Notice tone="danger">{submitError}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {showSubmitForm ? (
        <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
          <form onSubmit={handleSubmitAddon} className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="technicalName">Technical name</Label>
                <Input
                  id="technicalName"
                  required
                  value={submitData.technical_name}
                  onChange={(e) => setSubmitData((prev) => ({ ...prev, technical_name: e.target.value }))}
                  placeholder="my_crm_addon"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  required
                  value={submitData.display_name}
                  onChange={(e) => setSubmitData((prev) => ({ ...prev, display_name: e.target.value }))}
                  placeholder="My CRM Addon"
                />
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-2">
                <Label htmlFor="addonSummary">Summary</Label>
                <Input
                  id="addonSummary"
                  required
                  value={submitData.summary}
                  onChange={(e) => setSubmitData((prev) => ({ ...prev, summary: e.target.value }))}
                  placeholder="One-line description shown in marketplace cards"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={submitData.category} onValueChange={(value) => setSubmitData((prev) => ({ ...prev, category: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-2">
                <Label htmlFor="addonDescription">Description</Label>
                <Textarea
                  id="addonDescription"
                  required
                  value={submitData.description}
                  onChange={(e) => setSubmitData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Full marketplace description..."
                  rows={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addonPrice">Price (cents)</Label>
                <Input
                  id="addonPrice"
                  type="number"
                  min={0}
                  value={submitData.price_cents}
                  onChange={(e) => setSubmitData((prev) => ({ ...prev, price_cents: Number(e.target.value) }))}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit for review'}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-border/70 bg-card/90 p-6 text-sm text-muted-foreground">Loading your addons...</div>
      ) : addons.length === 0 ? (
        <div className="rounded-3xl border border-border/70 bg-card/90 p-6 text-sm text-muted-foreground">
          You have not submitted any addons yet.
        </div>
      ) : (
        <div className="space-y-6">
          {addons.map((addon) => {
            const form = getUploadForm(addon.technical_name)
            const isUploading = uploadingFor === addon.technical_name
            return (
              <div key={addon.id} className="rounded-3xl border border-border/70 bg-card/90 p-6">
                <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] 2xl:items-start">
                  <div className="min-w-0 space-y-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="flex size-16 items-center justify-center rounded-3xl border border-border/70 bg-muted/60 text-xl"
                        style={addon.icon_url ? { backgroundImage: `url(${addon.icon_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                      >
                        {!addon.icon_url ? 'A' : null}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-semibold">{addon.display_name}</h2>
                          <StatusBadge value={addon.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">{addon.summary}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                      <MetricCard label="Downloads" value={addon.download_count.toLocaleString()} />
                      <MetricCard
                        label="Rating"
                        value={
                          <div className="flex items-center gap-2">
                            <StarRating rating={addon.rating_avg} readonly size={15} />
                            <span className="font-semibold">{addon.rating_avg.toFixed(1)}</span>
                          </div>
                        }
                      />
                      <MetricCard label="Price" value={addon.price_cents === 0 ? 'Free' : `$${(addon.price_cents / 100).toFixed(2)}/mo`} />
                      <MetricCard label="Category" value={addon.category} />
                    </div>
                  </div>

                  <div className="w-full min-w-0 rounded-3xl border border-border/70 bg-background/60 p-5 2xl:max-w-xl">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="rounded-2xl border border-border/70 bg-muted/60 p-3">
                        <Upload className="size-4" />
                      </div>
                      <div>
                        <div className="font-semibold">Upload new version</div>
                        <div className="text-sm text-muted-foreground">Ship changelog and package updates.</div>
                      </div>
                    </div>

                    <form onSubmit={(e) => handleUploadVersion(addon.technical_name, e)} className="space-y-4">
                      <div className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)]">
                        <div className="space-y-2">
                          <Label htmlFor={`version-${addon.technical_name}`}>Version</Label>
                          <Input
                            id={`version-${addon.technical_name}`}
                            required
                            value={form.version}
                            onChange={(e) => setUploadFormField(addon.technical_name, 'version', e.target.value)}
                            placeholder="1.2.0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`changelog-${addon.technical_name}`}>Changelog</Label>
                          <Input
                            id={`changelog-${addon.technical_name}`}
                            value={form.changelog}
                            onChange={(e) => setUploadFormField(addon.technical_name, 'changelog', e.target.value)}
                            placeholder="What changed in this release..."
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`file-${addon.technical_name}`}>Addon package (.zip)</Label>
                        <Input
                          id={`file-${addon.technical_name}`}
                          type="file"
                          accept=".zip"
                          required
                          ref={(el) => { fileInputRefs.current[addon.technical_name] = el }}
                          onChange={(e) => setUploadFormField(addon.technical_name, 'file', e.target.files?.[0] ?? null)}
                        />
                      </div>

                      {uploadMsg[addon.technical_name] ? <Notice tone="success">{uploadMsg[addon.technical_name]}</Notice> : null}
                      {uploadError[addon.technical_name] ? <Notice tone="danger">{uploadError[addon.technical_name]}</Notice> : null}

                      <div className="flex justify-end">
                        <Button type="submit" disabled={isUploading || !form.file}>
                          {isUploading ? 'Uploading...' : 'Upload version'}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  )
}
