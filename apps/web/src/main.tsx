import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { ThemeProvider } from './theme.js';
import './generated/responsiveImageBackgrounds.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
