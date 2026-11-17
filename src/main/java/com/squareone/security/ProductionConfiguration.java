package com.squareone.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration(proxyBeanMethods = false)
@Profile("production")
public class ProductionConfiguration {
    public ProductionConfiguration(@Value("${spring.datasource.url}") String databaseUrl) {
        if (!databaseUrl.startsWith("jdbc:postgresql:")) {
            throw new IllegalStateException("Production requires an external PostgreSQL database. Set SPRING_DATASOURCE_URL to a PostgreSQL JDBC URL.");
        }
    }
}
