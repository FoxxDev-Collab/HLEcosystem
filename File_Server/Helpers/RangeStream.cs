namespace HLE.FileServer.Helpers;

/// <summary>
/// A stream wrapper that limits reading to a specified number of bytes.
/// Used for HTTP Range requests (partial content downloads).
/// </summary>
public class RangeStream : Stream
{
    private readonly Stream _innerStream;
    private readonly long _length;
    private long _position;

    public RangeStream(Stream innerStream, long length)
    {
        _innerStream = innerStream ?? throw new ArgumentNullException(nameof(innerStream));
        _length = length;
        _position = 0;
    }

    public override bool CanRead => _innerStream.CanRead;
    public override bool CanSeek => false;
    public override bool CanWrite => false;
    public override long Length => _length;

    public override long Position
    {
        get => _position;
        set => throw new NotSupportedException();
    }

    public override int Read(byte[] buffer, int offset, int count)
    {
        var remaining = _length - _position;
        if (remaining <= 0) return 0;

        var toRead = (int)Math.Min(count, remaining);
        var bytesRead = _innerStream.Read(buffer, offset, toRead);
        _position += bytesRead;
        return bytesRead;
    }

    public override async Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
    {
        var remaining = _length - _position;
        if (remaining <= 0) return 0;

        var toRead = (int)Math.Min(count, remaining);
        var bytesRead = await _innerStream.ReadAsync(buffer.AsMemory(offset, toRead), cancellationToken);
        _position += bytesRead;
        return bytesRead;
    }

    public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
    {
        var remaining = _length - _position;
        if (remaining <= 0) return 0;

        var toRead = (int)Math.Min(buffer.Length, remaining);
        var bytesRead = await _innerStream.ReadAsync(buffer[..toRead], cancellationToken);
        _position += bytesRead;
        return bytesRead;
    }

    public override void Flush() => _innerStream.Flush();

    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();

    public override void SetLength(long value) => throw new NotSupportedException();

    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _innerStream.Dispose();
        }
        base.Dispose(disposing);
    }

    public override async ValueTask DisposeAsync()
    {
        await _innerStream.DisposeAsync();
        await base.DisposeAsync();
    }
}
