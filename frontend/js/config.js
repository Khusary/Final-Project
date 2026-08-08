// Detects environment and points to the right backend API.
// Update PRODUCTION_API_URL once the backend is deployed (e.g. Render).
const PRODUCTION_API_URL = 'https://final-project-2pfl.onrender.com/api';
const LOCAL_API_URL = 'http://localhost:5000/api';

const API_URL = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? LOCAL_API_URL
  : PRODUCTION_API_URL;

const TOKEN_KEY = 'securecrypt_token';
const ADMIN_TOKEN_KEY = 'securecrypt_admin_token';
const USER_KEY = 'securecrypt_user';
