using System.ComponentModel.DataAnnotations;

namespace HLE.FileServer.Models;

public class FileEntry
{
    public int Id { get; set; }

    [Required]
    [MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    [MaxLength(500)]
    public string StoragePath { get; set; } = string.Empty;

    public long FileSize { get; set; } // Size in bytes

    [MaxLength(100)]
    public string ContentType { get; set; } = string.Empty;

    public DateTime UploadDate { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Last time file content was modified (for caching headers)
    /// </summary>
    public DateTime LastModified { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// SHA-256 hash of file content (for ETag and deduplication)
    /// </summary>
    [MaxLength(64)]
    public string? ContentHash { get; set; }

    // Soft delete support (trash bin)
    public bool IsDeleted { get; set; } = false;

    public DateTime? DeletedDate { get; set; }

    /// <summary>
    /// Original parent folder before deletion (for restore)
    /// </summary>
    public int? OriginalParentFolderId { get; set; }

    /// <summary>
    /// Current version number (incremented on each update)
    /// </summary>
    public int CurrentVersion { get; set; } = 1;

    /// <summary>
    /// Whether versioning is enabled for this file
    /// </summary>
    public bool VersioningEnabled { get; set; } = true;

    [Required]
    public string UserId { get; set; } = string.Empty;

    // Folder support
    public bool IsFolder { get; set; } = false;

    public int? ParentFolderId { get; set; }

    // Navigation properties
    public ApplicationUser? User { get; set; }

    public FileEntry? ParentFolder { get; set; }

    public ICollection<FileEntry> Children { get; set; } = new List<FileEntry>();

    /// <summary>
    /// Version history for this file
    /// </summary>
    public ICollection<FileVersion> Versions { get; set; } = new List<FileVersion>();
}
