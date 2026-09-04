/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Апп домэйны root дээр байрлана, тиймээс base нь build болон dev хоёуланд
// '/'. Өмнө нь GitHub Pages-ийн дэд зам байсан ч тэр сайт байхгүй болсон.
export default defineConfig(() => ({
  base: '/',
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  // Railway/Nixpacks дээр preview server нь платформын домэйн дор ажиллана.
  // Vite 5.4-ийн preview.allowedHosts default нь localhost-оос бусдыг блоклодог.
  preview: {
    host: true,
    allowedHosts: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
}))
