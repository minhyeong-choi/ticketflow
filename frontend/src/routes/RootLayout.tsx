import { Outlet } from 'react-router-dom'
import { Header } from '@/components/Header'

// Header가 Link/useNavigate를 쓰려면 RouterProvider가 만드는 라우터 컨텍스트 안에 있어야 한다.
// 그래서 Header를 App.tsx가 아니라 라우트 트리의 루트 레이아웃으로 옮긴다.
export function RootLayout() {
  return (
    <div className="min-h-screen bg-void">
      <Header />
      <Outlet />
    </div>
  )
}
