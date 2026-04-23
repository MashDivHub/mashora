import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@mashora/design-system'
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Check,
  Send,
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Youtube,
  Send as SendIcon,
  ArrowRight,
} from 'lucide-react'
import { toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

// ---------- Types ----------
type Topic = 'general' | 'sales' | 'support' | 'partnership'

interface ContactForm {
  name: string
  email: string
  company: string
  topic: Topic
  message: string
}

interface FieldErrors {
  name?: string
  email?: string
  message?: string
}

interface ContactInfo {
  company: {
    id?: number
    name?: string
    email?: string | false
    phone?: string | false
    mobile?: string | false
    street?: string | false
    street2?: string | false
    city?: string | false
    zip?: string | false
    state_id?: [number, string] | false
    country_id?: [number, string] | false
    website?: string | false
  } | null
  social: {
    facebook?: string | null
    twitter?: string | null
    instagram?: string | null
    linkedin?: string | null
    youtube?: string | null
    tiktok?: string | null
  }
}

const TOPIC_LABELS: Record<Topic, string> = {
  general: 'General inquiry',
  sales: 'Sales',
  support: 'Support',
  partnership: 'Partnership',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(form: ContactForm): FieldErrors {
  const errors: FieldErrors = {}
  if (!form.name.trim()) errors.name = 'Please enter your name.'
  if (!form.email.trim()) errors.email = 'Please enter your email.'
  else if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Please enter a valid email address.'
  if (!form.message.trim()) errors.message = 'Please enter a message.'
  else if (form.message.trim().length < 10) errors.message = 'Message must be at least 10 characters.'
  return errors
}

/** Treat Odoo's `false`/empty-string/null as "no value". */
function str(v: string | false | null | undefined): string | null {
  if (v === false || v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

function composeAddress(company: ContactInfo['company']): string | null {
  if (!company) return null
  const parts: string[] = []
  const street = str(company.street)
  const street2 = str(company.street2)
  const city = str(company.city)
  const zip = str(company.zip)
  const state = company.state_id && Array.isArray(company.state_id) ? company.state_id[1] : null
  const country = company.country_id && Array.isArray(company.country_id) ? company.country_id[1] : null
  if (street) parts.push(street)
  if (street2) parts.push(street2)
  const cityLine = [city, state, zip].filter(Boolean).join(', ')
  if (cityLine) parts.push(cityLine)
  if (country) parts.push(country)
  return parts.length > 0 ? parts.join(', ') : null
}

// ---------- Page ----------
export default function ContactUs() {
  const [form, setForm] = useState<ContactForm>({
    name: '',
    email: '',
    company: '',
    topic: 'general',
    message: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const { data: contactInfo } = useQuery<ContactInfo>({
    queryKey: ['website', 'contact-info'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get<ContactInfo>('/website/contact-info')
      return data
    },
    staleTime: 5 * 60 * 1000,
  })

  const company = contactInfo?.company ?? null
  const social = contactInfo?.social ?? {}

  const email = str(company?.email ?? null)
  const phone = str(company?.phone ?? null) || str(company?.mobile ?? null)
  const address = composeAddress(company)
  const hasAnyContact = Boolean(email || phone || address)

  const socialEntries: Array<{ key: string; href: string; label: string; icon: React.ReactNode }> = []
  if (social.twitter) socialEntries.push({ key: 'twitter', href: social.twitter, label: 'Twitter', icon: <Twitter className="h-4 w-4" /> })
  if (social.linkedin) socialEntries.push({ key: 'linkedin', href: social.linkedin, label: 'LinkedIn', icon: <Linkedin className="h-4 w-4" /> })
  if (social.instagram) socialEntries.push({ key: 'instagram', href: social.instagram, label: 'Instagram', icon: <Instagram className="h-4 w-4" /> })
  if (social.facebook) socialEntries.push({ key: 'facebook', href: social.facebook, label: 'Facebook', icon: <Facebook className="h-4 w-4" /> })
  if (social.youtube) socialEntries.push({ key: 'youtube', href: social.youtube, label: 'YouTube', icon: <Youtube className="h-4 w-4" /> })
  if (social.tiktok) socialEntries.push({ key: 'tiktok', href: social.tiktok, label: 'TikTok', icon: <SendIcon className="h-4 w-4" /> })

  function update<K extends keyof ContactForm>(key: K, value: ContactForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    if (errors[key as keyof FieldErrors]) {
      setErrors(prev => ({ ...prev, [key]: undefined }))
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const nextErrors = validate(form)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setLoading(true)
    try {
      // Submit as a CRM lead via the public endpoint (get_optional_user allows anonymous).
      // If this fails (e.g. no valid session for unauthenticated writes in your deployment),
      // the catch block below surfaces an error toast.
      const subjectLabel = TOPIC_LABELS[form.topic]
      const description = [
        form.company ? `Company: ${form.company}` : null,
        `Topic: ${subjectLabel}`,
        '',
        form.message.trim(),
      ]
        .filter(Boolean)
        .join('\n')

      await erpClient.raw.post('/crm/leads/create', {
        name: `[Contact] ${subjectLabel} - ${form.name.trim()}`,
        type: 'lead',
        contact_name: form.name.trim(),
        partner_name: form.company.trim() || undefined,
        email_from: form.email.trim(),
        description,
      })

      setSent(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      toast.error('Could not send message', message)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm({ name: '', email: '', company: '', topic: 'general', message: '' })
    setErrors({})
    setSent(false)
  }

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="w-full border-b border-border/40 bg-gradient-to-br from-primary/5 via-background to-accent/5 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Get in touch
          </p>
          <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            Let&apos;s talk
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Have a question, a project, or just want to say hi? Send us a note and a real human
            will get back to you within one business day.
          </p>
        </div>
      </section>

      {/* Main 2-column */}
      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_420px]">
        {/* LEFT - Form / success card */}
        <div>
          {sent ? (
            <SuccessCard onReset={resetForm} />
          ) : (
            <div className="rounded-3xl border border-border/40 bg-card p-8 shadow-sm sm:p-10">
              <div className="mb-8">
                <h2 className="text-2xl font-semibold tracking-tight">Send us a message</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Fill out the form below and we&apos;ll get back to you shortly.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={e => update('name', e.target.value)}
                      placeholder="Ada Lovelace"
                      aria-invalid={!!errors.name}
                    />
                    {errors.name && (
                      <p className="text-xs text-destructive">{errors.name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={e => update('email', e.target.value)}
                      placeholder="you@example.com"
                      aria-invalid={!!errors.email}
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={form.company}
                      onChange={e => update('company', e.target.value)}
                      placeholder="Optional"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="topic">Topic</Label>
                    <Select
                      value={form.topic}
                      onValueChange={v => update('topic', v as Topic)}
                    >
                      <SelectTrigger id="topic">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General inquiry</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="partnership">Partnership</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">
                    Message <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="message"
                    rows={6}
                    value={form.message}
                    onChange={e => update('message', e.target.value)}
                    placeholder="Tell us a bit about what you're looking for..."
                    aria-invalid={!!errors.message}
                  />
                  {errors.message && (
                    <p className="text-xs text-destructive">{errors.message}</p>
                  )}
                </div>

                <div className="flex flex-col items-start gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    By sending this message you agree to our privacy policy.
                  </p>
                  <Button type="submit" size="lg" disabled={loading} className="w-full sm:w-auto">
                    {loading ? (
                      'Sending...'
                    ) : (
                      <>
                        Send message <Send className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* RIGHT - Info panel */}
        <aside className="space-y-6">
          {/* Contact details */}
          {hasAnyContact && (
            <div className="space-y-5 rounded-2xl bg-muted/20 p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Contact details
              </h3>
              {email && (
                <InfoRow
                  icon={<Mail className="h-4 w-4" />}
                  iconBg="bg-primary/10 text-primary"
                  label="Email"
                  value={
                    <a href={`mailto:${email}`} className="hover:text-primary transition-colors">
                      {email}
                    </a>
                  }
                />
              )}
              {phone && (
                <InfoRow
                  icon={<Phone className="h-4 w-4" />}
                  iconBg="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  label="Phone"
                  value={
                    <a href={`tel:${phone.replace(/\s+/g, '')}`} className="hover:text-primary transition-colors">
                      {phone}
                    </a>
                  }
                />
              )}
              {address && (
                <InfoRow
                  icon={<MapPin className="h-4 w-4" />}
                  iconBg="bg-violet-500/10 text-violet-600 dark:text-violet-400"
                  label="Office"
                  value={<span>{address}</span>}
                />
              )}
            </div>
          )}

          {/* Office hours */}
          <div className="rounded-2xl bg-muted/20 p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold">Office hours</h3>
            </div>
            <dl className="space-y-2 text-sm">
              <HoursRow day="Monday - Friday" hours="9:00 - 18:00" />
              <HoursRow day="Saturday" hours="10:00 - 14:00" />
              <HoursRow day="Sunday" hours="Closed" muted />
            </dl>
          </div>

          {/* Social */}
          {socialEntries.length > 0 && (
            <div className="rounded-2xl bg-muted/20 p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Follow us
              </h3>
              <div className="flex gap-2">
                {socialEntries.map(s => (
                  <SocialButton key={s.key} href={s.href} label={s.label}>
                    {s.icon}
                  </SocialButton>
                ))}
              </div>
            </div>
          )}

          {/* Map placeholder - only when we have an address */}
          {address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block aspect-[4/3] overflow-hidden rounded-2xl border border-border/40 bg-muted/40 transition-colors hover:border-primary/40"
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.15),transparent_60%),radial-gradient(circle_at_80%_70%,hsl(var(--accent)/0.15),transparent_60%)]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-[0.4] [background-image:linear-gradient(hsl(var(--border)/0.6)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.6)_1px,transparent_1px)] [background-size:32px_32px]"
              />
              <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                  <MapPin className="h-6 w-6" />
                </div>
                <p className="max-w-[260px] text-sm text-foreground">{address}</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-foreground backdrop-blur">
                  View on map <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </a>
          )}
        </aside>
      </section>

      {/* CTA band */}
      <section className="border-t border-border/40 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 md:flex-row md:justify-between md:text-left">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Prefer to read about what we do?
            </h3>
            <p className="mt-2 text-muted-foreground">
              Check out our blog or browse the shop - no sign-up required.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="outline">
              <Link to="/blog">
                Browse our blog <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg">
              <Link to="/shop">
                Shop our products <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

// ---------- Sub-components ----------
function InfoRow({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-sm text-foreground">{value}</p>
      </div>
    </div>
  )
}

function HoursRow({ day, hours, muted }: { day: string; hours: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{day}</dt>
      <dd className={muted ? 'text-muted-foreground' : 'font-medium text-foreground'}>{hours}</dd>
    </div>
  )
}

function SocialButton({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
    >
      {children}
    </a>
  )
}

function SuccessCard({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-3xl border border-border/40 bg-card p-10 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <Check className="h-8 w-8" strokeWidth={3} />
      </div>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight">
        Thanks - we&apos;ll be in touch
      </h2>
      <p className="mx-auto mt-3 max-w-md text-muted-foreground">
        We typically reply within 1 business day. In the meantime, feel free to explore our blog
        or documentation.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button variant="outline" onClick={onReset}>
          Send another message
        </Button>
        <Button asChild>
          <Link to="/blog">
            Read the blog <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
