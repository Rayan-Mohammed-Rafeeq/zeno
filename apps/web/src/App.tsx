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
import { Refills }             from '@/pages/Refills';
import { RefillDetail }        from '@/pages/RefillDetail';
import { Prescriptions }       from '@/pages/Prescriptions';
import { AuditTrail }          from '@/pages/AuditTrail';
import { Settings }            from '@/pages/Settings';
import { Landing }             from '@/pages/Landing';

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
                        <Route path="/refills"                element={<Refills />}            />
                        <Route path="/refills/:id"            element={<RefillDetail />}       />
                        <Route path="/prescriptions"          element={<Prescriptions />}      />
                        <Route path="/audit"                  element={<AuditTrail />}         />
                        <Route path="/settings"               element={<Settings />}           />
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
