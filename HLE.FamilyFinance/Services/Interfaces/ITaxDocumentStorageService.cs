using Microsoft.AspNetCore.Http;

namespace HLE.FamilyFinance.Services.Interfaces;

public record TaxDocumentFileInfo(
    string StoragePath,
    string ContentHash,
    long FileSize
);

public record TaxDocumentFileResult(
    Stream FileStream,
    string ContentType,
    string FileName
);

public interface ITaxDocumentStorageService
{
    /// <summary>
    /// Validates and saves an uploaded file for a tax document
    /// </summary>
    Task<TaxDocumentFileInfo> SaveFileAsync(
        IFormFile file,
        int householdId,
        int year,
        int documentId,
        CancellationToken ct = default);

    /// <summary>
    /// Deletes a stored tax document file
    /// </summary>
    Task DeleteFileAsync(string storagePath, CancellationToken ct = default);

    /// <summary>
    /// Gets a file stream for downloading a tax document
    /// </summary>
    Task<TaxDocumentFileResult?> GetFileAsync(string storagePath, CancellationToken ct = default);

    /// <summary>
    /// Validates a file without saving it
    /// </summary>
    void ValidateFile(IFormFile file);
}
