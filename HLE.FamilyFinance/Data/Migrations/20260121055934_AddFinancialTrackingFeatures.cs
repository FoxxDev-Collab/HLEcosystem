using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace HLE.FamilyFinance.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFinancialTrackingFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CategoryRules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    HouseholdId = table.Column<int>(type: "integer", nullable: false),
                    Pattern = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    MatchType = table.Column<int>(type: "integer", nullable: false),
                    CategoryId = table.Column<int>(type: "integer", nullable: false),
                    AssignPayee = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    MatchCount = table.Column<int>(type: "integer", nullable: false),
                    LastMatchedAt = table.Column<DateTime>(type: "timestamptz", nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CategoryRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CategoryRules_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CategoryRules_Households_HouseholdId",
                        column: x => x.HouseholdId,
                        principalTable: "Households",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Debts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    HouseholdId = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Lender = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    AccountNumberLast4 = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: true),
                    OriginalPrincipal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrentBalance = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    InterestRate = table.Column<decimal>(type: "numeric(5,3)", precision: 5, scale: 3, nullable: false),
                    TermMonths = table.Column<int>(type: "integer", nullable: true),
                    MinimumPayment = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PaymentDayOfMonth = table.Column<int>(type: "integer", nullable: false),
                    OriginationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ExpectedPayoffDate = table.Column<DateOnly>(type: "date", nullable: true),
                    LinkedAccountId = table.Column<int>(type: "integer", nullable: true),
                    Icon = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Color = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
                    IncludeInNetWorth = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    IsArchived = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Debts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Debts_Accounts_LinkedAccountId",
                        column: x => x.LinkedAccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Debts_Households_HouseholdId",
                        column: x => x.HouseholdId,
                        principalTable: "Households",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ImportBatches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    HouseholdId = table.Column<int>(type: "integer", nullable: false),
                    AccountId = table.Column<int>(type: "integer", nullable: false),
                    FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Format = table.Column<int>(type: "integer", nullable: false),
                    ImportedAt = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    ImportedByUserId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    TotalRows = table.Column<int>(type: "integer", nullable: false),
                    ImportedCount = table.Column<int>(type: "integer", nullable: false),
                    DuplicateCount = table.Column<int>(type: "integer", nullable: false),
                    SkippedCount = table.Column<int>(type: "integer", nullable: false),
                    IsFinalized = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportBatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ImportBatches_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ImportBatches_Households_HouseholdId",
                        column: x => x.HouseholdId,
                        principalTable: "Households",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TaxYears",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    HouseholdId = table.Column<int>(type: "integer", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    FederalFilingStatus = table.Column<int>(type: "integer", nullable: false),
                    State = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    IsFederalFiled = table.Column<bool>(type: "boolean", nullable: false),
                    FederalFiledDate = table.Column<DateOnly>(type: "date", nullable: true),
                    IsStateFiled = table.Column<bool>(type: "boolean", nullable: false),
                    StateFiledDate = table.Column<DateOnly>(type: "date", nullable: true),
                    FederalRefund = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    StateRefund = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    RefundReceived = table.Column<bool>(type: "boolean", nullable: false),
                    RefundReceivedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaxYears", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaxYears_Households_HouseholdId",
                        column: x => x.HouseholdId,
                        principalTable: "Households",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Assets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    HouseholdId = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    PurchasePrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PurchaseDate = table.Column<DateOnly>(type: "date", nullable: true),
                    CurrentValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ValueAsOfDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Address = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    City = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    State = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ZipCode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    SquareFootage = table.Column<int>(type: "integer", nullable: true),
                    YearBuilt = table.Column<int>(type: "integer", nullable: true),
                    PropertyTaxAnnual = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Make = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Model = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    VehicleYear = table.Column<int>(type: "integer", nullable: true),
                    VIN = table.Column<string>(type: "character varying(17)", maxLength: 17, nullable: true),
                    Mileage = table.Column<int>(type: "integer", nullable: true),
                    LicensePlate = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    LinkedDebtId = table.Column<int>(type: "integer", nullable: true),
                    Icon = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Color = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
                    IncludeInNetWorth = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    IsArchived = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Assets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Assets_Debts_LinkedDebtId",
                        column: x => x.LinkedDebtId,
                        principalTable: "Debts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Assets_Households_HouseholdId",
                        column: x => x.HouseholdId,
                        principalTable: "Households",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DebtPayments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DebtId = table.Column<int>(type: "integer", nullable: false),
                    PaymentDate = table.Column<DateOnly>(type: "date", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PrincipalAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    InterestAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    EscrowAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ExtraPrincipal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    RemainingBalance = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    LinkedTransactionId = table.Column<int>(type: "integer", nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DebtPayments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DebtPayments_Debts_DebtId",
                        column: x => x.DebtId,
                        principalTable: "Debts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DebtPayments_Transactions_LinkedTransactionId",
                        column: x => x.LinkedTransactionId,
                        principalTable: "Transactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "MonthlyBills",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    HouseholdId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Payee = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Category = table.Column<int>(type: "integer", nullable: false),
                    ExpectedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IsVariableAmount = table.Column<bool>(type: "boolean", nullable: false),
                    DueDayOfMonth = table.Column<int>(type: "integer", nullable: false),
                    AutoPay = table.Column<bool>(type: "boolean", nullable: false),
                    AutoPayAccountId = table.Column<int>(type: "integer", nullable: true),
                    LinkedDebtId = table.Column<int>(type: "integer", nullable: true),
                    DefaultCategoryId = table.Column<int>(type: "integer", nullable: true),
                    Icon = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Color = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
                    WebsiteUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MonthlyBills", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MonthlyBills_Accounts_AutoPayAccountId",
                        column: x => x.AutoPayAccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_MonthlyBills_Categories_DefaultCategoryId",
                        column: x => x.DefaultCategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_MonthlyBills_Debts_LinkedDebtId",
                        column: x => x.LinkedDebtId,
                        principalTable: "Debts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_MonthlyBills_Households_HouseholdId",
                        column: x => x.HouseholdId,
                        principalTable: "Households",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ImportedTransactions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ImportBatchId = table.Column<int>(type: "integer", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Payee = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CheckNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ReferenceNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    RawData = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    MatchStatus = table.Column<int>(type: "integer", nullable: false),
                    MatchedTransactionId = table.Column<int>(type: "integer", nullable: true),
                    SuggestedCategoryId = table.Column<int>(type: "integer", nullable: true),
                    CreatedTransactionId = table.Column<int>(type: "integer", nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportedTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ImportedTransactions_Categories_SuggestedCategoryId",
                        column: x => x.SuggestedCategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ImportedTransactions_ImportBatches_ImportBatchId",
                        column: x => x.ImportBatchId,
                        principalTable: "ImportBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ImportedTransactions_Transactions_CreatedTransactionId",
                        column: x => x.CreatedTransactionId,
                        principalTable: "Transactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ImportedTransactions_Transactions_MatchedTransactionId",
                        column: x => x.MatchedTransactionId,
                        principalTable: "Transactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "TaxDocuments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TaxYearId = table.Column<int>(type: "integer", nullable: false),
                    DocumentType = table.Column<int>(type: "integer", nullable: false),
                    Issuer = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    GrossAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    FederalWithheld = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    StateWithheld = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    SocialSecurityWithheld = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    MedicareWithheld = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    IsReceived = table.Column<bool>(type: "boolean", nullable: false),
                    ReceivedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ExpectedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaxDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaxDocuments_TaxYears_TaxYearId",
                        column: x => x.TaxYearId,
                        principalTable: "TaxYears",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AssetValueHistory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AssetId = table.Column<int>(type: "integer", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Value = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Source = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssetValueHistory", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AssetValueHistory_Assets_AssetId",
                        column: x => x.AssetId,
                        principalTable: "Assets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BillPayments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MonthlyBillId = table.Column<int>(type: "integer", nullable: false),
                    DueDate = table.Column<DateOnly>(type: "date", nullable: false),
                    PaidDate = table.Column<DateOnly>(type: "date", nullable: true),
                    AmountDue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AmountPaid = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    LinkedTransactionId = table.Column<int>(type: "integer", nullable: true),
                    ConfirmationNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillPayments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BillPayments_MonthlyBills_MonthlyBillId",
                        column: x => x.MonthlyBillId,
                        principalTable: "MonthlyBills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BillPayments_Transactions_LinkedTransactionId",
                        column: x => x.LinkedTransactionId,
                        principalTable: "Transactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Assets_HouseholdId",
                table: "Assets",
                column: "HouseholdId");

            migrationBuilder.CreateIndex(
                name: "IX_Assets_HouseholdId_Type",
                table: "Assets",
                columns: new[] { "HouseholdId", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_Assets_LinkedDebtId",
                table: "Assets",
                column: "LinkedDebtId");

            migrationBuilder.CreateIndex(
                name: "IX_AssetValueHistory_AssetId",
                table: "AssetValueHistory",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_AssetValueHistory_AssetId_Date",
                table: "AssetValueHistory",
                columns: new[] { "AssetId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_BillPayments_LinkedTransactionId",
                table: "BillPayments",
                column: "LinkedTransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_BillPayments_MonthlyBillId",
                table: "BillPayments",
                column: "MonthlyBillId");

            migrationBuilder.CreateIndex(
                name: "IX_BillPayments_MonthlyBillId_DueDate",
                table: "BillPayments",
                columns: new[] { "MonthlyBillId", "DueDate" });

            migrationBuilder.CreateIndex(
                name: "IX_BillPayments_Status",
                table: "BillPayments",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_CategoryRules_CategoryId",
                table: "CategoryRules",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_CategoryRules_HouseholdId",
                table: "CategoryRules",
                column: "HouseholdId");

            migrationBuilder.CreateIndex(
                name: "IX_CategoryRules_HouseholdId_Priority",
                table: "CategoryRules",
                columns: new[] { "HouseholdId", "Priority" });

            migrationBuilder.CreateIndex(
                name: "IX_DebtPayments_DebtId",
                table: "DebtPayments",
                column: "DebtId");

            migrationBuilder.CreateIndex(
                name: "IX_DebtPayments_DebtId_PaymentDate",
                table: "DebtPayments",
                columns: new[] { "DebtId", "PaymentDate" });

            migrationBuilder.CreateIndex(
                name: "IX_DebtPayments_LinkedTransactionId",
                table: "DebtPayments",
                column: "LinkedTransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_Debts_HouseholdId",
                table: "Debts",
                column: "HouseholdId");

            migrationBuilder.CreateIndex(
                name: "IX_Debts_HouseholdId_Type",
                table: "Debts",
                columns: new[] { "HouseholdId", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_Debts_LinkedAccountId",
                table: "Debts",
                column: "LinkedAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_ImportBatches_AccountId",
                table: "ImportBatches",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_ImportBatches_HouseholdId",
                table: "ImportBatches",
                column: "HouseholdId");

            migrationBuilder.CreateIndex(
                name: "IX_ImportBatches_ImportedAt",
                table: "ImportBatches",
                column: "ImportedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ImportedTransactions_CreatedTransactionId",
                table: "ImportedTransactions",
                column: "CreatedTransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_ImportedTransactions_ImportBatchId",
                table: "ImportedTransactions",
                column: "ImportBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_ImportedTransactions_ImportBatchId_MatchStatus",
                table: "ImportedTransactions",
                columns: new[] { "ImportBatchId", "MatchStatus" });

            migrationBuilder.CreateIndex(
                name: "IX_ImportedTransactions_MatchedTransactionId",
                table: "ImportedTransactions",
                column: "MatchedTransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_ImportedTransactions_SuggestedCategoryId",
                table: "ImportedTransactions",
                column: "SuggestedCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_MonthlyBills_AutoPayAccountId",
                table: "MonthlyBills",
                column: "AutoPayAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_MonthlyBills_DefaultCategoryId",
                table: "MonthlyBills",
                column: "DefaultCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_MonthlyBills_HouseholdId",
                table: "MonthlyBills",
                column: "HouseholdId");

            migrationBuilder.CreateIndex(
                name: "IX_MonthlyBills_HouseholdId_DueDayOfMonth",
                table: "MonthlyBills",
                columns: new[] { "HouseholdId", "DueDayOfMonth" });

            migrationBuilder.CreateIndex(
                name: "IX_MonthlyBills_LinkedDebtId",
                table: "MonthlyBills",
                column: "LinkedDebtId");

            migrationBuilder.CreateIndex(
                name: "IX_TaxDocuments_TaxYearId",
                table: "TaxDocuments",
                column: "TaxYearId");

            migrationBuilder.CreateIndex(
                name: "IX_TaxYears_HouseholdId",
                table: "TaxYears",
                column: "HouseholdId");

            migrationBuilder.CreateIndex(
                name: "IX_TaxYears_HouseholdId_Year",
                table: "TaxYears",
                columns: new[] { "HouseholdId", "Year" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AssetValueHistory");

            migrationBuilder.DropTable(
                name: "BillPayments");

            migrationBuilder.DropTable(
                name: "CategoryRules");

            migrationBuilder.DropTable(
                name: "DebtPayments");

            migrationBuilder.DropTable(
                name: "ImportedTransactions");

            migrationBuilder.DropTable(
                name: "TaxDocuments");

            migrationBuilder.DropTable(
                name: "Assets");

            migrationBuilder.DropTable(
                name: "MonthlyBills");

            migrationBuilder.DropTable(
                name: "ImportBatches");

            migrationBuilder.DropTable(
                name: "TaxYears");

            migrationBuilder.DropTable(
                name: "Debts");
        }
    }
}
