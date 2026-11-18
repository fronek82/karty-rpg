import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/motyw'; // stosuje motyw przy starcie
import { App } from './ui/App';

const korzen = document.getElementById('root');
if (!korzen) throw new Error('Brak elementu #root w index.html');

createRoot(korzen).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
