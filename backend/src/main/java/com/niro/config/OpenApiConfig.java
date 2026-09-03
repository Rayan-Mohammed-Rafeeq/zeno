package com.niro.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String SECURITY_SCHEME_NAME = "bearerAuth";

    @Bean
    public OpenAPI niroOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Niro API")
                        .description("""
                                Niro — Defensive AI Risk Manager Platform for merchants.
                                
                                This API analyzes synthetic transaction data to detect coordinated abuse patterns,
                                identify suspicious clusters, support analyst investigations, and generate
                                AI-assisted evidence explanations.
                                
                                All data processed by this system is synthetic. Risk scores and AI assessments
                                are advisory. Defensive recommendations do not establish guilt.
                                """)
                        .version("1.0.0")
                        .contact(new Contact().name("Niro Platform")))
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME))
                .components(new Components()
                        .addSecuritySchemes(SECURITY_SCHEME_NAME, new SecurityScheme()
                                .name(SECURITY_SCHEME_NAME)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")));
    }
}
