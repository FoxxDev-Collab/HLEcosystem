"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Trash2, AlertTriangle, Plus } from "lucide-react";
import { formatDate, formatCurrency, formatAge } from "@/lib/format";
import { updatePetAction, deletePetAction } from "@/app/(app)/pets/actions";
import { createPetVaccinationAction, deletePetVaccinationAction } from "@/app/(app)/pets/vaccinations/actions";
import { createPetMedicationAction, updatePetMedicationAction, deletePetMedicationAction } from "@/app/(app)/pets/medications/actions";
import { createPetAppointmentAction, updatePetAppointmentStatusAction, deletePetAppointmentAction } from "@/app/(app)/pets/appointments/actions";
import { createPetConditionAction, updatePetConditionAction, deletePetConditionAction } from "@/app/(app)/pets/conditions/actions";
import { createPetInsuranceAction, deletePetInsuranceAction } from "@/app/(app)/pets/insurance/actions";

const SPECIES_OPTIONS = [
  "DOG", "CAT", "BIRD", "FISH", "REPTILE", "SMALL_MAMMAL", "HORSE", "OTHER",
];

const SPECIES_LABELS: Record<string, string> = {
  DOG: "Dog", CAT: "Cat", BIRD: "Bird", FISH: "Fish",
  REPTILE: "Reptile", SMALL_MAMMAL: "Small Mammal", HORSE: "Horse", OTHER: "Other",
};

const APPOINTMENT_TYPES = [
  "WELLNESS_EXAM", "VACCINATION", "DENTAL", "SURGERY",
  "EMERGENCY", "GROOMING", "LAB_WORK", "FOLLOW_UP", "OTHER",
];

const APPOINTMENT_STATUSES = [
  "SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED",
];

const INSURANCE_TYPES = [
  "ACCIDENT_ONLY", "ACCIDENT_AND_ILLNESS", "WELLNESS", "COMPREHENSIVE", "OTHER",
];

type SerializedPet = {
  id: string;
  householdId: string;
  name: string;
  species: string;
  breed: string | null;
  color: string | null;
  weightLbs: number | null;
  dateOfBirth: string | null;
  gender: string | null;
  microchipId: string | null;
  adoptionDate: string | null;
  photoUrl: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  vaccinations: Array<{
    id: string;
    petId: string;
    vaccineName: string;
    doseNumber: string | null;
    dateAdministered: string;
    nextDueDate: string | null;
    administeredBy: string | null;
    providerId: string | null;
    lotNumber: string | null;
    notes: string | null;
    provider: { id: string; name: string } | null;
  }>;
  medications: Array<{
    id: string;
    petId: string;
    medicationName: string;
    dosage: string | null;
    frequency: string | null;
    startDate: string | null;
    endDate: string | null;
    isActive: boolean;
    prescribedBy: string | null;
    pharmacy: string | null;
    nextRefillDate: string | null;
    purpose: string | null;
    costPerRefill: number | null;
    notes: string | null;
  }>;
  appointments: Array<{
    id: string;
    petId: string;
    providerId: string | null;
    appointmentDateTime: string;
    durationMinutes: number;
    appointmentType: string;
    status: string;
    location: string | null;
    reasonForVisit: string | null;
    diagnosis: string | null;
    treatmentNotes: string | null;
    cost: number | null;
    notes: string | null;
    provider: { id: string; name: string } | null;
  }>;
  conditions: Array<{
    id: string;
    petId: string;
    conditionName: string;
    diagnosedDate: string | null;
    resolvedDate: string | null;
    isOngoing: boolean;
    severity: string | null;
    treatment: string | null;
    notes: string | null;
  }>;
  insurances: Array<{
    id: string;
    petId: string;
    providerName: string;
    policyNumber: string;
    insuranceType: string;
    monthlyPremium: number | null;
    deductible: number | null;
    annualLimit: number | null;
    reimbursementPct: number | null;
    effectiveDate: string | null;
    expirationDate: string | null;
    phoneNumber: string | null;
    website: string | null;
    notes: string | null;
    isActive: boolean;
  }>;
};

type VetProvider = { id: string; name: string };

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function toDateInputValue(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toISOString().split("T")[0];
}

function toDateTimeInputValue(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toISOString().slice(0, 16);
}

