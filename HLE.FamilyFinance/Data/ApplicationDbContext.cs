using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyFinance.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    // Household
    public DbSet<Household> Households => Set<Household>();
    public DbSet<HouseholdMember> HouseholdMembers => Set<HouseholdMember>();

    // Financial entities
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Budget> Budgets => Set<Budget>();
    public DbSet<RecurringTransaction> RecurringTransactions => Set<RecurringTransaction>();

    // Assets & Debts
    public DbSet<Asset> Assets => Set<Asset>();
    public DbSet<AssetValueHistory> AssetValueHistory => Set<AssetValueHistory>();
    public DbSet<Debt> Debts => Set<Debt>();
    public DbSet<DebtPayment> DebtPayments => Set<DebtPayment>();

    // Bills
    public DbSet<MonthlyBill> MonthlyBills => Set<MonthlyBill>();
    public DbSet<BillPayment> BillPayments => Set<BillPayment>();

    // Tax
    public DbSet<TaxYear> TaxYears => Set<TaxYear>();
    public DbSet<TaxDocument> TaxDocuments => Set<TaxDocument>();

    // Import
    public DbSet<ImportBatch> ImportBatches => Set<ImportBatch>();
    public DbSet<ImportedTransaction> ImportedTransactions => Set<ImportedTransaction>();
    public DbSet<CategoryRule> CategoryRules => Set<CategoryRule>();

    // Budget Planner
    public DbSet<BudgetPlannerProject> BudgetPlannerProjects => Set<BudgetPlannerProject>();
    public DbSet<BudgetPlannerItem> BudgetPlannerItems => Set<BudgetPlannerItem>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Apply configurations from assembly
        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
