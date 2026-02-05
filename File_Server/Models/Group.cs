using System.ComponentModel.DataAnnotations;

namespace HLE.FileServer.Models;

public class Group
{
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    public string OwnerId { get; set; } = string.Empty;

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    public bool IsActive { get; set; } = true;

    // Storage quota in bytes (0 = unlimited)
    public long StorageQuotaBytes { get; set; } = 0;

    // Current storage used in bytes
    public long StorageUsedBytes { get; set; } = 0;

    // Navigation properties
    public ApplicationUser? Owner { get; set; }
    public ICollection<GroupMember> Members { get; set; } = new List<GroupMember>();
    public ICollection<GroupFile> Files { get; set; } = new List<GroupFile>();
}

public class GroupMember
{
    public int Id { get; set; }

    [Required]
    public int GroupId { get; set; }

    [Required]
    public string UserId { get; set; } = string.Empty;

    public GroupRole Role { get; set; } = GroupRole.Member;

    public DateTime JoinedDate { get; set; } = DateTime.UtcNow;

    // Permissions
    public bool CanUpload { get; set; } = true;
    public bool CanDownload { get; set; } = true;
    public bool CanDelete { get; set; } = false;
    public bool CanManageMembers { get; set; } = false;

    // Navigation properties
    public Group? Group { get; set; }
    public ApplicationUser? User { get; set; }
}

public class GroupFile
{
    public int Id { get; set; }

    [Required]
    public int GroupId { get; set; }

    [Required]
    [MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    [MaxLength(500)]
    public string StoragePath { get; set; } = string.Empty;

    public long FileSize { get; set; }

    [MaxLength(100)]
    public string ContentType { get; set; } = string.Empty;

    public DateTime UploadDate { get; set; } = DateTime.UtcNow;

    [Required]
    public string UploadedById { get; set; } = string.Empty;

    // Folder support within groups
    public bool IsFolder { get; set; } = false;
    public int? ParentFolderId { get; set; }

    // Navigation properties
    public Group? Group { get; set; }
    public ApplicationUser? UploadedBy { get; set; }
    public GroupFile? ParentFolder { get; set; }
    public ICollection<GroupFile> Children { get; set; } = new List<GroupFile>();
}

public enum GroupRole
{
    Member = 0,    // Regular member with limited permissions
    Admin = 1,     // Can manage members and settings
    Owner = 2      // Full control, can delete group
}
