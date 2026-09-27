package com.zeno.api.resolution;

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
import com.zeno.api.refill.*;
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

import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ResolutionWorkflowIntegrationTest {

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

    private RefillRequest refill;
    private ResolutionCase resolutionCase;
    private User practiceStaff;

    @BeforeEach
    void setUp() {
        Organization practiceOrg = orgRepo.save(Organization.builder()
                .name("Summit Medical Group")
                .type(Organization.OrganizationType.PRACTICE)
                .build());

        practiceStaff = userRepo.save(User.builder()
                .username("coordinator_lisa")
                .password("encoded_pass")
                .role(UserRole.PRACTICE_STAFF)
                .organization(practiceOrg)
                .build());

        Patient patient = patientRepo.save(Patient.builder()
                .firstName("Alice")
                .lastName("Smith")
                .organization(practiceOrg)
                .build());

        Provider provider = providerRepo.save(Provider.builder()
                .firstName("Marcus")
                .lastName("Welby")
                .npi("9876543210")
                .build());

        Pharmacy pharmacy = pharmacyRepo.save(Pharmacy.builder()
                .name("Corner Drugstore")
                .organization(practiceOrg)
                .build());

        Prescription rx = rxRepo.save(Prescription.builder()
                .patient(patient)
                .provider(provider)
                .pharmacy(pharmacy)
                .medicationName("Metformin 1000mg")
                .build());

        refill = refillRepo.save(RefillRequest.builder()
                .prescription(rx)
                .patient(patient)
                .pharmacy(pharmacy)
                .status(RefillStatus.AWAITING_PROVIDER)
                .blockerType(BlockerType.NO_REFILLS)
                .priority(RefillPriority.HIGH)
                .build());

        resolutionCase = caseRepo.save(ResolutionCase.builder()
                .refillRequest(refill)
                .blockerType(BlockerType.NO_REFILLS)
                .status(ResolutionStatus.OPEN)
                .priority(RefillPriority.HIGH)
                .reason("No refills remaining")
                .build());
    }

    @Test
    @WithMockUser(username = "coordinator_lisa", authorities = {"PRACTICE_STAFF"})
    @DisplayName("Should add, complete action, resolve case, and record timeline audit events")
    void actionLifecycle_andResolution_succeeds() throws Exception {
        // 1. Create a resolution action
        CreateActionRequest actionReq = new CreateActionRequest(
                ActionType.REQUEST_PROVIDER_APPROVAL,
                UserRole.PROVIDER,
                null,
                "Request Dr. Welby to authorize 3 more refills",
                LocalDateTime.now().plusDays(1)
        );

        String responseBody = mockMvc.perform(post("/api/resolutions/{id}/actions", resolutionCase.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(actionReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.actionType").value("REQUEST_PROVIDER_APPROVAL"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn().getResponse().getContentAsString();

        ResolutionAction createdAction = objectMapper.readValue(responseBody, ResolutionAction.class);

        // 2. Complete the action
        mockMvc.perform(post("/api/resolutions/{id}/actions/{actionId}/complete",
                        resolutionCase.getId(), createdAction.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("notes", "Dr. Welby approved 3 refills on EHR"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.completionNotes").value("Dr. Welby approved 3 refills on EHR"));

        // 3. Mark the resolution case as resolved
        mockMvc.perform(post("/api/resolutions/{id}/resolve", resolutionCase.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("resolutionSummary", "Provider authorized refills via phone"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESOLVED"));

        // 4. Verify audit timeline for refill
        mockMvc.perform(get("/api/refills/{id}/timeline", refill.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @WithMockUser(username = "dr_welby", authorities = {"PROVIDER"})
    @DisplayName("Option B: Doctor authorizes new prescription for expired Rx, updating prescription and advancing refill to READY")
    void doctorAuthorizesNewPrescription_succeeds() throws Exception {
        Prescription expiredRx = rxRepo.save(Prescription.builder()
                .patient(refill.getPatient())
                .provider(refill.getPrescription().getProvider())
                .pharmacy(refill.getPharmacy())
                .medicationName("Adalimumab 40mg")
                .expiryDate(java.time.LocalDate.now().minusDays(10))
                .status(PrescriptionStatus.EXPIRED)
                .build());

        RefillRequest expiredRefill = refillRepo.save(RefillRequest.builder()
                .prescription(expiredRx)
                .patient(refill.getPatient())
                .pharmacy(refill.getPharmacy())
                .status(RefillStatus.AWAITING_PROVIDER)
                .blockerType(BlockerType.NEW_PRESCRIPTION_REQUIRED)
                .priority(RefillPriority.URGENT)
                .build());

        ResolutionCase expiredCase = caseRepo.save(ResolutionCase.builder()
                .refillRequest(expiredRefill)
                .blockerType(BlockerType.NEW_PRESCRIPTION_REQUIRED)
                .status(ResolutionStatus.OPEN)
                .priority(RefillPriority.URGENT)
                .reason("Prescription expired")
                .build());

        ResolveCaseRequest doctorRequest = new ResolveCaseRequest(
                "Authorized renewed 1-year prescription with 3 refills after chart review.",
                java.time.LocalDate.now().plusYears(1),
                3,
                "RX-99210-REN"
        );

        mockMvc.perform(post("/api/resolutions/{id}/resolve", expiredCase.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(doctorRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESOLVED"));

        RefillRequest updatedRefill = refillRepo.findById(expiredRefill.getId()).orElseThrow();
        assertThat(updatedRefill.getStatus()).isEqualTo(RefillStatus.READY);
        assertThat(updatedRefill.getBlockerType()).isNull();

        Prescription updatedRx = rxRepo.findById(expiredRx.getId()).orElseThrow();
        assertThat(updatedRx.isExpired()).isFalse();
        assertThat(updatedRx.getRefillsAllowed()).isEqualTo(3);
        assertThat(updatedRx.getRxNumber()).isEqualTo("RX-99210-REN");
    }

    @Test
    @WithMockUser(username = "demo.pharmacist", authorities = {"PHARMACIST"})
    @DisplayName("Pharmacist cannot authorize or issue a new prescription for an expired Rx")
    void pharmacistCannotAuthorizeNewPrescription() throws Exception {
        User pharmacist = userRepo.save(User.builder()
                .username("demo.pharmacist")
                .password("encoded_pass")
                .role(UserRole.PHARMACIST)
                .organization(refill.getPharmacy().getOrganization())
                .build());

        Prescription expiredRx = rxRepo.save(Prescription.builder()
                .patient(refill.getPatient())
                .provider(refill.getPrescription().getProvider())
                .pharmacy(refill.getPharmacy())
                .medicationName("Adalimumab 40mg")
                .expiryDate(java.time.LocalDate.now().minusDays(10))
                .status(PrescriptionStatus.EXPIRED)
                .build());

        RefillRequest expiredRefill = refillRepo.save(RefillRequest.builder()
                .prescription(expiredRx)
                .patient(refill.getPatient())
                .pharmacy(refill.getPharmacy())
                .status(RefillStatus.AWAITING_PROVIDER)
                .blockerType(BlockerType.NEW_PRESCRIPTION_REQUIRED)
                .priority(RefillPriority.URGENT)
                .build());

        ResolutionCase expiredCase = caseRepo.save(ResolutionCase.builder()
                .refillRequest(expiredRefill)
                .blockerType(BlockerType.NEW_PRESCRIPTION_REQUIRED)
                .status(ResolutionStatus.OPEN)
                .priority(RefillPriority.URGENT)
                .reason("Prescription expired")
                .build());

        // Pharmacist attempts to resolve / authorize a new prescription
        mockMvc.perform(post("/api/resolutions/{id}/resolve", expiredCase.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("resolutionSummary", "Pharmacist attempted renewal"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Prescriptive Authority Required")));
    }

    @Test
    @WithMockUser(username = "demo.pharmacist", authorities = {"PHARMACIST"})
    @DisplayName("Pharmacist can get prescriptions list without 500 error")
    void pharmacistCanGetPrescriptions() throws Exception {
        mockMvc.perform(get("/api/prescriptions"))
                .andExpect(status().isOk());
    }
}
