import { Toasty } from '@cloudflare/kumo';
import { AuthProvider } from './context/AuthContext';
import { AppRouter } from './router/AppRouter';

export default function App() {
  return (
    <Toasty>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </Toasty>
  );
}
