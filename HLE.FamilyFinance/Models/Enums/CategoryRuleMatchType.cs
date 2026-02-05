namespace HLE.FamilyFinance.Models.Enums;

/// <summary>
/// How to match transaction descriptions for auto-categorization
/// </summary>
public enum CategoryRuleMatchType
{
    Contains = 0,
    StartsWith = 1,
    Exact = 2,
    Regex = 3
}
