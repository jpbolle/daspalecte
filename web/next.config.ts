import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le dépôt Daspalecte contient l'extension à la racine et l'app ici ;
  // sans cela Next remonte jusqu'au lockfile de ~/ pour deviner la racine.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
