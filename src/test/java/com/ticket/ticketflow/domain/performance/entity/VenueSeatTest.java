package com.ticket.ticketflow.domain.performance.entity;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class VenueSeatTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @Autowired
    private TestEntityManager em;

    @Test
    void 좌석을_저장하고_다시_조회하면_입력한_값이_그대로_보존된다() {
        Venue venue = Venue.create("올림픽 경기장", "서울 송파구", 5000);
        em.persistAndFlush(venue);

        VenueSeat seat = VenueSeat.create(venue, "FLOOR-A", "가", "12", 100, 200);
        em.persistAndFlush(seat);
        Long seatId = seat.getId();

        em.clear(); // 영속성 컨텍스트 1차 캐시를 비워 실제 DB 컬럼값으로 다시 읽어오도록 강제

        VenueSeat found = em.find(VenueSeat.class, seatId);

        assertThat(found.getSection()).isEqualTo("FLOOR-A");
        assertThat(found.getRowLabel()).isEqualTo("가");
        assertThat(found.getSeatNumber()).isEqualTo("12");
        assertThat(found.getPosX()).isEqualTo(100);
        assertThat(found.getPosY()).isEqualTo(200);
        assertThat(found.getVenue().getId()).isEqualTo(venue.getId());
    }
}
