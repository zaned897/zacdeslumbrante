import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {loadSeasonFromBackend} from './data/seasons';
import './index.css';

// #161: la temporada de hoy sale de la API Python; si no responde, del calendario local.
loadSeasonFromBackend().finally(() => {
  createRoot(document.getElementById('root')!).render(<App />);
});
