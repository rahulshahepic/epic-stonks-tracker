import { NavLink, Outlet } from 'react-router-dom';
import { useTheme } from '../context/useTheme';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '◈' },
  { to: '/grants', label: 'Grants', icon: '◆' },
  { to: '/loans', label: 'Loans', icon: '⬡' },
  { to: '/config', label: 'Config', icon: '⚙' },
];

export function Layout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>Stonks</h1>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="app-nav" role="tablist">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `nav-tab ${isActive ? 'nav-tab--active' : ''}`
            }
            end={item.to === '/'}
            role="tab"
          >
            <span className="nav-tab-icon">{item.icon}</span>
            <span className="nav-tab-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
