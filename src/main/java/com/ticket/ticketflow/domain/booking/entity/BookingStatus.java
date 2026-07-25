package com.ticket.ticketflow.domain.booking.entity;

public enum BookingStatus {
   /*
    * PENDING (예매 생성 후 결제 대기 상태)
    * CONFIRMED (결제 완료 후 예매가 확정된 상태)
    * CANCELLED (예매가 취소된 상태)
    */
    PENDING,
    CONFIRMED,
    CANCELLED
}
