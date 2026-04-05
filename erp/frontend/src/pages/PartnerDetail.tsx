import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PageHeader, Button, Badge, Skeleton, Input, Label, CardTitle,
} from '@mashora/design-system'
import { ArrowLeft, Mail, Phone, MapPin, Building2, User, Smartphone } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

function InfoRow({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="leading-relaxed">{children}</span>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

export default function PartnerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = id === 'new'

  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formIsCompany, setFormIsCompany] = useState(false)

  const createMut = useMutation({
    mutationFn: (vals: Record<string, any>) =>
      erpClient.raw.post('/partners', vals).then((r) => r.data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['partner'] })
      navigate(`/partners/${result.id}`, { replace: true })
    },
  })

  const { data: partner, isLoading } = useQuery({
    queryKey: ['partner', id],
    queryFn: () => erpClient.get('res.partner', Number(id)),
    enabled: !isNew,
  })

  // ── Create mode ──
  if (isNew) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Contacts</p>
          <h1 className="text-2xl font-bold tracking-tight">New Contact</h1>
        </div>
        <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
            <CardTitle>Contact Details</CardTitle>
          </div>
          <div className="p-6 space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" placeholder="Full name or company name" value={formName} onChange={(e) => setFormName(e.target.value)} className="rounded-2xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-email">Email</Label>
              <Input id="p-email" type="email" placeholder="email@example.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="rounded-2xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-phone">Phone</Label>
              <Input id="p-phone" type="tel" placeholder="+1 555 000 0000" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="rounded-2xl" />
            </div>
            <div className="flex items-center gap-3">
              <input
                id="p-company"
                type="checkbox"
                checked={formIsCompany}
                onChange={(e) => setFormIsCompany(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <Label htmlFor="p-company">Is a Company</Label>
            </div>
          </div>
          <div className="border-t border-border/60 bg-muted/20 px-6 py-4 flex gap-2">
            <Button
              onClick={() => createMut.mutate({ name: formName, email: formEmail || undefined, phone: formPhone || undefined, is_company: formIsCompany })}
              disabled={createMut.isPending || !formName}
              className="rounded-2xl"
            >
              {createMut.isPending ? 'Creating…' : 'Create Contact'}
            </Button>
            <Button variant="outline" className="rounded-2xl" onClick={() => navigate('/partners')}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-3xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
        <Skeleton className="h-32 w-full rounded-3xl" />
      </div>
    )
  }

  if (!partner) {
    return <div className="text-muted-foreground">Partner not found.</div>
  }

  const isCompany = partner.is_company
  const isActive = partner.active

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isCompany ? 'Company' : 'Individual'}
        title={partner.name || 'Unnamed'}
        actions={
          <Button variant="outline" onClick={() => navigate('/partners')} className="rounded-2xl">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        }
      />

      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={isCompany ? 'default' : 'secondary'}
          className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
        >
          {isCompany ? 'Company' : 'Individual'}
        </Badge>
        <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1">
          <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
          <span className="text-[11px] font-semibold text-muted-foreground">
            {isActive ? 'Active' : 'Archived'}
          </span>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Contact Information */}
        <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="border-b border-border/70 bg-muted/20 px-6 py-4 flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-border/60 bg-muted/40">
              {isCompany
                ? <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                : <User className="h-3.5 w-3.5 text-muted-foreground" />
              }
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Contact Information
            </p>
          </div>
          <div className="p-6 space-y-4">
            {partner.email && (
              <InfoRow icon={Mail}>
                <a
                  href={`mailto:${partner.email}`}
                  className="hover:underline underline-offset-4"
                >
                  {partner.email}
                </a>
              </InfoRow>
            )}
            {partner.phone && (
              <InfoRow icon={Phone}>
                <a
                  href={`tel:${partner.phone}`}
                  className="hover:underline underline-offset-4 font-mono"
                >
                  {partner.phone}
                </a>
              </InfoRow>
            )}
            {partner.mobile && (
              <InfoRow icon={Smartphone}>
                <a
                  href={`tel:${partner.mobile}`}
                  className="hover:underline underline-offset-4 font-mono"
                >
                  {partner.mobile}
                </a>
              </InfoRow>
            )}
            {!partner.email && !partner.phone && !partner.mobile && (
              <p className="text-sm text-muted-foreground italic">No contact details recorded.</p>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="border-b border-border/70 bg-muted/20 px-6 py-4 flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-border/60 bg-muted/40">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Address
            </p>
          </div>
          <div className="p-6 space-y-2 text-sm">
            {partner.street && (
              <InfoRow icon={MapPin}>
                <span>
                  {partner.street}
                  {partner.street2 && <><br />{partner.street2}</>}
                </span>
              </InfoRow>
            )}
            {(partner.city || partner.zip) && (
              <p className="pl-7 text-muted-foreground">
                {[partner.city, partner.zip].filter(Boolean).join(' ')}
              </p>
            )}
            {partner.country_id && (
              <p className="pl-7 text-muted-foreground">
                {Array.isArray(partner.country_id) ? partner.country_id[1] : partner.country_id}
              </p>
            )}
            {!partner.street && !partner.city && !partner.country_id && (
              <p className="text-sm text-muted-foreground italic">No address recorded.</p>
            )}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
        <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Details</p>
        </div>
        <div className="p-6">
          <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <DetailRow
              label="Type"
              value={
                <Badge
                  variant={isCompany ? 'default' : 'secondary'}
                  className="rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                >
                  {isCompany ? 'Company' : 'Individual'}
                </Badge>
              }
            />
            <DetailRow
              label="Status"
              value={
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                  <span>{isActive ? 'Active' : 'Archived'}</span>
                </div>
              }
            />
            {partner.company_id && (
              <DetailRow
                label="Company"
                value={Array.isArray(partner.company_id) ? partner.company_id[1] : partner.company_id}
              />
            )}
            {partner.lang && (
              <DetailRow label="Language" value={partner.lang} />
            )}
            {partner.website && (
              <DetailRow
                label="Website"
                value={
                  <a
                    href={partner.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline underline-offset-4 text-sm"
                  >
                    {partner.website}
                  </a>
                }
              />
            )}
            {partner.vat && (
              <DetailRow label="Tax ID" value={<span className="font-mono text-sm">{partner.vat}</span>} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
