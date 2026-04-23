import { useEffect, useState, FormEvent } from 'react'
import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { erpClient } from '@/lib/erp-api'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from '@mashora/design-system'
import {
  ShoppingBag,
  Menu,
  X,
  Search,
  User,
  Twitter,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Mail,
  ArrowRight,
} from 'lucide-react'

interface MenuItem {
  id: number
  name: string
  url: string
  sequence: number
  parent_id?: number | [number, string] | false
}

interface ContactInfoSocial {
  facebook?: string | null
  twitter?: string | null
  instagram?: string | null
  linkedin?: string | null
  youtube?: string | null
  tiktok?: string | null
}

interface ContactInfoResponse {
  company: { id?: number; name?: string } | null
  social: ContactInfoSocial
}

interface CmsPage {
  id: number
  name: string
  url: string
  website_published?: boolean
}

interface CmsPagesResponse {
  records?: CmsPage[]
}

interface SocialEntry {
  key: string
  href: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
}

const CART_STORAGE_KEY = 'mashora_cart_order_id'
const CART_ITEMS_KEY = 'mashora_cart'

interface CartItemSummary {
  quantity?: number
}

/**
 * Tracks total items in the local cart (sum of quantities in `mashora_cart`).
 * Falls back to a presence indicator based on `mashora_cart_order_id` when the
 * item array is absent. Listens to storage + custom cart events so header
 * updates immediately after add-to-cart.
 */
function useCartCount(): number {
  const [count, setCount] = useState<number>(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const read = () => {
      try {
        const rawItems = window.localStorage.getItem(CART_ITEMS_KEY)
        if (rawItems) {
          const parsed: CartItemSummary[] = JSON.parse(rawItems)
          if (Array.isArray(parsed)) {
            const total = parsed.reduce((acc, it) => acc + (typeof it.quantity === 'number' ? it.quantity : 1), 0)
            setCount(total)
            return
          }
        }
        const rawOrder = window.localStorage.getItem(CART_STORAGE_KEY)
        setCount(rawOrder ? 1 : 0)
      } catch {
        setCount(0)
      }
    }
    read()
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY || e.key === CART_ITEMS_KEY || e.key === null) read()
    }
    const onCustom = () => read()
    window.addEventListener('storage', onStorage)
    window.addEventListener('mashora:cart-updated', onCustom)
    window.addEventListener('mashora-cart-update', onCustom)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('mashora:cart-updated', onCustom)
      window.removeEventListener('mashora-cart-update', onCustom)
    }
  }, [])

  return count
}

/** Tracks window scroll offset and returns true when past `threshold` px. */
function useScrolled(threshold = 20): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onScroll = () => setScrolled(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])
  return scrolled
}

