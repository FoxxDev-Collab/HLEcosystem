using HLE.FileServer.Models;
using Microsoft.EntityFrameworkCore;

namespace HLE.FileServer.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<ApplicationUser> Users { get; set; }
    public DbSet<FileEntry> FileEntries { get; set; }
    public DbSet<FileVersion> FileVersions { get; set; }
    public DbSet<TusUpload> TusUploads { get; set; }
    public DbSet<Models.FileShare> FileShares { get; set; }
    public DbSet<Group> Groups { get; set; }
    public DbSet<GroupMember> GroupMembers { get; set; }
    public DbSet<GroupFile> GroupFiles { get; set; }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // ApplicationUser configuration
        builder.Entity<ApplicationUser>(entity =>
        {
            entity.HasKey(u => u.Id);
            entity.Property(u => u.Email).HasMaxLength(256);
            entity.Property(u => u.FirstName).HasMaxLength(100);
            entity.Property(u => u.LastName).HasMaxLength(100);
            entity.Property(u => u.AvatarColor).HasMaxLength(7);
            entity.Property(u => u.CreatedDate).HasColumnType("timestamptz");
            entity.Property(u => u.LastLoginDate).HasColumnType("timestamptz");
            entity.HasIndex(u => u.ExternalId).IsUnique();
        });

        // Configure FileEntry relationships
        builder.Entity<FileEntry>(entity =>
        {
            entity.Property(f => f.UploadDate).HasColumnType("timestamptz");
            entity.Property(f => f.LastModified).HasColumnType("timestamptz");
            entity.Property(f => f.DeletedDate).HasColumnType("timestamptz");
            entity.Property(f => f.ContentHash).HasMaxLength(64);

            // Index for efficient trash queries
            entity.HasIndex(f => new { f.UserId, f.IsDeleted });

            entity.HasOne(f => f.User)
                .WithMany()
                .HasForeignKey(f => f.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Configure folder hierarchy (self-referencing relationship)
            entity.HasOne(f => f.ParentFolder)
                .WithMany(f => f.Children)
                .HasForeignKey(f => f.ParentFolderId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Configure FileShare relationships
        builder.Entity<Models.FileShare>(entity =>
        {
            entity.Property(s => s.SharedDate).HasColumnType("timestamptz");

            entity.HasOne(s => s.FileEntry)
                .WithMany()
                .HasForeignKey(s => s.FileEntryId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(s => s.Owner)
                .WithMany()
                .HasForeignKey(s => s.OwnerId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(s => s.SharedWithUser)
                .WithMany()
                .HasForeignKey(s => s.SharedWithUserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Prevent duplicate shares (same file shared with same user)
            entity.HasIndex(s => new { s.FileEntryId, s.SharedWithUserId })
                .IsUnique();
        });

        // Configure Group relationships
        builder.Entity<Group>(entity =>
        {
            entity.Property(g => g.CreatedDate).HasColumnType("timestamptz");

            entity.HasOne(g => g.Owner)
                .WithMany()
                .HasForeignKey(g => g.OwnerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Configure GroupMember relationships
        builder.Entity<GroupMember>(entity =>
        {
            entity.Property(gm => gm.JoinedDate).HasColumnType("timestamptz");

            entity.HasOne(gm => gm.Group)
                .WithMany(g => g.Members)
                .HasForeignKey(gm => gm.GroupId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(gm => gm.User)
                .WithMany()
                .HasForeignKey(gm => gm.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Prevent duplicate memberships (same user in same group)
            entity.HasIndex(gm => new { gm.GroupId, gm.UserId })
                .IsUnique();
        });

        // Configure GroupFile relationships
        builder.Entity<GroupFile>(entity =>
        {
            entity.Property(gf => gf.UploadDate).HasColumnType("timestamptz");

            entity.HasOne(gf => gf.Group)
                .WithMany(g => g.Files)
                .HasForeignKey(gf => gf.GroupId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(gf => gf.UploadedBy)
                .WithMany()
                .HasForeignKey(gf => gf.UploadedById)
                .OnDelete(DeleteBehavior.Restrict);

            // Configure folder hierarchy for GroupFiles (self-referencing relationship)
            entity.HasOne(gf => gf.ParentFolder)
                .WithMany(gf => gf.Children)
                .HasForeignKey(gf => gf.ParentFolderId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Configure FileVersion relationships
        builder.Entity<FileVersion>(entity =>
        {
            entity.Property(v => v.CreatedAt).HasColumnType("timestamptz");
            entity.Property(v => v.ContentHash).HasMaxLength(64);

            entity.HasOne(v => v.FileEntry)
                .WithMany(f => f.Versions)
                .HasForeignKey(v => v.FileEntryId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(v => v.CreatedByUser)
                .WithMany()
                .HasForeignKey(v => v.CreatedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            // Index for efficient version queries
            entity.HasIndex(v => new { v.FileEntryId, v.VersionNumber });
        });

        // Configure TusUpload relationships
        builder.Entity<TusUpload>(entity =>
        {
            entity.Property(t => t.CreatedAt).HasColumnType("timestamptz");
            entity.Property(t => t.LastActivity).HasColumnType("timestamptz");
            entity.Property(t => t.ExpiresAt).HasColumnType("timestamptz");

            entity.HasOne(t => t.User)
                .WithMany()
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Unique index on upload ID for fast lookups
            entity.HasIndex(t => t.UploadId).IsUnique();

            // Index for cleanup of expired uploads
            entity.HasIndex(t => t.ExpiresAt);
        });
    }
}
