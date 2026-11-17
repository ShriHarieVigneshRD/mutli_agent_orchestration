import { useEffect, useState } from 'react';
import { getModels } from '../lib/api';

const STORAGE_KEY = 'model-settings';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

/**
 * The model picker's state: { mode: 'per_agent' | 'single', model } plus the server catalogue.
 * The choice is remembered in the browser; a remembered model the server no longer offers is dropped.
 */
export function useModelSettings() {
  const [catalogue, setCatalogue] = useState(null);
  const [error, setError] = useState('');
  const [choice, setChoice] = useState(load);

  useEffect(() => {
    let cancelled = false;
    getModels()
      .then((data) => !cancelled && setCatalogue(data))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const mode = choice.mode || catalogue?.default_mode || 'per_agent';
  const model = catalogue?.options.includes(choice.model) ? choice.model : catalogue?.default_model;

  const update = (next) => {
    const merged = { mode, model, ...next };
    setChoice(merged);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Not remembered in private mode; still applies to this session.
    }
  };

  return { catalogue, error, mode, model, update };
}
