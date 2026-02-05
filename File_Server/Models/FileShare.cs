using System.ComponentModel.DataAnnotations;

namespace HLE.FileServer.Models;

public class FileShare
{
    public int Id { get; set; }

    [Required]
    public int FileEntryId { get; set; }

    [Required]
    public string OwnerId { get; set; } = string.Empty; // User who shared the file

    [Required]
    public string SharedWithUserId { get; set; } = string.Empty; // User who receives the share

    public SharePermission Permission { get; set; } = SharePermission.ViewOnly;

    public DateTime SharedDate { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public FileEntry? FileEntry { get; set; }
    public ApplicationUser? Owner { get; set; }
    public ApplicationUser? SharedWithUser { get; set; }
}

public enum SharePermission
{
    ViewOnly = 0,        // Can only view and download
    ViewAndUpload = 1,   // Can view, download, and upload files to folder
    Edit = 2             // Can view, download, upload, delete, and move
}
