-- Split the demo panel across the pharmacy and practice organizations so both
-- workspaces have records to demonstrate. The pharmacy still sees all of its
-- prescriptions through their pharmacy association.
UPDATE patients p
SET organization_id = practice.id
FROM organizations practice
WHERE practice.name = 'Riverside Family Practice'
  AND p.id IN (1, 2, 3, 4)
  AND p.organization_id IS DISTINCT FROM practice.id;
