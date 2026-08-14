-- DropIndex
DROP INDEX "Summary_level_campaignId_partyId_scenarioId_key";

-- CreateIndex
CREATE INDEX "Summary_level_campaignId_idx" ON "Summary"("level", "campaignId");
