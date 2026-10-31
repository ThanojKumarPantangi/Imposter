import React from 'react';
import ReactDOM from 'react-dom/client';
import Root from './Root';
import './index.css';
import { prefetchCategories } from './api/categoryCache';

// Prefetch available category definitions once on app startup
prefetchCategories();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
