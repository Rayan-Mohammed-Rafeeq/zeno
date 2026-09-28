package com.zeno.api.refill;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zeno.api.organization.Organization;
import com.zeno.api.organization.OrganizationRepository;
import com.zeno.api.patient.Patient;
import com.zeno.api.patient.PatientRepository;
import com.zeno.api.pharmacy.Pharmacy;
import com.zeno.api.pharmacy.PharmacyRepository;
import com.zeno.api.prescription.Prescription;
import com.zeno.api.prescription.PrescriptionRepository;
import com.zeno.api.prescription.PrescriptionStatus;
import com.zeno.api.provider.Provider;
import com.zeno.api.provider.ProviderRepository;
import com.zeno.api.resolution.ResolutionAction;
import com.zeno.api.resolution.ResolutionActionRepository;
import com.zeno.api.resolution.ResolutionCase;
import com.zeno.api.resolution.ResolutionCaseRepository;
import com.zeno.api.resolution.ResolutionStatus;
import com.zeno.api.user.User;
import com.zeno.api.user.UserRepository;
import com.zeno.api.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class RefillWorkflowIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @Autowired private OrganizationRepository orgRepo;
    @Autowired private UserRepository userRepo;
    @Autowired private PatientRepository patientRepo;
    @Autowired private ProviderRepository providerRepo;
    @Autowired private PharmacyRepository pharmacyRepo;
    @Autowired private PrescriptionRepository rxRepo;
    @Autowired private RefillRequestRepository refillRepo;
    @Autowired private ResolutionCaseRepository caseRepo;
    @Autowired private ResolutionActionRepository actionRepo;

    private Organization pharmacyOrg;
    private Pharmacy pharmacy;
    private Patient patient;
    private Provider provider;
    private User pharmacist;

    @BeforeEach
    void setUp() {
        pharmacyOrg = orgRepo.save(Organization.builder()
                .name("Test Pharmacy Org")
                .type(Organization.OrganizationType.PHARMACY)
                .build());

        pharmacy = pharmacyRepo.save(Pharmacy.builder()
                .name("Main Street Pharmacy")
                .organization(pharmacyOrg)
                .build());

        patient = patientRepo.save(Patient.builder()
                .firstName("John")
                .lastName("Doe")
                .organization(pharmacyOrg)
                .build());

        provider = providerRepo.save(Provider.builder()
                .firstName("Jane")
                .lastName("Smith")
                .npi("1234567890")
                .build());

        pharmacist = userRepo.save(User.builder()
                .username("test_pharmacist")
                .password("encoded_pass")
                .role(UserRole.PHARMACIST)
                .organization(pharmacyOrg)
                .build());
    }

    @Test
    @WithMockUser(username = "test_pharmacist", authorities = {"PHARMACIST"})
    @DisplayName("Should detect NO_REFILLS blocker when refills are exhausted and create a resolution case")
    void triage_noRefills_createsResolutionCase() throws Exception {
        // Given a prescription with 0 refills remaining (used == allowed)
        Prescription rx = rxRepo.save(Prescription.builder()
                .patient(patient)
                .provider(provider)
                .pharmacy(pharmacy)
                .medicationName("Atorvastatin 20mg")
                .quantityDispensed(30)
                .daysSupply(30)
                .refillsAllowed(3)
                .refillsUsed(3)
                .expiryDate(LocalDate.now().plusMonths(6))
                .status(PrescriptionStatus.OUT_OF_REFILLS)
                .build());

        RefillRequest refill = refillRepo.save(RefillRequest.builder()
                .prescription(rx)
                .patient(patient)
                .pharmacy(pharmacy)
                .status(RefillStatus.REQUESTED)
                .build());

        // When triaging the refill
        mockMvc.perform(post("/api/refills/{id}/triage", refill.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AWAITING_PROVIDER"))
                .andExpect(jsonPath("$.blockerType").value("NO_REFILLS"));

        // Then a resolution case should be created
        ResolutionCase resCase = caseRepo.findByRefillRequestId(refill.getId()).orElse(null);
        assertThat(resCase).isNotNull();
        assertThat(resCase.getBlockerType()).isEqualTo(BlockerType.NO_REFILLS);
        assertThat(resCase.getStatus()).isNotNull();
    }

    @Test
    @WithMockUser(username = "test_pharmacist", authorities = {"PHARMACIST"})
    @DisplayName("Should detect NEW_PRESCRIPTION_REQUIRED blocker when prescription has expired")
    void triage_expiredPrescription_blocksRefill() throws Exception {
        // Given an expired prescription
        Prescription rx = rxRepo.save(Prescription.builder()
                .patient(patient)
                .provider(provider)
                .pharmacy(pharmacy)
                .medicationName("Amoxicillin 500mg")
                .quantityDispensed(30)
                .daysSupply(10)
                .refillsAllowed(2)
                .refillsUsed(0)
                .expiryDate(LocalDate.now().minusDays(5)) // Expired
                .status(PrescriptionStatus.EXPIRED)
                .build());

        RefillRequest refill = refillRepo.save(RefillRequest.builder()
                .prescription(rx)
                .patient(patient)
                .pharmacy(pharmacy)
                .status(RefillStatus.REQUESTED)
                .build());

        // When triaged
        mockMvc.perform(post("/api/refills/{id}/triage", refill.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AWAITING_PROVIDER"))
                .andExpect(jsonPath("$.blockerType").value("NEW_PRESCRIPTION_REQUIRED"));
    }

    @Test
    @WithMockUser(username = "test_pharmacist", authorities = {"PHARMACIST"})
    @DisplayName("Should mark refill READY when no blockers exist and refills remain")
    void triage_validPrescription_marksReady() throws Exception {
        // Given an active, non-expired prescription with refills available
        Prescription rx = rxRepo.save(Prescription.builder()
                .patient(patient)
                .provider(provider)
                .pharmacy(pharmacy)
                .medicationName("Lisinopril 10mg")
                .quantityDispensed(30)
                .daysSupply(30)
                .refillsAllowed(3)
                .refillsUsed(0)
                .expiryDate(LocalDate.now().plusMonths(6))
                .status(PrescriptionStatus.ACTIVE)
                .build());

        RefillRequest refill = refillRepo.save(RefillRequest.builder()
                .prescription(rx)
                .patient(patient)
                .pharmacy(pharmacy)
                .status(RefillStatus.REQUESTED)
                .build());

        // When triaged
        mockMvc.perform(post("/api/refills/{id}/triage", refill.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"));

        // Then refillsUsed count increments
        Prescription updatedRx = rxRepo.findById(rx.getId()).orElseThrow();
        assertThat(updatedRx.getRefillsUsed()).isEqualTo(1);
    }

    @Test
    @DisplayName("Health endpoint should be public and return UP")
    void healthCheck_returnsUp() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("zeno-api"));
    }

    // ── Re-triage tests (reproduces the 500 on /api/refills/103/triage) ───────

    @Test
    @WithMockUser(username = "test_pharmacist", authorities = {"PHARMACIST"})
    @DisplayName("Re-triaging a stuck UNDER_REVIEW refill should succeed (not 500)")
    void retriage_stuckUnderReview_succeeds() throws Exception {
        // Simulate refill 103: prescription with NO_REFILLS, refill stuck at UNDER_REVIEW
        // (previous triage run failed midway before completing the status transition)
        Prescription rx = rxRepo.save(Prescription.builder()
                .patient(patient)
                .provider(provider)
                .pharmacy(pharmacy)
                .medicationName("Metformin 500mg")
                .quantityDispensed(90)
                .daysSupply(90)
                .refillsAllowed(3)
                .refillsUsed(3)
                .expiryDate(LocalDate.now().plusMonths(6))
                .status(PrescriptionStatus.OUT_OF_REFILLS)
                .build());

        // Refill is stuck at UNDER_REVIEW — no resolution case exists yet
        RefillRequest refill = refillRepo.save(RefillRequest.builder()
                .prescription(rx)
                .patient(patient)
                .pharmacy(pharmacy)
                .status(RefillStatus.UNDER_REVIEW)  // stuck mid-triage
                .build());

        mockMvc.perform(post("/api/refills/{id}/triage", refill.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AWAITING_PROVIDER"))
                .andExpect(jsonPath("$.blockerType").value("NO_REFILLS"));

        // Exactly one resolution case and one initial action
        ResolutionCase resCase = caseRepo.findByRefillRequestId(refill.getId()).orElseThrow();
        assertThat(resCase.getBlockerType()).isEqualTo(BlockerType.NO_REFILLS);
        List<ResolutionAction> actions = actionRepo.findByResolutionCaseIdAndStatus(
                resCase.getId(), com.zeno.api.resolution.ActionStatus.PENDING);
        assertThat(actions).hasSize(1);
    }

    @Test
    @WithMockUser(username = "test_pharmacist", authorities = {"PHARMACIST"})
    @DisplayName("Re-triaging a refill that already has a resolution case should not create duplicate actions")
    void retriage_existingResolutionCase_noDuplicateActions() throws Exception {
        // Prescription with NO_REFILLS
        Prescription rx = rxRepo.save(Prescription.builder()
                .patient(patient)
                .provider(provider)
                .pharmacy(pharmacy)
                .medicationName("Amlodipine 5mg")
                .quantityDispensed(30)
                .daysSupply(30)
                .refillsAllowed(2)
                .refillsUsed(2)
                .expiryDate(LocalDate.now().plusMonths(4))
                .status(PrescriptionStatus.OUT_OF_REFILLS)
                .build());

        // Triage once — creates AWAITING_PROVIDER status + resolution case
        RefillRequest refill = refillRepo.save(RefillRequest.builder()
                .prescription(rx)
                .patient(patient)
                .pharmacy(pharmacy)
                .status(RefillStatus.REQUESTED)
                .build());

        mockMvc.perform(post("/api/refills/{id}/triage", refill.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AWAITING_PROVIDER"));

        ResolutionCase resCase = caseRepo.findByRefillRequestId(refill.getId()).orElseThrow();
        long actionsAfterFirstTriage = actionRepo.findByResolutionCaseIdAndStatus(
                resCase.getId(), com.zeno.api.resolution.ActionStatus.PENDING).size();
        assertThat(actionsAfterFirstTriage).isEqualTo(1);

        // Reset to UNDER_REVIEW to allow re-triage (simulates retriage flow)
        refill.setStatus(RefillStatus.UNDER_REVIEW);
        refillRepo.save(refill);

        // Triage again — must not blow up with 500 and must not add a second action
        mockMvc.perform(post("/api/refills/{id}/triage", refill.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AWAITING_PROVIDER"));

        long actionsAfterSecondTriage = actionRepo.findByResolutionCaseIdAndStatus(
                resCase.getId(), com.zeno.api.resolution.ActionStatus.PENDING).size();
        assertThat(actionsAfterSecondTriage).isEqualTo(1);  // still 1, not 2
    }

    @Test
    @WithMockUser(username = "test_pharmacist", authorities = {"PHARMACIST"})
    @DisplayName("markReady should persist the incremented refillsUsed on the prescription")
    void triage_markReady_persistsRefillsUsed() throws Exception {
        Prescription rx = rxRepo.save(Prescription.builder()
                .patient(patient)
                .provider(provider)
                .pharmacy(pharmacy)
                .medicationName("Lisinopril 10mg")
                .quantityDispensed(30)
                .daysSupply(30)
                .refillsAllowed(5)
                .refillsUsed(2)
                .expiryDate(LocalDate.now().plusYears(1))
                .status(PrescriptionStatus.ACTIVE)
                .build());

        RefillRequest refill = refillRepo.save(RefillRequest.builder()
                .prescription(rx)
                .patient(patient)
                .pharmacy(pharmacy)
                .status(RefillStatus.REQUESTED)
                .build());

        mockMvc.perform(post("/api/refills/{id}/triage", refill.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"));

        // Flush to DB and reload — confirms dirty-check or explicit save actually persisted it
        rxRepo.flush();
        Prescription reloaded = rxRepo.findById(rx.getId()).orElseThrow();
        assertThat(reloaded.getRefillsUsed()).isEqualTo(3);
    }
}
