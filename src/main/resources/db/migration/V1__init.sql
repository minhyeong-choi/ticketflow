-- ticketFlow 초기 스키마
-- 생성 순서는 FK 의존성 순서를 따름:
--   users / venue -> venue_seat / performance -> seat_grade / session
--   -> session_seat -> booking -> booking_seat -> payment

-- ---------------------------------------------------------------------------
-- 1. 회원
--    테이블명이 user가 아닌 users인 이유: PostgreSQL에서 USER는 예약어라
--    매번 큰따옴표로 감싸야 하는 번거로움이 생김
-- ---------------------------------------------------------------------------
CREATE TABLE users
(
    id         BIGSERIAL PRIMARY KEY,
    email      VARCHAR(255) NOT NULL,
    password   VARCHAR(255) NOT NULL, -- BCrypt 해시
    name       VARCHAR(50)  NOT NULL,
    phone      VARCHAR(20),           -- 알림 발송 대상 (9~10주차)
    role       VARCHAR(20)  NOT NULL DEFAULT 'USER',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_role CHECK (role IN ('USER', 'ADMIN'))
);

-- ---------------------------------------------------------------------------
-- 2. 공연장 (공연과 독립적인 마스터 데이터)
-- ---------------------------------------------------------------------------
CREATE TABLE venue
(
    id               BIGSERIAL PRIMARY KEY,
    name             VARCHAR(200) NOT NULL,
    address          VARCHAR(300),
    total_seat_count INTEGER      NOT NULL DEFAULT 0, -- 목록 표시용 캐시값
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. 공연장 물리 좌석 (공연장에 고정, 모든 공연이 재사용)
--    pos_x / pos_y: 프론트 좌석 배치도 렌더링 좌표
-- ---------------------------------------------------------------------------
CREATE TABLE venue_seat
(
    id          BIGSERIAL PRIMARY KEY,
    venue_id    BIGINT      NOT NULL,
    section     VARCHAR(20) NOT NULL, -- 구역 (예: FLOOR-A, 2F-L)
    row_label   VARCHAR(10) NOT NULL, -- 열
    seat_number VARCHAR(10) NOT NULL, -- 번호
    pos_x       INTEGER,
    pos_y       INTEGER,
    CONSTRAINT fk_venue_seat_venue FOREIGN KEY (venue_id) REFERENCES venue (id),
    CONSTRAINT uq_venue_seat UNIQUE (venue_id, section, row_label, seat_number)
);
-- venue_id 단독 인덱스는 만들지 않음: uq_venue_seat의 선두 컬럼이 venue_id라
-- 해당 유니크 인덱스가 venue_id 조회를 이미 커버함

-- ---------------------------------------------------------------------------
-- 4. 공연
--    공연 1건 = 공연장 1곳. 투어 공연은 별도 공연으로 등록한다
--    (예: "위키드 [서울]", "위키드 [부산]")
-- ---------------------------------------------------------------------------
CREATE TABLE performance
(
    id               BIGSERIAL PRIMARY KEY,
    venue_id         BIGINT       NOT NULL,
    title            VARCHAR(200) NOT NULL,
    description      TEXT,
    poster_image_url VARCHAR(500),
    genre            VARCHAR(50),
    running_time     INTEGER, -- 분 단위
    status           VARCHAR(20)  NOT NULL DEFAULT 'SCHEDULED',
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT fk_performance_venue FOREIGN KEY (venue_id) REFERENCES venue (id),
    CONSTRAINT ck_performance_status CHECK (status IN ('SCHEDULED', 'ON_SALE', 'CLOSED')),
    CONSTRAINT ck_performance_genre CHECK (genre IN ('CONCERT', 'MUSICAL', 'PLAY'))
);
CREATE INDEX idx_performance_status ON performance (status);

-- ---------------------------------------------------------------------------
-- 5. 좌석 등급 (등급/가격은 공연마다 다르므로 performance에 종속)
--    어느 물리 좌석이 어느 등급인지는 session_seat 생성 시점에 section 기준으로 매핑
-- ---------------------------------------------------------------------------
CREATE TABLE seat_grade
(
    id             BIGSERIAL PRIMARY KEY,
    performance_id BIGINT      NOT NULL,
    name           VARCHAR(20) NOT NULL, -- VIP / R / S / A
    price          INTEGER     NOT NULL, -- 원 단위
    CONSTRAINT fk_seat_grade_performance FOREIGN KEY (performance_id) REFERENCES performance (id),
    CONSTRAINT uq_seat_grade UNIQUE (performance_id, name),
    CONSTRAINT ck_seat_grade_price CHECK (price >= 0)
);

-- ---------------------------------------------------------------------------
-- 6. 회차
--    booking_open_at은 가상 대기실(5~6주차)의 트리거 기준값
-- ---------------------------------------------------------------------------
CREATE TABLE session
(
    id               BIGSERIAL PRIMARY KEY,
    performance_id   BIGINT      NOT NULL,
    session_at       TIMESTAMPTZ NOT NULL, -- 공연 시작 시각
    booking_open_at  TIMESTAMPTZ NOT NULL, -- 예매 오픈 시각
    booking_close_at TIMESTAMPTZ NOT NULL, -- 예매 마감 시각
    status           VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_session_performance FOREIGN KEY (performance_id) REFERENCES performance (id),
    CONSTRAINT uq_session UNIQUE (performance_id, session_at),
    CONSTRAINT ck_session_status CHECK (status IN ('SCHEDULED', 'ON_SALE', 'SOLD_OUT', 'CLOSED')),
    CONSTRAINT ck_session_booking_period CHECK (booking_close_at > booking_open_at)
);
CREATE INDEX idx_session_booking_open_at ON session (booking_open_at);

-- ---------------------------------------------------------------------------
-- 7. 회차별 판매 좌석 (실제 예매 대상이자 좌석 선점의 단위)
--
--    status에 '선점 중(HELD)'이 없는 이유:
--    임시 점유는 Redis TTL 락이 전담하고, DB는 최종 확정(SOLD)만 기록한다.
--    DB에 HELD를 두면 락 만료/서버 다운 시 Redis와 DB 상태가 어긋나
--    오히려 정합성 버그 위험이 커진다.
--    => 임시 상태는 Redis, 영구 상태는 DB
-- ---------------------------------------------------------------------------
CREATE TABLE session_seat
(
    id            BIGSERIAL PRIMARY KEY,
    session_id    BIGINT      NOT NULL,
    venue_seat_id BIGINT      NOT NULL,
    seat_grade_id BIGINT      NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    CONSTRAINT fk_session_seat_session FOREIGN KEY (session_id) REFERENCES session (id),
    CONSTRAINT fk_session_seat_venue_seat FOREIGN KEY (venue_seat_id) REFERENCES venue_seat (id),
    CONSTRAINT fk_session_seat_grade FOREIGN KEY (seat_grade_id) REFERENCES seat_grade (id),
    CONSTRAINT uq_session_seat UNIQUE (session_id, venue_seat_id),
    CONSTRAINT ck_session_seat_status CHECK (status IN ('AVAILABLE', 'SOLD'))
);
-- 좌석 배치도 조회(특정 회차의 잔여석) 전용 인덱스
CREATE INDEX idx_session_seat_lookup ON session_seat (session_id, status);

-- ---------------------------------------------------------------------------
-- 8. 예매 (주문 단위)
--    실제 티켓팅은 한 번에 2~4석을 함께 예매하므로
--    주문(booking)과 좌석(booking_seat)을 분리한다
-- ---------------------------------------------------------------------------
CREATE TABLE booking
(
    id             BIGSERIAL PRIMARY KEY,
    booking_number VARCHAR(30) NOT NULL, -- 사용자 노출용 예매번호
    user_id        BIGINT      NOT NULL,
    session_id     BIGINT      NOT NULL,
    total_amount   INTEGER     NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    booked_at      TIMESTAMPTZ,
    cancelled_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_booking_number UNIQUE (booking_number),
    CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_booking_session FOREIGN KEY (session_id) REFERENCES session (id),
    CONSTRAINT ck_booking_status CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
    CONSTRAINT ck_booking_total_amount CHECK (total_amount >= 0)
);
-- 내 예매 내역 조회 (최신순)
CREATE INDEX idx_booking_user ON booking (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 9. 예매 좌석 (예매 1건에 포함된 좌석들)
--
--    status가 ACTIVE / CANCELLED인 이유:
--    이 컬럼의 목적은 아래 부분 유니크 인덱스를 지탱하는 것이다.
--    booking이 PENDING이든 CONFIRMED이든 좌석을 붙잡고 있는 동안은 ACTIVE이고,
--    예매가 취소될 때만 CANCELLED로 바꿔 좌석을 풀어준다.
--    (booking.status를 그대로 복제하지 않고 의미를 좁혀서 비정규화)
-- ---------------------------------------------------------------------------
CREATE TABLE booking_seat
(
    id              BIGSERIAL PRIMARY KEY,
    booking_id      BIGINT      NOT NULL,
    session_seat_id BIGINT      NOT NULL,
    price           INTEGER     NOT NULL, -- 예매 시점 가격 스냅샷
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT fk_booking_seat_booking FOREIGN KEY (booking_id) REFERENCES booking (id),
    CONSTRAINT fk_booking_seat_session_seat FOREIGN KEY (session_seat_id) REFERENCES session_seat (id),
    CONSTRAINT ck_booking_seat_status CHECK (status IN ('ACTIVE', 'CANCELLED')),
    CONSTRAINT ck_booking_seat_price CHECK (price >= 0)
);

-- ***************************************************************************
-- 중복 예매 방지의 최후 방어선
--
-- 하나의 좌석(session_seat_id)에 대해 살아있는(ACTIVE) 예매는 최대 1건만 허용한다.
-- Redis 분산 락이 어떤 이유로든 뚫리더라도, 두 번째 INSERT는 DB가 물리적으로 거부한다.
-- 부하 테스트에서 "중복 예매 0건"을 증명하는 근거가 되는 제약이다.
--
-- 부분 인덱스(WHERE 절)를 쓰는 이유: 취소된 좌석은 다시 팔려야 하므로
-- 전체 유니크 제약이 아니라 ACTIVE 행에만 유니크를 건다.
-- ***************************************************************************
CREATE UNIQUE INDEX uq_booking_seat_active
    ON booking_seat (session_seat_id)
    WHERE status = 'ACTIVE';

CREATE INDEX idx_booking_seat_booking ON booking_seat (booking_id);

-- ---------------------------------------------------------------------------
-- 10. 결제 (MVP는 Mock)
--     pg_provider를 컬럼으로 둬서 실제 PG 연동 시 값만 교체하면 되도록 함
-- ---------------------------------------------------------------------------
CREATE TABLE payment
(
    id             BIGSERIAL PRIMARY KEY,
    booking_id     BIGINT      NOT NULL,
    amount         INTEGER     NOT NULL,
    status         VARCHAR(20) NOT NULL,
    pg_provider    VARCHAR(20) NOT NULL DEFAULT 'MOCK',
    transaction_id VARCHAR(100), -- Mock에서도 UUID를 발급해두면 실 연동 시 구조가 같아짐
    paid_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_payment_booking UNIQUE (booking_id),
    CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id) REFERENCES booking (id),
    CONSTRAINT ck_payment_status CHECK (status IN ('SUCCESS', 'FAILED')),
    CONSTRAINT ck_payment_amount CHECK (amount >= 0)
);
