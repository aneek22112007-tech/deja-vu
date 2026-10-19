import React, { lazy, Suspense, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const Landing = lazy(() => import('./landing/Landing'));
const App = lazy(() => import('./App'));

/** Hash router so GitHub Pages works: "#/" = landing, "#/app/<tab>" = the app. */
const LEGACY = /^#(capture|recall|memory)$/;
function route() {
  const h = location.hash;
  if (LEGACY.test(h)) {
    history.replaceState(null, '', `#/app/${h.slice(1)}`);
    return 'app';
  }
  return h.startsWith('#/app') ? 'app' : 'landing';
}

function Root() {
  const [r, setR] = useState(route());
  useEffect(() => {
    const on = () => {
      const next = route();
      setR((prev) => {
        if (prev !== next) window.scrollTo(0, 0);
        return next;
      });
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return <Suspense fallback={<div className="min-h-screen bg-[#06070a]" />}>{r === 'app' ? <App /> : <Landing />}</Suspense>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
