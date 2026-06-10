import { createFileRoute, Link } from "@tanstack/react-router"
import { BookUser } from "lucide-react"
import { getAddressBookFn } from "@/server/hub/fns.people"
import type { FamilyMemberRow } from "@/server/hub/people"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/_authed/hub/address-book")({
  loader: () => getAddressBookFn(),
  component: AddressBookPage,
})

function formatAddress(member: FamilyMemberRow): Array<string> {
  const lines: Array<string> = []
  if (member.addressLine1) lines.push(member.addressLine1)
  if (member.addressLine2) lines.push(member.addressLine2)
  const cityStateZip = [
    member.city,
    member.state && member.zipCode
      ? `${member.state} ${member.zipCode}`
      : member.state || member.zipCode,
  ]
    .filter(Boolean)
    .join(", ")
  if (cityStateZip) lines.push(cityStateZip)
  if (member.country) lines.push(member.country)
  return lines
}

function AddressBookPage() {
  const members = Route.useLoaderData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Address Book</h1>
        <p className="text-sm text-muted-foreground">
          Family members on your holiday card list
        </p>
      </div>

      {members.length === 0 ? (
        <div className="py-8 text-center">
          <BookUser className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No members on the holiday card list. Toggle &quot;Include in holiday
            card list&quot; on a{" "}
            <Link to="/hub/people" className="text-primary hover:underline">
              family member
            </Link>{" "}
            to add them.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const lines = formatAddress(member)
            return (
              <Card key={member.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    <Link
                      to="/hub/people/$id"
                      params={{ id: member.id }}
                      className="hover:underline"
                    >
                      {member.firstName} {member.lastName}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lines.length > 0 ? (
                    <div className="text-sm text-muted-foreground">
                      {lines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No address on file
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
