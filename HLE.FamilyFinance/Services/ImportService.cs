using System.Text.RegularExpressions;
using HLE.FamilyFinance.Data;
using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyFinance.Services;

public class ImportService(ApplicationDbContext context, ILogger<ImportService> logger) : IImportService
{
    public async Task<ImportBatch> ImportFileAsync(int householdId, int accountId, string fileName, Stream fileStream, ImportFileFormat format, string? userId, CancellationToken ct = default)
    {
        var batch = new ImportBatch
        {
            HouseholdId = householdId,
            AccountId = accountId,
            FileName = fileName,
            Format = format,
            ImportedAt = DateTime.UtcNow,
            ImportedByUserId = userId
        };

        context.ImportBatches.Add(batch);
        await context.SaveChangesAsync(ct);

        // Parse file based on format
        List<ImportedTransaction> transactions = format switch
        {
            ImportFileFormat.CSV => await ParseCsvAsync(fileStream, batch.Id, ct),
            ImportFileFormat.QFX or ImportFileFormat.OFX => await ParseQfxAsync(fileStream, batch.Id, ct),
            _ => throw new NotSupportedException($"Format {format} is not supported")
        };

        batch.TotalRows = transactions.Count;

        // Check for duplicates - fetch existing transactions with all relevant fields
        var existingTransactions = await context.Transactions
            .AsNoTracking()
            .Where(t => t.AccountId == accountId)
            .Select(t => new { t.Date, t.Amount, t.Description, t.ExternalId })
            .ToListAsync(ct);

        // Build a set of existing ExternalIds for fast lookup
        var existingExternalIds = existingTransactions
            .Where(t => !string.IsNullOrEmpty(t.ExternalId))
            .Select(t => t.ExternalId!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var tx in transactions)
        {
            // First check: ExternalId (bank's FITID) - most reliable
            if (!string.IsNullOrEmpty(tx.ReferenceNumber) && existingExternalIds.Contains(tx.ReferenceNumber))
            {
                tx.MatchStatus = ImportMatchStatus.Duplicate;
                tx.Notes = "Duplicate: Matched by bank transaction ID";
                batch.DuplicateCount++;
                continue;
            }

            // Second check: Date + Amount + Description similarity
            var txAmount = Math.Abs(tx.Amount);
            var txDesc = NormalizeDescription(tx.Description);

            var isDuplicate = existingTransactions.Any(e =>
            {
                // Must match date exactly
                if (e.Date != tx.Date) return false;

                // Must match amount within tolerance
                if (Math.Abs(e.Amount - txAmount) >= 0.01m) return false;

                // Check description similarity (either contains the other, or both normalized match)
                var existingDesc = NormalizeDescription(e.Description);
                return !string.IsNullOrEmpty(txDesc) && !string.IsNullOrEmpty(existingDesc) &&
                       (existingDesc.Contains(txDesc, StringComparison.OrdinalIgnoreCase) ||
                        txDesc.Contains(existingDesc, StringComparison.OrdinalIgnoreCase) ||
                        existingDesc.Equals(txDesc, StringComparison.OrdinalIgnoreCase));
            });

            if (isDuplicate)
            {
                tx.MatchStatus = ImportMatchStatus.Duplicate;
                tx.Notes = "Duplicate: Matched by date, amount, and description";
                batch.DuplicateCount++;
            }
        }

        context.ImportedTransactions.AddRange(transactions);
        await context.SaveChangesAsync(ct);

        // Auto-categorize
        await AutoCategorizeAsync(batch.Id, householdId, ct);

        logger.LogInformation("Imported {Count} transactions from {FileName} for account {AccountId}", transactions.Count, fileName, accountId);
        return batch;
    }