function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 font-semibold ${className}`}>
      <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white text-sm font-bold shadow-sm">
        M
      </div>
      <span className="text-base tracking-tight">Mashora</span>
    </Link>
  )
}

export default function WebsiteLayout() {
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const scrolled = useScrolled(20)
  const cartCount = useCartCount()

  const { data: menus } = useQuery({
    queryKey: ['website', 'menus'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/website/menus', { limit: 50, order: 'sequence asc' })
        return (data.records || []) as MenuItem[]
      } catch {
        return [] as MenuItem[]
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: contactInfo } = useQuery<ContactInfoResponse>({
    queryKey: ['website', 'contact-info'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.get<ContactInfoResponse>('/website/contact-info')
        return data
      } catch {
        return { company: null, social: {} }
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: publishedPages } = useQuery<CmsPage[]>({
    queryKey: ['website', 'footer-pages'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post<CmsPagesResponse>('/website/pages', {
          published: true,
          limit: 50,
          order: 'url asc',
        })
        return data.records ?? []
      } catch {
        return []
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  const reserved = new Set(['/', '/shop', '/blog', '/contactus'])
  const topLevel = (menus || []).filter(
    (m) =>
      (!m.parent_id || (Array.isArray(m.parent_id) && !m.parent_id[0])) &&
      m.url &&
      !reserved.has(m.url)
  )

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (mobileOpen) {
      const original = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = original
      }
    }
  }, [mobileOpen])

  const navItems: { to: string; label: string; end?: boolean }[] = [
    { to: '/', label: 'Home', end: true },
    { to: '/shop', label: 'Shop' },
    { to: '/blog', label: 'Blog' },
    { to: '/contactus', label: 'Contact' },
    ...topLevel.slice(0, 3).map((m) => ({ to: m.url, label: m.name })),
  ]

  const desktopLinkCls = ({ isActive }: { isActive: boolean }) =>
    [
      'relative px-1 py-1 text-sm transition-colors',
      "after:absolute after:left-0 after:-bottom-0.5 after:h-[2px] after:rounded-full after:bg-foreground after:transition-all after:duration-300",
      isActive
        ? 'font-medium text-foreground after:w-full'
        : 'text-muted-foreground hover:text-foreground after:w-0 hover:after:w-full',
    ].join(' ')

  const mobileLinkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between py-3 text-lg transition-colors ${
      isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'
    }`

  const onSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = searchValue.trim()
    setSearchOpen(false)
    setSearchValue('')
    navigate(q ? `/shop?search=${encodeURIComponent(q)}` : '/shop')
  }

  const headerHeight = scrolled ? 'h-14' : 'h-16'
  const headerShadow = scrolled ? 'shadow-sm' : 'shadow-none'

  // Build the ordered list of socials that actually have URLs.
  const social = contactInfo?.social ?? {}
  const socialEntries: SocialEntry[] = []
  if (social.twitter) socialEntries.push({ key: 'twitter', href: social.twitter, label: 'Twitter', Icon: Twitter })
  if (social.instagram) socialEntries.push({ key: 'instagram', href: social.instagram, label: 'Instagram', Icon: Instagram })
  if (social.facebook) socialEntries.push({ key: 'facebook', href: social.facebook, label: 'Facebook', Icon: Facebook })
  if (social.linkedin) socialEntries.push({ key: 'linkedin', href: social.linkedin, label: 'LinkedIn', Icon: Linkedin })
  if (social.youtube) socialEntries.push({ key: 'youtube', href: social.youtube, label: 'YouTube', Icon: Youtube })

  // Detect CMS pages matching well-known legal/company slugs.
  const pages = publishedPages ?? []
  const matchPage = (needle: string): CmsPage | undefined =>
    pages.find(
      (p) =>
        (p.url && p.url.toLowerCase().includes(needle)) ||
        (p.name && p.name.toLowerCase().includes(needle)),
    )
  const privacyPage = matchPage('privacy')
  const termsPage = matchPage('terms')
  const cookiesPage = matchPage('cookies')
  const refundPage = matchPage('refund')
  const aboutPage = matchPage('about')

  const legalLinks: FooterLink[] = []
  if (privacyPage) legalLinks.push({ label: 'Privacy', to: privacyPage.url })
  if (termsPage) legalLinks.push({ label: 'Terms', to: termsPage.url })
  if (cookiesPage) legalLinks.push({ label: 'Cookies', to: cookiesPage.url })
  if (refundPage) legalLinks.push({ label: 'Refund policy', to: refundPage.url })

  // Dynamic CMS links for the Company column, excluding pages we've slotted elsewhere.
  const reservedPageIds = new Set<number>(
    [privacyPage, termsPage, cookiesPage, refundPage]
      .filter((p): p is CmsPage => Boolean(p))
      .map((p) => p.id),
  )
  const companyDynamicLinks: FooterLink[] = pages
    .filter((p) => !reservedPageIds.has(p.id) && p.url && p.url !== '/')
    .slice(0, 4)
    .map((p) => ({ label: p.name, to: p.url }))

  const companyLinks: FooterLink[] = [
    ...(aboutPage ? [{ label: 'About', to: aboutPage.url }] : []),
    { label: 'Blog', to: '/blog' },
    { label: 'Contact', to: '/contactus' },
    ...companyDynamicLinks.filter((l) => l.to !== '/blog' && l.to !== '/contactus'),
  ].slice(0, 4)

  const shopLinks: FooterLink[] = [
    { label: 'All products', to: '/shop' },
    { label: 'Blog', to: '/blog' },
    { label: 'Contact', to: '/contactus' },
  ]

  const footerGridCls =
    legalLinks.length > 0
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10'

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header
        className={`sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl transition-[box-shadow] duration-200 ${headerShadow}`}
      >
        <div
          className={`mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 transition-[height] duration-200 ${headerHeight}`}
        >
          {/* Left: logo */}
          <div className="flex items-center gap-6">
            <Logo />
          </div>

          {/* Center: nav */}
          <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-7">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={desktopLinkCls}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right: actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
              className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Search className="size-[18px]" />
            </button>

            <Link
              to="/cart"
              aria-label="Cart"
              className="relative inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ShoppingBag className="size-[18px]" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold leading-none text-background">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>

            <Link
              to="/login"
              className="hidden md:inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Sign in
            </Link>

            <Link
              to="/login"
              aria-label="Sign in"
              className="md:hidden inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <User className="size-[18px]" />
            </Link>

            <button
              type="button"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              className="md:hidden inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-[18px]" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer (hand-rolled, CSS transitions only) */}
      <div
        className={`md:hidden fixed inset-0 z-50 ${mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
            mobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={`absolute inset-y-0 right-0 w-[85%] max-w-sm bg-background border-l border-border/40 shadow-2xl transition-transform duration-300 ease-out ${
            mobileOpen ? 'translate-x-0' : 'translate-x-full'
          } flex flex-col`}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between h-14 px-4 border-b border-border/40">
            <Logo />
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>

          <nav
            className="flex-1 overflow-y-auto px-5 py-4 divide-y divide-border/40"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('a')) setMobileOpen(false)
            }}
          >
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={mobileLinkCls}>
                <span>{item.label}</span>
                <ArrowRight className="size-4 opacity-50" />
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-border/40 p-5 space-y-3">
            <Button asChild className="w-full">
              <Link to="/login">
                <User className="size-4" />
                Sign in
              </Link>
            </Button>
            {socialEntries.length > 0 && (
              <div className="flex items-center justify-center gap-5 pt-2">
                {socialEntries.map(({ key, href, label, Icon }) => (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon className="size-5" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Search dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSearchSubmit} className="flex flex-col">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40">
              <Search className="size-5 text-muted-foreground shrink-0" />
              <Input
                autoFocus
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search products, collections..."
                className="border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <kbd className="hidden sm:inline-flex h-6 items-center rounded border border-border/60 bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                ENTER
              </kbd>
            </div>
            <div className="flex items-center justify-between px-5 py-3 bg-muted/30">
              <span className="text-xs text-muted-foreground">Press enter to search the shop</span>
              <Button type="submit" size="sm">
                Search
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-24 border-t border-border/40 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
          <div className={footerGridCls}>
            {/* Brand */}
            <div className="space-y-4 lg:col-span-1">
              <Logo />
              <p className="text-sm text-muted-foreground max-w-xs">
                Built for modern commerce.
              </p>
              {socialEntries.length > 0 && (
                <div className="flex items-center gap-3 pt-1">
                  {socialEntries.map(({ key, href, label, Icon }) => (
                    <a
                      key={key}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="inline-flex size-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <Icon className="size-4" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Shop */}
            <FooterColumn title="Shop" links={shopLinks} />

            {/* Company */}
            <FooterColumn title="Company" links={companyLinks} />

            {/* Legal - only rendered when real pages exist */}
            {legalLinks.length > 0 && <FooterColumn title="Legal" links={legalLinks} />}
          </div>
        </div>

        <div className="border-t border-border/40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <span>&copy; {new Date().getFullYear()} Mashora. All rights reserved.</span>
              <span className="hidden sm:inline text-border">|</span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5" />
                Made with care
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

interface FooterLink {
  label: string
  to: string
}

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  const isInternal = (to: string) => to.startsWith('/')
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={`${title}-${link.label}`}>
            {isInternal(link.to) ? (
              <Link
                to={link.to}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ) : (
              <a
                href={link.to}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
