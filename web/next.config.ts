import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le dépôt Daspalecte contient l'extension à la racine et l'app ici ;
  // sans cela Next remonte jusqu'au lockfile de ~/ pour deviner la racine.
  turbopack: {
    root: path.join(__dirname),
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
