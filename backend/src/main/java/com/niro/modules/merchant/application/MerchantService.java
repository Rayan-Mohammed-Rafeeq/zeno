package com.niro.modules.merchant.application;

import com.niro.modules.merchant.domain.*;
import com.niro.modules.merchant.interfaces.dto.CreateMerchantRequest;
import com.niro.modules.merchant.interfaces.dto.MerchantResponse;
import com.niro.shared.exception.ConflictException;
import com.niro.shared.exception.ForbiddenException;
import com.niro.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class MerchantService {

    private final MerchantRepository merchantRepository;
    private final MerchantUserRepository merchantUserRepository;

    @Transactional
    public MerchantResponse createMerchant(UUID userId, CreateMerchantRequest request) {
        if (merchantUserRepository.existsByUserId(userId)) {
            throw new ConflictException("MERCHANT_ALREADY_EXISTS",
                    "This user is already associated with a merchant");
        }

        String slug = generateSlug(request.name());
        if (merchantRepository.existsBySlug(slug)) {
            slug = slug + "-" + UUID.randomUUID().toString().substring(0, 6);
        }

        Merchant merchant = Merchant.builder()
                .name(request.name().trim())
                .slug(slug)
                .status(MerchantStatus.ACTIVE)
                .build();
        merchant = merchantRepository.save(merchant);

        MerchantUser merchantUser = MerchantUser.builder()
                .merchantId(merchant.getId())
                .userId(userId)
                .build();
        merchantUserRepository.save(merchantUser);

        log.info("Merchant created: {} for user: {}", merchant.getId(), userId);
        return MerchantResponse.from(merchant);
    }

    public MerchantResponse getMerchantForUser(UUID userId) {
        MerchantUser mu = merchantUserRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No merchant associated with this account"));
        Merchant merchant = merchantRepository.findById(mu.getMerchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Merchant", mu.getMerchantId()));
        return MerchantResponse.from(merchant);
    }

    /**
     * Resolves the merchant ID for the currently authenticated user.
     * Used across all operational modules for merchant scoping.
     */
    public UUID resolveMerchantId(UUID userId) {
        return merchantUserRepository.findByUserId(userId)
                .map(MerchantUser::getMerchantId)
                .orElseThrow(() -> new ForbiddenException(
                        "No merchant associated with this account. Please create a merchant first."));
    }

    public Merchant getMerchantById(UUID merchantId) {
        return merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ResourceNotFoundException("Merchant", merchantId));
    }

    private String generateSlug(String name) {
        String normalized = Normalizer.normalize(name.trim().toLowerCase(), Normalizer.Form.NFD);
        return normalized
                .replaceAll("[^\\p{ASCII}]", "")
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
    }
}
