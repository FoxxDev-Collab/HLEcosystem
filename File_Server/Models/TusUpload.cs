using System.ComponentModel.DataAnnotations;

namespace HLE.FileServer.Models;

/// <summary>
/// Tracks incomplete resumable uploads (TUS protocol)
/// </summary>
public class TusUpload
{
    public int Id { get; set; }

    /// <summary>
    /// Unique upload identifier (used in URL)
    /// </summary>
    [Required]
    [MaxLength(64)]
    public string UploadId { get; set; } = string.Empty;

    /// <summary>
    /// Original filename from client
    /// </summary>
    [Required]
    [MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    /// <summary>
    /// Total expected file size in bytes
    /// </summary>
    public long TotalSize { get; set; }

    /// <summary>
    /// Current uploaded offset (bytes received so far)
    /// </summary>
    public long UploadedBytes { get; set; }

    /// <summary>
    /// Path to the temporary partial file on disk
    /// </summary>
    [MaxLength(500)]
    public string TempFilePath { get; set; } = string.Empty;

    /// <summary>
    /// Target folder for completed upload (null = root)
    /// </summary>
    public int? TargetFolderId { get; set; }

    /// <summary>
    /// MIME type from client metadata
    /// </summary>
    [MaxLength(100)]
    public string? ContentType { get; set; }

    /// <summary>
    /// Upload creation timestamp
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Last chunk received timestamp
    /// </summary>
    public DateTime LastActivity { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Upload expiration (for cleanup of abandoned uploads)
    /// </summary>
    public DateTime ExpiresAt { get; set; }

    /// <summary>
    /// Whether the upload is complete and ready for finalization
    /// </summary>
    public bool IsComplete { get; set; } = false;

    /// <summary>
    /// Owner of this upload
    /// </summary>
    [Required]
    public string UserId { get; set; } = string.Empty;

    // Navigation
    public ApplicationUser? User { get; set; }
}
