-- CreateTable
CREATE TABLE "blood_donors" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "bloodType" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "phone" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "lastDonation" TIMESTAMP(3),
    "canDonateAfter" TIMESTAMP(3),
    "notes" TEXT,
    "receiveAlerts" BOOLEAN NOT NULL DEFAULT true,
    "maxDistance" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blood_donors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_matches" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "donorId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "contactMethod" TEXT,
    "contactDetails" TEXT,
    "scheduledTime" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donation_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blood_donors_userId_key" ON "blood_donors"("userId");

-- CreateIndex
CREATE INDEX "idx_donor_blood_type" ON "blood_donors"("bloodType");

-- CreateIndex
CREATE INDEX "idx_donor_city" ON "blood_donors"("city");

-- CreateIndex
CREATE INDEX "idx_donor_available" ON "blood_donors"("isAvailable");

-- CreateIndex
CREATE INDEX "idx_match_status" ON "donation_matches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "donation_matches_requestId_donorId_key" ON "donation_matches"("requestId", "donorId");

-- AddForeignKey
ALTER TABLE "blood_donors" ADD CONSTRAINT "blood_donors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_matches" ADD CONSTRAINT "donation_matches_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "blood_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_matches" ADD CONSTRAINT "donation_matches_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "blood_donors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
