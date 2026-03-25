-- CreateIndex
CREATE INDEX "Appointment_familyMemberId_idx" ON "Appointment"("familyMemberId");

-- CreateIndex
CREATE INDEX "EmergencyContact_familyMemberId_idx" ON "EmergencyContact"("familyMemberId");

-- CreateIndex
CREATE INDEX "ExerciseSet_workoutExerciseId_idx" ON "ExerciseSet"("workoutExerciseId");

-- CreateIndex
CREATE INDEX "FamilyMember_householdId_idx" ON "FamilyMember"("householdId");

-- CreateIndex
CREATE INDEX "FamilyMember_linkedUserId_idx" ON "FamilyMember"("linkedUserId");

-- CreateIndex
CREATE INDEX "Insurance_familyMemberId_idx" ON "Insurance"("familyMemberId");

-- CreateIndex
CREATE INDEX "MedicalExpense_familyMemberId_idx" ON "MedicalExpense"("familyMemberId");

-- CreateIndex
CREATE INDEX "Medication_familyMemberId_idx" ON "Medication"("familyMemberId");

-- CreateIndex
CREATE INDEX "Provider_householdId_idx" ON "Provider"("householdId");

-- CreateIndex
CREATE INDEX "Vaccination_familyMemberId_idx" ON "Vaccination"("familyMemberId");

-- CreateIndex
CREATE INDEX "VisitSummary_familyMemberId_idx" ON "VisitSummary"("familyMemberId");

-- CreateIndex
CREATE INDEX "Workout_familyMemberId_idx" ON "Workout"("familyMemberId");

-- CreateIndex
CREATE INDEX "WorkoutExercise_workoutId_idx" ON "WorkoutExercise"("workoutId");
