using HLE.FamilyHub.Data;
using HLE.FamilyHub.Models.Entities;
using HLE.FamilyHub.Models.Enums;
using HLE.FamilyHub.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HLE.FamilyHub.Services;

/// <summary>
/// Implementation of family member management service.
/// </summary>
public class FamilyMemberService(
    ApplicationDbContext context,
    ILogger<FamilyMemberService> logger) : IFamilyMemberService
{
    /// <inheritdoc/>
    public async Task<List<FamilyMemberSummaryDto>> GetFamilyMembersAsync(int householdId, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        return await context.FamilyMembers
            .AsNoTracking()
            .Where(fm => fm.HouseholdId == householdId)
            .Select(fm => new FamilyMemberSummaryDto(
                fm.Id,
                fm.FirstName,
                fm.LastName,
                fm.Nickname,
                fm.Relationship,
                fm.Birthday,
                fm.Phone,
                fm.Email,
                fm.City,
                fm.State,
                fm.IncludeInHolidayCards,
                fm.IsActive,
                context.ImportantDates.Count(d => d.HouseholdId == householdId && d.FamilyMemberId == fm.Id),
                context.GiftIdeas.Count(gi => gi.HouseholdId == householdId && gi.FamilyMemberId == fm.Id && gi.Status == GiftIdeaStatus.Active)
            ))
            .OrderBy(fm => fm.LastName)
            .ThenBy(fm => fm.FirstName)
            .ToListAsync(ct);
    }

    /// <inheritdoc/>
    public async Task<List<FamilyMemberSummaryDto>> GetHolidayCardListAsync(int householdId, CancellationToken ct = default)
    {
        return await context.FamilyMembers
            .AsNoTracking()
            .Where(fm => fm.HouseholdId == householdId
                && fm.IsActive
                && fm.IncludeInHolidayCards
                && !string.IsNullOrEmpty(fm.AddressLine1))
            .Select(fm => new FamilyMemberSummaryDto(
                fm.Id,
                fm.FirstName,
                fm.LastName,
                fm.Nickname,
                fm.Relationship,
                fm.Birthday,
                fm.Phone,
                fm.Email,
                fm.City,
                fm.State,
                fm.IncludeInHolidayCards,
                fm.IsActive,
                context.ImportantDates.Count(d => d.HouseholdId == householdId && d.FamilyMemberId == fm.Id),
                context.GiftIdeas.Count(gi => gi.HouseholdId == householdId && gi.FamilyMemberId == fm.Id && gi.Status == GiftIdeaStatus.Active)
            ))
            .OrderBy(fm => fm.LastName)
            .ThenBy(fm => fm.FirstName)
            .ToListAsync(ct);
    }

    /// <inheritdoc/>
    public async Task<FamilyMemberDetailDto?> GetFamilyMemberAsync(int id, int householdId, CancellationToken ct = default)
    {
        return await context.FamilyMembers
            .AsNoTracking()
            .Where(fm => fm.Id == id && fm.HouseholdId == householdId)
            .Select(fm => new FamilyMemberDetailDto(
                fm.Id,
                fm.FirstName,
                fm.LastName,
                fm.Nickname,
                fm.Relationship,
                fm.RelationshipNotes,
                fm.Birthday,
                fm.Anniversary,
                fm.Phone,
                fm.Email,
                fm.PreferredContact,
                fm.AddressLine1,
                fm.AddressLine2,
                fm.City,
                fm.State,
                fm.ZipCode,
                fm.Country,
                fm.ProfilePhotoUrl,
                fm.Notes,
                fm.IsActive,
                fm.IncludeInHolidayCards,
                fm.CreatedAt
            ))
            .FirstOrDefaultAsync(ct);
    }

    /// <inheritdoc/>
    public async Task<FamilyMember> CreateFamilyMemberAsync(
        int householdId,
        string firstName,
        string lastName,
        string? nickname,
        Relationship relationship,
        string? relationshipNotes,
        DateOnly? birthday,
        DateOnly? anniversary,
        string? phone,
        string? email,
        PreferredContactMethod preferredContact,
        string? addressLine1,
        string? addressLine2,
        string? city,
        string? state,
        string? zipCode,
        string? country,
        string? profilePhotoUrl,
        string? notes,
        bool includeInHolidayCards,
        CancellationToken ct = default)
    {
        var familyMember = new FamilyMember
        {
            HouseholdId = householdId,
            FirstName = firstName,
            LastName = lastName,
            Nickname = nickname,
            Relationship = relationship,
            RelationshipNotes = relationshipNotes,
            Birthday = birthday,
            Anniversary = anniversary,
            Phone = phone,
            Email = email,
            PreferredContact = preferredContact,
            AddressLine1 = addressLine1,
            AddressLine2 = addressLine2,
            City = city,
            State = state,
            ZipCode = zipCode,
            Country = country,
            ProfilePhotoUrl = profilePhotoUrl,
            Notes = notes,
            IsActive = true,
            IncludeInHolidayCards = includeInHolidayCards,
            CreatedAt = DateTime.UtcNow
        };

        context.FamilyMembers.Add(familyMember);

        // Auto-create ImportantDate for birthday
        if (birthday.HasValue)
        {
            var birthdayDate = new ImportantDate
            {
                HouseholdId = householdId,
                FamilyMember = familyMember,
                Label = $"{firstName}'s Birthday",
                Date = birthday.Value,
                Type = ImportantDateType.Birthday,
                RecurrenceType = RecurrenceType.Annual,
                ReminderDaysBefore = 7,
                CreatedAt = DateTime.UtcNow
            };
            context.ImportantDates.Add(birthdayDate);
        }

        // Auto-create ImportantDate for anniversary
        if (anniversary.HasValue)
        {
            var anniversaryDate = new ImportantDate
            {
                HouseholdId = householdId,
                FamilyMember = familyMember,
                Label = $"{firstName}'s Anniversary",
                Date = anniversary.Value,
                Type = ImportantDateType.Anniversary,
                RecurrenceType = RecurrenceType.Annual,
                ReminderDaysBefore = 14,
                CreatedAt = DateTime.UtcNow
            };
            context.ImportantDates.Add(anniversaryDate);
        }

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Created family member {FamilyMemberId} in household {HouseholdId}", familyMember.Id, householdId);

        return familyMember;
    }

    /// <inheritdoc/>
    public async Task UpdateFamilyMemberAsync(
        int id,
        int householdId,
        string firstName,
        string lastName,
        string? nickname,
        Relationship relationship,
        string? relationshipNotes,
        DateOnly? birthday,
        DateOnly? anniversary,
        string? phone,
        string? email,
        PreferredContactMethod preferredContact,
        string? addressLine1,
        string? addressLine2,
        string? city,
        string? state,
        string? zipCode,
        string? country,
        string? profilePhotoUrl,
        string? notes,
        bool includeInHolidayCards,
        CancellationToken ct = default)
    {
        var familyMember = await context.FamilyMembers
            .FirstOrDefaultAsync(fm => fm.Id == id && fm.HouseholdId == householdId, ct);

        if (familyMember == null)
        {
            throw new InvalidOperationException($"Family member {id} not found in household {householdId}.");
        }

        familyMember.FirstName = firstName;
        familyMember.LastName = lastName;
        familyMember.Nickname = nickname;
        familyMember.Relationship = relationship;
        familyMember.RelationshipNotes = relationshipNotes;
        familyMember.Birthday = birthday;
        familyMember.Anniversary = anniversary;
        familyMember.Phone = phone;
        familyMember.Email = email;
        familyMember.PreferredContact = preferredContact;
        familyMember.AddressLine1 = addressLine1;
        familyMember.AddressLine2 = addressLine2;
        familyMember.City = city;
        familyMember.State = state;
        familyMember.ZipCode = zipCode;
        familyMember.Country = country;
        familyMember.ProfilePhotoUrl = profilePhotoUrl;
        familyMember.Notes = notes;
        familyMember.IncludeInHolidayCards = includeInHolidayCards;

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Updated family member {FamilyMemberId} in household {HouseholdId}", id, householdId);
    }

    /// <inheritdoc/>
    public async Task DeleteFamilyMemberAsync(int id, int householdId, CancellationToken ct = default)
    {
        var familyMember = await context.FamilyMembers
            .FirstOrDefaultAsync(fm => fm.Id == id && fm.HouseholdId == householdId, ct);

        if (familyMember == null)
        {
            throw new InvalidOperationException($"Family member {id} not found in household {householdId}.");
        }

        familyMember.IsActive = false;

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Soft-deleted family member {FamilyMemberId} in household {HouseholdId}", id, householdId);
    }

    /// <inheritdoc/>
    public async Task<List<FamilyMemberSummaryDto>> SearchAsync(int householdId, string query, CancellationToken ct = default)
    {
        var lowerQuery = query.ToLower();

        return await context.FamilyMembers
            .AsNoTracking()
            .Where(fm => fm.HouseholdId == householdId
                && (fm.FirstName.ToLower().Contains(lowerQuery)
                    || fm.LastName.ToLower().Contains(lowerQuery)
                    || (fm.Nickname != null && fm.Nickname.ToLower().Contains(lowerQuery))))
            .Select(fm => new FamilyMemberSummaryDto(
                fm.Id,
                fm.FirstName,
                fm.LastName,
                fm.Nickname,
                fm.Relationship,
                fm.Birthday,
                fm.Phone,
                fm.Email,
                fm.City,
                fm.State,
                fm.IncludeInHolidayCards,
                fm.IsActive,
                context.ImportantDates.Count(d => d.HouseholdId == householdId && d.FamilyMemberId == fm.Id),
                context.GiftIdeas.Count(gi => gi.HouseholdId == householdId && gi.FamilyMemberId == fm.Id && gi.Status == GiftIdeaStatus.Active)
            ))
            .OrderBy(fm => fm.LastName)
            .ThenBy(fm => fm.FirstName)
            .ToListAsync(ct);
    }
}
