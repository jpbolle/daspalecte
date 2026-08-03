import path from "node:path";
import type { NextConfig } from "next";

const FIREBASE_AUTH_PROXY =
  "https://essai-27712.firebaseapp.com/__/auth/:path*";

const nextConfig: NextConfig = {
  // Le dépôt Daspalecte est un monorepo (daspa-extension, gas-addon, daspa-app) ;
  // sans cela Next remonte jusqu'au lockfile de ~/ pour deviner la racine.
  turbopack: {
    root: path.join(__dirname),
  },

  /**
   * Proxy transparent du gestionnaire d'auth Firebase sous le meme domaine que
   * l'app. Pret pour le jour ou on bascule `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   * vers le domaine App Hosting (apres avoir ajoute l'URI de redirection
   * `https://<domaine>/__/auth/handler` au client OAuth Google).
   *
   * Doc : https://firebase.google.com/docs/auth/web/redirect-best-practices
   */
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: FIREBASE_AUTH_PROXY,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            // App Hosting sert un COOP `same-origin` par defaut, ce qui coupe
            // le lien entre la fenetre Google et la page : signInWithPopup ne
            // recupere jamais son resultat et echoue sans code d'erreur.
            // `same-origin-allow-popups` retablit ce seul lien, sans rouvrir
            // la page aux autres origines.
            // Note : sur App Hosting, c'est surtout le middleware qui pose
            // réellement cet en-tête (voir src/middleware.ts).
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
