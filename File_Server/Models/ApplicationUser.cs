namespace HLE.FileServer.Models;

public class ApplicationUser
{
    public string Id { get; set; } = string.Empty;
    public string ExternalId { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginDate { get; set; }
    public bool IsActive { get; set; } = true;
    public string AvatarColor { get; set; } = "#1e9df1";
}
