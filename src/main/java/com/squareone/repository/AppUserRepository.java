package com.squareone.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.squareone.model.AppUser;

public interface AppUserRepository extends JpaRepository<AppUser, String> {

    Optional<AppUser> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select u from AppUser u where u.id = :id")
    Optional<AppUser> lockById(@org.springframework.data.repository.query.Param("id") String id);
}
