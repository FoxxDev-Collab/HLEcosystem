namespace HLE.FamilyFinance.Models.Enums;

/// <summary>
/// Status of a bill payment
/// </summary>
public enum BillPaymentStatus
{
    Pending = 0,
    Paid = 1,
    Overdue = 2,
    Scheduled = 3
}
