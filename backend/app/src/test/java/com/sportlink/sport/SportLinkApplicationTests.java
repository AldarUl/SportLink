package com.sportlink.sport;

import com.sportlink.TestcontainersConfig;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfig.class)
class SportLinkApplicationTests {
	@Test void contextLoads() {}
}
