import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ROUTES } from './constants/routes';
import AccountDetailsPage from './pages/AccountDetailsPage';
import AccountsPage from './pages/AccountsPage';
import CardsPage from './pages/CardsPage';
import ContactPage from './pages/ContactPage';
import FinancingPage from './pages/FinancingPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import OffersPage from './pages/OffersPage';
import PortfolioPage from './pages/PortfolioPage';
import ProductsPage from './pages/ProductsPage';
import SupportPage from './pages/SupportPage';

export const router = createBrowserRouter([
  {
    path: ROUTES.LOGIN,
    element: <LoginPage />,
  },
  {
    element: <AppShell />,
    children: [
      {
        path: ROUTES.HOME,
        element: <PortfolioPage />,
      },
      {
        path: ROUTES.ACCOUNTS,
        element: <AccountsPage />,
      },
      {
        path: ROUTES.ACCOUNT_DETAILS,
        element: <AccountDetailsPage />,
      },
      {
        path: ROUTES.CARDS,
        element: <CardsPage />,
      },
      {
        path: ROUTES.FINANCING,
        element: <FinancingPage />,
      },
      {
        path: ROUTES.PRODUCTS,
        element: <ProductsPage />,
      },
      {
        path: ROUTES.OFFERS,
        element: <OffersPage />,
      },
      {
        path: ROUTES.SUPPORT,
        element: <SupportPage />,
      },
      {
        path: ROUTES.CONTACT,
        element: <ContactPage />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

export default router;