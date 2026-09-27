package com.zeno.api;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Smoke test — verifies the Spring context loads cleanly.
 */
@SpringBootTest
@ActiveProfiles("test")
class ZenoApiApplicationTests {

    @Test
    void contextLoads() {
        // If this passes, the application context assembled successfully
    }
}
