package com.sportlink.sport;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;

@SpringBootTest(
		webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = {
				"spring.datasource.url=jdbc:h2:mem:sportlink;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
				"spring.datasource.driverClassName=org.h2.Driver",
				"spring.datasource.username=sa",
				"spring.datasource.password=",
				"spring.jpa.hibernate.ddl-auto=none",
				"spring.flyway.enabled=false"
		}
)
@ImportAutoConfiguration(exclude = FlywayAutoConfiguration.class) // на всякий случай «вышибаем» Flyway из автоконфига
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE) // не подменять наши проперти
class SportLinkApplicationTests {

	@Test
	void contextLoads() {}
}
