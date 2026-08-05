const isLocalhost =
  typeof window !== 'undefined' &&
  Boolean(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.endsWith('.localhost')
  );

export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (isLocalhost ? 'http://localhost:5000/api' : 'https://linkedin.snapsec.co/api');
