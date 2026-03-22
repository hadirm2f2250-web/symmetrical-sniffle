'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Navbar({ user, profile }) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('dn_session');
    router.push('/login');
  };

  const formatBalance = (bal) => {
    if (!bal && bal !== 0) return '...';
    return 'Rp' + Number(bal).toLocaleString('id-ID');
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user && (
            <button 
              className="mobile-menu-btn" 
              onClick={() => document.body.classList.toggle('sidebar-open')}
              aria-label="Toggle Menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
          )}
          <Link href={user ? '/dashboard' : '/'} className="navbar-logo">
            <span style={{ fontWeight: 800 }}>Dunia</span><span style={{ fontWeight: 400, opacity: 0.9 }}>Nokos</span>
          </Link>
        </div>
        <div className="navbar-actions">
          {user ? (
            <>
              <span className="balance-chip">{formatBalance(profile?.balance)}</span>
              <Link href="/deposit" className="btn btn-ghost btn-sm hide-on-mobile">Deposit</Link>
              <button onClick={handleLogout} className="btn btn-secondary btn-sm hide-on-mobile">Keluar</button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm hide-on-mobile">Masuk</Link>
              <Link href="/register" className="btn btn-primary btn-sm">Daftar</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
