/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// GitHub Pages project site нь repo нэрийн доор байрладаг тул build хийхэд
// base хэрэгтэй. Dev server-т base '/' хэвээр — localhost:5173 өөрчлөгдөхгүй.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/zardal-huwiarlalt/' : '/',
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
