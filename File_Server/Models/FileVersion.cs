using System.ComponentModel.DataAnnotations;

namespace HLE.FileServer.Models;

/// <summary>
/// Stores previous versions of files for version history
/// </summary>
public class FileVersion
{
    public int Id { get; set; }

    /// <summary>
    /// The file entry this version belongs to
    /// </summary>
    public int FileEntryId { get; set; }

    /// <summary>
    /// Version number (1 = oldest, increments with each new version)
    /// </summary>
    public int VersionNumber { get; set; }

    /// <summary>
    /// Path to the versioned file on disk
    /// </summary>
    [Required]
    [MaxLength(500)]
    public string StoragePath { get; set; } = string.Empty;

    /// <summary>
    /// File size of this version in bytes
    /// </summary>
    public long FileSize { get; set; }

    /// <summary>
    /// SHA-256 hash of this version's content
    /// </summary>
    [MaxLength(64)]
    public string? ContentHash { get; set; }

    /// <summary>
    /// When this version was created (i.e., when the file was replaced)
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// User who created the newer version (replacing this one)
    /// </summary>
    [MaxLength(450)]
    public string? CreatedByUserId { get; set; }

    /// <summary>
    /// Optional note about this version
    /// </summary>
    [MaxLength(500)]
    public string? Note { get; set; }

    // Navigation
    public FileEntry? FileEntry { get; set; }
    public ApplicationUser? CreatedByUser { get; set; }
}
