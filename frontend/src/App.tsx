import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';

// Auth pages
import { Login }          from '@/pages/auth/Login';
import { Register }       from '@/pages/auth/Register';
import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { VerifyEmail }    from '@/pages/auth/VerifyEmail';
import { ResetPassword }  from '@/pages/auth/ResetPassword';

// App pages
import { Dashboard }           from '@/pages/Dashboard';
import { Customers }            from '@/pages/Customers';
import { CustomerDetail }       from '@/pages/CustomerDetail';
import { Transactions }         from '@/pages/Transactions';
import { TransactionDetail }    from '@/pages/TransactionDetail';
import { Clusters }             from '@/pages/Clusters';
import { ClusterDetail }        from '@/pages/ClusterDetail';
import { Investigations }       from '@/pages/Investigations';
import { InvestigationDetail }  from '@/pages/InvestigationDetail';
import { Evaluation }           from '@/pages/Evaluation';
import { AuditTrail }           from '@/pages/AuditTrail';
import { Dataset }              from '@/pages/Dataset';
import { Settings }             from '@/pages/Settings';
import { Landing }              from '@/pages/Landing';
import { LiveEvents }           from '@/pages/LiveEvents';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* ── Public pages ────────────────────────────────────────────
                No ThemeProvider here — useTheme() returns the dark fallback,
                so these pages are always dark with no theme toggle.
                The blocking script in index.html ensures dark class is set on
                <html> before React even renders (no flash on F5). */}
            <Route path="/"                element={<Landing />}        />
            <Route path="/login"           element={<Login />}          />
            <Route path="/register"        element={<Register />}       />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/verify-email"    element={<VerifyEmail />}    />
            <Route path="/reset-password"  element={<ResetPassword />}  />

            {/* ── Protected pages ─────────────────────────────────────────
                ThemeProvider lives here only — theme switching is available
                after sign-in and respects the user's stored preference. */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <ThemeProvider>
                    <AppLayout>
                      <Routes>
                        <Route path="/dashboard"              element={<Dashboard />}          />
                        <Route path="/customers"              element={<Customers />}          />
                        <Route path="/customers/:id"          element={<CustomerDetail />}     />
                        <Route path="/transactions"           element={<Transactions />}       />
                        <Route path="/transactions/:id"       element={<TransactionDetail />}  />
                        <Route path="/clusters"               element={<Clusters />}           />
                        <Route path="/clusters/:id"           element={<ClusterDetail />}      />
                        <Route path="/investigations"         element={<Investigations />}     />
                        <Route path="/investigations/:id"     element={<InvestigationDetail />}/>
                        <Route path="/evaluation"             element={<Evaluation />}         />
                        <Route path="/audit"                  element={<AuditTrail />}         />
                        <Route path="/dataset"                element={<Dataset />}            />
                        <Route path="/settings"               element={<Settings />}           />
                        <Route path="/live-events"            element={<LiveEvents />}         />
                      </Routes>
                    </AppLayout>
                  </ThemeProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
