import { adminHandlers } from './admin'
import { bookingHandlers } from './booking'
import { catalogHandlers } from './catalog'
import { notificationHandlers } from './notification'
import { waitingHandlers } from './waiting'

export const handlers = [
  ...catalogHandlers,
  ...waitingHandlers,
  ...bookingHandlers,
  ...notificationHandlers,
  ...adminHandlers,
]
