package com.niro;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * Niro — Defensive AI Risk Manager Platform
 *
 * A domain-oriented modular monolith for detecting coordinated refund abuse,
 * supporting analyst investigations, and measuring detector performance
 * against synthetic ground truth.
 *
 * Architecture: Java 21 / Spring Boot 3 / PostgreSQL / Flyway
 * All data processed is synthetic. Risk scores are prototype scores.
 * AI assessments are advisory and require analyst review.
 */
@SpringBootApplication
@EnableAsync
@EnableTransactionManagement
@EnableConfigurationProperties
public class NiroApplication {

    public static void main(String[] args) {
        SpringApplication.run(NiroApplication.class, args);
    }
}
