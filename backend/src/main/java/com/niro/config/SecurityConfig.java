package com.niro.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.niro.shared.api.ErrorResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity          // enables @PreAuthorize on controllers
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ObjectMapper objectMapper;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session ->
                    session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                    // Public auth endpoints
                    .requestMatchers(HttpMethod.POST,
                            "/api/v1/auth/register",
                            "/api/v1/auth/login",
                            "/api/v1/auth/verify-email",
                            "/api/v1/auth/resend-verification",
                            "/api/v1/auth/forgot-password",
                            "/api/v1/auth/reset-password").permitAll()
                    // Admin endpoints — ROLE_ADMIN required at the filter-chain level
                    // (controllers also use @PreAuthorize as defence-in-depth)
                    .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                    // Actuator health
                    .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                    // OpenAPI
                    .requestMatchers(
                            "/api/v1/api-docs/**",
                            "/swagger-ui/**",
                            "/swagger-ui.html").permitAll()
                    // Everything else requires authentication
                    .anyRequest().authenticated())
            .exceptionHandling(ex -> ex
                    .authenticationEntryPoint((request, response, authException) -> {
                        response.setStatus(401);
                        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                        objectMapper.writeValue(
                                response.getWriter(),
                                ErrorResponse.of(401, "UNAUTHORIZED", "Authentication required"));
                    })
                    .accessDeniedHandler((request, response, accessDeniedException) -> {
                        response.setStatus(403);
                        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                        objectMapper.writeValue(
                                response.getWriter(),
                                ErrorResponse.of(403, "FORBIDDEN", "Access denied"));
                    }))
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        // Argon2id — memory-hard, resistant to GPU/ASIC attacks
        return Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    }
}
