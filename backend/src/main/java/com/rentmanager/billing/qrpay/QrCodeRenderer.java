package com.rentmanager.billing.qrpay;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.Map;
import javax.imageio.ImageIO;
import org.springframework.stereotype.Component;

/**
 * Renders a QR payload string to a PNG {@code data:} URL — the Java equivalent
 * of {@code QRCode.toDataURL(qrString, { margin: 1, width: 240 })} used across
 * the Next M13 flow. Drop-in for an {@code <img src>} in the portal and the
 * printable receipt. Uses ZXing to build the bit-matrix and java.awt/ImageIO to
 * encode the PNG (no extra {@code zxing:javase} dependency).
 */
@Component
public class QrCodeRenderer {

  private static final int SIZE = 240;   // px, matches the Next width
  private static final int MARGIN = 1;    // QR "quiet zone" modules, matches margin:1

  /** @return a {@code data:image/png;base64,...} URL, or throws on encode failure. */
  public String toPngDataUrl(String payload) {
    try {
      Map<EncodeHintType, Object> hints = Map.of(
          EncodeHintType.MARGIN, MARGIN,
          EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M,
          EncodeHintType.CHARACTER_SET, "UTF-8");
      BitMatrix matrix =
          new QRCodeWriter().encode(payload, BarcodeFormat.QR_CODE, SIZE, SIZE, hints);
      BufferedImage img = new BufferedImage(matrix.getWidth(), matrix.getHeight(),
          BufferedImage.TYPE_INT_RGB);
      for (int x = 0; x < matrix.getWidth(); x++) {
        for (int y = 0; y < matrix.getHeight(); y++) {
          img.setRGB(x, y, matrix.get(x, y) ? 0xFF000000 : 0xFFFFFFFF);
        }
      }
      ByteArrayOutputStream out = new ByteArrayOutputStream();
      ImageIO.write(img, "png", out);
      return "data:image/png;base64," + Base64.getEncoder().encodeToString(out.toByteArray());
    } catch (Exception e) {
      throw new IllegalStateException("Failed to render QR code", e);
    }
  }
}
