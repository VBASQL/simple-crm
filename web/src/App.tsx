import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider, useI18n } from './i18n/i18n.js';
import { ServicesProvider } from './services/ServicesContext.js';
import { AuthProvider, useAuth } from './auth/AuthProvider.js';
import { SignIn } from './screens/SignIn.js';
import { AppShell } from './screens/AppShell.js';
import { CallsLog } from './screens/CallsLog.js';
import { Customers } from './screens/Customers.js';
import { Tickets } from './screens/Tickets.js';
import { TicketDetail } from './screens/TicketDetail.js';
import { Search } from './screens/Search.js';
import { CustomerPage } from './screens/CustomerPage.js';
import { AdminUsers } from './screens/AdminUsers.js';
import { Dids } from './screens/Dids.js';
import { Share } from './screens/Share.js';

function Loading() {
  const { t } = useI18n();
  return <div className="loading">{t('common.loading')}</div>;
}

function Gate() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (user === null) return <SignIn />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<CallsLog />} />
        <Route path="search" element={<Search />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:customerId" element={<CustomerPage />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="tickets/:ticketId" element={<TicketDetail />} />
        <Route path="admin" element={<AdminUsers />} />
        <Route path="dids" element={<Dids />} />
        <Route path="share" element={<Share />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <I18nProvider>
      <ServicesProvider>
        <AuthProvider>
          <BrowserRouter>
            <Gate />
          </BrowserRouter>
        </AuthProvider>
      </ServicesProvider>
    </I18nProvider>
  );
}
