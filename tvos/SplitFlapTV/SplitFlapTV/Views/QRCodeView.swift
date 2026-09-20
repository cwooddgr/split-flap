import SwiftUI
import CoreImage.CIFilterBuiltins
import UIKit

/// Simple QR code view for tvOS using CoreImage.
/// Generates a QR code image for the given string.
struct QRCodeView: View {
    let text: String
    let size: CGFloat

    /// ContentView's body runs again on every message, and this view with it.
    /// A CIContext is expensive to make and the image never changes for a
    /// given text and size, so both are kept. Main thread only.
    private static let context = CIContext()
    private static var cache: [String: UIImage] = [:]

    var body: some View {
        if let image = Self.qrCode(for: text, size: size) {
            Image(uiImage: image)
                .interpolation(.none)
                .resizable()
                .frame(width: size, height: size)
        } else {
            Color.gray
                .frame(width: size, height: size)
        }
    }

    private static func qrCode(for string: String, size: CGFloat) -> UIImage? {
        let key = "\(size)|\(string)"
        if let cached = cache[key] { return cached }

        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)

        guard let outputImage = filter.outputImage else {
            return nil
        }

        // Scale up the QR code for tvOS resolution
        let scaleX = size / outputImage.extent.size.width
        let scaleY = size / outputImage.extent.size.height
        let transformedImage = outputImage.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))

        guard let cgImage = context.createCGImage(transformedImage, from: transformedImage.extent) else {
            return nil
        }
        let image = UIImage(cgImage: cgImage)
        cache[key] = image
        return image
    }
}
