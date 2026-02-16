import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/grants', label: 'Grants' },
  { to: '/loans', label: 'Loans' },
  { to: '/config', label: 'Config' },
];

export function Layout() {
  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>Epic Stonks Tracker</h1>
        <nav className="app-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link--active' : ''}`
              }
              end={item.to === '/'}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
