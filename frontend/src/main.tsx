import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// MSW는 catalog 핸들러만 가로채고 나머지 요청은 그대로 흘려보낸다(onUnhandledRequest: 'bypass').
// 그래서 /api/auth/**는 실 백엔드로, /api/performances는 Mock으로 동시에 동작한다.
async function enableMocking() {
  if (!import.meta.env.DEV) return

  const { worker } = await import('./mocks/browser')
  await worker.start({
    onUnhandledRequest: 'bypass',
  })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
