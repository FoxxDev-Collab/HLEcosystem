namespace HLE.FamilyFinance.Models.Enums;

/// <summary>
/// Status of an imported transaction during review
/// </summary>
public enum ImportMatchStatus
{
    Pending = 0,
    AutoMatched = 1,
    Imported = 2,
    Skipped = 3,
    Duplicate = 4
}
