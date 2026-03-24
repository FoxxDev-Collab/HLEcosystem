"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Share2,
  Plus,
  X,
  Link2,
  Copy,
  Check,
  Users,
  ExternalLink,
} from "lucide-react";

type ShareInfo = {
  id: string;
  sharedWithUserId: string;
  sharedWithName?: string;
  permission: string;
  createdAt: string;
};

type ShareLinkInfo = {
  id: string;
  token: string;
  permission: string;
  expiresAt: string | null;
  maxDownloads: number | null;
  downloadCount: number;
  isActive: boolean;
};

type HouseholdMember = {
  id: string;
  name: string;
  email: string;
};

type Props = {
  fileId: string;
  shares: ShareInfo[];
  shareLinks: ShareLinkInfo[];
  currentUserId: string;
};

export function FileShareManager({
  fileId,
  shares,
  shareLinks,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedPermission, setSelectedPermission] = useState("VIEW");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Fetch household members
  useEffect(() => {
    if (!showAddUser) return;
    fetch("/api/files/household-members")
      .then((r) => r.json())
      .then((data) => setMembers(data.members ?? []))
      .catch(() => {});
  }, [showAddUser]);

  const alreadySharedIds = new Set(shares.map((s) => s.sharedWithUserId));
  const availableMembers = members.filter(
    (m) => m.id !== currentUserId && !alreadySharedIds.has(m.id)
  );

  const handleShare = () => {
    if (!selectedUserId) return;
    startTransition(async () => {
      const { shareFileAction } = await import("@/app/(app)/shared/actions");
      const fd = new FormData();
      fd.append("fileId", fileId);
      fd.append("sharedWithUserId", selectedUserId);
      fd.append("permission", selectedPermission);
      await shareFileAction(fd);
      setSelectedUserId("");
      setShowAddUser(false);
      router.refresh();
    });
  };

  const handleRemoveShare = (shareId: string) => {
    startTransition(async () => {
      const { removeShareAction } = await import("@/app/(app)/shared/actions");
      const fd = new FormData();
      fd.append("shareId", shareId);
      await removeShareAction(fd);
      router.refresh();
    });
  };

  const handleCreateLink = () => {
    startTransition(async () => {
      const { createShareLinkAction } = await import("@/app/(app)/shared/actions");
      const fd = new FormData();
      fd.append("fileId", fileId);
      fd.append("permission", "DOWNLOAD");
      await createShareLinkAction(fd);
      router.refresh();
    });
  };

  const handleRevokeLink = (shareLinkId: string) => {
    startTransition(async () => {
      const { revokeShareLinkAction } = await import("@/app/(app)/shared/actions");
      const fd = new FormData();
      fd.append("shareLinkId", shareLinkId);
      await revokeShareLinkAction(fd);
      router.refresh();
    });
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const activeLinks = shareLinks.filter((l) => l.isActive);

  return (
    <div className={`space-y-3 ${isPending ? "opacity-60" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Share2 className="size-4" />
          Sharing
        </div>
      </div>

      {/* User shares */}
      {shares.length > 0 && (
        <div className="space-y-1.5">
          {shares.map((share) => (
            <div
              key={share.id}
              className="flex items-center justify-between gap-2 text-xs group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Users className="size-3 text-muted-foreground shrink-0" />
                <span className="truncate">
                  {share.sharedWithName || share.sharedWithUserId}
                </span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {share.permission}
                </Badge>
              </div>
              <button
                onClick={() => handleRemoveShare(share.id)}
                className="p-0.5 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Share links */}
      {activeLinks.length > 0 && (
        <div className="space-y-1.5">
          {activeLinks.map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between gap-2 text-xs group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="size-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Share link</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {link.permission}
                </Badge>
                {link.downloadCount > 0 && (
                  <span className="text-muted-foreground">
                    {link.downloadCount} downloads
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => copyLink(link.token)}
                  className="p-0.5 rounded text-muted-foreground hover:text-foreground"
                  title="Copy link"
                >
                  {copiedToken === link.token ? (
                    <Check className="size-3 text-green-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
                <button
                  onClick={() => handleRevokeLink(link.id)}
                  className="p-0.5 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Revoke"
                >
                  <X className="size-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add share actions */}
      <div className="flex gap-1.5">
        <Popover open={showAddUser} onOpenChange={setShowAddUser}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs flex-1">
              <Plus className="size-3 mr-1" />
              Share with user
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Person</label>
                {availableMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    {members.length === 0 ? "Loading..." : "No more members to share with"}
                  </p>
                ) : (
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select person..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Permission</label>
                <Select value={selectedPermission} onValueChange={setSelectedPermission}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIEW" className="text-xs">View</SelectItem>
                    <SelectItem value="DOWNLOAD" className="text-xs">Download</SelectItem>
                    <SelectItem value="EDIT" className="text-xs">Edit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                className="w-full h-7 text-xs"
                onClick={handleShare}
                disabled={!selectedUserId}
              >
                Share
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={handleCreateLink}
        >
          <Link2 className="size-3 mr-1" />
          Create link
        </Button>
      </div>
    </div>
  );
}
