import { AuthProvider } from './context/AuthContext.jsx';
import { LanguageProvider } from './i18n/LanguageContext.jsx';
import AppRoutes from './routes/AppRoutes.jsx';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </LanguageProvider>
  );
}
