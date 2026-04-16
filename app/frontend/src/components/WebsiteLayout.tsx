import { useState } from 'react'
import { Outlet, Link, NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { erpClient } from '@/lib/erp-api'
import { ShoppingBag, Menu, X } from 'lucide-react'

interface MenuItem { id: number; name: string; url: string; sequence: number; parent_id?: number | [number, string] | false }

export default function WebsiteLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  const { data: menus } = useQuery({
    queryKey: ['website', 'menus'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/website/menus', { limit: 50, order: 'sequence asc' })
        return (data.records || []) as MenuItem[]
      } catch { return [] as MenuItem[] }
    },
    staleTime: 5 * 60 * 1000,
  })

  const reserved = new Set(['/', '/shop', '/blog', '/contactus'])
  const topLevel = (menus || []).filter(m => (!m.parent_id || (Array.isArray(m.parent_id) && !m.parent_id[0])) && m.url && !reserved.has(m.url))

  const linkCls = ({isActive}: {isActive: boolean}) => isActive ? 'font-medium' : 'text-muted-foreground hover:text-foreground'
  const mobileLinkCls = ({isActive}: {isActive: boolean}) => `block py-2.5 text-base ${isActive ? 'font-medium' : 'text-muted-foreground'}`

  const navLinks = (
    <>
      <NavLink to="/" end className={linkCls}>Home</NavLink>
      <NavLink to="/shop" className={linkCls}>Shop</NavLink>
      <NavLink to="/blog" className={linkCls}>Blog</NavLink>
      <NavLink to="/contactus" className={linkCls}>Contact</NavLink>
      {topLevel.slice(0, 3).map(m => (
        <NavLink key={m.id} to={m.url} className={linkCls}>{m.name}</NavLink>
      ))}
    </>
  )

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-zinc-900 text-white text-xs sm:text-sm">M</div>
            <span className="text-sm sm:text-base">Mashora</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden gap-6 text-sm md:flex">{navLinks}</nav>

          {/* Right actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/shop" className="text-muted-foreground hover:text-foreground">
              <ShoppingBag className="size-5" />
            </Link>
            <Link to="/login" className="hidden sm:block text-sm font-medium hover:text-foreground">Sign in</Link>
            {/* Mobile hamburger */}
            <button className="md:hidden p-1.5" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border/40 bg-background px-4 pb-4 pt-2">
            <nav className="flex flex-col text-sm" onClick={() => setMobileOpen(false)}>
              <NavLink to="/" end className={mobileLinkCls}>Home</NavLink>
              <NavLink to="/shop" className={mobileLinkCls}>Shop</NavLink>
              <NavLink to="/blog" className={mobileLinkCls}>Blog</NavLink>
              <NavLink to="/contactus" className={mobileLinkCls}>Contact</NavLink>
              {topLevel.slice(0, 3).map(m => (
                <NavLink key={m.id} to={m.url} className={mobileLinkCls}>{m.name}</NavLink>
              ))}
              <NavLink to="/login" className={mobileLinkCls}>Sign in</NavLink>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border/60 py-6 sm:py-8 mt-8 sm:mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 text-sm text-muted-foreground flex justify-between">
          <span>&copy; {new Date().getFullYear()} Mashora</span>
          <Link to="/login" className="hover:text-foreground">Admin login</Link>
        </div>
      </footer>
    </div>
  )
}
