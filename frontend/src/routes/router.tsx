import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from './RootLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { PerformanceDetailPage } from './pages/PerformanceDetailPage'
import { WaitingRoomPage } from './pages/WaitingRoomPage'
import { SeatMapPage } from './pages/SeatMapPage'
import { BookingCompletePage } from './pages/BookingCompletePage'
import { MyBookingsPage } from './pages/MyBookingsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ProfileEditPage } from './pages/ProfileEditPage'
import { AdminPerformancesPage } from './pages/AdminPerformancesPage'
import { NotFoundPage } from './pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
      { path: 'performances/:id', element: <PerformanceDetailPage /> },
      {
        path: 'sessions/:id/waiting',
        element: (
          <ProtectedRoute>
            <WaitingRoomPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'sessions/:id/seats',
        element: (
          <ProtectedRoute>
            <SeatMapPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'bookings/:id/complete',
        element: (
          <ProtectedRoute>
            <BookingCompletePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'mypage/bookings',
        element: (
          <ProtectedRoute>
            <MyBookingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'mypage/notifications',
        element: (
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'mypage/edit',
        element: (
          <ProtectedRoute>
            <ProfileEditPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/performances',
        element: (
          <ProtectedRoute role="ADMIN">
            <AdminPerformancesPage />
          </ProtectedRoute>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
