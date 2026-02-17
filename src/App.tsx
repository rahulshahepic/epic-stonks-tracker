import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PortfolioProvider } from './context/PortfolioContext';
import { ThemeProvider } from './context/ThemeContext';
import { LocalStorageProvider } from './storage';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { GrantsPage } from './components/GrantsPage';
import { LoansPage } from './components/LoansPage';
import { ShareExchangesPage } from './components/ShareExchangesPage';
import { StockSalesPage } from './components/StockSalesPage';
import { ProgramConfigPage } from './components/ProgramConfigPage';
import { ConfigPage } from './components/ConfigPage';

const storage = new LocalStorageProvider();

export default function App() {
  return (
    <ThemeProvider>
    <PortfolioProvider storage={storage}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="grants" element={<GrantsPage />} />
            <Route path="loans" element={<LoansPage />} />
            <Route path="exchanges" element={<ShareExchangesPage />} />
            <Route path="sales" element={<StockSalesPage />} />
            <Route path="programs" element={<ProgramConfigPage />} />
            <Route path="config" element={<ConfigPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PortfolioProvider>
    </ThemeProvider>
  );
}
