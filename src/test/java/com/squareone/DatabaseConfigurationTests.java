package com.squareone;

import com.squareone.security.DatabaseConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import static org.assertj.core.api.Assertions.assertThat;

class DatabaseConfigurationTests {
    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withUserConfiguration(DatabaseConfiguration.class);

    @Test
    void normalStartupRejectsH2ForAuthentication() {
        context.withPropertyValues("spring.datasource.url=jdbc:h2:file:/data/squareone").run(result -> {
            assertThat(result).hasFailed();
            assertThat(result.getStartupFailure()).hasRootCauseMessage("Neon/PostgreSQL is required for authentication and persistent data. "
                    + "Set SPRING_DATASOURCE_URL to a PostgreSQL JDBC URL. "
                    + "H2 is available only with the h2-test profile outside production.");
        });
    }

    @Test
    void normalStartupAcceptsAnExplicitPostgresDatabase() {
        context.withPropertyValues("spring.datasource.url=jdbc:postgresql://database.example/squareone")
                .run(result -> assertThat(result).hasNotFailed());
    }

    @Test
    void missingDatabaseCannotFallBackToH2() {
        context.run(result -> assertThat(result).hasFailed());
    }

    @Test
    void isolatedTestsCanExplicitlyUseH2() {
        context.withPropertyValues("spring.profiles.active=h2-test", "spring.datasource.url=jdbc:h2:mem:isolated")
                .run(result -> assertThat(result).hasNotFailed());
    }

    @Test
    void productionCannotEnableH2EvenWithTheTestProfile() {
        context.withPropertyValues("spring.profiles.active=production,h2-test", "spring.datasource.url=jdbc:h2:mem:isolated")
                .run(result -> assertThat(result).hasFailed());
    }

    @Test
    void productionAcceptsPostgres() {
        context.withPropertyValues("spring.profiles.active=production", "spring.datasource.url=jdbc:postgresql://database.example/squareone")
                .run(result -> assertThat(result).hasNotFailed());
    }
}
