import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@pro-studio/ui/styles/index.css';
import './app.css';
import './state/preferences'; // applies the saved theme and density before the first paint
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
