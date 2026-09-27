# Multi-stage build for Zeno Spring Boot API with Gradle
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app

# Copy gradle wrapper and build files
COPY gradlew .
COPY gradle ./gradle
COPY build.gradle settings.gradle ./

# Copy source code and build jar
COPY src ./src
RUN chmod +x ./gradlew && ./gradlew bootJar --no-daemon -x test

# Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Non-root user for security
RUN addgroup -S zeno && adduser -S zeno -G zeno
USER zeno

COPY --from=build /app/build/libs/zeno-api-*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
