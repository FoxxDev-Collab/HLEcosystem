import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import type { User } from "@/lib/users";
import {
  createMediaRequestAction,
  updateRequestStatusAction,
  addCommentAction,
  deleteMediaRequestAction,
} from "./actions";

const MEDIA_TYPE_LABELS: Record<string, string> = {
  MOVIE: "Movie",
  TV_SHOW: "TV Show",
  MUSIC: "Music",
};

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const TYPE_COLORS: Record<string, string> = {
  MOVIE: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  TV_SHOW: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  MUSIC: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
};

async function getRequesterNames(requesterIds: string[]): Promise<Map<string, string>> {
  if (requesterIds.length === 0) return new Map();
  const users = await prisma.$queryRaw<Pick<User, "id" | "name">[]>`
    SELECT "id", "name"
    FROM family_manager."User"
    WHERE "id" = ANY(${requesterIds})
  `;
  return new Map(users.map((u) => [u.id, u.name]));
}

export default async function MediaRequestsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const requests = await prisma.mediaRequest.findMany({
    include: { comments: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  const requesterIds = [...new Set(requests.map((r) => r.requesterId))];
  const commentUserIds = [
    ...new Set(requests.flatMap((r) => r.comments.map((c) => c.userId))),
  ];
  const allUserIds = [...new Set([...requesterIds, ...commentUserIds])];
  const nameMap = await getRequesterNames(allUserIds);

  const requested = requests.filter((r) => r.status === "REQUESTED");
  const completed = requests.filter((r) => r.status === "COMPLETED");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Media Requests</h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{requested.length} requested</Badge>
          <Badge variant="outline">{completed.length} completed</Badge>
        </div>
      </div>

      {/* New Request Form */}
      <Card>
        <CardHeader>
          <CardTitle>Request Media</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createMediaRequestAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="mediaType">Type *</Label>
                <select
                  id="mediaType"
                  name="mediaType"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="MOVIE">Movie</option>
                  <option value="TV_SHOW">TV Show</option>
                  <option value="MUSIC">Music</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" name="title" required placeholder="e.g. The Dark Knight" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="artist">Artist / Director</Label>
                <Input id="artist" name="artist" placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input id="year" name="year" type="number" min="1900" max="2099" placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} placeholder="Any details — specific edition, season, album, etc." />
            </div>
            <Button type="submit">Submit Request</Button>
          </form>
        </CardContent>
      </Card>

      {/* Request Lists */}
      <Tabs defaultValue="requested">
        <TabsList>
          <TabsTrigger value="requested">Requested ({requested.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          <TabsTrigger value="all">All ({requests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="requested" className="space-y-3 mt-4">
          <RequestList
            requests={requested}
            nameMap={nameMap}
            currentUserId={user.id}
            isAdmin={user.role === "ADMIN"}
          />
        </TabsContent>
        <TabsContent value="completed" className="space-y-3 mt-4">
          <RequestList
            requests={completed}
            nameMap={nameMap}
            currentUserId={user.id}
            isAdmin={user.role === "ADMIN"}
          />
        </TabsContent>
        <TabsContent value="all" className="space-y-3 mt-4">
          <RequestList
            requests={requests}
            nameMap={nameMap}
            currentUserId={user.id}
            isAdmin={user.role === "ADMIN"}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type RequestWithComments = Awaited<
  ReturnType<typeof prisma.mediaRequest.findMany<{ include: { comments: true } }>>
>[number];

function RequestList({
  requests,
  nameMap,
  currentUserId,
  isAdmin,
}: {
  requests: RequestWithComments[];
  nameMap: Map<string, string>;
  currentUserId: string;
  isAdmin: boolean;
}) {
  if (requests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No requests in this category.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => {
        const isOwner = request.requesterId === currentUserId;
        const requesterName = nameMap.get(request.requesterId) ?? "Unknown";

        return (
          <Card key={request.id}>
            <CardContent className="pt-6 space-y-3">
              {/* Header row */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-lg">{request.title}</p>
                    <Badge className={TYPE_COLORS[request.mediaType]}>
                      {MEDIA_TYPE_LABELS[request.mediaType]}
                    </Badge>
                    <Badge className={STATUS_COLORS[request.status]}>
                      {request.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Requested by {requesterName}
                    {request.artist && ` \u00b7 ${request.artist}`}
                    {request.year && ` (${request.year})`}
                    {` \u00b7 ${formatDate(request.createdAt)}`}
                  </p>
                  {request.notes && (
                    <p className="text-sm text-muted-foreground">{request.notes}</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {request.status === "REQUESTED" && (
                    <form action={updateRequestStatusAction}>
                      <input type="hidden" name="id" value={request.id} />
                      <input type="hidden" name="status" value="COMPLETED" />
                      <Button type="submit" variant="outline" size="sm">
                        Mark Completed
                      </Button>
                    </form>
                  )}
                  {request.status === "COMPLETED" && (
                    <form action={updateRequestStatusAction}>
                      <input type="hidden" name="id" value={request.id} />
                      <input type="hidden" name="status" value="REQUESTED" />
                      <Button type="submit" variant="outline" size="sm">
                        Reopen
                      </Button>
                    </form>
                  )}
                  {(isOwner || isAdmin) && (
                    <form action={deleteMediaRequestAction}>
                      <input type="hidden" name="id" value={request.id} />
                      <Button type="submit" variant="ghost" size="sm" className="text-red-600">
                        Delete
                      </Button>
                    </form>
                  )}
                </div>
              </div>

              {/* Comments */}
              {request.comments.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  {request.comments.map((comment) => (
                    <div key={comment.id} className="text-sm">
                      <span className="font-medium">
                        {nameMap.get(comment.userId) ?? "Unknown"}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        {formatDate(comment.createdAt)}
                      </span>
                      <p className="text-muted-foreground">{comment.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add comment */}
              {request.status === "REQUESTED" && (
                <form action={addCommentAction} className="flex gap-2 pt-1">
                  <input type="hidden" name="requestId" value={request.id} />
                  <Input
                    name="message"
                    placeholder="Add a comment..."
                    className="flex-1"
                    required
                  />
                  <Button type="submit" variant="outline" size="sm">
                    Comment
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
