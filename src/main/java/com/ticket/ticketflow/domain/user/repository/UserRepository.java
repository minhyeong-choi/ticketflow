package com.ticket.ticketflow.domain.user.repository;

import com.ticket.ticketflow.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    // 로그인시 조회
    Optional<User> findByEmail(String email);
    // 이메일 중복 체크
    boolean existsByEmail(String email);
}
