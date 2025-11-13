/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  // tambahkan env variables lain di sini jika ada
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
