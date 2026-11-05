import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DesktopPetWindow } from './components/DesktopPetWindow';
import { DesktopAlarmWindow } from './components/DesktopAlarmWindow';
import './index.css';

const mode = new URLSearchParams(window.location.search).get('mode');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {mode === 'overlay' ? (
      <DesktopPetWindow />
    ) : mode === 'alarm-modal' ? (
      <DesktopAlarmWindow />
    ) : (
      <App />
    )}
  </React.StrictMode>
);
