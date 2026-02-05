using System.ComponentModel.DataAnnotations;

namespace HLE.FamilyHealth.Models.Entities;

/// <summary>
/// Represents a standalone medical expense not tied to a visit (e.g., equipment, supplies, glasses, etc.)
/// </summary>
public class MedicalExpense
{
    public int Id { get; set; }

    [Required]
    public int FamilyMemberId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Category of expense (e.g., Medical Equipment, Vision, Dental, Supplies, Over-the-Counter)
    /// </summary>
    [MaxLength(100)]
    public string? Category { get; set; }

    /// <summary>
    /// Total expense amount
    /// </summary>
    [Required]
    public decimal Amount { get; set; }

    /// <summary>
    /// Date of the expense
    /// </summary>
    [Required]
    public DateOnly ExpenseDate { get; set; }

    /// <summary>
    /// Whether this was paid from an HSA
    /// </summary>
    public bool PaidFromHsa { get; set; }

    /// <summary>
    /// Amount reimbursed by insurance (if any)
    /// </summary>
    public decimal? InsuranceReimbursement { get; set; }

    /// <summary>
    /// Additional notes about the expense
    /// </summary>
    public string? Notes { get; set; }

    /// <summary>
    /// Path to receipt document (if stored)
    /// </summary>
    [MaxLength(500)]
    public string? ReceiptPath { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation property
    public FamilyMember FamilyMember { get; set; } = null!;
}
