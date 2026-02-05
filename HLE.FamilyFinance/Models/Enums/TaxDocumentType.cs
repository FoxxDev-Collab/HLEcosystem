namespace HLE.FamilyFinance.Models.Enums;

/// <summary>
/// Types of tax documents
/// </summary>
public enum TaxDocumentType
{
    W2 = 0,
    Form1099_INT = 1,
    Form1099_DIV = 2,
    Form1099_NEC = 3,
    Form1098 = 4,
    Form1099_B = 5,
    Form1099_R = 6,
    K1 = 7,
    Form1099_SA = 20,   // HSA/MSA distributions
    Form5498_SA = 21,   // HSA/MSA contributions
    Other = 99
}
