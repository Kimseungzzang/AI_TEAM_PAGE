import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './App.css';
import 'xterm/css/xterm.css';

const root = createRoot(document.getElementById('root'));
root.render(<App />);
