import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Forging Insight와 같은 도메인의 /daily/ 하위 경로로 서빙하기 위한 설정.
  // HashRouter를 사용하므로 라우팅은 그대로이고, 빌드 자산 경로만 /daily/ 기준이 된다.
  base: '/daily/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
