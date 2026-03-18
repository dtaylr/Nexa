import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import './App.css';
import { ToastProvider } from './components/Toast';
import ResetButton from './components/ResetButton';
import FinanceDashboard from './finance/Dashboard';
import TransferForm from './finance/TransferForm';
import Cards from './finance/Cards';
import Beneficiaries from './finance/Beneficiaries';
import Statements from './finance/Statements';
import FraudAlerts from './finance/FraudAlerts';
import HealthDashboard from './health/Dashboard';
import Appointments from './health/Appointments';
import LabResults from './health/LabResults';
import Prescriptions from './health/Prescriptions';
import Messages from './health/Messages';
import Insurance from './health/Insurance';
import Billing from './health/Billing';
import SymptomChecker from './health/SymptomChecker';
import ProductList from './commerce/ProductList';
import ProductPage from './commerce/ProductPage';
import Cart from './commerce/Cart';
import Checkout from './commerce/Checkout';
import Wishlist from './commerce/Wishlist';
import OrderHistory from './commerce/OrderHistory';
import Returns from './commerce/Returns';
import Loyalty from './commerce/Loyalty';

function NavLink({ to, children, color }: { to: string; children: React.ReactNode; color: string }) {
  const location = useLocation();
  const active = location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      style={{
        color: active ? '#fff' : 'rgba(255,255,255,0.7)',
        textDecoration: 'none',
        fontWeight: active ? 700 : 500,
        padding: '0.4rem 0.8rem',
        borderRadius: 8,
        background: active ? color : 'transparent',
        fontSize: '0.9rem',
        transition: 'all 0.15s',
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 44,
      }}
    >
      {children}
    </Link>
  );
}

const COMMERCE_PATHS = ['/BuyItAll/products', '/BuyItAll/cart', '/BuyItAll/checkout', '/BuyItAll/wishlist', '/BuyItAll/orders', '/BuyItAll/returns', '/BuyItAll/loyalty'];

function CommerceOnly({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const isCommerce = COMMERCE_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (!isCommerce) return null;
  return <>{children}</>;
}

function CartBadge() {
  const [count, setCount] = useState(0);

  function refresh() {
    const items = JSON.parse(localStorage.getItem('cart') || '[]');
    setCount(items.reduce((s: number, i: any) => s + i.quantity, 0));
  }

  useEffect(() => {
    refresh();
    window.addEventListener('cartUpdate', refresh);
    return () => window.removeEventListener('cartUpdate', refresh);
  }, []);

  return (
    <Link to="/BuyItAll/cart" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', padding: '0.4rem 0.8rem', borderRadius: 8, transition: 'all 0.15s' }}>
      🛒
      {count > 0 && (
        <span style={{ background: '#ff6b35', color: '#fff', borderRadius: 20, padding: '0.1rem 0.45rem', fontSize: '0.75rem', fontWeight: 800, lineHeight: 1.4 }}>
          {count}
        </span>
      )}
    </Link>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
        <nav className="app-nav" style={{
          display: 'flex', gap: '0.25rem', padding: '0.75rem 2rem',
          background: '#1a1a2e', alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <Link to="/" style={{ textDecoration: 'none', marginRight: '1rem' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
              1<span style={{ color: '#90caf9' }}>Platform</span>
            </span>
          </Link>

          <div style={{ display: 'flex', gap: '0.25rem', flex: 1, alignItems: 'center' }}>
            <NavLink to="/BrightBank/dashboard" color="rgba(0,102,204,0.8)">
              🏦 BrightBank
            </NavLink>
            <NavLink to="/HealthyU/dashboard" color="rgba(46,125,50,0.8)">
              🏥 HealthyU
            </NavLink>
            <NavLink to="/BuyItAll/products" color="rgba(230,81,0,0.8)">
              🛍 BuyItAll
            </NavLink>
          </div>

          <CommerceOnly><CartBadge /></CommerceOnly>
          <ResetButton />
        </nav>

        <main className="app-main" style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
          <Routes>
            <Route path="/" element={<ProductList />} />
            <Route path="/BrightBank/dashboard" element={<FinanceDashboard />} />
            <Route path="/BrightBank/transfer" element={<TransferForm />} />
            <Route path="/BrightBank/cards" element={<Cards />} />
            <Route path="/BrightBank/beneficiaries" element={<Beneficiaries />} />
            <Route path="/BrightBank/statements" element={<Statements />} />
            <Route path="/BrightBank/fraud-alerts" element={<FraudAlerts />} />
            <Route path="/HealthyU/dashboard" element={<HealthDashboard />} />
            <Route path="/HealthyU/appointments" element={<Appointments />} />
            <Route path="/HealthyU/appointments/book" element={<Appointments booking />} />
            <Route path="/HealthyU/lab-results" element={<LabResults />} />
            <Route path="/HealthyU/prescriptions" element={<Prescriptions />} />
            <Route path="/HealthyU/messages" element={<Messages />} />
            <Route path="/HealthyU/insurance" element={<Insurance />} />
            <Route path="/HealthyU/billing" element={<Billing />} />
            <Route path="/HealthyU/symptom-checker" element={<SymptomChecker />} />
            <Route path="/HealthyU/symptoms" element={<SymptomChecker />} />
            <Route path="/BuyItAll/products" element={<ProductList />} />
            <Route path="/BuyItAll/products/:id" element={<ProductPage />} />
            <Route path="/BuyItAll/cart" element={<Cart />} />
            <Route path="/BuyItAll/checkout" element={<Checkout />} />
            <Route path="/BuyItAll/wishlist" element={<Wishlist />} />
            <Route path="/BuyItAll/orders" element={<OrderHistory />} />
            <Route path="/BuyItAll/returns" element={<Returns />} />
            <Route path="/BuyItAll/loyalty" element={<Loyalty />} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  );
}
