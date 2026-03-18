import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatAddress(member: {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
}): string {
  const parts: string[] = [];
  if (member.addressLine1) parts.push(member.addressLine1);
  if (member.addressLine2) parts.push(member.addressLine2);
  const cityStateZip = [
    member.city,
    member.state && member.zipCode ? `${member.state} ${member.zipCode}` : member.state || member.zipCode,
  ].filter(Boolean).join(", ");
  if (cityStateZip) parts.push(cityStateZip);
  if (member.country) parts.push(member.country);
  return parts.join("\n");
}

export default async function AddressBookPage() {
  const householdId = (await getCurrentHouseholdId())!;

  const members = await prisma.familyMember.findMany({
    where: { householdId, includeInHolidayCards: true, isActive: true },
    orderBy: { lastName: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Address Book</h1>
        <p className="text-sm text-muted-foreground">Family members on your holiday card list</p>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No members on the holiday card list. Toggle &quot;Include in holiday card list&quot; on a family member to add them.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const address = formatAddress(member);
            return (
              <Card key={member.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{member.firstName} {member.lastName}</CardTitle>
                </CardHeader>
                <CardContent>
                  {address ? (
                    <pre className="text-sm text-muted-foreground whitespace-pre-line font-sans">{address}</pre>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No address on file</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
