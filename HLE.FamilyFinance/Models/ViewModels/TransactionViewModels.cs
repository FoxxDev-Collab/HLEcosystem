using System.ComponentModel.DataAnnotations;
using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.ViewModels;

public class TransactionCreateViewModel
{
    [Required]
    public int AccountId { get; set; }

    public int? CategoryId { get; set; }

    [Required]
    public TransactionType Type { get; set; }

    [Required]
    [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than zero")]
    public decimal Amount { get; set; }

    [Required]
    public DateOnly Date { get; set; } = DateOnly.FromDateTime(DateTime.Today);

    [StringLength(200)]
    public string? Payee { get; set; }

    [StringLength(500)]
    public string? Description { get; set; }

    // For transfers
    public int? TransferToAccountId { get; set; }
}

public class TransactionEditViewModel
{
    public int Id { get; set; }

    [Required]
    public int AccountId { get; set; }

    public int? CategoryId { get; set; }

    [Required]
    public TransactionType Type { get; set; }

    [Required]
    [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than zero")]
    public decimal Amount { get; set; }

    [Required]
    public DateOnly Date { get; set; }

    [StringLength(200)]
    public string? Payee { get; set; }

    [StringLength(500)]
    public string? Description { get; set; }
}

public class TransactionFilterViewModel
{
    public int? AccountId { get; set; }
    public int? CategoryId { get; set; }
    public TransactionType? Type { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public string? Search { get; set; }
    public string SortBy { get; set; } = "date";
    public bool SortDesc { get; set; } = true;
    public int Page { get; set; } = 1;
}