    private async Task<List<ImportedTransaction>> ParseCsvAsync(Stream fileStream, int batchId, CancellationToken ct)
    {
        var transactions = new List<ImportedTransaction>();
        using var reader = new StreamReader(fileStream);

        // Skip header line
        await reader.ReadLineAsync(ct);

        string? line;
        while ((line = await reader.ReadLineAsync(ct)) != null)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;

            try
            {
                // Wells Fargo CSV format: "Date","Amount","*","*","Description"
                var parts = ParseCsvLine(line);
                if (parts.Length < 5) continue;

                var dateStr = parts[0].Trim('"');
                var amountStr = parts[1].Trim('"');
                var description = parts[4].Trim('"');

                if (!DateOnly.TryParse(dateStr, out var date)) continue;
                if (!decimal.TryParse(amountStr, out var amount)) continue;

                transactions.Add(new ImportedTransaction
                {
                    ImportBatchId = batchId,
                    Date = date,
                    Amount = amount,
                    Description = description,
                    Payee = ExtractPayee(description),
                    RawData = line,
                    MatchStatus = ImportMatchStatus.Pending,
                    CreatedAt = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to parse CSV line: {Line}", line);
            }
        }

        return transactions;
    }

    private static string[] ParseCsvLine(string line)
    {
        var result = new List<string>();
        var inQuotes = false;
        var current = "";

        foreach (var c in line)
        {
            if (c == '"')
            {
                inQuotes = !inQuotes;
            }
            else if (c == ',' && !inQuotes)
            {
                result.Add(current);
                current = "";
            }
            else
            {
                current += c;
            }
        }
        result.Add(current);

        return result.ToArray();
    }

    private async Task<List<ImportedTransaction>> ParseQfxAsync(Stream fileStream, int batchId, CancellationToken ct)
    {
        var transactions = new List<ImportedTransaction>();
        using var reader = new StreamReader(fileStream);
        var content = await reader.ReadToEndAsync(ct);

        // QFX/OFX uses SGML format - find STMTTRN blocks
        // Format: <STMTTRN><TRNTYPE>...<DTPOSTED>...<TRNAMT>...</STMTTRN>
        var transactionPattern = @"<STMTTRN>(.*?)(?:</STMTTRN>|(?=<STMTTRN>)|(?=</BANKTRANLIST>)|$)";
        var matches = Regex.Matches(content, transactionPattern, RegexOptions.Singleline | RegexOptions.IgnoreCase);

        foreach (Match match in matches)
        {
            try
            {
                var block = match.Groups[1].Value;
                if (string.IsNullOrWhiteSpace(block)) continue;

                // Parse SGML-style tags - values end at next < tag
                // Date format: YYYYMMDDHHMMSS.XXX[-TZ:ZZZ] - we only need first 8 digits
                var dateMatch = Regex.Match(block, @"<DTPOSTED>(\d{8})", RegexOptions.IgnoreCase);
                var amountMatch = Regex.Match(block, @"<TRNAMT>([+-]?\d+\.?\d*)", RegexOptions.IgnoreCase);
                var nameMatch = Regex.Match(block, @"<NAME>([^<]+)", RegexOptions.IgnoreCase);
                var memoMatch = Regex.Match(block, @"<MEMO>([^<]+)", RegexOptions.IgnoreCase);
                var fitidMatch = Regex.Match(block, @"<FITID>([^<]+)", RegexOptions.IgnoreCase);
                var checkNumMatch = Regex.Match(block, @"<CHECKNUM>([^<]+)", RegexOptions.IgnoreCase);

                if (!dateMatch.Success || !amountMatch.Success) continue;

                // Parse date (first 8 chars = YYYYMMDD)
                var dateStr = dateMatch.Groups[1].Value;
                if (!DateOnly.TryParseExact(dateStr, "yyyyMMdd", out var date))
                {
                    logger.LogWarning("Failed to parse date: {DateStr}", dateStr);
                    continue;
                }

                if (!decimal.TryParse(amountMatch.Groups[1].Value, out var amount))
                {
                    logger.LogWarning("Failed to parse amount: {AmountStr}", amountMatch.Groups[1].Value);
                    continue;
                }

                var description = nameMatch.Success ? nameMatch.Groups[1].Value.Trim() : "";
                if (memoMatch.Success && !string.IsNullOrWhiteSpace(memoMatch.Groups[1].Value))
                {
                    var memo = memoMatch.Groups[1].Value.Trim();
                    if (!description.Contains(memo, StringComparison.OrdinalIgnoreCase))
                    {
                        description = string.IsNullOrEmpty(description) ? memo : $"{description} - {memo}";
                    }
                }

                transactions.Add(new ImportedTransaction
                {
                    ImportBatchId = batchId,
                    Date = date,
                    Amount = amount,
                    Description = description.Trim(),
                    Payee = ExtractPayee(description),
                    ReferenceNumber = fitidMatch.Success ? fitidMatch.Groups[1].Value.Trim() : null,
                    CheckNumber = checkNumMatch.Success ? checkNumMatch.Groups[1].Value.Trim() : null,
                    RawData = block,
                    MatchStatus = ImportMatchStatus.Pending,
                    CreatedAt = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to parse QFX transaction block");
            }
        }

        logger.LogInformation("Parsed {Count} transactions from QFX file", transactions.Count);
        return transactions;
    }

    private static string? ExtractPayee(string? description)
    {
        if (string.IsNullOrWhiteSpace(description)) return null;

        // Common patterns to clean up
        description = Regex.Replace(description, @"\s+", " ").Trim();
        description = Regex.Replace(description, @"\d{2}/\d{2}.*$", "").Trim(); // Remove dates at end
        description = Regex.Replace(description, @"#\d+.*$", "").Trim(); // Remove store numbers

        // Take first part before common separators
        var parts = description.Split(new[] { " - ", " * ", "  " }, StringSplitOptions.RemoveEmptyEntries);
        return parts.Length > 0 ? parts[0].Trim() : description;
    }

    /// <summary>
    /// Normalize description for duplicate comparison by removing variable parts like dates, reference numbers, etc.
    /// </summary>
    private static string NormalizeDescription(string? description)
    {
        if (string.IsNullOrWhiteSpace(description)) return "";

        var normalized = description.ToUpperInvariant();

        // Remove common variable patterns
        normalized = Regex.Replace(normalized, @"\d{2}/\d{2}(/\d{2,4})?", ""); // Dates MM/DD or MM/DD/YY
        normalized = Regex.Replace(normalized, @"\d{4}-\d{2}-\d{2}", ""); // Dates YYYY-MM-DD
        normalized = Regex.Replace(normalized, @"#\d+", ""); // Store/reference numbers
        normalized = Regex.Replace(normalized, @"REF\s*#?\s*\d+", ""); // Reference numbers
        normalized = Regex.Replace(normalized, @"TRACE\s*#?\s*\d+", ""); // Trace numbers
        normalized = Regex.Replace(normalized, @"\*+\d+", ""); // Masked card numbers like ***1234
        normalized = Regex.Replace(normalized, @"X{2,}\d+", ""); // Masked numbers like XXXX1234
        normalized = Regex.Replace(normalized, @"\s{2,}", " "); // Multiple spaces to single
        normalized = Regex.Replace(normalized, @"[^\w\s]", " "); // Non-word characters to space

        return normalized.Trim();
    }

    public async Task<ImportReviewDto?> GetPendingImportAsync(int batchId, int householdId, CancellationToken ct = default)
    {
        var batch = await context.ImportBatches
            .AsNoTracking()
            .Include(b => b.Account)
            .Include(b => b.Transactions)
                .ThenInclude(t => t.SuggestedCategory)
            .Where(b => b.Id == batchId && b.HouseholdId == householdId && !b.IsFinalized)
            .FirstOrDefaultAsync(ct);

        if (batch == null) return null;

        var transactions = batch.Transactions.Select(t => new ImportedTransactionDto(
            t.Id,
            t.Date,
            t.Amount,
            t.Description,
            t.Payee,
            t.CheckNumber,
            t.ReferenceNumber,
            t.MatchStatus,
            t.SuggestedCategoryId,
            t.SuggestedCategory?.Name,
            t.MatchedTransactionId,
            t.Notes
        )).ToList();

        return new ImportReviewDto(
            batch.Id,
            batch.FileName,
            batch.Account.Name,
            transactions,
            transactions.Count,
            transactions.Count(t => t.MatchStatus == ImportMatchStatus.Pending),
            transactions.Count(t => t.MatchStatus == ImportMatchStatus.AutoMatched),
            transactions.Count(t => t.MatchStatus == ImportMatchStatus.Duplicate)
        );
    }

    public async Task<List<ImportBatchSummaryDto>> GetImportHistoryAsync(int householdId, CancellationToken ct = default)
    {
        return await context.ImportBatches
            .AsNoTracking()
            .Include(b => b.Account)
            .Include(b => b.Transactions)
            .Where(b => b.HouseholdId == householdId)
            .OrderByDescending(b => b.ImportedAt)
            .Select(b => new ImportBatchSummaryDto(
                b.Id,
                b.FileName,
                b.Format,
                b.AccountId,
                b.Account.Name,
                b.ImportedAt,
                b.TotalRows,
                b.ImportedCount,
                b.DuplicateCount,
                b.SkippedCount,
                b.Transactions.Count(t => t.MatchStatus == ImportMatchStatus.Pending),
                b.IsFinalized
            ))
            .ToListAsync(ct);
    }

    public async Task ConfirmImportAsync(int batchId, int householdId, List<ImportConfirmationDto> confirmations, CancellationToken ct = default)
    {
        var batch = await context.ImportBatches
            .Include(b => b.Transactions)
            .FirstOrDefaultAsync(b => b.Id == batchId && b.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Import batch not found");

        var imported = 0;
        var skipped = 0;

        foreach (var confirmation in confirmations)
        {
            var importedTx = batch.Transactions.FirstOrDefault(t => t.Id == confirmation.TransactionId);
            if (importedTx == null) continue;

            if (confirmation.Skip || importedTx.MatchStatus == ImportMatchStatus.Duplicate)
            {
                importedTx.MatchStatus = ImportMatchStatus.Skipped;
                skipped++;
                continue;
            }

            // Determine transaction type - check if this is a transfer
            var transactionType = importedTx.Amount >= 0 ? TransactionType.Income : TransactionType.Expense;

            // Check if the category is a Transfer type category
            if (confirmation.CategoryId.HasValue)
            {
                var category = await context.Categories
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Id == confirmation.CategoryId.Value, ct);
                if (category?.Type == CategoryType.Transfer)
                {
                    transactionType = TransactionType.Transfer;
                }
            }

            // Also detect common transfer patterns in description
            var desc = importedTx.Description?.ToUpperInvariant() ?? "";
            if (IsTransferDescription(desc))
            {
                transactionType = TransactionType.Transfer;
            }

            // Create actual transaction
            var transaction = new Transaction
            {
                HouseholdId = householdId,
                AccountId = batch.AccountId,
                CategoryId = confirmation.CategoryId,
                Type = transactionType,
                Amount = Math.Abs(importedTx.Amount),
                Date = importedTx.Date,
                Payee = confirmation.Payee ?? importedTx.Payee,
                Description = importedTx.Description,
                ExternalId = importedTx.ReferenceNumber, // Store bank's FITID for duplicate detection
                CreatedAt = DateTime.UtcNow
            };

            context.Transactions.Add(transaction);
            await context.SaveChangesAsync(ct);

            importedTx.MatchStatus = ImportMatchStatus.Imported;
            importedTx.CreatedTransactionId = transaction.Id;
            imported++;

            // Update account balance
            var account = await context.Accounts.FindAsync([batch.AccountId], ct);
            if (account != null)
            {
                account.CurrentBalance += importedTx.Amount;
            }
        }

        batch.ImportedCount = imported;
        batch.SkippedCount = skipped;
        batch.IsFinalized = true;

        await context.SaveChangesAsync(ct);
        logger.LogInformation("Confirmed import batch {BatchId}: {Imported} imported, {Skipped} skipped", batchId, imported, skipped);
    }

    public async Task CancelImportAsync(int batchId, int householdId, CancellationToken ct = default)
    {
        var batch = await context.ImportBatches
            .Include(b => b.Transactions)
            .FirstOrDefaultAsync(b => b.Id == batchId && b.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Import batch not found");

        context.ImportBatches.Remove(batch);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Cancelled import batch {BatchId}", batchId);
    }

    public async Task AutoCategorizeAsync(int batchId, int householdId, CancellationToken ct = default)
    {
        var transactions = await context.ImportedTransactions
            .Where(t => t.ImportBatchId == batchId && t.MatchStatus == ImportMatchStatus.Pending)
            .ToListAsync(ct);

        var rules = await context.CategoryRules
            .AsNoTracking()
            .Where(r => r.HouseholdId == householdId && r.IsActive)
            .OrderBy(r => r.Priority)
            .ToListAsync(ct);

        foreach (var tx in transactions)
        {
            var description = tx.Description ?? "";

            foreach (var rule in rules)
            {
                var matches = rule.MatchType switch
                {
                    CategoryRuleMatchType.Contains => description.Contains(rule.Pattern, StringComparison.OrdinalIgnoreCase),
                    CategoryRuleMatchType.StartsWith => description.StartsWith(rule.Pattern, StringComparison.OrdinalIgnoreCase),
                    CategoryRuleMatchType.Exact => description.Equals(rule.Pattern, StringComparison.OrdinalIgnoreCase),
                    CategoryRuleMatchType.Regex => Regex.IsMatch(description, rule.Pattern, RegexOptions.IgnoreCase),
                    _ => false
                };

                if (matches)
                {
                    tx.SuggestedCategoryId = rule.CategoryId;
                    if (!string.IsNullOrEmpty(rule.AssignPayee))
                    {
                        tx.Payee = rule.AssignPayee;
                    }
                    tx.MatchStatus = ImportMatchStatus.AutoMatched;

                    // Update rule stats
                    var ruleEntity = await context.CategoryRules.FindAsync([rule.Id], ct);
                    if (ruleEntity != null)
                    {
                        ruleEntity.MatchCount++;
                        ruleEntity.LastMatchedAt = DateTime.UtcNow;
                    }
                    break;
                }
            }
        }

        await context.SaveChangesAsync(ct);
    }

    public async Task<List<CategoryRuleDto>> GetCategoryRulesAsync(int householdId, CancellationToken ct = default)
    {
        return await context.CategoryRules
            .AsNoTracking()
            .Include(r => r.Category)
            .Where(r => r.HouseholdId == householdId)
            .OrderBy(r => r.Priority)
            .Select(r => new CategoryRuleDto(
                r.Id,
                r.Pattern,
                r.MatchType,
                r.CategoryId,
                r.Category.Name,
                r.AssignPayee,
                r.Priority,
                r.IsActive,
                r.MatchCount,
                r.LastMatchedAt
            ))
            .ToListAsync(ct);
    }

    public async Task<CategoryRule> CreateCategoryRuleAsync(int householdId, CategoryRuleCreateDto dto, CancellationToken ct = default)
    {
        var rule = new CategoryRule
        {
            HouseholdId = householdId,
            Pattern = dto.Pattern,
            MatchType = dto.MatchType,
            CategoryId = dto.CategoryId,
            AssignPayee = dto.AssignPayee,
            Priority = dto.Priority,
            Notes = dto.Notes,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        context.CategoryRules.Add(rule);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Created category rule {RuleId} for pattern '{Pattern}'", rule.Id, dto.Pattern);
        return rule;
    }

    public async Task UpdateCategoryRuleAsync(int id, int householdId, CategoryRuleCreateDto dto, CancellationToken ct = default)
    {
        var rule = await context.CategoryRules
            .FirstOrDefaultAsync(r => r.Id == id && r.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Category rule not found");

        rule.Pattern = dto.Pattern;
        rule.MatchType = dto.MatchType;
        rule.CategoryId = dto.CategoryId;
        rule.AssignPayee = dto.AssignPayee;
        rule.Priority = dto.Priority;
        rule.Notes = dto.Notes;
        rule.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync(ct);
    }

    public async Task DeleteCategoryRuleAsync(int id, int householdId, CancellationToken ct = default)
    {
        var rule = await context.CategoryRules
            .FirstOrDefaultAsync(r => r.Id == id && r.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Category rule not found");

        context.CategoryRules.Remove(rule);
        await context.SaveChangesAsync(ct);
    }

    public async Task<int?> FindMatchingCategoryAsync(int householdId, string description, CancellationToken ct = default)
    {
        var rules = await context.CategoryRules
            .AsNoTracking()
            .Where(r => r.HouseholdId == householdId && r.IsActive)
            .OrderBy(r => r.Priority)
            .ToListAsync(ct);

        foreach (var rule in rules)
        {
            var matches = rule.MatchType switch
            {
                CategoryRuleMatchType.Contains => description.Contains(rule.Pattern, StringComparison.OrdinalIgnoreCase),
                CategoryRuleMatchType.StartsWith => description.StartsWith(rule.Pattern, StringComparison.OrdinalIgnoreCase),
                CategoryRuleMatchType.Exact => description.Equals(rule.Pattern, StringComparison.OrdinalIgnoreCase),
                CategoryRuleMatchType.Regex => Regex.IsMatch(description, rule.Pattern, RegexOptions.IgnoreCase),
                _ => false
            };

            if (matches)
            {
                return rule.CategoryId;
            }
        }

        return null;
    }

    /// <summary>
    /// Detects common transfer patterns in transaction descriptions
    /// </summary>
    private static bool IsTransferDescription(string description)
    {
        // Common patterns that indicate a transfer between accounts
        var transferPatterns = new[]
        {
            "TRANSFER",
            "XFER",
            "ONLINE TRANSFER",
            "ONLINE XFER",
            "FUNDS TRANSFER",
            "INTERNAL TRANSFER",
            "ACH TRANSFER",
            "WIRE TRANSFER",
            "MONEY TRANSFER",
            "FROM SAVINGS",
            "FROM CHECKING",
            "TO SAVINGS",
            "TO CHECKING",
            "VENMO",
            "ZELLE",
            "PAYPAL TRANSFER"
        };

        return transferPatterns.Any(pattern => description.Contains(pattern));
    }
}
