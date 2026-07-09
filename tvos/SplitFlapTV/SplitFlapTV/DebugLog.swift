import Foundation
import os

/// Timing-focused debug logging, active in DEBUG builds only.
///
/// Every line carries a millisecond wall-clock timestamp and is emitted both
/// to stdout (Xcode console) and to os.Logger under subsystem
/// `co.dgrlabs.flipflap`, so timings can be streamed in Console.app from a
/// device with no Xcode session attached.
#if DEBUG
private let osLogger = Logger(subsystem: "co.dgrlabs.flipflap", category: "timing")

private let timestampFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "HH:mm:ss.SSS"
    return f
}()
#endif

func debugLog(_ message: @autoclosure () -> String) {
    #if DEBUG
    let line = "[\(timestampFormatter.string(from: Date()))] \(message())"
    print(line)
    osLogger.info("\(line, privacy: .public)")
    #endif
}

/// Milliseconds between two dates, for compact log lines.
func debugMs(from start: Date, to end: Date = Date()) -> String {
    String(format: "%.0fms", end.timeIntervalSince(start) * 1000)
}
