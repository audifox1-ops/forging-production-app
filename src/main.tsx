import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './components/Toast';
import SessionGate from './components/SessionGate';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <SessionGate>
        <App />
      </SessionGate>
    </ToastProvider>
  </React.StrictMode>
);
