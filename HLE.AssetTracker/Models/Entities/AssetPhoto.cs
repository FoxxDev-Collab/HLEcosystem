namespace HLE.AssetTracker.Models.Entities;

/// <summary>
/// Represents a photo attached to an asset
/// </summary>
public class AssetPhoto
{
    public int Id { get; set; }

    public int AssetId { get; set; }

    /// <summary>
    /// Original file name
    /// </summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>
    /// Relative path to stored file
    /// </summary>
    public string FilePath { get; set; } = string.Empty;

    /// <summary>
    /// MIME content type
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// File size in bytes
    /// </summary>
    public long FileSize { get; set; }

    /// <summary>
    /// Whether this is the primary/thumbnail photo
    /// </summary>
    public bool IsPrimary { get; set; }

    /// <summary>
    /// Authentik user ID who uploaded this photo
    /// </summary>
    public string UploadedByUserId { get; set; } = string.Empty;

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Asset Asset { get; set; } = null!;
}
