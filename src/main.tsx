import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './components/Toast';
import './index.css';

if (!window.location.hash && window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
  window.history.replaceState(
    null,
    '',
    `/#${window.location.pathname}${window.location.search}`
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);
