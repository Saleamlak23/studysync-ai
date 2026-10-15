import { RouterProvider } from 'react-router-dom';
import { router } from './router.js';
import { Providers } from './providers.js';
export function App() { return <Providers><RouterProvider router={router} /></Providers>; }
