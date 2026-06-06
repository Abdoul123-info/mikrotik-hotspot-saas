import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('🛡️ Firebase Admin initialisé via la variable d\'environnement.');
} else if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('🛡️ Firebase Admin initialisé avec la clé de compte de service locale.');
} else {
  // Fallback (e.g. for production environment with ADC or fallback project ID)
  admin.initializeApp({
    projectId: 'hotspot-manager-66d54'
  });
  console.log('⚠️ Firebase Admin initialisé sans clé locale (projet uniquement).');
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export default admin;
