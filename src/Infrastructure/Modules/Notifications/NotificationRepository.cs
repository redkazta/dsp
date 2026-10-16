using Microsoft.EntityFrameworkCore;
using WildForgeLabs.Core.Entities;

namespace WildForgeLabs.Infrastructure.Data.Modules.Notifications;

public class NotificationRepository : INotificationRepository
{
    private readonly WildForgeLabsDbContext _context;

    public NotificationRepository(WildForgeLabsDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<Notification>> GetUnreadNotificationsAsync(Guid userId)
    {
        return await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();
    }

    public async Task MarkAsReadAsync(Guid notificationId)
    {
        var notification = await _context.Notifications.FindAsync(notificationId);
        if (notification != null)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
            _context.Notifications.Update(notification);
            await _context.SaveChangesAsync();
        }
    }

    public async Task<Notification> CreateNotificationAsync(Guid userId, string title, string message, string type = "info")
    {
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = title,
            Message = message,
            Type = type,
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();

        return notification;
    }
}
