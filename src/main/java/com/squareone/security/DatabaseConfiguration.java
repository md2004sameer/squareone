package com.squareone.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration(proxyBeanMethods = false)
public class DatabaseConfiguration {
    public DatabaseConfiguration(@Value("${spring.datasource.url:}") String databaseUrl,
            Environment environment) {
        boolean isolatedH2Test = environment.matchesProfiles("h2-test & !production")
                && databaseUrl.startsWith("jdbc:h2:");
        if (!databaseUrl.startsWith("jdbc:postgresql:") && !isolatedH2Test) {
            throw new IllegalStateException("Neon/PostgreSQL is required for authentication and persistent data. "
                    + "Set SPRING_DATASOURCE_URL to a PostgreSQL JDBC URL. "
                    + "H2 is available only with the h2-test profile outside production.");
        }
    }
}
