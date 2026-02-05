import React from 'react';
import { createRoot } from 'react-dom/client';
import Main from './main';
import 'xterm/css/xterm.css';
import './App.css';

const root = createRoot(document.getElementById('root'));
root.render(<Main />);
