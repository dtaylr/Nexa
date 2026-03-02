import { Routes, Route, Link } from 'react-router-dom';
import FinanceDashboard from './finance/Dashboard';
import TransferForm from './finance/TransferForm';
import HealthDashboard from './health/Dashboard';
import Appointments from './health/Appointments';
import ProductList from './commerce/ProductList';
import ProductPage from './commerce/ProductPage';
import Cart from './commerce/Cart';
import Checkout from './commerce/Checkout';

const nav: React.CSSProperties = {
  display: 'flex', gap: '1.5rem', padding: '1rem 2rem',
  background: '#1a1a2e', color: '#fff', alignItems: 'center',
};

export default function App() {
  return (
    <>
      <nav style={nav}>
        <strong style={{ marginRight: 'auto' }}>NexaCore</strong>
        <Link to="/finance/dashboard" style={{ color: '#90caf9' }}>Finance</Link>
        <Link to="/health/dashboard" style={{ color: '#a5d6a7' }}>Health</Link>
        <Link to="/products" style={{ color: '#ffcc80' }}>Shop</Link>
      </nav>
      <main style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
        <Routes>
          <Route path="/" element={<ProductList />} />
          <Route path="/finance/dashboard" element={<FinanceDashboard />} />
          <Route path="/finance/transfer" element={<TransferForm />} />
          <Route path="/health/dashboard" element={<HealthDashboard />} />
          <Route path="/health/appointments" element={<Appointments />} />
          <Route path="/health/appointments/book" element={<Appointments booking />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/products/:id" element={<ProductPage />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
        </Routes>
      </main>
    </>
  );
}