export function PetDetailTabs({ pet, vetProviders }: { pet: SerializedPet; vetProviders: VetProvider[] }) {
  return (
    <Tabs defaultValue="profile">
      <div className="overflow-x-auto -mx-1 px-1 scrollbar-none">
        <TabsList className="w-full min-w-max justify-start">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="vaccinations">Vaccinations</TabsTrigger>
          <TabsTrigger value="medications">Medications</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="conditions">Conditions</TabsTrigger>
          <TabsTrigger value="insurance">Insurance</TabsTrigger>
        </TabsList>
      </div>

      {/* Profile Tab */}
      <TabsContent value="profile">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pet Profile</CardTitle>
              <form action={deletePetAction}>
                <input type="hidden" name="id" value={pet.id} />
                <Button type="submit" variant="ghost" size="sm" className="text-red-500">
                  <Trash2 className="size-4 mr-1" />Delete Pet
                </Button>
              </form>
            </div>
          </CardHeader>
          <CardContent>
            <form action={updatePetAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <input type="hidden" name="id" value={pet.id} />
              <div className="space-y-1">
                <Label>Name</Label>
                <Input name="name" defaultValue={pet.name} required />
              </div>
              <div className="space-y-1">
                <Label>Species</Label>
                <Select name="species" defaultValue={pet.species}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPECIES_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{SPECIES_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Breed</Label>
                <Input name="breed" defaultValue={pet.breed ?? ""} />
              </div>
              <div className="space-y-1">
                <Label>Color</Label>
                <Input name="color" defaultValue={pet.color ?? ""} />
              </div>
              <div className="space-y-1">
                <Label>Weight (lbs)</Label>
                <Input name="weightLbs" type="number" step="0.1" defaultValue={pet.weightLbs ?? ""} />
              </div>
              <div className="space-y-1">
                <Label>Date of Birth</Label>
                <Input name="dateOfBirth" type="date" defaultValue={toDateInputValue(pet.dateOfBirth)} />
              </div>
              <div className="space-y-1">
                <Label>Gender</Label>
                <Select name="gender" defaultValue={pet.gender ?? ""}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Microchip ID</Label>
                <Input name="microchipId" defaultValue={pet.microchipId ?? ""} />
              </div>
              <div className="space-y-1">
                <Label>Adoption Date</Label>
                <Input name="adoptionDate" type="date" defaultValue={toDateInputValue(pet.adoptionDate)} />
              </div>
              <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                <Label>Notes</Label>
                <Textarea name="notes" defaultValue={pet.notes ?? ""} rows={3} />
              </div>
              <Button type="submit" className="sm:col-span-2 lg:col-span-3">Save Changes</Button>
            </form>

            {/* Summary info */}
            <div className="mt-6 pt-4 border-t grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <span className="text-muted-foreground">Age: </span>
                <span className="font-medium">
                  {pet.dateOfBirth ? `${formatAge(pet.dateOfBirth)} years` : "Unknown"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Status: </span>
                <Badge variant={pet.isActive ? "default" : "secondary"}>
                  {pet.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Added: </span>
                <span className="font-medium">{formatDate(pet.createdAt)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Vaccinations Tab */}
      <TabsContent value="vaccinations">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Add Vaccination</CardTitle></CardHeader>
            <CardContent>
              <form action={createPetVaccinationAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
                <input type="hidden" name="petId" value={pet.id} />
                <div className="space-y-1">
                  <Label>Vaccine Name</Label>
                  <Input name="vaccineName" placeholder="e.g. Rabies" required />
                </div>
                <div className="space-y-1">
                  <Label>Date Administered</Label>
                  <Input name="dateAdministered" type="date" required />
                </div>
                <div className="space-y-1">
                  <Label>Next Due Date</Label>
                  <Input name="nextDueDate" type="date" />
                </div>
                <div className="space-y-1">
                  <Label>Dose #</Label>
                  <Input name="doseNumber" placeholder="e.g. 1 of 3" />
                </div>
                <div className="space-y-1">
                  <Label>Administered By</Label>
                  <Input name="administeredBy" placeholder="Vet name" />
                </div>
                {vetProviders.length > 0 && (
                  <div className="space-y-1">
                    <Label>Provider</Label>
                    <Select name="providerId">
                      <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                      <SelectContent>
                        {vetProviders.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label>Lot Number</Label>
                  <Input name="lotNumber" />
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Input name="notes" />
                </div>
                <Button type="submit" className="lg:col-span-4"><Plus className="size-4 mr-2" />Add Vaccination</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Vaccination History</CardTitle></CardHeader>
            <CardContent>
              {pet.vaccinations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No vaccinations recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vaccine</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Dose</TableHead>
                      <TableHead>Next Due</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pet.vaccinations.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.vaccineName}</TableCell>
                        <TableCell>{formatDate(v.dateAdministered)}</TableCell>
                        <TableCell>{v.doseNumber || "\u2014"}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            {formatDate(v.nextDueDate)}
                            {isOverdue(v.nextDueDate) && (
                              <AlertTriangle className="size-3.5 text-amber-500" />
                            )}
                          </span>
                        </TableCell>
                        <TableCell>{v.provider?.name || v.administeredBy || "\u2014"}</TableCell>
                        <TableCell>
                          <form action={deletePetVaccinationAction}>
                            <input type="hidden" name="id" value={v.id} />
                            <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-red-500">
                              <Trash2 className="size-3.5" />
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Medications Tab */}
      <TabsContent value="medications">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Add Medication</CardTitle></CardHeader>
            <CardContent>
              <form action={createPetMedicationAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
                <input type="hidden" name="petId" value={pet.id} />
                <div className="space-y-1">
                  <Label>Medication Name</Label>
                  <Input name="medicationName" placeholder="e.g. Heartgard" required />
                </div>
                <div className="space-y-1">
                  <Label>Dosage</Label>
                  <Input name="dosage" placeholder="e.g. 1 tablet" />
                </div>
                <div className="space-y-1">
                  <Label>Frequency</Label>
                  <Input name="frequency" placeholder="e.g. Monthly" />
                </div>
                <div className="space-y-1">
                  <Label>Purpose</Label>
                  <Input name="purpose" placeholder="e.g. Heartworm prevention" />
                </div>
                <div className="space-y-1">
                  <Label>Start Date</Label>
                  <Input name="startDate" type="date" />
                </div>
                <div className="space-y-1">
                  <Label>Next Refill</Label>
                  <Input name="nextRefillDate" type="date" />
                </div>
                <div className="space-y-1">
                  <Label>Cost per Refill</Label>
                  <Input name="costPerRefill" type="number" step="0.01" placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label>Prescribed By</Label>
                  <Input name="prescribedBy" />
                </div>
                <Button type="submit" className="lg:col-span-4"><Plus className="size-4 mr-2" />Add Medication</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Medications</CardTitle></CardHeader>
            <CardContent>
              {pet.medications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No medications recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medication</TableHead>
                      <TableHead>Dosage</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Refill Due</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pet.medications.map((m) => (
                      <TableRow key={m.id} className={!m.isActive ? "opacity-50" : ""}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{m.medicationName}</span>
                            {m.purpose && <div className="text-xs text-muted-foreground">{m.purpose}</div>}
                          </div>
                        </TableCell>
                        <TableCell>{m.dosage || "\u2014"}</TableCell>
                        <TableCell>{m.frequency || "\u2014"}</TableCell>
                        <TableCell>
                          <Badge variant={m.isActive ? "default" : "secondary"}>
                            {m.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            {formatDate(m.nextRefillDate)}
                            {isOverdue(m.nextRefillDate) && m.isActive && (
                              <AlertTriangle className="size-3.5 text-amber-500" />
                            )}
                          </span>
                        </TableCell>
                        <TableCell>{m.costPerRefill ? formatCurrency(m.costPerRefill) : "\u2014"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {m.isActive && (
                              <form action={updatePetMedicationAction}>
                                <input type="hidden" name="id" value={m.id} />
                                <input type="hidden" name="medicationName" value={m.medicationName} />
                                <input type="hidden" name="isActive" value="false" />
                                <Button type="submit" variant="ghost" size="sm" className="text-xs h-7">
                                  Deactivate
                                </Button>
                              </form>
                            )}
                            <form action={deletePetMedicationAction}>
                              <input type="hidden" name="id" value={m.id} />
                              <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-red-500">
                                <Trash2 className="size-3.5" />
                              </Button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Appointments Tab */}
      <TabsContent value="appointments">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Schedule Appointment</CardTitle></CardHeader>
            <CardContent>
              <form action={createPetAppointmentAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
                <input type="hidden" name="petId" value={pet.id} />
                <div className="space-y-1">
                  <Label>Date & Time</Label>
                  <Input name="appointmentDateTime" type="datetime-local" required />
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select name="appointmentType" defaultValue="WELLNESS_EXAM">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {APPOINTMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {vetProviders.length > 0 && (
                  <div className="space-y-1">
                    <Label>Provider</Label>
                    <Select name="providerId">
                      <SelectTrigger><SelectValue placeholder="Select vet" /></SelectTrigger>
                      <SelectContent>
                        {vetProviders.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label>Duration (min)</Label>
                  <Input name="durationMinutes" type="number" defaultValue={30} />
                </div>
                <div className="space-y-1">
                  <Label>Location</Label>
                  <Input name="location" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Reason for Visit</Label>
                  <Input name="reasonForVisit" placeholder="e.g. Annual checkup" />
                </div>
                <Button type="submit" className="lg:col-span-4"><Plus className="size-4 mr-2" />Schedule</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Appointment History</CardTitle></CardHeader>
            <CardContent>
              {pet.appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No appointments recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead className="w-28" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pet.appointments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{formatDate(a.appointmentDateTime)}</TableCell>
                        <TableCell>{a.appointmentType.replace(/_/g, " ")}</TableCell>
                        <TableCell>{a.provider?.name || "\u2014"}</TableCell>
                        <TableCell>{a.reasonForVisit || "\u2014"}</TableCell>
                        <TableCell>
                          <AppointmentStatusBadge status={a.status} />
                        </TableCell>
                        <TableCell>{a.cost ? formatCurrency(a.cost) : "\u2014"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {a.status === "SCHEDULED" && (
                              <form action={updatePetAppointmentStatusAction}>
                                <input type="hidden" name="id" value={a.id} />
                                <input type="hidden" name="status" value="COMPLETED" />
                                <Button type="submit" variant="ghost" size="sm" className="text-xs h-7">
                                  Complete
                                </Button>
                              </form>
                            )}
                            {a.status === "SCHEDULED" && (
                              <form action={updatePetAppointmentStatusAction}>
                                <input type="hidden" name="id" value={a.id} />
                                <input type="hidden" name="status" value="CANCELLED" />
                                <Button type="submit" variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground">
                                  Cancel
                                </Button>
                              </form>
                            )}
                            <form action={deletePetAppointmentAction}>
                              <input type="hidden" name="id" value={a.id} />
                              <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-red-500">
                                <Trash2 className="size-3.5" />
                              </Button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Conditions Tab */}
      <TabsContent value="conditions">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Add Condition</CardTitle></CardHeader>
            <CardContent>
              <form action={createPetConditionAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
                <input type="hidden" name="petId" value={pet.id} />
                <div className="space-y-1">
                  <Label>Condition Name</Label>
                  <Input name="conditionName" placeholder="e.g. Hip Dysplasia" required />
                </div>
                <div className="space-y-1">
                  <Label>Diagnosed Date</Label>
                  <Input name="diagnosedDate" type="date" />
                </div>
                <div className="space-y-1">
                  <Label>Severity</Label>
                  <Select name="severity">
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mild">Mild</SelectItem>
                      <SelectItem value="Moderate">Moderate</SelectItem>
                      <SelectItem value="Severe">Severe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Ongoing</Label>
                  <Select name="isOngoing" defaultValue="true">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Treatment</Label>
                  <Input name="treatment" placeholder="e.g. Joint supplements, controlled exercise" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Notes</Label>
                  <Input name="notes" />
                </div>
                <Button type="submit" className="lg:col-span-4"><Plus className="size-4 mr-2" />Add Condition</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Health Conditions</CardTitle></CardHeader>
            <CardContent>
              {pet.conditions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No conditions recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Condition</TableHead>
                      <TableHead>Diagnosed</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Treatment</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pet.conditions.map((c) => (
                      <TableRow key={c.id} className={!c.isOngoing ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{c.conditionName}</TableCell>
                        <TableCell>{formatDate(c.diagnosedDate)}</TableCell>
                        <TableCell>{c.severity || "\u2014"}</TableCell>
                        <TableCell>
                          <Badge variant={c.isOngoing ? "destructive" : "secondary"}>
                            {c.isOngoing ? "Ongoing" : "Resolved"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-48 truncate">{c.treatment || "\u2014"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {c.isOngoing && (
                              <form action={updatePetConditionAction}>
                                <input type="hidden" name="id" value={c.id} />
                                <input type="hidden" name="conditionName" value={c.conditionName} />
                                <input type="hidden" name="isOngoing" value="false" />
                                <input type="hidden" name="resolvedDate" value={new Date().toISOString().split("T")[0]} />
                                <Button type="submit" variant="ghost" size="sm" className="text-xs h-7">
                                  Resolve
                                </Button>
                              </form>
                            )}
                            <form action={deletePetConditionAction}>
                              <input type="hidden" name="id" value={c.id} />
                              <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-red-500">
                                <Trash2 className="size-3.5" />
                              </Button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Insurance Tab */}
      <TabsContent value="insurance">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Add Insurance Policy</CardTitle></CardHeader>
            <CardContent>
              <form action={createPetInsuranceAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
                <input type="hidden" name="petId" value={pet.id} />
                <div className="space-y-1">
                  <Label>Provider Name</Label>
                  <Input name="providerName" placeholder="e.g. Trupanion" required />
                </div>
                <div className="space-y-1">
                  <Label>Policy Number</Label>
                  <Input name="policyNumber" placeholder="POL-12345" required />
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select name="insuranceType" defaultValue="COMPREHENSIVE">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INSURANCE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Monthly Premium</Label>
                  <Input name="monthlyPremium" type="number" step="0.01" placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label>Deductible</Label>
                  <Input name="deductible" type="number" step="0.01" placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label>Annual Limit</Label>
                  <Input name="annualLimit" type="number" step="0.01" placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label>Reimbursement %</Label>
                  <Input name="reimbursementPct" type="number" min="0" max="100" placeholder="80" />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input name="phoneNumber" type="tel" />
                </div>
                <div className="space-y-1">
                  <Label>Effective Date</Label>
                  <Input name="effectiveDate" type="date" />
                </div>
                <div className="space-y-1">
                  <Label>Expiration Date</Label>
                  <Input name="expirationDate" type="date" />
                </div>
                <div className="space-y-1">
                  <Label>Website</Label>
                  <Input name="website" type="url" placeholder="https://" />
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Input name="notes" />
                </div>
                <Button type="submit" className="lg:col-span-4"><Plus className="size-4 mr-2" />Add Policy</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Insurance Policies</CardTitle></CardHeader>
            <CardContent>
              {pet.insurances.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No insurance policies recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Policy #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Premium</TableHead>
                      <TableHead>Deductible</TableHead>
                      <TableHead>Reimb.</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pet.insurances.map((i) => {
                      const isExpired = i.expirationDate && new Date(i.expirationDate) < new Date();
                      return (
                        <TableRow key={i.id} className={!i.isActive || isExpired ? "opacity-50" : ""}>
                          <TableCell className="font-medium">{i.providerName}</TableCell>
                          <TableCell>{i.policyNumber}</TableCell>
                          <TableCell>{i.insuranceType.replace(/_/g, " ")}</TableCell>
                          <TableCell>{i.monthlyPremium ? `${formatCurrency(i.monthlyPremium)}/mo` : "\u2014"}</TableCell>
                          <TableCell>{i.deductible ? formatCurrency(i.deductible) : "\u2014"}</TableCell>
                          <TableCell>{i.reimbursementPct ? `${i.reimbursementPct}%` : "\u2014"}</TableCell>
                          <TableCell>
                            {isExpired ? (
                              <Badge variant="destructive">Expired</Badge>
                            ) : (
                              <Badge variant={i.isActive ? "default" : "secondary"}>
                                {i.isActive ? "Active" : "Inactive"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <form action={deletePetInsuranceAction}>
                              <input type="hidden" name="id" value={i.id} />
                              <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-red-500">
                                <Trash2 className="size-3.5" />
                              </Button>
                            </form>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function AppointmentStatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    SCHEDULED: "default",
    COMPLETED: "secondary",
    CANCELLED: "destructive",
    NO_SHOW: "destructive",
    RESCHEDULED: "outline",
  };

  return (
    <Badge variant={variants[status] || "outline"}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
