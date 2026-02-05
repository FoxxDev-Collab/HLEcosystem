using System.ComponentModel.DataAnnotations;

namespace HLE.FileServer.Models;

public class UserSettingsViewModel
{
    public string Id { get; set; } = string.Empty;

    [Display(Name = "Username")]
    public string Username { get; set; } = string.Empty;

    [Display(Name = "Email")]
    public string Email { get; set; } = string.Empty;

    [Display(Name = "First Name")]
    public string? FirstName { get; set; }

    [Display(Name = "Last Name")]
    public string? LastName { get; set; }

    [Display(Name = "Avatar Color")]
    [RegularExpression("^#[0-9A-Fa-f]{6}$", ErrorMessage = "Please enter a valid hex color code (e.g., #1e9df1)")]
    public string AvatarColor { get; set; } = "#1e9df1";

    public string Initials => GetInitials();

    private string GetInitials()
    {
        var first = !string.IsNullOrEmpty(FirstName) ? FirstName[0].ToString().ToUpper() : "";
        var last = !string.IsNullOrEmpty(LastName) ? LastName[0].ToString().ToUpper() : "";
        return first + last;
    }
}
