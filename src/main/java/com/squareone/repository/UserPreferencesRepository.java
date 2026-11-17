package com.squareone.repository;
import com.squareone.model.UserPreferences;
import org.springframework.data.jpa.repository.JpaRepository;
public interface UserPreferencesRepository extends JpaRepository<UserPreferences, String> {}
