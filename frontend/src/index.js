// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';

import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import rtlPlugin from 'stylis-plugin-rtl';
import { prefixer } from 'stylis';

// יצירת Cache עם RTL ל־emotion (הופך margin-left/right, padding וכו')
const cacheRtl = createCache({
  key: 'muirtl',
  stylisPlugins: [prefixer, rtlPlugin],
});

// ודא שכל הדף ב־RTL (כולל רכיבי צד-שלישי)
document.documentElement.setAttribute('dir', 'rtl');
document.documentElement.setAttribute('lang', 'he');

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <CacheProvider value={cacheRtl}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </CacheProvider>
  </React.StrictMode>
);

reportWebVitals();

