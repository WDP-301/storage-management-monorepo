import { AuthProvider } from './context/AuthContext';
import { FacilityProvider } from './context/FacilityContext';
import { AppRouter } from './router/AppRouter';

export default function App() {
  return (
    <AuthProvider>
      <FacilityProvider>
        <AppRouter />
      </FacilityProvider>
    </AuthProvider>
  );
}
