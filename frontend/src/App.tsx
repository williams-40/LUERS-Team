import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './routes/HomePage';
import { NotFoundPage } from './routes/NotFoundPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
