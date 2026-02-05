namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Records a payment made toward a debt with principal/interest breakdown
/// </summary>
public class DebtPayment
{
    public int Id { get; set; }
    public int DebtId { get; set; }

    /// <summary>
    /// Date the payment was made
    /// </summary>
    public DateOnly PaymentDate { get; set; }

    /// <summary>
    /// Total payment amount
    /// </summary>
    public decimal TotalAmount { get; set; }

    /// <summary>
    /// Amount applied to principal
    /// </summary>
    public decimal PrincipalAmount { get; set; }

    /// <summary>
    /// Amount applied to interest
    /// </summary>
    public decimal InterestAmount { get; set; }

    /// <summary>
    /// Amount applied to escrow (for mortgages)
    /// </summary>
    public decimal? EscrowAmount { get; set; }

    /// <summary>
    /// Any extra amount paid toward principal
    /// </summary>
    public decimal? ExtraPrincipal { get; set; }

    /// <summary>
    /// Balance remaining after this payment
    /// </summary>
    public decimal RemainingBalance { get; set; }

    /// <summary>
    /// Link to the Transaction record if tracked separately
    /// </summary>
    public int? LinkedTransactionId { get; set; }

    /// <summary>
    /// Optional notes about this payment
    /// </summary>
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Debt Debt { get; set; } = null!;
    public Transaction? LinkedTransaction { get; set; }
}
