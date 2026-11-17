package com.squareone;

import com.squareone.security.ProductionConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import static org.assertj.core.api.Assertions.assertThat;

class ProductionConfigurationTests {
    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withUserConfiguration(ProductionConfiguration.class)
            .withPropertyValues("spring.profiles.active=production");

    @Test
    void productionRejectsTheContainerLocalDatabaseFallback() {
        context.withPropertyValues("spring.datasource.url=jdbc:h2:file:/data/squareone").run(result -> {
            assertThat(result).hasFailed();
            assertThat(result.getStartupFailure()).hasRootCauseMessage(
                    "Production requires an external PostgreSQL database. Set SPRING_DATASOURCE_URL to a PostgreSQL JDBC URL.");
        });
    }

    @Test
    void productionAcceptsAnExplicitPostgresDatabase() {
        context.withPropertyValues("spring.datasource.url=jdbc:postgresql://database.example/squareone")
                .run(result -> assertThat(result).hasNotFailed());
    }
}
