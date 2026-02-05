using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Tracks individual bill payments (or upcoming due dates)
/// </summary>
public class BillPayment
{
    public int Id { get; set; }
    public int MonthlyBillId { get; set; }

    /// <summary>
    /// Due date for this payment
    /// </summary>
    public DateOnly DueDate { get; set; }

    /// <summary>
    /// Date the payment was made (null if not yet paid)
    /// </summary>
    public DateOnly? PaidDate { get; set; }

    /// <summary>
    /// Amount due
    /// </summary>
    public decimal AmountDue { get; set; }

    /// <summary>
    /// Amount actually paid (may differ from amount due)
    /// </summary>
    public decimal? AmountPaid { get; set; }

    public BillPaymentStatus Status { get; set; } = BillPaymentStatus.Pending;

    /// <summary>
    /// Link to the Transaction record if tracked
    /// </summary>
    public int? LinkedTransactionId { get; set; }

    /// <summary>
    /// Confirmation number from payment
    /// </summary>
    public string? ConfirmationNumber { get; set; }

    /// <summary>
    /// Optional notes
    /// </summary>
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public MonthlyBill MonthlyBill { get; set; } = null!;
    public Transaction? LinkedTransaction { get; set; }
}
