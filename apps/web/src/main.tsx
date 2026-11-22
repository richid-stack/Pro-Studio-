import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@pro-studio/ui/styles/index.css';
import './styles/shell.css';
import './styles/workspace.css';
import './styles/controls.css';
import './styles/rack.css';
import './styles/mixer.css';
import './styles/browser.css';
import './styles/playlist.css';
import './styles/roll.css';
import './styles/keys.css';
import './styles/dialogs.css';
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
