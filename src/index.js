import React from 'react';
import ReactDOM from 'react-dom';
import './styles.css';
import App from './App';
import { StoreProvider } from './store';

ReactDOM.render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>,
  document.getElementById('root'),
);
