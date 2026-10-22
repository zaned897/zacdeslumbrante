import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {Map3DView} from './components/Map3DView';
import './index.css';

// PROTO: enrutado por hash para no meter un router todavía; /#3d abre la ciudad 3D.
function Root() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash === '#3d' ? <Map3DView /> : <App />;
}

createRoot(document.getElementById('root')!).render(<Root />);
