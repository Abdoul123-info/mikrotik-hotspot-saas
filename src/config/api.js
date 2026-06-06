/**
 * api.js - Configuration centralisée de l'URL du backend.
 *
 * En développement : le backend tourne sur http://localhost:3001
 * En production (Render, VPS, etc.) : il faut définir la variable
 *   VITE_BACKEND_URL dans le fichier .env (ex: https://mon-app.onrender.com)
 *
 * Le frontend (Vite) injecte automatiquement les variables VITE_* au build.
 * Le script MikroTik Agent utilise la même URL pour contacter le serveur.
 */
export const BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  `${window.location.protocol}//${window.location.hostname}:3001`;
