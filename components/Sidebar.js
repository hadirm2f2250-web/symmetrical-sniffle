'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const links = [
  { 
    href: '/dashboard', label: 'Dashboard',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  },
  { 
    href: '/order', label: 'Order OTP',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
  },
  { 
    href: '/history', label: 'Riwayat Order',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
  },
  { 
    href: '/deposit', label: 'Deposit',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
  },
];

const adminLinks = [
  {
    href: '/admin/dashboard', label: 'Dashboard Admin',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
  },
  {
    href: '/admin/users', label: 'Kelola User',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  },
  {
    href: '/admin/orders', label: 'Kelola Order',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
  },
];

export default function Sidebar({ role }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-label">Menu</div>
        {links.map(({ href, icon, label }) => (
          <Link key={href} href={href}
            onClick={() => {
              if (typeof document !== 'undefined') {
                document.body.classList.remove('sidebar-open');
              }
            }}
            className={`sidebar-link ${pathname === href ? 'active' : ''}`}>
            <span className="sidebar-icon">{icon}</span>
            {label}
          </Link>
        ))}
      </div>
      {role === 'admin' && (
        <div className="sidebar-section" style={{ marginTop: 16 }}>
          <div className="sidebar-label">Admin</div>
          {adminLinks.map(({ href, icon, label }) => (
            <Link key={href} href={href}
              onClick={() => {
                if (typeof document !== 'undefined') {
                  document.body.classList.remove('sidebar-open');
                }
              }}
              className={`sidebar-link ${pathname === href ? 'active' : ''}`}>
              <span className="sidebar-icon">{icon}</span>
              {label}
            </Link>
          ))}
        </div>
      )}

      {/* Logout button (visible primarily on mobile when Navbar hides it, but useful on Desktop too) */}
      <div className="sidebar-section" style={{ marginTop: 'auto', paddingTop: 32 }}>
        <button 
          onClick={() => {
            localStorage.removeItem('dn_session');
            sessionStorage.removeItem('dn_session');
            router.push('/login');
          }}
          className="sidebar-link" 
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontWeight: 600 }}>
          <span className="sidebar-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </span>
          Keluar
        </button>
      </div>
    </aside>
  );
}
