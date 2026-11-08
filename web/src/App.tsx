import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider, useI18n } from './i18n/i18n.js';
import { ServicesProvider } from './services/ServicesContext.js';
import { AuthProvider, useAuth } from './auth/AuthProvider.js';
import { SignIn } from './screens/SignIn.js';
import { AppShell } from './screens/AppShell.js';
import { CallsLog } from './screens/CallsLog.js';
import { CustomerPage } from './screens/CustomerPage.js';

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
        <Route path="customers/:customerId" element={<CustomerPage />} />
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
