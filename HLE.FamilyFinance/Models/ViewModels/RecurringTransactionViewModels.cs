using System.ComponentModel.DataAnnotations;
using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.ViewModels;

public class RecurringTransactionCreateViewModel
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = "";

    [Required]
    public TransactionType Type { get; set; }

    [Required]
    public int AccountId { get; set; }

    public int? CategoryId { get; set; }

    [Required]
    [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than zero")]
    public decimal Amount { get; set; }

    [StringLength(200)]
    public string? Payee { get; set; }

    [StringLength(500)]
    public string? Description { get; set; }

    [Required]
    public RecurrenceFrequency Frequency { get; set; }

    [Required]
    [Range(1, 12)]
    public int FrequencyInterval { get; set; } = 1;

    [Required]
    [Range(1, 31)]
    public int DayOfPeriod { get; set; } = 1;

    [Required]
    public DateOnly StartDate { get; set; } = DateOnly.FromDateTime(DateTime.Today);

    public DateOnly? EndDate { get; set; }

    public bool AutoCreate { get; set; }

    // For transfers
    public int? TransferToAccountId { get; set; }
}

public class RecurringTransactionEditViewModel
{
    public int Id { get; set; }

    [Required]
    [StringLength(200)]
    public string Name { get; set; } = "";

    [Required]
    public int AccountId { get; set; }

    public int? CategoryId { get; set; }

    [Required]
    [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than zero")]
    public decimal Amount { get; set; }

    [StringLength(200)]
    public string? Payee { get; set; }

    [StringLength(500)]
    public string? Description { get; set; }

    [Required]
    public RecurrenceFrequency Frequency { get; set; }

    [Required]
    [Range(1, 12)]
    public int FrequencyInterval { get; set; }

    [Required]
    [Range(1, 31)]
    public int DayOfPeriod { get; set; }

    public DateOnly? EndDate { get; set; }

    public bool AutoCreate { get; set; }

    public bool IsActive { get; set; }
}
