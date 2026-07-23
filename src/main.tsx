import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@ops-forward/keel/styles.css';
import './app-shell.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
