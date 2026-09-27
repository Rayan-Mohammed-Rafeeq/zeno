package com.zeno.api.refill;

import com.zeno.api.patient.Patient;
import com.zeno.api.pharmacy.Pharmacy;
import com.zeno.api.prescription.Prescription;
import com.zeno.api.prescription.PrescriptionStatus;
import com.zeno.api.provider.Provider;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the triage blocker detection logic.
 * These are pure unit tests — no Spring context required.
 */
class TriageLogicTest {

    @Test
    void prescription_isExpired_whenExpiryDateIsInPast() {
        Prescription rx = buildRx();
        rx.setExpiryDate(LocalDate.now().minusDays(1));
        assertThat(rx.isExpired()).isTrue();
    }

    @Test
    void prescription_isNotExpired_whenExpiryDateIsInFuture() {
        Prescription rx = buildRx();
        rx.setExpiryDate(LocalDate.now().plusDays(30));
        assertThat(rx.isExpired()).isFalse();
    }

    @Test
    void prescription_isOutOfRefills_whenUsedEqualsAllowed() {
        Prescription rx = buildRx();
        rx.setRefillsAllowed(3);
        rx.setRefillsUsed(3);
        assertThat(rx.isOutOfRefills()).isTrue();
    }

    @Test
    void prescription_isOutOfRefills_whenUsedExceedsAllowed() {
        Prescription rx = buildRx();
        rx.setRefillsAllowed(3);
        rx.setRefillsUsed(5);
        assertThat(rx.isOutOfRefills()).isTrue();
    }

    @Test
    void prescription_isNotOutOfRefills_whenRefillsRemain() {
        Prescription rx = buildRx();
        rx.setRefillsAllowed(5);
        rx.setRefillsUsed(2);
        assertThat(rx.isOutOfRefills()).isFalse();
    }

    @Test
    void prescription_refillsRemaining_calculatesCorrectly() {
        Prescription rx = buildRx();
        rx.setRefillsAllowed(5);
        rx.setRefillsUsed(2);
        assertThat(rx.refillsRemaining()).isEqualTo(3);
    }

    @Test
    void prescription_refillsRemaining_doesNotGoNegative() {
        Prescription rx = buildRx();
        rx.setRefillsAllowed(3);
        rx.setRefillsUsed(5);
        assertThat(rx.refillsRemaining()).isEqualTo(0);
    }

    private Prescription buildRx() {
        return Prescription.builder()
                .id(1L)
                .medicationName("TestMed")
                .refillsAllowed(3)
                .refillsUsed(0)
                .status(PrescriptionStatus.ACTIVE)
                .expiryDate(LocalDate.now().plusYears(1))
                .quantityDispensed(30)
                .daysSupply(30)
                .provider(Provider.builder().id(1L).firstName("Test").lastName("Provider").build())
                .build();
    }
}
