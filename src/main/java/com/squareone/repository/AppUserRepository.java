package com.squareone.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.squareone.model.AppUser;

public interface AppUserRepository extends JpaRepository<AppUser, String> {

    Optional<AppUser> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);
}
