"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Calendar, Clock, DollarSign, Edit, MapPin, Phone, Mail,
  Globe, Plus, Trash2, UserPlus, Users, Plane, Hotel, Car, UtensilsCrossed,
  Package, ChevronRight,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateRange } from "@/lib/format";
import { updateTripAction, updateTripStatusAction, deleteTripAction, addTravelerAction, removeTravelerAction } from "@/app/(app)/trips/actions";
import { createItineraryDayAction, deleteItineraryDayAction, createItineraryActivityAction, deleteItineraryActivityAction } from "@/app/(app)/itinerary/actions";
import { createReservationAction, deleteReservationAction } from "@/app/(app)/reservations/actions";
import { createPackingListAction, deletePackingListAction, addPackingItemAction, togglePackingItemAction, deletePackingItemAction } from "@/app/(app)/packing/actions";
import { createBudgetItemAction, deleteBudgetItemAction } from "@/app/(app)/budget/actions";
import { createTravelContactAction, deleteTravelContactAction } from "@/app/(app)/contacts/actions";
import type { HouseholdMember } from "@/lib/household-members";

type SerializedTrip = {
  id: string;
  householdId: string;
  name: string;
  description: string | null;
  destination: string | null;
  startDate: string;
  endDate: string;
  status: string;
  coverImageUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  travelers: Array<{
    id: string;
    tripId: string;
    householdMemberId: string;
    displayName: string;
    createdAt: string;
  }>;
  itineraryDays: Array<{
    id: string;
    tripId: string;
    date: string;
    title: string | null;
    notes: string | null;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
    activities: Array<{
      id: string;
      itineraryDayId: string;
      title: string;
      startTime: string | null;
      endTime: string | null;
      location: string | null;
      address: string | null;
      bookingRef: string | null;
      cost: number | null;
      currency: string;
      notes: string | null;
      sortOrder: number;
      createdAt: string;
      updatedAt: string;
    }>;
  }>;
  reservations: Array<{
    id: string;
    tripId: string;
    type: string;
    status: string;
    providerName: string;
    confirmationNumber: string | null;
    startDateTime: string | null;
    endDateTime: string | null;
    location: string | null;
    departureLocation: string | null;
    arrivalLocation: string | null;
    cost: number | null;
    currency: string;
    isPaid: boolean;
    bookingUrl: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  packingLists: Array<{
    id: string;
    tripId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    items: Array<{
      id: string;
      packingListId: string;
      name: string;
      category: string;
      quantity: number;
      isPacked: boolean;
      notes: string | null;
      sortOrder: number;
      createdAt: string;
      updatedAt: string;
    }>;
  }>;
  budgetItems: Array<{
    id: string;
    tripId: string;
    category: string;
    description: string;
    plannedAmount: number;
    actualAmount: number | null;
    currency: string;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  contacts: Array<{
    id: string;
    tripId: string;
    name: string;
    role: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    website: string | null;
    notes: string | null;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
  }>;
};

function reservationIcon(type: string) {
  switch (type) {
    case "FLIGHT": return <Plane className="size-4" />;
    case "HOTEL": return <Hotel className="size-4" />;
    case "CAR_RENTAL": return <Car className="size-4" />;
    case "RESTAURANT": return <UtensilsCrossed className="size-4" />;
    default: return <MapPin className="size-4" />;
  }
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "PLANNING": return "secondary";
    case "BOOKED": return "default";
    case "IN_PROGRESS": return "default";
    case "COMPLETED": return "outline";
    case "CANCELLED": return "destructive";
    default: return "secondary";
  }
}

// ─── Form Submit Helper ──────────────────────────────────────────────────────

function useFormAction() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function run(action: (fd: FormData) => Promise<{ error?: string }>, formData: FormData, onSuccess?: () => void) {
    setPending(true);
    setError("");
    const result = await action(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
    } else {
      onSuccess?.();
    }
  }

  return { error, pending, run, setError };
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({
  trip,
  householdMembers,
}: {
  trip: SerializedTrip;
  householdMembers: HouseholdMember[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [addTravelerOpen, setAddTravelerOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const editForm = useFormAction();
  const statusForm = useFormAction();
  const deleteForm = useFormAction();
  const travelerForm = useFormAction();

  const availableMembers = householdMembers.filter(
    (m) => !trip.travelers.some((t) => t.householdMemberId === m.id)
  );

  return (
    <div className="space-y-6">
      {/* Trip Info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Trip Details</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(trip.status)} className="capitalize">
              {trip.status.toLowerCase().replace("_", " ")}
            </Badge>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Edit className="size-3.5 mr-1" /> Edit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Trip</DialogTitle>
                </DialogHeader>
                <form
                  action={(fd) => editForm.run(updateTripAction, fd, () => setEditOpen(false))}
                  className="space-y-4"
                >
                  <input type="hidden" name="tripId" value={trip.id} />
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Name *</Label>
                    <Input id="edit-name" name="name" defaultValue={trip.name} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-dest">Destination</Label>
                    <Input id="edit-dest" name="destination" defaultValue={trip.destination ?? ""} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-start">Start Date *</Label>
                      <Input
                        id="edit-start"
                        name="startDate"
                        type="date"
                        defaultValue={trip.startDate.slice(0, 10)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-end">End Date *</Label>
                      <Input
                        id="edit-end"
                        name="endDate"
                        type="date"
                        defaultValue={trip.endDate.slice(0, 10)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-desc">Description</Label>
                    <Textarea id="edit-desc" name="description" defaultValue={trip.description ?? ""} rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-notes">Notes</Label>
                    <Textarea id="edit-notes" name="notes" defaultValue={trip.notes ?? ""} rows={2} />
                  </div>
                  {editForm.error && <p className="text-sm text-destructive">{editForm.error}</p>}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={editForm.pending}>
                      {editForm.pending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {trip.destination && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="size-4 text-muted-foreground" />
              <span>{trip.destination}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="size-4 text-muted-foreground" />
            <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
          </div>
          {trip.description && (
            <p className="text-sm text-muted-foreground">{trip.description}</p>
          )}
          {trip.notes && (
            <div className="rounded-md bg-muted p-3 text-sm">{trip.notes}</div>
          )}

          {/* Status Change */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Label className="text-sm">Change Status:</Label>
            <form action={(fd) => statusForm.run(updateTripStatusAction, fd)}>
              <input type="hidden" name="tripId" value={trip.id} />
              <div className="flex gap-1">
                {["PLANNING", "BOOKED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((s) => (
                  <Button
                    key={s}
                    type="submit"
                    name="status"
                    value={s}
                    variant={trip.status === s ? "default" : "outline"}
                    size="sm"
                    className="text-xs capitalize"
                    disabled={statusForm.pending}
                  >
                    {s.toLowerCase().replace("_", " ")}
                  </Button>
                ))}
              </div>
            </form>
          </div>

          {/* Delete */}
          <div className="pt-2 border-t">
            <form
              action={(fd) =>
                deleteForm.run(deleteTripAction, fd, () => router.push("/trips"))
              }
            >
              <input type="hidden" name="tripId" value={trip.id} />
              <Button type="submit" variant="destructive" size="sm" disabled={deleteForm.pending}>
                <Trash2 className="size-3.5 mr-1" />
                {deleteForm.pending ? "Deleting..." : "Delete Trip"}
              </Button>
            </form>
            {deleteForm.error && <p className="text-sm text-destructive mt-1">{deleteForm.error}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Travelers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" /> Travelers ({trip.travelers.length})
          </CardTitle>
          {availableMembers.length > 0 && (
            <Dialog open={addTravelerOpen} onOpenChange={setAddTravelerOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="size-3.5 mr-1" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Traveler</DialogTitle>
                </DialogHeader>
                <form
                  action={(fd) => {
                    const member = availableMembers.find((m) => m.id === selectedMemberId);
                    if (member) fd.set("displayName", member.displayName);
                    travelerForm.run(addTravelerAction, fd, () => {
                      setAddTravelerOpen(false);
                      setSelectedMemberId("");
                    });
                  }}
                  className="space-y-4"
                >
                  <input type="hidden" name="tripId" value={trip.id} />
                  <input type="hidden" name="householdMemberId" value={selectedMemberId} />
                  <div className="space-y-2">
                    <Label>Household Member</Label>
                    <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select member" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMembers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {travelerForm.error && <p className="text-sm text-destructive">{travelerForm.error}</p>}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setAddTravelerOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={travelerForm.pending || !selectedMemberId}>
                      {travelerForm.pending ? "Adding..." : "Add Traveler"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {trip.travelers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No travelers added yet.</p>
          ) : (
            <div className="space-y-2">
              {trip.travelers.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-md border p-2">
                  <span className="text-sm font-medium">{t.displayName}</span>
                  <form action={(fd) => travelerForm.run(removeTravelerAction, fd)}>
                    <input type="hidden" name="travelerId" value={t.id} />
                    <input type="hidden" name="tripId" value={trip.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Itinerary Tab ───────────────────────────────────────────────────────────

function ItineraryTab({ trip }: { trip: SerializedTrip }) {
  const [addDayOpen, setAddDayOpen] = useState(false);
  const [addActivityDayId, setAddActivityDayId] = useState<string | null>(null);
  const dayForm = useFormAction();
  const activityForm = useFormAction();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Itinerary</h3>
        <Dialog open={addDayOpen} onOpenChange={setAddDayOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-3.5 mr-1" /> Add Day
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Itinerary Day</DialogTitle>
            </DialogHeader>
            <form
              action={(fd) => dayForm.run(createItineraryDayAction, fd, () => setAddDayOpen(false))}
              className="space-y-4"
            >
              <input type="hidden" name="tripId" value={trip.id} />
              <div className="space-y-2">
                <Label htmlFor="day-date">Date *</Label>
                <Input
                  id="day-date"
                  name="date"
                  type="date"
                  min={trip.startDate.slice(0, 10)}
                  max={trip.endDate.slice(0, 10)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="day-title">Title</Label>
                <Input id="day-title" name="title" placeholder="e.g., Arrival Day" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="day-notes">Notes</Label>
                <Textarea id="day-notes" name="notes" rows={2} />
              </div>
              {dayForm.error && <p className="text-sm text-destructive">{dayForm.error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAddDayOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={dayForm.pending}>
                  {dayForm.pending ? "Adding..." : "Add Day"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {trip.itineraryDays.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No itinerary days yet. Add a day to start planning.
          </CardContent>
        </Card>
      ) : (
        trip.itineraryDays.map((day) => (
          <Card key={day.id}>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <div>
                <CardTitle className="text-base">
                  {formatDate(day.date)}
                  {day.title && <span className="text-muted-foreground font-normal"> - {day.title}</span>}
                </CardTitle>
                {day.notes && <p className="text-sm text-muted-foreground mt-0.5">{day.notes}</p>}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddActivityDayId(day.id)}
                >
                  <Plus className="size-3.5 mr-1" /> Activity
                </Button>
                <form action={(fd) => dayForm.run(deleteItineraryDayAction, fd)}>
                  <input type="hidden" name="dayId" value={day.id} />
                  <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </Button>
                </form>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {day.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activities planned.</p>
              ) : (
                <div className="space-y-2">
                  {day.activities.map((activity) => (
                    <div key={activity.id} className="flex items-start justify-between rounded-md border p-3">
                      <div className="space-y-0.5">
                        <div className="font-medium text-sm">{activity.title}</div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {(activity.startTime || activity.endTime) && (
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {activity.startTime}{activity.endTime && ` - ${activity.endTime}`}
                            </span>
                          )}
                          {activity.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3" /> {activity.location}
                            </span>
                          )}
                          {activity.cost !== null && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="size-3" /> {formatCurrency(activity.cost)}
                            </span>
                          )}
                        </div>
                        {activity.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{activity.notes}</p>
                        )}
                      </div>
                      <form action={(fd) => activityForm.run(deleteItineraryActivityAction, fd)}>
                        <input type="hidden" name="activityId" value={activity.id} />
                        <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="size-3" />
                        </Button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {/* Add Activity Dialog */}
      <Dialog open={!!addActivityDayId} onOpenChange={(o) => !o && setAddActivityDayId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Activity</DialogTitle>
          </DialogHeader>
          <form
            action={(fd) =>
              activityForm.run(createItineraryActivityAction, fd, () => setAddActivityDayId(null))
            }
            className="space-y-4"
          >
            <input type="hidden" name="itineraryDayId" value={addActivityDayId ?? ""} />
            <div className="space-y-2">
              <Label htmlFor="act-title">Title *</Label>
              <Input id="act-title" name="title" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="act-start">Start Time</Label>
                <Input id="act-start" name="startTime" type="time" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="act-end">End Time</Label>
                <Input id="act-end" name="endTime" type="time" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-location">Location</Label>
              <Input id="act-location" name="location" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-address">Address</Label>
              <Input id="act-address" name="address" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="act-ref">Booking Ref</Label>
                <Input id="act-ref" name="bookingRef" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="act-cost">Cost</Label>
                <Input id="act-cost" name="cost" type="number" step="0.01" min="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-notes">Notes</Label>
              <Textarea id="act-notes" name="notes" rows={2} />
            </div>
            {activityForm.error && <p className="text-sm text-destructive">{activityForm.error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddActivityDayId(null)}>Cancel</Button>
              <Button type="submit" disabled={activityForm.pending}>
                {activityForm.pending ? "Adding..." : "Add Activity"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Reservations Tab ────────────────────────────────────────────────────────

const RESERVATION_TYPES = [
  "FLIGHT", "HOTEL", "CAR_RENTAL", "RESTAURANT", "ACTIVITY",
  "TRAIN", "BUS", "FERRY", "CRUISE", "OTHER",
] as const;

function ReservationsTab({ trip }: { trip: SerializedTrip }) {
  const [addOpen, setAddOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("FLIGHT");
  const form = useFormAction();

  const isTransport = ["FLIGHT", "TRAIN", "BUS", "FERRY", "CRUISE"].includes(selectedType);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Reservations ({trip.reservations.length})</h3>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-3.5 mr-1" /> Add Reservation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Reservation</DialogTitle>
            </DialogHeader>
            <form
              action={(fd) => form.run(createReservationAction, fd, () => setAddOpen(false))}
              className="space-y-4"
            >
              <input type="hidden" name="tripId" value={trip.id} />
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  name="type"
                  value={selectedType}
                  onValueChange={setSelectedType}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESERVATION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="res-provider">Provider Name *</Label>
                <Input id="res-provider" name="providerName" required placeholder={isTransport ? "Airline / Rail Co." : "Hotel / Venue"} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="res-confirm">Confirmation Number</Label>
                <Input id="res-confirm" name="confirmationNumber" />
              </div>

              {isTransport ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="res-dep">Departure Location</Label>
                    <Input id="res-dep" name="departureLocation" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="res-arr">Arrival Location</Label>
                    <Input id="res-arr" name="arrivalLocation" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="res-start">Departure</Label>
                      <Input id="res-start" name="startDateTime" type="datetime-local" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="res-end">Arrival</Label>
                      <Input id="res-end" name="endDateTime" type="datetime-local" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="res-loc">Location</Label>
                    <Input id="res-loc" name="location" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="res-checkin">{selectedType === "HOTEL" ? "Check-in" : "Start"}</Label>
                      <Input id="res-checkin" name="startDateTime" type="datetime-local" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="res-checkout">{selectedType === "HOTEL" ? "Check-out" : "End"}</Label>
                      <Input id="res-checkout" name="endDateTime" type="datetime-local" />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="res-cost">Cost</Label>
                  <Input id="res-cost" name="cost" type="number" step="0.01" min="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="res-currency">Currency</Label>
                  <Select name="currency" defaultValue="USD">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "MXN", "CHF", "OTHER"].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="res-url">Booking URL</Label>
                <Input id="res-url" name="bookingUrl" type="url" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="res-phone">Contact Phone</Label>
                  <Input id="res-phone" name="contactPhone" type="tel" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="res-email">Contact Email</Label>
                  <Input id="res-email" name="contactEmail" type="email" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="res-notes">Notes</Label>
                <Textarea id="res-notes" name="notes" rows={2} />
              </div>
              {form.error && <p className="text-sm text-destructive">{form.error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={form.pending}>
                  {form.pending ? "Adding..." : "Add Reservation"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {trip.reservations.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No reservations yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {trip.reservations.map((res) => {
            const isTransportRes = ["FLIGHT", "TRAIN", "BUS", "FERRY", "CRUISE"].includes(res.type);
            return (
              <Card key={res.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        {reservationIcon(res.type)}
                        <span className="font-medium">{res.providerName}</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {res.type.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                        <Badge
                          variant={res.status === "CONFIRMED" ? "default" : res.status === "CANCELLED" ? "destructive" : "secondary"}
                          className="text-xs capitalize"
                        >
                          {res.status.toLowerCase()}
                        </Badge>
                      </div>
                      {isTransportRes && (res.departureLocation || res.arrivalLocation) && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{res.departureLocation}</span>
                          <ChevronRight className="size-3" />
                          <span>{res.arrivalLocation}</span>
                        </div>
                      )}
                      {!isTransportRes && res.location && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="size-3" /> {res.location}
                        </div>
                      )}
                      {(res.startDateTime || res.endDateTime) && (
                        <div className="text-xs text-muted-foreground">
                          {res.startDateTime && formatDate(res.startDateTime)}
                          {res.endDateTime && ` - ${formatDate(res.endDateTime)}`}
                        </div>
                      )}
                      {res.confirmationNumber && (
                        <div className="text-xs text-muted-foreground">
                          Conf: {res.confirmationNumber}
                        </div>
                      )}
                      {res.cost !== null && (
                        <div className="text-sm font-medium">
                          {formatCurrency(res.cost, res.currency)}
                          {res.isPaid && <Badge variant="outline" className="ml-2 text-xs">Paid</Badge>}
                        </div>
                      )}
                    </div>
                    <form action={(fd) => form.run(deleteReservationAction, fd)}>
                      <input type="hidden" name="reservationId" value={res.id} />
                      <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Packing Tab ─────────────────────────────────────────────────────────────

const PACKING_CATEGORIES = [
  "CLOTHING", "TOILETRIES", "ELECTRONICS", "DOCUMENTS",
  "MEDICATIONS", "ACCESSORIES", "GEAR", "SNACKS", "OTHER",
] as const;

function PackingTab({ trip }: { trip: SerializedTrip }) {
  const [addListOpen, setAddListOpen] = useState(false);
  const [addItemListId, setAddItemListId] = useState<string | null>(null);
  const listForm = useFormAction();
  const itemForm = useFormAction();

  const allItems = trip.packingLists.flatMap((l) => l.items);
  const packedCount = allItems.filter((i) => i.isPacked).length;
  const totalCount = allItems.length;
  const packedPercent = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Packing Lists</h3>
        <Dialog open={addListOpen} onOpenChange={setAddListOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-3.5 mr-1" /> New List
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Packing List</DialogTitle>
            </DialogHeader>
            <form
              action={(fd) => listForm.run(createPackingListAction, fd, () => setAddListOpen(false))}
              className="space-y-4"
            >
              <input type="hidden" name="tripId" value={trip.id} />
              <div className="space-y-2">
                <Label htmlFor="list-name">List Name *</Label>
                <Input id="list-name" name="name" required placeholder="e.g., Carry-on, Checked Bag" />
              </div>
              {listForm.error && <p className="text-sm text-destructive">{listForm.error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAddListOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={listForm.pending}>
                  {listForm.pending ? "Creating..." : "Create List"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overall progress */}
      {totalCount > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">{packedCount}/{totalCount} packed ({packedPercent}%)</span>
            </div>
            <Progress value={packedPercent} className="h-2" />
          </CardContent>
        </Card>
      )}

      {trip.packingLists.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No packing lists yet. Create one to start packing.
          </CardContent>
        </Card>
      ) : (
        trip.packingLists.map((list) => {
          const listPacked = list.items.filter((i) => i.isPacked).length;
          const listTotal = list.items.length;
          const listPercent = listTotal > 0 ? Math.round((listPacked / listTotal) * 100) : 0;

          return (
            <Card key={list.id}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="size-4" />
                    {list.name}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({listPacked}/{listTotal})
                    </span>
                  </CardTitle>
                  {listTotal > 0 && <Progress value={listPercent} className="h-1.5 mt-2 w-48" />}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddItemListId(list.id)}
                  >
                    <Plus className="size-3.5 mr-1" /> Item
                  </Button>
                  <form action={(fd) => listForm.run(deletePackingListAction, fd)}>
                    <input type="hidden" name="listId" value={list.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </form>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {list.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items yet.</p>
                ) : (
                  <div className="space-y-1">
                    {list.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50">
                        <div className="flex items-center gap-2">
                          <form action={(fd) => itemForm.run(togglePackingItemAction, fd)}>
                            <input type="hidden" name="itemId" value={item.id} />
                            <Checkbox
                              checked={item.isPacked}
                              onCheckedChange={() => {
                                const fd = new FormData();
                                fd.set("itemId", item.id);
                                itemForm.run(togglePackingItemAction, fd);
                              }}
                            />
                          </form>
                          <span className={`text-sm ${item.isPacked ? "line-through text-muted-foreground" : ""}`}>
                            {item.name}
                            {item.quantity > 1 && <span className="text-muted-foreground"> x{item.quantity}</span>}
                          </span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {item.category.toLowerCase()}
                          </Badge>
                        </div>
                        <form action={(fd) => itemForm.run(deletePackingItemAction, fd)}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive h-6 w-6 p-0">
                            <Trash2 className="size-3" />
                          </Button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Add Item Dialog */}
      <Dialog open={!!addItemListId} onOpenChange={(o) => !o && setAddItemListId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Packing Item</DialogTitle>
          </DialogHeader>
          <form
            action={(fd) => itemForm.run(addPackingItemAction, fd, () => setAddItemListId(null))}
            className="space-y-4"
          >
            <input type="hidden" name="packingListId" value={addItemListId ?? ""} />
            <div className="space-y-2">
              <Label htmlFor="item-name">Item Name *</Label>
              <Input id="item-name" name="name" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select name="category" defaultValue="OTHER">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PACKING_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-qty">Quantity</Label>
                <Input id="item-qty" name="quantity" type="number" min="1" defaultValue="1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-notes">Notes</Label>
              <Input id="item-notes" name="notes" />
            </div>
            {itemForm.error && <p className="text-sm text-destructive">{itemForm.error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddItemListId(null)}>Cancel</Button>
              <Button type="submit" disabled={itemForm.pending}>
                {itemForm.pending ? "Adding..." : "Add Item"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Budget Tab ──────────────────────────────────────────────────────────────

const BUDGET_CATEGORIES = [
  "FLIGHTS", "ACCOMMODATION", "TRANSPORTATION", "FOOD_AND_DRINK",
  "ACTIVITIES", "SHOPPING", "INSURANCE", "VISA_AND_FEES", "COMMUNICATION", "OTHER",
] as const;

function BudgetTab({ trip }: { trip: SerializedTrip }) {
  const [addOpen, setAddOpen] = useState(false);
  const form = useFormAction();

  const totalPlanned = trip.budgetItems.reduce((sum, b) => sum + b.plannedAmount, 0);
  const totalActual = trip.budgetItems.reduce((sum, b) => sum + (b.actualAmount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Budget</h3>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-3.5 mr-1" /> Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Budget Item</DialogTitle>
            </DialogHeader>
            <form
              action={(fd) => form.run(createBudgetItemAction, fd, () => setAddOpen(false))}
              className="space-y-4"
            >
              <input type="hidden" name="tripId" value={trip.id} />
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select name="category" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUDGET_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget-desc">Description *</Label>
                <Input id="budget-desc" name="description" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="budget-planned">Planned Amount *</Label>
                  <Input id="budget-planned" name="plannedAmount" type="number" step="0.01" min="0" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget-actual">Actual Amount</Label>
                  <Input id="budget-actual" name="actualAmount" type="number" step="0.01" min="0" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget-notes">Notes</Label>
                <Input id="budget-notes" name="notes" />
              </div>
              {form.error && <p className="text-sm text-destructive">{form.error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={form.pending}>
                  {form.pending ? "Adding..." : "Add Item"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {trip.budgetItems.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No budget items yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Planned</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Diff</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trip.budgetItems.map((item) => {
                  const diff = item.actualAmount !== null ? item.plannedAmount - item.actualAmount : null;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {item.category.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{item.description}</div>
                        {item.notes && <div className="text-xs text-muted-foreground">{item.notes}</div>}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.plannedAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.actualAmount !== null ? formatCurrency(item.actualAmount) : "--"}
                      </TableCell>
                      <TableCell className={`text-right ${diff !== null ? (diff >= 0 ? "text-green-600" : "text-red-600") : ""}`}>
                        {diff !== null ? (diff >= 0 ? "+" : "") + formatCurrency(Math.abs(diff)) : "--"}
                      </TableCell>
                      <TableCell>
                        <form action={(fd) => form.run(deleteBudgetItemAction, fd)}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive h-6 w-6 p-0">
                            <Trash2 className="size-3" />
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">Totals</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(totalPlanned)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(totalActual)}</TableCell>
                  <TableCell className={`text-right font-semibold ${totalPlanned - totalActual >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {(totalPlanned - totalActual >= 0 ? "+" : "") + formatCurrency(Math.abs(totalPlanned - totalActual))}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Contacts Tab ────────────────────────────────────────────────────────────

function ContactsTab({ trip }: { trip: SerializedTrip }) {
  const [addOpen, setAddOpen] = useState(false);
  const form = useFormAction();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Contacts ({trip.contacts.length})</h3>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-3.5 mr-1" /> Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Travel Contact</DialogTitle>
            </DialogHeader>
            <form
              action={(fd) => form.run(createTravelContactAction, fd, () => setAddOpen(false))}
              className="space-y-4"
            >
              <input type="hidden" name="tripId" value={trip.id} />
              <div className="space-y-2">
                <Label htmlFor="contact-name">Name *</Label>
                <Input id="contact-name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-role">Role</Label>
                <Input id="contact-role" name="role" placeholder="e.g., Tour Guide, Hotel Concierge" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Phone</Label>
                  <Input id="contact-phone" name="phone" type="tel" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email</Label>
                  <Input id="contact-email" name="email" type="email" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-address">Address</Label>
                <Input id="contact-address" name="address" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-website">Website</Label>
                <Input id="contact-website" name="website" type="url" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-notes">Notes</Label>
                <Textarea id="contact-notes" name="notes" rows={2} />
              </div>
              {form.error && <p className="text-sm text-destructive">{form.error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={form.pending}>
                  {form.pending ? "Adding..." : "Add Contact"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {trip.contacts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No travel contacts yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {trip.contacts.map((contact) => (
            <Card key={contact.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{contact.name}</span>
                      {contact.role && (
                        <Badge variant="outline" className="text-xs">{contact.role}</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {contact.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="size-3" /> {contact.phone}
                        </span>
                      )}
                      {contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="size-3" /> {contact.email}
                        </span>
                      )}
                      {contact.website && (
                        <a
                          href={contact.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:underline"
                        >
                          <Globe className="size-3" /> Website
                        </a>
                      )}
                    </div>
                    {contact.address && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="size-3" /> {contact.address}
                      </div>
                    )}
                    {contact.notes && (
                      <p className="text-xs text-muted-foreground">{contact.notes}</p>
                    )}
                  </div>
                  <form action={(fd) => form.run(deleteTravelContactAction, fd)}>
                    <input type="hidden" name="contactId" value={contact.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function TripDetailTabs({
  trip,
  householdMembers,
}: {
  trip: SerializedTrip;
  householdMembers: HouseholdMember[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/trips">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{trip.name}</h1>
          <p className="text-sm text-muted-foreground">
            {trip.destination && `${trip.destination} · `}
            {formatDateRange(trip.startDate, trip.endDate)}
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="itinerary">Itinerary</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="packing">Packing</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab trip={trip} householdMembers={householdMembers} />
        </TabsContent>
        <TabsContent value="itinerary">
          <ItineraryTab trip={trip} />
        </TabsContent>
        <TabsContent value="reservations">
          <ReservationsTab trip={trip} />
        </TabsContent>
        <TabsContent value="packing">
          <PackingTab trip={trip} />
        </TabsContent>
        <TabsContent value="budget">
          <BudgetTab trip={trip} />
        </TabsContent>
        <TabsContent value="contacts">
          <ContactsTab trip={trip} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
