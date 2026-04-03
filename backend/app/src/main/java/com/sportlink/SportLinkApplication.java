package com.sportlink;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

import com.sportlink.config.BootstrapAdminProperties;

@SpringBootApplication
@EnableConfigurationProperties({BootstrapAdminProperties.class})
public class SportLinkApplication {

	public static void main(String[] args) {
		SpringApplication.run(SportLinkApplication.class, args);
	}

}
