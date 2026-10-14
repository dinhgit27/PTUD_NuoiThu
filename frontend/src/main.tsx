import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DesktopPetWindow } from './components/DesktopPetWindow';
import './index.css';

const isOverlayWindow = new URLSearchParams(window.location.search).get('mode') === 'overlay';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isOverlayWindow ? <DesktopPetWindow /> : <App />}
  </React.StrictMode>
);
