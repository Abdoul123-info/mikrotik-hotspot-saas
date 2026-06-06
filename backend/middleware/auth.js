import { adminAuth } from '../firebaseAdmin.js';

export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non autorisé. Veuillez vous connecter.' });
  }

  const idToken = authHeader.split(' ')[1];

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    req.user = { userId: decoded.uid, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expirée ou invalide.' });
  }
};
